-- ============================================================================
-- Migration: Team membership module
-- Manages company members, role updates, invitations, and accept/reject flow
-- via the rel_partner_company pivot table.
--
-- Highlights:
--   * Allows invited users to SELECT the company they were invited to so the
--     "received invitations" UI can render company name/logo.
--   * Auto-links pending invitations to a fresh user when they sign up with
--     the same email previously used in an invitation.
--   * SECURITY DEFINER RPCs to avoid RLS recursion when listing members and
--     managing the membership lifecycle.
-- ============================================================================

-- ============================================================================
-- Helper: invited (pending) member check, bypasses RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_invited_to_company(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.rel_partner_company rpc
        JOIN public.partner p ON p.id = rpc.partner_id
        WHERE rpc.company_id = p_company_id
          AND p.user_id = auth.uid()
          AND rpc.invitation_status = 'pending'
          AND rpc.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_invited_to_company IS
    'Check whether the current user has a pending invitation for the given company (bypasses RLS).';

-- ============================================================================
-- Company SELECT policy: allow members AND pending invitees to see company
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their companies" ON public.company;

CREATE POLICY "Users can view their companies" ON public.company
    FOR SELECT
    USING (
        public.is_company_member(id)
        OR public.is_invited_to_company(id)
    );

-- ============================================================================
-- RPC: list all members (and pending invitations) of a company
-- Only callable by company owners/admins.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_company_members(p_company_id UUID)
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
    ORDER BY
        CASE rpc.invitation_status
            WHEN 'accepted' THEN 0
            WHEN 'pending' THEN 1
            ELSE 2
        END,
        rpc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_company_members(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_company_members IS
    'Returns all active members and pending invitations for a company. Caller must be owner/admin.';

-- ============================================================================
-- RPC: list pending invitations received by current user's partner
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_invitations()
RETURNS TABLE (
    relationship_id UUID,
    company_id UUID,
    company_name TEXT,
    company_display_name TEXT,
    company_logo_url TEXT,
    company_is_personal BOOLEAN,
    role TEXT,
    invitation_status TEXT,
    invited_at TIMESTAMPTZ,
    invited_by_partner_id UUID,
    invited_by_name TEXT,
    invited_by_email TEXT
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        rpc.id AS relationship_id,
        c.id AS company_id,
        c.name::TEXT AS company_name,
        c.display_name::TEXT AS company_display_name,
        c.logo_url::TEXT AS company_logo_url,
        c.is_personal AS company_is_personal,
        rpc.role::TEXT,
        rpc.invitation_status::TEXT,
        rpc.invited_at,
        rpc.invited_by AS invited_by_partner_id,
        inv.name::TEXT AS invited_by_name,
        inv.email::TEXT AS invited_by_email
    FROM public.rel_partner_company rpc
    JOIN public.partner p ON p.id = rpc.partner_id
    JOIN public.company c ON c.id = rpc.company_id
    LEFT JOIN public.partner inv ON inv.id = rpc.invited_by
    WHERE p.user_id = v_user_id
      AND rpc.invitation_status = 'pending'
      AND rpc.is_active = true
    ORDER BY rpc.invited_at DESC NULLS LAST, rpc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_my_invitations() TO authenticated;

COMMENT ON FUNCTION public.get_my_invitations IS
    'Returns pending invitations for the current authenticated user.';

-- ============================================================================
-- RPC: invite a user (by email) to join a company
--
-- Behavior:
--   * If a partner with that email already exists, the existing partner is
--     used (regardless of whether they already have a Supabase auth user).
--   * If no partner exists, a stub `person` partner is created. When the
--     invited person signs up with that email, handle_new_user() will link
--     the auth user to that pre-existing partner.
--   * If the partner already has an active relationship with the company:
--       - status 'accepted'  -> raise (already member)
--       - status 'pending'   -> raise (invitation already sent)
--       - status 'rejected'  -> re-open as pending
--   * Returns the rel_partner_company.id of the resulting invitation.
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

    -- Only owners/admins of the company can invite.
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can invite members'
            USING ERRCODE = '42501';
    END IF;

    -- Owner role can only be granted by an existing owner.
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

    -- Resolve inviter partner id (for invited_by audit).
    SELECT p.id INTO v_inviter_partner_id
    FROM public.partner p
    WHERE p.user_id = v_user_id
    LIMIT 1;

    -- Find an existing partner with that email; otherwise create a stub.
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

    -- Self-invitation guard.
    IF v_invitee_partner_id = v_inviter_partner_id THEN
        RAISE EXCEPTION 'You cannot invite yourself'
            USING ERRCODE = '22023';
    END IF;

    -- Check existing relationship.
    SELECT * INTO v_existing_rel
    FROM public.rel_partner_company rpc
    WHERE rpc.partner_id = v_invitee_partner_id
      AND rpc.company_id = p_company_id
    LIMIT 1;

    IF v_existing_rel.id IS NOT NULL THEN
        IF v_existing_rel.invitation_status = 'accepted' AND v_existing_rel.is_active THEN
            RAISE EXCEPTION 'User is already a member of this company'
                USING ERRCODE = '23505';
        ELSIF v_existing_rel.invitation_status = 'pending' AND v_existing_rel.is_active THEN
            RAISE EXCEPTION 'There is already a pending invitation for this user'
                USING ERRCODE = '23505';
        ELSE
            -- Reopen relation (rejected/expired/cancelled or archived) as a new invitation.
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

    -- Create the invitation row.
    INSERT INTO public.rel_partner_company (
        partner_id,
        company_id,
        role,
        invitation_status,
        invited_by,
        invited_at,
        is_default,
        is_active
    ) VALUES (
        v_invitee_partner_id,
        p_company_id,
        p_role,
        'pending',
        v_inviter_partner_id,
        now(),
        false,
        true
    )
    RETURNING id INTO v_new_rel_id;

    RETURN v_new_rel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.invite_partner_by_email(UUID, TEXT, partner_company_role) TO authenticated;

COMMENT ON FUNCTION public.invite_partner_by_email IS
    'Invite a user (by email) to a company. Creates a stub partner if needed. Caller must be owner/admin.';

-- ============================================================================
-- RPC: accept / reject an invitation
-- Replaces the previous helper with explicit ownership validation.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.respond_to_invitation(
    p_rel_id UUID,
    p_accept BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_partner_id UUID;
    v_rel public.rel_partner_company;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rel
    FROM public.rel_partner_company
    WHERE id = p_rel_id
    LIMIT 1;

    IF v_rel.id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT id INTO v_partner_id
    FROM public.partner
    WHERE id = v_rel.partner_id
      AND user_id = v_user_id;

    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'You cannot respond to an invitation that is not yours'
            USING ERRCODE = '42501';
    END IF;

    IF v_rel.invitation_status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer pending'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.rel_partner_company
    SET invitation_status = CASE WHEN p_accept THEN 'accepted'::invitation_status ELSE 'rejected'::invitation_status END,
        accepted_at = CASE WHEN p_accept THEN now() ELSE NULL END
    WHERE id = p_rel_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.respond_to_invitation(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.respond_to_invitation IS
    'Accept or reject an invitation. Only the invited partner (via auth.uid) can respond.';

-- ============================================================================
-- RPC: update a member's role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_member_role(
    p_rel_id UUID,
    p_role partner_company_role
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rel public.rel_partner_company;
    v_is_caller_owner BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF p_role IS NULL THEN
        RAISE EXCEPTION 'Role is required'
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_rel
    FROM public.rel_partner_company
    WHERE id = p_rel_id
    LIMIT 1;

    IF v_rel.id IS NULL THEN
        RAISE EXCEPTION 'Membership not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT public.is_company_admin(v_rel.company_id) THEN
        RAISE EXCEPTION 'Only owners or admins can change member roles'
            USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.rel_partner_company rpc
        JOIN public.partner p ON p.id = rpc.partner_id
        WHERE rpc.company_id = v_rel.company_id
          AND p.user_id = v_user_id
          AND rpc.role = 'owner'
          AND rpc.invitation_status = 'accepted'
          AND rpc.is_active = true
    ) INTO v_is_caller_owner;

    -- Only an owner can grant or revoke the owner role.
    IF (p_role = 'owner' OR v_rel.role = 'owner') AND NOT v_is_caller_owner THEN
        RAISE EXCEPTION 'Only an owner can grant or change the owner role'
            USING ERRCODE = '42501';
    END IF;

    -- Don't allow demoting the last owner of the company.
    IF v_rel.role = 'owner' AND p_role <> 'owner' THEN
        IF (
            SELECT COUNT(*)
            FROM public.rel_partner_company
            WHERE company_id = v_rel.company_id
              AND role = 'owner'
              AND invitation_status = 'accepted'
              AND is_active = true
        ) <= 1 THEN
            RAISE EXCEPTION 'You cannot demote the last owner of the company'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    UPDATE public.rel_partner_company
    SET role = p_role
    WHERE id = p_rel_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, partner_company_role) TO authenticated;

COMMENT ON FUNCTION public.update_member_role IS
    'Change a member role within a company. Owner role mutations require caller to be owner.';

-- ============================================================================
-- RPC: remove a member or cancel a pending invitation (soft delete)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.remove_company_member(
    p_rel_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rel public.rel_partner_company;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rel
    FROM public.rel_partner_company
    WHERE id = p_rel_id
    LIMIT 1;

    IF v_rel.id IS NULL THEN
        RAISE EXCEPTION 'Membership not found'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT public.is_company_admin(v_rel.company_id) THEN
        RAISE EXCEPTION 'Only owners or admins can remove members'
            USING ERRCODE = '42501';
    END IF;

    -- Protect the last owner.
    IF v_rel.role = 'owner' AND v_rel.invitation_status = 'accepted' THEN
        IF (
            SELECT COUNT(*)
            FROM public.rel_partner_company
            WHERE company_id = v_rel.company_id
              AND role = 'owner'
              AND invitation_status = 'accepted'
              AND is_active = true
        ) <= 1 THEN
            RAISE EXCEPTION 'You cannot remove the last owner of the company'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    IF v_rel.invitation_status = 'pending' THEN
        UPDATE public.rel_partner_company
        SET invitation_status = 'cancelled',
            is_active = false
        WHERE id = p_rel_id;
    ELSE
        UPDATE public.rel_partner_company
        SET is_active = false
        WHERE id = p_rel_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.remove_company_member(UUID) TO authenticated;

COMMENT ON FUNCTION public.remove_company_member IS
    'Soft-deactivate a membership or cancel a pending invitation. Owner/admin only. Protects last owner.';

-- ============================================================================
-- handle_new_user: link auth user to a pre-existing partner if one matches
-- by email (created by an invitation). Avoids duplicating partner records.
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

    -- 1. Try to attach to an existing partner (created previously by an invitation).
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

    -- 2. Always create a default personal workspace for the new user.
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

    -- 3. Link the partner to the personal workspace as owner.
    INSERT INTO public.rel_partner_company (
        partner_id,
        company_id,
        role,
        invitation_status,
        accepted_at,
        is_default,
        is_active
    ) VALUES (
        new_partner_id,
        new_company_id,
        'owner',
        'accepted',
        now(),
        true,
        true
    )
    ON CONFLICT (partner_id, company_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
    'On new auth user: links to existing partner (by email) or creates one, then creates a personal workspace as owner.';
