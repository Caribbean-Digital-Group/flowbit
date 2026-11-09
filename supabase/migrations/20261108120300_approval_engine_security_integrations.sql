-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  Aprobaciones: seguridad, integraciones y migración de datos (TRY-18)    ║
-- ║                                                                          ║
-- ║  1. Guard de approval_request (estado solo por el motor) y partidas      ║
-- ║  2. RLS de todas las tablas del módulo y permisos de funciones           ║
-- ║  3. Vistas v_approval_requests y v_approval_my_pending                   ║
-- ║  4. Bucket privado approval-attachments                                  ║
-- ║  5. Plazos: recordatorios, escalamiento, expiración y recurrencia        ║
-- ║  6. Tablero, importar/exportar configuración y datos de ejemplo          ║
-- ║  7. Integración con permisos de RR. HH. (hr_leave_request)               ║
-- ║  8. Datos existentes: solicitudes en revisión y bitácora retroactiva     ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Guard: el estado de una solicitud solo cambia con las acciones del motor
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_request_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_engine BOOLEAN := COALESCE(current_setting('approval.engine', true), '') = 'on';
BEGIN
    IF v_engine THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'draft' THEN
            RAISE EXCEPTION 'Las solicitudes nuevas se crean como borrador' USING ERRCODE = '42501';
        END IF;
        IF NEW.source_type IS NOT NULL THEN
            RAISE EXCEPTION 'Solo el módulo de origen crea solicitudes vinculadas' USING ERRCODE = '42501';
        END IF;
        NEW.round := 0;
        NEW.forced := false;
        NEW.auto_approved := false;
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.returned_at IS DISTINCT FROM OLD.returned_at
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.expired_at IS DISTINCT FROM OLD.expired_at
       OR NEW.resolution_note IS DISTINCT FROM OLD.resolution_note
       OR NEW.rejection_reason_id IS DISTINCT FROM OLD.rejection_reason_id
       OR NEW.resolved_by_partner_id IS DISTINCT FROM OLD.resolved_by_partner_id
       OR NEW.forced IS DISTINCT FROM OLD.forced
       OR NEW.auto_approved IS DISTINCT FROM OLD.auto_approved
       OR NEW.round IS DISTINCT FROM OLD.round
       OR NEW.returned_from_sequence IS DISTINCT FROM OLD.returned_from_sequence
       OR NEW.flow_id IS DISTINCT FROM OLD.flow_id
       OR NEW.flow_version IS DISTINCT FROM OLD.flow_version
       OR NEW.request_number IS DISTINCT FROM OLD.request_number
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_id IS DISTINCT FROM OLD.source_id THEN
        RAISE EXCEPTION 'Usa las acciones de la solicitud para cambiar su estado' USING ERRCODE = '42501';
    END IF;

    IF OLD.status NOT IN ('draft', 'returned') AND (
        NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.amount IS DISTINCT FROM OLD.amount
        OR NEW.currency IS DISTINCT FROM OLD.currency
        OR NEW.category_id IS DISTINCT FROM OLD.category_id
        OR NEW.field_values IS DISTINCT FROM OLD.field_values
        OR NEW.requesting_partner_id IS DISTINCT FROM OLD.requesting_partner_id
        OR NEW.assigned_approval_manager_id IS DISTINCT FROM OLD.assigned_approval_manager_id
        OR NEW.due_date IS DISTINCT FROM OLD.due_date
        OR NEW.priority IS DISTINCT FROM OLD.priority
    ) THEN
        RAISE EXCEPTION 'Una solicitud enviada se modifica con la acción «Editar», que registra el cambio' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_request_guard ON public.approval_request;
CREATE TRIGGER trigger_approval_request_guard
    BEFORE INSERT OR UPDATE ON public.approval_request
    FOR EACH ROW EXECUTE FUNCTION public.approval_request_guard();

-- Con partidas, el monto de la solicitud es su suma.
CREATE OR REPLACE FUNCTION public.approval_sync_amount_from_lines()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id UUID := COALESCE(NEW.request_id, OLD.request_id);
    v_total      NUMERIC;
    v_count      INTEGER;
BEGIN
    SELECT COALESCE(sum(subtotal), 0), count(*) INTO v_total, v_count
    FROM public.approval_request_line
    WHERE request_id = v_request_id AND active = true;

    IF v_count > 0 THEN
        UPDATE public.approval_request
        SET amount = v_total
        WHERE id = v_request_id AND status IN ('draft', 'returned') AND amount IS DISTINCT FROM v_total;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_sync_amount_from_lines ON public.approval_request_line;
CREATE TRIGGER trigger_approval_sync_amount_from_lines
    AFTER INSERT OR UPDATE OR DELETE ON public.approval_request_line
    FOR EACH ROW EXECUTE FUNCTION public.approval_sync_amount_from_lines();

-- La versión del flujo sube con cada cambio de niveles o aprobadores.
CREATE OR REPLACE FUNCTION public.approval_bump_flow_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_flow_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'approval_flow_step' THEN
        v_flow_id := COALESCE(NEW.flow_id, OLD.flow_id);
    ELSE
        SELECT flow_id INTO v_flow_id FROM public.approval_flow_step WHERE id = COALESCE(NEW.step_id, OLD.step_id);
    END IF;
    UPDATE public.approval_flow SET version = version + 1 WHERE id = v_flow_id;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_flow_step_version ON public.approval_flow_step;
CREATE TRIGGER trigger_approval_flow_step_version
    AFTER INSERT OR UPDATE OR DELETE ON public.approval_flow_step
    FOR EACH ROW EXECUTE FUNCTION public.approval_bump_flow_version();

DROP TRIGGER IF EXISTS trigger_approval_flow_step_approver_version ON public.approval_flow_step_approver;
CREATE TRIGGER trigger_approval_flow_step_approver_version
    AFTER INSERT OR UPDATE OR DELETE ON public.approval_flow_step_approver
    FOR EACH ROW EXECUTE FUNCTION public.approval_bump_flow_version();

-- Un aprobador sin categorías ya no autoriza ninguna (decisión del dueño).
CREATE OR REPLACE FUNCTION public.approver_can_act_on_category(
    p_manager_id UUID,
    p_category_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.approval_manager_category
        WHERE approval_manager_id = p_manager_id
          AND approval_category_id = p_category_id
    );
$$;

-- Delegación: solo hacia personas que pueden aprobar.
CREATE OR REPLACE FUNCTION public.approval_delegation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.approval_is_eligible(NEW.company_id, NEW.to_partner_id, NULL) THEN
        RAISE EXCEPTION 'El suplente debe ser un aprobador registrado o un owner' USING ERRCODE = '22023';
    END IF;
    IF NOT public.approval_is_eligible(NEW.company_id, NEW.from_partner_id, NULL) THEN
        RAISE EXCEPTION 'Solo un aprobador o un owner puede delegar' USING ERRCODE = '22023';
    END IF;
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.approval_category WHERE id = NEW.category_id AND company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'Categoría inválida' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_delegation_guard ON public.approval_delegation;
CREATE TRIGGER trigger_approval_delegation_guard
    BEFORE INSERT OR UPDATE ON public.approval_delegation
    FOR EACH ROW EXECUTE FUNCTION public.approval_delegation_guard();

-- Una categoría solo puede usar flujos de su empresa.
CREATE OR REPLACE FUNCTION public.approval_category_flow_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.flow_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.approval_flow WHERE id = NEW.flow_id AND company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'El flujo no pertenece a esta empresa' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_category_flow_guard ON public.approval_category;
CREATE TRIGGER trigger_approval_category_flow_guard
    BEFORE INSERT OR UPDATE OF flow_id ON public.approval_category
    FOR EACH ROW EXECUTE FUNCTION public.approval_category_flow_guard();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. RLS
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.approval_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_flow_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_flow_step_approver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rejection_reason ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_approver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_delegation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_template ENABLE ROW LEVEL SECURITY;

-- Configuración: la lee el equipo, la administran owner/admin
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['approval_settings', 'approval_flow', 'approval_flow_step',
                             'approval_flow_step_approver', 'approval_rejection_reason'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_company', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_belongs_to_company(company_id))',
            t || '_select_company', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id))',
            t || '_admin_all', t);
    END LOOP;
END $$;

-- Solicitudes: solicitante, quien capturó, aprobadores involucrados, responsable
-- del departamento (si no es confidencial) y owner/admin.
DROP POLICY IF EXISTS "approval_request_select_visible" ON public.approval_request;
CREATE POLICY "approval_request_select_visible"
    ON public.approval_request FOR SELECT
    TO authenticated
    USING (active = true AND public.approval_row_visible(id, company_id, requesting_partner_id, captured_by_partner_id, category_id));

DROP POLICY IF EXISTS "approval_request_insert_own_draft" ON public.approval_request;
CREATE POLICY "approval_request_insert_own_draft"
    ON public.approval_request FOR INSERT
    TO authenticated
    WITH CHECK (
        public.user_belongs_to_company(company_id)
        AND status = 'draft'::public.approval_request_status
        AND (
            public.is_own_partner(requesting_partner_id)
            -- En nombre de otra persona: quien captura queda registrado
            OR (captured_by_partner_id IS NOT NULL AND public.is_own_partner(captured_by_partner_id)
                AND public.partner_shares_company_with_user(requesting_partner_id))
        )
    );

