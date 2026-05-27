-- ============================================================================
-- Migration: Approvals module (categories, managers/approvers, requests)
-- Multi-tenant formal approval workflows with RBAC-aligned RLS + RPC transitions
-- ============================================================================

-- ============================================================================
-- ENUM
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_request_status') THEN
        CREATE TYPE public.approval_request_status AS ENUM (
            'draft',
            'published',
            'approved',
            'rejected',
            'cancelled'
        );
    END IF;
END $$;

-- ============================================================================
-- Categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name VARCHAR(160) NOT NULL,
    internal_code VARCHAR(64) NOT NULL,
    description TEXT,

    active BOOLEAN NOT NULL DEFAULT true,
    archived BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (company_id, internal_code),
    CONSTRAINT approval_category_archive_consistency_chk
      CHECK ((NOT archived) OR active = false)
);

-- ============================================================================
-- Approvers registry (Gerentes / aprobadores)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_manager (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.partner(id) ON DELETE CASCADE,

    active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (company_id, partner_id)
);

CREATE TABLE IF NOT EXISTS public.approval_manager_category (
    approval_manager_id UUID NOT NULL REFERENCES public.approval_manager(id) ON DELETE CASCADE,
    approval_category_id UUID NOT NULL REFERENCES public.approval_category(id) ON DELETE CASCADE,
    PRIMARY KEY (approval_manager_id, approval_category_id)
);

-- ============================================================================
-- Sequential number per company
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_request_serial (
    company_id UUID PRIMARY KEY REFERENCES public.company(id) ON DELETE CASCADE,
    last_value BIGINT NOT NULL DEFAULT 0
);

