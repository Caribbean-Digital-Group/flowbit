-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Fase 3 — Inventario por almacén, reservas y trazabilidad de lotes         ║
-- ║  (docs/sales-flow-analysis.md §4.4, hallazgos I2, I3, I4, V8, P4, W3)      ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  1. stock_quant          — existencia por producto y almacén               ║
-- ║  2. Validación           — una salida no puede dejar negativo un almacén   ║
-- ║  3. Reservas             — lo que está en pickings de salida abiertos      ║
-- ║  4. Almacén de salida    — por orden, por tienda y por caja                ║
-- ║  5. Lotes y series       — asignación FIFO real en salidas (POS incluido)  ║
-- ║  6. Traspasos            — mover existencias entre almacenes               ║
-- ║  7. Tienda               — el checkout valida lo disponible, no el total   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Decisión de negocio (2026-11-03): el stock se reserva AL PREPARAR LA
-- ENTREGA. La reserva no es un contador: es la suma de las líneas de pickings
-- de salida en borrador o publicados, así nunca se desincroniza.


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Existencias por almacén
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stock_quant (
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouse(id) ON DELETE CASCADE,
    quantity     DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, warehouse_id)
);

COMMENT ON TABLE public.stock_quant IS
    'Existencia por producto y almacén. La mantiene un trigger sobre stock_move; la suma por producto es product.stock_quantity.';

CREATE INDEX IF NOT EXISTS idx_stock_quant_company   ON public.stock_quant(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_quant_warehouse ON public.stock_quant(warehouse_id);

ALTER TABLE public.stock_quant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company stock quants" ON public.stock_quant;
CREATE POLICY "Users can view company stock quants" ON public.stock_quant
    FOR SELECT USING (public.user_belongs_to_company(company_id));

REVOKE ALL ON public.stock_quant FROM anon;

ALTER TABLE public.inventory_settings
    ADD COLUMN IF NOT EXISTS enforce_warehouse_stock BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.inventory_settings.enforce_warehouse_stock IS
    'Si está activo, una salida no puede dejar en negativo la existencia del almacén.';

-- El almacén predeterminado solo lo crea alguien de la empresa
CREATE OR REPLACE FUNCTION public.get_or_create_default_warehouse(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_warehouse_id UUID;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    SELECT id INTO v_warehouse_id
    FROM public.warehouse
    WHERE company_id = p_company_id AND is_default = true AND active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
        SELECT id INTO v_warehouse_id
        FROM public.warehouse
        WHERE company_id = p_company_id AND active = true
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF v_warehouse_id IS NULL THEN
        INSERT INTO public.warehouse (
            company_id, name, code, description, is_default, created_by, updated_by
        ) VALUES (
            p_company_id, 'Almacén principal', 'MAIN', 'Almacén creado automáticamente', true,
            auth.uid(), auth.uid()
        )
        RETURNING id INTO v_warehouse_id;
    END IF;

    RETURN v_warehouse_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_default_warehouse(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_default_warehouse(UUID) TO authenticated;

/**
 * Implantación. Los asientos sin almacén (aperturas y ajustes previos) se
 * asignan al almacén predeterminado. Igual que en 20261103120000, es una
 * corrección de metadato del libro: cantidades y costos no se tocan.
 */
ALTER TABLE public.stock_move DISABLE TRIGGER trigger_stock_move_append_only;

UPDATE public.stock_move sm
SET warehouse_id = public.get_or_create_default_warehouse(sm.company_id)
WHERE sm.warehouse_id IS NULL;

ALTER TABLE public.stock_move ENABLE TRIGGER trigger_stock_move_append_only;

INSERT INTO public.stock_quant (company_id, product_id, warehouse_id, quantity)
SELECT sm.company_id, sm.product_id, sm.warehouse_id, SUM(sm.signed_quantity)
FROM public.stock_move sm
GROUP BY sm.company_id, sm.product_id, sm.warehouse_id
ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Validación por almacén y mantenimiento de stock_quant
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.stock_move_check_warehouse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enforce BOOLEAN;
    v_have    DECIMAL(15, 3);
    v_product TEXT;
    v_wh      TEXT;
BEGIN
    IF NEW.warehouse_id IS NULL THEN
        NEW.warehouse_id := public.get_or_create_default_warehouse(NEW.company_id);
    END IF;

    IF NEW.move_type = 'out' THEN
        SELECT enforce_warehouse_stock INTO v_enforce
        FROM public.inventory_settings WHERE company_id = NEW.company_id;

        IF COALESCE(v_enforce, true) THEN
            INSERT INTO public.stock_quant (company_id, product_id, warehouse_id, quantity)
            VALUES (NEW.company_id, NEW.product_id, NEW.warehouse_id, 0)
            ON CONFLICT (product_id, warehouse_id) DO NOTHING;

            SELECT quantity INTO v_have
            FROM public.stock_quant
            WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
            FOR UPDATE;

            IF COALESCE(v_have, 0) < NEW.quantity - 0.0005 THEN
                SELECT COALESCE(NULLIF(btrim(display_name), ''), name) INTO v_product
                FROM public.product WHERE id = NEW.product_id;
                SELECT name INTO v_wh FROM public.warehouse WHERE id = NEW.warehouse_id;
                RAISE EXCEPTION 'Stock insuficiente de «%» en el almacén «%»: hay %, se requieren %',
                    v_product, v_wh, COALESCE(v_have, 0), NEW.quantity;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_stock_move_check_warehouse ON public.stock_move;
CREATE TRIGGER trigger_stock_move_check_warehouse
    BEFORE INSERT ON public.stock_move
    FOR EACH ROW EXECUTE FUNCTION public.stock_move_check_warehouse();

CREATE OR REPLACE FUNCTION public.stock_move_update_quant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.stock_quant (company_id, product_id, warehouse_id, quantity)
    VALUES (NEW.company_id, NEW.product_id, NEW.warehouse_id, NEW.signed_quantity)
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET quantity = public.stock_quant.quantity + EXCLUDED.quantity,
                  updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_stock_move_update_quant ON public.stock_move;
CREATE TRIGGER trigger_stock_move_update_quant
    AFTER INSERT ON public.stock_move
    FOR EACH ROW EXECUTE FUNCTION public.stock_move_update_quant();


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Reservas y disponibilidad
-- ════════════════════════════════════════════════════════════════════════════
/** Unidades apartadas: líneas de pickings de salida en borrador o publicados. */
CREATE OR REPLACE FUNCTION public.get_reserved_stock(
    p_product_id   UUID,
    p_warehouse_id UUID DEFAULT NULL,
    p_exclude_order_id UUID DEFAULT NULL
)
RETURNS DECIMAL
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(pl.quantity), 0)
    FROM public.picking_line pl
    JOIN public.picking pk ON pk.id = pl.picking_id
    WHERE pl.product_id = p_product_id
      AND (p_warehouse_id IS NULL OR pk.warehouse_id = p_warehouse_id)
      AND pk.status IN ('borrador', 'publicado')
      AND pk.type = 'salida'
      AND NOT COALESCE(pk.is_return, false)
      AND COALESCE(pk.active, true)
      AND COALESCE(pl.active, true)
      AND (p_exclude_order_id IS NULL OR pk.order_id IS DISTINCT FROM p_exclude_order_id);
$$;

/** Disponible = existencia − reservado (en un almacén o en todos). */
CREATE OR REPLACE FUNCTION public.get_available_stock(
    p_product_id   UUID,
    p_warehouse_id UUID DEFAULT NULL,
    p_exclude_order_id UUID DEFAULT NULL
)
RETURNS DECIMAL
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT SUM(q.quantity) FROM public.stock_quant q
        WHERE q.product_id = p_product_id
          AND (p_warehouse_id IS NULL OR q.warehouse_id = p_warehouse_id)
    ), 0) - public.get_reserved_stock(p_product_id, p_warehouse_id, p_exclude_order_id);
