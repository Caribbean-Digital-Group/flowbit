-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  CRM — Tablero Kanban, motivos de pérdida y endurecimiento de seguridad  ║
-- ║                                                                          ║
-- ║  1. crm_lost_reason           — catálogo de motivos de pérdida           ║
-- ║  2. crm_lead_stage            — color, probabilidad y días de estancamiento ║
-- ║  3. crm_lead                  — orden en el tablero, fecha de cambio de  ║
-- ║                                 etapa y motivo de pérdida                ║
-- ║  4. Triggers                  — validación multi-tenant, auto-probabilidad ║
-- ║  5. Historial                 — el cierre perdido registra el motivo     ║
-- ║  6. Vistas                    — v_crm_leads enriquecida + security_invoker ║
-- ║  7. RPCs de siembra           — validan pertenencia a la empresa         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. crm_lost_reason — motivos por los que se pierde una oportunidad
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crm_lost_reason (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name        VARCHAR(120) NOT NULL,
    description TEXT,
    sequence    INTEGER NOT NULL DEFAULT 10,

    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT crm_lost_reason_name_company_unique UNIQUE (company_id, name)
);

COMMENT ON TABLE public.crm_lost_reason IS
    'Catálogo por empresa de motivos por los que una oportunidad CRM se cierra como perdida.';

ALTER TABLE public.crm_lost_reason ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company crm lost reasons" ON public.crm_lost_reason;
CREATE POLICY "Users can view company crm lost reasons" ON public.crm_lost_reason
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage company crm lost reasons" ON public.crm_lost_reason;
CREATE POLICY "Users can manage company crm lost reasons" ON public.crm_lost_reason
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

