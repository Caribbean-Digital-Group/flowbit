-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  create_pos_module                                                         ║
-- ║                                                                            ║
-- ║  Módulo de Punto de Venta (POS) construido sobre el modelo de órdenes:    ║
-- ║   - pos_register        Cajas / terminales por empresa                    ║
-- ║   - pos_session         Sesiones de caja (apertura → venta → corte Z)     ║
-- ║   - pos_cash_movement   Entradas/salidas de efectivo durante la sesión    ║
-- ║   - pos_payment         Pagos (split) y reembolsos ligados a la orden     ║
-- ║   - pos_session_count   Arqueo del corte: esperado vs contado por método  ║
-- ║                                                                            ║
-- ║  Las ventas POS son órdenes (`public.order`, order_type='sale') que se    ║
-- ║  confirman, marcan como entregadas y generan picking confirmado, por lo   ║
-- ║  que el inventario se descuenta en tiempo real reutilizando el flujo de   ║
-- ║  inventario existente.                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_session_status') THEN
        CREATE TYPE public.pos_session_status AS ENUM ('open', 'closed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_movement_type') THEN
        CREATE TYPE public.pos_movement_type AS ENUM ('in', 'out');
    END IF;
END $$;

-- ── payment_method: marcar métodos de efectivo ──────────────────────────────
ALTER TABLE public.payment_method
    ADD COLUMN IF NOT EXISTS is_cash BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.payment_method.is_cash IS
    'Marca el método como efectivo: participa en fondo de apertura, movimientos y cambio del POS';

-- ── pos_register (caja / terminal) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name VARCHAR(160) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    warehouse_id UUID REFERENCES public.warehouse(id) ON DELETE SET NULL,
    default_partner_id UUID REFERENCES public.partner(id) ON DELETE SET NULL,

    -- Configuración operativa
    max_discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    blind_close BOOLEAN NOT NULL DEFAULT false,
    difference_tolerance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (company_id, code),
    CHECK (max_discount_percent >= 0 AND max_discount_percent <= 100),
    CHECK (difference_tolerance >= 0)
);

-- ── pos_session (sesión de caja) ────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.pos_session_seq START 1;

CREATE TABLE IF NOT EXISTS public.pos_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    register_id UUID NOT NULL REFERENCES public.pos_register(id) ON DELETE RESTRICT,

    name VARCHAR(50),
    status public.pos_session_status NOT NULL DEFAULT 'open',

    opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    opening_notes TEXT,
    closing_notes TEXT,

    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CHECK (opening_balance >= 0)
);

-- Una sola sesión abierta por caja
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_session_single_open
    ON public.pos_session(register_id)
    WHERE status = 'open';

-- ── pos_cash_movement (entradas/salidas de efectivo) ────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_cash_movement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.pos_session(id) ON DELETE CASCADE,

    movement_type public.pos_movement_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT NOT NULL,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CHECK (amount > 0),
    CHECK (btrim(reason) <> '')
);

-- ── pos_payment (pagos y reembolsos, soporta split) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.pos_session(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES public."order"(id) ON DELETE RESTRICT,
    payment_method_id UUID NOT NULL REFERENCES public.payment_method(id) ON DELETE RESTRICT,

    -- amount: monto aplicado a la venta (negativo en reembolsos)
    amount DECIMAL(15, 2) NOT NULL,
    tendered DECIMAL(15, 2),
    change_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    is_refund BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CHECK (amount <> 0),
    CHECK ((is_refund = false AND amount > 0) OR (is_refund = true AND amount < 0)),
    CHECK (change_amount >= 0)
);