-- Contenido editable solo en borrador o devuelta; el estado lo protege el guard.
DROP POLICY IF EXISTS "approval_request_update_admin" ON public.approval_request;
DROP POLICY IF EXISTS "approval_request_owner_draft_update" ON public.approval_request;
CREATE POLICY "approval_request_update_editable"
    ON public.approval_request FOR UPDATE
    TO authenticated
    USING (public.approval_can_edit(id))
    WITH CHECK (public.user_belongs_to_company(company_id) AND active = true);

-- Partidas
CREATE POLICY "approval_request_line_select"
    ON public.approval_request_line FOR SELECT TO authenticated
    USING (public.approval_can_view(request_id));
CREATE POLICY "approval_request_line_write"
    ON public.approval_request_line FOR ALL TO authenticated
    USING (public.approval_can_edit(request_id))
    WITH CHECK (public.approval_can_edit(request_id));

-- Ejecución y bitácora: lectura según la solicitud; escritura solo del motor
CREATE POLICY "approval_request_step_select"
    ON public.approval_request_step FOR SELECT TO authenticated
    USING (public.approval_can_view(request_id));
CREATE POLICY "approval_request_approver_select"
    ON public.approval_request_approver FOR SELECT TO authenticated
    USING (public.approval_can_view(request_id));
CREATE POLICY "approval_request_event_select"
    ON public.approval_request_event FOR SELECT TO authenticated
    USING (public.approval_can_view(request_id));
CREATE POLICY "approval_request_comment_select"
    ON public.approval_request_comment FOR SELECT TO authenticated
    USING (public.approval_can_view(request_id));

REVOKE INSERT, UPDATE, DELETE ON public.approval_request_step FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.approval_request_approver FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.approval_request_event FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.approval_request_comment FROM authenticated, anon;
REVOKE INSERT, DELETE ON public.approval_activity FROM authenticated, anon;

-- Adjuntos: los ve quien ve la solicitud; los sube quien participa mientras no esté resuelta
CREATE POLICY "approval_request_attachment_select"
    ON public.approval_request_attachment FOR SELECT TO authenticated
    USING (public.approval_can_view(request_id));
CREATE POLICY "approval_request_attachment_insert"
    ON public.approval_request_attachment FOR INSERT TO authenticated
    WITH CHECK (
        public.approval_can_view(request_id)
        AND public.is_own_partner(uploaded_by_partner_id)
        AND EXISTS (SELECT 1 FROM public.approval_request r
                    WHERE r.id = request_id AND r.status IN ('draft', 'returned', 'published'))
    );
CREATE POLICY "approval_request_attachment_update"
    ON public.approval_request_attachment FOR UPDATE TO authenticated
    USING (
        public.approval_can_view(request_id)
        AND (public.is_own_partner(uploaded_by_partner_id) OR public.is_company_admin(company_id))
    )
    WITH CHECK (public.approval_can_view(request_id));

-- Registrar alta y baja de adjuntos en la bitácora
CREATE OR REPLACE FUNCTION public.approval_attachment_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.approval_log(NEW.request_id, 'attachment_added',
            jsonb_build_object('attachment_id', NEW.id, 'file_name', NEW.file_name));
    ELSIF OLD.active AND NOT NEW.active THEN
        PERFORM public.approval_log(NEW.request_id, 'attachment_removed',
            jsonb_build_object('attachment_id', NEW.id, 'file_name', NEW.file_name));
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_attachment_log ON public.approval_request_attachment;
CREATE TRIGGER trigger_approval_attachment_log
    AFTER INSERT OR UPDATE ON public.approval_request_attachment
    FOR EACH ROW EXECUTE FUNCTION public.approval_attachment_log();

-- Delegaciones: el equipo las ve; cada quien crea las suyas, owner/admin las de todos
CREATE POLICY "approval_delegation_select"
    ON public.approval_delegation FOR SELECT TO authenticated
    USING (public.user_belongs_to_company(company_id));
CREATE POLICY "approval_delegation_write"
    ON public.approval_delegation FOR ALL TO authenticated
    USING (public.is_company_admin(company_id) OR public.is_own_partner(from_partner_id))
    WITH CHECK (
        public.user_belongs_to_company(company_id)
        AND (public.is_company_admin(company_id) OR public.is_own_partner(from_partner_id))
    );

-- Actividades: cada persona las suyas (solo marca leída/hecha)
CREATE POLICY "approval_activity_select_own"
    ON public.approval_activity FOR SELECT TO authenticated
    USING (public.is_own_partner(partner_id) AND public.user_belongs_to_company(company_id));
CREATE POLICY "approval_activity_update_own"
    ON public.approval_activity FOR UPDATE TO authenticated
    USING (public.is_own_partner(partner_id))
    WITH CHECK (public.is_own_partner(partner_id));

-- Plantillas: las de la empresa las ve todo el equipo; las personales, su dueño
CREATE POLICY "approval_request_template_select"
    ON public.approval_request_template FOR SELECT TO authenticated
    USING (
        public.user_belongs_to_company(company_id)
        AND (owner_partner_id IS NULL OR public.is_own_partner(owner_partner_id))
    );
CREATE POLICY "approval_request_template_write"
    ON public.approval_request_template FOR ALL TO authenticated
    USING (
        public.user_belongs_to_company(company_id)
        AND ((owner_partner_id IS NULL AND public.is_company_admin(company_id))
             OR (owner_partner_id IS NOT NULL AND public.is_own_partner(owner_partner_id)))
    )
    WITH CHECK (
        public.user_belongs_to_company(company_id)
        AND ((owner_partner_id IS NULL AND public.is_company_admin(company_id))
             OR (owner_partner_id IS NOT NULL AND public.is_own_partner(owner_partner_id)))
    );

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Vistas (security_invoker: aplican el RLS de cada tabla)
-- ════════════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.v_approval_requests;
CREATE VIEW public.v_approval_requests
WITH (security_invoker = true)
AS
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
    ac.color AS category_color,
    ac.confidential AS category_confidential,
    ar.requesting_partner_id,
    public.approval_partner_name(ar.requesting_partner_id) AS requesting_partner_display,
    ar.assigned_approval_manager_id,
    public.approval_partner_name(am.partner_id) AS assigned_approver_display,
    ar.priority,
    ar.due_date,
    ar.submitted_at,
    ar.returned_at,
    ar.cancelled_at,
    ar.expired_at,
    ar.resolution_note,
    ar.forced,
    ar.auto_approved,
    ar.source_type,
    ar.source_id,
    ar.round,
    ar.captured_by_partner_id,
    public.approval_partner_name(ar.captured_by_partner_id) AS captured_by_display,
    ar.resolved_by_partner_id,
    public.approval_partner_name(ar.resolved_by_partner_id) AS resolved_by_display,
    cur.current_sequence,
    cur.current_step_name,
    cur.current_due_at,
    (cur.current_due_at IS NOT NULL AND cur.current_due_at < now()) AS is_overdue,
    cur.pending_approvers_display,
    totals.total_levels
FROM public.approval_request ar
JOIN public.approval_category ac ON ac.id = ar.category_id
LEFT JOIN public.approval_manager am ON am.id = ar.assigned_approval_manager_id
LEFT JOIN LATERAL (
    SELECT
        min(s.sequence) AS current_sequence,
        string_agg(DISTINCT s.name, ' · ') AS current_step_name,
        min(s.due_at) AS current_due_at,
        (
            SELECT string_agg(DISTINCT public.approval_partner_name(a.partner_id), ', ')
            FROM public.approval_request_approver a
            JOIN public.approval_request_step s2 ON s2.id = a.step_id
            WHERE s2.request_id = ar.id AND s2.round = ar.round AND s2.status = 'active' AND a.status = 'pending'
        ) AS pending_approvers_display
    FROM public.approval_request_step s
    WHERE s.request_id = ar.id AND s.round = ar.round AND s.status = 'active'
) cur ON true
LEFT JOIN LATERAL (
    SELECT count(DISTINCT s.sequence) AS total_levels
    FROM public.approval_request_step s
    WHERE s.request_id = ar.id AND s.round = ar.round AND s.status <> 'skipped'
) totals ON true
WHERE ar.active = true;

GRANT SELECT ON public.v_approval_requests TO authenticated;

-- Pendientes del usuario actual (bandeja «Pendientes de mi aprobación»)
DROP VIEW IF EXISTS public.v_approval_my_pending;
CREATE VIEW public.v_approval_my_pending
WITH (security_invoker = true)
AS
SELECT
    a.id AS approver_id,
    a.request_id,
    a.company_id,
    a.step_id,
    s.name AS step_name,
    s.sequence,
    s.due_at,
    (s.due_at IS NOT NULL AND s.due_at < now()) AS is_overdue,
    a.delegated_from_partner_id,
    public.approval_partner_name(a.delegated_from_partner_id) AS delegated_from_display,
    a.resolved_via,
    s.activated_at
FROM public.approval_request_approver a
JOIN public.approval_request_step s ON s.id = a.step_id
JOIN public.approval_request r ON r.id = a.request_id
WHERE a.status = 'pending'
  AND s.status = 'active'
  AND s.round = r.round
  AND r.status = 'published'
  AND r.active = true
  AND a.partner_id = public.current_user_partner_row_id();

