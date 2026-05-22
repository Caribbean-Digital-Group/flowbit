-- ============================================================================
-- Migration: Separate team members from business partners on rel_partner_company
--
-- Problem: rel_partner_company mixes two different kinds of relationships:
--   - Team members  (colaboradores con acceso al panel)
--   - Business partners (clientes/proveedores creados desde /admin/partners)
-- Because both share the same table, deactivating a row (is_active=false) from
-- the Team view also hides the partner from the Partners list, and viceversa.
--
-- Solution:
--   * Add a `relationship_type` column (`team` | `partner`) so each row is
--     tagged according to its purpose.
--   * Backfill existing rows using deterministic rules:
--       - role IN ('owner','admin') => team (must keep panel access)
--       - invitation_status = 'pending' => team (it's a sent invitation)
--       - partner.user_id IS NOT NULL => team (the partner is a real user)
--       - role = 'guest' AND no user_id => partner (created from /admin/partners)
--       - everything else => partner (safer default)
--   * Replace the UNIQUE (partner_id, company_id) constraint with a uniqueness
--     scoped by relationship_type so the same partner_id may appear once as
--     team and once as business partner if needed.
--   * Update the existing RPCs to set / filter by `relationship_type`.
-- ============================================================================

-- ============================================================================
-- 1. Enum + column
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_relationship_type') THEN
        CREATE TYPE partner_relationship_type AS ENUM ('team', 'partner');
    END IF;
END
$$;

ALTER TABLE public.rel_partner_company
    ADD COLUMN IF NOT EXISTS relationship_type partner_relationship_type;

-- ============================================================================
-- 2. Backfill existing rows
-- ============================================================================
UPDATE public.rel_partner_company rpc
SET relationship_type = 'team'
WHERE relationship_type IS NULL
  AND (
      rpc.role IN ('owner', 'admin')
      OR rpc.invitation_status = 'pending'
      OR EXISTS (
          SELECT 1 FROM public.partner p
          WHERE p.id = rpc.partner_id
            AND p.user_id IS NOT NULL
      )
  );

UPDATE public.rel_partner_company
SET relationship_type = 'partner'
WHERE relationship_type IS NULL;

ALTER TABLE public.rel_partner_company
    ALTER COLUMN relationship_type SET NOT NULL;

ALTER TABLE public.rel_partner_company
    ALTER COLUMN relationship_type SET DEFAULT 'partner';

CREATE INDEX IF NOT EXISTS idx_rel_partner_company_relationship_type
    ON public.rel_partner_company(relationship_type);

CREATE INDEX IF NOT EXISTS idx_rel_partner_company_company_type_active
    ON public.rel_partner_company(company_id, relationship_type, is_active);

-- ============================================================================
-- 3. Replace UNIQUE constraint to allow team + partner for the same pair
-- ============================================================================
ALTER TABLE public.rel_partner_company
    DROP CONSTRAINT IF EXISTS rel_partner_company_partner_id_company_id_key;

ALTER TABLE public.rel_partner_company
    DROP CONSTRAINT IF EXISTS rel_partner_company_unique;

ALTER TABLE public.rel_partner_company
    ADD CONSTRAINT rel_partner_company_unique
    UNIQUE (partner_id, company_id, relationship_type);

COMMENT ON COLUMN public.rel_partner_company.relationship_type IS
    'team = collaborator with platform access; partner = business contact (client/supplier).';

-- ============================================================================
-- 4. Update create_partner_for_company: business contacts are 'partner'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_partner_for_company(
    p_company_id UUID,
    p_partner JSONB
)
RETURNS public.partner
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_partner public.partner;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can create partners'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.partner (
        name,
        display_name,
        email,
        phone,
        mobile,
        website,
        street,
        street2,
        city,
        state,
        zip,
        country_code,
        vat,
        function,
        credit_limit,
        comment,
        company_type,
        active,
        created_by,
        updated_by
    )
    VALUES (
        COALESCE(NULLIF(p_partner->>'name', ''), 'Untitled'),
        NULLIF(p_partner->>'display_name', ''),
        NULLIF(p_partner->>'email', ''),
        NULLIF(p_partner->>'phone', ''),
        NULLIF(p_partner->>'mobile', ''),
        NULLIF(p_partner->>'website', ''),
        NULLIF(p_partner->>'street', ''),
        NULLIF(p_partner->>'street2', ''),
        NULLIF(p_partner->>'city', ''),
        NULLIF(p_partner->>'state', ''),
        NULLIF(p_partner->>'zip', ''),
        NULLIF(p_partner->>'country_code', ''),
        NULLIF(p_partner->>'vat', ''),
        NULLIF(p_partner->>'function', ''),
        COALESCE(NULLIF(p_partner->>'credit_limit', '')::numeric, 0),
        NULLIF(p_partner->>'comment', ''),
        COALESCE(NULLIF(p_partner->>'company_type', '')::partner_type, 'person'),
        true,
        v_user_id,
        v_user_id
    )
    RETURNING * INTO v_partner;

    INSERT INTO public.rel_partner_company (
        partner_id,
        company_id,
        role,
        invitation_status,
        accepted_at,
        is_default,
        is_active,
        relationship_type
    )
    VALUES (
        v_partner.id,
        p_company_id,
        'guest',
        'accepted',
        now(),
        false,
        true,
        'partner'
    );

    RETURN v_partner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Update invite_partner_by_email: invited users always go to 'team'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.invite_partner_by_email(
    p_company_id UUID,
    p_email TEXT,
    p_role partner_company_role DEFAULT 'member'
)
RETURNS UUID
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_inviter_partner_id UUID;
    v_invitee_partner_id UUID;
    v_existing_rel public.rel_partner_company;
    v_new_rel_id UUID;
    v_normalized_email TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Company id is required'
            USING ERRCODE = '22023';
    END IF;

    v_normalized_email := lower(trim(coalesce(p_email, '')));
    IF v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'A valid email is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_role IS NULL THEN
        p_role := 'member';
    END IF;

    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can invite members'
            USING ERRCODE = '42501';
    END IF;

    IF p_role = 'owner' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.rel_partner_company rpc
            JOIN public.partner p ON p.id = rpc.partner_id
            WHERE rpc.company_id = p_company_id
              AND p.user_id = v_user_id
              AND rpc.role = 'owner'
              AND rpc.invitation_status = 'accepted'
              AND rpc.is_active = true
        ) THEN
            RAISE EXCEPTION 'Only owners can invite another owner'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT p.id INTO v_inviter_partner_id
    FROM public.partner p
    WHERE p.user_id = v_user_id
    LIMIT 1;

    -- Reuse an existing partner (by email) regardless of relationship_type.
    SELECT p.id INTO v_invitee_partner_id
    FROM public.partner p
    WHERE lower(p.email) = v_normalized_email
    ORDER BY p.created_at ASC
    LIMIT 1;

    IF v_invitee_partner_id IS NULL THEN
        INSERT INTO public.partner (
            name,
            email,
            company_type,
            active,
            created_by,
            updated_by
        ) VALUES (
            split_part(v_normalized_email, '@', 1),
            v_normalized_email,
            'person',
            true,
            v_user_id,
            v_user_id
        )
        RETURNING id INTO v_invitee_partner_id;
    END IF;

    IF v_invitee_partner_id = v_inviter_partner_id THEN
        RAISE EXCEPTION 'You cannot invite yourself'
            USING ERRCODE = '22023';
    END IF;

    -- Look for an existing TEAM relationship (a business partner with the
    -- same partner_id+company_id is allowed since they live in their own row).
    SELECT * INTO v_existing_rel
    FROM public.rel_partner_company rpc
    WHERE rpc.partner_id = v_invitee_partner_id
      AND rpc.company_id = p_company_id
      AND rpc.relationship_type = 'team'
    LIMIT 1;

    IF v_existing_rel.id IS NOT NULL THEN
        IF v_existing_rel.invitation_status = 'accepted' AND v_existing_rel.is_active THEN
            RAISE EXCEPTION 'User is already a member of this company'
                USING ERRCODE = '23505';
        ELSIF v_existing_rel.invitation_status = 'pending' AND v_existing_rel.is_active THEN
            RAISE EXCEPTION 'There is already a pending invitation for this user'
                USING ERRCODE = '23505';
        ELSE
            UPDATE public.rel_partner_company
            SET role = p_role,
                invitation_status = 'pending',
                invited_by = v_inviter_partner_id,
                invited_at = now(),
                accepted_at = NULL,
                is_active = true
            WHERE id = v_existing_rel.id;

            RETURN v_existing_rel.id;
        END IF;
    END IF;

    INSERT INTO public.rel_partner_company (
        partner_id,
        company_id,
        role,
        invitation_status,
        invited_by,
        invited_at,
        is_default,
        is_active,
        relationship_type
    ) VALUES (
        v_invitee_partner_id,
        p_company_id,
        p_role,
        'pending',
        v_inviter_partner_id,
        now(),
        false,
        true,
        'team'
    )
    RETURNING id INTO v_new_rel_id;

    RETURN v_new_rel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Update handle_new_user: owner row of personal workspace is 'team'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_partner_id UUID;
    new_company_id UUID;
    user_name VARCHAR(255);
    existing_partner_id UUID;
    normalized_email TEXT;