-- ── pos_session_count (arqueo del corte por método de pago) ─────────────────
CREATE TABLE IF NOT EXISTS public.pos_session_count (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.pos_session(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES public.payment_method(id) ON DELETE RESTRICT,

    expected DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    counted DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    difference DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    justification TEXT,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    UNIQUE (session_id, payment_method_id)
);

-- ── order: ligar ventas POS a su sesión ─────────────────────────────────────
ALTER TABLE public."order"
    ADD COLUMN IF NOT EXISTS pos_session_id UUID
        REFERENCES public.pos_session(id) ON DELETE SET NULL;

COMMENT ON COLUMN public."order".pos_session_id IS
    'Sesión de caja POS en la que se registró esta orden (NULL para órdenes no POS)';

-- ── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pos_register_company ON public.pos_register(company_id);
CREATE INDEX IF NOT EXISTS idx_pos_register_active ON public.pos_register(active);

CREATE INDEX IF NOT EXISTS idx_pos_session_company ON public.pos_session(company_id);
CREATE INDEX IF NOT EXISTS idx_pos_session_register ON public.pos_session(register_id);
CREATE INDEX IF NOT EXISTS idx_pos_session_status ON public.pos_session(status);
CREATE INDEX IF NOT EXISTS idx_pos_session_opened_at ON public.pos_session(opened_at);

CREATE INDEX IF NOT EXISTS idx_pos_cash_movement_company ON public.pos_cash_movement(company_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_movement_session ON public.pos_cash_movement(session_id);

CREATE INDEX IF NOT EXISTS idx_pos_payment_company ON public.pos_payment(company_id);
CREATE INDEX IF NOT EXISTS idx_pos_payment_session ON public.pos_payment(session_id);
CREATE INDEX IF NOT EXISTS idx_pos_payment_order ON public.pos_payment(order_id);
CREATE INDEX IF NOT EXISTS idx_pos_payment_method ON public.pos_payment(payment_method_id);

CREATE INDEX IF NOT EXISTS idx_pos_session_count_session ON public.pos_session_count(session_id);

CREATE INDEX IF NOT EXISTS idx_order_pos_session ON public."order"(pos_session_id);

-- ── Triggers updated_at ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_pos_register_updated_at ON public.pos_register;
CREATE TRIGGER trigger_pos_register_updated_at
    BEFORE UPDATE ON public.pos_register
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_pos_session_updated_at ON public.pos_session;
CREATE TRIGGER trigger_pos_session_updated_at
    BEFORE UPDATE ON public.pos_session
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_pos_cash_movement_updated_at ON public.pos_cash_movement;
CREATE TRIGGER trigger_pos_cash_movement_updated_at
    BEFORE UPDATE ON public.pos_cash_movement
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_pos_payment_updated_at ON public.pos_payment;
CREATE TRIGGER trigger_pos_payment_updated_at
    BEFORE UPDATE ON public.pos_payment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_pos_session_count_updated_at ON public.pos_session_count;
CREATE TRIGGER trigger_pos_session_count_updated_at
    BEFORE UPDATE ON public.pos_session_count
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Folio de sesión (PS-000001) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_pos_session_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS NULL OR NEW.name = '' THEN
        NEW.name = 'PS-' || LPAD(nextval('public.pos_session_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pos_session_name ON public.pos_session;
CREATE TRIGGER trigger_pos_session_name
    BEFORE INSERT ON public.pos_session
    FOR EACH ROW EXECUTE FUNCTION public.generate_pos_session_name();

-- ── Inmutabilidad de sesiones cerradas ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_closed_pos_session_changes()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Las sesiones de caja cerradas son inmutables';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_closed_pos_session_changes ON public.pos_session;
CREATE TRIGGER trigger_prevent_closed_pos_session_changes
    BEFORE UPDATE OR DELETE ON public.pos_session
    FOR EACH ROW
    WHEN (OLD.status = 'closed')
    EXECUTE FUNCTION public.prevent_closed_pos_session_changes();

CREATE OR REPLACE FUNCTION public.validate_pos_session_is_open()
RETURNS TRIGGER AS $$
DECLARE
    v_status public.pos_session_status;
    v_session_id UUID;
BEGIN
    v_session_id = COALESCE(NEW.session_id, OLD.session_id);

    SELECT status INTO v_status
    FROM public.pos_session
    WHERE id = v_session_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Sesión de caja no encontrada';
    END IF;

    IF v_status <> 'open' THEN
        RAISE EXCEPTION 'No se pueden registrar movimientos en una sesión cerrada';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pos_cash_movement_session_open ON public.pos_cash_movement;
CREATE TRIGGER trigger_pos_cash_movement_session_open
    BEFORE INSERT OR UPDATE OR DELETE ON public.pos_cash_movement
    FOR EACH ROW EXECUTE FUNCTION public.validate_pos_session_is_open();

DROP TRIGGER IF EXISTS trigger_pos_payment_session_open ON public.pos_payment;
CREATE TRIGGER trigger_pos_payment_session_open
    BEFORE INSERT OR UPDATE OR DELETE ON public.pos_payment
    FOR EACH ROW EXECUTE FUNCTION public.validate_pos_session_is_open();

-- ── Los pickings de órdenes POS se gestionan dentro de register_pos_sale ────
-- El trigger de delivery genérico debe ignorar órdenes POS para no duplicar
-- pickings (el POS crea y confirma el suyo de forma atómica).
CREATE OR REPLACE FUNCTION public.sync_picking_on_order_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_state = 'cancel' THEN
        RETURN NEW;
    END IF;

    IF NEW.pos_session_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.is_delivered = true AND NEW.order_state = 'posted' THEN
        PERFORM public.sync_order_to_draft_picking(NEW.id, false);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_picking_after_order_line_change()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_order RECORD;
BEGIN
    v_order_id = COALESCE(NEW.order_id, OLD.order_id);
    SELECT * INTO v_order FROM public.order WHERE id = v_order_id;

    IF v_order.id IS NOT NULL
       AND v_order.pos_session_id IS NULL
       AND v_order.is_delivered = true
       AND v_order.order_state = 'posted'
       AND v_order.order_state <> 'cancel' THEN
        PERFORM public.sync_order_to_draft_picking(v_order.id, false);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════════════
-- RPCs
-- ════════════════════════════════════════════════════════════════════════════

-- ── Abrir sesión de caja ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_pos_session(
    p_register_id UUID,
    p_opening_balance DECIMAL DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_register RECORD;
    v_session_id UUID;
BEGIN
    SELECT * INTO v_register
    FROM public.pos_register
    WHERE id = p_register_id
    FOR UPDATE;

    IF v_register.id IS NULL THEN
        RAISE EXCEPTION 'Caja no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(v_register.company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    IF v_register.active = false THEN
        RAISE EXCEPTION 'La caja está inactiva';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.pos_session
        WHERE register_id = p_register_id AND status = 'open'
    ) THEN
        RAISE EXCEPTION 'La caja ya tiene una sesión abierta';
    END IF;

    IF COALESCE(p_opening_balance, 0) < 0 THEN
        RAISE EXCEPTION 'El fondo de apertura no puede ser negativo';
    END IF;

    INSERT INTO public.pos_session (
        company_id, register_id, status, opening_balance, opening_notes,
        opened_at, opened_by, created_by, updated_by
    ) VALUES (
        v_register.company_id, p_register_id, 'open',
        COALESCE(p_opening_balance, 0), p_notes,
        now(), auth.uid(), auth.uid(), auth.uid()
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Registrar movimiento de efectivo ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_pos_cash_movement(
    p_session_id UUID,
    p_movement_type public.pos_movement_type,
    p_amount DECIMAL,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_session RECORD;
    v_movement_id UUID;
BEGIN
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
        RAISE EXCEPTION 'La sesión de caja no está abierta';
    END IF;

    IF COALESCE(p_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a cero';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'El motivo del movimiento es obligatorio';
    END IF;

    INSERT INTO public.pos_cash_movement (
        company_id, session_id, movement_type, amount, reason,
        created_by, updated_by
    ) VALUES (
        v_session.company_id, p_session_id, p_movement_type, p_amount, btrim(p_reason),
        auth.uid(), auth.uid()
    )
    RETURNING id INTO v_movement_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Resumen de sesión (corte X / pantalla de cierre) ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_pos_session_summary(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_sales RECORD;
    v_refunds RECORD;
    v_cash_in DECIMAL(15, 2);
    v_cash_out DECIMAL(15, 2);
    v_methods JSONB;
    v_cash_sales DECIMAL(15, 2);
    v_cash_refunds DECIMAL(15, 2);
BEGIN
    SELECT * INTO v_session
    FROM public.pos_session
    WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión de caja no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(v_session.company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    SELECT
        COUNT(*) FILTER (WHERE o.order_state = 'posted') AS sales_count,
        COALESCE(SUM(o.amount_total) FILTER (WHERE o.order_state = 'posted'), 0) AS sales_total,
        COALESCE(SUM(o.amount_discount) FILTER (WHERE o.order_state = 'posted'), 0) AS discounts_total,
        COUNT(*) FILTER (WHERE o.order_state = 'cancel') AS cancelled_count
    INTO v_sales
    FROM public."order" o
    WHERE o.pos_session_id = p_session_id;

    SELECT
        COUNT(*) AS refunds_count,
        COALESCE(SUM(-pp.amount), 0) AS refunds_total
    INTO v_refunds
    FROM public.pos_payment pp
    WHERE pp.session_id = p_session_id
      AND pp.is_refund = true
      AND pp.active = true;

    SELECT COALESCE(SUM(amount) FILTER (WHERE movement_type = 'in'), 0),
           COALESCE(SUM(amount) FILTER (WHERE movement_type = 'out'), 0)
    INTO v_cash_in, v_cash_out
    FROM public.pos_cash_movement
    WHERE session_id = p_session_id
      AND active = true;

    SELECT
        COALESCE(SUM(pp.amount) FILTER (WHERE pp.is_refund = false AND pm.is_cash = true), 0),
        COALESCE(SUM(-pp.amount) FILTER (WHERE pp.is_refund = true AND pm.is_cash = true), 0)
    INTO v_cash_sales, v_cash_refunds
    FROM public.pos_payment pp
    INNER JOIN public.payment_method pm ON pm.id = pp.payment_method_id
    WHERE pp.session_id = p_session_id
      AND pp.active = true;

    SELECT COALESCE(jsonb_agg(m ORDER BY m->>'name'), '[]'::jsonb)
    INTO v_methods
    FROM (
        SELECT jsonb_build_object(
            'payment_method_id', pm.id,
            'name', pm.name,
            'is_cash', COALESCE(pm.is_cash, false),
            'sales_amount', COALESCE(SUM(pp.amount) FILTER (WHERE pp.is_refund = false), 0),
            'refunds_amount', COALESCE(SUM(-pp.amount) FILTER (WHERE pp.is_refund = true), 0),
            'expected', COALESCE(SUM(pp.amount), 0)
        ) AS m
        FROM public.pos_payment pp
        INNER JOIN public.payment_method pm ON pm.id = pp.payment_method_id
        WHERE pp.session_id = p_session_id
          AND pp.active = true
        GROUP BY pm.id, pm.name, pm.is_cash
    ) sub;

    RETURN jsonb_build_object(
        'session_id', v_session.id,
        'session_name', v_session.name,
        'status', v_session.status,
        'opened_at', v_session.opened_at,
        'closed_at', v_session.closed_at,
        'opening_balance', v_session.opening_balance,
        'sales_count', v_sales.sales_count,
        'sales_total', v_sales.sales_total,
        'discounts_total', v_sales.discounts_total,
        'cancelled_count', v_sales.cancelled_count,
        'refunds_count', v_refunds.refunds_count,
        'refunds_total', v_refunds.refunds_total,
        'avg_ticket', CASE WHEN v_sales.sales_count > 0
            THEN ROUND(v_sales.sales_total / v_sales.sales_count, 2) ELSE 0 END,
        'cash_in', v_cash_in,
        'cash_out', v_cash_out,
        'expected_cash', v_session.opening_balance + v_cash_sales - v_cash_refunds + v_cash_in - v_cash_out,
        'methods', v_methods
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Registrar venta POS (atómica: orden + líneas + post + picking + pagos) ──
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

    -- Insertar líneas (los triggers calculan importes)
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO public.order_line (
            order_id, product_id, sequence, description,
            quantity, unit_price, unit_cost, discount_percent, tax_rate,
            created_by, updated_by
        ) VALUES (
            v_order_id,
            NULLIF(v_line->>'product_id', '')::UUID,
            v_sequence,
            COALESCE(NULLIF(v_line->>'description', ''), 'Artículo'),
            COALESCE((v_line->>'quantity')::DECIMAL, 1),
            COALESCE((v_line->>'unit_price')::DECIMAL, 0),
            COALESCE((v_line->>'unit_cost')::DECIMAL, 0),
            COALESCE((v_line->>'discount_percent')::DECIMAL, 0),
            COALESCE((v_line->>'tax_rate')::DECIMAL, 0),
            auth.uid(), auth.uid()
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

-- ── Devolución POS (parcial o total) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_pos_refund(
    p_session_id UUID,
    p_order_id UUID,
    p_lines JSONB,
    p_payment_method_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_register RECORD;
    v_order RECORD;
    v_line JSONB;
    v_order_line RECORD;
    v_product RECORD;
    v_refund_total DECIMAL(15, 2) := 0;
    v_line_refund DECIMAL(15, 2);
    v_already_returned DECIMAL(15, 3);
    v_pick_id UUID;
    v_warehouse_id UUID;
    v_sequence INT := 10;
    v_has_stock_lines BOOLEAN := false;
BEGIN
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
        RAISE EXCEPTION 'Las devoluciones requieren una sesión de caja abierta';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'El motivo de la devolución es obligatorio';
    END IF;

    SELECT * INTO v_order
    FROM public."order"
    WHERE id = p_order_id
      AND company_id = v_session.company_id;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Venta original no encontrada';
    END IF;

    IF v_order.order_type <> 'sale' OR v_order.order_state <> 'posted' THEN
        RAISE EXCEPTION 'Solo se pueden devolver ventas confirmadas';
    END IF;

    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Indica al menos una línea a devolver';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.payment_method
        WHERE id = p_payment_method_id
          AND company_id = v_session.company_id
          AND active = true
    ) THEN
        RAISE EXCEPTION 'Método de pago inválido para el reembolso';
    END IF;

    SELECT * INTO v_register
    FROM public.pos_register
    WHERE id = v_session.register_id;

    v_warehouse_id = COALESCE(
        v_register.warehouse_id,
        public.get_or_create_default_warehouse(v_session.company_id)
    );

    -- Picking de devolución en borrador
    INSERT INTO public.picking (
        company_id, warehouse_id, order_id, type, status, is_return,
        notes, created_by, updated_by
    ) VALUES (
        v_session.company_id, v_warehouse_id, p_order_id, 'entrada', 'borrador', true,
        'Devolución POS: ' || btrim(p_reason), auth.uid(), auth.uid()
    )
    RETURNING id INTO v_pick_id;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_order_line
        FROM public.order_line
        WHERE id = (v_line->>'order_line_id')::UUID
          AND order_id = p_order_id;

        IF v_order_line.id IS NULL THEN
            RAISE EXCEPTION 'Línea de venta no encontrada';
        END IF;

        IF COALESCE((v_line->>'quantity')::DECIMAL, 0) <= 0 THEN
            RAISE EXCEPTION 'Cantidad a devolver inválida';
        END IF;

        -- Cantidad ya devuelta de este producto en devoluciones previas
        v_already_returned = 0;
        IF v_order_line.product_id IS NOT NULL THEN
            SELECT COALESCE(SUM(pl.quantity), 0) INTO v_already_returned
            FROM public.picking_line pl
            INNER JOIN public.picking p ON p.id = pl.picking_id
            WHERE p.order_id = p_order_id
              AND p.is_return = true
              AND p.status = 'confirmado'
              AND pl.product_id = v_order_line.product_id
              AND pl.active = true;
        END IF;

        IF (v_line->>'quantity')::DECIMAL > (v_order_line.quantity - v_already_returned) THEN
            RAISE EXCEPTION 'La cantidad a devolver excede lo vendido para %', v_order_line.description;
        END IF;

        -- Importe proporcional de la línea (incluye impuestos y descuentos)
        v_line_refund = ROUND(
            v_order_line.total * ((v_line->>'quantity')::DECIMAL / v_order_line.quantity), 2
        );
        v_refund_total = v_refund_total + v_line_refund;

        -- Reintegro de inventario solo para productos stockables
        IF v_order_line.product_id IS NOT NULL THEN
            SELECT id, tracking, is_stockable INTO v_product
            FROM public.product
            WHERE id = v_order_line.product_id;

            IF COALESCE(v_product.is_stockable, true) THEN
                v_has_stock_lines = true;

                INSERT INTO public.picking_line (
                    company_id, picking_id, product_id, sequence, quantity,
                    tracking_type, lot_name, serial_number,
                    created_by, updated_by
                ) VALUES (
                    v_session.company_id, v_pick_id, v_order_line.product_id,
                    v_sequence,
                    CASE WHEN v_product.tracking = 'serial' THEN 1
                         ELSE (v_line->>'quantity')::DECIMAL END,
                    v_product.tracking,
                    CASE WHEN v_product.tracking = 'lot' THEN 'DEVOLUCION-POS' ELSE NULL END,
                    CASE WHEN v_product.tracking = 'serial'
                         THEN 'RET-' || substr(gen_random_uuid()::TEXT, 1, 8) ELSE NULL END,
                    auth.uid(), auth.uid()
                );
                v_sequence = v_sequence + 10;

                -- Productos con serial: una línea por unidad
                IF v_product.tracking = 'serial' AND (v_line->>'quantity')::DECIMAL > 1 THEN
                    FOR i IN 2..((v_line->>'quantity')::DECIMAL)::INT LOOP
                        INSERT INTO public.picking_line (
                            company_id, picking_id, product_id, sequence, quantity,
                            tracking_type, serial_number, created_by, updated_by
                        ) VALUES (
                            v_session.company_id, v_pick_id, v_order_line.product_id,
                            v_sequence, 1, 'serial',
                            'RET-' || substr(gen_random_uuid()::TEXT, 1, 8),
                            auth.uid(), auth.uid()
                        );
                        v_sequence = v_sequence + 10;
                    END LOOP;
                END IF;
            END IF;
        END IF;
    END LOOP;

    IF v_refund_total <= 0 THEN
        RAISE EXCEPTION 'El importe a devolver debe ser mayor a cero';
    END IF;

    -- Confirmar picking de devolución (reintegra stock) o cancelarlo si solo servicios
    IF v_has_stock_lines THEN
        PERFORM public.set_picking_status(v_pick_id, 'publicado');
        PERFORM public.set_picking_status(v_pick_id, 'confirmado');
    ELSE
        PERFORM public.set_picking_status(v_pick_id, 'cancelado');
    END IF;

    -- Registrar reembolso (afecta el corte de ESTA sesión)
    INSERT INTO public.pos_payment (
        company_id, session_id, order_id, payment_method_id,
        amount, is_refund, notes, created_by, updated_by
    ) VALUES (
        v_session.company_id, p_session_id, p_order_id, p_payment_method_id,
        -v_refund_total, true, btrim(p_reason), auth.uid(), auth.uid()
    );

    RETURN jsonb_build_object(
        'refund_total', v_refund_total,
        'picking_id', v_pick_id,
        'order_id', p_order_id,
        'order_name', v_order.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Cerrar sesión de caja (corte Z) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_pos_session(
    p_session_id UUID,
    p_counts JSONB DEFAULT '[]'::jsonb,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_summary JSONB;
    v_method JSONB;
    v_count JSONB;
    v_expected DECIMAL(15, 2);
    v_counted DECIMAL(15, 2);
    v_method_id UUID;
    v_counted_map JSONB := '{}'::jsonb;
BEGIN
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
        RAISE EXCEPTION 'La sesión de caja ya está cerrada';
    END IF;

    v_summary = public.get_pos_session_summary(p_session_id);

    -- Mapa de contados por método
    IF p_counts IS NOT NULL THEN
        FOR v_count IN SELECT * FROM jsonb_array_elements(p_counts)
        LOOP
            v_counted_map = v_counted_map || jsonb_build_object(
                v_count->>'payment_method_id',
                jsonb_build_object(
                    'counted', COALESCE((v_count->>'counted')::DECIMAL, 0),
                    'justification', v_count->>'justification'
                )
            );
        END LOOP;
    END IF;

    -- Una fila de arqueo por método con actividad o conteo declarado
    FOR v_method IN
        SELECT * FROM jsonb_array_elements(v_summary->'methods')
    LOOP
        v_method_id = (v_method->>'payment_method_id')::UUID;

        IF (v_method->>'is_cash')::BOOLEAN THEN
            v_expected = (v_summary->>'expected_cash')::DECIMAL;
        ELSE
            v_expected = (v_method->>'expected')::DECIMAL;
        END IF;

        v_counted = COALESCE(
            ((v_counted_map->(v_method_id::TEXT))->>'counted')::DECIMAL,
            v_expected
        );

        INSERT INTO public.pos_session_count (
            company_id, session_id, payment_method_id,
            expected, counted, difference, justification,
            created_by, updated_by
        ) VALUES (
            v_session.company_id, p_session_id, v_method_id,
            v_expected, v_counted, v_counted - v_expected,
            (v_counted_map->(v_method_id::TEXT))->>'justification',
            auth.uid(), auth.uid()
        )
        ON CONFLICT (session_id, payment_method_id) DO UPDATE
        SET expected = EXCLUDED.expected,
            counted = EXCLUDED.counted,
            difference = EXCLUDED.difference,
            justification = EXCLUDED.justification,
            updated_by = auth.uid();

        v_counted_map = v_counted_map - v_method_id::TEXT;
    END LOOP;

    -- Métodos declarados sin actividad (ej. efectivo sin ventas pero con fondo)
    FOR v_method_id, v_count IN
        SELECT (key)::UUID, value FROM jsonb_each(v_counted_map)
    LOOP
        IF EXISTS (
            SELECT 1 FROM public.payment_method pm
            WHERE pm.id = v_method_id AND pm.company_id = v_session.company_id
        ) THEN
            SELECT CASE WHEN COALESCE(pm.is_cash, false)
                THEN (v_summary->>'expected_cash')::DECIMAL
                ELSE 0 END
            INTO v_expected
            FROM public.payment_method pm
            WHERE pm.id = v_method_id;

            v_counted = COALESCE((v_count->>'counted')::DECIMAL, 0);

            INSERT INTO public.pos_session_count (
                company_id, session_id, payment_method_id,
                expected, counted, difference, justification,
                created_by, updated_by
            ) VALUES (
                v_session.company_id, p_session_id, v_method_id,
                v_expected, v_counted, v_counted - v_expected,
                v_count->>'justification',
                auth.uid(), auth.uid()
            )
            ON CONFLICT (session_id, payment_method_id) DO NOTHING;
        END IF;
    END LOOP;

    UPDATE public.pos_session
    SET status = 'closed',
        closed_at = now(),
        closed_by = auth.uid(),
        closing_notes = p_notes,
        updated_by = auth.uid()
    WHERE id = p_session_id;

    RETURN public.get_pos_session_summary(p_session_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════════
-- Vistas
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_pos_sessions AS
SELECT
    s.*,
    r.name AS register_name,
    r.code AS register_code,
    r.blind_close,
    r.difference_tolerance,
    op.display_name AS opened_by_name,
    cp.display_name AS closed_by_name,
    (
        SELECT COUNT(*)
        FROM public."order" o
        WHERE o.pos_session_id = s.id AND o.order_state = 'posted'
    ) AS sales_count,
    (
        SELECT COALESCE(SUM(o.amount_total), 0)
        FROM public."order" o
        WHERE o.pos_session_id = s.id AND o.order_state = 'posted'
    ) AS sales_total,
    (
        SELECT COALESCE(SUM(-pp.amount), 0)
        FROM public.pos_payment pp
        WHERE pp.session_id = s.id AND pp.is_refund = true AND pp.active = true
    ) AS refunds_total,
    (
        SELECT COALESCE(SUM(sc.difference), 0)
        FROM public.pos_session_count sc
        WHERE sc.session_id = s.id AND sc.active = true
    ) AS total_difference
FROM public.pos_session s
INNER JOIN public.pos_register r ON r.id = s.register_id
LEFT JOIN public.partner op ON op.user_id = s.opened_by
LEFT JOIN public.partner cp ON cp.user_id = s.closed_by;

CREATE OR REPLACE VIEW public.v_pos_payments AS
SELECT
    pp.*,
    pm.name AS payment_method_name,
    COALESCE(pm.is_cash, false) AS payment_method_is_cash,
    o.name AS order_name,
    o.partner_id,
    pa.display_name AS partner_name,
    s.name AS session_name,
    s.register_id
FROM public.pos_payment pp
INNER JOIN public.payment_method pm ON pm.id = pp.payment_method_id
INNER JOIN public."order" o ON o.id = pp.order_id
LEFT JOIN public.partner pa ON pa.id = o.partner_id
INNER JOIN public.pos_session s ON s.id = pp.session_id;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.pos_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_session_count ENABLE ROW LEVEL SECURITY;

-- Cajas: lectura para miembros, gestión solo admins
DROP POLICY IF EXISTS "pos_register_select_company" ON public.pos_register;
CREATE POLICY "pos_register_select_company" ON public.pos_register
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "pos_register_admin_all" ON public.pos_register;
CREATE POLICY "pos_register_admin_all" ON public.pos_register
    FOR ALL
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

-- Sesiones, movimientos, pagos y arqueos: solo lectura directa.
-- Toda escritura pasa por RPCs SECURITY DEFINER con validaciones.
DROP POLICY IF EXISTS "pos_session_select_company" ON public.pos_session;
CREATE POLICY "pos_session_select_company" ON public.pos_session
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "pos_cash_movement_select_company" ON public.pos_cash_movement;
CREATE POLICY "pos_cash_movement_select_company" ON public.pos_cash_movement
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "pos_payment_select_company" ON public.pos_payment;
CREATE POLICY "pos_payment_select_company" ON public.pos_payment
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "pos_session_count_select_company" ON public.pos_session_count;
CREATE POLICY "pos_session_count_select_company" ON public.pos_session_count
    FOR SELECT USING (public.user_belongs_to_company(company_id));

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.open_pos_session(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_pos_cash_movement(UUID, public.pos_movement_type, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_session_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_pos_sale(UUID, UUID, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_pos_refund(UUID, UUID, JSONB, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_pos_session(UUID, JSONB, TEXT) TO authenticated;

-- ── Comentarios ──────────────────────────────────────────────────────────────
COMMENT ON TABLE public.pos_register IS 'Cajas / terminales de punto de venta por empresa';
COMMENT ON TABLE public.pos_session IS 'Sesiones de caja: apertura, operación y corte Z';
COMMENT ON TABLE public.pos_cash_movement IS 'Entradas y salidas de efectivo durante una sesión de caja';
COMMENT ON TABLE public.pos_payment IS 'Pagos (split) y reembolsos POS ligados a órdenes de venta';
COMMENT ON TABLE public.pos_session_count IS 'Arqueo del corte: esperado vs contado por método de pago';

COMMENT ON FUNCTION public.register_pos_sale(UUID, UUID, JSONB, JSONB, TEXT) IS
    'Venta POS atómica: crea orden de venta, líneas, confirma, entrega (picking confirmado descuenta stock) y registra pagos split';
COMMENT ON FUNCTION public.register_pos_refund(UUID, UUID, JSONB, UUID, TEXT) IS
    'Devolución POS parcial/total: picking de retorno confirmado (reintegra stock) y reembolso negativo en la sesión actual';
COMMENT ON FUNCTION public.close_pos_session(UUID, JSONB, TEXT) IS
    'Corte Z: calcula esperado por método, registra arqueo con diferencias y cierra la sesión (inmutable)';
