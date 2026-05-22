-- ============================================================================
-- Migration: Inventory Control Module (Warehouse, Picking, Picking Lines)
-- ============================================================================

-- Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'picking_type') THEN
        CREATE TYPE public.picking_type AS ENUM ('entrada', 'salida');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'picking_status') THEN
        CREATE TYPE public.picking_status AS ENUM ('borrador', 'publicado', 'confirmado', 'cancelado');
    END IF;
END $$;

-- Warehouse
CREATE TABLE IF NOT EXISTS public.warehouse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (company_id, code)
);

-- Picking header
CREATE TABLE IF NOT EXISTS public.picking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouse(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES public.order(id) ON DELETE CASCADE,

    name VARCHAR(100),
    type public.picking_type NOT NULL,
    status public.picking_status NOT NULL DEFAULT 'borrador',
    is_return BOOLEAN DEFAULT false,

    notes TEXT,
    published_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Picking detail
CREATE TABLE IF NOT EXISTS public.picking_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    picking_id UUID NOT NULL REFERENCES public.picking(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.product(id) ON DELETE RESTRICT,

    sequence INT DEFAULT 10,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 1.000,

    tracking_type public.product_tracking NOT NULL DEFAULT 'none',
    lot_name VARCHAR(120),
    serial_number VARCHAR(120),

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (picking_id, serial_number),
    CHECK (quantity > 0),
    CHECK (
        (tracking_type = 'serial' AND serial_number IS NOT NULL AND btrim(serial_number) <> '' AND quantity = 1)
        OR (tracking_type = 'lot' AND lot_name IS NOT NULL AND btrim(lot_name) <> '')
        OR (tracking_type = 'none')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_company ON public.warehouse(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_active ON public.warehouse(active);
CREATE INDEX IF NOT EXISTS idx_warehouse_default ON public.warehouse(company_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_picking_company ON public.picking(company_id);
CREATE INDEX IF NOT EXISTS idx_picking_warehouse ON public.picking(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_picking_order ON public.picking(order_id);
CREATE INDEX IF NOT EXISTS idx_picking_status ON public.picking(status);
CREATE INDEX IF NOT EXISTS idx_picking_type ON public.picking(type);
CREATE INDEX IF NOT EXISTS idx_picking_order_status ON public.picking(order_id, status);

CREATE INDEX IF NOT EXISTS idx_picking_line_company ON public.picking_line(company_id);
CREATE INDEX IF NOT EXISTS idx_picking_line_picking ON public.picking_line(picking_id);
CREATE INDEX IF NOT EXISTS idx_picking_line_product ON public.picking_line(product_id);
CREATE INDEX IF NOT EXISTS idx_picking_line_tracking ON public.picking_line(tracking_type);

-- Triggers updated_at
DROP TRIGGER IF EXISTS trigger_warehouse_updated_at ON public.warehouse;
CREATE TRIGGER trigger_warehouse_updated_at
    BEFORE UPDATE ON public.warehouse
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_picking_updated_at ON public.picking;
CREATE TRIGGER trigger_picking_updated_at
    BEFORE UPDATE ON public.picking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_picking_line_updated_at ON public.picking_line;
CREATE TRIGGER trigger_picking_line_updated_at
    BEFORE UPDATE ON public.picking_line
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Ensure single default warehouse per company
CREATE OR REPLACE FUNCTION public.ensure_single_default_warehouse()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.warehouse
        SET is_default = false
        WHERE company_id = NEW.company_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_default_warehouse ON public.warehouse;
CREATE TRIGGER trigger_single_default_warehouse
    BEFORE INSERT OR UPDATE ON public.warehouse
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION public.ensure_single_default_warehouse();

-- Default warehouse helper
CREATE OR REPLACE FUNCTION public.get_or_create_default_warehouse(p_company_id UUID)
RETURNS UUID AS $$
DECLARE
    v_warehouse_id UUID;
BEGIN
    SELECT id INTO v_warehouse_id
    FROM public.warehouse
    WHERE company_id = p_company_id
      AND is_default = true
      AND active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
        INSERT INTO public.warehouse (
            company_id,
            name,
            code,
            description,
            is_default,
            created_by,
            updated_by
        ) VALUES (
            p_company_id,
            'Almacén principal',
            'MAIN',
            'Almacén creado automáticamente',
            true,
            auth.uid(),
            auth.uid()
        )
        RETURNING id INTO v_warehouse_id;
    END IF;

    RETURN v_warehouse_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate picking line consistency (tenant + tracking)
CREATE OR REPLACE FUNCTION public.validate_picking_line()
RETURNS TRIGGER AS $$
DECLARE
    v_picking RECORD;
    v_product RECORD;
BEGIN
    SELECT id, company_id, status INTO v_picking
    FROM public.picking
    WHERE id = NEW.picking_id;

    IF v_picking.id IS NULL THEN
        RAISE EXCEPTION 'Picking not found';
    END IF;

    IF v_picking.status IN ('confirmado', 'cancelado') THEN
        RAISE EXCEPTION 'Cannot modify lines of a picking that is confirmed or cancelled';
    END IF;

    SELECT id, company_id, tracking, is_stockable INTO v_product
    FROM public.product
    WHERE id = NEW.product_id;

    IF v_product.id IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    IF v_picking.company_id != v_product.company_id OR NEW.company_id != v_picking.company_id THEN
        RAISE EXCEPTION 'Picking line company mismatch';
    END IF;

    IF COALESCE(v_product.is_stockable, true) = false THEN
        RAISE EXCEPTION 'Product % is not stockable', v_product.id;
    END IF;

    IF NEW.tracking_type != v_product.tracking THEN
        RAISE EXCEPTION 'Tracking type must match product tracking configuration';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_picking_line ON public.picking_line;
CREATE TRIGGER trigger_validate_picking_line
    BEFORE INSERT OR UPDATE ON public.picking_line
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_picking_line();

-- Prevent changes on finalized pickings
CREATE OR REPLACE FUNCTION public.prevent_finalized_picking_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('confirmado', 'cancelado') THEN
        RAISE EXCEPTION 'Cannot edit a picking in status %', OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_finalized_picking_changes ON public.picking;
CREATE TRIGGER trigger_prevent_finalized_picking_changes
    BEFORE UPDATE ON public.picking
    FOR EACH ROW
    WHEN (OLD.status IN ('confirmado', 'cancelado'))
    EXECUTE FUNCTION public.prevent_finalized_picking_changes();

-- Picking numbering
CREATE SEQUENCE IF NOT EXISTS public.picking_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_picking_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS NULL OR NEW.name = '' THEN
        NEW.name = 'PK-' || LPAD(nextval('public.picking_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_picking_name ON public.picking;
CREATE TRIGGER trigger_picking_name
    BEFORE INSERT ON public.picking
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_picking_name();

-- Apply inventory movement on picking confirmation
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

    IF NOT EXISTS (SELECT 1 FROM public.picking_line WHERE picking_id = p_picking_id AND active = true) THEN
        RAISE EXCEPTION 'Cannot confirm a picking without lines';
    END IF;

    FOR r_line IN
        SELECT pl.product_id, SUM(pl.quantity) AS qty_sum
        FROM public.picking_line pl
        WHERE pl.picking_id = p_picking_id
          AND pl.active = true
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

-- State transitions for picking
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

-- Build or refresh draft picking from order lines
CREATE OR REPLACE FUNCTION public.sync_order_to_draft_picking(
    p_order_id UUID,
    p_is_return BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_order RECORD;
    v_pick_id UUID;
    v_warehouse_id UUID;
    v_type public.picking_type;
    v_product RECORD;
    r_line RECORD;
    v_sequence INT := 10;
BEGIN
    SELECT *
    INTO v_order
    FROM public.order
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state = 'cancel' THEN
        RAISE EXCEPTION 'Cancelled orders cannot create pickings';
    END IF;

    IF v_order.order_type = 'purchase' THEN
        v_type = CASE WHEN p_is_return THEN 'salida' ELSE 'entrada' END;
    ELSE
        v_type = CASE WHEN p_is_return THEN 'entrada' ELSE 'salida' END;
    END IF;

    v_warehouse_id = public.get_or_create_default_warehouse(v_order.company_id);

    SELECT p.id
    INTO v_pick_id
    FROM public.picking p
    WHERE p.order_id = v_order.id
      AND p.is_return = p_is_return
      AND p.status IN ('borrador', 'publicado')
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF v_pick_id IS NULL THEN
        INSERT INTO public.picking (
            company_id,
            warehouse_id,
            order_id,
            type,
            status,
            is_return,
            created_by,
            updated_by
        ) VALUES (
            v_order.company_id,
            v_warehouse_id,
            v_order.id,
            v_type,
            'borrador',
            p_is_return,
            auth.uid(),
            auth.uid()
        )
        RETURNING id INTO v_pick_id;
    ELSE
        UPDATE public.picking
        SET warehouse_id = v_warehouse_id,
            type = v_type,
            updated_by = auth.uid()
        WHERE id = v_pick_id;

        DELETE FROM public.picking_line
        WHERE picking_id = v_pick_id;
    END IF;

    FOR r_line IN
        SELECT
            ol.product_id,
            CASE
                WHEN COALESCE(ol.quantity_delivered, 0) > 0 THEN ol.quantity_delivered
                ELSE ol.quantity
            END AS effective_qty
        FROM public.order_line ol
        WHERE ol.order_id = v_order.id
          AND ol.product_id IS NOT NULL
    LOOP
        IF COALESCE(r_line.effective_qty, 0) <= 0 THEN
            CONTINUE;
        END IF;

        SELECT id, tracking, company_id
        INTO v_product
        FROM public.product
        WHERE id = r_line.product_id;

        IF v_product.id IS NULL OR v_product.company_id != v_order.company_id THEN
            RAISE EXCEPTION 'Order line product % does not belong to company', r_line.product_id;
        END IF;

        IF v_product.tracking = 'serial' THEN
            IF MOD(r_line.effective_qty, 1) != 0 THEN
                RAISE EXCEPTION 'Serial-tracked products require integer quantities';
            END IF;

            FOR i IN 1..r_line.effective_qty::INT LOOP
                INSERT INTO public.picking_line (
                    company_id,
                    picking_id,
                    product_id,
                    sequence,
                    quantity,
                    tracking_type,
                    serial_number,
                    created_by,
                    updated_by
                ) VALUES (
                    v_order.company_id,
                    v_pick_id,
                    r_line.product_id,
                    v_sequence,
                    1,
                    'serial',
                    'SERIAL-PENDING-' || substr(gen_random_uuid()::TEXT, 1, 8),
                    auth.uid(),
                    auth.uid()
                );
                v_sequence = v_sequence + 10;
            END LOOP;
        ELSIF v_product.tracking = 'lot' THEN
            INSERT INTO public.picking_line (
                company_id,
                picking_id,
                product_id,
                sequence,
                quantity,
                tracking_type,
                lot_name,
                created_by,
                updated_by
            ) VALUES (
                v_order.company_id,
                v_pick_id,
                r_line.product_id,
                v_sequence,
                r_line.effective_qty,
                'lot',
                'LOTE-PENDIENTE',
                auth.uid(),
                auth.uid()
            );
            v_sequence = v_sequence + 10;
        ELSE
            INSERT INTO public.picking_line (
                company_id,
                picking_id,
                product_id,
                sequence,
                quantity,
                tracking_type,
                created_by,
                updated_by
            ) VALUES (
                v_order.company_id,
                v_pick_id,
                r_line.product_id,
                v_sequence,
                r_line.effective_qty,
                'none',
                auth.uid(),
                auth.uid()
            );
            v_sequence = v_sequence + 10;
        END IF;
    END LOOP;

    RETURN v_pick_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-sync picking when order is delivered
CREATE OR REPLACE FUNCTION public.sync_picking_on_order_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_state = 'cancel' THEN
        RETURN NEW;
    END IF;

    IF NEW.is_delivered = true AND NEW.order_state = 'posted' THEN
        PERFORM public.sync_order_to_draft_picking(NEW.id, false);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_picking_on_order_delivery ON public.order;
CREATE TRIGGER trigger_sync_picking_on_order_delivery
    AFTER UPDATE OF is_delivered, order_state ON public.order
    FOR EACH ROW
    WHEN (
        OLD.is_delivered IS DISTINCT FROM NEW.is_delivered
        OR OLD.order_state IS DISTINCT FROM NEW.order_state
    )
    EXECUTE FUNCTION public.sync_picking_on_order_delivery();

-- Keep draft picking lines aligned after order line changes
CREATE OR REPLACE FUNCTION public.sync_picking_after_order_line_change()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_order RECORD;
BEGIN
    v_order_id = COALESCE(NEW.order_id, OLD.order_id);
    SELECT * INTO v_order FROM public.order WHERE id = v_order_id;

    IF v_order.id IS NOT NULL
       AND v_order.is_delivered = true
       AND v_order.order_state = 'posted'
       AND v_order.order_state <> 'cancel' THEN
        PERFORM public.sync_order_to_draft_picking(v_order.id, false);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_picking_after_order_line_change ON public.order_line;
CREATE TRIGGER trigger_sync_picking_after_order_line_change
    AFTER INSERT OR UPDATE OR DELETE ON public.order_line
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_picking_after_order_line_change();

-- Override order post/cancel to decouple direct stock movement.
CREATE OR REPLACE FUNCTION public.post_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
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

    UPDATE public.order
    SET order_state = 'posted',
        confirmation_date = COALESCE(confirmation_date, now()),
        updated_by = auth.uid()
    WHERE id = p_order_id;

    IF v_order.is_delivered = true THEN
        PERFORM public.sync_order_to_draft_picking(p_order_id, false);
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.order WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state = 'cancel' THEN
        RAISE EXCEPTION 'Order is already cancelled';
    END IF;

    UPDATE public.order
    SET order_state = 'cancel',
        updated_by = auth.uid()
    WHERE id = p_order_id;

    UPDATE public.picking
    SET status = 'cancelado',
        cancelled_at = now(),
        active = false,
        updated_by = auth.uid()
    WHERE order_id = p_order_id
      AND status IN ('borrador', 'publicado');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Views
CREATE OR REPLACE VIEW public.v_pickings AS
SELECT
    p.*,
    w.name AS warehouse_name,
    w.code AS warehouse_code,
    o.name AS order_name,
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
INNER JOIN public.warehouse w ON w.id = p.warehouse_id
INNER JOIN public.order o ON o.id = p.order_id;

CREATE OR REPLACE VIEW public.v_picking_lines AS
SELECT
    pl.*,
    p.name AS picking_name,
    p.type AS picking_type,
    p.status AS picking_status,
    p.order_id,
    p.warehouse_id,
    o.name AS order_name,
    pr.name AS product_name,
    pr.sku AS product_sku
FROM public.picking_line pl
INNER JOIN public.picking p ON p.id = pl.picking_id
INNER JOIN public.order o ON o.id = p.order_id
INNER JOIN public.product pr ON pr.id = pl.product_id;

-- RLS
ALTER TABLE public.warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picking_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company warehouses" ON public.warehouse;
CREATE POLICY "Users can view company warehouses" ON public.warehouse
    FOR SELECT
    USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage company warehouses" ON public.warehouse;
CREATE POLICY "Users can manage company warehouses" ON public.warehouse
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can view company pickings" ON public.picking;
CREATE POLICY "Users can view company pickings" ON public.picking
    FOR SELECT
    USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can manage company pickings" ON public.picking;
CREATE POLICY "Users can manage company pickings" ON public.picking
    FOR ALL
    USING (public.user_belongs_to_company(company_id))
    WITH CHECK (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can view picking lines" ON public.picking_line;
CREATE POLICY "Users can view picking lines" ON public.picking_line
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.picking p
            WHERE p.id = picking_line.picking_id
              AND public.user_belongs_to_company(p.company_id)
        )
    );

DROP POLICY IF EXISTS "Users can manage picking lines" ON public.picking_line;
CREATE POLICY "Users can manage picking lines" ON public.picking_line
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.picking p
            WHERE p.id = picking_line.picking_id
              AND public.user_belongs_to_company(p.company_id)
              AND p.status IN ('borrador', 'publicado')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.picking p
            WHERE p.id = picking_line.picking_id
              AND public.user_belongs_to_company(p.company_id)
              AND p.status IN ('borrador', 'publicado')
        )
    );

-- Grants
GRANT EXECUTE ON FUNCTION public.set_picking_status(UUID, public.picking_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_order_to_draft_picking(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_default_warehouse(UUID) TO authenticated;

-- Comments
COMMENT ON TABLE public.warehouse IS 'Warehouses per company for inventory operations';
COMMENT ON TABLE public.picking IS 'Inventory movement header associated to orders';
COMMENT ON TABLE public.picking_line IS 'Inventory movement lines with tracking control';

COMMENT ON FUNCTION public.set_picking_status(UUID, public.picking_status) IS
    'Applies valid state transitions: borrador->publicado->confirmado and cancelado from previous states';
COMMENT ON FUNCTION public.sync_order_to_draft_picking(UUID, BOOLEAN) IS
    'Creates or refreshes draft picking from delivered order lines; supports return flow using p_is_return';