BEGIN
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    normalized_email := lower(trim(NEW.email));

    SELECT id INTO existing_partner_id
    FROM public.partner
    WHERE lower(email) = normalized_email
      AND user_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF existing_partner_id IS NOT NULL THEN
        UPDATE public.partner
        SET user_id = NEW.id,
            name = COALESCE(NULLIF(name, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)),
            updated_by = NEW.id
        WHERE id = existing_partner_id;

        new_partner_id := existing_partner_id;
    ELSE
        INSERT INTO public.partner (
            user_id,
            name,
            email,
            company_type,
            created_by
        ) VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NEW.email,
            'person',
            NEW.id
        )
        RETURNING id INTO new_partner_id;
    END IF;

    INSERT INTO public.company (
        name,
        display_name,
        email,
        is_personal,
        status,
        created_by
    ) VALUES (
        user_name || '''s Workspace',
        user_name || '''s Workspace',
        NEW.email,
        true,
        'active',
        NEW.id
    )
    RETURNING id INTO new_company_id;

    INSERT INTO public.rel_partner_company (
        partner_id,
        company_id,
        role,
        invitation_status,
        accepted_at,
        is_default,
        is_active,
        relationship_type
    ) VALUES (
        new_partner_id,
        new_company_id,
        'owner',
        'accepted',
        now(),
        true,
        true,
        'team'
    )
    ON CONFLICT (partner_id, company_id, relationship_type) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Update get_company_members: scope by relationship_type (default 'team')
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_company_members(UUID);

