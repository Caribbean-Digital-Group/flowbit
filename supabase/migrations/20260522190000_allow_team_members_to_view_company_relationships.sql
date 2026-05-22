-- ============================================================================
-- Migration: Allow team members to view all relationships of their companies
--
-- Problem: The existing SELECT policy on `rel_partner_company` only let a
-- user see rows where their own partner_id appears. As a consequence, a
-- regular team member (member/viewer/guest/admin) could not list business
-- partners of a company because the underlying join on rel_partner_company
-- returned 0 rows for them. Only owners and admins could see partners
-- (through the "Admins can manage relationships" policy).
--
-- Solution: Expand the SELECT policy so that any active team member of the
-- company can read all rel_partner_company rows of that company (team
-- collaborators + business partners). RLS recursion is avoided because
-- `is_company_member` and `is_own_partner` are SECURITY DEFINER helpers.
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own relationships" ON public.rel_partner_company;
DROP POLICY IF EXISTS "Users can view their company relationships" ON public.rel_partner_company;

CREATE POLICY "Users can view their company relationships" ON public.rel_partner_company
    FOR SELECT
    USING (
        public.is_own_partner(partner_id)
        OR public.is_company_member(company_id)
    );

COMMENT ON POLICY "Users can view their company relationships" ON public.rel_partner_company IS
    'A user can read a rel_partner_company row if (a) it points to their own partner, or (b) they are an accepted team member of the row''s company.';
