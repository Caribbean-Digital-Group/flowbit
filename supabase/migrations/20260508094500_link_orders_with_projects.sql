-- ============================================================================
-- Migration: Link orders with projects and aggregate financial totals
-- ============================================================================

ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS requisition_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_amount NUMERIC(15, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.order
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.project(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_project_id ON public.order(project_id);
CREATE INDEX IF NOT EXISTS idx_order_company_project ON public.order(company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_order_project_posted ON public.order(project_id, order_state)
  WHERE order_state = 'posted';

CREATE OR REPLACE FUNCTION public.recompute_project_order_amounts(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_company UUID;
BEGIN
  SELECT company_id
  INTO v_project_company
  FROM public.project
  WHERE id = p_project_id;

  IF v_project_company IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.project p
  SET
    requisition_amount = COALESCE((
      SELECT SUM(o.amount_total)
      FROM public.order o
      WHERE o.project_id = p_project_id
        AND o.company_id = v_project_company
        AND o.order_type = 'purchase'
        AND o.order_state = 'posted'
    ), 0),
    income_amount = COALESCE((
      SELECT SUM(o.amount_total)
      FROM public.order o
      WHERE o.project_id = p_project_id
        AND o.company_id = v_project_company
        AND o.order_type = 'sale'
        AND o.order_state = 'posted'
    ), 0),
    updated_at = now()
  WHERE p.id = p_project_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_project_order_amounts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN
      PERFORM public.recompute_project_order_amounts(OLD.project_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.project_id IS NOT NULL THEN
    PERFORM public.recompute_project_order_amounts(NEW.project_id);
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.project_id IS DISTINCT FROM NEW.project_id
    AND OLD.project_id IS NOT NULL
  THEN
    PERFORM public.recompute_project_order_amounts(OLD.project_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_order_amounts ON public.order;
CREATE TRIGGER trigger_project_order_amounts
  AFTER INSERT OR UPDATE OR DELETE ON public.order
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_order_amounts();

UPDATE public.project p
SET
  requisition_amount = COALESCE(agg.purchase_total, 0),
  income_amount = COALESCE(agg.sale_total, 0)
FROM (
  SELECT
    o.project_id,
    SUM(CASE WHEN o.order_type = 'purchase' AND o.order_state = 'posted' THEN o.amount_total ELSE 0 END) AS purchase_total,
    SUM(CASE WHEN o.order_type = 'sale' AND o.order_state = 'posted' THEN o.amount_total ELSE 0 END) AS sale_total
  FROM public.order o
  WHERE o.project_id IS NOT NULL
  GROUP BY o.project_id
) agg
WHERE agg.project_id = p.id;

-- REPLACE VIEW falta cuando o.* cambia de columnas y el ordinal ya no coincide (42P16).
DROP VIEW IF EXISTS public.v_orders CASCADE;

CREATE VIEW public.v_orders AS
SELECT
  o.*,
  p.name AS partner_name,
  p.email AS partner_email,
  p.vat AS partner_vat,
  cbp.name AS created_by_partner_name,
  c.name AS company_name,
  c.currency AS company_currency,
  pr.name AS project_name,
  pr.code AS project_code,
  (SELECT COUNT(*) FROM public.order_line ol WHERE ol.order_id = o.id) AS line_count
FROM public.order o
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.partner cbp ON cbp.id = o.created_by_partner_id
LEFT JOIN public.company c ON c.id = o.company_id
LEFT JOIN public.project pr ON pr.id = o.project_id;

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

COMMENT ON VIEW public.v_orders IS 'Órdenes con socio, empresa, proyecto resuelto y conteo de líneas';

COMMENT ON VIEW public.v_projects IS 'Proyectos con responsable, tipo, métricas agregadas y bandera de retraso';

COMMENT ON COLUMN public.order.project_id IS 'Proyecto relacionado para trazabilidad de compras/ventas';
COMMENT ON COLUMN public.project.requisition_amount IS 'Monto de requisiciones confirmadas (órdenes de compra posted)';
COMMENT ON COLUMN public.project.income_amount IS 'Monto de ingreso confirmado (órdenes de venta posted)';
COMMENT ON FUNCTION public.recompute_project_order_amounts(UUID) IS 'Recalcula montos de compra/venta confirmados por proyecto';
