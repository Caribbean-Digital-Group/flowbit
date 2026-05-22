-- Inventory on post/cancel + preview shortages for draft sale orders

CREATE OR REPLACE FUNCTION public.post_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
    r_agg RECORD;
    v_prod RECORD;
BEGIN
    SELECT * INTO v_order FROM public.order WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state != 'draft' THEN
        RAISE EXCEPTION 'Only draft orders can be posted';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.order_line WHERE order_id = p_order_id) THEN
        RAISE EXCEPTION 'Cannot post an order without lines';
    END IF;

    -- Sale: decrease stock per product (summed qty across lines).
    IF v_order.order_type = 'sale' THEN
        FOR r_agg IN
            SELECT ol.product_id, SUM(ol.quantity) AS qty_sum
            FROM public.order_line ol
            WHERE ol.order_id = p_order_id
              AND ol.product_id IS NOT NULL
            GROUP BY ol.product_id
        LOOP
            SELECT p.*
            INTO v_prod
            FROM public.product p
            WHERE p.id = r_agg.product_id
              AND p.company_id = v_order.company_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product % not linked to this company', r_agg.product_id;
            END IF;

            IF COALESCE(v_prod.is_stockable, TRUE) THEN
                IF COALESCE(v_prod.stock_quantity, 0) < r_agg.qty_sum THEN
                    RAISE EXCEPTION 'STOCK_INSUFFICIENT'
                        USING MESSAGE = format(
                            'Stock insuficiente para «%s»: se requieren %s unidades y hay %s disponibles.',
                            COALESCE(NULLIF(btrim(v_prod.display_name), ''), v_prod.name),
                            r_agg.qty_sum,
                            COALESCE(v_prod.stock_quantity, 0)
                        );
                END IF;

                UPDATE public.product
                SET stock_quantity = COALESCE(stock_quantity, 0) - r_agg.qty_sum,
                    updated_by = auth.uid()
                WHERE id = v_prod.id;
            END IF;
        END LOOP;
    END IF;

    -- Purchase: increase stock when receiving inventory
    IF v_order.order_type = 'purchase' THEN
        FOR r_agg IN
            SELECT ol.product_id, SUM(ol.quantity) AS qty_sum
            FROM public.order_line ol
            WHERE ol.order_id = p_order_id
              AND ol.product_id IS NOT NULL
            GROUP BY ol.product_id
        LOOP
            SELECT p.*
            INTO v_prod
            FROM public.product p
            WHERE p.id = r_agg.product_id
              AND p.company_id = v_order.company_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product % not linked to this company', r_agg.product_id;
            END IF;

            IF COALESCE(v_prod.is_stockable, TRUE) THEN
                UPDATE public.product
                SET stock_quantity = COALESCE(stock_quantity, 0) + r_agg.qty_sum,
                    updated_by = auth.uid()
                WHERE id = v_prod.id;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.order
    SET order_state = 'posted',
        confirmation_date = COALESCE(confirmation_date, now()),
        updated_by = auth.uid()
    WHERE id = p_order_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
    r_agg RECORD;
    v_prod RECORD;
BEGIN
    SELECT * INTO v_order FROM public.order WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state = 'cancel' THEN
        RAISE EXCEPTION 'Order is already cancelled';
    END IF;

    -- Reverse inventory only if stock was affected on post
    IF v_order.order_state = 'posted' THEN
        FOR r_agg IN
            SELECT ol.product_id, SUM(ol.quantity) AS qty_sum
            FROM public.order_line ol
            WHERE ol.order_id = p_order_id
              AND ol.product_id IS NOT NULL
            GROUP BY ol.product_id
        LOOP
            SELECT p.*
            INTO v_prod
            FROM public.product p
            WHERE p.id = r_agg.product_id
              AND p.company_id = v_order.company_id
            FOR UPDATE;

            IF NOT FOUND THEN
                CONTINUE;
            END IF;

            IF COALESCE(v_prod.is_stockable, TRUE) THEN
                IF v_order.order_type = 'sale' THEN
                    UPDATE public.product
                    SET stock_quantity = COALESCE(stock_quantity, 0) + r_agg.qty_sum,
                        updated_by = auth.uid()
                    WHERE id = v_prod.id;
                ELSIF v_order.order_type = 'purchase' THEN
                    UPDATE public.product
                    SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - r_agg.qty_sum, 0),
                        updated_by = auth.uid()
                    WHERE id = v_prod.id;
                END IF;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.order
    SET order_state = 'cancel',
        updated_by = auth.uid()
    WHERE id = p_order_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Preview: draft sale orders only; demands aggregated per product
CREATE OR REPLACE FUNCTION public.preview_order_stock_shortages(p_order_id UUID)
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    requested NUMERIC,
    available NUMERIC
) AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.order WHERE id = p_order_id;

    IF v_order.id IS NULL OR v_order.order_type != 'sale' OR v_order.order_state != 'draft' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        COALESCE(NULLIF(btrim(p.display_name), ''), p.name)::TEXT,
        SUM(ol.quantity)::NUMERIC,
        COALESCE(p.stock_quantity, 0)::NUMERIC
    FROM public.order_line ol
    INNER JOIN public.product p ON p.id = ol.product_id AND p.company_id = v_order.company_id
    WHERE ol.order_id = p_order_id
      AND ol.product_id IS NOT NULL
      AND COALESCE(p.is_stockable, TRUE)
    GROUP BY p.id, p.name, p.display_name, p.stock_quantity, p.is_stockable
    HAVING COALESCE(p.stock_quantity, 0) < SUM(ol.quantity);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.post_order(UUID) IS
    'Confirm draft order: sale deducts stock, purchase adds stock; sets confirmation_date';
COMMENT ON FUNCTION public.cancel_order(UUID) IS
    'Cancel order; if previously posted, reverses inventory movements';
COMMENT ON FUNCTION public.preview_order_stock_shortages(UUID) IS
    'Lists products on a draft sale order whose total line qty exceeds stock';

GRANT EXECUTE ON FUNCTION public.preview_order_stock_shortages(UUID) TO authenticated;
