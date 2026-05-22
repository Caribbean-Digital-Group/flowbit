-- ============================================================================
-- Migration: Public project sharing
-- Adds is_public flag to project + secure RPC that exposes a public summary
-- (no financial data) for sharing via external links.
-- ============================================================================

ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project.is_public IS
  'Si es true, el proyecto puede consultarse mediante el RPC público (sin datos financieros).';

CREATE INDEX IF NOT EXISTS idx_project_is_public
  ON public.project (is_public)
  WHERE is_public = true;

-- ============================================================================
-- Rebuild v_projects so p.* expansion includes the new column
-- ============================================================================
DROP VIEW IF EXISTS public.v_projects CASCADE;

CREATE VIEW public.v_projects AS
SELECT
    p.*,
    pt.name AS project_type_name,
    pt.code AS project_type_code,
    pt.color AS project_type_color,
    rp.name AS responsible_name,
    rp.display_name AS responsible_display_name,
    rp.email AS responsible_email,
    rp.avatar_url AS responsible_avatar_url,
    (
        SELECT COUNT(*)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
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
        SELECT COALESCE(SUM(t.estimated_hours), 0)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
    ) AS total_estimated_hours,
    (
        SELECT COALESCE(SUM(t.actual_hours), 0)
        FROM public.project_task t
        WHERE t.project_id = p.id
          AND t.active = true
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

COMMENT ON VIEW public.v_projects IS
  'Proyectos con responsable, tipo, métricas agregadas y bandera de retraso';

-- ============================================================================
-- Public RPC: returns project summary + tasks for a shared (is_public = true)
-- project. Anyone (anon role) can call it; only public + active projects are
-- exposed, and the payload deliberately omits financial / accounting data.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_public_project_view(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project public.project%ROWTYPE;
    v_type_name TEXT;
    v_type_color TEXT;
    v_responsible_name TEXT;
    v_company_name TEXT;
    v_tasks JSONB;
    v_total_tasks INT;
    v_completed_tasks INT;
    v_in_progress_tasks INT;
    v_pending_tasks INT;
    v_overdue_tasks INT;
BEGIN
    IF p_project_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT *
    INTO v_project
    FROM public.project
    WHERE id = p_project_id
      AND active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_project.is_public IS NOT TRUE THEN
        RETURN jsonb_build_object('status', 'private');
    END IF;

    SELECT pt.name, pt.color
    INTO v_type_name, v_type_color
    FROM public.project_type pt
    WHERE pt.id = v_project.project_type_id;

    SELECT COALESCE(NULLIF(BTRIM(rp.display_name), ''), rp.name)
    INTO v_responsible_name
    FROM public.partner rp
    WHERE rp.id = v_project.responsible_partner_id;

    SELECT c.name
    INTO v_company_name
    FROM public.company c
    WHERE c.id = v_project.company_id;

    SELECT
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'code', t.code,
                'name', t.name,
                'description', t.description,
                'status', t.status,
                'priority', t.priority,
                'start_date', t.start_date,
                'due_date', t.due_date,
                'completed_at', t.completed_at,
                'progress', COALESCE(t.progress, 0),
                'order_index', COALESCE(t.order_index, 10),
                'responsible_name',
                    COALESCE(NULLIF(BTRIM(rp.display_name), ''), rp.name),
                'is_overdue',
                    (t.due_date IS NOT NULL
                     AND t.due_date < CURRENT_DATE
                     AND t.status NOT IN ('completed', 'cancelled'))
            )
            ORDER BY
                t.start_date NULLS LAST,
                t.due_date NULLS LAST,
                t.order_index,
                t.created_at
        ), '[]'::jsonb),
        COUNT(*),
        COUNT(*) FILTER (WHERE t.status = 'completed'),
        COUNT(*) FILTER (WHERE t.status = 'in_progress'),
        COUNT(*) FILTER (WHERE t.status = 'pending'),
        COUNT(*) FILTER (
            WHERE t.due_date IS NOT NULL
              AND t.due_date < CURRENT_DATE
              AND t.status NOT IN ('completed', 'cancelled')
        )
    INTO
        v_tasks,
        v_total_tasks,
        v_completed_tasks,
        v_in_progress_tasks,
        v_pending_tasks,
        v_overdue_tasks
    FROM public.project_task t
    LEFT JOIN public.partner rp ON rp.id = t.responsible_partner_id
    WHERE t.project_id = v_project.id
      AND t.active = true;

    RETURN jsonb_build_object(
        'status', 'public',
        'project', jsonb_build_object(
            'id', v_project.id,
            'code', v_project.code,
            'name', v_project.name,
            'description', v_project.description,
            'status', v_project.status,
            'priority', v_project.priority,
            'start_date', v_project.start_date,
            'end_date_estimated', v_project.end_date_estimated,
            'end_date_actual', v_project.end_date_actual,
            'progress', COALESCE(v_project.progress, 0),
            'color', v_project.color,
            'project_type_name', v_type_name,
            'project_type_color', v_type_color,
            'responsible_name', v_responsible_name,
            'company_name', v_company_name,
            'is_overdue',
                (v_project.end_date_estimated IS NOT NULL
                 AND v_project.end_date_estimated < CURRENT_DATE
                 AND v_project.status NOT IN ('completed', 'cancelled')),
            'updated_at', v_project.updated_at
        ),
        'summary', jsonb_build_object(
            'total_tasks', COALESCE(v_total_tasks, 0),
            'completed_tasks', COALESCE(v_completed_tasks, 0),
            'in_progress_tasks', COALESCE(v_in_progress_tasks, 0),
            'pending_tasks', COALESCE(v_pending_tasks, 0),
            'overdue_tasks', COALESCE(v_overdue_tasks, 0)
        ),
        'tasks', v_tasks
    );
END;
$$;

COMMENT ON FUNCTION public.get_public_project_view(UUID) IS
  'Vista pública de un proyecto (solo si is_public = true). Devuelve datos básicos y tareas, sin información financiera.';

REVOKE ALL ON FUNCTION public.get_public_project_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_project_view(UUID) TO anon, authenticated;