DROP TRIGGER IF EXISTS update_crm_lost_reason_updated_at ON public.crm_lost_reason;
CREATE TRIGGER update_crm_lost_reason_updated_at
    BEFORE UPDATE ON public.crm_lost_reason
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_crm_lost_reason_company ON public.crm_lost_reason(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_lost_reason_active  ON public.crm_lost_reason(active);

-- ═══════════════════════════════════════════════════════════════════
-- 2. crm_lead_stage — atributos visuales y de pronóstico
--
-- color         → token de la paleta del tablero (ver app/utils/crm.ts)
-- probability   → probabilidad que se asigna al lead al entrar a la etapa
-- rotting_days  → días sin cambio de etapa tras los cuales el lead se
--                 marca como «estancado» en el tablero
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.crm_lead_stage
    ADD COLUMN IF NOT EXISTS color        VARCHAR(20) NOT NULL DEFAULT 'indigo',
    ADD COLUMN IF NOT EXISTS probability  INTEGER,
    ADD COLUMN IF NOT EXISTS rotting_days INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_lead_stage_color_check') THEN
        ALTER TABLE public.crm_lead_stage
            ADD CONSTRAINT crm_lead_stage_color_check
            CHECK (color IN ('slate', 'sky', 'indigo', 'violet', 'fuchsia', 'rose', 'amber', 'emerald', 'teal'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_lead_stage_probability_check') THEN
        ALTER TABLE public.crm_lead_stage
            ADD CONSTRAINT crm_lead_stage_probability_check
            CHECK (probability IS NULL OR probability BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_lead_stage_rotting_days_check') THEN
        ALTER TABLE public.crm_lead_stage
            ADD CONSTRAINT crm_lead_stage_rotting_days_check
            CHECK (rotting_days IS NULL OR rotting_days > 0);
    END IF;

    -- Una etapa no puede ser ganada y perdida a la vez. NOT VALID para no
    -- bloquear la migración si existiera un dato previo inconsistente.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_lead_stage_closing_type_check') THEN
        ALTER TABLE public.crm_lead_stage
            ADD CONSTRAINT crm_lead_stage_closing_type_check
            CHECK (NOT (is_won AND is_lost)) NOT VALID;
    END IF;
END $$;

-- Valores iniciales razonables para etapas existentes
UPDATE public.crm_lead_stage SET color = 'emerald', probability = 100 WHERE is_won  AND probability IS NULL;
UPDATE public.crm_lead_stage SET color = 'rose',    probability = 0   WHERE is_lost AND probability IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. crm_lead — columnas para el tablero y el cierre perdido
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.crm_lead
    ADD COLUMN IF NOT EXISTS kanban_sequence  DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS lost_reason_id   UUID REFERENCES public.crm_lost_reason(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lost_notes       TEXT;

COMMENT ON COLUMN public.crm_lead.kanban_sequence  IS 'Posición de la tarjeta dentro de su columna (orden ascendente, admite fracciones).';
COMMENT ON COLUMN public.crm_lead.stage_changed_at IS 'Última vez que el lead cambió de etapa; base del indicador de estancamiento.';

-- Backfill sin disparar triggers (no alterar updated_at ni el historial)
ALTER TABLE public.crm_lead DISABLE TRIGGER USER;

UPDATE public.crm_lead l
SET stage_changed_at = COALESCE(
    (
        SELECT MAX(h.created_at)
        FROM public.crm_history h
        WHERE h.lead_id = l.id
          AND h.event IN ('stage_changed', 'closed_won', 'closed_lost', 'reopened')
    ),
    l.created_at
);

UPDATE public.crm_lead l
SET kanban_sequence = ranked.seq
FROM (
    SELECT id, (ROW_NUMBER() OVER (PARTITION BY stage_id ORDER BY created_at DESC) * 1000)::DOUBLE PRECISION AS seq
    FROM public.crm_lead
) ranked
WHERE ranked.id = l.id;

ALTER TABLE public.crm_lead ENABLE TRIGGER USER;

CREATE INDEX IF NOT EXISTS idx_crm_lead_kanban      ON public.crm_lead(company_id, stage_id, kanban_sequence);
CREATE INDEX IF NOT EXISTS idx_crm_lead_lost_reason ON public.crm_lead(lost_reason_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4. Triggers de crm_lead
-- ═══════════════════════════════════════════════════════════════════

-- 4.1 Número consecutivo sin condición de carrera entre inserciones
--     concurrentes de la misma empresa.
CREATE OR REPLACE FUNCTION public.assign_crm_lead_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('crm_lead_number:' || NEW.company_id::TEXT));

    NEW.lead_number := (
        SELECT COALESCE(MAX(lead_number), 0) + 1
        FROM public.crm_lead
        WHERE company_id = NEW.company_id
    );
    RETURN NEW;
END;
$$;

-- 4.2 Validación multi-tenant de referencias y valores de inserción.
--     Etapa y motivo de pérdida deben pertenecer a la misma empresa.
CREATE OR REPLACE FUNCTION public.validate_crm_lead_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.crm_lead_stage
            WHERE id = NEW.stage_id AND company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'La etapa no pertenece a la empresa del lead'
                USING ERRCODE = '23503';
        END IF;
    END IF;

    IF NEW.lost_reason_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.lost_reason_id IS DISTINCT FROM OLD.lost_reason_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.crm_lost_reason
            WHERE id = NEW.lost_reason_id AND company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'El motivo de pérdida no pertenece a la empresa del lead'
                USING ERRCODE = '23503';
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.stage_changed_at := now();

        -- 0 = «sin posición»: la tarjeta nueva aparece al inicio de su columna
        IF NEW.kanban_sequence = 0 THEN
            NEW.kanban_sequence := COALESCE((
                SELECT MIN(kanban_sequence)
                FROM public.crm_lead
                WHERE stage_id = NEW.stage_id AND active = TRUE
            ), 1000) - 1000;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_crm_lead_validate_refs ON public.crm_lead;
CREATE TRIGGER trigger_crm_lead_validate_refs
    BEFORE INSERT OR UPDATE ON public.crm_lead
    FOR EACH ROW EXECUTE FUNCTION public.validate_crm_lead_refs();

-- 4.3 Transición de etapa: fecha de cierre, fecha de cambio,
--     probabilidad por defecto y limpieza del motivo de pérdida.
CREATE OR REPLACE FUNCTION public.handle_crm_lead_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_new_stage RECORD;
    v_old_stage RECORD;
BEGIN
    SELECT is_won, is_lost, probability INTO v_new_stage
    FROM public.crm_lead_stage WHERE id = NEW.stage_id;

    SELECT is_won, is_lost INTO v_old_stage
    FROM public.crm_lead_stage WHERE id = OLD.stage_id;

    NEW.stage_changed_at := now();

    IF (v_new_stage.is_won OR v_new_stage.is_lost)
       AND NOT (v_old_stage.is_won OR v_old_stage.is_lost) THEN
        NEW.actual_close_date := CURRENT_DATE;
    END IF;

    IF NOT (v_new_stage.is_won OR v_new_stage.is_lost)
       AND (v_old_stage.is_won OR v_old_stage.is_lost) THEN
        NEW.actual_close_date := NULL;
    END IF;

    -- Solo fuera de una etapa perdida se descarta el motivo
    IF NOT v_new_stage.is_lost THEN
        NEW.lost_reason_id := NULL;
        NEW.lost_notes     := NULL;
    END IF;

    -- La probabilidad de la etapa aplica salvo que el mismo UPDATE la fije
    IF v_new_stage.probability IS NOT NULL
       AND NEW.probability IS NOT DISTINCT FROM OLD.probability THEN
        NEW.probability := v_new_stage.probability;
    END IF;

    RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Historial — el cierre perdido documenta el motivo en `notes`
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.append_crm_lead_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_stage_name TEXT;
    v_new_stage      RECORD;
    v_notes          TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.crm_history(lead_id, event, new_value, created_by)
        VALUES (NEW.id, 'created', NEW.name, NEW.created_by);
        RETURN NEW;
    END IF;

    -- Stage change
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        SELECT name INTO v_old_stage_name
        FROM public.crm_lead_stage WHERE id = OLD.stage_id;

        SELECT name, is_won, is_lost INTO v_new_stage
        FROM public.crm_lead_stage WHERE id = NEW.stage_id;

        v_notes := NULL;
        IF v_new_stage.is_lost THEN
            v_notes := NULLIF(CONCAT_WS(' — ',
                (SELECT name FROM public.crm_lost_reason WHERE id = NEW.lost_reason_id),
                NULLIF(TRIM(NEW.lost_notes), '')
            ), '');
        END IF;

        INSERT INTO public.crm_history(lead_id, event, old_value, new_value, notes, created_by)
        VALUES (
            NEW.id,
            CASE
                WHEN v_new_stage.is_won  THEN 'closed_won'
                WHEN v_new_stage.is_lost THEN 'closed_lost'
                WHEN (
                    SELECT is_won OR is_lost
                    FROM public.crm_lead_stage
                    WHERE id = OLD.stage_id
                ) THEN 'reopened'
                ELSE 'stage_changed'
            END::public.crm_history_event,
            v_old_stage_name,
            v_new_stage.name,
            v_notes,
            NEW.updated_by
        );
    END IF;

    -- Responsible change
    IF OLD.responsible_partner_id IS DISTINCT FROM NEW.responsible_partner_id THEN
        INSERT INTO public.crm_history(lead_id, event, old_value, new_value, created_by)
        VALUES (
            NEW.id,
            'responsible_changed',
            (SELECT COALESCE(display_name, name) FROM public.partner WHERE id = OLD.responsible_partner_id),
            (SELECT COALESCE(display_name, name) FROM public.partner WHERE id = NEW.responsible_partner_id),
            NEW.updated_by
        );
    END IF;

    -- Priority change
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO public.crm_history(lead_id, event, old_value, new_value, created_by)
        VALUES (NEW.id, 'priority_changed', OLD.priority::TEXT, NEW.priority::TEXT, NEW.updated_by);
    END IF;

    RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Vistas
--
-- Las vistas CRM se crearon sin security_invoker: se ejecutaban con
-- los privilegios del dueño y omitían el RLS de las tablas base, de
-- modo que cualquier sesión podía leer leads de otras empresas
-- consultando la vista sin filtro. Se corrige aquí.
--
-- v_crm_leads se recrea (DROP) porque `l.*` agrega columnas nuevas en
-- medio de la lista y CREATE OR REPLACE no permite reordenarlas.
-- ═══════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.v_crm_leads;

CREATE VIEW public.v_crm_leads
WITH (security_invoker = true)
AS
SELECT
    l.*,
    s.name                               AS stage_name,
    s.sequence                           AS stage_sequence,
    s.color                              AS stage_color,
    s.probability                        AS stage_probability,
    s.rotting_days                       AS stage_rotting_days,
    s.is_won,
    s.is_lost,
    p.name                               AS partner_name,
    COALESCE(p.display_name, p.name)     AS partner_display_name,
    rp.name                              AS responsible_name,
    COALESCE(rp.display_name, rp.name)   AS responsible_display_name,
    lr.name                              AS lost_reason_name,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.crm_lead_order lo
        WHERE lo.lead_id = l.id
    )                                    AS order_count,
    (
        SELECT COALESCE(SUM(o.amount_total), 0)
        FROM public.crm_lead_order lo
        JOIN public."order" o ON o.id = lo.order_id
        WHERE lo.lead_id = l.id
    )                                    AS orders_total,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.crm_activity a
        WHERE a.lead_id = l.id AND a.active = TRUE
          AND a.status <> 'done'
    )                                    AS open_activity_count,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.crm_activity a
        WHERE a.lead_id = l.id AND a.active = TRUE
          AND a.status = 'pending'
          AND a.scheduled_at IS NOT NULL
          AND a.scheduled_at < now()
    )                                    AS overdue_activity_count,
    na.id                                AS next_activity_id,
    na.title                             AS next_activity_title,
    na.type                              AS next_activity_type,
    na.scheduled_at                      AS next_activity_at,
    GREATEST(0, CURRENT_DATE - (l.stage_changed_at AT TIME ZONE 'UTC')::DATE)::INTEGER
                                         AS days_in_stage,
    (
        s.rotting_days IS NOT NULL
        AND NOT (s.is_won OR s.is_lost)
        AND l.stage_changed_at < now() - make_interval(days => s.rotting_days)
    )                                    AS is_rotting
FROM public.crm_lead l
LEFT JOIN public.crm_lead_stage s   ON s.id = l.stage_id
LEFT JOIN public.partner p          ON p.id = l.partner_id
LEFT JOIN public.partner rp         ON rp.id = l.responsible_partner_id
LEFT JOIN public.crm_lost_reason lr ON lr.id = l.lost_reason_id
LEFT JOIN LATERAL (
    SELECT a.id, a.title, a.type, a.scheduled_at
    FROM public.crm_activity a
    WHERE a.lead_id = l.id
      AND a.active = TRUE
      AND a.status <> 'done'
      AND a.scheduled_at IS NOT NULL
    ORDER BY a.scheduled_at ASC
    LIMIT 1
) na ON TRUE;

COMMENT ON VIEW public.v_crm_leads IS
    'Leads con etapa, contacto, responsable, próxima actividad e indicadores del tablero Kanban.';

ALTER VIEW public.v_crm_activities SET (security_invoker = true);
ALTER VIEW public.v_crm_history    SET (security_invoker = true);

REVOKE ALL ON public.v_crm_leads      FROM anon;
REVOKE ALL ON public.v_crm_activities FROM anon;
REVOKE ALL ON public.v_crm_history    FROM anon;
GRANT SELECT ON public.v_crm_leads TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 7. RPCs de siembra
--
-- seed_crm_stages era SECURITY DEFINER sin validar la empresa: cualquier
-- sesión (incluida anon) podía insertar etapas en otra empresa.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.seed_crm_lost_reasons(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.crm_lost_reason(company_id, name, sequence, description, created_by, updated_by)
    VALUES
        (p_company_id, 'Precio fuera de presupuesto', 10, 'El prospecto consideró la propuesta demasiado cara.', auth.uid(), auth.uid()),
        (p_company_id, 'Eligió a la competencia',     20, 'El prospecto contrató a otro proveedor.',              auth.uid(), auth.uid()),
        (p_company_id, 'Sin respuesta',               30, 'El prospecto dejó de responder al seguimiento.',       auth.uid(), auth.uid()),
        (p_company_id, 'Necesidad no calificada',     40, 'Nuestra oferta no resuelve lo que el prospecto necesita.', auth.uid(), auth.uid()),
        (p_company_id, 'Proyecto pospuesto',          50, 'El prospecto aplazó la decisión sin fecha.',            auth.uid(), auth.uid()),
        (p_company_id, 'Otro',                        90, NULL,                                                   auth.uid(), auth.uid())
    ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_crm_stages(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.crm_lead_stage(company_id, name, sequence, is_won, is_lost, color, probability, rotting_days, created_by, updated_by)
    VALUES
        (p_company_id, 'Nuevo',       10, FALSE, FALSE, 'sky',     10,  5,    auth.uid(), auth.uid()),
        (p_company_id, 'Calificado',  20, FALSE, FALSE, 'indigo',  30,  10,   auth.uid(), auth.uid()),
        (p_company_id, 'Propuesta',   30, FALSE, FALSE, 'violet',  60,  14,   auth.uid(), auth.uid()),
        (p_company_id, 'Negociación', 35, FALSE, FALSE, 'amber',   80,  14,   auth.uid(), auth.uid()),
        (p_company_id, 'Ganado',      40, TRUE,  FALSE, 'emerald', 100, NULL, auth.uid(), auth.uid()),
        (p_company_id, 'Cancelado',   50, FALSE, TRUE,  'rose',    0,   NULL, auth.uid(), auth.uid())
    ON CONFLICT (company_id, name) DO NOTHING;

    PERFORM public.seed_crm_lost_reasons(p_company_id);
END;
$$;

-- Default privileges del proyecto otorgan EXECUTE a anon: revocar explícito
REVOKE EXECUTE ON FUNCTION public.seed_crm_stages(UUID)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_crm_lost_reasons(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seed_crm_stages(UUID)       TO authenticated;
GRANT  EXECUTE ON FUNCTION public.seed_crm_lost_reasons(UUID) TO authenticated;