CREATE OR REPLACE FUNCTION public.get_company_members(
    p_company_id UUID,
    p_relationship_type partner_relationship_type DEFAULT 'team'
)
RETURNS TABLE (
    relationship_id UUID,
    partner_id UUID,
    company_id UUID,
    role TEXT,
    invitation_status TEXT,
    is_active BOOLEAN,
    is_default BOOLEAN,
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    relationship_type TEXT,
    partner_name TEXT,
    partner_display_name TEXT,
    partner_email TEXT,
    partner_avatar_url TEXT,
    partner_user_id UUID,
    invited_by_partner_id UUID,
    invited_by_name TEXT,
    invited_by_email TEXT
) AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can list members'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        rpc.id AS relationship_id,
        rpc.partner_id,
        rpc.company_id,
        rpc.role::TEXT,
        rpc.invitation_status::TEXT,
        rpc.is_active,
        rpc.is_default,
        rpc.invited_at,
        rpc.accepted_at,
        rpc.created_at,
        rpc.relationship_type::TEXT,
        p.name::TEXT AS partner_name,
        p.display_name::TEXT AS partner_display_name,
        p.email::TEXT AS partner_email,
        p.avatar_url::TEXT AS partner_avatar_url,
        p.user_id AS partner_user_id,
        rpc.invited_by AS invited_by_partner_id,
        inv.name::TEXT AS invited_by_name,
        inv.email::TEXT AS invited_by_email
    FROM public.rel_partner_company rpc
    JOIN public.partner p ON p.id = rpc.partner_id
    LEFT JOIN public.partner inv ON inv.id = rpc.invited_by
    WHERE rpc.company_id = p_company_id
      AND rpc.is_active = true
      AND rpc.relationship_type = p_relationship_type
    ORDER BY
        CASE rpc.invitation_status
            WHEN 'accepted' THEN 0
            WHEN 'pending' THEN 1
            ELSE 2
        END,
        rpc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_company_members(UUID, partner_relationship_type) TO authenticated;

COMMENT ON FUNCTION public.get_company_members IS
    'Lists rows in rel_partner_company for a company, scoped by relationship_type (team by default).';

-- ============================================================================
-- 8. Update get_partner_companies: only return team relationships
-- The company selector in the topbar should never expose companies where the
-- user is only a business contact.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_partner_companies(p_partner_id UUID)
RETURNS TABLE (
    company_id UUID,
    role TEXT,
    is_default BOOLEAN,
    invitation_status TEXT
) AS $$
BEGIN
    IF NOT public.is_own_partner(p_partner_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        rpc.company_id,
        rpc.role::TEXT,
        rpc.is_default,
        rpc.invitation_status::TEXT
    FROM public.rel_partner_company rpc
    WHERE rpc.partner_id = p_partner_id
      AND rpc.invitation_status = 'accepted'
      AND rpc.is_active = true
      AND rpc.relationship_type = 'team';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 9. Update v_partner_companies view to include relationship_type
--
-- Postgres rejects column reordering / renaming on CREATE OR REPLACE VIEW
-- (SQLSTATE 42P16), so we keep the original column order intact and append
-- `relationship_type` at the end.
-- ============================================================================
CREATE OR REPLACE VIEW public.v_partner_companies AS
SELECT
    rpc.id AS relationship_id,
    rpc.partner_id,
    rpc.company_id,
    rpc.role,
    rpc.invitation_status,
    rpc.is_default,
    rpc.is_active,
    rpc.accepted_at,
    c.name AS company_name,
    c.display_name AS company_display_name,
    c.logo_url AS company_logo,
    c.is_personal AS company_is_personal,
    c.status AS company_status,
    p.name AS partner_name,
    p.email AS partner_email,
    rpc.relationship_type
FROM public.rel_partner_company rpc
JOIN public.company c ON c.id = rpc.company_id
JOIN public.partner p ON p.id = rpc.partner_id
WHERE rpc.is_active = true;
