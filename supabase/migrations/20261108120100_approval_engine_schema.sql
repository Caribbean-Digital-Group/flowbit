-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  Aprobaciones: esquema del motor multinivel (TRY-18)                     ║
-- ║                                                                          ║
-- ║  1. approval_settings          — funciones y políticas por empresa       ║
-- ║  2. approval_category (+)      — formulario dinámico, SLA, reglas        ║
-- ║  3. approval_manager(_category) (+) — límites de autorización            ║
-- ║  4. approval_flow / _step / _step_approver — configuración del flujo     ║
-- ║  5. approval_request (+)       — prioridad, fecha límite, origen…        ║
-- ║  6. approval_request_line      — partidas                                ║
-- ║  7. approval_request_step / _approver — copia del flujo por solicitud    ║
-- ║  8. approval_request_event     — bitácora de solo inserción con hash     ║
-- ║  9. comentarios, adjuntos, motivos de rechazo, delegaciones,             ║
-- ║     actividades (agenda) y plantillas                                    ║
-- ║                                                                          ║
-- ║  Retrocompatibilidad: una categoría sin flujo (flow_id NULL) sigue en    ║
-- ║  «modo simple»: el solicitante elige a un aprobador y ese decide.        ║
-- ║  Ver docs/approvals.md.                                                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Ajustes por empresa
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_settings (
    company_id                 UUID PRIMARY KEY REFERENCES public.company(id) ON DELETE CASCADE,

    -- Muestra en el panel flujos, reglas, delegaciones y plazos. Apagado, la
    -- empresa ve solo lo básico (categoría → aprobador → decisión).
    advanced_enabled           BOOLEAN NOT NULL DEFAULT false,

    -- Al reenviar una solicitud devuelta: desde el nivel 1 o desde el que devolvió.
    restart_from_first         BOOLEAN NOT NULL DEFAULT true,
    -- El solicitante nunca aprueba su propia solicitud.
    prevent_self_approval      BOOLEAN NOT NULL DEFAULT true,
    -- Si al quitar al solicitante un nivel queda vacío: saltarlo o pasarlo a los owners.
    self_approval_fallback     VARCHAR(20) NOT NULL DEFAULT 'next_level',
    -- La misma persona en niveles consecutivos aprueba una sola vez.
    dedupe_consecutive         BOOLEAN NOT NULL DEFAULT true,
    require_reject_reason      BOOLEAN NOT NULL DEFAULT true,
    notify_requester_each_level BOOLEAN NOT NULL DEFAULT false,

    -- Plazos y escalamiento (approval_process_sla, cada hora con pg_cron)
    default_sla_days           INTEGER,
    reminder_every_hours       INTEGER NOT NULL DEFAULT 24,
    escalation_action          VARCHAR(20) NOT NULL DEFAULT 'remind',
    expire_after_days          INTEGER,

    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT approval_settings_fallback_chk CHECK (self_approval_fallback IN ('next_level', 'owners')),
    CONSTRAINT approval_settings_escalation_chk CHECK (escalation_action IN (
        'remind', 'escalate_manager', 'escalate_owners', 'auto_approve', 'auto_reject'
    )),
    CONSTRAINT approval_settings_positive_chk CHECK (
        (default_sla_days IS NULL OR default_sla_days > 0)
        AND reminder_every_hours > 0
        AND (expire_after_days IS NULL OR expire_after_days > 0)
    )
);

COMMENT ON TABLE public.approval_settings IS
  'Funciones y políticas del motor de aprobaciones por empresa. Sin fila = valores por defecto.';

