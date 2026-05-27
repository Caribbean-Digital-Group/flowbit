-- ============================================================================
-- Migration: CRM Module (Leads & Opportunities)
-- Gestión del ciclo completo de un lead: captación → cierre
-- Módulos: etapas del pipeline, leads, actividades de seguimiento, historial
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_lead_priority') THEN
        CREATE TYPE public.crm_lead_priority AS ENUM ('low', 'medium', 'high');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_lead_origin') THEN
        CREATE TYPE public.crm_lead_origin AS ENUM (
            'web',
            'referral',
            'campaign',
            'call',
            'email',
            'event',
            'other'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_activity_type') THEN
        CREATE TYPE public.crm_activity_type AS ENUM (
            'call',
            'meeting',
            'email',
            'demo',
            'followup',
            'task'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_activity_status') THEN
        CREATE TYPE public.crm_activity_status AS ENUM ('pending', 'done', 'overdue');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_history_event') THEN
        CREATE TYPE public.crm_history_event AS ENUM (
            'created',
            'stage_changed',
            'responsible_changed',
            'order_linked',
            'order_unlinked',
            'priority_changed',
            'closed_won',
            'closed_lost',
            'reopened'
        );
    END IF;
END $$;

-- ============================================================================
-- PIPELINE STAGES (Etapas del pipeline de ventas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_stage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name        VARCHAR(100) NOT NULL,
    sequence    INTEGER NOT NULL DEFAULT 10,
    description TEXT,
    is_won      BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost     BOOLEAN NOT NULL DEFAULT FALSE,

    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT crm_lead_stage_name_company_unique UNIQUE (company_id, name)
);

-- ============================================================================
-- LEADS / OPPORTUNITIES
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.crm_lead_number_seq;

CREATE TABLE IF NOT EXISTS public.crm_lead (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    lead_number            INTEGER,
    name                   VARCHAR(255) NOT NULL,

    partner_id             UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    contact_name           VARCHAR(200),
    contact_email          VARCHAR(200),
    contact_phone          VARCHAR(50),
    contact_company        VARCHAR(200),

    origin                 public.crm_lead_origin NOT NULL DEFAULT 'other',
    responsible_partner_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,

    expected_close_date    DATE,
    actual_close_date      DATE,

    amount                 NUMERIC(15, 2),
    currency               VARCHAR(3) NOT NULL DEFAULT 'MXN',
    probability            INTEGER NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),

    description            TEXT,
    stage_id               UUID NOT NULL REFERENCES public.crm_lead_stage(id) ON DELETE RESTRICT,
    priority               public.crm_lead_priority NOT NULL DEFAULT 'medium',
    tags                   TEXT[] NOT NULL DEFAULT '{}',

    active                 BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- LEAD — SALES ORDER LINK (una orden solo puede pertenecer a un lead)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_order (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id    UUID NOT NULL REFERENCES public.crm_lead(id) ON DELETE CASCADE,
    order_id   UUID NOT NULL REFERENCES public."order"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (order_id)
);

-- ============================================================================
-- FOLLOW-UP ACTIVITIES (Actividades de seguimiento)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_activity (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    lead_id                UUID NOT NULL REFERENCES public.crm_lead(id) ON DELETE CASCADE,

    type                   public.crm_activity_type NOT NULL DEFAULT 'task',
    title                  VARCHAR(255) NOT NULL,
    scheduled_at           TIMESTAMPTZ,
    responsible_partner_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    status                 public.crm_activity_status NOT NULL DEFAULT 'pending',
    notes                  TEXT,
    done_at                TIMESTAMPTZ,

    active                 BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- HISTORY / AUDIT TRAIL (read-only, append-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id    UUID NOT NULL REFERENCES public.crm_lead(id) ON DELETE CASCADE,

    event      public.crm_history_event NOT NULL,
    old_value  TEXT,
    new_value  TEXT,
    notes      TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_crm_lead_stage_company  ON public.crm_lead_stage(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_stage_active   ON public.crm_lead_stage(active);
CREATE INDEX IF NOT EXISTS idx_crm_lead_company        ON public.crm_lead(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_stage          ON public.crm_lead(stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_partner        ON public.crm_lead(partner_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_responsible    ON public.crm_lead(responsible_partner_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_active         ON public.crm_lead(active);
CREATE INDEX IF NOT EXISTS idx_crm_lead_order_lead     ON public.crm_lead_order(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_lead       ON public.crm_activity(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_company    ON public.crm_activity(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_active     ON public.crm_activity(active);
CREATE INDEX IF NOT EXISTS idx_crm_history_lead        ON public.crm_history(lead_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_crm_lead_stage_updated_at ON public.crm_lead_stage;
CREATE TRIGGER trigger_crm_lead_stage_updated_at
    BEFORE UPDATE ON public.crm_lead_stage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_crm_lead_updated_at ON public.crm_lead;
CREATE TRIGGER trigger_crm_lead_updated_at
    BEFORE UPDATE ON public.crm_lead
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_crm_activity_updated_at ON public.crm_activity;
CREATE TRIGGER trigger_crm_activity_updated_at
    BEFORE UPDATE ON public.crm_activity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTO-ASSIGN lead_number per company (sequential)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_crm_lead_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.lead_number := (
        SELECT COALESCE(MAX(lead_number), 0) + 1
        FROM public.crm_lead
        WHERE company_id = NEW.company_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crm_lead_number ON public.crm_lead;
CREATE TRIGGER trigger_crm_lead_number
    BEFORE INSERT ON public.crm_lead
    FOR EACH ROW EXECUTE FUNCTION public.assign_crm_lead_number();

-- ============================================================================
-- STAGE TRANSITION HANDLER
-- Sets actual_close_date when moving to a won/lost stage.
-- Clears actual_close_date when reopening.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_crm_lead_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    v_new_stage RECORD;
    v_old_stage RECORD;
BEGIN
    SELECT is_won, is_lost INTO v_new_stage
    FROM public.crm_lead_stage WHERE id = NEW.stage_id;

    SELECT is_won, is_lost INTO v_old_stage
    FROM public.crm_lead_stage WHERE id = OLD.stage_id;

    IF (v_new_stage.is_won OR v_new_stage.is_lost)
       AND NOT (v_old_stage.is_won OR v_old_stage.is_lost) THEN
        NEW.actual_close_date := CURRENT_DATE;
    END IF;

    IF NOT (v_new_stage.is_won OR v_new_stage.is_lost)
       AND (v_old_stage.is_won OR v_old_stage.is_lost) THEN
        NEW.actual_close_date := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crm_lead_stage_change ON public.crm_lead;
CREATE TRIGGER trigger_crm_lead_stage_change
    BEFORE UPDATE ON public.crm_lead
    FOR EACH ROW
    WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
    EXECUTE FUNCTION public.handle_crm_lead_stage_change();

-- ============================================================================
-- HISTORY TRIGGERS — auto-append events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.append_crm_lead_history()
RETURNS TRIGGER AS $$
DECLARE
    v_old_stage_name TEXT;
    v_new_stage_name TEXT;
    v_old_priority   TEXT;
    v_new_priority   TEXT;
    v_new_stage      RECORD;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.crm_history(lead_id, event, new_value, created_by)
        VALUES (NEW.id, 'created', NEW.name, NEW.created_by);
        RETURN NEW;
    END IF;

    -- Stage change
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        SELECT name INTO v_old_stage_name FROM public.crm_lead_stage WHERE id = OLD.stage_id;
        SELECT name, is_won, is_lost INTO v_new_stage FROM public.crm_lead_stage WHERE id = NEW.stage_id;
        v_new_stage_name := v_new_stage.name;

        INSERT INTO public.crm_history(lead_id, event, old_value, new_value, created_by)
        VALUES (
            NEW.id,
            CASE
                WHEN v_new_stage.is_won  THEN 'closed_won'
                WHEN v_new_stage.is_lost THEN 'closed_lost'
                WHEN (SELECT is_won OR is_lost FROM public.crm_lead_stage WHERE id = OLD.stage_id) THEN 'reopened'
                ELSE 'stage_changed'
            END,
            v_old_stage_name,
            v_new_stage_name,
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crm_lead_history ON public.crm_lead;
CREATE TRIGGER trigger_crm_lead_history
    AFTER INSERT OR UPDATE ON public.crm_lead
    FOR EACH ROW EXECUTE FUNCTION public.append_crm_lead_history();

-- History trigger for order link/unlink
CREATE OR REPLACE FUNCTION public.append_crm_lead_order_history()
RETURNS TRIGGER AS $$
DECLARE
    v_order_ref TEXT;
BEGIN
    SELECT COALESCE(name, id::TEXT) INTO v_order_ref
    FROM public."order" WHERE id = COALESCE(NEW.order_id, OLD.order_id);

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.crm_history(lead_id, event, new_value, created_by)
        VALUES (NEW.lead_id, 'order_linked', v_order_ref, NEW.created_by);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.crm_history(lead_id, event, old_value, created_by)
        VALUES (OLD.lead_id, 'order_unlinked', v_order_ref, auth.uid());
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crm_lead_order_history ON public.crm_lead_order;
CREATE TRIGGER trigger_crm_lead_order_history
    AFTER INSERT OR DELETE ON public.crm_lead_order
    FOR EACH ROW EXECUTE FUNCTION public.append_crm_lead_order_history();

-- ============================================================================
-- RPC: seed default pipeline stages for a company
-- ============================================================================
CREATE OR REPLACE FUNCTION public.seed_crm_stages(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.crm_lead_stage(company_id, name, sequence, is_won, is_lost)
    VALUES
        (p_company_id, 'Nuevo',      10, FALSE, FALSE),
        (p_company_id, 'Calificado', 20, FALSE, FALSE),
        (p_company_id, 'Propuesta',  30, FALSE, FALSE),
        (p_company_id, 'Ganado',     40, TRUE,  FALSE),
        (p_company_id, 'Cancelado',  50, FALSE, TRUE)
    ON CONFLICT (company_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW public.v_crm_leads AS
SELECT
    l.*,
    s.name                               AS stage_name,
    s.sequence                           AS stage_sequence,
    s.is_won,
    s.is_lost,
    p.name                               AS partner_name,
    COALESCE(p.display_name, p.name)     AS partner_display_name,
    rp.name                              AS responsible_name,
    COALESCE(rp.display_name, rp.name)   AS responsible_display_name,
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
    )                                    AS overdue_activity_count
FROM public.crm_lead l
LEFT JOIN public.crm_lead_stage s  ON s.id = l.stage_id
LEFT JOIN public.partner p         ON p.id = l.partner_id
LEFT JOIN public.partner rp        ON rp.id = l.responsible_partner_id;

CREATE OR REPLACE VIEW public.v_crm_activities AS
SELECT
    a.*,
    l.name                               AS lead_name,
    l.lead_number,
    l.company_id                         AS lead_company_id,
    rp.name                              AS responsible_name,
    COALESCE(rp.display_name, rp.name)   AS responsible_display_name,
    CASE
        WHEN a.status = 'done' THEN 'done'
        WHEN a.scheduled_at IS NOT NULL
             AND a.scheduled_at < now()
             AND a.status = 'pending' THEN 'overdue'
        ELSE 'pending'
    END                                  AS computed_status
FROM public.crm_activity a
LEFT JOIN public.crm_lead l    ON l.id = a.lead_id
LEFT JOIN public.partner rp    ON rp.id = a.responsible_partner_id;

CREATE OR REPLACE VIEW public.v_crm_history AS
SELECT
    h.*,
    l.name       AS lead_name,
    l.company_id AS lead_company_id,
    COALESCE(p.display_name, p.name) AS created_by_display_name
FROM public.crm_history h
LEFT JOIN public.crm_lead l    ON l.id = h.lead_id
LEFT JOIN public.partner p     ON p.user_id = h.created_by;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.crm_lead_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_history    ENABLE ROW LEVEL SECURITY;

-- crm_lead_stage
DROP POLICY IF EXISTS "Users can view company crm stages" ON public.crm_lead_stage;
CREATE POLICY "Users can view company crm stages" ON public.crm_lead_stage
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage company crm stages" ON public.crm_lead_stage;
CREATE POLICY "Users can manage company crm stages" ON public.crm_lead_stage
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

-- crm_lead
DROP POLICY IF EXISTS "Users can view company crm leads" ON public.crm_lead;
CREATE POLICY "Users can view company crm leads" ON public.crm_lead
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage company crm leads" ON public.crm_lead;
CREATE POLICY "Users can manage company crm leads" ON public.crm_lead
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

-- crm_lead_order (delegated through parent lead's company)
DROP POLICY IF EXISTS "Users can view crm lead orders" ON public.crm_lead_order;
CREATE POLICY "Users can view crm lead orders" ON public.crm_lead_order
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.crm_lead l
            WHERE l.id = crm_lead_order.lead_id
              AND public.user_belongs_to_company(l.company_id)
        )
    );

DROP POLICY IF EXISTS "Users can manage crm lead orders" ON public.crm_lead_order;
CREATE POLICY "Users can manage crm lead orders" ON public.crm_lead_order
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.crm_lead l
            WHERE l.id = crm_lead_order.lead_id
              AND public.user_belongs_to_company(l.company_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.crm_lead l
            WHERE l.id = crm_lead_order.lead_id
              AND public.user_belongs_to_company(l.company_id)
        )
    );

-- crm_activity
DROP POLICY IF EXISTS "Users can view company crm activities" ON public.crm_activity;
CREATE POLICY "Users can view company crm activities" ON public.crm_activity
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage company crm activities" ON public.crm_activity;
CREATE POLICY "Users can manage company crm activities" ON public.crm_activity
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

-- crm_history (append-only via triggers; users can only read)
DROP POLICY IF EXISTS "Users can view crm history" ON public.crm_history;
CREATE POLICY "Users can view crm history" ON public.crm_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.crm_lead l
            WHERE l.id = crm_history.lead_id
              AND public.user_belongs_to_company(l.company_id)
        )
    );
