-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Fase 1 — Integridad de datos del flujo comercial                          ║
-- ║  (docs/sales-flow-analysis.md §6, hallazgos P1, P2, I1, V5, V9)            ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  1. Origen POS          — las ventas POS vuelven a marcarse origin='pos'  ║
-- ║  2. IVA incluido        — order_line.price_include_tax + cálculo correcto ║
-- ║  3. Venta POS segura    — precio, costo, IVA y descuento del servidor     ║
-- ║  4. Costo de compras    — entradas valoradas al precio de la OC           ║
-- ║  5. Funciones de stock  — sin acceso directo ni entre empresas            ║
-- ║  6. Vistas v_*          — security_invoker (respetan el RLS)              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Nada de esta migración recalcula importes históricos: las órdenes ya
-- confirmadas conservan sus totales. Lo único que se corrige sobre datos
-- existentes es la clasificación de canal (origin) de las ventas POS.


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Origen POS
-- ════════════════════════════════════════════════════════════════════════════
/**
 * register_pos_sale nunca asignó order.origin; la columna se creó después
 * (storefront) con un backfill único. Desde entonces cada venta POS quedaba
 * como 'dashboard', y derive_stock_origin la sellaba como 'sale' en el libro.
 *
 * El trigger hace imposible la incoherencia: toda orden con sesión de caja es
 * POS, la cree quien la cree.
 */
CREATE OR REPLACE FUNCTION public.enforce_pos_order_origin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.pos_session_id IS NOT NULL THEN
        NEW.origin := 'pos';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_pos_order_origin ON public."order";
CREATE TRIGGER trigger_enforce_pos_order_origin
    BEFORE INSERT OR UPDATE OF pos_session_id, origin ON public."order"
    FOR EACH ROW EXECUTE FUNCTION public.enforce_pos_order_origin();

-- Backfill de órdenes. Se apaga solo el trigger de updated_at para no alterar
-- la fecha de última modificación de documentos históricos.
ALTER TABLE public."order" DISABLE TRIGGER trigger_order_updated_at;

UPDATE public."order"
SET origin = 'pos'
WHERE pos_session_id IS NOT NULL
  AND origin IS DISTINCT FROM 'pos';

ALTER TABLE public."order" ENABLE TRIGGER trigger_order_updated_at;

-- Pickings de salida de esas ventas: 'sale' → 'pos'. Las devoluciones
-- (return_in) ya estaban bien clasificadas.
ALTER TABLE public.picking DISABLE TRIGGER trigger_picking_updated_at;

UPDATE public.picking pk
SET origin = 'pos'
FROM public."order" o
WHERE o.id = pk.order_id
  AND o.pos_session_id IS NOT NULL
  AND COALESCE(pk.is_return, false) = false
  AND pk.origin IS DISTINCT FROM 'pos';

ALTER TABLE public.picking ENABLE TRIGGER trigger_picking_updated_at;

/**
 * Corrección de clasificación en el libro de inventario.
 *
 * stock_move es append-only y así sigue. Esta es una excepción acotada y
 * documentada: solo se reescribe la etiqueta de canal ('sale' → 'pos') de
 * asientos cuyo documento es inequívocamente una venta POS. Cantidades,
 * costos y saldos no se tocan. El trigger de inmutabilidad se reactiva en la
 * misma transacción.
 */
ALTER TABLE public.stock_move DISABLE TRIGGER trigger_stock_move_append_only;

UPDATE public.stock_move sm
SET origin = 'pos'
FROM public."order" o
WHERE o.id = sm.order_id
  AND o.pos_session_id IS NOT NULL
  AND sm.origin = 'sale';

ALTER TABLE public.stock_move ENABLE TRIGGER trigger_stock_move_append_only;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. IVA incluido en el precio
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Antes, calculate_order_line_totals siempre sumaba el IVA encima del precio e
 * ignoraba tax_included. Consecuencias:
 *   · Órdenes del panel con «precios con IVA» salían infladas.
 *   · Tienda: un producto con IVA incluido se mostraba a $116 y la orden
 *     (y Stripe) cobraban $134.56.
 *   · POS: mismo sobrecobro para productos con IVA incluido.
 *
 * El modo fiscal pasa a ser por línea, porque en tienda y POS el precio viene
 * del producto y cada producto declara si incluye IVA:
 *   price_include_tax = NULL  → hereda order.tax_included (órdenes del panel)
 *   price_include_tax = true/false → explícito (POS y tienda, desde el producto)
 */
