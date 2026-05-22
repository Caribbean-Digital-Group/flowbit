-- ============================================================================
-- Migration: Fix partner.is_company generated column + RPC to create
-- partners scoped to a company.
--
-- Problem 1: `is_company` is defined as `GENERATED ALWAYS AS ... STORED`,
-- so the Supabase Studio dashboard cannot insert rows without manually
-- removing the column from the form (error 428C9).
--
-- Problem 2: RLS is enabled on `public.partner` but only SELECT and UPDATE
-- policies exist. Any direct `insert` from an authenticated client is
-- rejected with error 42501 (row-level security).
--
-- Solution:
--   1. Drop the generated expression on `is_company` (keeps the column,
--      its data and indexes intact) and recreate the value via trigger.
--   2. Add an RPC `create_partner_for_company` (SECURITY DEFINER) that:
--      - validates the caller is owner/admin of the target company,
--      - inserts the partner record,
--      - links it to the company via rel_partner_company,
--      atomically and bypassing RLS in a controlled way.
-- ============================================================================

-- ============================================================================
-- 1. Convert `is_company` from generated to a regular column maintained by trigger
-- ============================================================================

ALTER TABLE public.partner
    ALTER COLUMN is_company DROP EXPRESSION IF EXISTS;

ALTER TABLE public.partner
    ALTER COLUMN is_company SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_partner_is_company()
RETURNS TRIGGER AS $$
BEGIN
    NEW.is_company := (NEW.company_type = 'company');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_partner_sync_is_company ON public.partner;

CREATE TRIGGER trigger_partner_sync_is_company
    BEFORE INSERT OR UPDATE OF company_type ON public.partner
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_partner_is_company();

UPDATE public.partner
SET is_company = (company_type = 'company')
WHERE is_company IS DISTINCT FROM (company_type = 'company');

COMMENT ON COLUMN public.partner.is_company IS
    'True if company_type is ''company''. Maintained automatically by trigger trigger_partner_sync_is_company.';

-- ============================================================================
-- 2. RPC: create_partner_for_company
-- Atomically creates a partner and links it to a company. Validates that the
-- caller is owner/admin of the company.
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
        is_active
    )
    VALUES (
        v_partner.id,
        p_company_id,
        'guest',
        'accepted',
        now(),
        false,
        true
    );

    RETURN v_partner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_partner_for_company(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_partner_for_company IS
    'Creates a partner and links it to the given company in a single transaction. '
    'Caller must be owner or admin of the target company. Bypasses RLS via SECURITY DEFINER.';
