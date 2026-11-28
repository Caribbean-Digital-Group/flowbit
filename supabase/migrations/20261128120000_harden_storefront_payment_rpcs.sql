-- ============================================================================
-- Endurecer los RPC de pago del storefront (TRY-71)
--
-- TRY-70 cerró en el servidor el hueco por el que una tienda podía marcar como
-- pagada una orden de otra empresa: el webhook comprobaba la empresa con una
-- consulta aparte antes de llamar a `mark_storefront_order_paid`. La base de
-- datos seguía aceptando cualquier `order_id` (solo filtraba por
-- `origin = 'storefront'`), así que un endpoint nuevo podía saltarse la regla.
--
-- Esta migración lleva la regla a la base:
--   * `mark_storefront_order_paid` y `record_storefront_stripe_session` reciben
--     `p_company_id` y solo tocan órdenes de esa empresa;
--   * se eliminan las firmas anteriores (sin empresa), para que ningún código
--     pueda seguir usándolas;
--   * `get_storefront_stripe_order` devuelve el `company_id` de la orden, que
--     los endpoints `session` y `status` pasan a los RPC anteriores.
--
-- Siguen ejecutables solo por service_role (servidor de Nuxt).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quitar las firmas sin empresa
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.mark_storefront_order_paid(UUID, TEXT, TEXT, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS public.record_storefront_stripe_session(UUID, TEXT);

-- ----------------------------------------------------------------------------
-- 2. record_storefront_stripe_session con empresa
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_storefront_stripe_session(
    p_company_id UUID,
    p_order_id UUID,
    p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INT;
BEGIN
    IF p_company_id IS NULL OR p_order_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    UPDATE public."order"
    SET stripe_session_id = NULLIF(btrim(COALESCE(p_session_id, '')), ''),
        payment_provider = 'stripe'
    WHERE id = p_order_id
      AND company_id = p_company_id
      AND origin = 'storefront';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.record_storefront_stripe_session(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_storefront_stripe_session(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.record_storefront_stripe_session(UUID, UUID, TEXT) IS
    'Asocia la Checkout Session de Stripe a una orden del storefront de la empresa indicada (service_role únicamente, TRY-71).';

-- ----------------------------------------------------------------------------
-- 3. mark_storefront_order_paid con empresa
--    Mismo cuerpo que en 20261103130000_sales_fulfillment_and_payments.sql;
--    solo cambia el filtro de la orden.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_storefront_order_paid(
    p_company_id UUID,
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
    IF p_company_id IS NULL OR p_order_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    -- Multi-tenant: la orden debe ser de la tienda que reporta el pago.
    SELECT * INTO v_order
    FROM public."order" o
    WHERE o.id = p_order_id
      AND o.company_id = p_company_id
      AND o.origin = 'storefront'
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

REVOKE ALL ON FUNCTION public.mark_storefront_order_paid(UUID, UUID, TEXT, TEXT, DECIMAL, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_storefront_order_paid(UUID, UUID, TEXT, TEXT, DECIMAL, TEXT) TO service_role;

COMMENT ON FUNCTION public.mark_storefront_order_paid(UUID, UUID, TEXT, TEXT, DECIMAL, TEXT) IS
    'Registra el cobro de Stripe de una orden del storefront de la empresa indicada; idempotente por payment intent o sesión (service_role únicamente, TRY-71).';

-- ----------------------------------------------------------------------------
-- 4. get_storefront_stripe_order: incluir company_id en la orden
--    Mismo cuerpo que en 20260717120000_add_stripe_to_storefront.sql.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_stripe_order(
    p_slug TEXT,
    p_order_ref TEXT,
    p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_company public.company%ROWTYPE;
    v_settings public.storefront_settings%ROWTYPE;
    v_order public."order"%ROWTYPE;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_company  FROM public.company WHERE id = v_company_id;
    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;

    SELECT * INTO v_order
    FROM public."order" o
    WHERE o.company_id = v_company_id
      AND o.origin = 'storefront'
      AND o.name = btrim(COALESCE(p_order_ref, ''))
      AND lower(o.customer_email) = lower(btrim(COALESCE(p_email, '')));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'config', jsonb_build_object(
            'enabled', COALESCE(v_settings.stripe_enabled, false)
                AND NULLIF(btrim(COALESCE(v_settings.stripe_secret_key, '')), '') IS NOT NULL,
            'secret_key', NULLIF(btrim(COALESCE(v_settings.stripe_secret_key, '')), ''),
            'store_name', COALESCE(NULLIF(btrim(v_company.display_name), ''), v_company.name)
        ),
        'order', jsonb_build_object(
            'id', v_order.id,
            'company_id', v_order.company_id,
            'order_ref', v_order.name,
            'amount_total', v_order.amount_total,
            'currency', v_order.currency,
            'payment_status', v_order.payment_status,
            'payment_provider', v_order.payment_provider,
            'stripe_session_id', v_order.stripe_session_id,
            'customer_email', v_order.customer_email,
            'customer_name', v_order.customer_name
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_stripe_order(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_stripe_order(TEXT, TEXT, TEXT) TO service_role;
