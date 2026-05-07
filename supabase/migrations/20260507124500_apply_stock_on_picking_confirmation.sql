-- ============================================================================
-- Migration: Ensure stock update when picking is confirmed
-- ============================================================================

-- Rebuild confirmation function to guarantee inventory updates based on picking_line
CREATE OR REPLACE FUNCTION public.apply_picking_inventory(p_picking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_pick RECORD;
    r_line RECORD;
    v_product RECORD;
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

    FOR r_line IN
        SELECT
            pl.product_id,
            SUM(pl.quantity) AS qty_sum
        FROM public.picking_line pl
        WHERE pl.picking_id = p_picking_id
          AND COALESCE(pl.active, true) = true
        GROUP BY pl.product_id
    LOOP
        SELECT *
        INTO v_product
        FROM public.product p
        WHERE p.id = r_line.product_id
          AND p.company_id = v_pick.company_id
        FOR UPDATE;

        IF v_product.id IS NULL THEN
            RAISE EXCEPTION 'Product % not found for company', r_line.product_id;
        END IF;

        IF COALESCE(v_product.is_stockable, true) THEN
            IF v_pick.type = 'salida' THEN
                IF COALESCE(v_product.stock_quantity, 0) < r_line.qty_sum THEN
                    RAISE EXCEPTION 'Insufficient stock for product %', v_product.id;
                END IF;

                UPDATE public.product
                SET stock_quantity = COALESCE(stock_quantity, 0) - r_line.qty_sum,
                    updated_by = auth.uid()
                WHERE id = v_product.id;
            ELSE
                UPDATE public.product
                SET stock_quantity = COALESCE(stock_quantity, 0) + r_line.qty_sum,
                    updated_by = auth.uid()
                WHERE id = v_product.id;
            END IF;
        END IF;
    END LOOP;

    UPDATE public.picking
    SET status = 'confirmado',
        confirmed_at = now(),
        updated_by = auth.uid()
    WHERE id = p_picking_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep transition rules explicit and route confirmation through apply_picking_inventory.
CREATE OR REPLACE FUNCTION public.set_picking_status(
    p_picking_id UUID,
    p_new_status public.picking_status
)
RETURNS BOOLEAN AS $$
DECLARE
    v_pick RECORD;
BEGIN
    SELECT *
    INTO v_pick
    FROM public.picking
    WHERE id = p_picking_id
    FOR UPDATE;

    IF v_pick.id IS NULL THEN
        RAISE EXCEPTION 'Picking not found';
    END IF;

    IF v_pick.status = p_new_status THEN
        RETURN true;
    END IF;

    IF v_pick.status = 'borrador' AND p_new_status = 'publicado' THEN
        UPDATE public.picking
        SET status = 'publicado',
            published_at = now(),
            updated_by = auth.uid()
        WHERE id = p_picking_id;
        RETURN true;
    END IF;

    IF v_pick.status = 'publicado' AND p_new_status = 'confirmado' THEN
        RETURN public.apply_picking_inventory(p_picking_id);
    END IF;

    IF v_pick.status IN ('borrador', 'publicado') AND p_new_status = 'cancelado' THEN
        UPDATE public.picking
        SET status = 'cancelado',
            cancelled_at = now(),
            active = false,
            updated_by = auth.uid()
        WHERE id = p_picking_id;
        RETURN true;
    END IF;

    RAISE EXCEPTION 'Invalid picking transition: % -> %', v_pick.status, p_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.apply_picking_inventory(UUID) IS
    'Confirms picking and updates product stock from active picking lines; salida decreases, entrada increases.';