-- ============================================================================
-- Requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    request_number BIGINT NOT NULL,

    title VARCHAR(255) NOT NULL DEFAULT '',
    category_id UUID NOT NULL REFERENCES public.approval_category(id) ON DELETE RESTRICT,
    requesting_partner_id UUID NOT NULL REFERENCES public.partner(id) ON DELETE RESTRICT,

    request_date DATE NOT NULL DEFAULT (CURRENT_DATE),

    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,

    description TEXT,
    amount NUMERIC(15, 2),
    currency CHAR(3) NOT NULL DEFAULT 'MXN',

    reference VARCHAR(120),

    assigned_approval_manager_id UUID REFERENCES public.approval_manager(id) ON DELETE SET NULL,

    status public.approval_request_status NOT NULL DEFAULT 'draft',

    active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (company_id, request_number),

    CONSTRAINT approval_request_exclusive_resolution_dates_chk CHECK (
        NOT (approved_at IS NOT NULL AND rejected_at IS NOT NULL)
    ),
    CONSTRAINT approval_request_amount_chk CHECK (amount IS NULL OR amount >= 0)
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_approval_category_company ON public.approval_category(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_category_active ON public.approval_category(company_id, active) WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_approval_manager_company ON public.approval_manager(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_manager_partner ON public.approval_manager(partner_id);
CREATE INDEX IF NOT EXISTS idx_approval_manager_active ON public.approval_manager(company_id, active);

CREATE INDEX IF NOT EXISTS idx_approval_request_company ON public.approval_request(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_status ON public.approval_request(company_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_request_requesting ON public.approval_request(requesting_partner_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_category ON public.approval_request(category_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_manager ON public.approval_request(assigned_approval_manager_id);

-- ============================================================================
-- Triggers: updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_approval_category_updated_at ON public.approval_category;
CREATE TRIGGER trigger_approval_category_updated_at
    BEFORE UPDATE ON public.approval_category
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_approval_manager_updated_at ON public.approval_manager;
CREATE TRIGGER trigger_approval_manager_updated_at
    BEFORE UPDATE ON public.approval_manager
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_approval_request_updated_at ON public.approval_request;
CREATE TRIGGER trigger_approval_request_updated_at
    BEFORE UPDATE ON public.approval_request
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Assign sequential request_number (per company)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_approval_request_number()
RETURNS TRIGGER AS $$
DECLARE
    v_next BIGINT;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RETURN NEW;
    END IF;

    WITH upsert AS (
        INSERT INTO public.approval_request_serial (company_id, last_value)
        VALUES (NEW.company_id, 1)
        ON CONFLICT (company_id) DO UPDATE
        SET last_value = approval_request_serial.last_value + 1
        RETURNING last_value
    )
    SELECT upsert.last_value INTO v_next FROM upsert;

    NEW.request_number := v_next;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_assign_approval_request_number ON public.approval_request;
CREATE TRIGGER trigger_assign_approval_request_number
    BEFORE INSERT ON public.approval_request
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_approval_request_number();

-- ============================================================================
-- Helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_active_approver_for_company(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.approval_manager m
        JOIN public.partner p ON p.id = m.partner_id
        WHERE m.company_id = p_company_id
          AND m.active = true
          AND p.user_id IS NOT NULL
          AND p.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.is_active_approver_for_company IS
  'True when the current auth user is linked to an active approval_manager row in the company.';

CREATE OR REPLACE FUNCTION public.current_user_partner_row_id()
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT p.id INTO v_id
    FROM public.partner p
    WHERE p.user_id = auth.uid()
    LIMIT 1;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.approver_can_act_on_category(
    p_manager_id UUID,
    p_category_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_cnt INT := 0;
BEGIN
    SELECT COUNT(*) INTO v_cnt FROM public.approval_manager_category
    WHERE approval_manager_id = p_manager_id;

    IF v_cnt = 0 THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.approval_manager_category
        WHERE approval_manager_id = p_manager_id
          AND approval_category_id = p_category_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.assert_category_available_for_request(p_category_id UUID)
RETURNS VOID AS $$
DECLARE
    v_company UUID;
    v_active BOOLEAN;
    v_archived BOOLEAN;
BEGIN
    SELECT company_id, active, archived
    INTO v_company, v_active, v_archived
    FROM public.approval_category
    WHERE id = p_category_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Categoría inválida o inexistente';
    END IF;

    IF NOT public.user_belongs_to_company(v_company) THEN
        RAISE EXCEPTION 'Sin acceso a la categoría indicada';
    END IF;

    IF v_archived OR NOT v_active THEN
        RAISE EXCEPTION 'La categoría no está disponible para nuevas solicitudes';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.assert_manager_assignable_for_request(
    p_company_id UUID,
    p_manager_id UUID,
    p_category_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_active BOOLEAN;
    v_partner UUID;
    v_has_user BOOLEAN;
BEGIN
    IF p_manager_id IS NULL THEN
        RAISE EXCEPTION 'Debe indicarse un aprobador';
    END IF;

    SELECT am.active, am.partner_id, (p.user_id IS NOT NULL)
    INTO v_active, v_partner, v_has_user
    FROM public.approval_manager am
    JOIN public.partner p ON p.id = am.partner_id
    WHERE am.id = p_manager_id
      AND am.company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aprobador inválido para esta empresa';
    END IF;

    IF NOT v_active THEN
        RAISE EXCEPTION 'El aprobador indicado está inactivo';
    END IF;

    IF NOT v_has_user THEN
        RAISE EXCEPTION 'El aprobador debe tener un usuario vinculado';
    END IF;

    IF NOT public.approver_can_act_on_category(p_manager_id, p_category_id) THEN
        RAISE EXCEPTION 'Este aprobador no autoriza esta categoría';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.assert_user_is_assigned_approver(p_request RECORD)
RETURNS VOID AS $$
DECLARE
    v_ok BOOLEAN := FALSE;
BEGIN
    IF p_request.assigned_approval_manager_id IS NULL THEN
        RAISE EXCEPTION 'La solicitud no tiene aprobador asignado';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.approval_manager m
        JOIN public.partner p ON p.id = m.partner_id
        WHERE m.id = p_request.assigned_approval_manager_id
          AND m.company_id = p_request.company_id
          AND m.active = TRUE
          AND p.user_id = auth.uid()
    ) INTO v_ok;

    IF NOT v_ok THEN
        RAISE EXCEPTION 'Solo el aprobador asignado puede realizar esta acción';
    END IF;

    IF NOT public.approver_can_act_on_category(
        p_request.assigned_approval_manager_id,
        p_request.category_id
    ) THEN
        RAISE EXCEPTION 'Este aprobador no autoriza esta categoría';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- Transition RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approval_publish_request(p_request_id UUID)
RETURNS public.approval_request AS $$
DECLARE
    r RECORD;
BEGIN
    SELECT * INTO r FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(r.company_id) THEN
        RAISE EXCEPTION 'Sin acceso';
    END IF;

    IF NOT (
        public.is_company_admin(r.company_id)
        OR public.is_own_partner(r.requesting_partner_id)
    ) THEN
        RAISE EXCEPTION 'Sin permiso para publicar esta solicitud';
    END IF;

    IF r.status <> 'draft' THEN
        RAISE EXCEPTION 'Solo solicitudes en borrador pueden publicarse';
    END IF;

    IF r.title IS NULL OR length(trim(r.title)) = 0 THEN
        RAISE EXCEPTION 'El asunto es obligatorio';
    END IF;

    PERFORM public.assert_category_available_for_request(r.category_id);

    PERFORM public.assert_manager_assignable_for_request(
        r.company_id,
        r.assigned_approval_manager_id,
        r.category_id
    );

    UPDATE public.approval_request
    SET
        status = 'published',
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO r;

    RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.approval_approve_request(p_request_id UUID)
RETURNS public.approval_request AS $$
DECLARE
    r RECORD;
BEGIN
    SELECT * INTO r FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(r.company_id) THEN
        RAISE EXCEPTION 'Sin acceso';
    END IF;

    IF r.status <> 'published' THEN
        RAISE EXCEPTION 'Solo solicitudes publicadas pueden aprobarse';
    END IF;

    PERFORM public.assert_user_is_assigned_approver(r);

    UPDATE public.approval_request
    SET
        status = 'approved',
        approved_at = now(),
        rejected_at = NULL,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO r;

    RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.approval_reject_request(p_request_id UUID)
RETURNS public.approval_request AS $$
DECLARE
    r RECORD;
BEGIN
    SELECT * INTO r FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(r.company_id) THEN
        RAISE EXCEPTION 'Sin acceso';
    END IF;

    IF r.status <> 'published' THEN
        RAISE EXCEPTION 'Solo solicitudes publicadas pueden rechazarse';
    END IF;

    PERFORM public.assert_user_is_assigned_approver(r);

    UPDATE public.approval_request
    SET
        status = 'rejected',
        rejected_at = now(),
        approved_at = NULL,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO r;

    RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.approval_cancel_request(p_request_id UUID)
RETURNS public.approval_request AS $$
DECLARE
    r RECORD;
BEGIN
    SELECT * INTO r FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(r.company_id) THEN
        RAISE EXCEPTION 'Sin acceso';
    END IF;

    IF NOT (
        public.is_company_admin(r.company_id)
        OR public.is_own_partner(r.requesting_partner_id)
    ) THEN
        RAISE EXCEPTION 'Sin permiso para cancelar esta solicitud';
    END IF;

    IF r.status NOT IN ('draft', 'published') THEN
        RAISE EXCEPTION 'Solo puede cancelarse desde borrador o publicado';
    END IF;

    UPDATE public.approval_request
    SET
        status = 'cancelled',
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO r;

    RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.approval_reset_request_to_draft(p_request_id UUID)
RETURNS public.approval_request AS $$
DECLARE
    r RECORD;
BEGIN
    SELECT * INTO r FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(r.company_id) THEN
        RAISE EXCEPTION 'Sin acceso';
    END IF;

    IF NOT (
        public.is_company_admin(r.company_id)
        OR public.is_own_partner(r.requesting_partner_id)
    ) THEN
        RAISE EXCEPTION 'Sin permiso para restablecer esta solicitud';
    END IF;

    IF r.status NOT IN ('rejected', 'cancelled') THEN
        RAISE EXCEPTION 'Solo puede restablecerse desde rechazado o cancelado';
    END IF;

    UPDATE public.approval_request
    SET
        status = 'draft',
        approved_at = NULL,
        rejected_at = NULL,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO r;

    RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- View (listado enriquecido)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_approval_requests AS
SELECT
    ar.id,
    ar.company_id,
    ar.request_number,
    ar.title,
    ar.status,
    ar.request_date,
    ar.created_at,
    ar.approved_at,
    ar.rejected_at,
    ar.amount,
    ar.currency,
    ar.reference,
    ar.description,
    ar.category_id,
    ac.name AS category_name,
    ac.internal_code AS category_code,
    ar.requesting_partner_id,
    COALESCE(
        NULLIF(trim(rp.display_name), ''),
        NULLIF(trim(rp.name), ''),
        rp.email,
        rp.id::TEXT
    ) AS requesting_partner_display,
    ar.assigned_approval_manager_id,
    COALESCE(
        NULLIF(trim(ap.display_name), ''),
        NULLIF(trim(ap.name), ''),
        ap.email,
        ar.assigned_approval_manager_id::TEXT
    ) AS assigned_approver_display
FROM public.approval_request ar
JOIN public.approval_category ac ON ac.id = ar.category_id
JOIN public.partner rp ON rp.id = ar.requesting_partner_id
LEFT JOIN public.approval_manager am ON am.id = ar.assigned_approval_manager_id
LEFT JOIN public.partner ap ON ap.id = am.partner_id
WHERE ar.active = true;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.approval_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_manager ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_manager_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_serial ENABLE ROW LEVEL SECURITY;

-- Serial table: no direct access for clients
REVOKE ALL ON TABLE public.approval_request_serial FROM authenticated;

-- -------- approval_category
CREATE POLICY "approval_category_select_company"
    ON public.approval_category FOR SELECT
    USING (public.user_belongs_to_company(company_id));

CREATE POLICY "approval_category_admin_all"
    ON public.approval_category FOR ALL
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

-- -------- approval_manager
CREATE POLICY "approval_manager_select_company"
    ON public.approval_manager FOR SELECT
    USING (public.user_belongs_to_company(company_id));

CREATE POLICY "approval_manager_admin_all"
    ON public.approval_manager FOR ALL
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

-- -------- approval_manager_category
CREATE POLICY "approval_manager_category_select"
    ON public.approval_manager_category FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.approval_manager am
            WHERE am.id = approval_manager_id
              AND public.user_belongs_to_company(am.company_id)
        )
    );

CREATE POLICY "approval_manager_category_admin_all"
    ON public.approval_manager_category FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.approval_manager am
            WHERE am.id = approval_manager_id
              AND public.is_company_admin(am.company_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.approval_manager am
            WHERE am.id = approval_manager_id
              AND public.is_company_admin(am.company_id)
        )
    );

-- -------- approval_request
CREATE POLICY "approval_request_select_visible"
    ON public.approval_request FOR SELECT
    USING (
        public.user_belongs_to_company(company_id)
        AND (
            public.is_company_admin(company_id)
            OR public.is_active_approver_for_company(company_id)
            OR public.is_own_partner(requesting_partner_id)
        )
        AND active = true
    );

CREATE POLICY "approval_request_insert_own_draft"
    ON public.approval_request FOR INSERT
    WITH CHECK (
        public.user_belongs_to_company(company_id)
        AND public.is_own_partner(requesting_partner_id)
        AND status = 'draft'::public.approval_request_status
    );

CREATE POLICY "approval_request_update_admin"
    ON public.approval_request FOR UPDATE
    USING (public.user_belongs_to_company(company_id) AND public.is_company_admin(company_id))
    WITH CHECK (
        public.user_belongs_to_company(company_id)
        AND public.is_company_admin(company_id)
        AND active = true
    );

CREATE POLICY "approval_request_owner_draft_update"
    ON public.approval_request FOR UPDATE
    USING (
        public.user_belongs_to_company(company_id)
        AND public.is_own_partner(requesting_partner_id)
        AND status = 'draft'::public.approval_request_status
        AND active = true
    )
    WITH CHECK (
        public.user_belongs_to_company(company_id)
        AND public.is_own_partner(requesting_partner_id)
        AND status = 'draft'::public.approval_request_status
        AND active = true
    );

-- ============================================================================
-- RPC grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.approval_publish_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_approve_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_reject_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_cancel_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approval_reset_request_to_draft(UUID) TO authenticated;

-- ============================================================================
-- Seed default categories for all existing companies (idempotent)
-- ============================================================================
INSERT INTO public.approval_category (company_id, name, internal_code, description, active, archived)
SELECT c.id, v.name, v.code, v.description, TRUE, FALSE
FROM public.company c
CROSS JOIN (
    VALUES
        ('Viaje de negocios', 'viaje-negocios', 'Solicitudes relacionadas con viajes de negocios'),
        ('Préstamos', 'prestamos', 'Solicitudes de préstamos internos o créditos'),
        ('Contratos', 'contratos', 'Revisión y firma formal de contratos'),
        ('Solicitud de pagos', 'solicitud-pagos', 'Autorización de pagos programados'),
        ('Alquiler', 'alquiler', 'Aprobaciones vinculadas a arrendamientos'),
        ('Cotizaciones', 'cotizaciones', 'Validación formal de cotizaciones comerciales'),
        ('Vacaciones', 'vacaciones', 'Ausencias laborales autorizadas'),
        ('Aprobaciones generales', 'aprobaciones-generales', 'Trámites generales sin subtipo específico')
) AS v(name, code, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.approval_category ac
    WHERE ac.company_id = c.id AND ac.internal_code = v.code
);

-- ============================================================================
-- Seed categories for newly created companies
-- ============================================================================
CREATE OR REPLACE FUNCTION public.seed_company_default_approval_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.approval_category (
        company_id, name, internal_code, description, active, archived
    )
    SELECT NEW.id, v.name, v.code, v.description, TRUE, FALSE
    FROM (
        VALUES
            ('Viaje de negocios', 'viaje-negocios', 'Solicitudes relacionadas con viajes de negocios'),
            ('Préstamos', 'prestamos', 'Solicitudes de préstamos internos o créditos'),
            ('Contratos', 'contratos', 'Revisión y firma formal de contratos'),
            ('Solicitud de pagos', 'solicitud-pagos', 'Autorización de pagos programados'),
            ('Alquiler', 'alquiler', 'Aprobaciones vinculadas a arrendamientos'),
            ('Cotizaciones', 'cotizaciones', 'Validación formal de cotizaciones comerciales'),
            ('Vacaciones', 'vacaciones', 'Ausencias laborales autorizadas'),
            ('Aprobaciones generales', 'aprobaciones-generales', 'Trámites generales sin subtipo específico')
    ) AS v(name, code, description)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.approval_category ac
        WHERE ac.company_id = NEW.id AND ac.internal_code = v.code
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_seed_company_default_approval_categories ON public.company;
CREATE TRIGGER trigger_seed_company_default_approval_categories
    AFTER INSERT ON public.company
    FOR EACH ROW
    EXECUTE FUNCTION public.seed_company_default_approval_categories();

GRANT SELECT ON public.v_approval_requests TO authenticated;

COMMENT ON TABLE public.approval_category IS 'Tipos/catálogo de solicitudes formales por empresa.';
COMMENT ON TABLE public.approval_manager IS 'Partners autorizados a aprobar solicitudes dentro de una empresa.';
COMMENT ON TABLE public.approval_manager_category IS
  'Ámbitos de categoría por gerente/a; sin filas = puede aprobar todas las categorías activas.';
COMMENT ON TABLE public.approval_request IS
  'Solicitudes con flujo borrador→publicado→aprobado|rechazado o cancelaciones y restablecimiento.';