ALTER TABLE public.order_line
    ADD COLUMN IF NOT EXISTS price_include_tax BOOLEAN;

COMMENT ON COLUMN public.order_line.price_include_tax IS
    'Si unit_price ya incluye el impuesto. NULL = hereda order.tax_included. POS y tienda lo fijan desde product.tax_included.';

-- Preserva los importes históricos: las líneas de órdenes ya confirmadas cuya
-- orden decía tax_included=true se calcularon con el IVA encima; se fijan a
-- false para que un recálculo futuro no las altere. Triggers apagados porque
-- los importes no cambian y no debe dispararse la sincronización de pickings.
ALTER TABLE public.order_line DISABLE TRIGGER USER;

UPDATE public.order_line ol
SET price_include_tax = false
FROM public."order" o
WHERE o.id = ol.order_id
  AND o.tax_included = true
  AND o.order_state <> 'draft'
  AND ol.price_include_tax IS NULL;

ALTER TABLE public.order_line ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.calculate_order_line_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_tax_included BOOLEAN;
    v_order_origin       TEXT;
    v_included           BOOLEAN;
    v_rate               DECIMAL(9, 4);
    v_net                DECIMAL(15, 2);
BEGIN
    SELECT o.tax_included, o.origin::TEXT
    INTO v_order_tax_included, v_order_origin
    FROM public."order" o
    WHERE o.id = NEW.order_id;

    -- Canales con precio de catálogo: la línea nace con el modo fiscal del
    -- producto. Solo en INSERT, para no reinterpretar líneas históricas.
    IF TG_OP = 'INSERT'
       AND NEW.price_include_tax IS NULL
       AND NEW.product_id IS NOT NULL
       AND v_order_origin IN ('pos', 'storefront') THEN
        NEW.price_include_tax := (
            SELECT COALESCE(p.tax_included, false)
            FROM public.product p
            WHERE p.id = NEW.product_id
        );
    END IF;

    v_included := COALESCE(NEW.price_include_tax, v_order_tax_included, false);
    v_rate     := COALESCE(NEW.tax_rate, 0);

    NEW.discount_amount := ROUND(
        NEW.quantity * NEW.unit_price * COALESCE(NEW.discount_percent, 0) / 100, 2
    );

    -- Importe neto de descuento, tal como lo expresa el precio
    v_net := ROUND((NEW.quantity * NEW.unit_price) - NEW.discount_amount, 2);

    IF v_included AND v_rate <> 0 THEN
        -- El precio ya trae el impuesto: se desglosa, el total no cambia
        NEW.subtotal   := ROUND(v_net / (1 + v_rate / 100), 2);
        NEW.tax_amount := v_net - NEW.subtotal;
    ELSE
        NEW.subtotal   := v_net;
        NEW.tax_amount := ROUND(v_net * v_rate / 100, 2);
    END IF;

    NEW.total  := NEW.subtotal + NEW.tax_amount;
    NEW.margin := ROUND(NEW.subtotal - (NEW.quantity * COALESCE(NEW.unit_cost, 0)), 2);

    IF NEW.subtotal > 0 THEN
        NEW.margin_percent := ROUND((NEW.margin / NEW.subtotal * 100), 2);
    ELSE
        NEW.margin_percent := 0;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.calculate_order_line_totals() IS
    'Calcula descuento, subtotal (sin impuesto), impuesto, total y margen. Respeta price_include_tax / order.tax_included.';

/**
 * Orden de los triggers BEFORE INSERT: PostgreSQL los ejecuta por nombre.
 * «trigger_order_line_calculate» corría antes que «trigger_order_line_populate»,
 * así que una línea que se autocompletaba desde el producto se calculaba con
 * precio 0. Se renombra el de autocompletado para que corra primero.
 *
 * Además, el costo estimado de la línea usa el costo promedio del libro de
 * inventario cuando existe (antes: siempre cost_price).
 */
CREATE OR REPLACE FUNCTION public.populate_order_line_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_product RECORD;
    v_order   RECORD;
BEGIN
    IF NEW.product_id IS NOT NULL AND (NEW.description IS NULL OR NEW.description = '') THEN
        SELECT * INTO v_product FROM public.product WHERE id = NEW.product_id;
        SELECT * INTO v_order   FROM public."order" WHERE id = NEW.order_id;

        IF v_product.id IS NOT NULL THEN
            NEW.description := COALESCE(v_product.display_name, v_product.name);

            IF v_order.order_type = 'sale' THEN
                NEW.unit_price := COALESCE(v_product.sale_price, 0);
            ELSE
                NEW.unit_price := COALESCE(v_product.cost_price, 0);
            END IF;

            NEW.unit_cost := COALESCE(NULLIF(v_product.avg_cost, 0), v_product.cost_price, 0);
            NEW.tax_rate  := COALESCE(v_product.tax_rate, 0);
            NEW.uom_id    := v_product.uom_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_line_populate ON public.order_line;