DROP TRIGGER IF EXISTS trigger_approval_settings_updated_at ON public.approval_settings;
CREATE TRIGGER trigger_approval_settings_updated_at
    BEFORE UPDATE ON public.approval_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- 4a. Flujos (se crean antes para poder referenciarlos desde la categoría)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_flow (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name                VARCHAR(160) NOT NULL,
    description         TEXT,
    -- NULL = usa approval_settings.restart_from_first
    restart_from_first  BOOLEAN,
    -- Sube con cada cambio de pasos; la solicitud guarda la versión con que se envió.
    version             INTEGER NOT NULL DEFAULT 1,

    active              BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT approval_flow_company_id_key UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_approval_flow_company ON public.approval_flow(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_flow_active ON public.approval_flow(active);

DROP TRIGGER IF EXISTS trigger_approval_flow_updated_at ON public.approval_flow;
CREATE TRIGGER trigger_approval_flow_updated_at
    BEFORE UPDATE ON public.approval_flow
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.approval_flow IS
  'Plantilla de flujo multinivel. Se copia en approval_request_step al enviar: editarla no afecta solicitudes en curso.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Categoría: formulario dinámico, reglas y plazos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.approval_category
    ADD COLUMN IF NOT EXISTS color                    VARCHAR(20),
    ADD COLUMN IF NOT EXISTS icon                     VARCHAR(40),
    ADD COLUMN IF NOT EXISTS flow_id                  UUID,
    -- [{key, label, type, required, options[], help}] — ver app/utils/approvals.ts
    ADD COLUMN IF NOT EXISTS field_schema             JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS allow_lines              BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS require_attachment       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS confidential             BOOLEAN NOT NULL DEFAULT false,
    -- Campos cuyo cambio tras enviar reinicia el flujo
    ADD COLUMN IF NOT EXISTS critical_fields          TEXT[] NOT NULL DEFAULT ARRAY['amount', 'currency', 'category_id', 'lines']::TEXT[],
    ADD COLUMN IF NOT EXISTS sla_days                 INTEGER,
    -- Hasta este monto (inclusive) la solicitud se aprueba sola al enviarse
    ADD COLUMN IF NOT EXISTS auto_approve_max_amount  NUMERIC(15, 2),
    -- Categoría reservada para documentos de otro módulo (p. ej. 'hr_leave')
    ADD COLUMN IF NOT EXISTS source_kind              VARCHAR(30);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_category_flow_fk') THEN
        ALTER TABLE public.approval_category
            ADD CONSTRAINT approval_category_flow_fk
            FOREIGN KEY (flow_id) REFERENCES public.approval_flow(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_category_rules_chk') THEN
        ALTER TABLE public.approval_category
            ADD CONSTRAINT approval_category_rules_chk CHECK (
                (sla_days IS NULL OR sla_days > 0)
                AND (auto_approve_max_amount IS NULL OR auto_approve_max_amount >= 0)
                AND jsonb_typeof(field_schema) = 'array'
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_category_source_kind
    ON public.approval_category(company_id, source_kind)
    WHERE source_kind IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Límites de autorización por aprobador
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.approval_manager
    ADD COLUMN IF NOT EXISTS max_amount NUMERIC(15, 2);

ALTER TABLE public.approval_manager_category
    ADD COLUMN IF NOT EXISTS max_amount NUMERIC(15, 2);

COMMENT ON COLUMN public.approval_manager.max_amount IS
  'Monto máximo que puede autorizar en cualquier categoría. NULL = sin límite.';
COMMENT ON COLUMN public.approval_manager_category.max_amount IS
  'Límite para esta categoría; tiene prioridad sobre approval_manager.max_amount.';

-- Un aprobador sin categorías ya no autoriza todas (decisión del dueño, TRY-18).
COMMENT ON TABLE public.approval_manager_category IS
  'Categorías que autoriza cada aprobador. Sin filas = no autoriza ninguna.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4b. Niveles del flujo y sus aprobadores
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_flow_step (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    flow_id      UUID NOT NULL,

    -- Niveles con la misma secuencia corren en paralelo.
    sequence     INTEGER NOT NULL DEFAULT 1,
    name         VARCHAR(160) NOT NULL,
    mode         VARCHAR(10) NOT NULL DEFAULT 'any',
    quorum       INTEGER,
    -- Solo informativo: se notifica pero no bloquea.
    informative  BOOLEAN NOT NULL DEFAULT false,
    -- {"match":"all"|"any","rules":[{"field","op","value"}]} — NULL = siempre
    condition    JSONB,
    sla_days     INTEGER,

    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT approval_flow_step_company_id_key UNIQUE (company_id, id),
    CONSTRAINT approval_flow_step_flow_fk FOREIGN KEY (company_id, flow_id)
        REFERENCES public.approval_flow(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_flow_step_mode_chk CHECK (mode IN ('any', 'all', 'quorum')),
    CONSTRAINT approval_flow_step_quorum_chk CHECK (mode <> 'quorum' OR (quorum IS NOT NULL AND quorum >= 1)),
    CONSTRAINT approval_flow_step_sequence_chk CHECK (sequence >= 1),
    CONSTRAINT approval_flow_step_sla_chk CHECK (sla_days IS NULL OR sla_days > 0)
);

CREATE INDEX IF NOT EXISTS idx_approval_flow_step_flow ON public.approval_flow_step(flow_id, sequence);
CREATE INDEX IF NOT EXISTS idx_approval_flow_step_company ON public.approval_flow_step(company_id);

DROP TRIGGER IF EXISTS trigger_approval_flow_step_updated_at ON public.approval_flow_step;
CREATE TRIGGER trigger_approval_flow_step_updated_at
    BEFORE UPDATE ON public.approval_flow_step
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.approval_flow_step_approver (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    step_id               UUID NOT NULL,

    -- manager            → un aprobador registrado concreto
    -- category_managers  → los aprobadores registrados de la categoría
    -- owners             → los owners de la empresa
    -- direct_manager     → el jefe directo del solicitante (RR. HH.)
    -- manager_chain      → jefe, jefe del jefe… hasta cubrir el monto con su límite
    -- department_manager → el responsable del departamento del solicitante
    kind                  VARCHAR(30) NOT NULL,
    approval_manager_id   UUID REFERENCES public.approval_manager(id) ON DELETE CASCADE,

    active                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT approval_flow_step_approver_step_fk FOREIGN KEY (company_id, step_id)
        REFERENCES public.approval_flow_step(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_flow_step_approver_kind_chk CHECK (kind IN (
        'manager', 'category_managers', 'owners', 'direct_manager', 'manager_chain', 'department_manager'
    )),
    CONSTRAINT approval_flow_step_approver_manager_chk CHECK (
        (kind = 'manager') = (approval_manager_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_approval_flow_step_approver_step ON public.approval_flow_step_approver(step_id);
CREATE INDEX IF NOT EXISTS idx_approval_flow_step_approver_company ON public.approval_flow_step_approver(company_id);

DROP TRIGGER IF EXISTS trigger_approval_flow_step_approver_updated_at ON public.approval_flow_step_approver;
CREATE TRIGGER trigger_approval_flow_step_approver_updated_at
    BEFORE UPDATE ON public.approval_flow_step_approver
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- 9a. Motivos de rechazo
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_rejection_reason (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    name        VARCHAR(160) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT approval_rejection_reason_company_id_key UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS idx_approval_rejection_reason_company ON public.approval_rejection_reason(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_rejection_reason_active ON public.approval_rejection_reason(active);

DROP TRIGGER IF EXISTS trigger_approval_rejection_reason_updated_at ON public.approval_rejection_reason;
CREATE TRIGGER trigger_approval_rejection_reason_updated_at
    BEFORE UPDATE ON public.approval_rejection_reason
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Solicitud: campos nuevos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.approval_request
    ADD COLUMN IF NOT EXISTS priority                 VARCHAR(10) NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS due_date                 DATE,
    ADD COLUMN IF NOT EXISTS field_values             JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Quién la capturó cuando se crea en nombre de otra persona
    ADD COLUMN IF NOT EXISTS captured_by_partner_id   UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    -- Documento de otro módulo que la originó (p. ej. 'hr_leave')
    ADD COLUMN IF NOT EXISTS source_type              VARCHAR(30),
    ADD COLUMN IF NOT EXISTS source_id                UUID,
    -- Copia del flujo con que se envió
    ADD COLUMN IF NOT EXISTS flow_id                  UUID REFERENCES public.approval_flow(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS flow_version             INTEGER,
    ADD COLUMN IF NOT EXISTS round                    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS returned_from_sequence   INTEGER,
    ADD COLUMN IF NOT EXISTS submitted_at             TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS returned_at              TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at             TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expired_at               TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolution_note          TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason_id      UUID REFERENCES public.approval_rejection_reason(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolved_by_partner_id   UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS forced                   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_approved            BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_request_priority_chk') THEN
        ALTER TABLE public.approval_request
            ADD CONSTRAINT approval_request_priority_chk
            CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_request_field_values_chk') THEN
        ALTER TABLE public.approval_request
            ADD CONSTRAINT approval_request_field_values_chk
            CHECK (jsonb_typeof(field_values) = 'object');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_request_source_chk') THEN
        ALTER TABLE public.approval_request
            ADD CONSTRAINT approval_request_source_chk
            CHECK ((source_type IS NULL) = (source_id IS NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_request_company_id_key') THEN
        ALTER TABLE public.approval_request
            ADD CONSTRAINT approval_request_company_id_key UNIQUE (company_id, id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_request_source
    ON public.approval_request(source_type, source_id)
    WHERE source_type IS NOT NULL AND active = true;
CREATE INDEX IF NOT EXISTS idx_approval_request_captured_by ON public.approval_request(captured_by_partner_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_active ON public.approval_request(active);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Partidas
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_request_line (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    request_id   UUID NOT NULL,

    sequence     INTEGER NOT NULL DEFAULT 1,
    concept      VARCHAR(255) NOT NULL,
    product_id   UUID REFERENCES public.product(id) ON DELETE SET NULL,
    quantity     NUMERIC(15, 3) NOT NULL DEFAULT 1,
    unit_price   NUMERIC(15, 2) NOT NULL DEFAULT 0,
    subtotal     NUMERIC(17, 2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,

    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT approval_request_line_request_fk FOREIGN KEY (company_id, request_id)
        REFERENCES public.approval_request(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_request_line_amounts_chk CHECK (quantity > 0 AND unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_approval_request_line_request ON public.approval_request_line(request_id, sequence);
CREATE INDEX IF NOT EXISTS idx_approval_request_line_company ON public.approval_request_line(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_line_active ON public.approval_request_line(active);

DROP TRIGGER IF EXISTS trigger_approval_request_line_updated_at ON public.approval_request_line;
CREATE TRIGGER trigger_approval_request_line_updated_at
    BEFORE UPDATE ON public.approval_request_line
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Copia del flujo en la solicitud (ejecución)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_request_step (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    request_id           UUID NOT NULL,
    -- Cada reenvío tras devolución crea una ronda nueva; las anteriores quedan como historial.
    round                INTEGER NOT NULL DEFAULT 1,

    sequence             INTEGER NOT NULL,
    name                 VARCHAR(160) NOT NULL,
    mode                 VARCHAR(10) NOT NULL DEFAULT 'any',
    quorum               INTEGER,
    informative          BOOLEAN NOT NULL DEFAULT false,
    sla_days             INTEGER,
    flow_step_id         UUID REFERENCES public.approval_flow_step(id) ON DELETE SET NULL,

    -- waiting → active → approved | rejected | skipped | cancelled
    status               VARCHAR(12) NOT NULL DEFAULT 'waiting',
    activated_at         TIMESTAMPTZ,
    due_at               TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    -- Momento en que se aplicó la acción de escalamiento por plazo vencido
    escalated_at         TIMESTAMPTZ,
    note                 TEXT,

    ad_hoc               BOOLEAN NOT NULL DEFAULT false,
    added_by_partner_id  UUID REFERENCES public.partner(id) ON DELETE SET NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT approval_request_step_company_id_key UNIQUE (company_id, id),
    CONSTRAINT approval_request_step_request_fk FOREIGN KEY (company_id, request_id)
        REFERENCES public.approval_request(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_request_step_mode_chk CHECK (mode IN ('any', 'all', 'quorum')),
    CONSTRAINT approval_request_step_status_chk CHECK (status IN (
        'waiting', 'active', 'approved', 'rejected', 'skipped', 'cancelled'
    ))
);

CREATE INDEX IF NOT EXISTS idx_approval_request_step_request ON public.approval_request_step(request_id, round, sequence);
CREATE INDEX IF NOT EXISTS idx_approval_request_step_active ON public.approval_request_step(status, due_at) WHERE status = 'active';

DROP TRIGGER IF EXISTS trigger_approval_request_step_updated_at ON public.approval_request_step;
CREATE TRIGGER trigger_approval_request_step_updated_at
    BEFORE UPDATE ON public.approval_request_step
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.approval_request_approver (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                 UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    request_id                 UUID NOT NULL,
    step_id                    UUID NOT NULL,

    partner_id                 UUID NOT NULL REFERENCES public.partner(id) ON DELETE RESTRICT,
    -- Titular original cuando el aprobador actúa por delegación o reasignación
    delegated_from_partner_id  UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    -- Regla que lo resolvió (manager, owners, direct_manager, ad_hoc, escalation…)
    resolved_via               VARCHAR(30) NOT NULL DEFAULT 'manager',

    -- pending → approved | rejected | revoked | skipped | reassigned | informed | cancelled
    status                     VARCHAR(12) NOT NULL DEFAULT 'pending',
    decided_at                 TIMESTAMPTZ,
    comment                    TEXT,
    last_reminder_at           TIMESTAMPTZ,

    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT approval_request_approver_step_fk FOREIGN KEY (company_id, step_id)
        REFERENCES public.approval_request_step(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_request_approver_request_fk FOREIGN KEY (company_id, request_id)
        REFERENCES public.approval_request(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_request_approver_status_chk CHECK (status IN (
        'pending', 'approved', 'rejected', 'revoked', 'skipped', 'reassigned', 'informed', 'cancelled'
    ))
);

CREATE INDEX IF NOT EXISTS idx_approval_request_approver_step ON public.approval_request_approver(step_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_approver_request ON public.approval_request_approver(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_approver_partner_pending
    ON public.approval_request_approver(partner_id, status) WHERE status = 'pending';

DROP TRIGGER IF EXISTS trigger_approval_request_approver_updated_at ON public.approval_request_approver;
CREATE TRIGGER trigger_approval_request_approver_updated_at
    BEFORE UPDATE ON public.approval_request_approver
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Bitácora de solo inserción
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_request_event (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    request_id        UUID NOT NULL,
    seq               INTEGER NOT NULL,

    event_type        VARCHAR(40) NOT NULL,
    actor_user_id     UUID,
    actor_partner_id  UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    -- true cuando lo generó el sistema (plazos, reglas, sincronización con RR. HH.)
    automatic         BOOLEAN NOT NULL DEFAULT false,
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip                VARCHAR(80),
    user_agent        VARCHAR(400),

    created_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    -- sha256(prev_hash || contenido): alterar un evento rompe la cadena siguiente
    prev_hash         VARCHAR(64),
    hash              VARCHAR(64) NOT NULL,

    CONSTRAINT approval_request_event_request_fk FOREIGN KEY (company_id, request_id)
        REFERENCES public.approval_request(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_request_event_seq_key UNIQUE (request_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_approval_request_event_request ON public.approval_request_event(request_id, seq);
CREATE INDEX IF NOT EXISTS idx_approval_request_event_company_type ON public.approval_request_event(company_id, event_type, created_at);

COMMENT ON TABLE public.approval_request_event IS
  'Bitácora inmutable por solicitud. Solo inserción (trigger) y hash encadenado (approval_verify_event_chain).';

-- ════════════════════════════════════════════════════════════════════════════
-- 9b. Comentarios y adjuntos
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_request_comment (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    request_id         UUID NOT NULL,
    author_partner_id  UUID NOT NULL REFERENCES public.partner(id) ON DELETE RESTRICT,
    body               TEXT NOT NULL,
    mentions           UUID[] NOT NULL DEFAULT '{}',
    active             BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT approval_request_comment_request_fk FOREIGN KEY (company_id, request_id)
        REFERENCES public.approval_request(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_request_comment_body_chk CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_approval_request_comment_request ON public.approval_request_comment(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_approval_request_comment_company ON public.approval_request_comment(company_id);

DROP TRIGGER IF EXISTS trigger_approval_request_comment_updated_at ON public.approval_request_comment;
CREATE TRIGGER trigger_approval_request_comment_updated_at
    BEFORE UPDATE ON public.approval_request_comment
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.approval_request_attachment (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    request_id             UUID NOT NULL,
    -- {company_id}/{request_id}/{uuid}-{nombre} en el bucket privado approval-attachments
    storage_path           TEXT NOT NULL,
    file_name              VARCHAR(255) NOT NULL,
    mime_type              VARCHAR(120),
    size_bytes             BIGINT,
    uploaded_by_partner_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    active                 BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT approval_request_attachment_request_fk FOREIGN KEY (company_id, request_id)
        REFERENCES public.approval_request(company_id, id) ON DELETE CASCADE,
    CONSTRAINT approval_request_attachment_path_key UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_approval_request_attachment_request ON public.approval_request_attachment(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_attachment_company ON public.approval_request_attachment(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_attachment_active ON public.approval_request_attachment(active);

DROP TRIGGER IF EXISTS trigger_approval_request_attachment_updated_at ON public.approval_request_attachment;
CREATE TRIGGER trigger_approval_request_attachment_updated_at
    BEFORE UPDATE ON public.approval_request_attachment
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- 9c. Delegaciones (fuera de oficina y permanentes por categoría)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_delegation (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    from_partner_id  UUID NOT NULL REFERENCES public.partner(id) ON DELETE CASCADE,
    to_partner_id    UUID NOT NULL REFERENCES public.partner(id) ON DELETE CASCADE,
    -- NULL = todas las categorías
    category_id      UUID REFERENCES public.approval_category(id) ON DELETE CASCADE,
    -- Ambas NULL = permanente
    starts_on        DATE,
    ends_on          DATE,
    reason           TEXT,
    active           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT approval_delegation_distinct_chk CHECK (from_partner_id <> to_partner_id),
    CONSTRAINT approval_delegation_dates_chk CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_approval_delegation_company ON public.approval_delegation(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_delegation_from ON public.approval_delegation(from_partner_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_approval_delegation_active ON public.approval_delegation(active);

DROP TRIGGER IF EXISTS trigger_approval_delegation_updated_at ON public.approval_delegation;
CREATE TRIGGER trigger_approval_delegation_updated_at
    BEFORE UPDATE ON public.approval_delegation
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- 9d. Actividades: el canal de avisos (agenda + campana). No hay correo.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_activity (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    partner_id    UUID NOT NULL REFERENCES public.partner(id) ON DELETE CASCADE,
    request_id    UUID NOT NULL,

    -- assigned, informed, reminder, escalated, delegated, approved, rejected,
    -- returned, cancelled, expired, comment, mention, level_advanced, auto_approved
    kind          VARCHAR(20) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    -- Fecha en que aparece en la agenda (fecha límite del nivel o momento del aviso)
    scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Las de acción (assigned, reminder, escalated) se cierran al decidir.
    actionable    BOOLEAN NOT NULL DEFAULT false,
    read_at       TIMESTAMPTZ,
    done_at       TIMESTAMPTZ,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT approval_activity_request_fk FOREIGN KEY (company_id, request_id)
        REFERENCES public.approval_request(company_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_approval_activity_partner_open
    ON public.approval_activity(partner_id, company_id, scheduled_at) WHERE done_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approval_activity_request ON public.approval_activity(request_id);

DROP TRIGGER IF EXISTS trigger_approval_activity_updated_at ON public.approval_activity;
CREATE TRIGGER trigger_approval_activity_updated_at
    BEFORE UPDATE ON public.approval_activity
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.approval_activity IS
  'Avisos del motor de aprobaciones para cada persona. Los muestran la agenda y la campana del panel.';

-- ════════════════════════════════════════════════════════════════════════════
-- 9e. Plantillas de solicitud (por persona o de la empresa) y recurrencia
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.approval_request_template (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    -- NULL = plantilla de la empresa (la administra owner/admin)
    owner_partner_id   UUID REFERENCES public.partner(id) ON DELETE CASCADE,
    name               VARCHAR(160) NOT NULL,
    category_id        UUID NOT NULL REFERENCES public.approval_category(id) ON DELETE CASCADE,
    -- {title, description, amount, currency, priority, field_values, lines[], assigned_approval_manager_id}
    payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Recurrencia opcional: crea un borrador cada periodo para el dueño de la plantilla
    recurrence         VARCHAR(10),
    next_run_on        DATE,
    active             BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT approval_request_template_recurrence_chk CHECK (
        recurrence IS NULL OR (recurrence IN ('weekly', 'monthly') AND owner_partner_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_approval_request_template_company ON public.approval_request_template(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_template_owner ON public.approval_request_template(owner_partner_id);
CREATE INDEX IF NOT EXISTS idx_approval_request_template_active ON public.approval_request_template(active);

DROP TRIGGER IF EXISTS trigger_approval_request_template_updated_at ON public.approval_request_template;
CREATE TRIGGER trigger_approval_request_template_updated_at
    BEFORE UPDATE ON public.approval_request_template
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
