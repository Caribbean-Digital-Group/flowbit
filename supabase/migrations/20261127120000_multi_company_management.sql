-- ============================================================================
-- Multiempresa (TRY-76): crear empresas adicionales y elegir la predeterminada
--
-- Hasta ahora una empresa solo nacía en el registro (handle_new_user). Esta
-- migración agrega dos RPC para que una persona con sesión:
--   * cree otra empresa y quede como owner (create_company), y
--   * elija cuál de sus empresas se abre por defecto (set_default_company).
--
-- No hay tablas nuevas. Crear una empresa son dos filas (company + membresía
-- owner) que deben quedar en la misma transacción, por eso va por RPC y no por
-- INSERT desde el navegador. El INSERT directo en `company` deja de estar
-- permitido: nadie lo usaba y permitía crear empresas huérfanas sin límite.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Límite de empresas propias por persona
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.max_owned_companies()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 10 $$;

REVOKE ALL ON FUNCTION public.max_owned_companies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.max_owned_companies() TO authenticated, service_role;

COMMENT ON FUNCTION public.max_owned_companies IS
    'Máximo de empresas que una persona puede tener como owner (TRY-76)';

-- ----------------------------------------------------------------------------
-- 2. create_company: empresa nueva + membresía owner en una transacción
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_company(
    p_name         TEXT,
    p_currency     TEXT DEFAULT 'MXN',
    p_country_code TEXT DEFAULT 'MX'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    UUID := auth.uid();
    v_partner    public.partner%ROWTYPE;
    v_name       TEXT := btrim(COALESCE(p_name, ''));
    v_currency   TEXT := upper(btrim(COALESCE(p_currency, 'MXN')));
    v_country    TEXT := upper(btrim(COALESCE(p_country_code, 'MX')));
    v_owned      INTEGER;
    v_company_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Inicia sesión para crear una empresa' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_partner
    FROM public.partner
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'Tu usuario no tiene un perfil de persona asociado' USING ERRCODE = '42501';
    END IF;

    IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
        RAISE EXCEPTION 'El nombre de la empresa debe tener entre 2 y 120 caracteres'
            USING ERRCODE = '22023';
    END IF;

    IF v_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'La moneda debe ser un código de 3 letras (por ejemplo, MXN)'
            USING ERRCODE = '22023';
    END IF;

    IF v_country !~ '^[A-Z]{2}$' THEN
        RAISE EXCEPTION 'El país debe ser un código de 2 letras (por ejemplo, MX)'
            USING ERRCODE = '22023';
    END IF;

    -- Serializa las altas de una misma persona: dos peticiones simultáneas no
    -- pueden pasar ambas la verificación del límite.
    PERFORM pg_advisory_xact_lock(hashtextextended('create_company:' || v_partner.id::text, 0));

    SELECT count(*) INTO v_owned
    FROM public.rel_partner_company rpc
    WHERE rpc.partner_id = v_partner.id
      AND rpc.relationship_type = 'team'
      AND rpc.role = 'owner'
      AND rpc.invitation_status = 'accepted'
      AND rpc.is_active = true;

    IF v_owned >= public.max_owned_companies() THEN
        RAISE EXCEPTION 'Llegaste al límite de % empresas propias', public.max_owned_companies()
            USING ERRCODE = 'P0001', HINT = 'company_limit_reached';
    END IF;

    INSERT INTO public.company (
        name, display_name, email, currency, country_code,
        is_personal, status, created_by, updated_by
    ) VALUES (
        v_name, v_name, v_partner.email, v_currency, v_country,
        false, 'active', v_user_id, v_user_id
    )
    RETURNING id INTO v_company_id;

    INSERT INTO public.rel_partner_company (
        partner_id, company_id, role, invitation_status,
        accepted_at, is_default, is_active, relationship_type
    ) VALUES (
        v_partner.id, v_company_id, 'owner', 'accepted',
        now(), false, true, 'team'
    );

    RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_company(TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_company IS
    'Crea una empresa y deja a la persona con sesión como owner (TRY-76). Límite: max_owned_companies()';

-- ----------------------------------------------------------------------------
-- 3. set_default_company: la empresa que se abre al iniciar sesión
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_default_company(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rel_id  UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Inicia sesión para cambiar tu empresa predeterminada' USING ERRCODE = '42501';
    END IF;

    SELECT rpc.id INTO v_rel_id
    FROM public.rel_partner_company rpc
    JOIN public.partner p ON p.id = rpc.partner_id
    WHERE p.user_id = v_user_id
      AND rpc.company_id = p_company_id
      AND rpc.relationship_type = 'team'
      AND rpc.invitation_status = 'accepted'
      AND rpc.is_active = true
    LIMIT 1;

    IF v_rel_id IS NULL THEN
        RAISE EXCEPTION 'No perteneces a esa empresa' USING ERRCODE = '42501';
    END IF;

    -- trigger_single_default_company quita la marca de las demás membresías.
    UPDATE public.rel_partner_company
    SET is_default = true
    WHERE id = v_rel_id
      AND is_default IS DISTINCT FROM true;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_company(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_company(UUID) TO authenticated;

COMMENT ON FUNCTION public.set_default_company IS
    'Marca como predeterminada una empresa del equipo de la persona con sesión (TRY-76)';

-- ----------------------------------------------------------------------------
-- 4. Las empresas solo se crean por create_company o en el registro
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.company;