DROP TRIGGER IF EXISTS trigger_order_line_a_populate ON public.order_line;
CREATE TRIGGER trigger_order_line_a_populate
    BEFORE INSERT ON public.order_line
    FOR EACH ROW EXECUTE FUNCTION public.populate_order_line_from_product();

/**
 * Cambiar «precios con IVA» en una orden en borrador recalcula sus líneas que
 * heredan el modo. Las órdenes confirmadas no se tocan.
 */
CREATE OR REPLACE FUNCTION public.recalculate_lines_on_tax_mode_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.order_state = 'draft' THEN
        UPDATE public.order_line
        SET price_include_tax = price_include_tax
        WHERE order_id = NEW.id
          AND price_include_tax IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_tax_mode_change ON public."order";
CREATE TRIGGER trigger_order_tax_mode_change
    AFTER UPDATE OF tax_included ON public."order"
    FOR EACH ROW
    WHEN (OLD.tax_included IS DISTINCT FROM NEW.tax_included)
    EXECUTE FUNCTION public.recalculate_lines_on_tax_mode_change();


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Venta POS con precios del servidor
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Cambios respecto de 20260610030500_fix_pos_sale_order_line_insert:
 *   · Precio, costo, IVA, modo fiscal y descripción se leen del producto. El
 *     unit_price del cliente solo se compara: si difiere, se rechaza con un
 *     mensaje claro (ticket guardado con un precio viejo).
 *   · El descuento se valida contra pos_register.max_discount_percent salvo
 *     para owner/admin (antes solo lo validaba la pantalla).
 *   · Toda línea debe ser un producto vendible de la empresa.
 *   · La validación de stock suma las líneas repetidas de un mismo producto.
 *   · origin = 'pos' explícito (además del trigger).
 * El resto (picking, pagos, respuesta) es idéntico.
 */
