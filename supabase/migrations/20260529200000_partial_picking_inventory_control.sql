-- ============================================================================
-- Partial picking inventory control
-- Adds is_partial flag to picking and picking_line, and rebuilds
-- apply_picking_inventory to use done_quantity (actual scanned) instead of
-- quantity (planned) when the line has been processed through the scanner.
-- ============================================================================

ALTER TABLE public.picking_line
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false;

ALTER TABLE public.picking
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false;

-- ============================================================================
-- Rebuild apply_picking_inventory
-- Logic:
--   · If the line was scanned (scanned_at IS NOT NULL) → use done_quantity as
--     the effective movement. This is the real quantity the operator processed.
--   · If not scanned (traditional confirm without scanner) → use quantity (the
--     planned quantity), preserving backward compatibility.
--   · Lines where the effective quantity is 0 are skipped (no stock movement).
--   · is_partial is set on lines and on the picking header when any scanned
--     line has done_quantity different from quantity.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_picking_inventory(p_picking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_pick      RECORD;
    r_line      RECORD;
    v_product   RECORD;
    v_any_partial BOOLEAN := false;
BEGIN
    SELECT *
    INTO v_pick
    FROM public.picking
    WHERE id = p_picking_id
    FOR UPDATE;

    IF v_pick.id IS NULL THEN
        RAISE EXCEPTION 'Picking not found';
    END IF;

    IF v_pick.status != 'publicado' THEN
        RAISE EXCEPTION 'Only published pickings can be confirmed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.picking_line pl
        WHERE pl.picking_id = p_picking_id
          AND COALESCE(pl.active, true) = true
    ) THEN
        RAISE EXCEPTION 'Cannot confirm a picking without active lines';
    END IF;

    -- Aggregate by product using the effective (real) quantity per line
    FOR r_line IN
        SELECT
            pl.product_id,
            SUM(
                CASE
                    WHEN pl.scanned_at IS NOT NULL
                        THEN COALESCE(pl.done_quantity, 0)
                    ELSE pl.quantity
                END
            ) AS qty_effective,
            SUM(pl.quantity) AS qty_planned,
            BOOL_OR(
                pl.scanned_at IS NOT NULL
                AND COALESCE(pl.done_quantity, 0) IS DISTINCT FROM pl.quantity
            ) AS has_partial
        FROM public.picking_line pl
        WHERE pl.picking_id  = p_picking_id
          AND COALESCE(pl.active, true) = true
        GROUP BY pl.product_id
    LOOP
        IF r_line.has_partial THEN
            v_any_partial := true;
        END IF;

        -- No movement when effective quantity is zero
        CONTINUE WHEN r_line.qty_effective <= 0;

        SELECT *
        INTO v_product
        FROM public.product p
        WHERE p.id          = r_line.product_id
          AND p.company_id  = v_pick.company_id
        FOR UPDATE;

        IF v_product.id IS NULL THEN
            RAISE EXCEPTION 'Product % not found for company', r_line.product_id;
        END IF;

        IF COALESCE(v_product.is_stockable, true) THEN
            IF v_pick.type = 'salida' THEN
                IF COALESCE(v_product.stock_quantity, 0) < r_line.qty_effective THEN
                    RAISE EXCEPTION 'Insufficient stock for product %', v_product.id;
                END IF;
                UPDATE public.product
                SET stock_quantity = COALESCE(stock_quantity, 0) - r_line.qty_effective,
                    updated_by     = auth.uid()
                WHERE id = v_product.id;
            ELSE
                UPDATE public.product
                SET stock_quantity = COALESCE(stock_quantity, 0) + r_line.qty_effective,
                    updated_by     = auth.uid()
                WHERE id = v_product.id;
            END IF;
        END IF;
    END LOOP;

    -- Stamp is_partial on each scanned line that has a difference
    UPDATE public.picking_line
    SET is_partial = (
        scanned_at IS NOT NULL
        AND COALESCE(done_quantity, 0) IS DISTINCT FROM quantity
    )
    WHERE picking_id             = p_picking_id
      AND COALESCE(active, true) = true;

    -- Confirm the picking and record whether it was partial
    UPDATE public.picking
    SET status       = 'confirmado',
        confirmed_at = now(),
        is_partial   = v_any_partial,
        updated_by   = auth.uid()
    WHERE id = p_picking_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN public.picking_line.is_partial IS
    'True when the line was processed through the scanner and done_quantity differs from quantity.';

COMMENT ON COLUMN public.picking.is_partial IS
    'True when at least one line was confirmed with a quantity different from the planned quantity.';

COMMENT ON FUNCTION public.apply_picking_inventory(UUID) IS
    'Confirms picking and updates product stock using the effective quantity: done_quantity for scanned lines, quantity for unscanned lines. Sets is_partial flags accordingly.';
