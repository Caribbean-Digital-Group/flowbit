-- ============================================================================
-- Migration: Fix infinite recursion in RLS policies
-- The "Owners and admins can manage relationships" policy on rel_partner_company
-- references itself, causing PostgreSQL error 42P17.
-- Solution: SECURITY DEFINER functions that bypass RLS for permission checks.
-- ============================================================================

-- ============================================================================
-- Helper functions (SECURITY DEFINER bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.rel_partner_company rpc
        JOIN public.partner p ON p.id = rpc.partner_id
        WHERE rpc.company_id = p_company_id
          AND p.user_id = auth.uid()
          AND rpc.invitation_status = 'accepted'
          AND rpc.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.rel_partner_company rpc
        JOIN public.partner p ON p.id = rpc.partner_id
        WHERE rpc.company_id = p_company_id
          AND p.user_id = auth.uid()
          AND rpc.role IN ('owner', 'admin')
          AND rpc.invitation_status = 'accepted'
          AND rpc.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_own_partner(p_partner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.partner p
        WHERE p.id = p_partner_id
          AND p.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Fix rel_partner_company policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own relationships" ON public.rel_partner_company;
DROP POLICY IF EXISTS "Owners and admins can manage relationships" ON public.rel_partner_company;
DROP POLICY IF EXISTS "Users can respond to invitations" ON public.rel_partner_company;

CREATE POLICY "Users can view own relationships" ON public.rel_partner_company
    FOR SELECT
    USING (public.is_own_partner(partner_id));

CREATE POLICY "Admins can manage relationships" ON public.rel_partner_company
    FOR ALL
    USING (public.is_company_admin(company_id));

CREATE POLICY "Users can respond to invitations" ON public.rel_partner_company
    FOR UPDATE
    USING (public.is_own_partner(partner_id))
    WITH CHECK (public.is_own_partner(partner_id));

-- ============================================================================
-- Fix company policies (they SELECT rel_partner_company, triggering recursion)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their companies" ON public.company;
DROP POLICY IF EXISTS "Owners and admins can update companies" ON public.company;

CREATE POLICY "Users can view their companies" ON public.company
    FOR SELECT
    USING (public.is_company_member(id));

CREATE POLICY "Owners and admins can update companies" ON public.company
    FOR UPDATE
    USING (public.is_company_admin(id))
    WITH CHECK (public.is_company_admin(id));

-- ============================================================================
-- RPC: Get partner companies (used by the auth store)
-- SECURITY DEFINER to bypass RLS on rel_partner_company
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
      AND rpc.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.is_company_member IS 'Check if current user is an active member of a company (bypasses RLS)';
COMMENT ON FUNCTION public.is_company_admin IS 'Check if current user is an owner or admin of a company (bypasses RLS)';
COMMENT ON FUNCTION public.is_own_partner IS 'Check if a partner_id belongs to the current auth user (bypasses RLS)';
COMMENT ON FUNCTION public.get_partner_companies IS 'Get all accepted companies for a partner (bypasses RLS, validates ownership)';