$$;

REVOKE ALL ON FUNCTION public.get_reserved_stock(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_available_stock(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE VIEW public.v_stock_availability
WITH (security_invoker = true)
AS
SELECT
    q.company_id,
    q.product_id,
    q.warehouse_id,
    p.name  AS product_name,
    p.sku   AS product_sku,
    p.tracking,
    w.name  AS warehouse_name,
    w.code  AS warehouse_code,
    q.quantity AS on_hand,
    COALESCE(r.reserved, 0) AS reserved,
    q.quantity - COALESCE(r.reserved, 0) AS available,
    q.updated_at
FROM public.stock_quant q
JOIN public.product p   ON p.id = q.product_id
JOIN public.warehouse w ON w.id = q.warehouse_id
LEFT JOIN LATERAL (
    SELECT SUM(pl.quantity) AS reserved
    FROM public.picking_line pl
    JOIN public.picking pk ON pk.id = pl.picking_id
    WHERE pl.product_id = q.product_id
      AND pk.warehouse_id = q.warehouse_id
      AND pk.status IN ('borrador', 'publicado')
      AND pk.type = 'salida'
      AND NOT COALESCE(pk.is_return, false)
      AND COALESCE(pk.active, true)
      AND COALESCE(pl.active, true)
) r ON true;

COMMENT ON VIEW public.v_stock_availability IS
    'Existencia, reservado (pickings de salida abiertos) y disponible por producto y almacén.';

REVOKE ALL ON public.v_stock_availability FROM anon;
GRANT SELECT ON public.v_stock_availability TO authenticated;

/** Venta POS y validaciones: disponible en el almacén de salida. */
CREATE OR REPLACE FUNCTION public.assert_stock_available(
    p_product_id   UUID,
    p_warehouse_id UUID,
    p_quantity     DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product   RECORD;
    v_available DECIMAL(15, 3);
    v_wh        TEXT;
BEGIN
    SELECT id, name, display_name, is_stockable INTO v_product
    FROM public.product WHERE id = p_product_id;

    IF NOT COALESCE(v_product.is_stockable, true) THEN
        RETURN;
    END IF;

    v_available := public.get_available_stock(p_product_id, p_warehouse_id);

    IF v_available < COALESCE(p_quantity, 0) - 0.0005 THEN
        SELECT name INTO v_wh FROM public.warehouse WHERE id = p_warehouse_id;
        RAISE EXCEPTION 'Stock insuficiente para % en %: disponibles %',
            COALESCE(NULLIF(btrim(v_product.display_name), ''), v_product.name),
            COALESCE(v_wh, 'el almacén'), GREATEST(v_available, 0);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_stock_available(UUID, UUID, DECIMAL) FROM PUBLIC, anon, authenticated;

/**
 * Faltantes para surtir una orden: lo pendiente contra lo disponible en su
 * almacén, sin contar la reserva de la propia orden.
 */
CREATE OR REPLACE FUNCTION public.get_order_delivery_shortages(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order     RECORD;
    v_warehouse UUID;
    v_result    JSONB;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id;
    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Orden no encontrada';
    END IF;

    IF v_order.order_type <> 'sale' THEN
        RETURN '[]'::jsonb;
    END IF;

    v_warehouse := public.resolve_order_warehouse(p_order_id);

    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'product_name'), '[]'::jsonb) INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'product_id', ol.product_id,
            'product_name', MAX(COALESCE(NULLIF(btrim(p.display_name), ''), p.name)),
            'pending', SUM(public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered,
                                                             ol.quantity_returned, ol.quantity_refunded)),
            'available', GREATEST(public.get_available_stock(ol.product_id, v_warehouse, p_order_id), 0)
        ) AS x
        FROM public.order_line ol
        JOIN public.product p ON p.id = ol.product_id
        WHERE ol.order_id = p_order_id AND COALESCE(p.is_stockable, true)
        GROUP BY ol.product_id
        HAVING SUM(public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered,
                                                      ol.quantity_returned, ol.quantity_refunded))
               > public.get_available_stock(ol.product_id, v_warehouse, p_order_id)
    ) s;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_delivery_shortages(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_delivery_shortages(UUID) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. Almacén de salida por orden, tienda y caja
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public."order"
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouse(id) ON DELETE SET NULL;

COMMENT ON COLUMN public."order".warehouse_id IS
    'Almacén de salida (venta) o de recepción (compra). NULL = el de la tienda, la caja o el predeterminado.';

ALTER TABLE public.storefront_settings
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouse(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.storefront_settings.warehouse_id IS
    'Almacén que surte la tienda en línea. NULL = el predeterminado.';

CREATE OR REPLACE FUNCTION public.validate_document_warehouse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.warehouse_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.warehouse
        WHERE id = NEW.warehouse_id AND company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION 'El almacén no pertenece a la empresa';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_validate_warehouse ON public."order";
CREATE TRIGGER trigger_order_validate_warehouse
    BEFORE INSERT OR UPDATE OF warehouse_id ON public."order"
    FOR EACH ROW EXECUTE FUNCTION public.validate_document_warehouse();

DROP TRIGGER IF EXISTS trigger_storefront_settings_validate_warehouse ON public.storefront_settings;
CREATE TRIGGER trigger_storefront_settings_validate_warehouse
    BEFORE INSERT OR UPDATE OF warehouse_id ON public.storefront_settings
    FOR EACH ROW EXECUTE FUNCTION public.validate_document_warehouse();

CREATE OR REPLACE FUNCTION public.resolve_order_warehouse(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_wh    UUID;
BEGIN
    SELECT company_id, warehouse_id, origin, pos_session_id INTO v_order
    FROM public."order" WHERE id = p_order_id;

    v_wh := v_order.warehouse_id;

    IF v_wh IS NULL AND v_order.pos_session_id IS NOT NULL THEN
        SELECT r.warehouse_id INTO v_wh
        FROM public.pos_session s
        JOIN public.pos_register r ON r.id = s.register_id
        WHERE s.id = v_order.pos_session_id;
    END IF;

    IF v_wh IS NULL AND v_order.origin = 'storefront' THEN
        SELECT warehouse_id INTO v_wh
        FROM public.storefront_settings WHERE company_id = v_order.company_id;
    END IF;

    RETURN COALESCE(v_wh, public.get_or_create_default_warehouse(v_order.company_id));
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_order_warehouse(UUID) FROM PUBLIC, anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. Lotes y series: asignación FIFO en salidas
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Redefine build_picking_lines (fase 2). En salidas de productos con lote o
 * serie toma los lotes/series con existencia en el almacén del picking, del
 * más antiguo al más reciente, descontando lo ya apartado en otros pickings
 * abiertos. Lo que no alcance queda con marcador para captura manual (nunca
 * bloquea la venta). Antes, el POS siempre escribía «VENTA-POS» y series
 * inventadas, y se perdía la trazabilidad.
 */
CREATE OR REPLACE FUNCTION public.build_picking_lines(
    p_picking_id   UUID,
    p_product_id   UUID,
    p_quantity     DECIMAL,
    p_sequence     INT DEFAULT 10,
    p_is_return    BOOLEAN DEFAULT false
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pick    RECORD;
    v_product RECORD;
    v_seq     INT := COALESCE(p_sequence, 10);
    v_left    DECIMAL(15, 3) := COALESCE(p_quantity, 0);
    v_take    DECIMAL(15, 3);
    r_lot     RECORD;
    v_allocate BOOLEAN;
BEGIN
    IF v_left <= 0 THEN
        RETURN v_seq;
    END IF;

    SELECT * INTO v_pick FROM public.picking WHERE id = p_picking_id;
    SELECT id, tracking, company_id INTO v_product FROM public.product WHERE id = p_product_id;

    IF v_product.id IS NULL OR v_product.company_id <> v_pick.company_id THEN
        RAISE EXCEPTION 'Producto % no pertenece a la empresa del movimiento', p_product_id;
    END IF;

    IF v_product.tracking = 'serial' AND MOD(v_left, 1) <> 0 THEN
        RAISE EXCEPTION 'Los productos con número de serie requieren cantidades enteras';
    END IF;

    v_allocate := NOT COALESCE(p_is_return, false) AND v_pick.type = 'salida';

    IF v_product.tracking = 'serial' AND v_allocate THEN
        FOR r_lot IN
            SELECT sm.serial_number
            FROM public.stock_move sm
            WHERE sm.product_id = p_product_id
              AND sm.warehouse_id = v_pick.warehouse_id
              AND sm.serial_number IS NOT NULL
              AND btrim(sm.serial_number) <> ''
            GROUP BY sm.serial_number
            HAVING SUM(sm.signed_quantity) > 0
               AND NOT EXISTS (
                   SELECT 1 FROM public.picking_line pl
                   JOIN public.picking pk ON pk.id = pl.picking_id
                   WHERE pl.product_id = p_product_id
                     AND pl.serial_number = sm.serial_number
                     AND pk.status IN ('borrador', 'publicado')
                     AND pk.type = 'salida'
                     AND COALESCE(pl.active, true)
               )
            ORDER BY MIN(sm.occurred_at)
            LIMIT v_left::INT
        LOOP
            INSERT INTO public.picking_line (
                company_id, picking_id, product_id, sequence, quantity,
                tracking_type, serial_number, created_by, updated_by
            ) VALUES (
                v_pick.company_id, p_picking_id, p_product_id, v_seq, 1, 'serial',
                r_lot.serial_number, auth.uid(), auth.uid()
            );
            v_seq := v_seq + 10;
            v_left := v_left - 1;
        END LOOP;
    ELSIF v_product.tracking = 'lot' AND v_allocate THEN
        FOR r_lot IN
            SELECT sm.lot_name, SUM(sm.signed_quantity) AS balance, MIN(sm.occurred_at) AS first_in
            FROM public.stock_move sm
            WHERE sm.product_id = p_product_id
              AND sm.warehouse_id = v_pick.warehouse_id
              AND sm.lot_name IS NOT NULL
              AND btrim(sm.lot_name) <> ''
            GROUP BY sm.lot_name
            HAVING SUM(sm.signed_quantity) > 0
            ORDER BY MIN(sm.occurred_at)
        LOOP
            EXIT WHEN v_left <= 0;

            v_take := r_lot.balance - COALESCE((
                SELECT SUM(pl.quantity)
                FROM public.picking_line pl
                JOIN public.picking pk ON pk.id = pl.picking_id
                WHERE pl.product_id = p_product_id
                  AND pl.lot_name = r_lot.lot_name
                  AND pk.warehouse_id = v_pick.warehouse_id
                  AND pk.status IN ('borrador', 'publicado')
                  AND pk.type = 'salida'
                  AND COALESCE(pl.active, true)
            ), 0);
            v_take := LEAST(v_left, GREATEST(v_take, 0));

            IF v_take > 0 THEN
                INSERT INTO public.picking_line (
                    company_id, picking_id, product_id, sequence, quantity,
                    tracking_type, lot_name, created_by, updated_by
                ) VALUES (
                    v_pick.company_id, p_picking_id, p_product_id, v_seq, v_take, 'lot',
                    r_lot.lot_name, auth.uid(), auth.uid()
                );
                v_seq := v_seq + 10;
                v_left := v_left - v_take;
            END IF;
        END LOOP;
    END IF;

    -- Lo que no se pudo asignar (o productos sin rastreo)
    IF v_left > 0 THEN
        IF v_product.tracking = 'serial' THEN
            FOR i IN 1..v_left::INT LOOP
                INSERT INTO public.picking_line (
                    company_id, picking_id, product_id, sequence, quantity,
                    tracking_type, serial_number, created_by, updated_by
                ) VALUES (
                    v_pick.company_id, p_picking_id, p_product_id, v_seq, 1, 'serial',
                    CASE WHEN p_is_return THEN 'RET-' ELSE 'SERIAL-PENDING-' END
                        || substr(gen_random_uuid()::TEXT, 1, 8),
                    auth.uid(), auth.uid()
                );
                v_seq := v_seq + 10;
            END LOOP;
        ELSIF v_product.tracking = 'lot' THEN
            INSERT INTO public.picking_line (
                company_id, picking_id, product_id, sequence, quantity,
                tracking_type, lot_name, created_by, updated_by
            ) VALUES (
                v_pick.company_id, p_picking_id, p_product_id, v_seq, v_left, 'lot',
                CASE WHEN p_is_return THEN 'DEVOLUCION' ELSE 'LOTE-PENDIENTE' END,
                auth.uid(), auth.uid()
            );
            v_seq := v_seq + 10;
        ELSE
            INSERT INTO public.picking_line (
                company_id, picking_id, product_id, sequence, quantity,
                tracking_type, created_by, updated_by
            ) VALUES (
                v_pick.company_id, p_picking_id, p_product_id, v_seq, v_left, 'none',
                auth.uid(), auth.uid()
            );
            v_seq := v_seq + 10;
        END IF;
    END IF;

    RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.build_picking_lines(UUID, UUID, DECIMAL, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;


/**
 * Ajuste por conteo. Con almacén: la cantidad es lo contado EN ESE almacén
 * (antes se comparaba contra el total de la empresa). Sin almacén: se conserva
 * el comportamiento anterior (total de la empresa, diferencia al predeterminado).
 */
CREATE OR REPLACE FUNCTION public.create_stock_adjustment(
    p_product_id   UUID,
    p_new_quantity DECIMAL,
    p_reason       TEXT,
    p_warehouse_id UUID DEFAULT NULL,
    p_unit_cost    DECIMAL DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product   RECORD;
    v_current   DECIMAL(15, 3);
    v_diff      DECIMAL(15, 3);
    v_move_id   UUID;
    v_warehouse UUID;
BEGIN
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'El ajuste de inventario requiere un motivo';
    END IF;

    SELECT * INTO v_product FROM public.product WHERE id = p_product_id;

    IF v_product.id IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF NOT public.user_belongs_to_company(v_product.company_id) THEN
        RAISE EXCEPTION 'Sin permiso sobre este producto';
    END IF;

    IF NOT COALESCE(v_product.is_stockable, true) THEN
        RAISE EXCEPTION 'Este producto no maneja inventario';
    END IF;

    IF COALESCE(p_new_quantity, 0) < 0 THEN
        RAISE EXCEPTION 'La cantidad contada no puede ser negativa';
    END IF;

    IF p_warehouse_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.warehouse WHERE id = p_warehouse_id AND company_id = v_product.company_id) THEN
            RAISE EXCEPTION 'Almacén no válido';
        END IF;
        v_warehouse := p_warehouse_id;
        SELECT COALESCE(quantity, 0) INTO v_current
        FROM public.stock_quant WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
        v_current := COALESCE(v_current, 0);
    ELSE
        v_warehouse := public.get_or_create_default_warehouse(v_product.company_id);
        v_current := COALESCE(v_product.stock_quantity, 0);
    END IF;

    v_diff := p_new_quantity - v_current;

    IF v_diff = 0 THEN
        RETURN jsonb_build_object('status', 'unchanged', 'stock_quantity', v_product.stock_quantity);
    END IF;

    v_move_id := public.record_stock_move(
        p_company_id      => v_product.company_id,
        p_product_id      => p_product_id,
        p_move_type       => CASE WHEN v_diff > 0 THEN 'in'::public.stock_move_type
                                  ELSE 'out'::public.stock_move_type END,
        p_quantity        => ABS(v_diff),
        p_origin          => 'adjustment',
        p_warehouse_id    => v_warehouse,
        p_unit_cost       => p_unit_cost,
        p_reference       => 'Ajuste de inventario',
        p_notes           => p_reason
    );

    SELECT stock_quantity INTO v_current FROM public.product WHERE id = p_product_id;

    RETURN jsonb_build_object(
        'status', 'ok',
        'move_id', v_move_id,
        'difference', v_diff,
        'stock_quantity', v_current
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_adjustment(UUID, DECIMAL, TEXT, UUID, DECIMAL) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_adjustment(UUID, DECIMAL, TEXT, UUID, DECIMAL) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. Traspasos entre almacenes
-- ════════════════════════════════════════════════════════════════════════════
ALTER TYPE public.stock_move_origin ADD VALUE IF NOT EXISTS 'transfer';

/**
 * Mueve existencias de un almacén a otro: una salida y una entrada al costo
 * promedio vigente (el valor total del inventario no cambia).
 */
CREATE OR REPLACE FUNCTION public.transfer_stock(
    p_product_id        UUID,
    p_from_warehouse_id UUID,
    p_to_warehouse_id   UUID,
    p_quantity          DECIMAL,
    p_lot_name          TEXT DEFAULT NULL,
    p_serial_number     TEXT DEFAULT NULL,
    p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product RECORD;
    v_from    RECORD;
    v_to      RECORD;
    v_cost    DECIMAL(15, 4);
    v_ref     TEXT;
    v_out     UUID;
    v_in      UUID;
BEGIN
    SELECT * INTO v_product FROM public.product WHERE id = p_product_id;
    IF v_product.id IS NULL OR NOT public.user_belongs_to_company(v_product.company_id) THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF NOT COALESCE(v_product.is_stockable, true) THEN
        RAISE EXCEPTION 'El producto no lleva inventario';
    END IF;

    SELECT * INTO v_from FROM public.warehouse WHERE id = p_from_warehouse_id AND company_id = v_product.company_id;
    SELECT * INTO v_to   FROM public.warehouse WHERE id = p_to_warehouse_id   AND company_id = v_product.company_id;

    IF v_from.id IS NULL OR v_to.id IS NULL THEN
        RAISE EXCEPTION 'Almacén no válido';
    END IF;

    IF v_from.id = v_to.id THEN
        RAISE EXCEPTION 'El almacén de origen y destino deben ser distintos';
    END IF;

    IF COALESCE(p_quantity, 0) <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a cero';
    END IF;

    IF v_product.tracking = 'lot' AND NULLIF(btrim(COALESCE(p_lot_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Indica el lote a traspasar';
    END IF;

    IF v_product.tracking = 'serial' THEN
        IF NULLIF(btrim(COALESCE(p_serial_number, '')), '') IS NULL OR p_quantity <> 1 THEN
            RAISE EXCEPTION 'Los productos con serie se traspasan de uno en uno, indicando la serie';
        END IF;
    END IF;

    -- No se puede traspasar lo que ya está apartado para entregas
    IF public.get_available_stock(p_product_id, p_from_warehouse_id) < p_quantity - 0.0005 THEN
        RAISE EXCEPTION 'Solo hay % disponibles en %', GREATEST(public.get_available_stock(p_product_id, p_from_warehouse_id), 0), v_from.name;
    END IF;

    v_cost := COALESCE(NULLIF(v_product.avg_cost, 0), v_product.cost_price, 0);
    v_ref  := format('TRASPASO %s → %s', COALESCE(v_from.code, v_from.name), COALESCE(v_to.code, v_to.name));

    v_out := public.record_stock_move(
        p_company_id    => v_product.company_id,
        p_product_id    => p_product_id,
        p_move_type     => 'out',
        p_quantity      => p_quantity,
        p_origin        => 'transfer',
        p_warehouse_id  => p_from_warehouse_id,
        p_unit_cost     => v_cost,
        p_lot_name      => NULLIF(btrim(COALESCE(p_lot_name, '')), ''),
        p_serial_number => NULLIF(btrim(COALESCE(p_serial_number, '')), ''),
        p_reference     => v_ref,
        p_notes         => NULLIF(btrim(COALESCE(p_notes, '')), '')
    );

    v_in := public.record_stock_move(
        p_company_id    => v_product.company_id,
        p_product_id    => p_product_id,
        p_move_type     => 'in',
        p_quantity      => p_quantity,
        p_origin        => 'transfer',
        p_warehouse_id  => p_to_warehouse_id,
        p_unit_cost     => v_cost,
        p_lot_name      => NULLIF(btrim(COALESCE(p_lot_name, '')), ''),
        p_serial_number => NULLIF(btrim(COALESCE(p_serial_number, '')), ''),
        p_reference     => v_ref,
        p_notes         => NULLIF(btrim(COALESCE(p_notes, '')), '')
    );

    RETURN jsonb_build_object('out_move_id', v_out, 'in_move_id', v_in, 'reference', v_ref);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_stock(UUID, UUID, UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_stock(UUID, UUID, UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 7. Checkout de la tienda: valida lo disponible en el almacén de la tienda
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Copia íntegra de place_storefront_order (20260717120000_add_stripe_to_storefront)
 * con un único cambio: la validación de stock usa lo disponible (existencia −
 * reservas) en el almacén de la tienda, en lugar del saldo global. Así una
 * venta del POS o del panel ya preparada no se vuelve a vender en línea.
 */
CREATE OR REPLACE FUNCTION public.place_storefront_order(
    p_slug TEXT,
    p_checkout_token UUID,
    p_customer JSONB,
    p_items JSONB,
    p_shipping_method_id UUID,
    p_payment_method_id UUID DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_payment_provider TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_company public.company%ROWTYPE;
    v_settings public.storefront_settings%ROWTYPE;
    v_existing public."order"%ROWTYPE;
    v_item JSONB;
    v_product public.product%ROWTYPE;
    v_shipping public.storefront_shipping_method%ROWTYPE;
    v_coupon public.storefront_coupon%ROWTYPE;
    v_partner_id UUID;
    v_order public."order"%ROWTYPE;
    v_order_id UUID;
    v_sequence INT := 10;
    v_qty DECIMAL(15, 3);
    v_email TEXT;
    v_name TEXT;
    v_provider TEXT;
    v_subtotal DECIMAL(15, 2) := 0;
    v_discount_percent DECIMAL(5, 2) := 0;
    v_coupon_discount DECIMAL(15, 2) := 0;
    v_sf_warehouse UUID;
    v_available DECIMAL(15, 3);
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'store_not_found',
            'message', 'La tienda no existe o está desactivada.');
    END IF;

    SELECT * INTO v_company FROM public.company WHERE id = v_company_id;
    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;
    v_sf_warehouse := COALESCE(v_settings.warehouse_id, public.get_or_create_default_warehouse(v_company_id));

    IF p_checkout_token IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'missing_token',
            'message', 'Falta el token de la compra.');
    END IF;

    -- Idempotencia: si el token ya generó una orden, devolverla sin duplicar
    SELECT * INTO v_existing
    FROM public."order" o
    WHERE o.checkout_token = p_checkout_token;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'status', 'ok',
            'duplicate', true,
            'order_id', v_existing.id,
            'order_ref', v_existing.name,
            'amount_total', v_existing.amount_total,
            'currency', v_existing.currency,
            'payment_provider', v_existing.payment_provider,
            'payment_status', v_existing.payment_status
        );
    END IF;

    -- Validaciones de entrada
    v_email := lower(btrim(COALESCE(p_customer->>'email', '')));
    v_name  := btrim(COALESCE(p_customer->>'name', ''));

    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_email',
            'message', 'El correo electrónico no es válido.');
    END IF;

    IF v_name = '' THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_name',
            'message', 'El nombre es obligatorio.');
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'empty_cart',
            'message', 'El carrito está vacío.');
    END IF;

    -- Método de envío
    SELECT * INTO v_shipping
    FROM public.storefront_shipping_method sm
    WHERE sm.id = p_shipping_method_id
      AND sm.company_id = v_company_id
      AND COALESCE(sm.active, true) = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_shipping',
            'message', 'El método de envío no es válido.');
    END IF;

    -- Método de pago: pasarela (stripe) o catálogo payment_method de la empresa
    v_provider := NULLIF(lower(btrim(COALESCE(p_payment_provider, ''))), '');

    IF v_provider IS NOT NULL AND v_provider <> 'stripe' THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_payment',
            'message', 'La pasarela de pago no es válida.');
    END IF;

    IF v_provider = 'stripe' THEN
        IF NOT (
            COALESCE(v_settings.stripe_enabled, false)
            AND NULLIF(btrim(COALESCE(v_settings.stripe_secret_key, '')), '') IS NOT NULL
            AND NULLIF(btrim(COALESCE(v_settings.stripe_publishable_key, '')), '') IS NOT NULL
        ) THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'stripe_unavailable',
                'message', 'El pago con tarjeta no está disponible en esta tienda.');
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1 FROM public.payment_method pm
        WHERE pm.id = p_payment_method_id
          AND pm.company_id = v_company_id
          AND COALESCE(pm.active, true) = true
    ) THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_payment',
            'message', 'El método de pago no es válido.');
    END IF;

    -- Validar productos y stock (con bloqueo de fila para evitar carreras)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::DECIMAL, 0);
        IF v_qty <= 0 THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'invalid_quantity',
                'message', 'Las cantidades deben ser mayores a cero.');
        END IF;

        SELECT * INTO v_product
        FROM public.product p
        WHERE p.id = NULLIF(v_item->>'product_id', '')::UUID
          AND p.company_id = v_company_id
          AND p.is_published = true
          AND p.can_be_sold = true
          AND p.status = 'active'
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'product_unavailable',
                'message', 'Uno de los productos ya no está disponible.');
        END IF;

        -- Disponible en el almacén de la tienda (existencia − reservas)
        v_available := public.get_available_stock(v_product.id, v_sf_warehouse);
        IF COALESCE(v_product.is_stockable, true)
           AND v_available < v_qty THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'insufficient_stock',
                'message', format(
                    'Stock insuficiente para «%s»: quedan %s unidades.',
                    COALESCE(NULLIF(btrim(v_product.display_name), ''), v_product.name),
                    GREATEST(v_available, 0)
                ),
                'product_id', v_product.id,
                'available', GREATEST(v_available, 0)
            );
        END IF;

        v_subtotal := v_subtotal + ROUND(COALESCE(v_product.sale_price, 0) * v_qty, 2);
    END LOOP;

    -- Cupón (bloqueado para incremento atómico del contador de usos)
    IF p_coupon_code IS NOT NULL AND btrim(p_coupon_code) <> '' THEN
        SELECT * INTO v_coupon
        FROM public.storefront_coupon sc
        WHERE sc.company_id = v_company_id
          AND sc.code = upper(btrim(p_coupon_code))
          AND COALESCE(sc.active, true) = true
        FOR UPDATE;

        IF NOT FOUND
           OR (v_coupon.starts_at IS NOT NULL AND CURRENT_DATE < v_coupon.starts_at)
           OR (v_coupon.expires_at IS NOT NULL AND CURRENT_DATE > v_coupon.expires_at)
           OR (v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit)
           OR (COALESCE(v_coupon.min_purchase, 0) > v_subtotal) THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'invalid_coupon',
                'message', 'El cupón no es válido para esta compra.');
        END IF;

        IF v_coupon.discount_type = 'percent' THEN
            v_discount_percent := LEAST(v_coupon.discount_value, 100);
            v_coupon_discount := ROUND(v_subtotal * v_discount_percent / 100, 2);
        ELSE
            v_coupon_discount := LEAST(v_coupon.discount_value, v_subtotal);
        END IF;
    END IF;

    -- Cliente: reutilizar el partner de negocio por email o crearlo
    SELECT p.id INTO v_partner_id
    FROM public.partner p
    INNER JOIN public.rel_partner_company rpc
        ON rpc.partner_id = p.id
       AND rpc.company_id = v_company_id
       AND rpc.relationship_type = 'partner'
       AND rpc.is_active = true
    WHERE lower(p.email) = v_email
    ORDER BY p.created_at
    LIMIT 1;

    IF v_partner_id IS NULL THEN
        INSERT INTO public.partner (name, email, phone, company_type)
        VALUES (v_name, v_email, NULLIF(btrim(COALESCE(p_customer->>'phone', '')), ''), 'person')
        RETURNING id INTO v_partner_id;

        INSERT INTO public.rel_partner_company (
            partner_id, company_id, role, invitation_status,
            relationship_type, is_default, is_active, accepted_at
        ) VALUES (
            v_partner_id, v_company_id, 'guest', 'accepted',
            'partner', false, true, now()
        );
    END IF;

    -- Crear la orden (borrador; los triggers calculan los totales por línea)
    INSERT INTO public."order" (
        company_id, order_type, partner_id, order_state,
        currency, tax_rate, tax_included,
        origin, checkout_token,
        customer_name, customer_email, customer_phone,
        shipping_method_name, shipping_cost,
        coupon_code, coupon_discount,
        shipping_street, shipping_street2, shipping_city,
        shipping_state, shipping_zip, shipping_country_code,
        payment_method_id, payment_status, payment_provider,
        notes
    ) VALUES (
        v_company_id, 'sale', v_partner_id, 'draft',
        COALESCE(v_company.currency, 'MXN'), 0, false,
        'storefront', p_checkout_token,
        v_name, v_email, NULLIF(btrim(COALESCE(p_customer->>'phone', '')), ''),
        v_shipping.name, v_shipping.price,
        v_coupon.code, v_coupon_discount,
        NULLIF(btrim(COALESCE(p_customer->>'street', '')), ''),
        NULLIF(btrim(COALESCE(p_customer->>'street2', '')), ''),
        NULLIF(btrim(COALESCE(p_customer->>'city', '')), ''),
        NULLIF(btrim(COALESCE(p_customer->>'state', '')), ''),
        NULLIF(btrim(COALESCE(p_customer->>'zip', '')), ''),
        COALESCE(NULLIF(btrim(COALESCE(p_customer->>'country_code', '')), ''), 'MX'),
        CASE WHEN v_provider = 'stripe' THEN NULL ELSE p_payment_method_id END,
        'unpaid', v_provider,
        NULLIF(btrim(COALESCE(p_notes, '')), '')
    )
    RETURNING id INTO v_order_id;

    -- Líneas de producto con precios del servidor
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT * INTO v_product
        FROM public.product p
        WHERE p.id = (v_item->>'product_id')::UUID;

        INSERT INTO public.order_line (
            order_id, product_id, sequence, description,
            quantity, unit_price, unit_cost, discount_percent, tax_rate, uom_id
        ) VALUES (
            v_order_id,
            v_product.id,
            v_sequence,
            COALESCE(NULLIF(btrim(v_product.display_name), ''), v_product.name),
            (v_item->>'quantity')::DECIMAL,
            COALESCE(v_product.sale_price, 0),
            COALESCE(v_product.cost_price, 0),
            v_discount_percent,
            COALESCE(v_product.tax_rate, 0),
            v_product.uom_id
        );
        v_sequence := v_sequence + 10;
    END LOOP;

    -- Cupón de monto fijo: línea negativa (los porcentuales van por línea)
    IF v_coupon.id IS NOT NULL AND v_coupon.discount_type = 'fixed' AND v_coupon_discount > 0 THEN
        INSERT INTO public.order_line (
            order_id, sequence, description, quantity, unit_price, tax_rate
        ) VALUES (
            v_order_id, v_sequence,
            format('Cupón %s', v_coupon.code),
            1, -v_coupon_discount, 0
        );
        v_sequence := v_sequence + 10;
    END IF;

    -- Envío como línea para que los triggers lo sumen al total
    IF COALESCE(v_shipping.price, 0) > 0 THEN
        INSERT INTO public.order_line (
            order_id, sequence, description, quantity, unit_price, tax_rate
        ) VALUES (
            v_order_id, v_sequence,
            format('Envío — %s', v_shipping.name),
            1, v_shipping.price, 0
        );
    END IF;

    -- Confirmar la orden (el stock se descuenta al confirmar el picking de
    -- entrega, como en el resto del ERP)
    UPDATE public."order"
    SET order_state = 'posted',
        confirmation_date = now()
    WHERE id = v_order_id;

    -- Registrar el uso del cupón
    IF v_coupon.id IS NOT NULL THEN
        UPDATE public.storefront_coupon
        SET usage_count = usage_count + 1
        WHERE id = v_coupon.id;
    END IF;

    SELECT * INTO v_order FROM public."order" WHERE id = v_order_id;

    RETURN jsonb_build_object(
        'status', 'ok',
        'duplicate', false,
        'order_id', v_order.id,
        'order_ref', v_order.name,
        'amount_untaxed', v_order.amount_untaxed,
        'amount_tax', v_order.amount_tax,
        'amount_total', v_order.amount_total,
        'currency', v_order.currency,
        'payment_provider', v_order.payment_provider,
        'payment_status', v_order.payment_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.place_storefront_order(TEXT, UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_storefront_order(TEXT, UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.place_storefront_order(TEXT, UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT, TEXT) IS
    'Crea una orden de venta origin=storefront con precios/stock/impuestos validados en servidor. Idempotente por checkout_token. p_payment_provider=stripe crea la orden pendiente de pago con tarjeta.';


-- ════════════════════════════════════════════════════════════════════════════
-- 8. Vistas
-- ════════════════════════════════════════════════════════════════════════════
-- v_orders re-expande o.* con warehouse_id
DROP VIEW IF EXISTS public.v_orders;
CREATE VIEW public.v_orders
WITH (security_invoker = true)
AS
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
    (SELECT COUNT(*) FROM public.order_line ol WHERE ol.order_id = o.id) AS line_count,
    GREATEST(COALESCE(o.amount_total, 0) - COALESCE(o.amount_refunded, 0) - COALESCE(o.amount_paid, 0), 0)
        AS balance_due,
    pm.name AS payment_method_name,
    w.name AS warehouse_name
FROM public."order" o
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.partner cbp ON cbp.id = o.created_by_partner_id
LEFT JOIN public.company c ON c.id = o.company_id
LEFT JOIN public.project pr ON pr.id = o.project_id
LEFT JOIN public.payment_method pm ON pm.id = o.payment_method_id
LEFT JOIN public.warehouse w ON w.id = o.warehouse_id;

REVOKE ALL ON public.v_orders FROM anon;
GRANT SELECT ON public.v_orders TO authenticated;
