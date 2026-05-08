-- ============================================================================
-- Migration: Project Management Module (project_type, project, project_task)
-- Multi-tenant project tracking with task control, metrics and progress
-- ============================================================================

-- ============================================================================
-- ENUM types
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE public.project_status AS ENUM (
            'pending',      -- Por iniciar
            'in_progress',  -- En proceso
            'completed',    -- Finalizado
            'paused',       -- En pausa
            'cancelled'     -- Cancelado
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_task_status') THEN
        CREATE TYPE public.project_task_status AS ENUM (
            'pending',      -- Inicio
            'in_progress',  -- En proceso
            'completed',    -- Terminado
            'cancelled'     -- Cancelado
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_priority') THEN
        CREATE TYPE public.project_priority AS ENUM (
            'low',
            'medium',
            'high',
            'urgent'
        );
    END IF;
END $$;

-- ============================================================================
-- Project Type (Catálogo de tipos de proyecto por empresa)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_type (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name VARCHAR(120) NOT NULL,
    code VARCHAR(40) NOT NULL,
    color VARCHAR(20) DEFAULT '#6366F1',
    description TEXT,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (company_id, code)
);

-- ============================================================================
-- Project (Información general del proyecto)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    code VARCHAR(40),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    project_type_id UUID REFERENCES public.project_type(id) ON DELETE SET NULL,
    responsible_partner_id UUID NOT NULL REFERENCES public.partner(id) ON DELETE RESTRICT,

    status public.project_status NOT NULL DEFAULT 'pending',
    priority public.project_priority NOT NULL DEFAULT 'medium',

    start_date DATE,
    end_date_estimated DATE,
    end_date_actual DATE,

    budget_estimated DECIMAL(15, 2) DEFAULT 0.00,
    budget_actual DECIMAL(15, 2) DEFAULT 0.00,

    progress INT DEFAULT 0,

    color VARCHAR(20) DEFAULT '#6366F1',
    notes TEXT,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CHECK (progress BETWEEN 0 AND 100),
    CHECK (budget_estimated >= 0),
    CHECK (
        end_date_estimated IS NULL
        OR start_date IS NULL
        OR end_date_estimated >= start_date
    )
);

-- ============================================================================
-- Project Task (Tareas que pertenecen al proyecto)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,

    code VARCHAR(40),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    status public.project_task_status NOT NULL DEFAULT 'pending',
    priority public.project_priority NOT NULL DEFAULT 'medium',

    responsible_partner_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,

    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,

    estimated_hours DECIMAL(10, 2) DEFAULT 0.00,
    actual_hours DECIMAL(10, 2) DEFAULT 0.00,

    estimated_cost DECIMAL(15, 2) DEFAULT 0.00,
    actual_cost DECIMAL(15, 2) DEFAULT 0.00,

    progress INT DEFAULT 0,
    order_index INT DEFAULT 10,

    notes TEXT,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CHECK (progress BETWEEN 0 AND 100),
    CHECK (estimated_hours >= 0),
    CHECK (actual_hours >= 0),
    CHECK (estimated_cost >= 0),
    CHECK (actual_cost >= 0),
    CHECK (
        due_date IS NULL
        OR start_date IS NULL
        OR due_date >= start_date
    )
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_project_type_company ON public.project_type(company_id);
CREATE INDEX IF NOT EXISTS idx_project_type_active ON public.project_type(active);

CREATE INDEX IF NOT EXISTS idx_project_company ON public.project(company_id);
CREATE INDEX IF NOT EXISTS idx_project_status ON public.project(status);
CREATE INDEX IF NOT EXISTS idx_project_priority ON public.project(priority);
CREATE INDEX IF NOT EXISTS idx_project_responsible ON public.project(responsible_partner_id);
CREATE INDEX IF NOT EXISTS idx_project_type ON public.project(project_type_id);
CREATE INDEX IF NOT EXISTS idx_project_company_status ON public.project(company_id, status);
CREATE INDEX IF NOT EXISTS idx_project_company_active ON public.project(company_id, active);
CREATE INDEX IF NOT EXISTS idx_project_dates ON public.project(start_date, end_date_estimated);
CREATE INDEX IF NOT EXISTS idx_project_code ON public.project(code);

CREATE INDEX IF NOT EXISTS idx_project_task_company ON public.project_task(company_id);
CREATE INDEX IF NOT EXISTS idx_project_task_project ON public.project_task(project_id);
CREATE INDEX IF NOT EXISTS idx_project_task_status ON public.project_task(status);
CREATE INDEX IF NOT EXISTS idx_project_task_priority ON public.project_task(priority);
CREATE INDEX IF NOT EXISTS idx_project_task_responsible ON public.project_task(responsible_partner_id);
CREATE INDEX IF NOT EXISTS idx_project_task_due_date ON public.project_task(due_date);
CREATE INDEX IF NOT EXISTS idx_project_task_project_status ON public.project_task(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_task_order ON public.project_task(project_id, status, order_index);

-- ============================================================================
-- Sequences for code numbering
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.project_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.project_task_seq START 1;

-- ============================================================================
-- Triggers: updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_project_type_updated_at ON public.project_type;
CREATE TRIGGER trigger_project_type_updated_at
    BEFORE UPDATE ON public.project_type
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_project_updated_at ON public.project;
CREATE TRIGGER trigger_project_updated_at
    BEFORE UPDATE ON public.project
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_project_task_updated_at ON public.project_task;
CREATE TRIGGER trigger_project_task_updated_at
    BEFORE UPDATE ON public.project_task
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Auto-generate project code (PRJ-000001)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
        NEW.code = 'PRJ-' || LPAD(nextval('public.project_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_project_code ON public.project;
CREATE TRIGGER trigger_generate_project_code
    BEFORE INSERT ON public.project
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_project_code();

-- ============================================================================
-- Auto-generate task code (TSK-000001) and copy responsible from project
-- ============================================================================
CREATE OR REPLACE FUNCTION public.populate_project_task_defaults()
RETURNS TRIGGER AS $$
DECLARE
    v_project RECORD;
BEGIN
    SELECT id, company_id, responsible_partner_id
    INTO v_project
    FROM public.project
    WHERE id = NEW.project_id;

    IF v_project.id IS NULL THEN
        RAISE EXCEPTION 'Project % not found', NEW.project_id;
    END IF;

    -- Multi-tenant guard: task must belong to the project's company.
    IF NEW.company_id IS NULL THEN
        NEW.company_id = v_project.company_id;
    ELSIF NEW.company_id <> v_project.company_id THEN
        RAISE EXCEPTION 'Project task company mismatch';
    END IF;

    -- Default responsible to project's responsible if not provided.
    IF NEW.responsible_partner_id IS NULL THEN
        NEW.responsible_partner_id = v_project.responsible_partner_id;
    END IF;

    -- Auto-generate task code.
    IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
        NEW.code = 'TSK-' || LPAD(nextval('public.project_task_seq')::TEXT, 6, '0');
    END IF;

    -- If status is 'completed' and progress not explicitly set, push to 100.
    IF NEW.status = 'completed' AND COALESCE(NEW.progress, 0) < 100 THEN
        NEW.progress = 100;
        IF NEW.completed_at IS NULL THEN
            NEW.completed_at = now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_task_defaults ON public.project_task;
CREATE TRIGGER trigger_project_task_defaults
    BEFORE INSERT ON public.project_task
    FOR EACH ROW
    EXECUTE FUNCTION public.populate_project_task_defaults();

-- ============================================================================
-- Handle task status transitions (set completed_at, sync progress)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_project_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        IF NEW.completed_at IS NULL THEN
            NEW.completed_at = now();
        END IF;
        IF COALESCE(NEW.progress, 0) < 100 THEN
            NEW.progress = 100;
        END IF;
    END IF;

    IF NEW.status <> 'completed' AND OLD.status = 'completed' THEN
        NEW.completed_at = NULL;
        IF NEW.progress = 100 THEN
            NEW.progress = 0;
        END IF;
    END IF;

    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
        NEW.active = false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_task_status_change ON public.project_task;
CREATE TRIGGER trigger_project_task_status_change
    BEFORE UPDATE ON public.project_task
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.handle_project_task_status_change();

-- ============================================================================
-- Recompute project metrics (progress + actual budget + actual hours)
-- Called from triggers when tasks change.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recompute_project_metrics(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_tasks INT;
    v_active_tasks INT;
    v_progress_avg NUMERIC;
    v_actual_cost NUMERIC;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE active = true),
        COUNT(*) FILTER (WHERE active = true AND status <> 'cancelled'),
        AVG(progress) FILTER (
            WHERE active = true AND status <> 'cancelled'
        ),
        COALESCE(SUM(actual_cost) FILTER (WHERE active = true), 0)
    INTO v_total_tasks, v_active_tasks, v_progress_avg, v_actual_cost
    FROM public.project_task
    WHERE project_id = p_project_id;

    UPDATE public.project
    SET
        progress = COALESCE(ROUND(v_progress_avg)::INT, 0),
        budget_actual = v_actual_cost,
        updated_at = now()
    WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_project_metrics_after_task_change()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
BEGIN
    v_project_id = COALESCE(NEW.project_id, OLD.project_id);
    PERFORM public.recompute_project_metrics(v_project_id);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_project_metrics ON public.project_task;
CREATE TRIGGER trigger_sync_project_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.project_task
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_project_metrics_after_task_change();

-- ============================================================================
-- Handle project status transitions (auto end_date_actual on completion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        IF NEW.end_date_actual IS NULL THEN
            NEW.end_date_actual = CURRENT_DATE;
        END IF;
        IF COALESCE(NEW.progress, 0) < 100 THEN
            NEW.progress = 100;
        END IF;
    END IF;

    IF NEW.status <> 'completed' AND OLD.status = 'completed' THEN
        NEW.end_date_actual = NULL;
    END IF;

    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
        NEW.active = false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_status_change ON public.project;
CREATE TRIGGER trigger_project_status_change
    BEFORE UPDATE ON public.project
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.handle_project_status_change();

-- ============================================================================
-- Helper RPC: change project status with validations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_project_status(
    p_project_id UUID,
    p_new_status public.project_status
)
RETURNS BOOLEAN AS $$
DECLARE
    v_project RECORD;
BEGIN
    SELECT *
    INTO v_project
    FROM public.project
    WHERE id = p_project_id
    FOR UPDATE;

    IF v_project.id IS NULL THEN
        RAISE EXCEPTION 'Project not found';
    END IF;

    IF v_project.status = p_new_status THEN
        RETURN true;
    END IF;

    UPDATE public.project
    SET status = p_new_status,
        updated_by = auth.uid()
    WHERE id = p_project_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper RPC: change task status (and reflects on parent project)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_project_task_status(
    p_task_id UUID,
    p_new_status public.project_task_status
)
RETURNS BOOLEAN AS $$
DECLARE
    v_task RECORD;
BEGIN
    SELECT *
    INTO v_task
    FROM public.project_task
    WHERE id = p_task_id
    FOR UPDATE;

    IF v_task.id IS NULL THEN
        RAISE EXCEPTION 'Project task not found';
    END IF;

    IF v_task.status = p_new_status THEN
        RETURN true;
    END IF;

    UPDATE public.project_task
    SET status = p_new_status,
        updated_by = auth.uid()
    WHERE id = p_task_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Views
-- ============================================================================
CREATE OR REPLACE VIEW public.v_projects AS
SELECT
    p.*,
    pt.name AS project_type_name,
    pt.color AS project_type_color,
    pt.code AS project_type_code,
    rp.name AS responsible_name,
    rp.display_name AS responsible_display_name,
    rp.email AS responsible_email,
    rp.avatar_url AS responsible_avatar_url,
    (
        SELECT COUNT(*)
        FROM public.project_task t
        WHERE t.project_id = p.id AND t.active = true
    ) AS task_count,
    (
        SELECT COUNT(*)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
          AND t.status = 'pending'
    ) AS task_pending_count,
    (
        SELECT COUNT(*)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
          AND t.status = 'in_progress'
    ) AS task_in_progress_count,
    (
        SELECT COUNT(*)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
          AND t.status = 'completed'
    ) AS task_completed_count,
    (
        SELECT COUNT(*)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
          AND t.status = 'cancelled'
    ) AS task_cancelled_count,
    (
        SELECT COALESCE(SUM(estimated_hours), 0)
        FROM public.project_task t
        WHERE t.project_id = p.id AND t.active = true
    ) AS total_estimated_hours,
    (
        SELECT COALESCE(SUM(actual_hours), 0)
        FROM public.project_task t
        WHERE t.project_id = p.id AND t.active = true
    ) AS total_actual_hours,
    (
        SELECT COUNT(*)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
          AND t.status NOT IN ('completed', 'cancelled')
          AND t.due_date IS NOT NULL
          AND t.due_date < CURRENT_DATE
    ) AS overdue_task_count,
    CASE
        WHEN p.end_date_estimated IS NULL THEN NULL
        ELSE (p.end_date_estimated - CURRENT_DATE)
    END AS days_remaining,
    CASE
        WHEN p.end_date_estimated IS NOT NULL
             AND p.end_date_estimated < CURRENT_DATE
             AND p.status NOT IN ('completed', 'cancelled')
        THEN true
        ELSE false
    END AS is_overdue
FROM public.project p
LEFT JOIN public.project_type pt ON pt.id = p.project_type_id
LEFT JOIN public.partner rp ON rp.id = p.responsible_partner_id;

CREATE OR REPLACE VIEW public.v_project_tasks AS
SELECT
    t.*,
    p.name AS project_name,
    p.code AS project_code,
    p.status AS project_status,
    rp.name AS responsible_name,
    rp.display_name AS responsible_display_name,
    rp.email AS responsible_email,
    rp.avatar_url AS responsible_avatar_url,
    CASE
        WHEN t.due_date IS NULL THEN NULL
        ELSE (t.due_date - CURRENT_DATE)
    END AS days_until_due,
    CASE
        WHEN t.due_date IS NOT NULL
             AND t.due_date < CURRENT_DATE
             AND t.status NOT IN ('completed', 'cancelled')
        THEN true
        ELSE false
    END AS is_overdue
FROM public.project_task t
INNER JOIN public.project p ON p.id = t.project_id
LEFT JOIN public.partner rp ON rp.id = t.responsible_partner_id;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.project_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task ENABLE ROW LEVEL SECURITY;

-- Project Type policies
DROP POLICY IF EXISTS "Users can view company project types" ON public.project_type;
CREATE POLICY "Users can view company project types" ON public.project_type
    FOR SELECT
    USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage company project types" ON public.project_type;
CREATE POLICY "Users can manage company project types" ON public.project_type
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

-- Project policies
DROP POLICY IF EXISTS "Users can view company projects" ON public.project;
CREATE POLICY "Users can view company projects" ON public.project
    FOR SELECT
    USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can create company projects" ON public.project;
CREATE POLICY "Users can create company projects" ON public.project
    FOR INSERT
    WITH CHECK (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can update company projects" ON public.project;
CREATE POLICY "Users can update company projects" ON public.project
    FOR UPDATE
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can delete company projects" ON public.project;
CREATE POLICY "Users can delete company projects" ON public.project
    FOR DELETE
    USING (public.user_belongs_to_company(company_id));

-- Project Task policies (delegated through parent project)
DROP POLICY IF EXISTS "Users can view project tasks" ON public.project_task;
CREATE POLICY "Users can view project tasks" ON public.project_task
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.project p
            WHERE p.id = project_task.project_id
              AND public.user_belongs_to_company(p.company_id)
        )
    );

DROP POLICY IF EXISTS "Users can manage project tasks" ON public.project_task;
CREATE POLICY "Users can manage project tasks" ON public.project_task
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.project p
            WHERE p.id = project_task.project_id
              AND public.user_belongs_to_company(p.company_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.project p
            WHERE p.id = project_task.project_id
              AND public.user_belongs_to_company(p.company_id)
        )
    );

-- ============================================================================
-- Grants
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.set_project_status(UUID, public.project_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_task_status(UUID, public.project_task_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_project_metrics(UUID) TO authenticated;

-- ============================================================================
-- Seed default project types per existing companies (idempotent)
-- ============================================================================
INSERT INTO public.project_type (company_id, name, code, color, description)
SELECT c.id, t.name, t.code, t.color, t.description
FROM public.company c
CROSS JOIN (
    VALUES
        ('Interno', 'INTERNAL', '#6366F1', 'Proyectos internos de la empresa'),
        ('Cliente', 'CLIENT', '#10B981', 'Proyectos para clientes externos'),
        ('Desarrollo', 'DEVELOPMENT', '#F59E0B', 'Proyectos de desarrollo de producto'),
        ('Mantenimiento', 'MAINTENANCE', '#EF4444', 'Proyectos de mantenimiento u operación'),
        ('Marketing', 'MARKETING', '#EC4899', 'Campañas y proyectos de marketing')
) AS t(name, code, color, description)
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.project_type IS 'Catálogo de tipos de proyecto por empresa (multi-tenant)';
COMMENT ON TABLE public.project IS 'Proyectos administrados por empresa con métricas y seguimiento';
COMMENT ON TABLE public.project_task IS 'Tareas de un proyecto con control de etapas y seguimiento';

COMMENT ON COLUMN public.project.status IS 'pending=por iniciar, in_progress=en proceso, completed=finalizado, paused=en pausa, cancelled=cancelado';
COMMENT ON COLUMN public.project.progress IS 'Avance del proyecto 0-100, calculado desde el avance promedio de tareas activas no canceladas';
COMMENT ON COLUMN public.project.budget_actual IS 'Costo real acumulado de tareas activas';
COMMENT ON COLUMN public.project.responsible_partner_id IS 'Partner responsable del proyecto; sirve de default para tareas';

COMMENT ON COLUMN public.project_task.status IS 'pending=inicio, in_progress=en proceso, completed=terminado, cancelled=cancelado';
COMMENT ON COLUMN public.project_task.responsible_partner_id IS 'Por defecto se hereda del responsable del proyecto';

COMMENT ON FUNCTION public.recompute_project_metrics(UUID) IS 'Recalcula progreso y costo real del proyecto a partir de sus tareas';
COMMENT ON FUNCTION public.set_project_status(UUID, public.project_status) IS 'Cambia el estatus del proyecto y dispara los efectos asociados';
COMMENT ON FUNCTION public.set_project_task_status(UUID, public.project_task_status) IS 'Cambia el estatus de una tarea y propaga métricas al proyecto';

COMMENT ON VIEW public.v_projects IS 'Proyectos con responsable, tipo, métricas agregadas y bandera de retraso';
COMMENT ON VIEW public.v_project_tasks IS 'Tareas con datos del proyecto, responsable y bandera de retraso';
