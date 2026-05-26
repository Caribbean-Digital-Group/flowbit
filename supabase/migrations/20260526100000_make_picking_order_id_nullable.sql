-- ============================================================================
-- Migration: Make picking.order_id nullable to allow manual warehouse movements
-- ============================================================================

-- Drop the FK constraint first, then add it back as optional (nullable)
ALTER TABLE public.picking
  DROP CONSTRAINT IF EXISTS picking_order_id_fkey;

-- Remove NOT NULL constraint from order_id
ALTER TABLE public.picking
  ALTER COLUMN order_id DROP NOT NULL;

-- Re-add FK constraint (now nullable)
ALTER TABLE public.picking
  ADD CONSTRAINT picking_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES public.order(id)
    ON DELETE CASCADE;

-- Recreate partial indexes (safe for nullable order_id)
DROP INDEX IF EXISTS public.idx_picking_order;
DROP INDEX IF EXISTS public.idx_picking_order_status;

CREATE INDEX IF NOT EXISTS idx_picking_order
  ON public.picking(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_picking_order_status
  ON public.picking(order_id, status)
  WHERE order_id IS NOT NULL;

-- Allow warehouse_id to be NULL temporarily (trigger will assign default)
ALTER TABLE public.picking
  ALTER COLUMN warehouse_id DROP NOT NULL;

-- Extend the picking name trigger to auto-assign default warehouse when NULL
CREATE OR REPLACE FUNCTION public.generate_picking_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := 'PK-' || LPAD(nextval('public.picking_seq')::TEXT, 6, '0');
  END IF;

  IF NEW.warehouse_id IS NULL THEN
    NEW.warehouse_id := public.get_or_create_default_warehouse(NEW.company_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Recreate views with LEFT JOINs to support pickings without an order
-- Must DROP first because CREATE OR REPLACE cannot remove columns
-- ============================================================================

-- v_picking_lines depends on v_pickings implicitly via picking table; drop in order
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
