-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  create_inventory_traceability_module                                     ║
-- ║                                                                           ║
-- ║  Convierte el inventario de «un número editable» a un libro de            ║
-- ║  movimientos auditable:                                                   ║
-- ║                                                                           ║
-- ║   1. stock_move: asiento inmutable de cada entrada y salida, con costo,   ║
-- ║      origen, almacén y saldo resultante.                                  ║
-- ║   2. product.stock_quantity deja de poder editarse a mano: solo cambia    ║
-- ║      desde el libro (confirmación de picking o ajuste registrado).        ║
-- ║   3. Costo promedio ponderado por producto para valorar el inventario.    ║
-- ║   4. Origen tipificado del movimiento (venta, compra, POS, tienda,        ║
-- ║      ajuste, devolución, inicial).                                        ║
-- ║   5. Reportes: stock actual, valoración y kardex por producto.            ║
-- ║   6. Alertas de stock bajo/negativo que generan tareas en la agenda.      ║
-- ║                                                                           ║
-- ║  Todos los cambios de stock siguen pasando por apply_picking_inventory,   ║
-- ║  que era ya el único punto de mutación: aquí se le agrega el asiento.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Tipos ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_move_type') THEN
        CREATE TYPE public.stock_move_type AS ENUM ('in', 'out');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_move_origin') THEN
        CREATE TYPE public.stock_move_origin AS ENUM (
            'initial',      -- saldo inicial al implantar el libro
            'purchase',     -- entrada por orden de compra
            'sale',         -- salida por orden de venta del panel
            'pos',          -- salida por venta en punto de venta
            'storefront',   -- salida por pedido de la tienda en línea
            'return_in',    -- devolución de cliente (entra)
            'return_out',   -- devolución a proveedor (sale)
            'adjustment',   -- ajuste manual registrado
            'manual'        -- movimiento de almacén sin documento asociado
        );
    END IF;
END$$;

-- ── Origen tipificado en el picking ─────────────────────────────────────────
ALTER TABLE public.picking
    ADD COLUMN IF NOT EXISTS origin public.stock_move_origin;

COMMENT ON COLUMN public.picking.origin IS
    'Qué originó el movimiento. Se deduce en el trigger cuando no se indica explícitamente.';

-- ── Costo promedio ponderado del producto ───────────────────────────────────
ALTER TABLE public.product
    ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(15, 4) DEFAULT 0.0000;

COMMENT ON COLUMN public.product.avg_cost IS
    'Costo promedio ponderado, recalculado en cada entrada. Base de la valoración del inventario.';

