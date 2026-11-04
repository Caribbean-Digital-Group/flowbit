-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Fase 4 — Reportes, CRM conectado a la venta y atribución                  ║
-- ║  (docs/sales-flow-analysis.md §4.6–4.8, hallazgos D1–D3, C1–C4, W1, W2)    ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  1. Libro de ingresos   — v_revenue_ledger (cobros, reembolsos, costo)    ║
-- ║  2. KPIs                — get_sales_kpis (base de caja, en servidor)      ║
-- ║  3. Atribución          — campaña de la sesión de tienda y del lead       ║
-- ║  4. CRM                 — cotización desde el lead, lead ganado/cobrado   ║
-- ║  5. Sitio web           — conversión automática de mensajes en leads      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Base de caja (decisión 2026-11-03): el ingreso es lo COBRADO (order_payment),
-- en la fecha del cobro. El IVA se separa en proporción al de la orden.
-- Todos los importes se expresan en la moneda de la empresa (exchange_rate).


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Libro de ingresos
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.v_revenue_ledger
WITH (security_invoker = true)
AS
-- Cobros y reembolsos (ventas) / pagos y devoluciones (compras)
SELECT
    op.company_id,
    op.paid_at                                   AS occurred_at,
    CASE
        WHEN o.order_type = 'sale'     AND op.amount > 0 THEN 'collection'
        WHEN o.order_type = 'sale'                       THEN 'reimbursement'
        WHEN o.order_type = 'purchase' AND op.amount > 0 THEN 'supplier_payment'
        ELSE 'supplier_refund'
    END                                          AS kind,
    o.order_type,
    o.origin                                     AS channel,
    op.order_id,
    o.name                                       AS order_name,
    o.partner_id,
    op.payment_method_id,
    op.source,
    op.id                                        AS document_id,
    ROUND(op.amount * fx.rate, 2)                AS amount,
    ROUND(op.amount * fx.rate * COALESCE(o.amount_untaxed / NULLIF(o.amount_total, 0), 1), 2)
                                                 AS amount_net,
    NULL::UUID                                   AS product_id,
    NULL::DECIMAL                                AS quantity
FROM public.order_payment op
JOIN public."order" o  ON o.id = op.order_id
JOIN public.company c  ON c.id = o.company_id
CROSS JOIN LATERAL (
    SELECT CASE WHEN o.currency IS DISTINCT FROM c.currency
                THEN COALESCE(NULLIF(o.exchange_rate, 0), 1) ELSE 1 END AS rate
) fx
WHERE op.active

UNION ALL

-- Costo de lo vendido (salidas) y su reverso (devoluciones de venta)
SELECT
    sm.company_id,
    sm.occurred_at,
    CASE WHEN sm.move_type = 'out' THEN 'cogs' ELSE 'cogs_return' END,
    o.order_type,
    o.origin,
    sm.order_id,
    o.name,
    o.partner_id,
    NULL::UUID,
    'inventory',
    sm.id,
    CASE WHEN sm.move_type = 'out' THEN -sm.total_cost ELSE sm.total_cost END,
    CASE WHEN sm.move_type = 'out' THEN -sm.total_cost ELSE sm.total_cost END,
    sm.product_id,
    sm.signed_quantity
FROM public.stock_move sm
JOIN public."order" o ON o.id = sm.order_id
WHERE o.order_type = 'sale'
  AND sm.origin IN ('sale', 'pos', 'storefront', 'return_in');

COMMENT ON VIEW public.v_revenue_ledger IS
    'Ingreso reconocido al cobrar (cobros/reembolsos con IVA y neto) y costo de lo vendido, por fecha y canal, en moneda de la empresa.';

REVOKE ALL ON public.v_revenue_ledger FROM anon;
GRANT SELECT ON public.v_revenue_ledger TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Atribución (antes que los KPIs, que la usan)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.crm_lead
    ADD COLUMN IF NOT EXISTS utm_source   VARCHAR(120),
    ADD COLUMN IF NOT EXISTS utm_medium   VARCHAR(120),
    ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(120),
    ADD COLUMN IF NOT EXISTS won_amount       DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS collected_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.crm_lead.won_amount IS
    'Vendido: total neto de devoluciones de las órdenes confirmadas vinculadas.';
COMMENT ON COLUMN public.crm_lead.collected_amount IS
    'Cobrado: neto pagado de las órdenes vinculadas (ingreso reconocido).';

