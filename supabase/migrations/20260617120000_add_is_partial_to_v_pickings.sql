-- Expose picking.is_partial in v_pickings (added in 20260529200000).

DROP VIEW IF EXISTS public.v_picking_lines;
DROP VIEW IF EXISTS public.v_pickings;

CREATE VIEW public.v_pickings AS
SELECT
  p.id,
  p.company_id,
  p.warehouse_id,
  p.order_id,
  p.name,
  p.type,
  p.status,
  p.is_return,
  p.is_partial,
  p.notes,
  p.published_at,
  p.confirmed_at,
  p.cancelled_at,
  p.active,
  p.created_at,
  p.updated_at,
  p.created_by,
  p.updated_by,
  w.name         AS warehouse_name,
  w.code         AS warehouse_code,
  o.name         AS order_name,
  o.order_type,
  o.order_state,
  (
    SELECT COALESCE(SUM(pl.quantity), 0)
    FROM public.picking_line pl
    WHERE pl.picking_id = p.id
      AND pl.active = true
  ) AS total_quantity,
  (
    SELECT COUNT(*)
    FROM public.picking_line pl
    WHERE pl.picking_id = p.id
      AND pl.active = true
  ) AS line_count
FROM public.picking p
LEFT JOIN public.warehouse w ON w.id = p.warehouse_id
LEFT JOIN public.order    o ON o.id = p.order_id;

CREATE VIEW public.v_picking_lines AS
SELECT
  pl.*,
  p.name       AS picking_name,
  p.type       AS picking_type,
  p.status     AS picking_status,
  p.order_id,
  p.warehouse_id,
  o.name       AS order_name,
  pr.name      AS product_name,
  pr.sku       AS product_sku
FROM public.picking_line pl
INNER JOIN public.picking  p  ON p.id  = pl.picking_id
LEFT JOIN  public.order    o  ON o.id  = p.order_id
INNER JOIN public.product  pr ON pr.id = pl.product_id;

COMMENT ON VIEW public.v_pickings IS 'Pickings con almacén, orden y métricas de líneas; incluye is_partial';