GRANT SELECT ON public.v_approval_my_pending TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Bucket privado de adjuntos: {company_id}/{request_id}/{archivo}
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'approval-attachments', 'approval-attachments', false, 15728640,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'text/plain', 'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/msword', 'application/xml', 'text/xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.approval_storage_can_access(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_parts   TEXT[] := storage.foldername(p_name);
    v_request UUID;
BEGIN
    IF array_length(v_parts, 1) < 2 THEN
        RETURN false;
    END IF;
    BEGIN
        v_request := v_parts[2]::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN false;
    END;
    RETURN EXISTS (
        SELECT 1 FROM public.approval_request r
        WHERE r.id = v_request AND r.company_id::TEXT = v_parts[1]
    ) AND public.approval_can_view(v_request);
END;
$$;

DROP POLICY IF EXISTS "approval_attachments_select" ON storage.objects;
CREATE POLICY "approval_attachments_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'approval-attachments' AND public.approval_storage_can_access(name));

DROP POLICY IF EXISTS "approval_attachments_insert" ON storage.objects;
CREATE POLICY "approval_attachments_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'approval-attachments' AND public.approval_storage_can_access(name));

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Plazos: recordatorios, escalamiento, expiración y recurrencia
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_process_sla(p_company_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_step      RECORD;
    v_approver  RECORD;
    v_request   RECORD;
    v_template  RECORD;
    v_settings  public.approval_settings;
    v_target    UUID;
    v_owner     UUID;
    v_new_id    UUID;
    v_reminders INTEGER := 0;
    v_escalated INTEGER := 0;
    v_auto      INTEGER := 0;
    v_expired   INTEGER := 0;
    v_recurring INTEGER := 0;
BEGIN
    -- Niveles vencidos
    FOR v_step IN
        SELECT s.*, r.company_id AS r_company
        FROM public.approval_request_step s
        JOIN public.approval_request r ON r.id = s.request_id
        WHERE s.status = 'active' AND s.due_at IS NOT NULL AND s.due_at < now()
          AND r.status = 'published' AND r.active = true AND s.round = r.round
          AND (p_company_id IS NULL OR r.company_id = p_company_id)
    LOOP
        v_settings := public.approval_get_settings(v_step.r_company);

        -- Recordatorio periódico a quienes siguen pendientes
        FOR v_approver IN
            SELECT * FROM public.approval_request_approver
            WHERE step_id = v_step.id AND status = 'pending'
              AND (last_reminder_at IS NULL OR last_reminder_at < now() - make_interval(hours => v_settings.reminder_every_hours))
        LOOP
            PERFORM public.approval_notify(v_step.request_id, v_approver.partner_id, 'reminder',
                'Plazo vencido: ' || public.approval_request_label(v_step.request_id), true);
            UPDATE public.approval_request_approver SET last_reminder_at = now() WHERE id = v_approver.id;
            v_reminders := v_reminders + 1;
        END LOOP;

        -- Escalamiento: una sola vez por nivel
        CONTINUE WHEN v_step.escalated_at IS NOT NULL OR v_settings.escalation_action = 'remind';

        IF v_settings.escalation_action IN ('auto_approve', 'auto_reject') THEN
            UPDATE public.approval_request_step SET escalated_at = now() WHERE id = v_step.id;
            PERFORM public.approval_log(v_step.request_id, 'sla_' || v_settings.escalation_action,
                jsonb_build_object('step', v_step.name), true);
            IF v_settings.escalation_action = 'auto_reject' THEN
                PERFORM public.approval_finalize(v_step.request_id, 'rejected',
                    'Rechazada automáticamente: venció el plazo del nivel «' || v_step.name || '»', NULL, false, false, true);
            ELSE
                UPDATE public.approval_request_approver
                SET status = 'skipped', comment = 'Plazo vencido'
                WHERE step_id = v_step.id AND status = 'pending';
                UPDATE public.approval_request_step
                SET status = 'approved', completed_at = now(), note = 'Aprobado automáticamente por plazo vencido'
                WHERE id = v_step.id;
                PERFORM public.approval_close_actions(v_step.request_id, NULL);
                PERFORM public.approval_activate_next(v_step.request_id);
            END IF;
            v_auto := v_auto + 1;
            CONTINUE;
        END IF;

        -- escalate_manager / escalate_owners: se suman aprobadores al nivel
        FOR v_approver IN
            SELECT * FROM public.approval_request_approver WHERE step_id = v_step.id AND status = 'pending'
        LOOP
            v_target := NULL;
            IF v_settings.escalation_action = 'escalate_manager' THEN
                v_target := public.approval_manager_of(v_step.r_company, v_approver.partner_id);
                IF NOT public.approval_is_eligible(v_step.r_company, v_target, NULL) THEN
                    v_target := NULL;
                END IF;
            END IF;

            IF v_target IS NOT NULL THEN
                IF NOT EXISTS (SELECT 1 FROM public.approval_request_approver
                               WHERE step_id = v_step.id AND partner_id = v_target AND status = 'pending') THEN
                    INSERT INTO public.approval_request_approver (company_id, request_id, step_id, partner_id, delegated_from_partner_id, resolved_via)
                    VALUES (v_step.r_company, v_step.request_id, v_step.id, v_target, v_approver.partner_id, 'escalation');
                    PERFORM public.approval_notify(v_step.request_id, v_target, 'escalated',
                        'Escalada a ti por plazo vencido: ' || public.approval_request_label(v_step.request_id), true);
                END IF;
            ELSE
                -- Sin jefe elegible (o escalamiento a owners): los owners
                FOR v_owner IN SELECT * FROM public.approval_owner_partners(v_step.r_company) LOOP
                    IF NOT EXISTS (SELECT 1 FROM public.approval_request_approver
                                   WHERE step_id = v_step.id AND partner_id = v_owner AND status = 'pending') THEN
                        INSERT INTO public.approval_request_approver (company_id, request_id, step_id, partner_id, delegated_from_partner_id, resolved_via)
                        VALUES (v_step.r_company, v_step.request_id, v_step.id, v_owner, v_approver.partner_id, 'escalation');
                        PERFORM public.approval_notify(v_step.request_id, v_owner, 'escalated',
                            'Escalada a ti por plazo vencido: ' || public.approval_request_label(v_step.request_id), true);
                    END IF;
                END LOOP;
            END IF;
        END LOOP;

        UPDATE public.approval_request_step SET escalated_at = now() WHERE id = v_step.id;
        PERFORM public.approval_log(v_step.request_id, 'escalated',
            jsonb_build_object('step', v_step.name, 'action', v_settings.escalation_action), true);
        v_escalated := v_escalated + 1;
    END LOOP;

    -- Expiración de solicitudes en revisión demasiado tiempo
    FOR v_request IN
        SELECT r.id
        FROM public.approval_request r
        JOIN public.approval_settings st ON st.company_id = r.company_id
        WHERE r.status = 'published' AND r.active = true
          AND st.expire_after_days IS NOT NULL
          AND r.submitted_at < now() - make_interval(days => st.expire_after_days)
          AND (p_company_id IS NULL OR r.company_id = p_company_id)
    LOOP
        PERFORM public.approval_finalize(v_request.id, 'expired', 'Venció sin resolverse', NULL, false, false, true);
        v_expired := v_expired + 1;
    END LOOP;

    -- Plantillas recurrentes: crean un borrador para su dueño
    FOR v_template IN
        SELECT * FROM public.approval_request_template
        WHERE active = true AND recurrence IS NOT NULL AND next_run_on IS NOT NULL AND next_run_on <= CURRENT_DATE
          AND (p_company_id IS NULL OR company_id = p_company_id)
    LOOP
        INSERT INTO public.approval_request (
            company_id, title, category_id, requesting_partner_id, description, amount, currency,
            priority, field_values, assigned_approval_manager_id, status
        ) VALUES (
            v_template.company_id,
            COALESCE(v_template.payload ->> 'title', v_template.name),
            v_template.category_id, v_template.owner_partner_id,
            v_template.payload ->> 'description',
            public.approval_try_numeric(v_template.payload ->> 'amount'),
            COALESCE(v_template.payload ->> 'currency', 'MXN'),
            COALESCE(v_template.payload ->> 'priority', 'normal'),
            COALESCE(v_template.payload -> 'field_values', '{}'::jsonb),
            NULLIF(v_template.payload ->> 'assigned_approval_manager_id', '')::UUID,
            'draft'
        )
        RETURNING id INTO v_new_id;

        INSERT INTO public.approval_request_line (company_id, request_id, sequence, concept, quantity, unit_price)
        SELECT v_template.company_id, v_new_id, row_number() OVER (), l ->> 'concept',
               COALESCE(public.approval_try_numeric(l ->> 'quantity'), 1),
               COALESCE(public.approval_try_numeric(l ->> 'unit_price'), 0)
        FROM jsonb_array_elements(COALESCE(v_template.payload -> 'lines', '[]'::jsonb)) l
        WHERE NULLIF(trim(COALESCE(l ->> 'concept', '')), '') IS NOT NULL;

        PERFORM public.approval_log(v_new_id, 'created_from_recurring',
            jsonb_build_object('template_id', v_template.id, 'template', v_template.name), true);
        PERFORM public.approval_notify(v_new_id, v_template.owner_partner_id, 'recurring',
            'Borrador recurrente listo para enviar: ' || public.approval_request_label(v_new_id), true);

        UPDATE public.approval_request_template
        SET next_run_on = CASE recurrence
            WHEN 'weekly' THEN next_run_on + 7
            ELSE (next_run_on + INTERVAL '1 month')::DATE END
        WHERE id = v_template.id;
        v_recurring := v_recurring + 1;
    END LOOP;

    RETURN jsonb_build_object('reminders', v_reminders, 'escalated', v_escalated, 'auto_resolved', v_auto,
                              'expired', v_expired, 'recurring_created', v_recurring);
END;
$$;

-- Un owner/admin puede correr el proceso de su empresa a mano (además del cron).
CREATE OR REPLACE FUNCTION public.approval_run_sla_now(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Solo un owner o administrador puede hacerlo' USING ERRCODE = '42501';
    END IF;
    RETURN public.approval_process_sla(p_company_id);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6a. Tablero y cumplimiento
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_dashboard(p_company_id UUID, p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from TIMESTAMPTZ := p_from::TIMESTAMP AT TIME ZONE 'America/Mexico_City';
    v_to   TIMESTAMPTZ := (p_to + 1)::TIMESTAMP AT TIME ZONE 'America/Mexico_City';
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Solo un owner o administrador ve el tablero de aprobaciones' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'summary', (
            SELECT jsonb_build_object(
                'created', count(*) FILTER (WHERE created_at >= v_from AND created_at < v_to),
                'approved', count(*) FILTER (WHERE approved_at >= v_from AND approved_at < v_to),
                'rejected', count(*) FILTER (WHERE rejected_at >= v_from AND rejected_at < v_to),
                'pending', count(*) FILTER (WHERE status = 'published'),
                'returned', count(*) FILTER (WHERE status = 'returned'),
                'overdue', (SELECT count(DISTINCT s.request_id) FROM public.approval_request_step s
                            JOIN public.approval_request r2 ON r2.id = s.request_id
                            WHERE r2.company_id = p_company_id AND r2.status = 'published' AND r2.active
                              AND s.round = r2.round AND s.status = 'active' AND s.due_at < now()),
                'amount_approved', COALESCE(sum(amount) FILTER (WHERE approved_at >= v_from AND approved_at < v_to), 0),
                'avg_resolution_hours', round(avg(EXTRACT(EPOCH FROM (COALESCE(approved_at, rejected_at) - submitted_at)) / 3600)
                    FILTER (WHERE COALESCE(approved_at, rejected_at) >= v_from AND COALESCE(approved_at, rejected_at) < v_to
                            AND submitted_at IS NOT NULL)::NUMERIC, 1)
            )
            FROM public.approval_request
            WHERE company_id = p_company_id AND active = true
        ),
        'by_category', (
            SELECT COALESCE(jsonb_agg(x ORDER BY (x ->> 'total')::INTEGER DESC), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'category', c.name,
                    'total', count(r.id),
                    'approved', count(r.id) FILTER (WHERE r.status = 'approved'),
                    'rejected', count(r.id) FILTER (WHERE r.status = 'rejected'),
                    'pending', count(r.id) FILTER (WHERE r.status = 'published'),
                    'amount_approved', COALESCE(sum(r.amount) FILTER (WHERE r.status = 'approved'), 0),
                    'avg_hours', round(avg(EXTRACT(EPOCH FROM (COALESCE(r.approved_at, r.rejected_at) - r.submitted_at)) / 3600)::NUMERIC, 1)
                ) AS x
                FROM public.approval_category c
                JOIN public.approval_request r ON r.category_id = c.id AND r.active
                WHERE c.company_id = p_company_id AND r.created_at >= v_from AND r.created_at < v_to
                GROUP BY c.id, c.name
            ) t
        ),
        'approvers', (
            SELECT COALESCE(jsonb_agg(x ORDER BY (x ->> 'pending')::INTEGER DESC, (x ->> 'avg_response_hours')::NUMERIC DESC NULLS LAST), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'partner_id', a.partner_id,
                    'name', public.approval_partner_name(a.partner_id),
                    'pending', count(*) FILTER (WHERE a.status = 'pending' AND s.status = 'active'),
                    'decided', count(*) FILTER (WHERE a.status IN ('approved', 'rejected') AND a.decided_at >= v_from AND a.decided_at < v_to),
                    'avg_response_hours', round(avg(EXTRACT(EPOCH FROM (a.decided_at - s.activated_at)) / 3600)
                        FILTER (WHERE a.status IN ('approved', 'rejected') AND a.decided_at >= v_from AND a.decided_at < v_to)::NUMERIC, 1)
                ) AS x
                FROM public.approval_request_approver a
                JOIN public.approval_request_step s ON s.id = a.step_id
                WHERE a.company_id = p_company_id
                GROUP BY a.partner_id
            ) t
        ),
        'by_level', (
            SELECT COALESCE(jsonb_agg(x ORDER BY (x ->> 'avg_hours')::NUMERIC DESC NULLS LAST), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'step', s.name,
                    'completed', count(*),
                    'avg_hours', round(avg(EXTRACT(EPOCH FROM (s.completed_at - s.activated_at)) / 3600)::NUMERIC, 1)
                ) AS x
                FROM public.approval_request_step s
                WHERE s.company_id = p_company_id AND s.status IN ('approved', 'rejected')
                  AND s.activated_at IS NOT NULL AND s.completed_at >= v_from AND s.completed_at < v_to
                  AND NOT s.informative
                GROUP BY s.name
            ) t
        ),
        'monthly', (
            SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'month'), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'month', to_char(date_trunc('month', r.created_at AT TIME ZONE 'America/Mexico_City'), 'YYYY-MM'),
                    'created', count(*),
                    'approved', count(*) FILTER (WHERE r.status = 'approved'),
                    'rejected', count(*) FILTER (WHERE r.status = 'rejected'),
                    'avg_hours', round(avg(EXTRACT(EPOCH FROM (COALESCE(r.approved_at, r.rejected_at) - r.submitted_at)) / 3600)::NUMERIC, 1)
                ) AS x
                FROM public.approval_request r
                WHERE r.company_id = p_company_id AND r.active AND r.created_at >= v_from AND r.created_at < v_to
                GROUP BY date_trunc('month', r.created_at AT TIME ZONE 'America/Mexico_City')
            ) t
        ),
        'by_requester', (
            SELECT COALESCE(jsonb_agg(x ORDER BY (x ->> 'amount')::NUMERIC DESC), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'name', public.approval_partner_name(r.requesting_partner_id),
                    'count', count(*),
                    'amount', COALESCE(sum(r.amount), 0)
                ) AS x
                FROM public.approval_request r
                WHERE r.company_id = p_company_id AND r.active AND r.status = 'approved'
                  AND r.approved_at >= v_from AND r.approved_at < v_to
                GROUP BY r.requesting_partner_id
                ORDER BY COALESCE(sum(r.amount), 0) DESC
                LIMIT 10
            ) t
        ),
        'by_department', (
            SELECT COALESCE(jsonb_agg(x ORDER BY (x ->> 'amount')::NUMERIC DESC), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'department', COALESCE(d.name, 'Sin departamento'),
                    'count', count(*),
                    'amount', COALESCE(sum(r.amount), 0)
                ) AS x
                FROM public.approval_request r
                LEFT JOIN public.employee e ON e.company_id = r.company_id AND e.partner_id = r.requesting_partner_id
                LEFT JOIN public.employee_department d ON d.id = e.department_id
                WHERE r.company_id = p_company_id AND r.active AND r.status = 'approved'
                  AND r.approved_at >= v_from AND r.approved_at < v_to
                GROUP BY d.name
            ) t
        ),
        'compliance', jsonb_build_object(
            'forced', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', r.id, 'request_number', r.request_number, 'title', r.title, 'status', r.status,
                    'by', public.approval_partner_name(r.resolved_by_partner_id), 'note', r.resolution_note,
                    'at', COALESCE(r.approved_at, r.rejected_at)) ORDER BY COALESCE(r.approved_at, r.rejected_at) DESC), '[]'::jsonb)
                FROM public.approval_request r
                WHERE r.company_id = p_company_id AND r.active AND r.forced
                  AND COALESCE(r.approved_at, r.rejected_at) >= v_from AND COALESCE(r.approved_at, r.rejected_at) < v_to
            ),
            'auto_approved', (
                SELECT count(*) FROM public.approval_request r
                WHERE r.company_id = p_company_id AND r.active AND r.auto_approved
                  AND r.approved_at >= v_from AND r.approved_at < v_to
            ),
            'ad_hoc_steps', (
                SELECT count(*) FROM public.approval_request_step s
                WHERE s.company_id = p_company_id AND s.ad_hoc AND s.created_at >= v_from AND s.created_at < v_to
            ),
            'reassignments', (
                SELECT count(*) FROM public.approval_request_event e
                WHERE e.company_id = p_company_id AND e.event_type = 'reassigned'
                  AND e.created_at >= v_from AND e.created_at < v_to
            ),
            'escalations', (
                SELECT count(*) FROM public.approval_request_event e
                WHERE e.company_id = p_company_id
                  AND (e.event_type IN ('escalated', 'sla_auto_approve', 'sla_auto_reject'))
                  AND e.created_at >= v_from AND e.created_at < v_to
            ),
            'active_delegations', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'from', public.approval_partner_name(d.from_partner_id),
                    'to', public.approval_partner_name(d.to_partner_id),
                    'category', c.name, 'starts_on', d.starts_on, 'ends_on', d.ends_on)), '[]'::jsonb)
                FROM public.approval_delegation d
                LEFT JOIN public.approval_category c ON c.id = d.category_id
                WHERE d.company_id = p_company_id AND d.active
                  AND (d.ends_on IS NULL OR d.ends_on >= CURRENT_DATE)
            ),
            'flow_changes', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object('flow', f.name, 'version', f.version, 'updated_at', f.updated_at)
                    ORDER BY f.updated_at DESC), '[]'::jsonb)
                FROM public.approval_flow f
                WHERE f.company_id = p_company_id AND f.updated_at >= v_from AND f.updated_at < v_to
            )
        )
    );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6b. Exportar / importar configuración (categorías, flujos, motivos)