CREATE OR REPLACE FUNCTION public.register_pos_sale(
    p_session_id UUID,
    p_partner_id UUID,
    p_lines JSONB,
    p_payments JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_register RECORD;
    v_order RECORD;
    v_order_id UUID;
    v_created_by_partner_id UUID;
    v_line JSONB;
    v_payment JSONB;
    v_product RECORD;
    r_stock RECORD;
    r_stock_line RECORD;
    v_sequence INT := 10;
    v_payments_total DECIMAL(15, 2) := 0;
    v_pick_id UUID;
    v_warehouse_id UUID;
    v_first_method UUID;
    v_stockable_count INT := 0;
    v_qty DECIMAL(15, 3);
    v_price DECIMAL(15, 2);
    v_discount DECIMAL(5, 2);
    v_max_discount DECIMAL(5, 2);
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

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'No se puede cobrar un ticket vacío';
    END IF;

    IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'La venta debe incluir al menos un pago';
    END IF;

    -- Límite de descuento: owner/admin actúan como supervisores
    v_max_discount := CASE
        WHEN public.is_company_admin(v_session.company_id) THEN 100
        ELSE COALESCE(v_register.max_discount_percent, 100)
    END;

    -- Validación de líneas (antes de escribir nada)
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        IF NULLIF(v_line->>'product_id', '') IS NULL THEN
            RAISE EXCEPTION 'Cada línea del ticket debe corresponder a un producto del catálogo';
        END IF;

        SELECT * INTO v_product
        FROM public.product
        WHERE id = (v_line->>'product_id')::UUID
          AND company_id = v_session.company_id;

        IF v_product.id IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado en la empresa';
        END IF;

        IF NOT COALESCE(v_product.can_be_sold, true) THEN
            RAISE EXCEPTION '% no está disponible para venta', v_product.name;
        END IF;

        v_qty := COALESCE((v_line->>'quantity')::DECIMAL, 0);
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad de % debe ser mayor a cero', v_product.name;
        END IF;

        v_price := COALESCE(v_product.sale_price, 0);
        IF NULLIF(v_line->>'unit_price', '') IS NOT NULL
           AND ABS((v_line->>'unit_price')::DECIMAL - v_price) > 0.005 THEN
            RAISE EXCEPTION 'El precio de % cambió a %. Quita el producto del ticket y vuelve a agregarlo.',
                v_product.name, v_price;
        END IF;

        v_discount := COALESCE((v_line->>'discount_percent')::DECIMAL, 0);
        IF v_discount < 0 OR v_discount > 100 THEN
            RAISE EXCEPTION 'Descuento inválido para %', v_product.name;
        END IF;

        IF v_discount > v_max_discount THEN
            RAISE EXCEPTION USING MESSAGE = format(
                'El descuento de %s%% en %s excede tu límite de %s%%. Requiere autorización de un supervisor.',
                v_discount, v_product.name, v_max_discount
            );
        END IF;
    END LOOP;

    -- Stock por producto, sumando líneas repetidas
    FOR r_stock IN
        SELECT x.product_id, SUM(x.quantity) AS qty
        FROM jsonb_to_recordset(p_lines) AS x(product_id UUID, quantity DECIMAL)
        GROUP BY x.product_id
    LOOP
        SELECT id, name, is_stockable, stock_quantity
        INTO v_product
        FROM public.product
        WHERE id = r_stock.product_id;

        IF COALESCE(v_product.is_stockable, true)
           AND COALESCE(v_product.stock_quantity, 0) < r_stock.qty THEN
            RAISE EXCEPTION 'Stock insuficiente para %', v_product.name;
        END IF;
    END LOOP;

    -- Crear orden de venta en borrador
    SELECT id INTO v_created_by_partner_id
    FROM public.partner
    WHERE user_id = auth.uid();

    INSERT INTO public."order" (
        company_id, order_type, partner_id, created_by_partner_id,
        order_state, currency, tax_rate, tax_included, origin,
        pos_session_id, notes, created_by, updated_by
    ) VALUES (
        v_session.company_id, 'sale', p_partner_id, v_created_by_partner_id,
        'draft', 'MXN', 0, false, 'pos',
        p_session_id, p_notes, auth.uid(), auth.uid()
    )
    RETURNING id INTO v_order_id;

    -- Líneas con datos del producto (order_line no tiene columnas de auditoría)
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_product
        FROM public.product
        WHERE id = (v_line->>'product_id')::UUID;

        INSERT INTO public.order_line (
            order_id, product_id, sequence, description,
            quantity, unit_price, unit_cost, discount_percent,
            tax_rate, price_include_tax, uom_id
        ) VALUES (
            v_order_id,
            v_product.id,
            v_sequence,
            COALESCE(NULLIF(btrim(v_product.display_name), ''), v_product.name, 'Artículo'),
            (v_line->>'quantity')::DECIMAL,
            COALESCE(v_product.sale_price, 0),
            COALESCE(NULLIF(v_product.avg_cost, 0), v_product.cost_price, 0),
            COALESCE((v_line->>'discount_percent')::DECIMAL, 0),
            COALESCE(v_product.tax_rate, 0),
            COALESCE(v_product.tax_included, false),
            v_product.uom_id
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
$$;

REVOKE ALL ON FUNCTION public.register_pos_sale(UUID, UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_pos_sale(UUID, UUID, JSONB, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION public.register_pos_sale(UUID, UUID, JSONB, JSONB, TEXT) IS
    'Venta POS atómica con precios, costo, IVA y límite de descuento validados en servidor; crea orden origin=pos, picking confirmado y pagos split.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4. Entradas de compra valoradas al precio de la orden de compra
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Antes, toda entrada se valoraba al costo promedio vigente (o cost_price): el
 * promedio ponderado nunca reflejaba lo que realmente se pagó.
 *
 * Ahora, si el picking es la recepción (no devolución) de una orden de compra,
 * el costo unitario de cada producto es su precio neto en la OC:
 *     SUM(order_line.subtotal) / SUM(order_line.quantity)
 * (subtotal ya descuenta descuentos e impuesto), convertido a la moneda de la
 * empresa con order.exchange_rate cuando la OC está en otra moneda.
 *
 * Además ya no es invocable directamente: solo a través de set_picking_status.
 * El resto de la función es idéntico a 20260911120000.
 */
CREATE OR REPLACE FUNCTION public.apply_picking_inventory(p_picking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pick        RECORD;
    r_agg         RECORD;
    r_line        RECORD;
    v_product     RECORD;
    v_origin      public.stock_move_origin;
    v_any_partial BOOLEAN := false;
    v_effective   DECIMAL(15, 3);
    v_move_type   public.stock_move_type;
    v_is_purchase_receipt BOOLEAN := false;
    v_fx_rate     DECIMAL(15, 6) := 1;
    v_unit_cost   DECIMAL(15, 4);
BEGIN
    SELECT * INTO v_pick FROM public.picking WHERE id = p_picking_id FOR UPDATE;

    IF v_pick.id IS NULL THEN
        RAISE EXCEPTION 'Picking not found';
    END IF;

    IF v_pick.status != 'publicado' THEN
        RAISE EXCEPTION 'Only published pickings can be confirmed';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.picking_line pl
        WHERE pl.picking_id = p_picking_id AND COALESCE(pl.active, true) = true
    ) THEN
        RAISE EXCEPTION 'Cannot confirm a picking without active lines';
    END IF;

    v_origin    := public.resolve_picking_origin(p_picking_id);
    v_move_type := CASE WHEN v_pick.type = 'salida' THEN 'out' ELSE 'in' END::public.stock_move_type;

    -- ¿Recepción de una orden de compra? → costo de la OC
    IF v_pick.order_id IS NOT NULL
       AND v_pick.type = 'entrada'
       AND NOT COALESCE(v_pick.is_return, false) THEN
        SELECT
            (o.order_type = 'purchase'),
            CASE
                WHEN o.currency IS DISTINCT FROM c.currency
                    THEN COALESCE(NULLIF(o.exchange_rate, 0), 1)
                ELSE 1
            END
        INTO v_is_purchase_receipt, v_fx_rate
        FROM public."order" o
        JOIN public.company c ON c.id = o.company_id
        WHERE o.id = v_pick.order_id;

        v_is_purchase_receipt := COALESCE(v_is_purchase_receipt, false);
        v_fx_rate := COALESCE(v_fx_rate, 1);
    END IF;

    -- 1) Validación de suficiencia por producto (misma regla que antes)
    FOR r_agg IN
        SELECT
            pl.product_id,
            SUM(CASE WHEN pl.scanned_at IS NOT NULL
                     THEN COALESCE(pl.done_quantity, 0)
                     ELSE pl.quantity END) AS qty_effective,
            BOOL_OR(pl.scanned_at IS NOT NULL
                    AND COALESCE(pl.done_quantity, 0) IS DISTINCT FROM pl.quantity) AS has_partial
        FROM public.picking_line pl
        WHERE pl.picking_id = p_picking_id
          AND COALESCE(pl.active, true) = true
        GROUP BY pl.product_id
    LOOP
        IF r_agg.has_partial THEN
            v_any_partial := true;
        END IF;

        CONTINUE WHEN r_agg.qty_effective <= 0;

        SELECT * INTO v_product
        FROM public.product
        WHERE id = r_agg.product_id AND company_id = v_pick.company_id;

        IF v_product.id IS NULL THEN
            RAISE EXCEPTION 'Product % not found for company', r_agg.product_id;
        END IF;

        IF COALESCE(v_product.is_stockable, true) AND v_pick.type = 'salida' THEN
            IF COALESCE(v_product.stock_quantity, 0) < r_agg.qty_effective THEN
                RAISE EXCEPTION 'Insufficient stock for product %', v_product.id;
            END IF;
        END IF;
    END LOOP;

    -- 2) Un asiento por línea, con su lote/serie, cantidad real y costo
    FOR r_line IN
        SELECT pl.*,
               CASE WHEN pl.scanned_at IS NOT NULL
                    THEN COALESCE(pl.done_quantity, 0)
                    ELSE pl.quantity END AS qty_effective
        FROM public.picking_line pl
        WHERE pl.picking_id = p_picking_id
          AND COALESCE(pl.active, true) = true
        ORDER BY pl.sequence, pl.created_at
    LOOP
        v_effective := r_line.qty_effective;
        CONTINUE WHEN v_effective IS NULL OR v_effective <= 0;

        v_unit_cost := NULL;
        IF v_is_purchase_receipt THEN
            SELECT SUM(ol.subtotal) / NULLIF(SUM(ol.quantity), 0)
            INTO v_unit_cost
            FROM public.order_line ol
            WHERE ol.order_id = v_pick.order_id
              AND ol.product_id = r_line.product_id
              AND ol.quantity > 0;

            -- NULL o <= 0 → record_stock_move usa el costo de reposición
            v_unit_cost := CASE
                WHEN COALESCE(v_unit_cost, 0) > 0 THEN ROUND(v_unit_cost * v_fx_rate, 4)
                ELSE NULL
            END;
        END IF;

        PERFORM public.record_stock_move(
            p_company_id      => v_pick.company_id,
            p_product_id      => r_line.product_id,
            p_move_type       => v_move_type,
            p_quantity        => v_effective,
            p_origin          => v_origin,
            p_warehouse_id    => v_pick.warehouse_id,
            p_unit_cost       => v_unit_cost,
            p_picking_id      => v_pick.id,
            p_picking_line_id => r_line.id,
            p_order_id        => v_pick.order_id,
            p_lot_name        => r_line.lot_name,
            p_serial_number   => r_line.serial_number,
            p_reference       => v_pick.name,
            p_notes           => v_pick.notes
        );
    END LOOP;

    UPDATE public.picking_line
    SET is_partial = (
        scanned_at IS NOT NULL
        AND COALESCE(done_quantity, 0) IS DISTINCT FROM quantity
    )
    WHERE picking_id = p_picking_id
      AND COALESCE(active, true) = true;

    UPDATE public.picking
    SET status       = 'confirmado',
        confirmed_at = now(),
        is_partial   = v_any_partial,
        origin       = COALESCE(origin, v_origin),
        updated_by   = auth.uid()
    WHERE id = p_picking_id;

    RETURN true;
END;
$$;

COMMENT ON FUNCTION public.apply_picking_inventory(UUID) IS
    'Confirma un picking y escribe un asiento por línea en stock_move. Las recepciones de compra se valoran al precio neto de la OC. Interna: usar set_picking_status.';


-- ════════════════════════════════════════════════════════════════════════════
-- 5. Funciones de stock: sin acceso directo ni entre empresas
-- ════════════════════════════════════════════════════════════════════════════
/**
 * record_stock_move y apply_picking_inventory son SECURITY DEFINER y conservaban
 * el EXECUTE por defecto de PUBLIC: cualquier sesión (incluida anon) podía
 * escribir asientos y mover el stock de cualquier empresa, saltándose el libro.
 * Solo las llaman otras funciones SECURITY DEFINER (que corren como dueño), así
 * que se les retira el acceso a todos los roles de cliente.
 */
REVOKE ALL ON FUNCTION public.record_stock_move(
    UUID, UUID, public.stock_move_type, DECIMAL, public.stock_move_origin, UUID,
    DECIMAL, UUID, UUID, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.apply_picking_inventory(UUID) FROM PUBLIC, anon, authenticated;

/**
 * set_picking_status no comprobaba la empresa: un usuario de otra empresa podía
 * publicar, confirmar o cancelar cualquier picking conociendo su id.
 */
CREATE OR REPLACE FUNCTION public.set_picking_status(
    p_picking_id UUID,
    p_new_status public.picking_status
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    IF NOT public.user_belongs_to_company(v_pick.company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
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
$$;

REVOKE ALL ON FUNCTION public.set_picking_status(UUID, public.picking_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_picking_status(UUID, public.picking_status) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. Vistas v_* con security_invoker
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Las vistas corrían con privilegios del dueño y omitían el RLS: cualquier
 * sesión podía leer órdenes, pickings, libro de inventario, sesiones POS y
 * membresías de otras empresas consultando la vista sin filtrar company_id.
 *
 * Con security_invoker las vistas aplican el RLS de cada tabla base. Las
 * funciones SECURITY DEFINER que las usan (resúmenes de inventario, etc.)
 * siguen corriendo como dueño y no cambian.
 *
 * Efecto colateral a cubrir: la política de partner solo dejaba ver partners
 * ACTIVOS. Con RLS aplicado, el nombre de un cliente archivado desaparecería de
 * sus órdenes históricas. Se agrega una política que permite ver los partners
 * relacionados con las empresas del usuario (activos o no). La comprobación va
 * en una función SECURITY DEFINER para no recursar sobre el RLS de
 * rel_partner_company.
 */
CREATE OR REPLACE FUNCTION public.partner_shares_company_with_user(p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.rel_partner_company r
        WHERE r.partner_id = p_partner_id
          AND public.user_belongs_to_company(r.company_id)
    );
$$;

REVOKE ALL ON FUNCTION public.partner_shares_company_with_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_shares_company_with_user(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view partners of their companies" ON public.partner;
CREATE POLICY "Users can view partners of their companies" ON public.partner
    FOR SELECT
    TO authenticated
    USING (public.partner_shares_company_with_user(id));

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'v'
          AND c.relname LIKE 'v\_%'
    LOOP
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', r.relname);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
    END LOOP;
END;
$$;
