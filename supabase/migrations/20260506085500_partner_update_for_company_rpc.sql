-- ============================================================================
-- Migration: RPC for partner updates scoped by company permissions
--
-- Fixes PGRST116 in partner edit flow when an authenticated user edits a
-- partner that does not belong to auth.uid() directly (e.g. customer records).
-- Direct UPDATE under RLS can return 0 rows; .single() then fails.
--
-- This RPC validates that the caller is owner/admin of at least one company
-- where the target partner is linked, then updates the record safely.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_partner_for_company(
    p_partner_id UUID,
    p_updates JSONB
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

    IF NOT EXISTS (
        SELECT 1
        FROM public.rel_partner_company rpc
        WHERE rpc.partner_id = p_partner_id
          AND rpc.is_active = true
          AND public.is_company_admin(rpc.company_id)
    ) THEN
        RAISE EXCEPTION 'Only company owners or admins can update this partner'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.partner p
    SET
        name = COALESCE(NULLIF(p_updates->>'name', ''), p.name),
        display_name = CASE WHEN p_updates ? 'display_name' THEN NULLIF(p_updates->>'display_name', '') ELSE p.display_name END,
        email = CASE WHEN p_updates ? 'email' THEN NULLIF(p_updates->>'email', '') ELSE p.email END,
        phone = CASE WHEN p_updates ? 'phone' THEN NULLIF(p_updates->>'phone', '') ELSE p.phone END,
        mobile = CASE WHEN p_updates ? 'mobile' THEN NULLIF(p_updates->>'mobile', '') ELSE p.mobile END,
        website = CASE WHEN p_updates ? 'website' THEN NULLIF(p_updates->>'website', '') ELSE p.website END,
        street = CASE WHEN p_updates ? 'street' THEN NULLIF(p_updates->>'street', '') ELSE p.street END,
        street2 = CASE WHEN p_updates ? 'street2' THEN NULLIF(p_updates->>'street2', '') ELSE p.street2 END,
        city = CASE WHEN p_updates ? 'city' THEN NULLIF(p_updates->>'city', '') ELSE p.city END,
        state = CASE WHEN p_updates ? 'state' THEN NULLIF(p_updates->>'state', '') ELSE p.state END,
        zip = CASE WHEN p_updates ? 'zip' THEN NULLIF(p_updates->>'zip', '') ELSE p.zip END,
        country_code = CASE WHEN p_updates ? 'country_code' THEN NULLIF(p_updates->>'country_code', '') ELSE p.country_code END,
        vat = CASE WHEN p_updates ? 'vat' THEN NULLIF(p_updates->>'vat', '') ELSE p.vat END,
        function = CASE WHEN p_updates ? 'function' THEN NULLIF(p_updates->>'function', '') ELSE p.function END,
        comment = CASE WHEN p_updates ? 'comment' THEN NULLIF(p_updates->>'comment', '') ELSE p.comment END,
        credit_limit = CASE
            WHEN p_updates ? 'credit_limit' THEN COALESCE(NULLIF(p_updates->>'credit_limit', '')::numeric, 0)
            ELSE p.credit_limit
        END,
        company_type = CASE
            WHEN p_updates ? 'company_type' THEN COALESCE(NULLIF(p_updates->>'company_type', '')::partner_type, p.company_type)
            ELSE p.company_type
        END,
        active = CASE
            WHEN p_updates ? 'active' THEN COALESCE((p_updates->>'active')::boolean, p.active)
            ELSE p.active
        END,
        updated_by = v_user_id
    WHERE p.id = p_partner_id
    RETURNING p.* INTO v_partner;

    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'Partner not found'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN v_partner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_partner_for_company(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.update_partner_for_company IS
    'Updates a partner if caller is owner/admin in a linked company. Bypasses RLS via SECURITY DEFINER.';