-- Los aprobadores concretos viajan por correo del contacto; si no existen como
-- aprobadores en la empresa destino, ese aprobador se omite y se informa.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_export_config(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Solo un owner o administrador puede exportar la configuración' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'format', 'flowbit-approvals',
        'version', 1,
        'exported_at', now(),
        'settings', (SELECT to_jsonb(s) - 'company_id' - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
                     FROM public.approval_get_settings(p_company_id) s),
        'rejection_reasons', (SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
                              FROM public.approval_rejection_reason WHERE company_id = p_company_id AND active),
        'flows', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'name', f.name, 'description', f.description, 'restart_from_first', f.restart_from_first,
                'steps', (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'sequence', s.sequence, 'name', s.name, 'mode', s.mode, 'quorum', s.quorum,
                        'informative', s.informative, 'condition', s.condition, 'sla_days', s.sla_days,
                        'approvers', (
                            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                'kind', sa.kind,
                                'manager_email', (SELECT p.email FROM public.approval_manager am
                                                  JOIN public.partner p ON p.id = am.partner_id
                                                  WHERE am.id = sa.approval_manager_id)
                            )), '[]'::jsonb)
                            FROM public.approval_flow_step_approver sa WHERE sa.step_id = s.id AND sa.active
                        )
                    ) ORDER BY s.sequence), '[]'::jsonb)
                    FROM public.approval_flow_step s WHERE s.flow_id = f.id AND s.active
                )
            )), '[]'::jsonb)
            FROM public.approval_flow f WHERE f.company_id = p_company_id AND f.active
        ),
        'categories', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'name', c.name, 'internal_code', c.internal_code, 'description', c.description,
                'color', c.color, 'icon', c.icon, 'field_schema', c.field_schema, 'allow_lines', c.allow_lines,
                'require_attachment', c.require_attachment, 'confidential', c.confidential,
                'critical_fields', to_jsonb(c.critical_fields), 'sla_days', c.sla_days,
                'auto_approve_max_amount', c.auto_approve_max_amount,
                'flow', (SELECT f.name FROM public.approval_flow f WHERE f.id = c.flow_id)
            ) ORDER BY c.name), '[]'::jsonb)
            FROM public.approval_category c WHERE c.company_id = p_company_id AND NOT c.archived AND c.source_kind IS NULL
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_import_config(p_company_id UUID, p_config JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_flow       JSONB;
    v_step       JSONB;
    v_approver   JSONB;
    v_category   JSONB;
    v_flow_id    UUID;
    v_step_id    UUID;
    v_manager_id UUID;
    v_skipped    JSONB := '[]'::jsonb;
    v_flows      INTEGER := 0;
    v_cats       INTEGER := 0;
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Solo un owner o administrador puede importar la configuración' USING ERRCODE = '42501';
    END IF;
    IF p_config ->> 'format' IS DISTINCT FROM 'flowbit-approvals' THEN
        RAISE EXCEPTION 'El archivo no es una configuración de aprobaciones de Flowbit';
    END IF;

    INSERT INTO public.approval_rejection_reason (company_id, name, created_by, updated_by)
    SELECT p_company_id, x, auth.uid(), auth.uid()
    FROM jsonb_array_elements_text(COALESCE(p_config -> 'rejection_reasons', '[]'::jsonb)) x
    WHERE NOT EXISTS (SELECT 1 FROM public.approval_rejection_reason r
                      WHERE r.company_id = p_company_id AND lower(r.name) = lower(x));

    FOR v_flow IN SELECT * FROM jsonb_array_elements(COALESCE(p_config -> 'flows', '[]'::jsonb)) LOOP
        SELECT id INTO v_flow_id FROM public.approval_flow
        WHERE company_id = p_company_id AND lower(name) = lower(v_flow ->> 'name') AND active
        LIMIT 1;
        IF v_flow_id IS NULL THEN
            INSERT INTO public.approval_flow (company_id, name, description, restart_from_first, created_by, updated_by)
            VALUES (p_company_id, v_flow ->> 'name', v_flow ->> 'description',
                    NULLIF(v_flow ->> 'restart_from_first', '')::BOOLEAN, auth.uid(), auth.uid())
            RETURNING id INTO v_flow_id;
        ELSE
            UPDATE public.approval_flow_step SET active = false WHERE flow_id = v_flow_id;
        END IF;

        FOR v_step IN SELECT * FROM jsonb_array_elements(COALESCE(v_flow -> 'steps', '[]'::jsonb)) LOOP
            INSERT INTO public.approval_flow_step (company_id, flow_id, sequence, name, mode, quorum, informative, condition, sla_days, created_by, updated_by)
            VALUES (p_company_id, v_flow_id, COALESCE((v_step ->> 'sequence')::INTEGER, 1), v_step ->> 'name',
                    COALESCE(v_step ->> 'mode', 'any'), NULLIF(v_step ->> 'quorum', '')::INTEGER,
                    COALESCE((v_step ->> 'informative')::BOOLEAN, false),
                    CASE WHEN jsonb_typeof(v_step -> 'condition') = 'object' THEN v_step -> 'condition' END,
                    NULLIF(v_step ->> 'sla_days', '')::INTEGER, auth.uid(), auth.uid())
            RETURNING id INTO v_step_id;

            FOR v_approver IN SELECT * FROM jsonb_array_elements(COALESCE(v_step -> 'approvers', '[]'::jsonb)) LOOP
                v_manager_id := NULL;
                IF v_approver ->> 'kind' = 'manager' THEN
                    SELECT am.id INTO v_manager_id
                    FROM public.approval_manager am JOIN public.partner p ON p.id = am.partner_id
                    WHERE am.company_id = p_company_id AND lower(p.email) = lower(v_approver ->> 'manager_email')
                    LIMIT 1;
                    IF v_manager_id IS NULL THEN
                        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
                            'flow', v_flow ->> 'name', 'step', v_step ->> 'name', 'manager_email', v_approver ->> 'manager_email'));
                        CONTINUE;
                    END IF;
                END IF;
                INSERT INTO public.approval_flow_step_approver (company_id, step_id, kind, approval_manager_id, created_by, updated_by)
                VALUES (p_company_id, v_step_id, v_approver ->> 'kind', v_manager_id, auth.uid(), auth.uid());
            END LOOP;
        END LOOP;
        v_flows := v_flows + 1;
        v_flow_id := NULL;
    END LOOP;

    FOR v_category IN SELECT * FROM jsonb_array_elements(COALESCE(p_config -> 'categories', '[]'::jsonb)) LOOP
        INSERT INTO public.approval_category (
            company_id, name, internal_code, description, color, icon, field_schema, allow_lines,
            require_attachment, confidential, critical_fields, sla_days, auto_approve_max_amount, flow_id,
            created_by, updated_by
        ) VALUES (
            p_company_id, v_category ->> 'name', v_category ->> 'internal_code', v_category ->> 'description',
            v_category ->> 'color', v_category ->> 'icon', COALESCE(v_category -> 'field_schema', '[]'::jsonb),
            COALESCE((v_category ->> 'allow_lines')::BOOLEAN, false),
            COALESCE((v_category ->> 'require_attachment')::BOOLEAN, false),
            COALESCE((v_category ->> 'confidential')::BOOLEAN, false),
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_category -> 'critical_fields')),
                     ARRAY['amount', 'currency', 'category_id', 'lines']),
            NULLIF(v_category ->> 'sla_days', '')::INTEGER,
            public.approval_try_numeric(v_category ->> 'auto_approve_max_amount'),
            (SELECT id FROM public.approval_flow WHERE company_id = p_company_id AND active
               AND lower(name) = lower(v_category ->> 'flow') LIMIT 1),
            auth.uid(), auth.uid()
        )
        ON CONFLICT (company_id, internal_code) DO UPDATE SET
            name = excluded.name, description = excluded.description, color = excluded.color, icon = excluded.icon,
            field_schema = excluded.field_schema, allow_lines = excluded.allow_lines,
            require_attachment = excluded.require_attachment, confidential = excluded.confidential,
            critical_fields = excluded.critical_fields, sla_days = excluded.sla_days,
            auto_approve_max_amount = excluded.auto_approve_max_amount, flow_id = excluded.flow_id,
            updated_by = auth.uid();
        v_cats := v_cats + 1;
    END LOOP;

    RETURN jsonb_build_object('flows', v_flows, 'categories', v_cats, 'skipped_approvers', v_skipped);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6c. Datos de ejemplo: flujos típicos de una empresa mexicana
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_load_demo(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config JSONB;
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RAISE EXCEPTION 'Solo un owner o administrador puede cargar los ejemplos' USING ERRCODE = '42501';
    END IF;

    v_config := jsonb_build_object(
        'format', 'flowbit-approvals',
        'rejection_reasons', jsonb_build_array('Fuera de presupuesto', 'Falta documentación', 'No es prioritario', 'Proveedor no autorizado', 'Datos incorrectos'),
        'flows', jsonb_build_array(
            jsonb_build_object('name', 'Compras por monto', 'description', 'Jefe directo; Dirección desde $50,000',
                'steps', jsonb_build_array(
                    jsonb_build_object('sequence', 1, 'name', 'Jefe directo', 'mode', 'any', 'sla_days', 2,
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'direct_manager'))),
                    jsonb_build_object('sequence', 2, 'name', 'Compras', 'mode', 'any', 'sla_days', 2,
                        'condition', jsonb_build_object('match', 'all', 'rules', jsonb_build_array(jsonb_build_object('field', 'amount', 'op', 'gte', 'value', 10000))),
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'category_managers'))),
                    jsonb_build_object('sequence', 3, 'name', 'Dirección general', 'mode', 'any', 'sla_days', 3,
                        'condition', jsonb_build_object('match', 'all', 'rules', jsonb_build_array(jsonb_build_object('field', 'amount', 'op', 'gte', 'value', 50000))),
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'owners'))))),
            jsonb_build_object('name', 'Viáticos', 'description', 'Jefe directo; Dirección si supera $20,000',
                'steps', jsonb_build_array(
                    jsonb_build_object('sequence', 1, 'name', 'Jefe directo', 'mode', 'any', 'sla_days', 2,
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'direct_manager'))),
                    jsonb_build_object('sequence', 2, 'name', 'Dirección', 'mode', 'any', 'sla_days', 2,
                        'condition', jsonb_build_object('match', 'all', 'rules', jsonb_build_array(jsonb_build_object('field', 'amount', 'op', 'gt', 'value', 20000))),
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'owners'))))),
            jsonb_build_object('name', 'Gastos', 'description', 'Responsables de la categoría con su límite',
                'steps', jsonb_build_array(
                    jsonb_build_object('sequence', 1, 'name', 'Responsable de gastos', 'mode', 'any', 'sla_days', 2,
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'category_managers'))))),
            jsonb_build_object('name', 'Descuentos comerciales', 'description', 'Ventas; Dirección desde 15 %',
                'steps', jsonb_build_array(
                    jsonb_build_object('sequence', 1, 'name', 'Gerencia comercial', 'mode', 'any', 'sla_days', 1,
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'category_managers'))),
                    jsonb_build_object('sequence', 2, 'name', 'Dirección', 'mode', 'any', 'sla_days', 1,
                        'condition', jsonb_build_object('match', 'all', 'rules', jsonb_build_array(jsonb_build_object('field', 'field.descuento', 'op', 'gte', 'value', 15))),
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'owners'))))),
            jsonb_build_object('name', 'Alta de proveedor', 'description', 'Compras y Finanzas en paralelo; Dirección informada',
                'steps', jsonb_build_array(
                    jsonb_build_object('sequence', 1, 'name', 'Compras y Finanzas', 'mode', 'all', 'sla_days', 3,
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'category_managers'))),
                    jsonb_build_object('sequence', 2, 'name', 'Dirección (informativo)', 'mode', 'any', 'informative', true,
                        'approvers', jsonb_build_array(jsonb_build_object('kind', 'owners')))))
        ),
        'categories', jsonb_build_array(
            jsonb_build_object('name', 'Compras', 'internal_code', 'compras', 'color', 'indigo', 'icon', 'cart',
                'description', 'Compras de bienes y servicios', 'allow_lines', true, 'require_attachment', true, 'sla_days', 2,
                'flow', 'Compras por monto',
                'field_schema', jsonb_build_array(
                    jsonb_build_object('key', 'proveedor', 'label', 'Proveedor', 'type', 'partner', 'required', true),
                    jsonb_build_object('key', 'centro_costos', 'label', 'Centro de costos', 'type', 'text', 'required', false))),
            jsonb_build_object('name', 'Viáticos', 'internal_code', 'viaticos', 'color', 'violet', 'icon', 'plane',
                'description', 'Gastos de viaje de trabajo', 'sla_days', 2, 'flow', 'Viáticos',
                'field_schema', jsonb_build_array(
                    jsonb_build_object('key', 'destino', 'label', 'Destino', 'type', 'text', 'required', true),
                    jsonb_build_object('key', 'fechas_viaje', 'label', 'Fechas del viaje', 'type', 'daterange', 'required', true),
                    jsonb_build_object('key', 'motivo_viaje', 'label', 'Motivo del viaje', 'type', 'textarea', 'required', true))),
            jsonb_build_object('name', 'Gastos menores', 'internal_code', 'gastos-menores', 'color', 'emerald', 'icon', 'receipt',
                'description', 'Reembolsos y gastos de operación', 'allow_lines', true, 'require_attachment', true,
                'auto_approve_max_amount', 500, 'flow', 'Gastos'),
            jsonb_build_object('name', 'Descuentos comerciales', 'internal_code', 'descuentos-comerciales', 'color', 'amber', 'icon', 'tag',
                'description', 'Descuentos fuera de política para clientes', 'sla_days', 1, 'flow', 'Descuentos comerciales',
                'field_schema', jsonb_build_array(
                    jsonb_build_object('key', 'cliente', 'label', 'Cliente', 'type', 'partner', 'required', true),
                    jsonb_build_object('key', 'descuento', 'label', 'Descuento (%)', 'type', 'number', 'required', true))),
            jsonb_build_object('name', 'Alta de proveedor', 'internal_code', 'alta-proveedor', 'color', 'sky', 'icon', 'building',
                'description', 'Registro de un proveedor nuevo', 'require_attachment', true, 'sla_days', 3, 'flow', 'Alta de proveedor',
                'field_schema', jsonb_build_array(
                    jsonb_build_object('key', 'razon_social', 'label', 'Razón social', 'type', 'text', 'required', true),
                    jsonb_build_object('key', 'rfc', 'label', 'RFC', 'type', 'text', 'required', true),
                    jsonb_build_object('key', 'giro', 'label', 'Giro', 'type', 'select', 'required', false,
                        'options', jsonb_build_array('Materia prima', 'Servicios', 'Tecnología', 'Logística', 'Otro'))))
        )
    );

    PERFORM public.approval_get_settings(p_company_id);
    UPDATE public.approval_settings SET advanced_enabled = true WHERE company_id = p_company_id;

    RETURN public.approval_import_config(p_company_id, v_config);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Integración con permisos de RR. HH.
