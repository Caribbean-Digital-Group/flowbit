-- ════════════════════════════════════════════════════════════════════════════
-- Cuentas por cobrar / por pagar: antigüedad de saldos y estado de cuenta (TRY-39)
-- ════════════════════════════════════════════════════════════════════════════
-- Dos RPC de solo lectura, sin tablas nuevas:
--
--   get_aging_report(company, order_type)
--       Saldo abierto por contacto en cubetas de antigüedad
--       (al corriente, 1–30, 31–60, 61–90, +90 días).
--   get_partner_statement(company, partner, order_type, from)
--       Movimientos de un contacto (órdenes, cobros/pagos, devoluciones) en
--       orden cronológico, más sus órdenes abiertas con días de atraso.
--
-- Reglas (las mismas de get_sales_kpis para que el reporte de ventas y este
-- reporte nunca se contradigan):
--   · Saldo de una orden = amount_total − amount_refunded − amount_paid.
--   · Solo órdenes confirmadas (posted), no pagadas ni condonadas, con saldo > 0.005.
--   · Vencimiento = payment_due_date, o la fecha de confirmación, o order_date.
--   · Días de atraso = fecha de corte − vencimiento (≤ 0 = al corriente).
--   · Importes en la moneda de la empresa usando el exchange_rate de la orden.
--
-- La agregación ocurre en la base: el navegador no descarga todas las órdenes.
-- Las funciones validan la membresía con user_belongs_to_company.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Antigüedad de saldos por contacto
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_aging_report(
    p_company_id UUID,
    p_order_type public.order_type DEFAULT 'sale',
    p_as_of      DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_as_of    DATE := COALESCE(p_as_of, CURRENT_DATE);
    v_currency TEXT;
    v_totals   JSONB;
    v_partners JSONB;
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    SELECT COALESCE(c.currency, 'MXN') INTO v_currency
    FROM public.company c WHERE c.id = p_company_id;

    WITH open_orders AS (
        SELECT
            o.partner_id,
            ROUND((o.amount_total - o.amount_refunded - o.amount_paid)
                * CASE WHEN o.currency IS DISTINCT FROM v_currency
                       THEN COALESCE(NULLIF(o.exchange_rate, 0), 1) ELSE 1 END, 2) AS balance,
            v_as_of - COALESCE(o.payment_due_date, o.confirmation_date::DATE, o.order_date) AS days_overdue
        FROM public."order" o
        WHERE o.company_id = p_company_id
          AND o.order_type = p_order_type
          AND o.order_state = 'posted'
          AND COALESCE(o.payment_status, 'unpaid') NOT IN ('paid', 'condoned')
          AND o.amount_total - o.amount_refunded - o.amount_paid > 0.005
    ),
    by_partner AS (
        SELECT
            b.partner_id,
            COUNT(*)                                                                  AS order_count,
            SUM(b.balance)                                                            AS total,
            COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue <= 0), 0)            AS current,
            COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue BETWEEN 1 AND 30), 0)  AS d1_30,
            COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue BETWEEN 31 AND 60), 0) AS d31_60,
            COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue BETWEEN 61 AND 90), 0) AS d61_90,
            COALESCE(SUM(b.balance) FILTER (WHERE b.days_overdue > 90), 0)            AS d90_plus,
            GREATEST(MAX(b.days_overdue), 0)                                          AS max_days_overdue
        FROM open_orders b
        GROUP BY b.partner_id
    )
    SELECT
        jsonb_build_object(
            'count',    COALESCE(SUM(bp.order_count), 0),
            'partners', COUNT(*),
            'total',    COALESCE(SUM(bp.total), 0),
            'current',  COALESCE(SUM(bp.current), 0),
            'd1_30',    COALESCE(SUM(bp.d1_30), 0),
            'd31_60',   COALESCE(SUM(bp.d31_60), 0),
            'd61_90',   COALESCE(SUM(bp.d61_90), 0),
            'd90_plus', COALESCE(SUM(bp.d90_plus), 0)
        ),
        COALESCE(jsonb_agg(jsonb_build_object(
            'partner_id',       bp.partner_id,
            'partner_name',     COALESCE(NULLIF(btrim(p.name), ''), '—'),
            'partner_email',    p.email,
            'partner_phone',    p.phone,
            'order_count',      bp.order_count,
            'total',            bp.total,
            'current',          bp.current,
            'd1_30',            bp.d1_30,
            'd31_60',           bp.d31_60,
            'd61_90',           bp.d61_90,
            'd90_plus',         bp.d90_plus,
            'max_days_overdue', bp.max_days_overdue
        ) ORDER BY bp.total DESC, p.name), '[]'::JSONB)
    INTO v_totals, v_partners
    FROM by_partner bp
    LEFT JOIN public.partner p ON p.id = bp.partner_id;

    RETURN jsonb_build_object(
        'as_of',      v_as_of,
        'order_type', p_order_type,
        'currency',   v_currency,
        'totals',     v_totals,
        'partners',   v_partners
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_aging_report(UUID, public.order_type, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_aging_report(UUID, public.order_type, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_aging_report(UUID, public.order_type, DATE) IS
    'Antigüedad de saldos por contacto (al corriente, 1–30, 31–60, 61–90, +90 días) de órdenes de venta (por cobrar) o compra (por pagar), en moneda de la empresa.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Estado de cuenta de un contacto
-- ────────────────────────────────────────────────────────────────────────────
-- entries: cargos (orden confirmada, reembolso entregado) y abonos (cobro/pago,
-- devolución). El saldo acumulado lo calcula el cliente con
-- app/utils/receivables.ts (buildStatement). La suma de cargos − abonos de
-- todas las órdenes confirmadas es igual a la suma de sus saldos.
CREATE OR REPLACE FUNCTION public.get_partner_statement(
    p_company_id UUID,
    p_partner_id UUID,
    p_order_type public.order_type DEFAULT 'sale',
    p_from       DATE DEFAULT NULL,
    p_as_of      DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_as_of    DATE := COALESCE(p_as_of, CURRENT_DATE);
    v_currency TEXT;
    v_partner  JSONB;
    v_opening  NUMERIC := 0;
    v_entries  JSONB;
    v_open     JSONB;
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    SELECT COALESCE(c.currency, 'MXN') INTO v_currency
    FROM public.company c WHERE c.id = p_company_id;

    SELECT jsonb_build_object(
        'id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone, 'vat', p.vat
    ) INTO v_partner
    FROM public.partner p WHERE p.id = p_partner_id;

    WITH orders AS (
        SELECT
            o.id, o.name, o.currency,
            COALESCE(o.confirmation_date::DATE, o.order_date) AS posted_on,
            CASE WHEN o.currency IS DISTINCT FROM v_currency
                 THEN COALESCE(NULLIF(o.exchange_rate, 0), 1) ELSE 1 END AS rate,
            o.amount_total
        FROM public."order" o
        WHERE o.company_id = p_company_id
          AND o.partner_id = p_partner_id
          AND o.order_type = p_order_type
          AND o.order_state = 'posted'
    ),
    movements AS (
        -- Orden confirmada: cargo por el total
        SELECT o.posted_on AS entry_date, 'order'::TEXT AS kind, o.id AS order_id, o.name AS order_name,
               o.name AS reference, ROUND(o.amount_total * o.rate, 2) AS charge, 0::NUMERIC AS credit,
               o.posted_on::TIMESTAMPTZ AS sort_at
        FROM orders o
        UNION ALL
        -- Cobros / pagos (positivos = abono). Un reembolso entregado al cliente
        -- llega como pago negativo: se muestra como cargo.
        SELECT op.paid_at::DATE,
               CASE WHEN op.amount < 0 THEN 'reimbursement' ELSE 'payment' END,
               o.id, o.name, COALESCE(NULLIF(btrim(op.reference), ''), pm.name),
               CASE WHEN op.amount < 0 THEN ROUND(-op.amount * o.rate, 2) ELSE 0 END,
               CASE WHEN op.amount > 0 THEN ROUND(op.amount * o.rate, 2) ELSE 0 END,
               op.paid_at
        FROM public.order_payment op
        JOIN orders o ON o.id = op.order_id
        LEFT JOIN public.payment_method pm ON pm.id = op.payment_method_id
        WHERE op.active = true
        UNION ALL
        -- Devoluciones: abono por el total devuelto
        SELECT rf.created_at::DATE, 'refund', o.id, o.name, COALESCE(rf.name, rf.reason),
               0, ROUND(rf.amount_total * o.rate, 2), rf.created_at
        FROM public.order_refund rf
        JOIN orders o ON o.id = rf.order_id
        WHERE rf.active = true
    )
    SELECT
        COALESCE(SUM(m.charge - m.credit) FILTER (WHERE p_from IS NOT NULL AND m.entry_date < p_from), 0),
        COALESCE(jsonb_agg(jsonb_build_object(
            'date',       m.entry_date,
            'kind',       m.kind,
            'order_id',   m.order_id,
            'order_name', m.order_name,
            'reference',  m.reference,
            'charge',     m.charge,
            'credit',     m.credit
        ) ORDER BY m.sort_at, m.kind) FILTER (WHERE (p_from IS NULL OR m.entry_date >= p_from) AND m.entry_date <= v_as_of), '[]'::JSONB)
    INTO v_opening, v_entries
    FROM movements m;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'order_id',     x.id,
        'order_name',   x.name,
        'order_date',   x.order_date,
        'due_date',     x.due_date,
        'days_overdue', v_as_of - x.due_date,
        'currency',     x.currency,
        'amount_total', x.amount_total,
        'balance',      x.balance
    ) ORDER BY x.due_date, x.name), '[]'::JSONB)
    INTO v_open
    FROM (
        SELECT
            o.id, o.name, o.order_date, o.currency, o.amount_total,
            COALESCE(o.payment_due_date, o.confirmation_date::DATE, o.order_date) AS due_date,
            ROUND((o.amount_total - o.amount_refunded - o.amount_paid)
                * CASE WHEN o.currency IS DISTINCT FROM v_currency
                       THEN COALESCE(NULLIF(o.exchange_rate, 0), 1) ELSE 1 END, 2) AS balance
        FROM public."order" o
        WHERE o.company_id = p_company_id
          AND o.partner_id = p_partner_id
          AND o.order_type = p_order_type
          AND o.order_state = 'posted'
          AND COALESCE(o.payment_status, 'unpaid') NOT IN ('paid', 'condoned')
          AND o.amount_total - o.amount_refunded - o.amount_paid > 0.005
    ) x;

    RETURN jsonb_build_object(
        'as_of',           v_as_of,
        'from',            p_from,
        'order_type',      p_order_type,
        'currency',        v_currency,
        'partner',         v_partner,
        'opening_balance', v_opening,
        'entries',         v_entries,
        'open_orders',     v_open
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_statement(UUID, UUID, public.order_type, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_statement(UUID, UUID, public.order_type, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_partner_statement(UUID, UUID, public.order_type, DATE, DATE) IS
    'Estado de cuenta de un contacto: órdenes confirmadas, cobros/pagos, reembolsos y devoluciones en orden cronológico, saldo inicial y órdenes abiertas con días de atraso.';
