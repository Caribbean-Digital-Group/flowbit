-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Fase 2 — Entrega y pagos derivados de documentos                          ║
-- ║  (docs/sales-flow-analysis.md §4.1–4.3, hallazgos V1–V4, V6, P3, P5)       ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  1. Columnas nuevas      — estado de entrega, pagado, devuelto, costo real ║
-- ║  2. Campos del sistema   — entrega y pago ya no se editan a mano           ║
-- ║  3. Libro de pagos       — order_payment (cobros, abonos y reembolsos)     ║
-- ║  4. Devoluciones         — order_refund / order_refund_line               ║
-- ║  5. Entrega              — «Preparar entrega», backorders, retroalimenta   ║
-- ║  6. Confirmar picking    — actualiza la orden; devoluciones al costo real  ║
-- ║  7. Canales              — POS, Stripe y tienda escriben en el libro       ║
-- ║  8. Cancelación          — solo si nada salió ni se cobró                  ║
-- ║  9. Implantación         — backfill desde pickings, POS y pagos previos    ║
-- ║ 10. Vistas               — v_orders, v_order_lines, pagos y devoluciones   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Decisión de negocio (2026-11-03): el ingreso se reconoce AL COBRAR. Por eso
-- el libro de pagos es la fuente de los reportes de ingresos (fase 4).
--
-- Convención: las columnas derivadas de la orden solo las escriben funciones
-- del sistema, que activan la bandera de transacción `flowbit.order_sync`.


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Columnas nuevas
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public."order"
    ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'partial', 'delivered', 'no_delivery')),
    ADD COLUMN IF NOT EXISTS amount_paid     DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS amount_refunded DECIMAL(15, 2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public."order".delivery_status IS
    'Derivado de los pickings confirmados: pending | partial | delivered | no_delivery (sin productos inventariables).';
COMMENT ON COLUMN public."order".amount_paid IS
    'Neto cobrado (cobros − reembolsos) según order_payment. Derivado.';
COMMENT ON COLUMN public."order".amount_refunded IS
    'Importe (con impuestos) de las devoluciones registradas en order_refund. Derivado.';

ALTER TABLE public.order_line
    ADD COLUMN IF NOT EXISTS quantity_returned DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS quantity_refunded DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS cost_delivered    DECIMAL(15, 4) NOT NULL DEFAULT 0.0000;

COMMENT ON COLUMN public.order_line.quantity_delivered IS
    'Unidades entregadas (venta) o recibidas (compra) según pickings confirmados.';
COMMENT ON COLUMN public.order_line.quantity_returned IS
    'Unidades que regresaron al almacén por devolución.';
COMMENT ON COLUMN public.order_line.quantity_refunded IS
    'Unidades acreditadas al cliente en devoluciones (regresen o no al almacén).';
COMMENT ON COLUMN public.order_line.cost_delivered IS
    'Costo real (del libro de inventario) de las unidades entregadas netas de devoluciones.';

ALTER TABLE public.picking
    ADD COLUMN IF NOT EXISTS backorder_of_id UUID REFERENCES public.picking(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.picking.backorder_of_id IS
    'Picking parcial del que nace este backorder (lo pendiente por entregar).';

CREATE INDEX IF NOT EXISTS idx_order_delivery_status
    ON public."order"(company_id, delivery_status)
    WHERE order_state = 'posted';


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Campos administrados por el sistema
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Entrega y pago se derivan de documentos (pickings y pagos). Si alguien los
 * escribe directamente —el formulario, un script— el valor se ignora: en un
 * INSERT nacen en su estado inicial y en un UPDATE conservan el anterior.
 * Solo las funciones que activan `flowbit.order_sync` pueden cambiarlos.
 */
CREATE OR REPLACE FUNCTION public.protect_order_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('flowbit.order_sync', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.delivery_status := 'pending';
        NEW.is_delivered    := false;
        NEW.amount_paid     := 0;
        NEW.amount_refunded := 0;
        NEW.payment_status  := 'unpaid';
        NEW.is_paid         := false;
        NEW.paid_at         := NULL;
    ELSE
        NEW.delivery_status := OLD.delivery_status;
        NEW.is_delivered    := OLD.is_delivered;
        NEW.amount_paid     := OLD.amount_paid;
        NEW.amount_refunded := OLD.amount_refunded;
        NEW.payment_status  := OLD.payment_status;
        NEW.is_paid         := OLD.is_paid;
        NEW.paid_at         := OLD.paid_at;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_00_protect_system_fields ON public."order";
CREATE TRIGGER trigger_order_00_protect_system_fields
    BEFORE INSERT OR UPDATE ON public."order"
    FOR EACH ROW EXECUTE FUNCTION public.protect_order_system_fields();

-- Las cancelaciones se bloquean por lo que ya ocurrió, no por casillas.
CREATE OR REPLACE FUNCTION public.handle_order_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.order_state = 'posted' AND OLD.order_state = 'draft' THEN
        NEW.confirmation_date := COALESCE(NEW.confirmation_date, now());
    END IF;

    IF NEW.order_state = 'cancel' THEN
        IF OLD.delivery_status IN ('partial', 'delivered') THEN
            RAISE EXCEPTION 'No se puede cancelar: la orden ya tiene entregas confirmadas. Registra una devolución.';
        END IF;
        IF COALESCE(OLD.amount_paid, 0) > 0.005 THEN
            RAISE EXCEPTION 'No se puede cancelar: la orden tiene pagos registrados. Reembolsa o anula los pagos primero.';
        END IF;
        IF COALESCE(OLD.is_invoiced, false) THEN
            RAISE EXCEPTION 'No se puede cancelar una orden facturada.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Libro de pagos
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.order_payment (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    order_id          UUID NOT NULL REFERENCES public."order"(id) ON DELETE RESTRICT,
    payment_method_id UUID REFERENCES public.payment_method(id) ON DELETE SET NULL,

    -- Positivo = cobro (venta) o pago (compra); negativo = reembolso.
    amount            DECIMAL(15, 2) NOT NULL CHECK (amount <> 0),
    paid_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    source            VARCHAR(20) NOT NULL DEFAULT 'dashboard'
        CHECK (source IN ('dashboard', 'pos', 'stripe', 'backfill')),

    pos_session_id    UUID REFERENCES public.pos_session(id) ON DELETE SET NULL,
    pos_payment_id    UUID UNIQUE REFERENCES public.pos_payment(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT,
    refund_id         UUID,

    reference         VARCHAR(180),
    notes             TEXT,

    active            BOOLEAN NOT NULL DEFAULT true,
    voided_at         TIMESTAMPTZ,
    void_reason       TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.order_payment IS
    'Libro de cobros, abonos y reembolsos de todas las órdenes y canales. Fuente del ingreso reconocido (base de caja).';

CREATE INDEX IF NOT EXISTS idx_order_payment_company ON public.order_payment(company_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_payment_order   ON public.order_payment(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payment_active  ON public.order_payment(active);
CREATE INDEX IF NOT EXISTS idx_order_payment_stripe  ON public.order_payment(stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_order_payment_updated_at ON public.order_payment;
CREATE TRIGGER update_order_payment_updated_at
    BEFORE UPDATE ON public.order_payment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.order_payment ENABLE ROW LEVEL SECURITY;

-- Lectura para la empresa; la escritura ocurre solo en funciones del sistema.
DROP POLICY IF EXISTS "Users can view company order payments" ON public.order_payment;
CREATE POLICY "Users can view company order payments" ON public.order_payment
    FOR SELECT USING (public.user_belongs_to_company(company_id));

REVOKE ALL ON public.order_payment FROM anon;

/**
 * Recalcula pagado, estado de pago y fecha de pago de una orden a partir del
 * libro. Saldo = total − devoluciones − pagado.
 */
CREATE OR REPLACE FUNCTION public.recompute_order_payment(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order  RECORD;
    v_paid   DECIMAL(15, 2);
    v_last   TIMESTAMPTZ;
    v_due    DECIMAL(15, 2);
    v_status TEXT;
    v_prev   TEXT := current_setting('flowbit.order_sync', true);
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(amount), 0), MAX(paid_at) FILTER (WHERE amount > 0)
    INTO v_paid, v_last
    FROM public.order_payment
    WHERE order_id = p_order_id AND active;

    v_due := COALESCE(v_order.amount_total, 0) - COALESCE(v_order.amount_refunded, 0);

    v_status := CASE
        WHEN v_order.order_state <> 'posted' AND v_paid <= 0.005 THEN 'unpaid'
        WHEN v_due <= 0.005 THEN 'paid'
        WHEN v_paid >= v_due - 0.01 THEN 'paid'
        WHEN v_order.payment_status = 'condoned' THEN 'condoned'
        WHEN v_paid > 0.005 THEN 'partial'
        WHEN v_order.payment_due_date IS NOT NULL AND v_order.payment_due_date < CURRENT_DATE THEN 'overdue'
        ELSE 'unpaid'
    END;

    PERFORM set_config('flowbit.order_sync', 'on', true);

    UPDATE public."order"
    SET amount_paid    = v_paid,
        payment_status = v_status,
        is_paid        = (v_status = 'paid'),
        paid_at        = CASE WHEN v_status = 'paid'
                              THEN COALESCE(v_order.paid_at, v_last, now())
                              ELSE NULL END
    WHERE id = p_order_id;

    PERFORM set_config('flowbit.order_sync', COALESCE(NULLIF(v_prev, ''), 'off'), true);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_order_payment(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_order_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.recompute_order_payment(COALESCE(NEW.order_id, OLD.order_id));
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_payment_sync ON public.order_payment;
CREATE TRIGGER trigger_order_payment_sync
    AFTER INSERT OR UPDATE OF amount, active ON public.order_payment
    FOR EACH ROW EXECUTE FUNCTION public.sync_order_payment_status();

-- Cada cobro o reembolso del POS queda también en el libro general.
CREATE OR REPLACE FUNCTION public.mirror_pos_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.order_payment (
        company_id, order_id, payment_method_id, amount, paid_at, source,
        pos_session_id, pos_payment_id, refund_id, notes, created_by, updated_by
    ) VALUES (
        NEW.company_id, NEW.order_id, NEW.payment_method_id, NEW.amount,
        COALESCE(NEW.created_at, now()), 'pos',
        NEW.session_id, NEW.id,
        NULLIF(current_setting('flowbit.current_refund_id', true), '')::UUID,
        NEW.notes, NEW.created_by, NEW.created_by
    )
    ON CONFLICT (pos_payment_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_mirror_pos_payment ON public.pos_payment;
CREATE TRIGGER trigger_mirror_pos_payment
    AFTER INSERT ON public.pos_payment
    FOR EACH ROW EXECUTE FUNCTION public.mirror_pos_payment();

/** Registro de un cobro o abono desde el panel. */
CREATE OR REPLACE FUNCTION public.register_order_payment(
    p_order_id          UUID,
    p_amount            DECIMAL,
    p_payment_method_id UUID,
    p_paid_at           TIMESTAMPTZ DEFAULT NULL,
    p_reference         TEXT DEFAULT NULL,
    p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order   RECORD;
    v_balance DECIMAL(15, 2);
    v_id      UUID;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Orden no encontrada';
    END IF;

    IF v_order.order_state <> 'posted' THEN
        RAISE EXCEPTION 'Solo se registran pagos de órdenes confirmadas';
    END IF;

    IF COALESCE(p_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser mayor a cero';
    END IF;

    IF p_payment_method_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.payment_method
        WHERE id = p_payment_method_id AND company_id = v_order.company_id AND active = true
    ) THEN
        RAISE EXCEPTION 'Método de pago inválido';
    END IF;

    v_balance := COALESCE(v_order.amount_total, 0)
               - COALESCE(v_order.amount_refunded, 0)
               - COALESCE(v_order.amount_paid, 0);

    IF p_amount > v_balance + 0.01 THEN
        RAISE EXCEPTION 'El pago (%) excede el saldo pendiente (%)', p_amount, GREATEST(v_balance, 0);
    END IF;

    INSERT INTO public.order_payment (
        company_id, order_id, payment_method_id, amount, paid_at, source,
        reference, notes, created_by, updated_by
    ) VALUES (
        v_order.company_id, v_order.id, p_payment_method_id, ROUND(p_amount, 2),
        COALESCE(p_paid_at, now()), 'dashboard',
        NULLIF(btrim(COALESCE(p_reference, '')), ''),
        NULLIF(btrim(COALESCE(p_notes, '')), ''),
        auth.uid(), auth.uid()
    )
    RETURNING id INTO v_id;

    -- Último método usado, por compatibilidad con la ficha de la orden
    UPDATE public."order"
    SET payment_method_id = p_payment_method_id,
        updated_by = auth.uid()
    WHERE id = v_order.id;

    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'payment_id', v_id,
        'amount_paid', v_order.amount_paid,
        'payment_status', v_order.payment_status,
        'balance', GREATEST(v_order.amount_total - v_order.amount_refunded - v_order.amount_paid, 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_order_payment(UUID, DECIMAL, UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_order_payment(UUID, DECIMAL, UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

/** Anula un pago capturado por error (solo owner/admin; no aplica a POS ni Stripe). */
CREATE OR REPLACE FUNCTION public.void_order_payment(p_payment_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment RECORD;
BEGIN
    SELECT * INTO v_payment FROM public.order_payment WHERE id = p_payment_id FOR UPDATE;

    IF v_payment.id IS NULL OR NOT public.is_company_admin(v_payment.company_id) THEN
        RAISE EXCEPTION 'Solo un administrador puede anular pagos';
    END IF;

    IF v_payment.source IN ('pos', 'stripe') THEN
        RAISE EXCEPTION 'Los pagos del POS y de Stripe se corrigen con una devolución, no se anulan';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'El motivo es obligatorio';
    END IF;

    IF NOT v_payment.active THEN
        RETURN true;
    END IF;

    UPDATE public.order_payment
    SET active = false,
        voided_at = now(),
        void_reason = btrim(p_reason),
        updated_by = auth.uid()
    WHERE id = p_payment_id;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.void_order_payment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_order_payment(UUID, TEXT) TO authenticated;

/** Condona el saldo pendiente (solo owner/admin). */
CREATE OR REPLACE FUNCTION public.condone_order_balance(p_order_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR NOT public.is_company_admin(v_order.company_id) THEN
        RAISE EXCEPTION 'Solo un administrador puede condonar saldos';
    END IF;

    IF v_order.order_state <> 'posted' OR v_order.payment_status = 'paid' THEN
        RAISE EXCEPTION 'Solo se condona el saldo de órdenes confirmadas con saldo pendiente';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'El motivo es obligatorio';
    END IF;

    PERFORM set_config('flowbit.order_sync', 'on', true);
    UPDATE public."order"
    SET payment_status = 'condoned',
        notes = concat_ws(E'\n', NULLIF(notes, ''), format('[Saldo condonado %s] %s', to_char(now(), 'YYYY-MM-DD'), btrim(p_reason))),
        updated_by = auth.uid()
    WHERE id = p_order_id;
    PERFORM set_config('flowbit.order_sync', 'off', true);

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.condone_order_balance(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.condone_order_balance(UUID, TEXT) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. Devoluciones
-- ════════════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS public.order_refund_seq START 1;

CREATE TABLE IF NOT EXISTS public.order_refund (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES public."order"(id) ON DELETE RESTRICT,
    name            VARCHAR(40),
    reason          TEXT NOT NULL,

    amount_untaxed  DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    amount_tax      DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    amount_total    DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    amount_reimbursed DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    picking_id      UUID REFERENCES public.picking(id) ON DELETE SET NULL,
    pos_session_id  UUID REFERENCES public.pos_session(id) ON DELETE SET NULL,
    is_backfill     BOOLEAN NOT NULL DEFAULT false,

    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.order_refund IS
    'Devoluciones de venta: acreditan al cliente, reintegran inventario (picking) y opcionalmente reembolsan dinero (order_payment negativo).';

CREATE TABLE IF NOT EXISTS public.order_refund_line (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    refund_id        UUID NOT NULL REFERENCES public.order_refund(id) ON DELETE CASCADE,
    order_line_id    UUID NOT NULL REFERENCES public.order_line(id) ON DELETE RESTRICT,
    product_id       UUID REFERENCES public.product(id) ON DELETE SET NULL,
    description      TEXT,
    quantity         DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    restock_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (restock_quantity >= 0),
    subtotal         DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    tax_amount       DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    total            DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    created_at       TIMESTAMPTZ DEFAULT now(),
    CHECK (restock_quantity <= quantity)
);

ALTER TABLE public.order_payment
    DROP CONSTRAINT IF EXISTS order_payment_refund_id_fkey;
ALTER TABLE public.order_payment
    ADD CONSTRAINT order_payment_refund_id_fkey
    FOREIGN KEY (refund_id) REFERENCES public.order_refund(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_refund_company ON public.order_refund(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_refund_order   ON public.order_refund(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refund_line_refund ON public.order_refund_line(refund_id);
CREATE INDEX IF NOT EXISTS idx_order_refund_line_order_line ON public.order_refund_line(order_line_id);

DROP TRIGGER IF EXISTS update_order_refund_updated_at ON public.order_refund;
CREATE TRIGGER update_order_refund_updated_at
    BEFORE UPDATE ON public.order_refund
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_order_refund_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.name IS NULL OR NEW.name = '' THEN
        NEW.name := 'RF-' || lpad(nextval('public.order_refund_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_refund_name ON public.order_refund;
CREATE TRIGGER trigger_order_refund_name
    BEFORE INSERT ON public.order_refund
    FOR EACH ROW EXECUTE FUNCTION public.generate_order_refund_name();

ALTER TABLE public.order_refund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_refund_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company refunds" ON public.order_refund;
CREATE POLICY "Users can view company refunds" ON public.order_refund
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Users can view company refund lines" ON public.order_refund_line;
CREATE POLICY "Users can view company refund lines" ON public.order_refund_line
    FOR SELECT USING (public.user_belongs_to_company(company_id));

REVOKE ALL ON public.order_refund, public.order_refund_line FROM anon;

-- Las devoluciones de la tienda se reflejan en la analítica (valor real devuelto)
CREATE OR REPLACE FUNCTION public.storefront_track_refund_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT id, origin, checkout_token, currency, name INTO v_order
    FROM public."order" WHERE id = NEW.order_id;

    IF v_order.origin = 'storefront' AND NOT NEW.is_backfill THEN
        INSERT INTO public.storefront_event (
            id, company_id, event_name, event_category,
            order_id, checkout_token, value, currency, properties, server_ts
        ) VALUES (
            md5('storefront_refund_doc:' || NEW.id::text)::uuid,
            NEW.company_id, 'refund', 'ecommerce',
            NEW.order_id, v_order.checkout_token, NEW.amount_total, v_order.currency,
            jsonb_build_object('order_ref', v_order.name, 'refund_ref', NEW.name),
            now()
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_storefront_track_refund_document ON public.order_refund;
CREATE TRIGGER trigger_storefront_track_refund_document
    AFTER INSERT ON public.order_refund
    FOR EACH ROW EXECUTE FUNCTION public.storefront_track_refund_document();


-- ════════════════════════════════════════════════════════════════════════════
-- 5. Entrega
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Almacén de salida/entrada de una orden. En esta fase: el predeterminado.
 * La fase 3 lo redefine (almacén de la orden, de la tienda o de la caja).
 */
CREATE OR REPLACE FUNCTION public.resolve_order_warehouse(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
BEGIN
    SELECT company_id INTO v_company FROM public."order" WHERE id = p_order_id;
    RETURN public.get_or_create_default_warehouse(v_company);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_order_warehouse(UUID) FROM PUBLIC, anon, authenticated;

/**
 * Escribe las líneas de picking de un producto. Punto único para que la
 * fase 3 asigne lotes y series reales (FIFO) en lugar de marcadores.
 * Devuelve la siguiente secuencia.
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
BEGIN
    IF COALESCE(p_quantity, 0) <= 0 THEN
        RETURN v_seq;
    END IF;

    SELECT * INTO v_pick FROM public.picking WHERE id = p_picking_id;
    SELECT id, tracking, company_id INTO v_product FROM public.product WHERE id = p_product_id;

    IF v_product.id IS NULL OR v_product.company_id <> v_pick.company_id THEN
        RAISE EXCEPTION 'Producto % no pertenece a la empresa del movimiento', p_product_id;
    END IF;

    IF v_product.tracking = 'serial' THEN
        IF MOD(p_quantity, 1) <> 0 THEN
            RAISE EXCEPTION 'Los productos con número de serie requieren cantidades enteras';
        END IF;
        FOR i IN 1..p_quantity::INT LOOP
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
            v_pick.company_id, p_picking_id, p_product_id, v_seq, p_quantity, 'lot',
            CASE WHEN p_is_return THEN 'DEVOLUCION' ELSE 'LOTE-PENDIENTE' END,
            auth.uid(), auth.uid()
        );
        v_seq := v_seq + 10;
    ELSE
        INSERT INTO public.picking_line (
            company_id, picking_id, product_id, sequence, quantity,
            tracking_type, created_by, updated_by
        ) VALUES (
            v_pick.company_id, p_picking_id, p_product_id, v_seq, p_quantity, 'none',
            auth.uid(), auth.uid()
        );
        v_seq := v_seq + 10;
    END IF;

    RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.build_picking_lines(UUID, UUID, DECIMAL, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;

/** Pendiente por entregar de cada línea (neto de devoluciones y acreditaciones). */
CREATE OR REPLACE FUNCTION public.order_line_pending_quantity(
    p_quantity  DECIMAL,
    p_delivered DECIMAL,
    p_returned  DECIMAL,
    p_refunded  DECIMAL
)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT GREATEST(
        0,
        COALESCE(p_quantity, 0) - COALESCE(p_refunded, 0)
        - (COALESCE(p_delivered, 0) - COALESCE(p_returned, 0))
    );
$$;

/** Estado de entrega derivado de las líneas inventariables. */
CREATE OR REPLACE FUNCTION public.recompute_order_delivery(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lines     INT;
    v_pending   DECIMAL(15, 3);
    v_delivered DECIMAL(15, 3);
    v_status    TEXT;
    v_prev      TEXT := current_setting('flowbit.order_sync', true);
BEGIN
    SELECT
        COUNT(*),
        COALESCE(SUM(public.order_line_pending_quantity(
            ol.quantity, ol.quantity_delivered, ol.quantity_returned, ol.quantity_refunded)), 0),
        COALESCE(SUM(ol.quantity_delivered), 0)
    INTO v_lines, v_pending, v_delivered
    FROM public.order_line ol
    JOIN public.product p ON p.id = ol.product_id
    WHERE ol.order_id = p_order_id
      AND COALESCE(p.is_stockable, true)
      AND ol.quantity > 0;

    v_status := CASE
        WHEN v_lines = 0 THEN 'no_delivery'
        WHEN v_pending <= 0.0005 AND v_delivered > 0 THEN 'delivered'
        WHEN v_pending <= 0.0005 THEN 'no_delivery'
        WHEN v_delivered > 0 THEN 'partial'
        ELSE 'pending'
    END;

    PERFORM set_config('flowbit.order_sync', 'on', true);

    UPDATE public."order"
    SET delivery_status = v_status,
        is_delivered    = v_status IN ('delivered', 'no_delivery') AND order_state = 'posted',
        delivery_date   = CASE WHEN v_status = 'delivered'
                               THEN COALESCE(delivery_date, CURRENT_DATE)
                               ELSE delivery_date END
    WHERE id = p_order_id
      AND (delivery_status IS DISTINCT FROM v_status
           OR is_delivered IS DISTINCT FROM (v_status IN ('delivered', 'no_delivery') AND order_state = 'posted')
           OR (v_status = 'delivered' AND delivery_date IS NULL));

    PERFORM set_config('flowbit.order_sync', COALESCE(NULLIF(v_prev, ''), 'off'), true);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_order_delivery(UUID) FROM PUBLIC, anon, authenticated;

/**
 * Prepara la entrega (venta) o recepción (compra) de lo pendiente: crea o
 * reconstruye el picking en borrador. Si ya hay uno publicado (en surtido),
 * lo devuelve sin tocarlo. Las reservas de stock nacen aquí (fase 3).
 */
CREATE OR REPLACE FUNCTION public._prepare_order_delivery(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order     RECORD;
    v_open      RECORD;
    v_pick_id   UUID;
    v_created   BOOLEAN := false;
    v_type      public.picking_type;
    v_warehouse UUID;
    v_seq       INT := 10;
    r_pending   RECORD;
    v_count     INT := 0;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Orden no encontrada';
    END IF;

    IF v_order.order_state <> 'posted' THEN
        RAISE EXCEPTION 'Solo las órdenes confirmadas se preparan para entrega';
    END IF;

    v_type := CASE WHEN v_order.order_type = 'purchase' THEN 'entrada' ELSE 'salida' END;

    SELECT COUNT(*) INTO v_count
    FROM public.order_line ol
    JOIN public.product p ON p.id = ol.product_id
    WHERE ol.order_id = p_order_id
      AND COALESCE(p.is_stockable, true)
      AND public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered,
                                             ol.quantity_returned, ol.quantity_refunded) > 0;

    SELECT id, status INTO v_open
    FROM public.picking
    WHERE order_id = p_order_id
      AND NOT COALESCE(is_return, false)
      AND status IN ('borrador', 'publicado')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_open.id IS NOT NULL AND v_open.status = 'publicado' THEN
        RETURN jsonb_build_object('status', 'in_progress', 'picking_id', v_open.id, 'created', false);
    END IF;

    IF v_count = 0 THEN
        -- Nada pendiente: un borrador sobrante se cancela (libera la reserva)
        IF v_open.id IS NOT NULL THEN
            UPDATE public.picking
            SET status = 'cancelado', cancelled_at = now(), active = false, updated_by = auth.uid()
            WHERE id = v_open.id;
        END IF;
        PERFORM public.recompute_order_delivery(p_order_id);
        RETURN jsonb_build_object('status', 'nothing_pending', 'picking_id', NULL, 'created', false);
    END IF;

    v_warehouse := public.resolve_order_warehouse(p_order_id);

    IF v_open.id IS NULL THEN
        INSERT INTO public.picking (
            company_id, warehouse_id, order_id, type, status, is_return,
            created_by, updated_by
        ) VALUES (
            v_order.company_id, v_warehouse, v_order.id, v_type, 'borrador', false,
            auth.uid(), auth.uid()
        )
        RETURNING id INTO v_pick_id;
        v_created := true;
    ELSE
        v_pick_id := v_open.id;
        UPDATE public.picking
        SET warehouse_id = v_warehouse, type = v_type, updated_by = auth.uid()
        WHERE id = v_pick_id;
        DELETE FROM public.picking_line WHERE picking_id = v_pick_id;
    END IF;

    FOR r_pending IN
        SELECT ol.product_id,
               SUM(public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered,
                                                      ol.quantity_returned, ol.quantity_refunded)) AS qty,
               MIN(ol.sequence) AS seq
        FROM public.order_line ol
        JOIN public.product p ON p.id = ol.product_id
        WHERE ol.order_id = p_order_id
          AND COALESCE(p.is_stockable, true)
        GROUP BY ol.product_id
        HAVING SUM(public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered,
                                                      ol.quantity_returned, ol.quantity_refunded)) > 0
        ORDER BY MIN(ol.sequence)
    LOOP
        v_seq := public.build_picking_lines(v_pick_id, r_pending.product_id, r_pending.qty, v_seq, false);
    END LOOP;

    RETURN jsonb_build_object('status', 'ok', 'picking_id', v_pick_id, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public._prepare_order_delivery(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_order_delivery(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
BEGIN
    SELECT company_id INTO v_company FROM public."order" WHERE id = p_order_id;
    IF v_company IS NULL OR NOT public.user_belongs_to_company(v_company) THEN
        RAISE EXCEPTION 'Orden no encontrada';
    END IF;
    RETURN public._prepare_order_delivery(p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_order_delivery(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_order_delivery(UUID) TO authenticated;

COMMENT ON FUNCTION public.prepare_order_delivery(UUID) IS
    'Crea o actualiza el picking en borrador con lo pendiente de entregar/recibir de la orden.';

/**
 * Compatibilidad: la pantalla de movimientos y el alta de compras siguen
 * llamando a sync_order_to_draft_picking. Ahora delega en la preparación de
 * entrega (no devolución) o arma una devolución de lo entregado.
 */
CREATE OR REPLACE FUNCTION public.sync_order_to_draft_picking(
    p_order_id UUID,
    p_is_return BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order   RECORD;
    v_result  JSONB;
    v_pick_id UUID;
    v_seq     INT := 10;
    r_line    RECORD;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state = 'cancel' THEN
        RAISE EXCEPTION 'Cancelled orders cannot create pickings';
    END IF;

    IF NOT p_is_return THEN
        v_result := public._prepare_order_delivery(p_order_id);
        RETURN NULLIF(v_result->>'picking_id', '')::UUID;
    END IF;

    -- Devolución en borrador de lo entregado y aún no devuelto
    SELECT id INTO v_pick_id
    FROM public.picking
    WHERE order_id = p_order_id AND is_return AND status = 'borrador'
    ORDER BY created_at DESC LIMIT 1;

    IF v_pick_id IS NULL THEN
        INSERT INTO public.picking (
            company_id, warehouse_id, order_id, type, status, is_return, created_by, updated_by
        ) VALUES (
            v_order.company_id, public.resolve_order_warehouse(p_order_id), v_order.id,
            CASE WHEN v_order.order_type = 'purchase' THEN 'salida' ELSE 'entrada' END::public.picking_type,
            'borrador', true, auth.uid(), auth.uid()
        )
        RETURNING id INTO v_pick_id;
    ELSE
        DELETE FROM public.picking_line WHERE picking_id = v_pick_id;
    END IF;

    FOR r_line IN
        SELECT ol.product_id, SUM(ol.quantity_delivered - ol.quantity_returned) AS qty
        FROM public.order_line ol
        JOIN public.product p ON p.id = ol.product_id
        WHERE ol.order_id = p_order_id AND COALESCE(p.is_stockable, true)
        GROUP BY ol.product_id
        HAVING SUM(ol.quantity_delivered - ol.quantity_returned) > 0
    LOOP
        v_seq := public.build_picking_lines(v_pick_id, r_line.product_id, r_line.qty, v_seq, true);
    END LOOP;

    RETURN v_pick_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_to_draft_picking(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_order_to_draft_picking(UUID, BOOLEAN) TO authenticated;

-- Marcar «entregada» ya no dispara nada: la entrega la dicta el almacén.
DROP TRIGGER IF EXISTS trigger_sync_picking_on_order_delivery ON public."order";
DROP TRIGGER IF EXISTS trigger_sync_picking_after_order_line_change ON public.order_line;

-- Las órdenes de la tienda quedan preparadas al confirmarse: entran a la
-- cola de surtido y reservan su stock (fase 3). Nunca rompe el checkout.
CREATE OR REPLACE FUNCTION public.auto_prepare_storefront_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    BEGIN
        PERFORM public._prepare_order_delivery(NEW.id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'No se pudo preparar la entrega de %: %', NEW.name, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_prepare_storefront_delivery ON public."order";
CREATE TRIGGER trigger_auto_prepare_storefront_delivery
    AFTER UPDATE OF order_state ON public."order"
    FOR EACH ROW
    WHEN (
        NEW.origin = 'storefront'
        AND NEW.order_state = 'posted'
        AND OLD.order_state IS DISTINCT FROM 'posted'
    )
    EXECUTE FUNCTION public.auto_prepare_storefront_delivery();

CREATE OR REPLACE FUNCTION public.post_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state <> 'draft' THEN
        RAISE EXCEPTION 'Only draft orders can be posted';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.order_line WHERE order_id = p_order_id) THEN
        RAISE EXCEPTION 'Cannot post an order without lines';
    END IF;

    UPDATE public."order"
    SET order_state = 'posted',
        confirmation_date = COALESCE(confirmation_date, now()),
        updated_by = auth.uid()
    WHERE id = p_order_id;

    PERFORM public.recompute_order_delivery(p_order_id);

    -- Las compras quedan listas para recibir; las ventas se preparan a mano
    -- («Preparar entrega»), que es cuando se reserva el stock.
    IF v_order.order_type = 'purchase' THEN
        PERFORM public._prepare_order_delivery(p_order_id);
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.post_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state = 'cancel' THEN
        RAISE EXCEPTION 'Order is already cancelled';
    END IF;

    -- handle_order_state_change valida entregas, pagos y facturación
    UPDATE public."order"
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
$$;

REVOKE ALL ON FUNCTION public.cancel_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. Confirmación de picking → orden
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Reparte cantidades y costo de un picking confirmado entre las líneas de la
 * orden (primero las de menor secuencia).
 *   deliver: entregas de venta o recepciones de compra
 *   return:  devoluciones (regresan al almacén)
 */
CREATE OR REPLACE FUNCTION public.apply_picking_to_order(p_picking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pick     RECORD;
    r_move     RECORD;
    r_line     RECORD;
    v_left     DECIMAL(15, 3);
    v_take     DECIMAL(15, 3);
    v_unit     DECIMAL(15, 6);
    v_last_id  UUID;
BEGIN
    SELECT * INTO v_pick FROM public.picking WHERE id = p_picking_id;
    IF v_pick.id IS NULL OR v_pick.order_id IS NULL THEN
        RETURN;
    END IF;

    FOR r_move IN
        SELECT product_id, SUM(quantity) AS qty, SUM(total_cost) AS cost
        FROM public.stock_move
        WHERE picking_id = p_picking_id
        GROUP BY product_id
    LOOP
        v_left := r_move.qty;
        v_unit := COALESCE(r_move.cost / NULLIF(r_move.qty, 0), 0);
        v_last_id := NULL;

        FOR r_line IN
            SELECT *
            FROM public.order_line
            WHERE order_id = v_pick.order_id AND product_id = r_move.product_id
            ORDER BY sequence, id
            FOR UPDATE
        LOOP
            v_last_id := r_line.id;
            EXIT WHEN v_left <= 0;

            IF COALESCE(v_pick.is_return, false) THEN
                v_take := LEAST(v_left, GREATEST(r_line.quantity_delivered - r_line.quantity_returned, 0));
                IF v_take > 0 THEN
                    UPDATE public.order_line
                    SET quantity_returned = quantity_returned + v_take,
                        cost_delivered    = GREATEST(cost_delivered - ROUND(v_take * v_unit, 4), 0)
                    WHERE id = r_line.id;
                END IF;
            ELSE
                v_take := LEAST(v_left, public.order_line_pending_quantity(
                    r_line.quantity, r_line.quantity_delivered,
                    r_line.quantity_returned, r_line.quantity_refunded));
                IF v_take > 0 THEN
                    UPDATE public.order_line
                    SET quantity_delivered = quantity_delivered + v_take,
                        cost_delivered     = cost_delivered + ROUND(v_take * v_unit, 4)
                    WHERE id = r_line.id;
                END IF;
            END IF;

            v_left := v_left - v_take;
        END LOOP;

        -- Excedente (se entregó más de lo pedido): a la última línea
        IF v_left > 0 AND v_last_id IS NOT NULL THEN
            IF COALESCE(v_pick.is_return, false) THEN
                UPDATE public.order_line
                SET quantity_returned = quantity_returned + v_left,
                    cost_delivered    = GREATEST(cost_delivered - ROUND(v_left * v_unit, 4), 0)
                WHERE id = v_last_id;
            ELSE
                UPDATE public.order_line
                SET quantity_delivered = quantity_delivered + v_left,
                    cost_delivered     = cost_delivered + ROUND(v_left * v_unit, 4)
                WHERE id = v_last_id;
            END IF;
        END IF;
    END LOOP;

    PERFORM public.recompute_order_delivery(v_pick.order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_picking_to_order(UUID) FROM PUBLIC, anon, authenticated;

/**
 * Versión de 20261103120000 más:
 *   · Devoluciones de venta: reingresan al costo con el que salieron
 *     (cost_delivered / unidades netas entregadas de la orden).
 *   · Al confirmar, retroalimenta la orden (entregado, devuelto, costo real).
 *   · Si tras una entrega queda pendiente, crea el backorder en borrador.
 */
CREATE OR REPLACE FUNCTION public.apply_picking_inventory(p_picking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pick        RECORD;
    v_order       RECORD;
    r_agg         RECORD;
    r_line        RECORD;
    v_product     RECORD;
    v_origin      public.stock_move_origin;
    v_any_partial BOOLEAN := false;
    v_effective   DECIMAL(15, 3);
    v_move_type   public.stock_move_type;
    v_is_purchase_receipt BOOLEAN := false;
    v_is_sale_return      BOOLEAN := false;
    v_fx_rate     DECIMAL(15, 6) := 1;
    v_unit_cost   DECIMAL(15, 4);
    v_backorder   JSONB;
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

    IF v_pick.order_id IS NOT NULL THEN
        SELECT o.order_type, o.currency, o.exchange_rate, c.currency AS company_currency
        INTO v_order
        FROM public."order" o
        JOIN public.company c ON c.id = o.company_id
        WHERE o.id = v_pick.order_id;

        v_is_purchase_receipt := v_order.order_type = 'purchase'
            AND v_pick.type = 'entrada' AND NOT COALESCE(v_pick.is_return, false);
        v_is_sale_return := v_order.order_type = 'sale'
            AND v_pick.type = 'entrada' AND COALESCE(v_pick.is_return, false);
        v_fx_rate := CASE
            WHEN v_order.currency IS DISTINCT FROM v_order.company_currency
                THEN COALESCE(NULLIF(v_order.exchange_rate, 0), 1)
            ELSE 1
        END;
    END IF;

    -- 1) Validación de suficiencia por producto
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
            v_unit_cost := CASE
                WHEN COALESCE(v_unit_cost, 0) > 0 THEN ROUND(v_unit_cost * v_fx_rate, 4)
                ELSE NULL
            END;
        ELSIF v_is_sale_return THEN
            -- Regresa al costo con el que salió, no al promedio del día
            SELECT SUM(ol.cost_delivered) / NULLIF(SUM(ol.quantity_delivered - ol.quantity_returned), 0)
            INTO v_unit_cost
            FROM public.order_line ol
            WHERE ol.order_id = v_pick.order_id
              AND ol.product_id = r_line.product_id;
            v_unit_cost := CASE
                WHEN COALESCE(v_unit_cost, 0) > 0 THEN ROUND(v_unit_cost, 4)
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

    -- 3) Retroalimentar la orden y generar backorder de lo pendiente
    IF v_pick.order_id IS NOT NULL THEN
        PERFORM public.apply_picking_to_order(p_picking_id);

        IF NOT COALESCE(v_pick.is_return, false) THEN
            IF EXISTS (
                SELECT 1 FROM public."order"
                WHERE id = v_pick.order_id
                  AND order_state = 'posted'
                  AND pos_session_id IS NULL
                  AND delivery_status IN ('pending', 'partial')
            ) THEN
                v_backorder := public._prepare_order_delivery(v_pick.order_id);
                IF COALESCE((v_backorder->>'created')::BOOLEAN, false) THEN
                    UPDATE public.picking
                    SET backorder_of_id = p_picking_id,
                        notes = concat_ws(E'\n', NULLIF(notes, ''), 'Backorder de ' || COALESCE(v_pick.name, ''))
                    WHERE id = (v_backorder->>'picking_id')::UUID;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_picking_inventory(UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.apply_picking_inventory(UUID) IS
    'Confirma un picking: asientos en stock_move (compras al precio de la OC, devoluciones al costo de salida), retroalimenta la orden y crea backorder de lo pendiente. Interna: usar set_picking_status.';


-- ════════════════════════════════════════════════════════════════════════════
-- 7. Devoluciones genéricas y canales
-- ════════════════════════════════════════════════════════════════════════════
/**
 * Registra una devolución de venta.
 *
 * p_lines: [{ order_line_id, quantity, restock_quantity? }]
 *   quantity          → unidades acreditadas al cliente
 *   restock_quantity  → de esas, cuántas regresan al almacén (por defecto,
 *                       todas las entregadas y no devueltas si p_restock)
 * p_refund_method_id → si se indica, se reembolsa dinero (hasta lo cobrado)
 * p_pos_session_id   → el reembolso afecta el corte de esa sesión de caja
 */
CREATE OR REPLACE FUNCTION public.register_order_refund(
    p_order_id          UUID,
    p_lines             JSONB,
    p_reason            TEXT,
    p_refund_method_id  UUID DEFAULT NULL,
    p_refund_amount     DECIMAL DEFAULT NULL,
    p_pos_session_id    UUID DEFAULT NULL,
    p_restock           BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order      RECORD;
    v_session    RECORD;
    v_register_warehouse UUID;
    v_line       JSONB;
    v_ol         RECORD;
    v_product    RECORD;
    v_refund_id  UUID;
    v_refund_name TEXT;
    v_qty        DECIMAL(15, 3);
    v_restock    DECIMAL(15, 3);
    v_ratio      DECIMAL(20, 10);
    v_sub        DECIMAL(15, 2);
    v_total      DECIMAL(15, 2);
    v_sum_sub    DECIMAL(15, 2) := 0;
    v_sum_total  DECIMAL(15, 2) := 0;
    v_pay        DECIMAL(15, 2) := 0;
    v_pick_id    UUID;
    v_warehouse  UUID;
    v_seq        INT := 10;
    v_restock_lines INT := 0;
    v_prev       TEXT;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Venta original no encontrada';
    END IF;

    IF v_order.order_type <> 'sale' OR v_order.order_state <> 'posted' THEN
        RAISE EXCEPTION 'Solo se pueden devolver ventas confirmadas';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'El motivo de la devolución es obligatorio';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Indica al menos una línea a devolver';
    END IF;

    IF p_refund_method_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.payment_method
        WHERE id = p_refund_method_id AND company_id = v_order.company_id AND active = true
    ) THEN
        RAISE EXCEPTION 'Método de pago inválido para el reembolso';
    END IF;

    IF p_pos_session_id IS NOT NULL THEN
        SELECT * INTO v_session FROM public.pos_session WHERE id = p_pos_session_id FOR UPDATE;
        IF v_session.id IS NULL OR v_session.company_id <> v_order.company_id THEN
            RAISE EXCEPTION 'Sesión de caja no encontrada';
        END IF;
        IF v_session.status <> 'open' THEN
            RAISE EXCEPTION 'Las devoluciones requieren una sesión de caja abierta';
        END IF;
        IF p_refund_method_id IS NULL THEN
            RAISE EXCEPTION 'Indica el método con el que se reembolsa';
        END IF;
        SELECT warehouse_id INTO v_register_warehouse
        FROM public.pos_register WHERE id = v_session.register_id;
    END IF;

    INSERT INTO public.order_refund (
        company_id, order_id, reason, pos_session_id, created_by, updated_by
    ) VALUES (
        v_order.company_id, v_order.id, btrim(p_reason), p_pos_session_id, auth.uid(), auth.uid()
    )
    RETURNING id, name INTO v_refund_id, v_refund_name;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_ol
        FROM public.order_line
        WHERE id = (v_line->>'order_line_id')::UUID AND order_id = p_order_id
        FOR UPDATE;

        IF v_ol.id IS NULL THEN
            RAISE EXCEPTION 'Línea de venta no encontrada';
        END IF;

        v_qty := COALESCE((v_line->>'quantity')::DECIMAL, 0);
        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad a devolver inválida';
        END IF;

        IF v_qty > v_ol.quantity - v_ol.quantity_refunded + 0.0005 THEN
            RAISE EXCEPTION 'La cantidad a devolver excede lo vendido para %', v_ol.description;
        END IF;

        v_restock := 0;
        IF v_ol.product_id IS NOT NULL THEN
            SELECT id, is_stockable INTO v_product FROM public.product WHERE id = v_ol.product_id;
            IF COALESCE(v_product.is_stockable, true) THEN
                v_restock := COALESCE(
                    NULLIF(v_line->>'restock_quantity', '')::DECIMAL,
                    CASE WHEN p_restock
                         THEN LEAST(v_qty, GREATEST(v_ol.quantity_delivered - v_ol.quantity_returned, 0))
                         ELSE 0 END
                );
                IF v_restock < 0 OR v_restock > v_qty
                   OR v_restock > GREATEST(v_ol.quantity_delivered - v_ol.quantity_returned, 0) + 0.0005 THEN
                    RAISE EXCEPTION 'No se pueden reingresar más unidades de las entregadas para %', v_ol.description;
                END IF;
            END IF;
        END IF;

        v_ratio := v_qty / NULLIF(v_ol.quantity, 0);
        v_sub   := ROUND(v_ol.subtotal * v_ratio, 2);
        v_total := ROUND(v_ol.total * v_ratio, 2);

        INSERT INTO public.order_refund_line (
            company_id, refund_id, order_line_id, product_id, description,
            quantity, restock_quantity, subtotal, tax_amount, total
        ) VALUES (
            v_order.company_id, v_refund_id, v_ol.id, v_ol.product_id, v_ol.description,
            v_qty, v_restock, v_sub, v_total - v_sub, v_total
        );

        UPDATE public.order_line
        SET quantity_refunded = quantity_refunded + v_qty
        WHERE id = v_ol.id;

        v_sum_sub   := v_sum_sub + v_sub;
        v_sum_total := v_sum_total + v_total;

        -- Reintegro al almacén
        IF v_restock > 0 THEN
            IF v_pick_id IS NULL THEN
                v_warehouse := COALESCE(v_register_warehouse, public.resolve_order_warehouse(p_order_id));
                INSERT INTO public.picking (
                    company_id, warehouse_id, order_id, type, status, is_return,
                    notes, created_by, updated_by
                ) VALUES (
                    v_order.company_id, v_warehouse, v_order.id, 'entrada', 'borrador', true,
                    'Devolución ' || v_refund_name || ': ' || btrim(p_reason), auth.uid(), auth.uid()
                )
                RETURNING id INTO v_pick_id;
            END IF;
            v_seq := public.build_picking_lines(v_pick_id, v_ol.product_id, v_restock, v_seq, true);
            v_restock_lines := v_restock_lines + 1;
        END IF;
    END LOOP;

    IF v_sum_total <= 0 THEN
        RAISE EXCEPTION 'El importe a devolver debe ser mayor a cero';
    END IF;

    -- Montos de la devolución y acumulado en la orden
    v_prev := current_setting('flowbit.order_sync', true);
    PERFORM set_config('flowbit.order_sync', 'on', true);
    UPDATE public."order"
    SET amount_refunded = amount_refunded + v_sum_total
    WHERE id = p_order_id;
    PERFORM set_config('flowbit.order_sync', COALESCE(NULLIF(v_prev, ''), 'off'), true);

    -- Inventario: reingreso confirmado al costo con que salió
    IF v_pick_id IS NOT NULL THEN
        PERFORM public.set_picking_status(v_pick_id, 'publicado');
        PERFORM public.set_picking_status(v_pick_id, 'confirmado');
    END IF;

    -- Dinero: nunca más de lo cobrado
    IF p_refund_method_id IS NOT NULL THEN
        SELECT amount_paid INTO v_order.amount_paid FROM public."order" WHERE id = p_order_id;
        v_pay := LEAST(COALESCE(p_refund_amount, v_sum_total), GREATEST(COALESCE(v_order.amount_paid, 0), 0));
        v_pay := ROUND(GREATEST(v_pay, 0), 2);

        IF v_pay > 0 THEN
            PERFORM set_config('flowbit.current_refund_id', v_refund_id::TEXT, true);
            IF p_pos_session_id IS NOT NULL THEN
                INSERT INTO public.pos_payment (
                    company_id, session_id, order_id, payment_method_id,
                    amount, is_refund, notes, created_by, updated_by
                ) VALUES (
                    v_order.company_id, p_pos_session_id, p_order_id, p_refund_method_id,
                    -v_pay, true, btrim(p_reason), auth.uid(), auth.uid()
                );
            ELSE
                INSERT INTO public.order_payment (
                    company_id, order_id, payment_method_id, amount, source,
                    refund_id, notes, created_by, updated_by
                ) VALUES (
                    v_order.company_id, p_order_id, p_refund_method_id, -v_pay, 'dashboard',
                    v_refund_id, btrim(p_reason), auth.uid(), auth.uid()
                );
            END IF;
            PERFORM set_config('flowbit.current_refund_id', '', true);
        END IF;
    END IF;

    UPDATE public.order_refund
    SET amount_untaxed = v_sum_sub,
        amount_tax = v_sum_total - v_sum_sub,
        amount_total = v_sum_total,
        amount_reimbursed = v_pay,
        picking_id = v_pick_id
    WHERE id = v_refund_id;

    PERFORM public.recompute_order_delivery(p_order_id);
    PERFORM public.recompute_order_payment(p_order_id);

    RETURN jsonb_build_object(
        'refund_id', v_refund_id,
        'refund_name', v_refund_name,
        'refund_total', v_sum_total,
        'reimbursed', v_pay,
        'picking_id', v_pick_id,
        'order_id', v_order.id,
        'order_name', v_order.name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_order_refund(UUID, JSONB, TEXT, UUID, DECIMAL, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_order_refund(UUID, JSONB, TEXT, UUID, DECIMAL, UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.register_order_refund(UUID, JSONB, TEXT, UUID, DECIMAL, UUID, BOOLEAN) IS
    'Devolución de venta para cualquier canal: documento, reintegro al costo de salida y reembolso opcional (hasta lo cobrado).';

/**
 * Valida existencias para vender. En esta fase: saldo global del producto.
 * La fase 3 la redefine para validar lo disponible (existencia − reservas)
 * en el almacén de salida.
 */
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
    v_product RECORD;
BEGIN
    SELECT id, name, is_stockable, stock_quantity INTO v_product
    FROM public.product WHERE id = p_product_id;

    IF COALESCE(v_product.is_stockable, true)
       AND COALESCE(v_product.stock_quantity, 0) < COALESCE(p_quantity, 0) THEN
        RAISE EXCEPTION 'Stock insuficiente para %', v_product.name;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_stock_available(UUID, UUID, DECIMAL) FROM PUBLIC, anon, authenticated;

/** El POS usa la devolución genérica; firma y respuesta se conservan. */
CREATE OR REPLACE FUNCTION public.register_pos_refund(
    p_session_id UUID,
    p_order_id UUID,
    p_lines JSONB,
    p_payment_method_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_result  JSONB;
BEGIN
    SELECT * INTO v_session FROM public.pos_session WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión de caja no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(v_session.company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    v_result := public.register_order_refund(
        p_order_id, p_lines, p_reason, p_payment_method_id, NULL, p_session_id, true
    );

    RETURN jsonb_build_object(
        'refund_total', (v_result->>'refund_total')::DECIMAL,
        'picking_id', v_result->>'picking_id',
        'order_id', v_result->>'order_id',
        'order_name', v_result->>'order_name',
        'refund_name', v_result->>'refund_name'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_pos_refund(UUID, UUID, JSONB, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_pos_refund(UUID, UUID, JSONB, UUID, TEXT) TO authenticated;

/**
 * Venta POS (versión de 20261103120000) adaptada al libro:
 *   · los pagos se registran en pos_payment y se reflejan en order_payment;
 *     el estado de pago y de entrega se derivan, ya no se fijan a mano;
 *   · las líneas del picking se arman con build_picking_lines.
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
    v_qty DECIMAL(15, 3);
    v_price DECIMAL(15, 2);
    v_discount DECIMAL(5, 2);
    v_max_discount DECIMAL(5, 2);
BEGIN
    SELECT * INTO v_session FROM public.pos_session WHERE id = p_session_id FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión de caja no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(v_session.company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    IF v_session.status <> 'open' THEN
        RAISE EXCEPTION 'No se puede vender sin una sesión de caja abierta';
    END IF;

    SELECT * INTO v_register FROM public.pos_register WHERE id = v_session.register_id;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'No se puede cobrar un ticket vacío';
    END IF;

    IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'La venta debe incluir al menos un pago';
    END IF;

    v_max_discount := CASE
        WHEN public.is_company_admin(v_session.company_id) THEN 100
        ELSE COALESCE(v_register.max_discount_percent, 100)
    END;

    v_warehouse_id := COALESCE(
        v_register.warehouse_id,
        public.get_or_create_default_warehouse(v_session.company_id)
    );

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

    FOR r_stock IN
        SELECT x.product_id, SUM(x.quantity) AS qty
        FROM jsonb_to_recordset(p_lines) AS x(product_id UUID, quantity DECIMAL)
        GROUP BY x.product_id
    LOOP
        PERFORM public.assert_stock_available(r_stock.product_id, v_warehouse_id, r_stock.qty);
    END LOOP;

    SELECT id INTO v_created_by_partner_id FROM public.partner WHERE user_id = auth.uid();

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

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_product FROM public.product WHERE id = (v_line->>'product_id')::UUID;

        INSERT INTO public.order_line (
            order_id, product_id, sequence, description,
            quantity, unit_price, unit_cost, discount_percent,
            tax_rate, price_include_tax, uom_id
        ) VALUES (
            v_order_id, v_product.id, v_sequence,
            COALESCE(NULLIF(btrim(v_product.display_name), ''), v_product.name, 'Artículo'),
            (v_line->>'quantity')::DECIMAL,
            COALESCE(v_product.sale_price, 0),
            COALESCE(NULLIF(v_product.avg_cost, 0), v_product.cost_price, 0),
            COALESCE((v_line->>'discount_percent')::DECIMAL, 0),
            COALESCE(v_product.tax_rate, 0),
            COALESCE(v_product.tax_included, false),
            v_product.uom_id
        );
        v_sequence := v_sequence + 10;
    END LOOP;

    SELECT * INTO v_order FROM public."order" WHERE id = v_order_id;

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

        v_payments_total := v_payments_total + (v_payment->>'amount')::DECIMAL;
        v_first_method := COALESCE(v_first_method, (v_payment->>'payment_method_id')::UUID);
    END LOOP;

    IF ABS(v_payments_total - v_order.amount_total) > 0.01 THEN
        RAISE EXCEPTION 'Los pagos (%) no cubren el total de la venta (%)',
            v_payments_total, v_order.amount_total;
    END IF;

    UPDATE public."order"
    SET order_state = 'posted',
        confirmation_date = now(),
        payment_method_id = v_first_method,
        delivery_date = CURRENT_DATE,
        updated_by = auth.uid()
    WHERE id = v_order_id;

    -- Picking de salida confirmado (el cliente se lleva la mercancía)
    IF EXISTS (
        SELECT 1 FROM public.order_line ol
        JOIN public.product p ON p.id = ol.product_id
        WHERE ol.order_id = v_order_id AND COALESCE(p.is_stockable, true)
    ) THEN
        INSERT INTO public.picking (
            company_id, warehouse_id, order_id, type, status, is_return,
            notes, created_by, updated_by
        ) VALUES (
            v_session.company_id, v_warehouse_id, v_order_id, 'salida', 'borrador', false,
            'Venta POS', auth.uid(), auth.uid()
        )
        RETURNING id INTO v_pick_id;

        v_sequence := 10;
        FOR r_stock_line IN
            SELECT ol.product_id, SUM(ol.quantity) AS qty_sum
            FROM public.order_line ol
            JOIN public.product p ON p.id = ol.product_id
            WHERE ol.order_id = v_order_id AND COALESCE(p.is_stockable, true)
            GROUP BY ol.product_id
            ORDER BY MIN(ol.sequence)
        LOOP
            v_sequence := public.build_picking_lines(v_pick_id, r_stock_line.product_id, r_stock_line.qty_sum, v_sequence, false);
        END LOOP;

        PERFORM public.set_picking_status(v_pick_id, 'publicado');
        PERFORM public.set_picking_status(v_pick_id, 'confirmado');
    END IF;

    -- Pagos (cada uno se refleja en order_payment por trigger)
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

    PERFORM public.recompute_order_delivery(v_order_id);
    PERFORM public.recompute_order_payment(v_order_id);

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

/**
 * Stripe: el cobro se registra en el libro (idempotente por payment intent o
 * por sesión) y el estado de pago se deriva.
 */
CREATE OR REPLACE FUNCTION public.mark_storefront_order_paid(
    p_order_id UUID,
    p_session_id TEXT,
    p_payment_intent TEXT,
    p_amount DECIMAL,
    p_currency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order   public."order"%ROWTYPE;
    v_intent  TEXT := NULLIF(btrim(COALESCE(p_payment_intent, '')), '');
    v_session TEXT := NULLIF(btrim(COALESCE(p_session_id, '')), '');
    v_balance DECIMAL(15, 2);
    v_amount  DECIMAL(15, 2);
BEGIN
    SELECT * INTO v_order
    FROM public."order" o
    WHERE o.id = p_order_id AND o.origin = 'storefront'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_order.payment_status = 'paid' THEN
        RETURN jsonb_build_object('status', 'ok', 'payment_status', 'paid', 'already_paid', true);
    END IF;

    IF upper(btrim(COALESCE(p_currency, ''))) <> upper(COALESCE(v_order.currency, '')) THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'currency_mismatch',
            'message', 'La moneda del pago no coincide con la de la orden.');
    END IF;

    -- Webhook y verificación de retorno pueden llegar ambos: un solo asiento
    IF EXISTS (
        SELECT 1 FROM public.order_payment
        WHERE order_id = p_order_id AND source = 'stripe' AND active
          AND ((v_intent IS NOT NULL AND stripe_payment_intent_id = v_intent)
               OR (v_intent IS NULL AND v_session IS NOT NULL AND reference = v_session))
    ) THEN
        RETURN jsonb_build_object('status', 'ok', 'payment_status', v_order.payment_status, 'already_paid', true);
    END IF;

    v_balance := COALESCE(v_order.amount_total, 0) - COALESCE(v_order.amount_refunded, 0)
               - COALESCE(v_order.amount_paid, 0);

    -- Tolerancia de 50 centavos por el redondeo a unidades mínimas de Stripe
    v_amount := CASE
        WHEN ABS(COALESCE(p_amount, 0) - v_balance) <= 0.5 THEN v_balance
        ELSE ROUND(COALESCE(p_amount, 0), 2)
    END;

    UPDATE public."order"
    SET payment_provider = 'stripe',
        stripe_session_id = COALESCE(v_session, stripe_session_id),
        stripe_payment_intent_id = COALESCE(v_intent, stripe_payment_intent_id)
    WHERE id = p_order_id;

    IF v_amount > 0 THEN
        INSERT INTO public.order_payment (
            company_id, order_id, amount, paid_at, source,
            stripe_payment_intent_id, reference, notes
        ) VALUES (
            v_order.company_id, v_order.id, v_amount, now(), 'stripe',
            v_intent, v_session, 'Stripe Checkout'
        );
    END IF;

    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id;

    RETURN jsonb_build_object('status', 'ok', 'payment_status', v_order.payment_status, 'already_paid', false);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_storefront_order_paid(UUID, TEXT, TEXT, DECIMAL, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_storefront_order_paid(UUID, TEXT, TEXT, DECIMAL, TEXT) TO service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 9. Implantación sobre los datos existentes
-- ════════════════════════════════════════════════════════════════════════════
-- Las fechas de última modificación de documentos históricos no se alteran.
ALTER TABLE public."order" DISABLE TRIGGER trigger_order_updated_at;
SELECT set_config('flowbit.order_sync', 'on', true);

-- 9.1 Entregado / devuelto / costo real desde el libro de inventario
ALTER TABLE public.order_line DISABLE TRIGGER USER;

WITH mv AS (
    SELECT
        sm.order_id,
        sm.product_id,
        SUM(sm.quantity)   FILTER (WHERE NOT COALESCE(pk.is_return, false)) AS qty_out,
        SUM(sm.total_cost) FILTER (WHERE NOT COALESCE(pk.is_return, false)) AS cost_out,
        SUM(sm.quantity)   FILTER (WHERE COALESCE(pk.is_return, false))     AS qty_ret,
        SUM(sm.total_cost) FILTER (WHERE COALESCE(pk.is_return, false))     AS cost_ret
    FROM public.stock_move sm
    JOIN public.picking pk ON pk.id = sm.picking_id
    WHERE sm.order_id IS NOT NULL
    GROUP BY sm.order_id, sm.product_id
),
lines AS (
    SELECT
        ol.id, ol.order_id, ol.product_id, ol.quantity,
        COALESCE(SUM(ol.quantity) OVER (
            PARTITION BY ol.order_id, ol.product_id
            ORDER BY ol.sequence, ol.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0) AS cum_before,
        ROW_NUMBER() OVER (
            PARTITION BY ol.order_id, ol.product_id
            ORDER BY ol.sequence DESC, ol.id DESC
        ) = 1 AS is_last
    FROM public.order_line ol
    WHERE ol.product_id IS NOT NULL
),
alloc AS (
    SELECT
        l.id,
        CASE WHEN l.is_last THEN GREATEST(COALESCE(m.qty_out, 0) - l.cum_before, 0)
             ELSE LEAST(l.quantity, GREATEST(COALESCE(m.qty_out, 0) - l.cum_before, 0)) END AS dq,
        CASE WHEN l.is_last THEN GREATEST(COALESCE(m.qty_ret, 0) - l.cum_before, 0)
             ELSE LEAST(l.quantity, GREATEST(COALESCE(m.qty_ret, 0) - l.cum_before, 0)) END AS rq,
        m.qty_out, m.cost_out, m.qty_ret, m.cost_ret
    FROM lines l
    JOIN mv m ON m.order_id = l.order_id AND m.product_id = l.product_id
)
UPDATE public.order_line ol
SET quantity_delivered = a.dq,
    quantity_returned  = LEAST(a.rq, a.dq),
    cost_delivered     = GREATEST(ROUND(
        COALESCE(a.cost_out * a.dq / NULLIF(a.qty_out, 0), 0)
        - COALESCE(a.cost_ret * LEAST(a.rq, a.dq) / NULLIF(a.qty_ret, 0), 0), 4), 0)
FROM alloc a
WHERE a.id = ol.id;

-- POS: lo devuelto se acreditó al cliente (la devolución POS siempre reintegraba)
UPDATE public.order_line ol
SET quantity_refunded = ol.quantity_returned
FROM public."order" o
WHERE o.id = ol.order_id
  AND o.pos_session_id IS NOT NULL
  AND ol.quantity_returned > 0;

ALTER TABLE public.order_line ENABLE TRIGGER USER;

-- 9.2 Documentos de devolución de los reembolsos POS existentes
INSERT INTO public.order_refund (
    id, company_id, order_id, reason, amount_untaxed, amount_tax, amount_total,
    amount_reimbursed, pos_session_id, is_backfill, created_at, created_by, updated_by
)
SELECT
    md5('order_refund:' || pp.id::TEXT)::UUID,
    pp.company_id, pp.order_id,
    COALESCE(NULLIF(btrim(pp.notes), ''), 'Devolución POS'),
    ROUND(-pp.amount * COALESCE(o.amount_untaxed / NULLIF(o.amount_total, 0), 1), 2),
    -pp.amount - ROUND(-pp.amount * COALESCE(o.amount_untaxed / NULLIF(o.amount_total, 0), 1), 2),
    -pp.amount, -pp.amount,
    pp.session_id, true, pp.created_at, pp.created_by, pp.created_by
FROM public.pos_payment pp
JOIN public."order" o ON o.id = pp.order_id
WHERE pp.is_refund AND COALESCE(pp.active, true)
ORDER BY pp.created_at
ON CONFLICT (id) DO NOTHING;

UPDATE public."order" o
SET amount_refunded = r.total
FROM (
    SELECT order_id, SUM(amount_total) AS total
    FROM public.order_refund WHERE active
    GROUP BY order_id
) r
WHERE r.order_id = o.id;

-- 9.3 Libro de pagos: todo lo cobrado en el POS
ALTER TABLE public.order_payment DISABLE TRIGGER trigger_order_payment_sync;

INSERT INTO public.order_payment (
    company_id, order_id, payment_method_id, amount, paid_at, source,
    pos_session_id, pos_payment_id, refund_id, notes, created_at, created_by, updated_by
)
SELECT
    pp.company_id, pp.order_id, pp.payment_method_id, pp.amount,
    COALESCE(pp.created_at, now()), 'pos',
    pp.session_id, pp.id,
    CASE WHEN pp.is_refund THEN md5('order_refund:' || pp.id::TEXT)::UUID END,
    pp.notes, pp.created_at, pp.created_by, pp.created_by
FROM public.pos_payment pp
WHERE COALESCE(pp.active, true)
ON CONFLICT (pos_payment_id) DO NOTHING;

-- 9.4 Órdenes marcadas como pagadas sin registro: un pago de implantación
INSERT INTO public.order_payment (
    company_id, order_id, payment_method_id, amount, paid_at, source, notes
)
SELECT
    o.company_id, o.id, o.payment_method_id,
    o.amount_total - o.amount_refunded,
    COALESCE(o.paid_at, o.confirmation_date, o.updated_at, now()),
    'backfill',
    'Pago registrado antes del libro de pagos (monto total de la orden)'
FROM public."order" o
WHERE o.payment_status = 'paid'
  AND o.order_state = 'posted'
  AND o.amount_total - o.amount_refunded > 0
  AND NOT EXISTS (SELECT 1 FROM public.order_payment op WHERE op.order_id = o.id);

ALTER TABLE public.order_payment ENABLE TRIGGER trigger_order_payment_sync;

-- 9.5 Recalcular estados derivados
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public."order" WHERE order_state = 'posted' LOOP
        PERFORM public.recompute_order_delivery(r.id);
    END LOOP;

    -- El estado de pago solo se recalcula donde hay libro; el resto conserva
    -- su estado (unpaid, condoned o un «partial» sin monto conocido).
    FOR r IN SELECT DISTINCT order_id AS id FROM public.order_payment LOOP
        PERFORM public.recompute_order_payment(r.id);
    END LOOP;
END;
$$;

-- Borradores: sin entregas ni pagos
UPDATE public."order"
SET delivery_status = 'pending', is_delivered = false
WHERE order_state = 'draft' AND (delivery_status <> 'pending' OR is_delivered);

SELECT set_config('flowbit.order_sync', 'off', true);
ALTER TABLE public."order" ENABLE TRIGGER trigger_order_updated_at;


-- ════════════════════════════════════════════════════════════════════════════
-- 10. Vistas
-- ════════════════════════════════════════════════════════════════════════════
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
    pm.name AS payment_method_name
FROM public."order" o
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.partner cbp ON cbp.id = o.created_by_partner_id
LEFT JOIN public.company c ON c.id = o.company_id
LEFT JOIN public.project pr ON pr.id = o.project_id
LEFT JOIN public.payment_method pm ON pm.id = o.payment_method_id;

COMMENT ON VIEW public.v_orders IS
    'Órdenes con socio, empresa, proyecto, origen, estado de entrega y pago derivados, y saldo pendiente.';

DROP VIEW IF EXISTS public.v_order_lines;
CREATE VIEW public.v_order_lines
WITH (security_invoker = true)
AS
SELECT
    ol.*,
    o.name AS order_name,
    o.order_type,
    o.order_state,
    o.partner_id,
    o.company_id,
    o.currency,
    p.name AS product_name,
    p.sku AS product_sku,
    p.barcode AS product_barcode,
    uom.name AS uom_name,
    uom.code AS uom_code,
    public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered,
                                       ol.quantity_returned, ol.quantity_refunded) AS quantity_pending,
    ROUND(ol.subtotal * (1 - ol.quantity_refunded / NULLIF(ol.quantity, 0)) - ol.cost_delivered, 2)
        AS margin_real
FROM public.order_line ol
JOIN public."order" o ON o.id = ol.order_id
LEFT JOIN public.product p ON p.id = ol.product_id
LEFT JOIN public.product_uom uom ON uom.id = ol.uom_id;

COMMENT ON VIEW public.v_order_lines IS
    'Líneas con producto, pendiente por entregar y margen real (subtotal neto de devoluciones − costo real de lo entregado).';

CREATE OR REPLACE VIEW public.v_order_payments
WITH (security_invoker = true)
AS
SELECT
    op.*,
    o.name AS order_name,
    o.order_type,
    o.origin AS order_origin,
    o.partner_id,
    o.currency,
    p.name AS partner_name,
    pm.name AS payment_method_name,
    rf.name AS refund_name,
    ps.name AS pos_session_name
FROM public.order_payment op
JOIN public."order" o ON o.id = op.order_id
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.payment_method pm ON pm.id = op.payment_method_id
LEFT JOIN public.order_refund rf ON rf.id = op.refund_id
LEFT JOIN public.pos_session ps ON ps.id = op.pos_session_id;

CREATE OR REPLACE VIEW public.v_order_refunds
WITH (security_invoker = true)
AS
SELECT
    r.*,
    o.name AS order_name,
    o.origin AS order_origin,
    o.partner_id,
    o.currency,
    p.name AS partner_name,
    pk.name AS picking_name
FROM public.order_refund r
JOIN public."order" o ON o.id = r.order_id
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.picking pk ON pk.id = r.picking_id;

REVOKE ALL ON public.v_orders, public.v_order_lines, public.v_order_payments, public.v_order_refunds FROM anon;
GRANT SELECT ON public.v_orders, public.v_order_lines, public.v_order_payments, public.v_order_refunds TO authenticated;