--
-- Cada hr_leave_request pendiente crea una solicitud en la categoría reservada
-- (source_kind = 'hr_leave'). Al resolverse se aplica la revisión de RR. HH.
-- con el mismo código de antes (saldo y faltas justificadas). Cancelar de un
-- lado cancela el otro. hr_review_leave_request se conserva: con una solicitud
-- abierta, su decisión queda como resolución forzada en la bitácora.
-- ════════════════════════════════════════════════════════════════════════════

-- La categoría «Vacaciones» precargada pasa a ser la de RR. HH.
UPDATE public.approval_category
SET source_kind = 'hr_leave',
    name = 'Vacaciones y permisos (RR. HH.)',
    description = 'Solicitudes de vacaciones, permisos e incapacidades creadas desde Recursos Humanos'
WHERE internal_code = 'vacaciones' AND source_kind IS NULL;

INSERT INTO public.approval_category (company_id, name, internal_code, description, source_kind, active, archived)
SELECT c.id, 'Vacaciones y permisos (RR. HH.)', 'rrhh-permisos',
       'Solicitudes de vacaciones, permisos e incapacidades creadas desde Recursos Humanos', 'hr_leave', true, false
FROM public.company c
WHERE NOT EXISTS (SELECT 1 FROM public.approval_category ac WHERE ac.company_id = c.id AND ac.source_kind = 'hr_leave')
ON CONFLICT (company_id, internal_code) DO NOTHING;