-- ── Libro de movimientos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_move (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    product_id   UUID NOT NULL REFERENCES public.product(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES public.warehouse(id) ON DELETE SET NULL,

    move_type    public.stock_move_type   NOT NULL,
    origin       public.stock_move_origin NOT NULL DEFAULT 'manual',

    -- Cantidad siempre positiva; el signo lo da move_type.
    quantity     DECIMAL(15, 3) NOT NULL,
    -- Cantidad con signo, para poder sumar el saldo directamente.
    signed_quantity DECIMAL(15, 3) NOT NULL,

    -- Fotografía del costo en el instante del movimiento: sin esto la
    -- valoración histórica sería imposible de reconstruir.
    unit_cost    DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
    total_cost   DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,

    -- Saldo del producto después de aplicar este movimiento.
    balance_after DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    -- Costo promedio vigente después del movimiento.
    avg_cost_after DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,

    -- Trazabilidad hacia el documento que lo provocó
    picking_id      UUID REFERENCES public.picking(id) ON DELETE SET NULL,
    picking_line_id UUID REFERENCES public.picking_line(id) ON DELETE SET NULL,
    order_id        UUID REFERENCES public.order(id) ON DELETE SET NULL,

    lot_name      VARCHAR(120),
    serial_number VARCHAR(120),

    reference   VARCHAR(180),
    notes       TEXT,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CHECK (quantity > 0),
    CHECK (
        (move_type = 'in'  AND signed_quantity > 0) OR
        (move_type = 'out' AND signed_quantity < 0)
    )
);

COMMENT ON TABLE public.stock_move IS
    'Libro de movimientos de inventario. Append-only: no se actualiza ni se borra.';

CREATE INDEX IF NOT EXISTS idx_stock_move_company    ON public.stock_move(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_move_product    ON public.stock_move(product_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_move_warehouse  ON public.stock_move(company_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_move_picking    ON public.stock_move(picking_id) WHERE picking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_move_order      ON public.stock_move(order_id)   WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_move_origin     ON public.stock_move(company_id, origin, occurred_at DESC);

-- El libro es inmutable: cualquier corrección es un movimiento nuevo.
CREATE OR REPLACE FUNCTION public.stock_move_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'El libro de inventario es inmutable: registra un movimiento de ajuste en lugar de modificar o borrar asientos.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stock_move_append_only ON public.stock_move;
CREATE TRIGGER trigger_stock_move_append_only
    BEFORE UPDATE OR DELETE ON public.stock_move
    FOR EACH ROW EXECUTE FUNCTION public.stock_move_is_append_only();

ALTER TABLE public.stock_move ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company stock moves" ON public.stock_move;
CREATE POLICY "Users can view company stock moves" ON public.stock_move
    FOR SELECT USING (public.user_belongs_to_company(company_id));

-- La escritura ocurre solo dentro de funciones SECURITY DEFINER.
DROP POLICY IF EXISTS "Stock moves are written by the system" ON public.stock_move;
CREATE POLICY "Stock moves are written by the system" ON public.stock_move
    FOR INSERT WITH CHECK (false);

-- ── Configuración de inventario por empresa ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_settings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL UNIQUE REFERENCES public.company(id) ON DELETE CASCADE,

    -- Generar tareas de reabastecimiento automáticamente al caer bajo el mínimo
    auto_restock_tasks BOOLEAN NOT NULL DEFAULT true,
    -- A quién se asignan esas tareas (debe verlas en su agenda)
    restock_responsible_partner_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,
    -- Proyecto interno donde viven las tareas de reabastecimiento
    restock_project_id UUID REFERENCES public.project(id) ON DELETE SET NULL,
    -- Días de holgura para la fecha límite de la tarea
    restock_lead_days SMALLINT NOT NULL DEFAULT 3,

    active     BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CHECK (restock_lead_days BETWEEN 0 AND 90)
);

ALTER TABLE public.inventory_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view inventory settings" ON public.inventory_settings;
CREATE POLICY "Users can view inventory settings" ON public.inventory_settings
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage inventory settings" ON public.inventory_settings;
CREATE POLICY "Users can manage inventory settings" ON public.inventory_settings
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

DROP TRIGGER IF EXISTS trigger_inventory_settings_updated_at ON public.inventory_settings;
CREATE TRIGGER trigger_inventory_settings_updated_at
    BEFORE UPDATE ON public.inventory_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_inventory_settings_company ON public.inventory_settings(company_id);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Núcleo: registrar un asiento y mover el stock                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Registra un movimiento y actualiza el saldo y el costo promedio del producto.
 *
 * Es la ÚNICA vía por la que product.stock_quantity puede cambiar: activa la
 * bandera de sesión `flowbit.stock_ledger` que el trigger de protección exige.
 *
 * Costo promedio ponderado: solo se recalcula en las entradas con costo. Las
 * salidas se valoran al promedio vigente, que es como se valora el inventario
 * en la mayoría de los ERP.
 */
CREATE OR REPLACE FUNCTION public.record_stock_move(
    p_company_id    UUID,
    p_product_id    UUID,
    p_move_type     public.stock_move_type,
    p_quantity      DECIMAL,
    p_origin        public.stock_move_origin DEFAULT 'manual',
    p_warehouse_id  UUID DEFAULT NULL,
    p_unit_cost     DECIMAL DEFAULT NULL,
    p_picking_id    UUID DEFAULT NULL,
    p_picking_line_id UUID DEFAULT NULL,
    p_order_id      UUID DEFAULT NULL,
    p_lot_name      VARCHAR DEFAULT NULL,
    p_serial_number VARCHAR DEFAULT NULL,
    p_reference     VARCHAR DEFAULT NULL,
    p_notes         TEXT DEFAULT NULL,
    p_occurred_at   TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product      RECORD;
    v_signed       DECIMAL(15, 3);
    v_unit_cost    DECIMAL(15, 4);
    v_balance      DECIMAL(15, 3);
    v_current_avg  DECIMAL(15, 4);
    v_new_avg      DECIMAL(15, 4);
    v_move_id      UUID;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad del movimiento debe ser mayor que cero';
    END IF;

    SELECT * INTO v_product
    FROM public.product
    WHERE id = p_product_id AND company_id = p_company_id
    FOR UPDATE;

    IF v_product.id IS NULL THEN
        RAISE EXCEPTION 'Producto % no encontrado en la empresa', p_product_id;
    END IF;

    -- Los servicios y los productos no inventariables no llevan libro.
    IF NOT COALESCE(v_product.is_stockable, true) THEN
        RETURN NULL;
    END IF;

    v_signed := CASE WHEN p_move_type = 'in' THEN p_quantity ELSE -p_quantity END;

    -- Costo del movimiento: el indicado, o el costo de reposición del producto.
    v_unit_cost := COALESCE(
        NULLIF(p_unit_cost, 0),
        NULLIF(v_product.avg_cost, 0),
        v_product.cost_price,
        0
    );

    v_balance := COALESCE(v_product.stock_quantity, 0) + v_signed;

    -- Costo con el que está valorado el saldo actual. Si el promedio todavía no
    -- se ha calculado (producto recién dado de alta) se usa su costo de
    -- reposición: ignorarlo subvaluaría el inventario existente.
    v_current_avg := COALESCE(NULLIF(v_product.avg_cost, 0), v_product.cost_price, 0);

    -- Promedio ponderado: solo lo mueven las entradas.
    IF p_move_type = 'in' THEN
        IF COALESCE(v_product.stock_quantity, 0) <= 0 THEN
            -- Sin saldo previo el promedio es el costo de esta entrada.
            v_new_avg := v_unit_cost;
        ELSE
            v_new_avg := (
                (COALESCE(v_product.stock_quantity, 0) * v_current_avg)
                + (p_quantity * v_unit_cost)
            ) / NULLIF(COALESCE(v_product.stock_quantity, 0) + p_quantity, 0);
        END IF;
    ELSE
        v_new_avg := v_current_avg;
    END IF;

    v_new_avg := COALESCE(v_new_avg, 0);

    INSERT INTO public.stock_move (
        company_id, product_id, warehouse_id, move_type, origin,
        quantity, signed_quantity, unit_cost, total_cost,
        balance_after, avg_cost_after,
        picking_id, picking_line_id, order_id,
        lot_name, serial_number, reference, notes, occurred_at, created_by
    ) VALUES (
        p_company_id, p_product_id, p_warehouse_id, p_move_type, p_origin,
        p_quantity, v_signed, v_unit_cost, ROUND(p_quantity * v_unit_cost, 4),
        v_balance, v_new_avg,
        p_picking_id, p_picking_line_id, p_order_id,
        p_lot_name, p_serial_number, p_reference, p_notes,
        COALESCE(p_occurred_at, now()), auth.uid()
    )
    RETURNING id INTO v_move_id;

    -- Bandera de sesión: autoriza al trigger de protección a dejar pasar
    -- este cambio de stock, que viene respaldado por un asiento.
    PERFORM set_config('flowbit.stock_ledger', 'on', true);

    UPDATE public.product
    SET stock_quantity = v_balance,
        avg_cost       = v_new_avg,
        updated_by     = COALESCE(auth.uid(), updated_by)
    WHERE id = p_product_id;

    PERFORM set_config('flowbit.stock_ledger', 'off', true);

    RETURN v_move_id;
END;
$$;

COMMENT ON FUNCTION public.record_stock_move IS
    'Única vía de cambio de product.stock_quantity: escribe el asiento y actualiza saldo y costo promedio.';

-- ── Protección: el stock no se edita a mano ─────────────────────────────────
/**
 * Antes de esta migración cualquiera podía reescribir stock_quantity desde el
 * formulario de producto y el inventario quedaba sin explicación. Ahora un
 * cambio directo se rechaza y debe pasar por un ajuste registrado.
 */
CREATE OR REPLACE FUNCTION public.protect_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
       AND COALESCE(current_setting('flowbit.stock_ledger', true), 'off') <> 'on' THEN
        RAISE EXCEPTION
            'El stock no se modifica directamente. Usa un ajuste de inventario (create_stock_adjustment) o confirma un movimiento.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_product_stock ON public.product;
CREATE TRIGGER trigger_protect_product_stock
    BEFORE UPDATE ON public.product
    FOR EACH ROW EXECUTE FUNCTION public.protect_product_stock();

-- ── Ajuste manual registrado ────────────────────────────────────────────────
/**
 * Corrección de inventario con justificación obligatoria: fija el stock a la
 * cantidad contada y deja el asiento con la diferencia.
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
    v_diff      DECIMAL(15, 3);
    v_move_id   UUID;
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

    v_diff := p_new_quantity - COALESCE(v_product.stock_quantity, 0);

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
        p_warehouse_id    => COALESCE(p_warehouse_id, public.get_or_create_default_warehouse(v_product.company_id)),
        p_unit_cost       => p_unit_cost,
        p_reference       => 'Ajuste de inventario',
        p_notes           => p_reason
    );

    RETURN jsonb_build_object(
        'status', 'ok',
        'move_id', v_move_id,
        'difference', v_diff,
        'stock_quantity', p_new_quantity
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_adjustment(UUID, DECIMAL, TEXT, UUID, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_adjustment(UUID, DECIMAL, TEXT, UUID, DECIMAL) TO authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Origen del movimiento                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Deduce el origen a partir de los datos del movimiento.
 *
 * Recibe los valores sueltos —y no el id del picking— porque también se usa
 * desde un trigger BEFORE INSERT, momento en el que la fila todavía no existe
 * en la tabla y no se podría releer.
 */
CREATE OR REPLACE FUNCTION public.derive_stock_origin(
    p_order_id   UUID,
    p_type       public.picking_type,
    p_is_return  BOOLEAN
)
RETURNS public.stock_move_origin
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Devoluciones: el picking invierte el sentido del documento
    IF COALESCE(p_is_return, false) THEN
        RETURN CASE WHEN p_type = 'entrada' THEN 'return_in' ELSE 'return_out' END;
    END IF;

    IF p_order_id IS NULL THEN
        RETURN 'manual';
    END IF;

    SELECT * INTO v_order FROM public.order WHERE id = p_order_id;
    IF v_order.id IS NULL THEN
        RETURN 'manual';
    END IF;

    -- El canal de la orden distingue panel, POS y tienda en línea
    IF v_order.order_type = 'sale' THEN
        RETURN CASE COALESCE(v_order.origin::TEXT, 'dashboard')
            WHEN 'pos'        THEN 'pos'::public.stock_move_origin
            WHEN 'storefront' THEN 'storefront'::public.stock_move_origin
            ELSE 'sale'::public.stock_move_origin
        END;
    END IF;

    IF v_order.order_type = 'purchase' THEN
        RETURN 'purchase';
    END IF;

    RETURN 'manual';
END;
$$;

/** Origen de un picking ya existente: respeta el que tenga sellado. */
CREATE OR REPLACE FUNCTION public.resolve_picking_origin(p_picking_id UUID)
RETURNS public.stock_move_origin
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pick RECORD;
BEGIN
    SELECT * INTO v_pick FROM public.picking WHERE id = p_picking_id;

    IF v_pick.id IS NULL THEN
        RETURN 'manual';
    END IF;

    IF v_pick.origin IS NOT NULL THEN
        RETURN v_pick.origin;
    END IF;

    RETURN public.derive_stock_origin(v_pick.order_id, v_pick.type, v_pick.is_return);
END;
$$;

-- Sella el origen al crear el picking, para que quede en el documento.
CREATE OR REPLACE FUNCTION public.stamp_picking_origin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.origin IS NULL THEN
        NEW.origin := public.derive_stock_origin(NEW.order_id, NEW.type, NEW.is_return);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stamp_picking_origin ON public.picking;
CREATE TRIGGER trigger_stamp_picking_origin
    BEFORE INSERT OR UPDATE OF order_id, is_return ON public.picking
    FOR EACH ROW EXECUTE FUNCTION public.stamp_picking_origin();

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Confirmación de picking: ahora escribe en el libro                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Reemplaza la versión anterior, que actualizaba product.stock_quantity a mano.
 *
 * Cambios:
 *   · Un asiento por línea (no por producto agregado): conserva lote, serie y
 *     cantidad real escaneada, que es lo que da trazabilidad fina.
 *   · Captura el costo del momento y recalcula el promedio ponderado.
 *   · Registra almacén, origen, picking, línea y orden en cada asiento.
 *
 * Se conserva intacta la regla previa: una salida no puede dejar stock
 * insuficiente, y la cantidad efectiva es done_quantity cuando la línea se
 * escaneó, o quantity cuando se confirmó sin escáner.
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

    -- 2) Un asiento por línea, con su lote/serie y cantidad real
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

        PERFORM public.record_stock_move(
            p_company_id      => v_pick.company_id,
            p_product_id      => r_line.product_id,
            p_move_type       => v_move_type,
            p_quantity        => v_effective,
            p_origin          => v_origin,
            p_warehouse_id    => v_pick.warehouse_id,
            p_unit_cost       => NULL,
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
    'Confirma un picking y escribe un asiento por línea en stock_move. Única vía de cambio de stock junto con create_stock_adjustment.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Implantación del libro sobre los datos existentes                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Los pickings confirmados y cancelados están protegidos contra edición, y con
 * razón: son documentos cerrados. Pero esa protección también impedía que el
 * sistema sellara metadatos suyos, como el origen del movimiento.
 *
 * Se afina la regla: sigue prohibido tocar el CONTENIDO del documento
 * (almacén, orden, tipo, estado, líneas, notas…), y se permite únicamente
 * actualizar las columnas que gestiona la plataforma. La comparación se hace
 * sobre la fila completa, así que cualquier columna que se agregue en el futuro
 * queda protegida por omisión.
 */
CREATE OR REPLACE FUNCTION public.prevent_finalized_picking_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (to_jsonb(NEW) - 'origin' - 'updated_at' - 'updated_by')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'origin' - 'updated_at' - 'updated_by')
    THEN
        RAISE EXCEPTION 'Cannot edit a picking in status %', OLD.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.prevent_finalized_picking_changes IS
    'Impide editar el contenido de un picking finalizado. Permite que el sistema selle origin/updated_at/updated_by.';

-- Tipifica el origen de los pickings que ya existían.
-- Incluye los confirmados y cancelados: es metadato, no reabre el documento.
UPDATE public.picking
SET origin = public.derive_stock_origin(order_id, type, is_return)
WHERE origin IS NULL;

/**
 * Saldo inicial: cada producto con existencias entra al libro con un asiento
 * 'initial'. Sin esto el libro empezaría en cero y no cuadraría con el stock
 * real, que es justamente la certeza que se busca.
 */
DO $$
DECLARE
    r_product RECORD;
    v_cost    DECIMAL(15, 4);
BEGIN
    FOR r_product IN
        SELECT p.id, p.company_id, p.stock_quantity, p.cost_price, p.created_at
        FROM public.product p
        WHERE COALESCE(p.is_stockable, true) = true
          AND COALESCE(p.stock_quantity, 0) <> 0
          AND NOT EXISTS (SELECT 1 FROM public.stock_move sm WHERE sm.product_id = p.id)
    LOOP
        v_cost := COALESCE(r_product.cost_price, 0);

        INSERT INTO public.stock_move (
            company_id, product_id, warehouse_id, move_type, origin,
            quantity, signed_quantity, unit_cost, total_cost,
            balance_after, avg_cost_after,
            reference, notes, occurred_at
        ) VALUES (
            r_product.company_id,
            r_product.id,
            public.get_or_create_default_warehouse(r_product.company_id),
            CASE WHEN r_product.stock_quantity > 0 THEN 'in' ELSE 'out' END::public.stock_move_type,
            'initial',
            ABS(r_product.stock_quantity),
            r_product.stock_quantity,
            v_cost,
            ROUND(ABS(r_product.stock_quantity) * v_cost, 4),
            r_product.stock_quantity,
            v_cost,
            'Saldo inicial',
            'Asiento de apertura generado al implantar el libro de inventario.',
            COALESCE(r_product.created_at, now())
        );
    END LOOP;
END$$;

-- El costo promedio arranca en el costo de reposición registrado.
UPDATE public.product
SET avg_cost = COALESCE(cost_price, 0)
WHERE COALESCE(avg_cost, 0) = 0
  AND COALESCE(cost_price, 0) > 0;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Vistas de consulta                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Libro legible: movimiento + producto + almacén + documento
CREATE OR REPLACE VIEW public.v_stock_moves AS
SELECT
    sm.*,
    p.name        AS product_name,
    p.sku         AS product_sku,
    p.uom_id      AS product_uom_id,
    w.name        AS warehouse_name,
    w.code        AS warehouse_code,
    pk.name       AS picking_name,
    pk.type       AS picking_type,
    o.name        AS order_name,
    o.order_type  AS order_type
FROM public.stock_move sm
INNER JOIN public.product   p  ON p.id  = sm.product_id
LEFT  JOIN public.warehouse w  ON w.id  = sm.warehouse_id
LEFT  JOIN public.picking   pk ON pk.id = sm.picking_id
LEFT  JOIN public.order     o  ON o.id  = sm.order_id;

/**
 * Estado de inventario por producto: saldo, mínimos, valoración y semáforo.
 * Es la fuente del reporte de stock y de las alertas.
 */
CREATE OR REPLACE VIEW public.v_product_stock AS
SELECT
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.barcode,
    p.category_id,
    pc.name              AS category_name,
    p.product_type,
    p.status,
    p.is_stockable,
    p.tracking,
    COALESCE(p.stock_quantity, 0)                       AS stock_quantity,
    COALESCE(p.stock_min, 0)                            AS stock_min,
    p.stock_max,
    COALESCE(p.cost_price, 0)                           AS cost_price,
    COALESCE(NULLIF(p.avg_cost, 0), p.cost_price, 0)    AS unit_cost,
    ROUND(
        COALESCE(p.stock_quantity, 0)
        * COALESCE(NULLIF(p.avg_cost, 0), p.cost_price, 0)
    , 2)                                                AS stock_value,
    COALESCE(p.sale_price, 0)                           AS sale_price,
    ROUND(COALESCE(p.stock_quantity, 0) * COALESCE(p.sale_price, 0), 2) AS retail_value,
    -- Semáforo: negativo > agotado > bajo mínimo > correcto
    CASE
        WHEN COALESCE(p.stock_quantity, 0) < 0 THEN 'negative'
        WHEN COALESCE(p.stock_quantity, 0) = 0 THEN 'out'
        WHEN COALESCE(p.stock_min, 0) > 0
             AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.stock_min, 0) THEN 'low'
        ELSE 'ok'
    END AS stock_status,
    -- Cuánto falta para alcanzar el máximo (o el mínimo si no hay máximo)
    GREATEST(
        COALESCE(p.stock_max, COALESCE(p.stock_min, 0)) - COALESCE(p.stock_quantity, 0),
        0
    ) AS suggested_restock,
    (
        SELECT MAX(sm.occurred_at) FROM public.stock_move sm WHERE sm.product_id = p.id
    ) AS last_move_at,
    (p.status = 'active') AS active,
    p.created_at,
    p.updated_at
FROM public.product p
LEFT JOIN public.product_category pc ON pc.id = p.category_id
WHERE COALESCE(p.is_stockable, true) = true
  AND p.product_type <> 'service';

COMMENT ON VIEW public.v_product_stock IS
    'Existencias, valoración al costo promedio y semáforo de stock por producto.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Reportes                                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Resumen de inventario de la empresa: totales, valoración y desglose por
 * categoría y por almacén. Una sola llamada para todo el tablero.
 */
CREATE OR REPLACE FUNCTION public.get_inventory_summary(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_totals     JSONB;
    v_by_category JSONB;
    v_by_warehouse JSONB;
    v_alerts     JSONB;
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'Sin permiso sobre esta empresa';
    END IF;

    SELECT jsonb_build_object(
        'product_count',   COUNT(*),
        'units_on_hand',   COALESCE(SUM(stock_quantity), 0),
        'stock_value',     COALESCE(SUM(stock_value), 0),
        'retail_value',    COALESCE(SUM(retail_value), 0),
        'potential_margin', COALESCE(SUM(retail_value) - SUM(stock_value), 0),
        'low_count',       COUNT(*) FILTER (WHERE stock_status = 'low'),
        'out_count',       COUNT(*) FILTER (WHERE stock_status = 'out'),
        'negative_count',  COUNT(*) FILTER (WHERE stock_status = 'negative'),
        'ok_count',        COUNT(*) FILTER (WHERE stock_status = 'ok'),
        'uncosted_count',  COUNT(*) FILTER (WHERE unit_cost = 0 AND stock_quantity > 0)
    )
    INTO v_totals
    FROM public.v_product_stock
    WHERE company_id = p_company_id AND COALESCE(active, true) = true;

    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'stock_value' DESC), '[]'::jsonb)
    INTO v_by_category
    FROM (
        SELECT jsonb_build_object(
            'category_id',   category_id,
            'category_name', COALESCE(category_name, 'Sin categoría'),
            'product_count', COUNT(*),
            'units',         COALESCE(SUM(stock_quantity), 0),
            'stock_value',   COALESCE(SUM(stock_value), 0)
        ) AS x
        FROM public.v_product_stock
        WHERE company_id = p_company_id AND COALESCE(active, true) = true
        GROUP BY category_id, category_name
    ) t;

    -- El saldo por almacén sale del libro, que es quien conoce la ubicación
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'units' DESC), '[]'::jsonb)
    INTO v_by_warehouse
    FROM (
        SELECT jsonb_build_object(
            'warehouse_id',   sm.warehouse_id,
            'warehouse_name', COALESCE(w.name, 'Sin almacén'),
            'units',          COALESCE(SUM(sm.signed_quantity), 0),
            'stock_value',    ROUND(COALESCE(SUM(sm.signed_quantity * sm.unit_cost), 0), 2),
            'product_count',  COUNT(DISTINCT sm.product_id)
        ) AS x
        FROM public.stock_move sm
        LEFT JOIN public.warehouse w ON w.id = sm.warehouse_id
        WHERE sm.company_id = p_company_id
        GROUP BY sm.warehouse_id, w.name
    ) t;

    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'stock_status', x->>'name'), '[]'::jsonb)
    INTO v_alerts
    FROM (
        SELECT jsonb_build_object(
            'id',                id,
            'name',              name,
            'sku',               sku,
            'stock_quantity',    stock_quantity,
            'stock_min',         stock_min,
            'suggested_restock', suggested_restock,
            'stock_status',      stock_status,
            'unit_cost',         unit_cost
        ) AS x
        FROM public.v_product_stock
        WHERE company_id = p_company_id
          AND COALESCE(active, true) = true
          AND stock_status IN ('negative', 'out', 'low')
        LIMIT 100
    ) t;

    RETURN jsonb_build_object(
        'status',       'ok',
        'totals',       COALESCE(v_totals, '{}'::jsonb),
        'by_category',  v_by_category,
        'by_warehouse', v_by_warehouse,
        'alerts',       v_alerts,
        'generated_at', now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(UUID) TO authenticated;

/**
 * Kardex de un producto: movimientos en orden cronológico con el saldo
 * resultante ya calculado en cada asiento. Responde «de dónde salió cada
 * unidad» sin tener que recomponer nada.
 */
CREATE OR REPLACE FUNCTION public.get_product_stock_card(
    p_product_id UUID,
    p_limit      INT DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product RECORD;
    v_moves   JSONB;
    v_summary JSONB;
BEGIN
    SELECT * INTO v_product FROM public.product WHERE id = p_product_id;

    IF v_product.id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF NOT public.user_belongs_to_company(v_product.company_id) THEN
        RAISE EXCEPTION 'Sin permiso sobre este producto';
    END IF;

    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'occurred_at') DESC), '[]'::jsonb)
    INTO v_moves
    FROM (
        SELECT jsonb_build_object(
            'id',             sm.id,
            'occurred_at',    sm.occurred_at,
            'move_type',      sm.move_type,
            'origin',         sm.origin,
            'quantity',       sm.quantity,
            'signed_quantity', sm.signed_quantity,
            'unit_cost',      sm.unit_cost,
            'total_cost',     sm.total_cost,
            'balance_after',  sm.balance_after,
            'warehouse_name', sm.warehouse_name,
            'picking_id',     sm.picking_id,
            'picking_name',   sm.picking_name,
            'order_id',       sm.order_id,
            'order_name',     sm.order_name,
            'lot_name',       sm.lot_name,
            'serial_number',  sm.serial_number,
            'reference',      sm.reference,
            'notes',          sm.notes
        ) AS x
        FROM public.v_stock_moves sm
        WHERE sm.product_id = p_product_id
        ORDER BY sm.occurred_at DESC
        LIMIT GREATEST(COALESCE(p_limit, 200), 1)
    ) t;

    SELECT jsonb_build_object(
        'total_in',      COALESCE(SUM(quantity) FILTER (WHERE move_type = 'in'), 0),
        'total_out',     COALESCE(SUM(quantity) FILTER (WHERE move_type = 'out'), 0),
        'move_count',    COUNT(*),
        'first_move_at', MIN(occurred_at),
        'last_move_at',  MAX(occurred_at)
    )
    INTO v_summary
    FROM public.stock_move
    WHERE product_id = p_product_id;

    RETURN jsonb_build_object(
        'status',  'ok',
        'product', (
            SELECT jsonb_build_object(
                'id', id, 'name', name, 'sku', sku,
                'stock_quantity', stock_quantity, 'stock_min', stock_min, 'stock_max', stock_max,
                'unit_cost', unit_cost, 'stock_value', stock_value,
                'stock_status', stock_status, 'tracking', tracking
            )
            FROM public.v_product_stock WHERE id = p_product_id
        ),
        'summary', v_summary,
        'moves',   v_moves
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_stock_card(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_stock_card(UUID, INT) TO authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Reabastecimiento: del stock bajo a una tarea en la agenda                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Proyecto interno donde viven las tareas de reabastecimiento.
 * Se crea una sola vez por empresa y se reutiliza siempre.
 */
CREATE OR REPLACE FUNCTION public.get_or_create_restock_project(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings          RECORD;
    v_project_id        UUID;
    v_owner_partner_id  UUID;
BEGIN
    SELECT * INTO v_settings FROM public.inventory_settings WHERE company_id = p_company_id;

    IF v_settings.restock_project_id IS NOT NULL THEN
        SELECT id INTO v_project_id
        FROM public.project
        WHERE id = v_settings.restock_project_id AND COALESCE(active, true) = true;

        IF v_project_id IS NOT NULL THEN
            RETURN v_project_id;
        END IF;
    END IF;

    -- Reutiliza el proyecto por nombre si ya existe (evita duplicarlo)
    SELECT id INTO v_project_id
    FROM public.project
    WHERE company_id = p_company_id
      AND name = 'Reabastecimiento de inventario'
      AND COALESCE(active, true) = true
    LIMIT 1;

    IF v_project_id IS NULL THEN
        -- project.responsible_partner_id es obligatorio: se usa el responsable
        -- configurado y, si no hay, el propietario del equipo de la empresa.
        v_owner_partner_id := COALESCE(
            v_settings.restock_responsible_partner_id,
            (
                SELECT rpc.partner_id
                FROM public.rel_partner_company rpc
                WHERE rpc.company_id = p_company_id
                  AND COALESCE(rpc.is_active, true) = true
                  AND rpc.relationship_type = 'team'
                ORDER BY CASE rpc.role
                             WHEN 'owner' THEN 1
                             WHEN 'admin' THEN 2
                             ELSE 3
                         END,
                         rpc.created_at
                LIMIT 1
            )
        );

        IF v_owner_partner_id IS NULL THEN
            RAISE EXCEPTION 'No hay ningún miembro del equipo al que asignar el proyecto de reabastecimiento. Invita a alguien al equipo o define un responsable en los ajustes de inventario.';
        END IF;

        INSERT INTO public.project (
            company_id, name, description, responsible_partner_id, created_by, updated_by
        )
        VALUES (
            p_company_id,
            'Reabastecimiento de inventario',
            'Proyecto interno generado por Flowbit. Agrupa las tareas de compra o producción de los productos que cayeron por debajo de su stock mínimo.',
            v_owner_partner_id,
            auth.uid(), auth.uid()
        )
        RETURNING id INTO v_project_id;
    END IF;

    INSERT INTO public.inventory_settings (company_id, restock_project_id, created_by, updated_by)
    VALUES (p_company_id, v_project_id, auth.uid(), auth.uid())
    ON CONFLICT (company_id)
    DO UPDATE SET restock_project_id = EXCLUDED.restock_project_id, updated_at = now();

    RETURN v_project_id;
END;
$$;

/**
 * Crea (o actualiza) la tarea de reabastecimiento de un producto.
 *
 * Idempotente por diseño: si ya existe una tarea abierta para ese producto,
 * se actualiza su descripción y prioridad en vez de crear una nueva. Así el
 * inventario no llena la agenda de duplicados cada vez que se vende una pieza.
 */
CREATE OR REPLACE FUNCTION public.ensure_restock_task(p_product_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stock      RECORD;
    v_settings   RECORD;
    v_project_id UUID;
    v_task_id    UUID;
    v_code       VARCHAR(40);
    v_priority   public.project_priority;
    v_due        DATE;
    v_title      VARCHAR(255);
    v_description TEXT;
BEGIN
    SELECT * INTO v_stock FROM public.v_product_stock WHERE id = p_product_id;

    IF v_stock.id IS NULL OR v_stock.stock_status = 'ok' THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_settings FROM public.inventory_settings WHERE company_id = v_stock.company_id;

    -- El código enlaza la tarea con el producto y hace la búsqueda idempotente
    v_code := 'RESTOCK-' || substr(replace(p_product_id::TEXT, '-', ''), 1, 12);

    v_priority := CASE v_stock.stock_status
        WHEN 'negative' THEN 'urgent'
        WHEN 'out'      THEN 'high'
        ELSE 'medium'
    END::public.project_priority;

    v_due := CURRENT_DATE + COALESCE(v_settings.restock_lead_days, 3);

    v_title := 'Surtir ' || v_stock.name ||
               COALESCE(' (' || v_stock.sku || ')', '');

    v_description :=
        'Generado automáticamente por el control de inventario.' || E'\n\n' ||
        'Existencias actuales: ' || TRIM(TO_CHAR(v_stock.stock_quantity, 'FM999999990.999')) || E'\n' ||
        'Mínimo definido: '      || TRIM(TO_CHAR(v_stock.stock_min, 'FM999999990.999')) || E'\n' ||
        'Sugerido a surtir: '    || TRIM(TO_CHAR(v_stock.suggested_restock, 'FM999999990.999')) || E'\n' ||
        'Situación: ' || CASE v_stock.stock_status
            WHEN 'negative' THEN 'existencias negativas (revisar también si hay un error de captura)'
            WHEN 'out'      THEN 'producto agotado'
            ELSE 'por debajo del mínimo'
        END;

    -- ¿Ya hay una tarea abierta para este producto?
    SELECT id INTO v_task_id
    FROM public.project_task
    WHERE company_id = v_stock.company_id
      AND code = v_code
      AND status IN ('pending', 'in_progress')
      AND COALESCE(active, true) = true
    LIMIT 1;

    IF v_task_id IS NOT NULL THEN
        UPDATE public.project_task
        SET name        = v_title,
            description = v_description,
            priority    = v_priority,
            due_date    = LEAST(COALESCE(due_date, v_due), v_due),
            updated_by  = auth.uid()
        WHERE id = v_task_id;

        RETURN v_task_id;
    END IF;

    v_project_id := public.get_or_create_restock_project(v_stock.company_id);

    INSERT INTO public.project_task (
        company_id, project_id, code, name, description,
        status, priority, responsible_partner_id, due_date,
        created_by, updated_by
    ) VALUES (
        v_stock.company_id, v_project_id, v_code, v_title, v_description,
        'pending', v_priority, v_settings.restock_responsible_partner_id, v_due,
        auth.uid(), auth.uid()
    )
    RETURNING id INTO v_task_id;

    RETURN v_task_id;
END;
$$;

/**
 * Cierra la tarea de reabastecimiento cuando el producto vuelve a tener
 * existencias suficientes: la agenda no debe arrastrar pendientes resueltos.
 */
CREATE OR REPLACE FUNCTION public.close_restock_task(p_product_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code    VARCHAR(40);
    v_count   INT;
BEGIN
    v_code := 'RESTOCK-' || substr(replace(p_product_id::TEXT, '-', ''), 1, 12);

    WITH closed AS (
        UPDATE public.project_task
        SET status       = 'completed',
            progress     = 100,
            completed_at = now(),
            updated_by   = auth.uid()
        WHERE code = v_code
          AND status IN ('pending', 'in_progress')
          AND COALESCE(active, true) = true
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM closed;

    RETURN COALESCE(v_count, 0);
END;
$$;

/**
 * Revisa todo el catálogo y sincroniza las tareas de reabastecimiento.
 * Se dispara desde el panel («Generar tareas») y sirve además para poner al
 * día una empresa que acaba de activar la automatización.
 */
CREATE OR REPLACE FUNCTION public.generate_restock_tasks(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_product RECORD;
    v_created INT := 0;
    v_closed  INT := 0;
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'Sin permiso sobre esta empresa';
    END IF;

    FOR r_product IN
        SELECT id, stock_status
        FROM public.v_product_stock
        WHERE company_id = p_company_id
          AND COALESCE(active, true) = true
    LOOP
        IF r_product.stock_status = 'ok' THEN
            v_closed := v_closed + public.close_restock_task(r_product.id);
        ELSE
            IF public.ensure_restock_task(r_product.id) IS NOT NULL THEN
                v_created := v_created + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'status',  'ok',
        'pending_tasks', v_created,
        'closed_tasks',  v_closed
    );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_restock_tasks(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_restock_tasks(UUID) TO authenticated;

/**
 * Automatización: cada cambio de existencias revisa si el producto cruzó el
 * umbral, y crea o cierra su tarea. Se apoya en ensure_restock_task, que es
 * idempotente, de modo que vender diez veces no genera diez tareas.
 */
CREATE OR REPLACE FUNCTION public.sync_restock_task_on_stock_change()
RETURNS TRIGGER AS $$
DECLARE
    v_auto BOOLEAN;
    v_status TEXT;
BEGIN
    IF NEW.stock_quantity IS NOT DISTINCT FROM OLD.stock_quantity THEN
        RETURN NEW;
    END IF;

    IF NOT COALESCE(NEW.is_stockable, true) OR NEW.product_type = 'service' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(auto_restock_tasks, true) INTO v_auto
    FROM public.inventory_settings
    WHERE company_id = NEW.company_id;

    -- Sin configuración explícita la automatización viene activada
    IF v_auto IS NULL THEN
        v_auto := true;
    END IF;

    IF NOT v_auto THEN
        RETURN NEW;
    END IF;

    v_status := CASE
        WHEN COALESCE(NEW.stock_quantity, 0) < 0 THEN 'negative'
        WHEN COALESCE(NEW.stock_quantity, 0) = 0 THEN 'out'
        WHEN COALESCE(NEW.stock_min, 0) > 0
             AND COALESCE(NEW.stock_quantity, 0) <= COALESCE(NEW.stock_min, 0) THEN 'low'
        ELSE 'ok'
    END;

    IF v_status = 'ok' THEN
        PERFORM public.close_restock_task(NEW.id);
    ELSE
        PERFORM public.ensure_restock_task(NEW.id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_restock_task ON public.product;
CREATE TRIGGER trigger_sync_restock_task
    AFTER UPDATE OF stock_quantity ON public.product
    FOR EACH ROW EXECUTE FUNCTION public.sync_restock_task_on_stock_change();

COMMENT ON FUNCTION public.sync_restock_task_on_stock_change IS
    'Crea o cierra la tarea de reabastecimiento cuando el stock cruza el mínimo. Idempotente por código de tarea.';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Blindaje del flujo                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Un producto nuevo puede nacer con existencias: ese saldo entra al libro como
 * asiento de apertura. Se inserta el asiento directamente (y no vía
 * record_stock_move) porque el stock ya quedó escrito por el INSERT y volver a
 * sumarlo lo duplicaría.
 */
CREATE OR REPLACE FUNCTION public.record_initial_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_cost DECIMAL(15, 4);
BEGIN
    IF NOT COALESCE(NEW.is_stockable, true)
       OR NEW.product_type = 'service'
       OR COALESCE(NEW.stock_quantity, 0) = 0 THEN
        RETURN NEW;
    END IF;

    v_cost := COALESCE(NULLIF(NEW.avg_cost, 0), NEW.cost_price, 0);

    INSERT INTO public.stock_move (
        company_id, product_id, warehouse_id, move_type, origin,
        quantity, signed_quantity, unit_cost, total_cost,
        balance_after, avg_cost_after, reference, notes, occurred_at, created_by
    ) VALUES (
        NEW.company_id,
        NEW.id,
        public.get_or_create_default_warehouse(NEW.company_id),
        CASE WHEN NEW.stock_quantity > 0 THEN 'in' ELSE 'out' END::public.stock_move_type,
        'initial',
        ABS(NEW.stock_quantity),
        NEW.stock_quantity,
        v_cost,
        ROUND(ABS(NEW.stock_quantity) * v_cost, 4),
        NEW.stock_quantity,
        v_cost,
        'Existencias iniciales',
        'Cantidad capturada al dar de alta el producto.',
        now(),
        auth.uid()
    );

    -- El promedio ponderado arranca en el costo con el que entró el saldo.
    IF COALESCE(NEW.avg_cost, 0) = 0 AND v_cost > 0 THEN
        UPDATE public.product SET avg_cost = v_cost WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_record_initial_product_stock ON public.product;
CREATE TRIGGER trigger_record_initial_product_stock
    AFTER INSERT ON public.product
    FOR EACH ROW EXECUTE FUNCTION public.record_initial_product_stock();

/**
 * La generación de tareas nunca debe tumbar una venta.
 *
 * Si el reabastecimiento falla (por ejemplo, una empresa sin miembros de
 * equipo a quien asignar el proyecto), se registra una advertencia y el
 * movimiento de inventario continúa: el stock es la operación crítica, la
 * tarea es un apoyo.
 */
CREATE OR REPLACE FUNCTION public.sync_restock_task_on_stock_change()
RETURNS TRIGGER AS $$
DECLARE
    v_auto   BOOLEAN;
    v_status TEXT;
BEGIN
    IF NEW.stock_quantity IS NOT DISTINCT FROM OLD.stock_quantity THEN
        RETURN NEW;
    END IF;

    IF NOT COALESCE(NEW.is_stockable, true) OR NEW.product_type = 'service' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(auto_restock_tasks, true) INTO v_auto
    FROM public.inventory_settings
    WHERE company_id = NEW.company_id;

    IF v_auto IS NULL THEN
        v_auto := true;   -- sin configuración explícita, la automatización viene activada
    END IF;

    IF NOT v_auto THEN
        RETURN NEW;
    END IF;

    v_status := CASE
        WHEN COALESCE(NEW.stock_quantity, 0) < 0 THEN 'negative'
        WHEN COALESCE(NEW.stock_quantity, 0) = 0 THEN 'out'
        WHEN COALESCE(NEW.stock_min, 0) > 0
             AND COALESCE(NEW.stock_quantity, 0) <= COALESCE(NEW.stock_min, 0) THEN 'low'
        ELSE 'ok'
    END;

    BEGIN
        IF v_status = 'ok' THEN
            PERFORM public.close_restock_task(NEW.id);
        ELSE
            PERFORM public.ensure_restock_task(NEW.id);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'No se pudo sincronizar la tarea de reabastecimiento del producto %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sync_restock_task_on_stock_change IS
    'Crea o cierra la tarea de reabastecimiento al cruzar el mínimo. Nunca interrumpe el movimiento de inventario.';

-- ── Permisos de lectura de las vistas ───────────────────────────────────────
GRANT SELECT ON public.v_stock_moves  TO authenticated;
GRANT SELECT ON public.v_product_stock TO authenticated;

-- ── v_pickings expone el origen y el valor del movimiento ───────────────────
-- Se recrea (DROP + CREATE) porque CREATE OR REPLACE no admite columnas nuevas
-- en medio de la lista.
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
    p.origin,
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
        WHERE pl.picking_id = p.id AND pl.active = true
    ) AS total_quantity,
    (
        SELECT COUNT(*)
        FROM public.picking_line pl
        WHERE pl.picking_id = p.id AND pl.active = true
    ) AS line_count,
    -- Valor del movimiento según los asientos que generó
    (
        SELECT COALESCE(SUM(ABS(sm.total_cost)), 0)
        FROM public.stock_move sm
        WHERE sm.picking_id = p.id
    ) AS move_value
FROM public.picking p
LEFT JOIN public.warehouse w ON w.id = p.warehouse_id
LEFT JOIN public.order     o ON o.id = p.order_id;

GRANT SELECT ON public.v_pickings TO authenticated;