/**
 * Campaña de cada orden:
 *   · tienda: la sesión de analítica a la que se atribuyó la compra
 *   · cualquier canal: la campaña del lead vinculado
 */
CREATE OR REPLACE VIEW public.v_order_attribution
WITH (security_invoker = true)
AS
SELECT
    o.id AS order_id,
    o.company_id,
    o.origin,
    s.session_id AS analytics_session_id,
    COALESCE(s.utm_source,   l.utm_source)   AS utm_source,
    COALESCE(s.utm_medium,   l.utm_medium)   AS utm_medium,
    COALESCE(s.utm_campaign, l.utm_campaign) AS utm_campaign,
    s.referrer,
    s.entry_path,
    lo.lead_id
FROM public."order" o
LEFT JOIN LATERAL (
    SELECT ss.session_id, ss.utm_source, ss.utm_medium, ss.utm_campaign, ss.referrer, ss.entry_path
    FROM public.storefront_event e
    JOIN public.storefront_session ss
      ON ss.company_id = e.company_id AND ss.session_id = e.session_id
    WHERE e.order_id = o.id AND e.event_name = 'purchase' AND e.session_id IS NOT NULL
    ORDER BY e.server_ts
    LIMIT 1
) s ON true
LEFT JOIN public.crm_lead_order lo ON lo.order_id = o.id
LEFT JOIN public.crm_lead l ON l.id = lo.lead_id;