-- Empresas nuevas: la categoría de RR. HH. sustituye a «Vacaciones»
CREATE OR REPLACE FUNCTION public.seed_company_default_approval_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.approval_category (company_id, name, internal_code, description, source_kind, active, archived)
    SELECT NEW.id, v.name, v.code, v.description, v.source_kind, TRUE, FALSE
    FROM (
        VALUES
            ('Viaje de negocios', 'viaje-negocios', 'Solicitudes relacionadas con viajes de negocios', NULL::VARCHAR),
            ('Préstamos', 'prestamos', 'Solicitudes de préstamos internos o créditos', NULL),
            ('Contratos', 'contratos', 'Revisión y firma formal de contratos', NULL),
            ('Solicitud de pagos', 'solicitud-pagos', 'Autorización de pagos programados', NULL),
            ('Alquiler', 'alquiler', 'Aprobaciones vinculadas a arrendamientos', NULL),
            ('Cotizaciones', 'cotizaciones', 'Validación formal de cotizaciones comerciales', NULL),
            ('Vacaciones y permisos (RR. HH.)', 'vacaciones', 'Solicitudes de vacaciones, permisos e incapacidades creadas desde Recursos Humanos', 'hr_leave'),
            ('Aprobaciones generales', 'aprobaciones-generales', 'Trámites generales sin subtipo específico', NULL)
    ) AS v(name, code, description, source_kind)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.approval_category ac
        WHERE ac.company_id = NEW.id AND ac.internal_code = v.code
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revisión de RR. HH. sin la comprobación de admin (la autoridad la dio el motor).
CREATE OR REPLACE FUNCTION public.hr_apply_leave_review(
    p_request_id UUID,
    p_approve BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.hr_leave_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request    public.hr_leave_request;
    v_type       public.hr_leave_type;
    v_allocated  DECIMAL;
    v_taken      DECIMAL;
BEGIN
    SELECT * INTO v_request FROM public.hr_leave_request WHERE id = p_request_id AND active IS TRUE;
    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_request.status <> 'pending' THEN
        RETURN v_request;
    END IF;

    SELECT * INTO v_type FROM public.hr_leave_type WHERE id = v_request.leave_type_id;

    IF p_approve AND v_type.deducts_balance THEN
        SELECT COALESCE(sum(days), 0) INTO v_allocated
        FROM public.hr_leave_allocation
        WHERE employee_id = v_request.employee_id AND leave_type_id = v_request.leave_type_id AND active IS TRUE;

        SELECT COALESCE(sum(days), 0) INTO v_taken
        FROM public.hr_leave_request
        WHERE employee_id = v_request.employee_id AND leave_type_id = v_request.leave_type_id
          AND status = 'approved' AND active IS TRUE;

        IF v_allocated - v_taken < v_request.days THEN
            RAISE EXCEPTION 'Saldo insuficiente de días para aprobar este permiso' USING ERRCODE = '22023';
        END IF;
    END IF;

    PERFORM set_config('hr.reviewing_leave', 'on', true);
    PERFORM set_config('approval.syncing', 'on', true);

    UPDATE public.hr_leave_request
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO v_request;

    PERFORM set_config('hr.reviewing_leave', 'off', true);
    PERFORM set_config('approval.syncing', 'off', true);

    IF p_approve THEN
        UPDATE public.hr_absence
        SET kind = 'justified',
            deduct_from_pay = false,
            leave_request_id = v_request.id,
            updated_by = auth.uid()
        WHERE employee_id = v_request.employee_id
          AND absence_date BETWEEN v_request.start_date AND v_request.end_date
          AND active IS TRUE;
    END IF;

    RETURN v_request;
END;
$$;

-- El guard de RR. HH. permite la sincronización del motor (aprobador que no es admin).
CREATE OR REPLACE FUNCTION public.hr_leave_request_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin   BOOLEAN := public.is_company_admin(NEW.company_id);
    v_reviewing  BOOLEAN := COALESCE(current_setting('hr.reviewing_leave', true), '') = 'on';
    v_syncing    BOOLEAN := COALESCE(current_setting('approval.syncing', true), '') = 'on';
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id) THEN
        RAISE EXCEPTION 'The company and employee of a request cannot change' USING ERRCODE = '22023';
    END IF;

    IF NOT v_is_admin AND NOT v_syncing THEN
        IF NOT public.hr_is_own_employee(NEW.employee_id) THEN
            RAISE EXCEPTION 'You can only manage your own requests' USING ERRCODE = '42501';
        END IF;
        IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
            RAISE EXCEPTION 'New requests must be pending' USING ERRCODE = '42501';
        END IF;
        IF TG_OP = 'UPDATE' AND NOT (
            OLD.status = 'pending' AND NEW.status = 'cancelled'
            AND NEW.start_date = OLD.start_date AND NEW.end_date = OLD.end_date
            AND NEW.leave_type_id = OLD.leave_type_id AND NEW.half_day = OLD.half_day
        ) THEN
            RAISE EXCEPTION 'You can only cancel a pending request' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status <> 'approved') AND NOT v_reviewing THEN
        RAISE EXCEPTION 'Use hr_review_leave_request to approve' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IN ('approved', 'rejected', 'cancelled') AND NEW.status = OLD.status
       AND (NEW.start_date <> OLD.start_date OR NEW.end_date <> OLD.end_date
            OR NEW.leave_type_id <> OLD.leave_type_id OR NEW.half_day <> OLD.half_day) THEN
        RAISE EXCEPTION 'A reviewed request cannot change its dates or type' USING ERRCODE = '22023';
    END IF;

    NEW.days := public.hr_count_leave_days(NEW.employee_id, NEW.start_date, NEW.end_date, NEW.half_day);
    IF NEW.days <= 0 AND NEW.status IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'The request has no working days' USING ERRCODE = '22023';
    END IF;

    IF NEW.status IN ('pending', 'approved') AND NEW.active IS TRUE AND EXISTS (
        SELECT 1 FROM public.hr_leave_request r
        WHERE r.employee_id = NEW.employee_id
          AND r.id <> NEW.id
          AND r.active IS TRUE
          AND r.status IN ('pending', 'approved')
          AND daterange(r.start_date, r.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
    ) THEN
        RAISE EXCEPTION 'The request overlaps another request' USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

-- Crea y envía la solicitud de aprobación de un permiso de RR. HH.
CREATE OR REPLACE FUNCTION public.approval_create_for_leave(p_leave_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_leave    public.hr_leave_request;
    v_employee public.employee;
    v_type     public.hr_leave_type;
    v_category UUID;
    v_id       UUID;
    v_captured UUID := public.current_user_partner_row_id();
BEGIN
    SELECT * INTO v_leave FROM public.hr_leave_request WHERE id = p_leave_id;
    IF v_leave.id IS NULL OR v_leave.status <> 'pending' OR NOT COALESCE(v_leave.active, true) THEN
        RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM public.approval_request WHERE source_type = 'hr_leave' AND source_id = p_leave_id AND active) THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_employee FROM public.employee WHERE id = v_leave.employee_id;
    SELECT * INTO v_type FROM public.hr_leave_type WHERE id = v_leave.leave_type_id;
    SELECT id INTO v_category FROM public.approval_category
    WHERE company_id = v_leave.company_id AND source_kind = 'hr_leave'
    LIMIT 1;
    IF v_category IS NULL THEN
        INSERT INTO public.approval_category (company_id, name, internal_code, description, source_kind)
        VALUES (v_leave.company_id, 'Vacaciones y permisos (RR. HH.)', 'rrhh-permisos',
                'Solicitudes de vacaciones, permisos e incapacidades creadas desde Recursos Humanos', 'hr_leave')
        RETURNING id INTO v_category;
    END IF;

    PERFORM set_config('approval.engine', 'on', true);
    INSERT INTO public.approval_request (
        company_id, title, category_id, requesting_partner_id, captured_by_partner_id,
        request_date, due_date, description, field_values, source_type, source_id, status, created_by, updated_by
    ) VALUES (
        v_leave.company_id,
        left(COALESCE(v_type.name, 'Permiso') || ': ' || COALESCE(public.approval_partner_name(v_employee.partner_id), '')
             || ' (' || to_char(v_leave.start_date, 'DD/MM/YYYY')
             || CASE WHEN v_leave.end_date <> v_leave.start_date THEN ' – ' || to_char(v_leave.end_date, 'DD/MM/YYYY') ELSE '' END
             || ')', 255),
        v_category, v_employee.partner_id,
        CASE WHEN v_captured IS DISTINCT FROM v_employee.partner_id THEN v_captured END,
        COALESCE(v_leave.created_at::DATE, CURRENT_DATE), v_leave.start_date, v_leave.reason,
        jsonb_build_object(
            'tipo', v_type.name, 'desde', v_leave.start_date, 'hasta', v_leave.end_date,
            'dias', v_leave.days, 'medio_dia', v_leave.half_day
        ),
        'hr_leave', p_leave_id, 'draft', auth.uid(), auth.uid()
    )
    RETURNING id INTO v_id;
    PERFORM set_config('approval.engine', 'off', true);

    PERFORM public.approval_log(v_id, 'created_from_source',
        jsonb_build_object('source_type', 'hr_leave', 'source_id', p_leave_id), auth.uid() IS NULL);
    PERFORM public.approval_submit_internal(v_id);
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_leave_request_sync_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_approval UUID;
BEGIN
    IF COALESCE(current_setting('approval.syncing', true), '') = 'on' THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        PERFORM public.approval_create_for_leave(NEW.id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('cancelled', 'rejected', 'approved') THEN
        -- Cancelado por el empleado o revisado fuera del motor: cerrar la solicitud vinculada
        SELECT id INTO v_approval FROM public.approval_request
        WHERE source_type = 'hr_leave' AND source_id = NEW.id AND active AND status IN ('draft', 'published', 'returned');
        IF v_approval IS NOT NULL THEN
            PERFORM set_config('approval.syncing', 'on', true);
            PERFORM public.approval_finalize(v_approval,
                CASE NEW.status WHEN 'cancelled' THEN 'cancelled' WHEN 'rejected' THEN 'rejected' ELSE 'approved' END::public.approval_request_status,
                CASE NEW.status WHEN 'cancelled' THEN 'Cancelada desde Recursos Humanos' ELSE NEW.review_notes END,
                NULL, NEW.status <> 'cancelled', false, false);
            PERFORM set_config('approval.syncing', 'off', true);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS hr_leave_request_sync_approval_trigger ON public.hr_leave_request;
CREATE TRIGGER hr_leave_request_sync_approval_trigger
    AFTER INSERT OR UPDATE OF status ON public.hr_leave_request
    FOR EACH ROW EXECUTE FUNCTION public.hr_leave_request_sync_approval();

-- Gancho del motor: aplica la decisión en el documento de origen.
CREATE OR REPLACE FUNCTION public.approval_on_resolved(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
    v_notes   TEXT;
BEGIN
    IF COALESCE(current_setting('approval.syncing', true), '') = 'on' THEN
        RETURN;
    END IF;
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    IF v_request.source_type IS NULL THEN
        RETURN;
    END IF;

    -- Notas para el documento de origen: la nota de resolución o los comentarios
    -- de quienes aprobaron en la última ronda
    v_notes := COALESCE(v_request.resolution_note, (
        SELECT string_agg(a.comment, ' · ' ORDER BY a.decided_at)
        FROM public.approval_request_approver a
        JOIN public.approval_request_step s ON s.id = a.step_id
        WHERE a.request_id = p_request_id AND s.round = v_request.round
          AND a.status = 'approved' AND NULLIF(trim(COALESCE(a.comment, '')), '') IS NOT NULL
    ));

    IF v_request.source_type = 'hr_leave' THEN
        IF v_request.status = 'approved' THEN
            PERFORM public.hr_apply_leave_review(v_request.source_id, true, v_notes);
        ELSIF v_request.status IN ('rejected', 'expired') THEN
            PERFORM public.hr_apply_leave_review(v_request.source_id, false,
                COALESCE(v_request.resolution_note, 'Rechazada en Aprobaciones'));
        ELSIF v_request.status = 'cancelled' THEN
            PERFORM set_config('approval.syncing', 'on', true);
            UPDATE public.hr_leave_request
            SET status = 'cancelled', updated_by = auth.uid()
            WHERE id = v_request.source_id AND status = 'pending';
            PERFORM set_config('approval.syncing', 'off', true);
        END IF;
    END IF;
END;
$$;

-- Se conserva la firma: con solicitud abierta, la revisión de RR. HH. es una
-- resolución forzada (queda en la bitácora y en cumplimiento).
CREATE OR REPLACE FUNCTION public.hr_review_leave_request(
    p_request_id  UUID,
    p_approve     BOOLEAN,
    p_notes       TEXT DEFAULT NULL
)
RETURNS public.hr_leave_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  public.hr_leave_request;
    v_approval UUID;
BEGIN
    SELECT * INTO v_request FROM public.hr_leave_request WHERE id = p_request_id AND active IS TRUE;
    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.is_company_admin(v_request.company_id) THEN
        RAISE EXCEPTION 'Only company owners or admins can review requests' USING ERRCODE = '42501';
    END IF;
    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending requests can be reviewed' USING ERRCODE = '22023';
    END IF;

    SELECT id INTO v_approval FROM public.approval_request
    WHERE source_type = 'hr_leave' AND source_id = p_request_id AND active AND status IN ('published', 'returned');

    IF v_approval IS NOT NULL THEN
        PERFORM public.approval_force_resolve(v_approval,
            CASE WHEN p_approve THEN 'approve' ELSE 'reject' END,
            COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Revisada desde Recursos Humanos'));
        SELECT * INTO v_request FROM public.hr_leave_request WHERE id = p_request_id;
        RETURN v_request;
    END IF;

    RETURN public.hr_apply_leave_review(p_request_id, p_approve, p_notes);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Datos existentes
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_request RECORD;
    v_step_id UUID;
    v_partner UUID;
    v_leave   RECORD;
BEGIN
    PERFORM set_config('approval.engine', 'on', true);

    -- Bitácora retroactiva: creación y, si ya se resolvió, la decisión (autor desconocido)
    FOR v_request IN
        SELECT r.* FROM public.approval_request r
        WHERE NOT EXISTS (SELECT 1 FROM public.approval_request_event e WHERE e.request_id = r.id)
    LOOP
        INSERT INTO public.approval_request_event (company_id, request_id, seq, event_type, automatic, payload, created_at, hash)
        VALUES (v_request.company_id, v_request.id, 0, 'created', true,
                jsonb_build_object('legacy', true), v_request.created_at, '');
        IF v_request.status IN ('approved', 'rejected') THEN
            INSERT INTO public.approval_request_event (company_id, request_id, seq, event_type, automatic, payload, created_at, hash)
            VALUES (v_request.company_id, v_request.id, 0, 'resolved', true,
                    jsonb_build_object('legacy', true, 'status', v_request.status,
                                       'note', 'Resuelta antes de la bitácora: no se registró quién decidió'),
                    COALESCE(v_request.approved_at, v_request.rejected_at, v_request.updated_at), '');
        END IF;
    END LOOP;

    -- Solicitudes ya publicadas: su aprobador asignado queda como nivel único activo
    FOR v_request IN
        SELECT r.* FROM public.approval_request r
        WHERE r.status = 'published' AND r.active
          AND NOT EXISTS (SELECT 1 FROM public.approval_request_step s WHERE s.request_id = r.id)
    LOOP
        SELECT am.partner_id INTO v_partner FROM public.approval_manager am WHERE am.id = v_request.assigned_approval_manager_id;

        UPDATE public.approval_request SET round = 1, submitted_at = COALESCE(submitted_at, updated_at) WHERE id = v_request.id;

        INSERT INTO public.approval_request_step (company_id, request_id, round, sequence, name, mode, status, activated_at)
        VALUES (v_request.company_id, v_request.id, 1, 1, 'Aprobación', 'any', 'active', now())
        RETURNING id INTO v_step_id;

        IF v_partner IS NOT NULL THEN
            INSERT INTO public.approval_request_approver (company_id, request_id, step_id, partner_id, resolved_via)
            VALUES (v_request.company_id, v_request.id, v_step_id, v_partner, 'manager');
            PERFORM public.approval_notify(v_request.id, v_partner, 'assigned',
                'Pendiente de tu aprobación: ' || public.approval_request_label(v_request.id), true);
        ELSE
            INSERT INTO public.approval_request_approver (company_id, request_id, step_id, partner_id, resolved_via)
            SELECT v_request.company_id, v_request.id, v_step_id, o, 'owners_fallback'
            FROM public.approval_owner_partners(v_request.company_id) o;
        END IF;
        PERFORM public.approval_log(v_request.id, 'migrated_to_engine', '{}'::jsonb, true);
    END LOOP;

    PERFORM set_config('approval.engine', 'off', true);

    -- Permisos de RR. HH. pendientes: pasan al motor
    FOR v_leave IN
        SELECT l.id FROM public.hr_leave_request l
        WHERE l.status = 'pending' AND l.active IS TRUE
    LOOP
        PERFORM public.approval_create_for_leave(v_leave.id);
    END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Permisos de funciones
--
-- Supabase concede EXECUTE a anon/authenticated por defecto: se revoca todo y
-- se concede a authenticated solo lo que el panel llama. Las internas solo las
-- usan otras funciones SECURITY DEFINER o pg_cron.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_fn RECORD;
    v_public TEXT[] := ARRAY[
        'approval_submit_request', 'approval_decide', 'approval_return_request', 'approval_revoke_decision',
        'approval_add_approver', 'approval_reassign', 'approval_force_resolve', 'approval_update_submitted',
        'approval_cancel_request', 'approval_cancel_with_reason', 'approval_reset_request_to_draft',
        'approval_publish_request', 'approval_approve_request', 'approval_reject_request',
        'approval_bulk_decide', 'approval_add_comment', 'approval_mark_activities_read',
        'approval_preview_request', 'approval_simulate', 'approval_request_insights', 'approval_verify_event_chain',
        'approval_dashboard', 'approval_export_config', 'approval_import_config', 'approval_load_demo',
        'approval_run_sla_now',
        -- Usadas por políticas RLS y vistas security_invoker (corren como el usuario)
        'approval_can_view', 'approval_can_edit', 'approval_storage_can_access', 'approval_partner_name',
        'approval_row_visible'
    ];
BEGIN
    FOR v_fn IN
        SELECT p.oid::regprocedure AS sig, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (p.proname LIKE 'approval\_%' OR p.proname IN ('hr_apply_leave_review', 'hr_leave_request_sync_approval'))
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn.sig);
        IF v_fn.proname = ANY (v_public) THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn.sig);
        END IF;
    END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.hr_review_leave_request(UUID, BOOLEAN, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- pg_cron: plazos, escalamiento, expiración y recurrencia cada hora
-- ════════════════════════════════════════════════════════════════════════════
DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
       OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_cron;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            PERFORM cron.unschedule('approval-sla');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        PERFORM cron.schedule('approval-sla', '7 * * * *', 'SELECT public.approval_process_sla()');
    END IF;
END
$do$;
