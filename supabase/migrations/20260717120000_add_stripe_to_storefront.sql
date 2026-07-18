-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  add_stripe_to_storefront                                                 ║
-- ║                                                                           ║
-- ║  Integra la pasarela de pago Stripe (Stripe Checkout hosted) en la        ║
-- ║  tienda en línea:                                                         ║
-- ║                                                                           ║
-- ║  1. Credenciales por empresa en storefront_settings (publishable key,     ║
-- ║     secret key y webhook secret). La secret key NUNCA se expone en los    ║
-- ║     RPCs públicos: solo la leen los RPCs de servicio (service_role).      ║
-- ║  2. Columnas de conciliación en la orden (payment_provider,               ║
-- ║     stripe_session_id, stripe_payment_intent_id, paid_at).                ║
-- ║  3. get_storefront_checkout_info expone si Stripe está disponible.        ║
-- ║  4. place_storefront_order acepta p_payment_provider = 'stripe'           ║
-- ║     (sin payment_method_id del catálogo).                                 ║
-- ║  5. RPCs de servicio para el backend de Nuxt (server/api/storefront/      ║
-- ║     stripe/*): leer credenciales + orden, registrar la sesión de pago     ║
-- ║     y marcar la orden como pagada. Solo ejecutables con service_role.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Columnas nuevas
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.storefront_settings
    ADD COLUMN IF NOT EXISTS stripe_enabled         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
    ADD COLUMN IF NOT EXISTS stripe_secret_key      TEXT,
    ADD COLUMN IF NOT EXISTS stripe_webhook_secret  TEXT;

COMMENT ON COLUMN public.storefront_settings.stripe_enabled IS
    'Habilita el pago con tarjeta vía Stripe Checkout en el checkout de la tienda.';
COMMENT ON COLUMN public.storefront_settings.stripe_publishable_key IS
    'Publishable key de Stripe (pk_...). Es pública por diseño.';
COMMENT ON COLUMN public.storefront_settings.stripe_secret_key IS
    'Secret key de Stripe (sk_... / rk_...). Solo la leen los RPCs de servicio (service_role); nunca se expone en RPCs públicos.';
COMMENT ON COLUMN public.storefront_settings.stripe_webhook_secret IS
    'Signing secret del webhook de Stripe (whsec_...) para verificar la firma de los eventos.';

ALTER TABLE public."order"
    ADD COLUMN IF NOT EXISTS payment_provider         VARCHAR(30),
    ADD COLUMN IF NOT EXISTS stripe_session_id        TEXT,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS paid_at                  TIMESTAMPTZ;

COMMENT ON COLUMN public."order".payment_provider IS
    'Pasarela usada para cobrar la orden (ej: stripe). NULL cuando el cobro se concilia manualmente.';
COMMENT ON COLUMN public."order".stripe_session_id IS
    'Checkout Session de Stripe asociada a la orden (cs_...).';
COMMENT ON COLUMN public."order".stripe_payment_intent_id IS
    'PaymentIntent de Stripe que liquidó la orden (pi_...).';
COMMENT ON COLUMN public."order".paid_at IS
    'Momento en que la pasarela confirmó el pago.';

CREATE INDEX IF NOT EXISTS idx_order_stripe_session
    ON public."order"(stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. get_storefront_checkout_info — expone disponibilidad de Stripe
--    (solo enabled + publishable key; la secret key jamás sale por aquí)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_storefront_checkout_info(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_settings public.storefront_settings%ROWTYPE;
    v_shipping JSONB;
    v_payments JSONB;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', sm.id,
            'name', sm.name,
            'description', sm.description,
            'price', sm.price,
            'delivery_estimate', sm.delivery_estimate
        ) ORDER BY sm.display_order, sm.price
    ), '[]'::jsonb)
    INTO v_shipping
    FROM public.storefront_shipping_method sm
    WHERE sm.company_id = v_company_id
      AND COALESCE(sm.active, true) = true;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', pm.id,
            'name', pm.name,
            'description', pm.description
        ) ORDER BY pm.name
    ), '[]'::jsonb)
    INTO v_payments
    FROM public.payment_method pm
    WHERE pm.company_id = v_company_id
      AND COALESCE(pm.active, true) = true;

    RETURN jsonb_build_object(
        'status', 'ok',
        'shipping_methods', v_shipping,
        'payment_methods', v_payments,
        'stripe', jsonb_build_object(
            'enabled', COALESCE(v_settings.stripe_enabled, false)
                AND NULLIF(btrim(COALESCE(v_settings.stripe_secret_key, '')), '') IS NOT NULL
                AND NULLIF(btrim(COALESCE(v_settings.stripe_publishable_key, '')), '') IS NOT NULL,
            'publishable_key', NULLIF(btrim(COALESCE(v_settings.stripe_publishable_key, '')), '')
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_checkout_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_checkout_info(TEXT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. place_storefront_order — acepta p_payment_provider = 'stripe'
--    (cambia la firma: se elimina la versión anterior para evitar overloads
--    ambiguos en PostgREST)
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.place_storefront_order(TEXT, UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT);

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
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'store_not_found',
            'message', 'La tienda no existe o está desactivada.');
    END IF;

    SELECT * INTO v_company FROM public.company WHERE id = v_company_id;
    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;

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

        IF COALESCE(v_product.is_stockable, true)
           AND COALESCE(v_product.stock_quantity, 0) < v_qty THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'insufficient_stock',
                'message', format(
                    'Stock insuficiente para «%s»: quedan %s unidades.',
                    COALESCE(NULLIF(btrim(v_product.display_name), ''), v_product.name),
                    GREATEST(COALESCE(v_product.stock_quantity, 0), 0)
                ),
                'product_id', v_product.id,
                'available', GREATEST(COALESCE(v_product.stock_quantity, 0), 0)
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
-- 4. get_storefront_order — expone payment_provider para la confirmación
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_storefront_order(
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
    v_order public."order"%ROWTYPE;
    v_lines JSONB;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_order
    FROM public."order" o
    WHERE o.company_id = v_company_id
      AND o.origin = 'storefront'
      AND o.name = btrim(COALESCE(p_order_ref, ''))
      AND lower(o.customer_email) = lower(btrim(COALESCE(p_email, '')));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'description', ol.description,
            'quantity', ol.quantity,
            'unit_price', ol.unit_price,
            'discount_percent', ol.discount_percent,
            'subtotal', ol.subtotal,
            'total', ol.total,
            'image_url', p.image_url,
            'product_slug', p.slug
        ) ORDER BY ol.sequence
    ), '[]'::jsonb)
    INTO v_lines
    FROM public.order_line ol
    LEFT JOIN public.product p ON p.id = ol.product_id
    WHERE ol.order_id = v_order.id;

    RETURN jsonb_build_object(
        'status', 'ok',
        'order', jsonb_build_object(
            'order_ref', v_order.name,
            'order_date', v_order.order_date,
            'order_state', v_order.order_state,
            'payment_status', v_order.payment_status,
            'payment_provider', v_order.payment_provider,
            'is_delivered', v_order.is_delivered,
            'customer_name', v_order.customer_name,
            'customer_email', v_order.customer_email,
            'shipping_method_name', v_order.shipping_method_name,
            'shipping_cost', v_order.shipping_cost,
            'coupon_code', v_order.coupon_code,
            'coupon_discount', v_order.coupon_discount,
            'shipping_street', v_order.shipping_street,
            'shipping_street2', v_order.shipping_street2,
            'shipping_city', v_order.shipping_city,
            'shipping_state', v_order.shipping_state,
            'shipping_zip', v_order.shipping_zip,
            'amount_untaxed', v_order.amount_untaxed,
            'amount_tax', v_order.amount_tax,
            'amount_discount', v_order.amount_discount,
            'amount_total', v_order.amount_total,
            'currency', v_order.currency
        ),
        'lines', v_lines
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_order(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_order(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. RPCs de servicio (solo service_role) — usados por server/api/storefront/
--    stripe/*. Nunca se otorgan a anon/authenticated porque devuelven o
--    modifican credenciales y estado de pago.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 5.1 Configuración de Stripe de una tienda (para el webhook) ─────────────
CREATE OR REPLACE FUNCTION public.get_storefront_stripe_config(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_settings public.storefront_settings%ROWTYPE;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;

    RETURN jsonb_build_object(
        'status', 'ok',
        'company_id', v_company_id,
        'enabled', COALESCE(v_settings.stripe_enabled, false)
            AND NULLIF(btrim(COALESCE(v_settings.stripe_secret_key, '')), '') IS NOT NULL,
        'secret_key', NULLIF(btrim(COALESCE(v_settings.stripe_secret_key, '')), ''),
        'webhook_secret', NULLIF(btrim(COALESCE(v_settings.stripe_webhook_secret, '')), '')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_stripe_config(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_stripe_config(TEXT) TO service_role;

COMMENT ON FUNCTION public.get_storefront_stripe_config(TEXT) IS
    'Credenciales de Stripe de la tienda para el backend (service_role únicamente).';

-- ── 5.2 Orden + credenciales para crear/verificar la sesión de pago ─────────
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

COMMENT ON FUNCTION public.get_storefront_stripe_order(TEXT, TEXT, TEXT) IS
    'Orden del storefront + credenciales de Stripe para crear/verificar la sesión de pago (service_role únicamente).';

-- ── 5.3 Registrar la Checkout Session creada para una orden ─────────────────
CREATE OR REPLACE FUNCTION public.record_storefront_stripe_session(
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
    UPDATE public."order"
    SET stripe_session_id = NULLIF(btrim(COALESCE(p_session_id, '')), ''),
        payment_provider = 'stripe'
    WHERE id = p_order_id
      AND origin = 'storefront';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.record_storefront_stripe_session(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_storefront_stripe_session(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.record_storefront_stripe_session(UUID, TEXT) IS
    'Asocia la Checkout Session de Stripe a una orden del storefront (service_role únicamente).';

-- ── 5.4 Marcar la orden como pagada (webhook / verificación de sesión) ──────
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
    v_order public."order"%ROWTYPE;
    v_status TEXT;
BEGIN
    SELECT * INTO v_order
    FROM public."order" o
    WHERE o.id = p_order_id
      AND o.origin = 'storefront'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    -- Idempotente: los webhooks de Stripe pueden reintentarse
    IF v_order.payment_status = 'paid' THEN
        RETURN jsonb_build_object('status', 'ok', 'payment_status', 'paid', 'already_paid', true);
    END IF;

    IF upper(btrim(COALESCE(p_currency, ''))) <> upper(COALESCE(v_order.currency, '')) THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'currency_mismatch',
            'message', 'La moneda del pago no coincide con la de la orden.');
    END IF;

    -- Tolerancia de 50 centavos por el redondeo a unidades mínimas de Stripe
    IF COALESCE(p_amount, 0) + 0.5 >= COALESCE(v_order.amount_total, 0) THEN
        v_status := 'paid';
    ELSE
        v_status := 'partial';
    END IF;

    UPDATE public."order"
    SET payment_status = v_status,
        payment_provider = 'stripe',
        paid_at = CASE WHEN v_status = 'paid' THEN now() ELSE paid_at END,
        stripe_session_id = COALESCE(NULLIF(btrim(COALESCE(p_session_id, '')), ''), stripe_session_id),
        stripe_payment_intent_id = COALESCE(NULLIF(btrim(COALESCE(p_payment_intent, '')), ''), stripe_payment_intent_id)
    WHERE id = p_order_id;

    RETURN jsonb_build_object('status', 'ok', 'payment_status', v_status, 'already_paid', false);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_storefront_order_paid(UUID, TEXT, TEXT, DECIMAL, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_storefront_order_paid(UUID, TEXT, TEXT, DECIMAL, TEXT) TO service_role;

COMMENT ON FUNCTION public.mark_storefront_order_paid(UUID, TEXT, TEXT, DECIMAL, TEXT) IS
    'Actualiza payment_status de una orden del storefront tras confirmar el cobro en Stripe; valida moneda y monto e idempotente ante reintentos del webhook (service_role únicamente).';
