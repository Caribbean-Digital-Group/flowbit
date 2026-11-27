-- =============================================================================
-- Membresías: cerrar la escalada a owner de cualquier empresa (TRY-64)
-- =============================================================================
-- Dos caminos permitían tomar el control de una empresa ajena:
--
-- 1. invite_partner_to_company (20260126205055): SECURITY DEFINER sin
--    validaciones y ejecutable por PUBLIC (incluido anon). Un usuario se
--    «invitaba» como owner a cualquier company_id y aceptaba con
--    respond_to_invitation. El frontend no la usa (usa invite_partner_by_email).
--
-- 2. Política «Users can respond to invitations» (FOR UPDATE, is_own_partner):
--    sin límite de columnas. Un miembro podía cambiar su propio role a 'owner'
--    o mover su fila a otro company_id con un PATCH por REST.
--
-- Responder invitaciones, cambiar roles y quitar miembros ya se hace por RPC
-- SECURITY DEFINER con sus propias validaciones (respond_to_invitation,
-- update_member_role, remove_company_member, invite_partner_by_email): no
-- dependen de la política que se elimina.
-- =============================================================================

-- 1) RPC heredado: solo service_role y, con sesión, mismas reglas que
--    invite_partner_by_email. La firma no cambia (database.types.ts igual).
CREATE OR REPLACE FUNCTION public.invite_partner_to_company(
    p_partner_id UUID,
    p_company_id UUID,
    p_role partner_company_role DEFAULT 'member',
    p_invited_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_caller_partner_id UUID;
    v_new_rel_id UUID;
BEGIN
    IF p_partner_id IS NULL OR p_company_id IS NULL THEN
        RAISE EXCEPTION 'Partner and company are required' USING ERRCODE = '22023';
    END IF;

    IF v_user_id IS NOT NULL THEN
        IF NOT public.is_company_admin(p_company_id) THEN
            RAISE EXCEPTION 'Only company owners or admins can invite members'
                USING ERRCODE = '42501';
        END IF;

        IF p_role = 'owner' AND NOT public.is_company_owner_user(p_company_id) THEN
            RAISE EXCEPTION 'Only owners can invite another owner' USING ERRCODE = '42501';
        END IF;

        SELECT id INTO v_caller_partner_id FROM public.partner WHERE user_id = v_user_id LIMIT 1;
        IF v_caller_partner_id = p_partner_id THEN
            RAISE EXCEPTION 'You cannot invite yourself' USING ERRCODE = '22023';
        END IF;
        -- Quien invita es quien llama, no un parámetro libre
        p_invited_by := v_caller_partner_id;
    END IF;

    INSERT INTO public.rel_partner_company (
        partner_id, company_id, role, invitation_status,
        invited_by, invited_at, is_default, is_active
    ) VALUES (
        p_partner_id, p_company_id, COALESCE(p_role, 'member'), 'pending',
        p_invited_by, now(), false, true
    )
    RETURNING id INTO v_new_rel_id;

    RETURN v_new_rel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_partner_to_company(UUID, UUID, partner_company_role, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_partner_to_company(UUID, UUID, partner_company_role, UUID)
    TO service_role;

-- Helper: ¿la persona con sesión es owner aceptado y activo de la empresa?
CREATE OR REPLACE FUNCTION public.is_company_owner_user(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.rel_partner_company rpc
        JOIN public.partner p ON p.id = rpc.partner_id
        WHERE rpc.company_id = p_company_id
          AND p.user_id = auth.uid()
          AND rpc.role = 'owner'
          AND rpc.invitation_status = 'accepted'
          AND rpc.is_active = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_company_owner_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_owner_user(UUID) TO authenticated, service_role;

-- 2) Sin UPDATE directo para usuarios: responder invitaciones va por
--    respond_to_invitation. Los admins conservan «Admins can manage relationships».
DROP POLICY IF EXISTS "Users can respond to invitations" ON public.rel_partner_company;

-- 3) Defensa en profundidad: aun dentro de funciones SECURITY DEFINER, una
--    petición con sesión no puede mover una membresía de empresa o de persona,
--    ni dar o quitar el rol owner sin ser owner. Las migraciones y service_role
--    (sin auth.uid()) no se ven afectados.
CREATE OR REPLACE FUNCTION public.guard_rel_partner_company_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
        RAISE EXCEPTION 'A membership cannot be moved to another company or person'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       AND (NEW.role = 'owner' OR OLD.role = 'owner')
       AND NOT public.is_company_owner_user(OLD.company_id) THEN
        RAISE EXCEPTION 'Only an owner can grant or change the owner role'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_rel_partner_company_update ON public.rel_partner_company;
CREATE TRIGGER trigger_guard_rel_partner_company_update
    BEFORE UPDATE ON public.rel_partner_company
    FOR EACH ROW EXECUTE FUNCTION public.guard_rel_partner_company_update();

COMMENT ON FUNCTION public.invite_partner_to_company IS 'Legado (TRY-64): solo service_role; el panel invita con invite_partner_by_email';
COMMENT ON FUNCTION public.is_company_owner_user IS 'TRUE si la persona con sesión es owner aceptado y activo de la empresa';
COMMENT ON FUNCTION public.guard_rel_partner_company_update IS 'Impide mover membresías y cambiar el rol owner sin ser owner (TRY-64)';