REVOKE ALL ON public.v_order_attribution FROM anon;
GRANT SELECT ON public.v_order_attribution TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. KPIs de ventas
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_sales_kpis(
    p_company_id UUID,
    p_from       DATE,
    p_to         DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from     TIMESTAMPTZ;
    v_to       TIMESTAMPTZ;
    v_currency TEXT;
    v_totals   JSONB;
    v_channels JSONB;
    v_monthly  JSONB;
    v_methods  JSONB;
    v_products JSONB;
    v_campaigns JSONB;
    v_receivables JSONB;
    v_payables JSONB;
    v_deliveries JSONB;
    v_refunds  JSONB;
    v_orders   JSONB;
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        RAISE EXCEPTION 'Rango de fechas inválido';
    END IF;

    v_from := p_from::TIMESTAMPTZ;
    v_to   := (p_to + 1)::TIMESTAMPTZ;
    SELECT COALESCE(currency, 'MXN') INTO v_currency FROM public.company WHERE id = p_company_id;

    -- Libro del periodo
    CREATE TEMP TABLE IF NOT EXISTS _kpi_ledger ON COMMIT DROP AS
        SELECT * FROM public.v_revenue_ledger WHERE false;
    TRUNCATE _kpi_ledger;
    INSERT INTO _kpi_ledger
        SELECT * FROM public.v_revenue_ledger
        WHERE company_id = p_company_id AND occurred_at >= v_from AND occurred_at < v_to;

    -- Totales
    SELECT jsonb_build_object(
        'collected',        COALESCE(SUM(amount)     FILTER (WHERE kind = 'collection'), 0),
        'reimbursed',       COALESCE(-SUM(amount)    FILTER (WHERE kind = 'reimbursement'), 0),
        'net_collected',    COALESCE(SUM(amount)     FILTER (WHERE kind IN ('collection', 'reimbursement')), 0),
        'net_revenue',      COALESCE(SUM(amount_net) FILTER (WHERE kind IN ('collection', 'reimbursement')), 0),
        'tax_collected',    COALESCE(SUM(amount - amount_net) FILTER (WHERE kind IN ('collection', 'reimbursement')), 0),
        'cogs',             COALESCE(-SUM(amount)    FILTER (WHERE kind IN ('cogs', 'cogs_return')), 0),
        'purchases_paid',   COALESCE(SUM(amount)     FILTER (WHERE kind IN ('supplier_payment', 'supplier_refund')), 0),
        'paying_orders',    COUNT(DISTINCT order_id) FILTER (WHERE kind = 'collection'),
        'units_sold',       COALESCE(-SUM(quantity)  FILTER (WHERE kind IN ('cogs', 'cogs_return')), 0)
    ) INTO v_totals
    FROM _kpi_ledger;

    v_totals := v_totals || jsonb_build_object(
        'gross_margin', (v_totals->>'net_revenue')::DECIMAL - (v_totals->>'cogs')::DECIMAL,
        'margin_percent', CASE WHEN (v_totals->>'net_revenue')::DECIMAL > 0
            THEN ROUND(((v_totals->>'net_revenue')::DECIMAL - (v_totals->>'cogs')::DECIMAL)
                       / (v_totals->>'net_revenue')::DECIMAL * 100, 2)
            ELSE 0 END,
        'net_cash_flow', (v_totals->>'net_collected')::DECIMAL - (v_totals->>'purchases_paid')::DECIMAL,
        'average_ticket', CASE WHEN (v_totals->>'paying_orders')::INT > 0
            THEN ROUND((v_totals->>'collected')::DECIMAL / (v_totals->>'paying_orders')::INT, 2)
            ELSE 0 END,
        'currency', v_currency
    );

    -- Por canal
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'net_revenue')::DECIMAL DESC), '[]'::jsonb) INTO v_channels
    FROM (
        SELECT jsonb_build_object(
            'channel', channel,
            'net_collected', COALESCE(SUM(amount) FILTER (WHERE kind IN ('collection', 'reimbursement')), 0),
            'net_revenue', COALESCE(SUM(amount_net) FILTER (WHERE kind IN ('collection', 'reimbursement')), 0),
            'cogs', COALESCE(-SUM(amount) FILTER (WHERE kind IN ('cogs', 'cogs_return')), 0),
            'orders', COUNT(DISTINCT order_id) FILTER (WHERE kind = 'collection')
        ) AS x
        FROM _kpi_ledger
        WHERE order_type = 'sale'
        GROUP BY channel
    ) s;

    -- Serie mensual (ingresos cobrados vs. pagos a proveedores)
    SELECT COALESCE(jsonb_agg(x ORDER BY x->>'month'), '[]'::jsonb) INTO v_monthly
    FROM (
        SELECT jsonb_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'income', COALESCE(SUM(l.amount) FILTER (WHERE l.kind IN ('collection', 'reimbursement')), 0),
            'income_net', COALESCE(SUM(l.amount_net) FILTER (WHERE l.kind IN ('collection', 'reimbursement')), 0),
            'expense', COALESCE(SUM(l.amount) FILTER (WHERE l.kind IN ('supplier_payment', 'supplier_refund')), 0),
            'cogs', COALESCE(-SUM(l.amount) FILTER (WHERE l.kind IN ('cogs', 'cogs_return')), 0),
            'income_count', COUNT(DISTINCT l.order_id) FILTER (WHERE l.kind = 'collection'),
            'expense_count', COUNT(DISTINCT l.order_id) FILTER (WHERE l.kind = 'supplier_payment')
        ) AS x
        FROM generate_series(date_trunc('month', p_from::TIMESTAMP), date_trunc('month', p_to::TIMESTAMP), INTERVAL '1 month') AS m(month)
        LEFT JOIN _kpi_ledger l ON date_trunc('month', l.occurred_at AT TIME ZONE 'UTC') = m.month
        GROUP BY m.month
    ) s;

    -- Por método de pago
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'amount')::DECIMAL DESC), '[]'::jsonb) INTO v_methods
    FROM (
        SELECT jsonb_build_object(
            'payment_method_id', l.payment_method_id,
            'name', COALESCE(pm.name, CASE WHEN l.source = 'stripe' THEN 'Tarjeta (Stripe)' ELSE 'Sin método' END),
            'amount', SUM(l.amount),
            'count', COUNT(*)
        ) AS x
        FROM _kpi_ledger l
        LEFT JOIN public.payment_method pm ON pm.id = l.payment_method_id
        WHERE l.kind IN ('collection', 'reimbursement')
        GROUP BY l.payment_method_id, pm.name, l.source = 'stripe'
    ) s;

    -- Productos más vendidos (unidades entregadas en el periodo)
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'revenue')::DECIMAL DESC), '[]'::jsonb) INTO v_products
    FROM (
        SELECT jsonb_build_object(
            'product_id', l.product_id,
            'name', MAX(COALESCE(NULLIF(btrim(p.display_name), ''), p.name)),
            'units', -SUM(l.quantity),
            'cogs', -SUM(l.amount),
            'revenue', ROUND(SUM(-l.quantity * COALESCE(pr.unit_net, 0)), 2)
        ) AS x
        FROM _kpi_ledger l
        JOIN public.product p ON p.id = l.product_id
        LEFT JOIN LATERAL (
            SELECT SUM(ol.subtotal) / NULLIF(SUM(ol.quantity), 0) AS unit_net
            FROM public.order_line ol
            WHERE ol.order_id = l.order_id AND ol.product_id = l.product_id
        ) pr ON true
        WHERE l.kind IN ('cogs', 'cogs_return')
        GROUP BY l.product_id
        ORDER BY ROUND(SUM(-l.quantity * COALESCE(pr.unit_net, 0)), 2) DESC
        LIMIT 10
    ) s;

    -- Campañas (cobrado neto por fuente / campaña)
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'net_collected')::DECIMAL DESC), '[]'::jsonb) INTO v_campaigns
    FROM (
        SELECT jsonb_build_object(
            'utm_source', COALESCE(a.utm_source, '(directo)'),
            'utm_campaign', COALESCE(a.utm_campaign, '—'),
            'net_collected', SUM(l.amount),
            'orders', COUNT(DISTINCT l.order_id)
        ) AS x
        FROM _kpi_ledger l
        JOIN public.v_order_attribution a ON a.order_id = l.order_id
        WHERE l.kind IN ('collection', 'reimbursement')
          AND (a.utm_source IS NOT NULL OR a.utm_campaign IS NOT NULL OR a.origin = 'storefront')
        GROUP BY COALESCE(a.utm_source, '(directo)'), COALESCE(a.utm_campaign, '—')
        LIMIT 20
    ) s;

    -- Cuentas por cobrar (a la fecha, con antigüedad)
    SELECT jsonb_build_object(
        'total', COALESCE(SUM(b.balance), 0),
        'count', COUNT(*),
        'current', COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue <= 0), 0),
        'd1_30',   COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue BETWEEN 1 AND 30), 0),
        'd31_60',  COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue BETWEEN 31 AND 60), 0),
        'd61_90',  COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue BETWEEN 61 AND 90), 0),
        'd90_plus', COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue > 90), 0)
    ) INTO v_receivables
    FROM (
        SELECT
            (o.amount_total - o.amount_refunded - o.amount_paid)
                * CASE WHEN o.currency IS DISTINCT FROM c.currency
                       THEN COALESCE(NULLIF(o.exchange_rate, 0), 1) ELSE 1 END AS balance,
            CURRENT_DATE - COALESCE(o.payment_due_date, o.confirmation_date::DATE, o.order_date) AS days_overdue
        FROM public."order" o
        JOIN public.company c ON c.id = o.company_id
        WHERE o.company_id = p_company_id
          AND o.order_type = 'sale'
          AND o.order_state = 'posted'
          AND o.payment_status NOT IN ('paid', 'condoned')
          AND o.amount_total - o.amount_refunded - o.amount_paid > 0.005
    ) b;

    -- Cuentas por pagar (proveedores)
    SELECT jsonb_build_object(
        'total', COALESCE(SUM(o.amount_total - o.amount_refunded - o.amount_paid), 0),
        'count', COUNT(*)
    ) INTO v_payables
    FROM public."order" o
    WHERE o.company_id = p_company_id
      AND o.order_type = 'purchase'
      AND o.order_state = 'posted'
      AND o.payment_status NOT IN ('paid', 'condoned')
      AND o.amount_total - o.amount_refunded - o.amount_paid > 0.005;

    -- Entregas pendientes (a la fecha)
    SELECT jsonb_build_object(
        'orders', COUNT(DISTINCT o.id),
        'units', COALESCE(SUM(public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered,
                                                                 ol.quantity_returned, ol.quantity_refunded)), 0),
        'value', COALESCE(ROUND(SUM(
            public.order_line_pending_quantity(ol.quantity, ol.quantity_delivered, ol.quantity_returned, ol.quantity_refunded)
            * ol.subtotal / NULLIF(ol.quantity, 0)), 2), 0)
    ) INTO v_deliveries
    FROM public."order" o
    JOIN public.order_line ol ON ol.order_id = o.id
    JOIN public.product p ON p.id = ol.product_id AND COALESCE(p.is_stockable, true)
    WHERE o.company_id = p_company_id
      AND o.order_type = 'sale'
      AND o.order_state = 'posted'
      AND o.delivery_status IN ('pending', 'partial');

    -- Devoluciones del periodo
    SELECT jsonb_build_object(
        'count', COUNT(*),
        'total', COALESCE(SUM(amount_total), 0),
        'reimbursed', COALESCE(SUM(amount_reimbursed), 0)
    ) INTO v_refunds
    FROM public.order_refund
    WHERE company_id = p_company_id AND active
      AND created_at >= v_from AND created_at < v_to;

    -- Órdenes confirmadas en el periodo (referencia: lo vendido, cobrado o no)
    SELECT jsonb_build_object(
        'count', COUNT(*),
        'total', COALESCE(SUM(amount_total), 0),
        'untaxed', COALESCE(SUM(amount_untaxed), 0)
    ) INTO v_orders
    FROM public."order"
    WHERE company_id = p_company_id
      AND order_type = 'sale'
      AND order_state = 'posted'
      AND confirmation_date >= v_from AND confirmation_date < v_to;

    RETURN jsonb_build_object(
        'from', p_from,
        'to', p_to,
        'totals', v_totals,
        'by_channel', v_channels,
        'monthly', v_monthly,
        'by_payment_method', v_methods,
        'top_products', v_products,
        'by_campaign', v_campaigns,
        'receivables', v_receivables,
        'payables', v_payables,
        'pending_deliveries', v_deliveries,
        'refunds', v_refunds,
        'orders_confirmed', v_orders
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_kpis(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_kpis(UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_sales_kpis(UUID, DATE, DATE) IS
    'KPIs de ventas en base de caja: cobrado, neto sin IVA, costo de lo vendido, margen, canales, métodos, productos, campañas, cartera, entregas y devoluciones.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4. CRM conectado a la venta
-- ════════════════════════════════════════════════════════════════════════════
/** Vendido y cobrado de un lead, a partir de sus órdenes vinculadas. */
CREATE OR REPLACE FUNCTION public.sync_lead_revenue(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.crm_lead l
    SET won_amount = COALESCE(s.won, 0),
        collected_amount = COALESCE(s.collected, 0)
    FROM (
        SELECT
            SUM(o.amount_total - o.amount_refunded) FILTER (WHERE o.order_state = 'posted') AS won,
            SUM(o.amount_paid) FILTER (WHERE o.order_state <> 'cancel') AS collected
        FROM public.crm_lead_order lo
        JOIN public."order" o ON o.id = lo.order_id
        WHERE lo.lead_id = p_lead_id
    ) s
    WHERE l.id = p_lead_id
      AND (l.won_amount IS DISTINCT FROM COALESCE(s.won, 0)
           OR l.collected_amount IS DISTINCT FROM COALESCE(s.collected, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.sync_lead_revenue(UUID) FROM PUBLIC, anon, authenticated;

/** Mueve el lead a la primera etapa ganada (si no lo está). */
CREATE OR REPLACE FUNCTION public.mark_lead_won(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead  RECORD;
    v_stage UUID;
BEGIN
    SELECT l.id, l.company_id, s.is_won INTO v_lead
    FROM public.crm_lead l
    JOIN public.crm_lead_stage s ON s.id = l.stage_id
    WHERE l.id = p_lead_id;

    IF v_lead.id IS NULL OR v_lead.is_won THEN
        RETURN;
    END IF;

    SELECT id INTO v_stage
    FROM public.crm_lead_stage
    WHERE company_id = v_lead.company_id AND is_won AND active
    ORDER BY sequence
    LIMIT 1;

    IF v_stage IS NOT NULL THEN
        UPDATE public.crm_lead
        SET stage_id = v_stage, updated_by = COALESCE(auth.uid(), updated_by)
        WHERE id = p_lead_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_lead_won(UUID) FROM PUBLIC, anon, authenticated;

/**
 * Al confirmarse una orden de tienda o POS sin lead, se vincula al único lead
 * abierto del cliente (por partner o por email del checkout). Con 0 o varios
 * candidatos no se adivina.
 */
CREATE OR REPLACE FUNCTION public.auto_link_order_to_lead(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order   RECORD;
    v_lead    UUID;
    v_count   INT;
    v_default UUID;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id;

    IF v_order.id IS NULL OR v_order.order_type <> 'sale'
       OR v_order.origin NOT IN ('storefront', 'pos')
       OR EXISTS (SELECT 1 FROM public.crm_lead_order WHERE order_id = p_order_id) THEN
        RETURN NULL;
    END IF;

    -- El cliente genérico de la caja («Público general») no es un prospecto
    IF v_order.pos_session_id IS NOT NULL THEN
        SELECT r.default_partner_id INTO v_default
        FROM public.pos_session s JOIN public.pos_register r ON r.id = s.register_id
        WHERE s.id = v_order.pos_session_id;
        IF v_default IS NOT NULL AND v_default = v_order.partner_id THEN
            RETURN NULL;
        END IF;
    END IF;

    SELECT COUNT(*), MIN(l.id::TEXT)::UUID INTO v_count, v_lead
    FROM public.crm_lead l
    JOIN public.crm_lead_stage s ON s.id = l.stage_id
    WHERE l.company_id = v_order.company_id
      AND l.active
      AND NOT (s.is_won OR s.is_lost)
      AND (
          l.partner_id = v_order.partner_id
          OR (v_order.customer_email IS NOT NULL
              AND lower(l.contact_email) = lower(v_order.customer_email))
      );

    IF v_count <> 1 THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.crm_lead_order (lead_id, order_id, created_by)
    VALUES (v_lead, p_order_id, auth.uid())
    ON CONFLICT (order_id) DO NOTHING;

    RETURN v_lead;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_link_order_to_lead(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_crm_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    IF NEW.order_type <> 'sale' THEN
        RETURN NEW;
    END IF;

    BEGIN
        IF NEW.order_state = 'posted' AND OLD.order_state IS DISTINCT FROM 'posted' THEN
            PERFORM public.auto_link_order_to_lead(NEW.id);
        END IF;

        FOR r IN SELECT lead_id FROM public.crm_lead_order WHERE order_id = NEW.id LOOP
            IF NEW.order_state = 'posted' AND OLD.order_state IS DISTINCT FROM 'posted' THEN
                PERFORM public.mark_lead_won(r.lead_id);
            END IF;
            PERFORM public.sync_lead_revenue(r.lead_id);
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        -- El CRM nunca bloquea una venta
        RAISE WARNING 'No se pudo actualizar el CRM para %: %', NEW.name, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_crm_from_order ON public."order";
CREATE TRIGGER trigger_sync_crm_from_order
    AFTER UPDATE OF order_state, amount_total, amount_paid, amount_refunded ON public."order"
    FOR EACH ROW
    WHEN (
        OLD.order_state IS DISTINCT FROM NEW.order_state
        OR OLD.amount_total IS DISTINCT FROM NEW.amount_total
        OR OLD.amount_paid IS DISTINCT FROM NEW.amount_paid
        OR OLD.amount_refunded IS DISTINCT FROM NEW.amount_refunded
    )
    EXECUTE FUNCTION public.sync_crm_from_order();

CREATE OR REPLACE FUNCTION public.sync_crm_from_lead_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead  UUID := COALESCE(NEW.lead_id, OLD.lead_id);
    v_state TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT order_state INTO v_state FROM public."order" WHERE id = NEW.order_id;
        IF v_state = 'posted' THEN
            PERFORM public.mark_lead_won(v_lead);
        END IF;
    END IF;
    PERFORM public.sync_lead_revenue(v_lead);
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_crm_from_lead_order ON public.crm_lead_order;
CREATE TRIGGER trigger_sync_crm_from_lead_order
    AFTER INSERT OR DELETE ON public.crm_lead_order
    FOR EACH ROW EXECUTE FUNCTION public.sync_crm_from_lead_order();

/**
 * «Crear cotización» desde el lead: orden de venta en borrador para el
 * contacto del lead (si no tiene partner se da de alta) y vinculada al lead.
 */
CREATE OR REPLACE FUNCTION public.create_quotation_from_lead(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead     RECORD;
    v_partner  UUID;
    v_order_id UUID;
    v_seller   UUID;
    v_name     TEXT;
BEGIN
    SELECT * INTO v_lead FROM public.crm_lead WHERE id = p_lead_id;

    IF v_lead.id IS NULL OR NOT public.user_belongs_to_company(v_lead.company_id) THEN
        RAISE EXCEPTION 'Lead no encontrado';
    END IF;

    v_partner := v_lead.partner_id;

    IF v_partner IS NULL THEN
        v_name := COALESCE(NULLIF(btrim(v_lead.contact_company), ''), NULLIF(btrim(v_lead.contact_name), ''));
        IF v_name IS NULL THEN
            RAISE EXCEPTION 'El lead no tiene contacto: asigna un cliente o captura el nombre del contacto';
        END IF;

        -- Reutiliza un partner de la empresa con el mismo email
        IF NULLIF(btrim(COALESCE(v_lead.contact_email, '')), '') IS NOT NULL THEN
            SELECT p.id INTO v_partner
            FROM public.partner p
            JOIN public.rel_partner_company r ON r.partner_id = p.id
            WHERE r.company_id = v_lead.company_id
              AND lower(p.email) = lower(btrim(v_lead.contact_email))
            ORDER BY p.created_at
            LIMIT 1;
        END IF;

        IF v_partner IS NULL THEN
            INSERT INTO public.partner (name, email, phone, company_type)
            VALUES (
                v_name,
                NULLIF(btrim(COALESCE(v_lead.contact_email, '')), ''),
                NULLIF(btrim(COALESCE(v_lead.contact_phone, '')), ''),
                (CASE WHEN NULLIF(btrim(v_lead.contact_company), '') IS NOT NULL THEN 'company' ELSE 'person' END)::public.partner_type
            )
            RETURNING id INTO v_partner;

            INSERT INTO public.rel_partner_company (
                partner_id, company_id, role, invitation_status,
                relationship_type, is_default, is_active, accepted_at
            ) VALUES (
                v_partner, v_lead.company_id, 'guest', 'accepted',
                'partner', false, true, now()
            );
        END IF;

        UPDATE public.crm_lead SET partner_id = v_partner, updated_by = auth.uid() WHERE id = p_lead_id;
    END IF;

    SELECT id INTO v_seller FROM public.partner WHERE user_id = auth.uid();

    INSERT INTO public."order" (
        company_id, order_type, partner_id, created_by_partner_id, order_state,
        currency, reference, notes, created_by, updated_by
    ) VALUES (
        v_lead.company_id, 'sale', v_partner, v_seller, 'draft',
        COALESCE(v_lead.currency, 'MXN'),
        'Lead #' || COALESCE(v_lead.lead_number::TEXT, ''),
        'Cotización del lead «' || v_lead.name || '»',
        auth.uid(), auth.uid()
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.crm_lead_order (lead_id, order_id, created_by)
    VALUES (p_lead_id, v_order_id, auth.uid());

    RETURN jsonb_build_object('order_id', v_order_id, 'partner_id', v_partner);
END;
$$;

REVOKE ALL ON FUNCTION public.create_quotation_from_lead(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quotation_from_lead(UUID) TO authenticated;

-- Implantación: vendido y cobrado de los leads con órdenes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT DISTINCT lead_id FROM public.crm_lead_order LOOP
        PERFORM public.sync_lead_revenue(r.lead_id);
    END LOOP;
END;
$$;

-- v_crm_leads re-expande l.* con las columnas nuevas (misma definición)
DROP VIEW IF EXISTS public.v_crm_leads;
CREATE VIEW public.v_crm_leads
WITH (security_invoker = true)
AS
SELECT
    l.*,
    s.name                               AS stage_name,
    s.sequence                           AS stage_sequence,
    s.color                              AS stage_color,
    s.probability                        AS stage_probability,
    s.rotting_days                       AS stage_rotting_days,
    s.is_won,
    s.is_lost,
    p.name                               AS partner_name,
    COALESCE(p.display_name, p.name)     AS partner_display_name,
    rp.name                              AS responsible_name,
    COALESCE(rp.display_name, rp.name)   AS responsible_display_name,
    lr.name                              AS lost_reason_name,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.crm_lead_order lo
        WHERE lo.lead_id = l.id
    )                                    AS order_count,
    (
        SELECT COALESCE(SUM(o.amount_total), 0)
        FROM public.crm_lead_order lo
        JOIN public."order" o ON o.id = lo.order_id
        WHERE lo.lead_id = l.id
    )                                    AS orders_total,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.crm_activity a
        WHERE a.lead_id = l.id AND a.active = TRUE
          AND a.status <> 'done'
    )                                    AS open_activity_count,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.crm_activity a
        WHERE a.lead_id = l.id AND a.active = TRUE
          AND a.status = 'pending'
          AND a.scheduled_at IS NOT NULL
          AND a.scheduled_at < now()
    )                                    AS overdue_activity_count,
    na.id                                AS next_activity_id,
    na.title                             AS next_activity_title,
    na.type                              AS next_activity_type,
    na.scheduled_at                      AS next_activity_at,
    GREATEST(0, CURRENT_DATE - (l.stage_changed_at AT TIME ZONE 'UTC')::DATE)::INTEGER
                                         AS days_in_stage,
    (
        s.rotting_days IS NOT NULL
        AND NOT (s.is_won OR s.is_lost)
        AND l.stage_changed_at < now() - make_interval(days => s.rotting_days)
    )                                    AS is_rotting
FROM public.crm_lead l
LEFT JOIN public.crm_lead_stage s   ON s.id = l.stage_id
LEFT JOIN public.partner p          ON p.id = l.partner_id
LEFT JOIN public.partner rp         ON rp.id = l.responsible_partner_id
LEFT JOIN public.crm_lost_reason lr ON lr.id = l.lost_reason_id
LEFT JOIN LATERAL (
    SELECT a.id, a.title, a.type, a.scheduled_at
    FROM public.crm_activity a
    WHERE a.lead_id = l.id
      AND a.active = TRUE
      AND a.status <> 'done'
      AND a.scheduled_at IS NOT NULL
    ORDER BY a.scheduled_at ASC
    LIMIT 1
) na ON TRUE;

COMMENT ON VIEW public.v_crm_leads IS
    'Leads con etapa, contacto, responsable, próxima actividad, indicadores del tablero, vendido y cobrado.';

REVOKE ALL ON public.v_crm_leads FROM anon;
GRANT SELECT ON public.v_crm_leads TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. Sitio web → CRM
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.website_settings
    ADD COLUMN IF NOT EXISTS auto_convert_submissions BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.website_settings.auto_convert_submissions IS
    'Convierte cada mensaje del formulario de contacto en un lead del CRM al recibirlo.';

/** Conversión sin comprobación de sesión: la usan el RPC y el trigger. */
CREATE OR REPLACE FUNCTION public._convert_website_submission_to_lead(
    p_submission_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub      public.website_contact_submission%ROWTYPE;
    v_stage_id UUID;
    v_lead_id  UUID;
    v_url      TEXT;
BEGIN
    SELECT * INTO v_sub FROM public.website_contact_submission WHERE id = p_submission_id;
    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    IF v_sub.crm_lead_id IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'exists', 'lead_id', v_sub.crm_lead_id);
    END IF;

    SELECT id INTO v_stage_id FROM public.crm_lead_stage
    WHERE company_id = v_sub.company_id AND active AND NOT is_won AND NOT is_lost
    ORDER BY sequence LIMIT 1;
    IF v_stage_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'no_stage');
    END IF;

    v_url := COALESCE(v_sub.source_url, '');

    INSERT INTO public.crm_lead (
        company_id, name, contact_name, contact_email, contact_phone, origin, description,
        stage_id, tags, utm_source, utm_medium, utm_campaign, created_by, updated_by
    ) VALUES (
        v_sub.company_id,
        left(COALESCE(NULLIF(btrim(v_sub.subject), ''), 'Contacto web: ' || v_sub.name), 255),
        v_sub.name, v_sub.email, v_sub.phone, 'web',
        v_sub.message, v_stage_id, ARRAY['sitio-web'],
        left(NULLIF(substring(v_url FROM '[?&]utm_source=([^&#]+)'), ''), 120),
        left(NULLIF(substring(v_url FROM '[?&]utm_medium=([^&#]+)'), ''), 120),
        left(NULLIF(substring(v_url FROM '[?&]utm_campaign=([^&#]+)'), ''), 120),
        p_user_id, p_user_id
    ) RETURNING id INTO v_lead_id;

    UPDATE public.website_contact_submission
    SET crm_lead_id = v_lead_id,
        status = CASE WHEN status = 'new' AND p_user_id IS NOT NULL THEN 'read' ELSE status END,
        updated_by = COALESCE(p_user_id, updated_by)
    WHERE id = v_sub.id;

    RETURN jsonb_build_object('status', 'ok', 'lead_id', v_lead_id);
END;
$$;

REVOKE ALL ON FUNCTION public._convert_website_submission_to_lead(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.convert_website_submission_to_lead(p_submission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
BEGIN
    SELECT company_id INTO v_company FROM public.website_contact_submission WHERE id = p_submission_id;
    IF v_company IS NULL OR auth.uid() IS NULL OR NOT public.user_belongs_to_company(v_company) THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;
    RETURN public._convert_website_submission_to_lead(p_submission_id, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.convert_website_submission_to_lead(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_website_submission_to_lead(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_convert_website_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.website_settings
        WHERE company_id = NEW.company_id AND auto_convert_submissions
    ) THEN
        BEGIN
            PERFORM public._convert_website_submission_to_lead(NEW.id, NULL);
        EXCEPTION WHEN OTHERS THEN
            -- El formulario público nunca falla por el CRM
            RAISE WARNING 'No se pudo convertir el mensaje en lead: %', SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_convert_website_submission ON public.website_contact_submission;
CREATE TRIGGER trigger_auto_convert_website_submission
    AFTER INSERT ON public.website_contact_submission
    FOR EACH ROW EXECUTE FUNCTION public.auto_convert_website_submission();
