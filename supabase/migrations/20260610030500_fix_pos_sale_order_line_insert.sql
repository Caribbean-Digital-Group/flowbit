-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  fix_pos_sale_order_line_insert                                            ║
-- ║                                                                            ║
-- ║  La tabla order_line no tiene columnas de auditoría created_by/updated_by ║
-- ║  (a diferencia del resto de tablas). register_pos_sale fallaba al          ║
-- ║  insertarlas; se recrea la función sin esas columnas.                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.register_pos_sale(
    p_session_id UUID,
    p_partner_id UUID,
    p_lines JSONB,
    p_payments JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_register RECORD;
    v_order RECORD;
    v_order_id UUID;
    v_created_by_partner_id UUID;
    v_line JSONB;
    v_payment JSONB;
    v_product RECORD;
    r_stock_line RECORD;
    v_sequence INT := 10;
    v_payments_total DECIMAL(15, 2) := 0;
    v_pick_id UUID;
    v_warehouse_id UUID;
    v_first_method UUID;
    v_stockable_count INT := 0;
BEGIN
    -- Validaciones de sesión
    SELECT * INTO v_session
    FROM public.pos_session
    WHERE id = p_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión de caja no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(v_session.company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    IF v_session.status <> 'open' THEN
        RAISE EXCEPTION 'No se puede vender sin una sesión de caja abierta';
    END IF;

    SELECT * INTO v_register
    FROM public.pos_register
    WHERE id = v_session.register_id;

    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'No se puede cobrar un ticket vacío';
    END IF;

    IF p_payments IS NULL OR jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'La venta debe incluir al menos un pago';
    END IF;

    -- Pre-validación de stock (mensaje amigable antes de mover nada)
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        IF (v_line->>'product_id') IS NOT NULL THEN
            SELECT id, name, is_stockable, stock_quantity, company_id
            INTO v_product
            FROM public.product
            WHERE id = (v_line->>'product_id')::UUID;

            IF v_product.id IS NULL OR v_product.company_id <> v_session.company_id THEN
                RAISE EXCEPTION 'Producto no encontrado en la empresa';
            END IF;

            IF COALESCE(v_product.is_stockable, true)
               AND COALESCE(v_product.stock_quantity, 0) < (v_line->>'quantity')::DECIMAL THEN
                RAISE EXCEPTION 'Stock insuficiente para %', v_product.name;
            END IF;
        END IF;
    END LOOP;

    -- Crear orden de venta en borrador
    SELECT id INTO v_created_by_partner_id
    FROM public.partner
    WHERE user_id = auth.uid();

    INSERT INTO public."order" (
        company_id, order_type, partner_id, created_by_partner_id,
        order_state, currency, tax_rate, tax_included,
        pos_session_id, notes, created_by, updated_by
    ) VALUES (
        v_session.company_id, 'sale', p_partner_id, v_created_by_partner_id,
        'draft', 'MXN', 0, false,
        p_session_id, p_notes, auth.uid(), auth.uid()
    )
    RETURNING id INTO v_order_id;

    -- Insertar líneas (order_line no tiene columnas de auditoría)
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO public.order_line (
            order_id, product_id, sequence, description,
            quantity, unit_price, unit_cost, discount_percent, tax_rate
        ) VALUES (
            v_order_id,
            NULLIF(v_line->>'product_id', '')::UUID,
            v_sequence,
            COALESCE(NULLIF(v_line->>'description', ''), 'Artículo'),
            COALESCE((v_line->>'quantity')::DECIMAL, 1),
            COALESCE((v_line->>'unit_price')::DECIMAL, 0),
            COALESCE((v_line->>'unit_cost')::DECIMAL, 0),
            COALESCE((v_line->>'discount_percent')::DECIMAL, 0),
            COALESCE((v_line->>'tax_rate')::DECIMAL, 0)
        );
        v_sequence = v_sequence + 10;
    END LOOP;

    -- Releer la orden con totales calculados
    SELECT * INTO v_order FROM public."order" WHERE id = v_order_id;

    -- Validar pagos contra el total
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.payment_method
            WHERE id = (v_payment->>'payment_method_id')::UUID
              AND company_id = v_session.company_id
              AND active = true
        ) THEN
            RAISE EXCEPTION 'Método de pago inválido';
        END IF;

        IF COALESCE((v_payment->>'amount')::DECIMAL, 0) <= 0 THEN
            RAISE EXCEPTION 'Los montos de pago deben ser mayores a cero';
        END IF;

        v_payments_total = v_payments_total + (v_payment->>'amount')::DECIMAL;

        IF v_first_method IS NULL THEN
            v_first_method = (v_payment->>'payment_method_id')::UUID;
        END IF;
    END LOOP;

    IF ABS(v_payments_total - v_order.amount_total) > 0.01 THEN
        RAISE EXCEPTION 'Los pagos (%) no cubren el total de la venta (%)',
            v_payments_total, v_order.amount_total;
    END IF;

    -- Confirmar + entregar + pagar (el trigger de delivery ignora órdenes POS)
    UPDATE public."order"
    SET order_state = 'posted',
        confirmation_date = now(),
        is_delivered = true,
        is_paid = true,
        payment_status = 'paid',
        payment_method_id = v_first_method,
        delivery_date = CURRENT_DATE,
        updated_by = auth.uid()
    WHERE id = v_order_id;

    -- Crear y confirmar el picking de salida (solo productos stockables)
    SELECT COUNT(*) INTO v_stockable_count
    FROM public.order_line ol
    INNER JOIN public.product p ON p.id = ol.product_id
    WHERE ol.order_id = v_order_id
      AND COALESCE(p.is_stockable, true) = true;

    IF v_stockable_count > 0 THEN
        v_warehouse_id = COALESCE(
            v_register.warehouse_id,
            public.get_or_create_default_warehouse(v_session.company_id)
        );

        INSERT INTO public.picking (
            company_id, warehouse_id, order_id, type, status, is_return,
            notes, created_by, updated_by
        ) VALUES (
            v_session.company_id, v_warehouse_id, v_order_id, 'salida', 'borrador', false,
            'Venta POS', auth.uid(), auth.uid()
        )
        RETURNING id INTO v_pick_id;

        v_sequence = 10;
        FOR r_stock_line IN
            SELECT ol.product_id, SUM(ol.quantity) AS qty_sum, p.tracking
            FROM public.order_line ol
            INNER JOIN public.product p ON p.id = ol.product_id
            WHERE ol.order_id = v_order_id
              AND COALESCE(p.is_stockable, true) = true
            GROUP BY ol.product_id, p.tracking
        LOOP
            IF r_stock_line.tracking = 'serial' THEN
                IF MOD(r_stock_line.qty_sum, 1) != 0 THEN
                    RAISE EXCEPTION 'Los productos con número de serie requieren cantidades enteras';
                END IF;

                FOR i IN 1..r_stock_line.qty_sum::INT LOOP
                    INSERT INTO public.picking_line (
                        company_id, picking_id, product_id, sequence, quantity,
                        tracking_type, serial_number, created_by, updated_by
                    ) VALUES (
                        v_session.company_id, v_pick_id, r_stock_line.product_id,
                        v_sequence, 1, 'serial',
                        'POS-' || substr(gen_random_uuid()::TEXT, 1, 8),
                        auth.uid(), auth.uid()
                    );
                    v_sequence = v_sequence + 10;
                END LOOP;
            ELSIF r_stock_line.tracking = 'lot' THEN
                INSERT INTO public.picking_line (
                    company_id, picking_id, product_id, sequence, quantity,
                    tracking_type, lot_name, created_by, updated_by
                ) VALUES (
                    v_session.company_id, v_pick_id, r_stock_line.product_id,
                    v_sequence, r_stock_line.qty_sum, 'lot', 'VENTA-POS',
                    auth.uid(), auth.uid()
                );
                v_sequence = v_sequence + 10;
            ELSE
                INSERT INTO public.picking_line (
                    company_id, picking_id, product_id, sequence, quantity,
                    tracking_type, created_by, updated_by
                ) VALUES (
                    v_session.company_id, v_pick_id, r_stock_line.product_id,
                    v_sequence, r_stock_line.qty_sum, 'none',
                    auth.uid(), auth.uid()
                );
                v_sequence = v_sequence + 10;
            END IF;
        END LOOP;

        PERFORM public.set_picking_status(v_pick_id, 'publicado');
        PERFORM public.set_picking_status(v_pick_id, 'confirmado');
    END IF;

    -- Registrar pagos
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
        INSERT INTO public.pos_payment (
            company_id, session_id, order_id, payment_method_id,
            amount, tendered, change_amount, is_refund,
            created_by, updated_by
        ) VALUES (
            v_session.company_id, p_session_id, v_order_id,
            (v_payment->>'payment_method_id')::UUID,
            (v_payment->>'amount')::DECIMAL,
            NULLIF(v_payment->>'tendered', '')::DECIMAL,
            COALESCE((v_payment->>'change_amount')::DECIMAL, 0),
            false,
            auth.uid(), auth.uid()
        );
    END LOOP;

    SELECT * INTO v_order FROM public."order" WHERE id = v_order_id;

    RETURN jsonb_build_object(
        'order_id', v_order.id,
        'order_name', v_order.name,
        'amount_total', v_order.amount_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.register_pos_sale(UUID, UUID, JSONB, JSONB, TEXT) IS
    'Venta POS atómica: crea orden de venta, líneas, confirma, entrega (picking confirmado descuenta stock) y registra pagos split';
