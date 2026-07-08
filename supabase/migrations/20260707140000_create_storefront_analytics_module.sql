-- ╔════════════════════════════════════════════════════════════════╗
-- ║  Storefront Analytics — analítica first-party de la tienda      ║
-- ║                                                                  ║
-- ║  Pipeline: tracker cliente → /api/storefront/analytics (Nitro)  ║
-- ║  → ingest_storefront_events (RPC anon) → storefront_event       ║
-- ║  → jobs (sesionización + rollups) → panel del dashboard.        ║
-- ║                                                                  ║
-- ║  1. storefront_event            — eventos crudos (append-only)  ║
-- ║  2. storefront_session          — sesiones derivadas            ║
-- ║  3. storefront_analytics_daily  — rollup diario de KPIs         ║
-- ║  4. storefront_analytics_daily_dim — rollup por dimensión       ║
-- ║  5. storefront_analytics_job_run   — bitácora del pipeline      ║
-- ║  6. ingest_storefront_events    — RPC de ingesta (anon)         ║
-- ║  7. Triggers server-side purchase / refund sobre "order"        ║
-- ║  8. Jobs: sesionización, rollup, retención (pg_cron si existe)  ║
-- ║  9. RPCs del panel: visitantes activos + refresco bajo demanda  ║
-- ╚════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. storefront_event — eventos crudos
--
-- Append-only desde el cliente (vía RPC de ingesta) y desde triggers
-- del servidor (purchase/refund). Los jobs de procesamiento solo
-- enriquecen purchase/refund (valor + atribución de sesión).
-- El `id` lo genera el emisor (UUID) y actúa como llave de
-- deduplicación ante reintentos.
--
-- Nota: por diseño no lleva created_by/updated_by (lo escribe el rol
-- anon vía SECURITY DEFINER) ni soft-delete (la retención se maneja
-- con purga programada por fecha).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.storefront_event (
    id             UUID PRIMARY KEY,
    company_id     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    event_name     VARCHAR(60) NOT NULL,
    event_category VARCHAR(20) NOT NULL DEFAULT 'custom'
        CHECK (event_category IN ('navigation', 'interaction', 'ecommerce', 'custom')),

    -- Identidad (sin PII: ids aleatorios generados en el cliente)
    anonymous_id   VARCHAR(64),
    user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id     VARCHAR(64),

    -- Contexto de navegación
    page_path      TEXT,
    page_title     TEXT,
    referrer       TEXT,
    utm_source     VARCHAR(120),
    utm_medium     VARCHAR(120),
    utm_campaign   VARCHAR(120),

    -- Contexto de dispositivo (enriquecido en servidor; sin IP)
    device_type    VARCHAR(20),
    browser        VARCHAR(40),
    os             VARCHAR(40),
    country        VARCHAR(2),
    language       VARCHAR(10),
    viewport       VARCHAR(20),

    -- E-commerce
    value          DECIMAL(15, 2),
    currency       VARCHAR(3),
    items          JSONB,
    order_id       UUID REFERENCES public."order"(id) ON DELETE SET NULL,
    checkout_token UUID,

    properties     JSONB NOT NULL DEFAULT '{}'::jsonb,

    client_ts      TIMESTAMPTZ,
    server_ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.storefront_event ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_storefront_event_company_ts
    ON public.storefront_event(company_id, server_ts DESC);
CREATE INDEX idx_storefront_event_company_name_ts
    ON public.storefront_event(company_id, event_name, server_ts DESC);
CREATE INDEX idx_storefront_event_company_session
    ON public.storefront_event(company_id, session_id);
CREATE INDEX idx_storefront_event_company_anon_ts
    ON public.storefront_event(company_id, anonymous_id, server_ts DESC);
CREATE INDEX idx_storefront_event_checkout_token
    ON public.storefront_event(checkout_token)
    WHERE checkout_token IS NOT NULL;

-- Solo lectura para miembros de la empresa; escritura únicamente vía
-- funciones SECURITY DEFINER (ingesta y triggers).
CREATE POLICY "storefront_event_select_company" ON public.storefront_event
    FOR SELECT USING (public.user_belongs_to_company(company_id));

COMMENT ON TABLE public.storefront_event IS
    'Eventos crudos de analítica first-party del storefront (append-only, deduplicados por id).';

-- ═══════════════════════════════════════════════════════════════════
-- 2. storefront_session — sesiones derivadas (computadas por job)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.storefront_session (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    session_id       VARCHAR(64) NOT NULL,
    anonymous_id     VARCHAR(64),
    user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    started_at       TIMESTAMPTZ NOT NULL,
    last_seen_at     TIMESTAMPTZ NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    page_views       INT NOT NULL DEFAULT 0,
    events_count     INT NOT NULL DEFAULT 0,

    entry_path       TEXT,
    exit_path        TEXT,
    referrer         TEXT,
    utm_source       VARCHAR(120),
    utm_medium       VARCHAR(120),
    utm_campaign     VARCHAR(120),
    device_type      VARCHAR(20),
    browser          VARCHAR(40),
    os               VARCHAR(40),
    country          VARCHAR(2),

    is_new_visitor   BOOLEAN NOT NULL DEFAULT false,
    is_bounce        BOOLEAN NOT NULL DEFAULT false,
    converted        BOOLEAN NOT NULL DEFAULT false,
    order_count      INT NOT NULL DEFAULT 0,
    revenue          DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),

    UNIQUE (company_id, session_id)
);

ALTER TABLE public.storefront_session ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_storefront_session_updated_at
    BEFORE UPDATE ON public.storefront_session
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_storefront_session_company_started
    ON public.storefront_session(company_id, started_at DESC);
CREATE INDEX idx_storefront_session_company_anon
    ON public.storefront_session(company_id, anonymous_id);

CREATE POLICY "storefront_session_select_company" ON public.storefront_session
    FOR SELECT USING (public.user_belongs_to_company(company_id));

COMMENT ON TABLE public.storefront_session IS
    'Sesiones de visita del storefront, derivadas de storefront_event por el job de sesionización.';

-- ═══════════════════════════════════════════════════════════════════
-- 3. storefront_analytics_daily — rollup diario de KPIs (UTC)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.storefront_analytics_daily (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    day                    DATE NOT NULL,

    page_views             INT NOT NULL DEFAULT 0,
    sessions               INT NOT NULL DEFAULT 0,
    visitors               INT NOT NULL DEFAULT 0,
    new_visitors           INT NOT NULL DEFAULT 0,
    bounce_sessions        INT NOT NULL DEFAULT 0,
    total_session_seconds  BIGINT NOT NULL DEFAULT 0,

    orders                 INT NOT NULL DEFAULT 0,
    revenue                DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    refunds                INT NOT NULL DEFAULT 0,
    refund_amount          DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    converted_sessions     INT NOT NULL DEFAULT 0,

    -- Embudo de checkout: sesiones distintas que alcanzaron cada paso
    funnel_view_item       INT NOT NULL DEFAULT 0,
    funnel_add_to_cart     INT NOT NULL DEFAULT 0,
    funnel_begin_checkout  INT NOT NULL DEFAULT 0,
    funnel_purchase        INT NOT NULL DEFAULT 0,

    created_at             TIMESTAMPTZ DEFAULT now(),
    updated_at             TIMESTAMPTZ DEFAULT now(),

    UNIQUE (company_id, day)
);

ALTER TABLE public.storefront_analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_storefront_analytics_daily_updated_at
    BEFORE UPDATE ON public.storefront_analytics_daily
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_storefront_analytics_daily_company_day
    ON public.storefront_analytics_daily(company_id, day DESC);

CREATE POLICY "storefront_analytics_daily_select_company" ON public.storefront_analytics_daily
    FOR SELECT USING (public.user_belongs_to_company(company_id));

COMMENT ON TABLE public.storefront_analytics_daily IS
    'Rollup diario (UTC) de métricas del storefront; el panel lee de aquí, nunca de eventos crudos.';

-- ═══════════════════════════════════════════════════════════════════
-- 4. storefront_analytics_daily_dim — rollup diario por dimensión
--    (top páginas, productos, fuentes, dispositivos, búsquedas...)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.storefront_analytics_daily_dim (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    day        DATE NOT NULL,

    dim        VARCHAR(24) NOT NULL CHECK (dim IN (
        'page', 'product_view', 'product_purchased', 'source',
        'device', 'browser', 'country', 'search', 'event'
    )),
    dim_key    TEXT NOT NULL,
    dim_label  TEXT,

    hits       INT NOT NULL DEFAULT 0,           -- ocurrencias
    uniques    INT NOT NULL DEFAULT 0,           -- sesiones distintas
    value      DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- monto asociado (si aplica)

    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (company_id, day, dim, dim_key)
);

ALTER TABLE public.storefront_analytics_daily_dim ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_storefront_analytics_dim_company_day
    ON public.storefront_analytics_daily_dim(company_id, day DESC, dim);

CREATE POLICY "storefront_analytics_dim_select_company" ON public.storefront_analytics_daily_dim
    FOR SELECT USING (public.user_belongs_to_company(company_id));

COMMENT ON TABLE public.storefront_analytics_daily_dim IS
    'Rollup diario por dimensión (páginas, productos, fuentes, dispositivos, búsquedas, países).';

-- ═══════════════════════════════════════════════════════════════════
-- 5. storefront_analytics_job_run — bitácora / salud del pipeline
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.storefront_analytics_job_run (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name       VARCHAR(60) NOT NULL,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ,
    rows_processed INT DEFAULT 0,
    error          TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.storefront_analytics_job_run ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_storefront_analytics_job_run_name
    ON public.storefront_analytics_job_run(job_name, started_at DESC);

-- Visible para cualquier usuario autenticado (observabilidad del pipeline);
-- no contiene datos de negocio por empresa.
CREATE POLICY "storefront_analytics_job_run_select" ON public.storefront_analytics_job_run
    FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.storefront_analytics_job_run IS
    'Bitácora de ejecuciones de los jobs de analítica (observabilidad y throttling).';

-- ═══════════════════════════════════════════════════════════════════
-- 6. ingest_storefront_events — RPC de ingesta (rol anon)
--
-- Recibe lotes del tracker (vía /api/storefront/analytics), valida el
-- catálogo de eventos, aplica rate limiting por visitante y deduplica
-- por id. purchase/refund NUNCA se aceptan del cliente: solo los
-- emiten los triggers del servidor.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ingest_storefront_events(
    p_slug    TEXT,
    p_events  JSONB,
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id   UUID;
    v_event        JSONB;
    v_id           UUID;
    v_name         TEXT;
    v_category     TEXT;
    v_client_ts    TIMESTAMPTZ;
    v_value        DECIMAL(15, 2);
    v_user_id      UUID;
    v_anon         TEXT;
    v_recent       INT;
    v_accepted     INT := 0;
    v_rejected     INT := 0;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_payload');
    END IF;

    IF jsonb_array_length(p_events) > 50 THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'batch_too_large');
    END IF;

    -- Rate limiting por visitante: máx. 300 eventos por minuto
    v_anon := left(COALESCE(p_events -> 0 ->> 'anonymous_id', ''), 64);
    IF v_anon <> '' THEN
        SELECT count(*) INTO v_recent
        FROM public.storefront_event
        WHERE company_id = v_company_id
          AND anonymous_id = v_anon
          AND server_ts > now() - INTERVAL '1 minute';

        IF v_recent >= 300 THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'rate_limited');
        END IF;
    END IF;

    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events) LOOP
        v_name := v_event ->> 'name';

        -- Catálogo permitido desde el cliente (purchase/refund son server-side)
        IF v_name IS NULL OR v_name NOT IN (
            'page_view', 'click', 'select_content', 'search',
            'view_item_list', 'view_item', 'select_item',
            'add_to_cart', 'remove_from_cart', 'view_cart', 'add_to_wishlist',
            'begin_checkout', 'add_shipping_info', 'add_payment_info'
        ) THEN
            v_rejected := v_rejected + 1;
            CONTINUE;
        END IF;

        v_category := CASE
            WHEN v_name = 'page_view' THEN 'navigation'
            WHEN v_name IN ('click', 'select_content', 'search') THEN 'interaction'
            ELSE 'ecommerce'
        END;

        BEGIN
            v_id := (v_event ->> 'id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_rejected := v_rejected + 1;
            CONTINUE;
        END;

        -- Timestamp del cliente: solo si es razonable (±1 día), si no, null
        BEGIN
            v_client_ts := (v_event ->> 'ts')::timestamptz;
            IF v_client_ts IS NOT NULL
               AND abs(extract(epoch FROM (now() - v_client_ts))) > 86400 THEN
                v_client_ts := NULL;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_client_ts := NULL;
        END;

        BEGIN
            v_value := (v_event ->> 'value')::decimal(15, 2);
        EXCEPTION WHEN OTHERS THEN
            v_value := NULL;
        END;

        BEGIN
            v_user_id := (v_event ->> 'user_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_user_id := NULL;
        END;

        BEGIN
            INSERT INTO public.storefront_event (
                id, company_id, event_name, event_category,
                anonymous_id, user_id, session_id,
                page_path, page_title, referrer,
                utm_source, utm_medium, utm_campaign,
                device_type, browser, os, country, language, viewport,
                value, currency, items, checkout_token,
                properties, client_ts, server_ts
            )
            VALUES (
                v_id, v_company_id, v_name, v_category,
                left(v_event ->> 'anonymous_id', 64),
                v_user_id,
                left(v_event ->> 'session_id', 64),
                left(v_event ->> 'path', 500),
                left(v_event ->> 'title', 300),
                left(v_event ->> 'referrer', 500),
                left(v_event ->> 'utm_source', 120),
                left(v_event ->> 'utm_medium', 120),
                left(v_event ->> 'utm_campaign', 120),
                left(p_context ->> 'device_type', 20),
                left(p_context ->> 'browser', 40),
                left(p_context ->> 'os', 40),
                upper(left(p_context ->> 'country', 2)),
                left(v_event ->> 'language', 10),
                left(v_event ->> 'viewport', 20),
                v_value,
                upper(left(v_event ->> 'currency', 3)),
                CASE WHEN jsonb_typeof(v_event -> 'items') = 'array'
                     THEN v_event -> 'items' ELSE NULL END,
                NULLIF(v_event ->> 'checkout_token', '')::uuid,
                COALESCE(v_event -> 'properties', '{}'::jsonb),
                v_client_ts,
                now()
            )
            ON CONFLICT (id) DO NOTHING;

            IF FOUND THEN
                v_accepted := v_accepted + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_rejected := v_rejected + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object('status', 'ok', 'accepted', v_accepted, 'rejected', v_rejected);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_storefront_events(TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_storefront_events(TEXT, JSONB, JSONB) TO anon, authenticated;

COMMENT ON FUNCTION public.ingest_storefront_events IS
    'Ingesta de lotes de eventos del tracker del storefront: valida catálogo, deduplica por id y aplica rate limiting.';

-- ═══════════════════════════════════════════════════════════════════
-- 7. Eventos server-side: purchase / refund
--
-- Se emiten desde triggers sobre "order" para no depender del cliente
-- (bloqueadores, cierre de pestaña). El id es determinístico a partir
-- del order.id (idempotente). El valor definitivo y la atribución de
-- sesión (vía checkout_token) los completa el job de sesionización,
-- leyendo siempre de la orden como fuente de verdad.
-- Cualquier error se traga: la analítica jamás rompe el checkout.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.storefront_track_order_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.storefront_event (
        id, company_id, event_name, event_category,
        order_id, checkout_token, value, currency, properties, server_ts
    )
    VALUES (
        md5('storefront_purchase:' || NEW.id::text)::uuid,
        NEW.company_id, 'purchase', 'ecommerce',
        NEW.id, NEW.checkout_token, NEW.amount_total, NEW.currency,
        jsonb_build_object('order_ref', NEW.name),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_storefront_track_purchase
    AFTER INSERT ON public."order"
    FOR EACH ROW
    WHEN (NEW.origin = 'storefront')
    EXECUTE FUNCTION public.storefront_track_order_purchase();

CREATE OR REPLACE FUNCTION public.storefront_track_order_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.storefront_event (
        id, company_id, event_name, event_category,
        order_id, checkout_token, value, currency, properties, server_ts
    )
    VALUES (
        md5('storefront_refund:' || NEW.id::text)::uuid,
        NEW.company_id, 'refund', 'ecommerce',
        NEW.id, NEW.checkout_token, NEW.amount_total, NEW.currency,
        jsonb_build_object('order_ref', NEW.name),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_storefront_track_refund
    AFTER UPDATE ON public."order"
    FOR EACH ROW
    WHEN (
        NEW.origin = 'storefront'
        AND OLD.order_state IS DISTINCT FROM NEW.order_state
        AND NEW.order_state = 'cancel'
    )
    EXECUTE FUNCTION public.storefront_track_order_refund();

-- ═══════════════════════════════════════════════════════════════════
-- 8.1 Sesionización (idempotente, ventana móvil)
--
-- Agrupa eventos por session_id (el cliente rota la sesión tras
-- ~30 min de inactividad), atribuye purchase/refund a su sesión vía
-- checkout_token y refresca valor/moneda desde la orden.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.storefront_analytics_sessionize(
    p_lookback INTERVAL DEFAULT INTERVAL '48 hours'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INT := 0;
BEGIN
    -- 1) Enriquecer purchase/refund desde la orden (fuente de verdad)
    --    y atribuir sesión por checkout_token.
    UPDATE public.storefront_event e
    SET value    = o.amount_total,
        currency = o.currency
    FROM public."order" o
    WHERE e.order_id = o.id
      AND e.event_name IN ('purchase', 'refund')
      AND e.server_ts > now() - p_lookback
      AND (e.value IS DISTINCT FROM o.amount_total OR e.currency IS DISTINCT FROM o.currency);

    UPDATE public.storefront_event e
    SET session_id   = src.session_id,
        anonymous_id = src.anonymous_id,
        user_id      = COALESCE(e.user_id, src.user_id)
    FROM (
        SELECT DISTINCT ON (company_id, checkout_token)
               company_id, checkout_token, session_id, anonymous_id, user_id
        FROM public.storefront_event
        WHERE checkout_token IS NOT NULL
          AND session_id IS NOT NULL
          AND event_name IN ('begin_checkout', 'add_shipping_info', 'add_payment_info')
          AND server_ts > now() - (p_lookback * 2)
        ORDER BY company_id, checkout_token, server_ts DESC
    ) src
    WHERE e.company_id = src.company_id
      AND e.checkout_token = src.checkout_token
      AND e.event_name IN ('purchase', 'refund')
      AND e.session_id IS NULL
      AND e.server_ts > now() - p_lookback;

    -- 2) Upsert de sesiones tocadas en la ventana (recomputa completo)
    WITH touched AS (
        SELECT DISTINCT company_id, session_id
        FROM public.storefront_event
        WHERE server_ts > now() - p_lookback
          AND session_id IS NOT NULL
    ),
    agg AS (
        SELECT
            e.company_id,
            e.session_id,
            max(e.anonymous_id)                             AS anonymous_id,
            max(e.user_id::text)::uuid                      AS user_id,
            min(e.server_ts)                                AS started_at,
            max(e.server_ts)                                AS last_seen_at,
            count(*) FILTER (WHERE e.event_name = 'page_view') AS page_views,
            count(*)                                        AS events_count,
            (array_agg(e.page_path ORDER BY e.server_ts)
                FILTER (WHERE e.event_name = 'page_view'))[1]  AS entry_path,
            (array_agg(e.page_path ORDER BY e.server_ts DESC)
                FILTER (WHERE e.event_name = 'page_view'))[1]  AS exit_path,
            (array_agg(e.referrer ORDER BY e.server_ts)
                FILTER (WHERE e.referrer IS NOT NULL))[1]      AS referrer,
            (array_agg(e.utm_source ORDER BY e.server_ts)
                FILTER (WHERE e.utm_source IS NOT NULL))[1]    AS utm_source,
            (array_agg(e.utm_medium ORDER BY e.server_ts)
                FILTER (WHERE e.utm_medium IS NOT NULL))[1]    AS utm_medium,
            (array_agg(e.utm_campaign ORDER BY e.server_ts)
                FILTER (WHERE e.utm_campaign IS NOT NULL))[1]  AS utm_campaign,
            (array_agg(e.device_type ORDER BY e.server_ts)
                FILTER (WHERE e.device_type IS NOT NULL))[1]   AS device_type,
            (array_agg(e.browser ORDER BY e.server_ts)
                FILTER (WHERE e.browser IS NOT NULL))[1]       AS browser,
            (array_agg(e.os ORDER BY e.server_ts)
                FILTER (WHERE e.os IS NOT NULL))[1]            AS os,
            (array_agg(e.country ORDER BY e.server_ts)
                FILTER (WHERE e.country IS NOT NULL))[1]       AS country,
            count(*) FILTER (WHERE e.event_name = 'purchase')  AS order_count,
            COALESCE(sum(e.value) FILTER (WHERE e.event_name = 'purchase'), 0) AS revenue
        FROM public.storefront_event e
        INNER JOIN touched t
            ON t.company_id = e.company_id AND t.session_id = e.session_id
        GROUP BY e.company_id, e.session_id
    )
    INSERT INTO public.storefront_session (
        company_id, session_id, anonymous_id, user_id,
        started_at, last_seen_at, duration_seconds,
        page_views, events_count, entry_path, exit_path,
        referrer, utm_source, utm_medium, utm_campaign,
        device_type, browser, os, country,
        is_new_visitor, is_bounce, converted, order_count, revenue
    )
    SELECT
        a.company_id, a.session_id, a.anonymous_id, a.user_id,
        a.started_at, a.last_seen_at,
        GREATEST(0, extract(epoch FROM (a.last_seen_at - a.started_at))::int),
        a.page_views, a.events_count, a.entry_path, a.exit_path,
        a.referrer, a.utm_source, a.utm_medium, a.utm_campaign,
        a.device_type, a.browser, a.os, a.country,
        (a.anonymous_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.storefront_event prev
            WHERE prev.company_id = a.company_id
              AND prev.anonymous_id = a.anonymous_id
              AND prev.server_ts < a.started_at
        )),
        (a.page_views <= 1 AND a.order_count = 0),
        (a.order_count > 0),
        a.order_count,
        a.revenue
    FROM agg a
    ON CONFLICT (company_id, session_id) DO UPDATE SET
        anonymous_id     = EXCLUDED.anonymous_id,
        user_id          = COALESCE(EXCLUDED.user_id, storefront_session.user_id),
        started_at       = EXCLUDED.started_at,
        last_seen_at     = EXCLUDED.last_seen_at,
        duration_seconds = EXCLUDED.duration_seconds,
        page_views       = EXCLUDED.page_views,
        events_count     = EXCLUDED.events_count,
        entry_path       = EXCLUDED.entry_path,
        exit_path        = EXCLUDED.exit_path,
        referrer         = EXCLUDED.referrer,
        utm_source       = EXCLUDED.utm_source,
        utm_medium       = EXCLUDED.utm_medium,
        utm_campaign     = EXCLUDED.utm_campaign,
        device_type      = EXCLUDED.device_type,
        browser          = EXCLUDED.browser,
        os               = EXCLUDED.os,
        country          = EXCLUDED.country,
        is_new_visitor   = EXCLUDED.is_new_visitor,
        is_bounce        = EXCLUDED.is_bounce,
        converted        = EXCLUDED.converted,
        order_count      = EXCLUDED.order_count,
        revenue          = EXCLUDED.revenue;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_analytics_sessionize(INTERVAL) FROM PUBLIC;

-- ═══════════════════════════════════════════════════════════════════
-- 8.2 Rollup diario (idempotente: recomputa los últimos p_days)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.storefront_analytics_rollup(
    p_days INT DEFAULT 3
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from DATE := (now() AT TIME ZONE 'UTC')::date - p_days;
    v_rows INT := 0;
BEGIN
    -- ── KPIs diarios ────────────────────────────────────────────────
    INSERT INTO public.storefront_analytics_daily (
        company_id, day,
        page_views, sessions, visitors, new_visitors,
        bounce_sessions, total_session_seconds,
        orders, revenue, refunds, refund_amount, converted_sessions,
        funnel_view_item, funnel_add_to_cart, funnel_begin_checkout, funnel_purchase
    )
    SELECT
        d.company_id,
        d.day,
        COALESCE(ev.page_views, 0),
        COALESCE(s.sessions, 0),
        COALESCE(s.visitors, 0),
        COALESCE(s.new_visitors, 0),
        COALESCE(s.bounce_sessions, 0),
        COALESCE(s.total_seconds, 0),
        COALESCE(o.orders, 0),
        COALESCE(o.revenue, 0),
        COALESCE(o.refunds, 0),
        COALESCE(o.refund_amount, 0),
        COALESCE(s.converted_sessions, 0),
        COALESCE(f.view_item, 0),
        COALESCE(f.add_to_cart, 0),
        COALESCE(f.begin_checkout, 0),
        COALESCE(f.purchase, 0)
    FROM (
        SELECT DISTINCT company_id, (server_ts AT TIME ZONE 'UTC')::date AS day
        FROM public.storefront_event
        WHERE (server_ts AT TIME ZONE 'UTC')::date >= v_from
        UNION
        SELECT DISTINCT company_id, (started_at AT TIME ZONE 'UTC')::date
        FROM public.storefront_session
        WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
    ) d
    LEFT JOIN (
        SELECT company_id, (server_ts AT TIME ZONE 'UTC')::date AS day,
               count(*) FILTER (WHERE event_name = 'page_view') AS page_views
        FROM public.storefront_event
        WHERE (server_ts AT TIME ZONE 'UTC')::date >= v_from
        GROUP BY 1, 2
    ) ev ON ev.company_id = d.company_id AND ev.day = d.day
    LEFT JOIN (
        SELECT company_id, (started_at AT TIME ZONE 'UTC')::date AS day,
               count(*)                                    AS sessions,
               count(DISTINCT anonymous_id)                AS visitors,
               count(*) FILTER (WHERE is_new_visitor)      AS new_visitors,
               count(*) FILTER (WHERE is_bounce)           AS bounce_sessions,
               COALESCE(sum(duration_seconds), 0)          AS total_seconds,
               count(*) FILTER (WHERE converted)           AS converted_sessions
        FROM public.storefront_session
        WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
        GROUP BY 1, 2
    ) s ON s.company_id = d.company_id AND s.day = d.day
    LEFT JOIN (
        -- Órdenes/ingresos desde la fuente de verdad: la tabla order
        SELECT company_id, (created_at AT TIME ZONE 'UTC')::date AS day,
               count(*) FILTER (WHERE order_state <> 'cancel')            AS orders,
               COALESCE(sum(amount_total) FILTER (WHERE order_state <> 'cancel'), 0) AS revenue,
               count(*) FILTER (WHERE order_state = 'cancel')             AS refunds,
               COALESCE(sum(amount_total) FILTER (WHERE order_state = 'cancel'), 0)  AS refund_amount
        FROM public."order"
        WHERE origin = 'storefront'
          AND (created_at AT TIME ZONE 'UTC')::date >= v_from
        GROUP BY 1, 2
    ) o ON o.company_id = d.company_id AND o.day = d.day
    LEFT JOIN (
        SELECT company_id, (server_ts AT TIME ZONE 'UTC')::date AS day,
               count(DISTINCT session_id) FILTER (WHERE event_name = 'view_item')      AS view_item,
               count(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart')    AS add_to_cart,
               count(DISTINCT session_id) FILTER (WHERE event_name = 'begin_checkout') AS begin_checkout,
               count(DISTINCT COALESCE(session_id, id::text))
                   FILTER (WHERE event_name = 'purchase')                              AS purchase
        FROM public.storefront_event
        WHERE (server_ts AT TIME ZONE 'UTC')::date >= v_from
        GROUP BY 1, 2
    ) f ON f.company_id = d.company_id AND f.day = d.day
    ON CONFLICT (company_id, day) DO UPDATE SET
        page_views            = EXCLUDED.page_views,
        sessions              = EXCLUDED.sessions,
        visitors              = EXCLUDED.visitors,
        new_visitors          = EXCLUDED.new_visitors,
        bounce_sessions       = EXCLUDED.bounce_sessions,
        total_session_seconds = EXCLUDED.total_session_seconds,
        orders                = EXCLUDED.orders,
        revenue               = EXCLUDED.revenue,
        refunds               = EXCLUDED.refunds,
        refund_amount         = EXCLUDED.refund_amount,
        converted_sessions    = EXCLUDED.converted_sessions,
        funnel_view_item      = EXCLUDED.funnel_view_item,
        funnel_add_to_cart    = EXCLUDED.funnel_add_to_cart,
        funnel_begin_checkout = EXCLUDED.funnel_begin_checkout,
        funnel_purchase       = EXCLUDED.funnel_purchase;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- ── Dimensiones (delete + insert = idempotente) ─────────────────
    DELETE FROM public.storefront_analytics_daily_dim WHERE day >= v_from;

    INSERT INTO public.storefront_analytics_daily_dim
        (company_id, day, dim, dim_key, dim_label, hits, uniques, value)

    -- Páginas más vistas
    SELECT company_id, (server_ts AT TIME ZONE 'UTC')::date, 'page',
           COALESCE(page_path, '/'), COALESCE(page_path, '/'),
           count(*), count(DISTINCT session_id), 0
    FROM public.storefront_event
    WHERE event_name = 'page_view' AND (server_ts AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4

    UNION ALL
    -- Productos más vistos (properties.product_id / product_name del data layer)
    SELECT company_id, (server_ts AT TIME ZONE 'UTC')::date, 'product_view',
           properties ->> 'product_id',
           max(properties ->> 'product_name'),
           count(*), count(DISTINCT session_id), 0
    FROM public.storefront_event
    WHERE event_name = 'view_item'
      AND properties ->> 'product_id' IS NOT NULL
      AND (server_ts AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4

    UNION ALL
    -- Productos más comprados (desde las líneas de orden, fuente de verdad)
    SELECT o.company_id, (o.created_at AT TIME ZONE 'UTC')::date, 'product_purchased',
           ol.product_id::text,
           max(ol.description),
           sum(ol.quantity)::int, count(DISTINCT o.id), COALESCE(sum(ol.total), 0)
    FROM public."order" o
    INNER JOIN public.order_line ol ON ol.order_id = o.id AND ol.product_id IS NOT NULL
    WHERE o.origin = 'storefront'
      AND o.order_state <> 'cancel'
      AND (o.created_at AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4

    UNION ALL
    -- Fuentes de tráfico (UTM o host del referrer, por sesión)
    SELECT company_id, (started_at AT TIME ZONE 'UTC')::date, 'source',
           COALESCE(
               NULLIF(utm_source, ''),
               NULLIF(split_part(split_part(COALESCE(referrer, ''), '//', 2), '/', 1), ''),
               'directo'
           ),
           COALESCE(
               NULLIF(utm_source, ''),
               NULLIF(split_part(split_part(COALESCE(referrer, ''), '//', 2), '/', 1), ''),
               'Directo'
           ),
           count(*), count(*), COALESCE(sum(revenue), 0)
    FROM public.storefront_session
    WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4, 5

    UNION ALL
    -- Dispositivos (por sesión)
    SELECT company_id, (started_at AT TIME ZONE 'UTC')::date, 'device',
           COALESCE(device_type, 'desconocido'), initcap(COALESCE(device_type, 'desconocido')),
           count(*), count(*), 0
    FROM public.storefront_session
    WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4

    UNION ALL
    -- Navegadores (por sesión)
    SELECT company_id, (started_at AT TIME ZONE 'UTC')::date, 'browser',
           COALESCE(browser, 'desconocido'), COALESCE(browser, 'Desconocido'),
           count(*), count(*), 0
    FROM public.storefront_session
    WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4

    UNION ALL
    -- Países (por sesión)
    SELECT company_id, (started_at AT TIME ZONE 'UTC')::date, 'country',
           COALESCE(country, '??'), COALESCE(country, 'Desconocido'),
           count(*), count(*), 0
    FROM public.storefront_session
    WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4

    UNION ALL
    -- Búsquedas (término + promedio de resultados en value)
    SELECT company_id, (server_ts AT TIME ZONE 'UTC')::date, 'search',
           lower(left(properties ->> 'term', 120)),
           lower(left(properties ->> 'term', 120)),
           count(*), count(DISTINCT session_id),
           COALESCE(round(avg(NULLIF(properties ->> 'results', '')::numeric), 2), 0)
    FROM public.storefront_event
    WHERE event_name = 'search'
      AND COALESCE(properties ->> 'term', '') <> ''
      AND (server_ts AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4

    UNION ALL
    -- Conteo por tipo de evento (salud del catálogo + eventos comunes)
    SELECT company_id, (server_ts AT TIME ZONE 'UTC')::date, 'event',
           event_name, event_name,
           count(*), count(DISTINCT session_id), 0
    FROM public.storefront_event
    WHERE (server_ts AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4;

    RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_analytics_rollup(INT) FROM PUBLIC;

-- ═══════════════════════════════════════════════════════════════════
-- 8.3 Orquestador de jobs (con throttle) + retención
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.run_storefront_analytics_jobs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run_id   UUID;
    v_sessions INT;
    v_days     INT;
BEGIN
    -- Throttle: si ya corrió hace < 5 min (p. ej. refresco manual del
    -- panel + pg_cron), no recomputar de nuevo.
    IF EXISTS (
        SELECT 1 FROM public.storefront_analytics_job_run
        WHERE job_name = 'analytics_refresh'
          AND started_at > now() - INTERVAL '5 minutes'
          AND error IS NULL
    ) THEN
        RETURN jsonb_build_object('status', 'skipped', 'reason', 'recently_ran');
    END IF;

    INSERT INTO public.storefront_analytics_job_run (job_name)
    VALUES ('analytics_refresh')
    RETURNING id INTO v_run_id;

    BEGIN
        v_sessions := public.storefront_analytics_sessionize();
        v_days     := public.storefront_analytics_rollup();

        UPDATE public.storefront_analytics_job_run
        SET finished_at = now(), rows_processed = COALESCE(v_sessions, 0) + COALESCE(v_days, 0)
        WHERE id = v_run_id;

        RETURN jsonb_build_object('status', 'ok', 'sessions', v_sessions, 'daily_rows', v_days);
    EXCEPTION WHEN OTHERS THEN
        UPDATE public.storefront_analytics_job_run
        SET finished_at = now(), error = SQLERRM
        WHERE id = v_run_id;

        RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.run_storefront_analytics_jobs() FROM PUBLIC;
-- El panel puede disparar un refresco bajo demanda (queda protegido
-- por el throttle interno); pg_cron lo ejecuta como superusuario.
GRANT EXECUTE ON FUNCTION public.run_storefront_analytics_jobs() TO authenticated;

-- Retención: purga eventos crudos y sesiones antiguas; los rollups se
-- conservan a largo plazo (histórico agregado).
CREATE OR REPLACE FUNCTION public.storefront_analytics_cleanup(
    p_keep_days INT DEFAULT 400
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_events   INT;
    v_sessions INT;
BEGIN
    DELETE FROM public.storefront_event
    WHERE server_ts < now() - make_interval(days => p_keep_days);
    GET DIAGNOSTICS v_events = ROW_COUNT;

    DELETE FROM public.storefront_session
    WHERE started_at < now() - make_interval(days => p_keep_days);
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    DELETE FROM public.storefront_analytics_job_run
    WHERE started_at < now() - INTERVAL '90 days';

    INSERT INTO public.storefront_analytics_job_run (job_name, finished_at, rows_processed)
    VALUES ('analytics_cleanup', now(), COALESCE(v_events, 0) + COALESCE(v_sessions, 0));

    RETURN jsonb_build_object('status', 'ok', 'events_deleted', v_events, 'sessions_deleted', v_sessions);
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_analytics_cleanup(INT) FROM PUBLIC;

-- Borrado a solicitud (privacidad): elimina todos los eventos y
-- sesiones de un visitante concreto de la empresa (derecho al olvido).
CREATE OR REPLACE FUNCTION public.storefront_analytics_forget_visitor(
    p_company_id UUID,
    p_anonymous_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_events INT;
BEGIN
    IF NOT public.is_company_admin(p_company_id) THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'forbidden');
    END IF;

    DELETE FROM public.storefront_event
    WHERE company_id = p_company_id AND anonymous_id = p_anonymous_id;
    GET DIAGNOSTICS v_events = ROW_COUNT;

    DELETE FROM public.storefront_session
    WHERE company_id = p_company_id AND anonymous_id = p_anonymous_id;

    RETURN jsonb_build_object('status', 'ok', 'events_deleted', v_events);
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_analytics_forget_visitor(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_analytics_forget_visitor(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 9. Visitantes activos (cuasi tiempo real, para el panel)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_storefront_active_visitors(
    p_company_id UUID
)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RETURN 0;
    END IF;

    SELECT count(DISTINCT session_id) INTO v_count
    FROM public.storefront_event
    WHERE company_id = p_company_id
      AND session_id IS NOT NULL
      AND server_ts > now() - INTERVAL '5 minutes';

    RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_active_visitors(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_active_visitors(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 10. Programación con pg_cron (si la extensión está disponible).
--     Si no lo está, el panel dispara run_storefront_analytics_jobs()
--     bajo demanda (con throttle) y este bloque solo deja un NOTICE.
-- ═══════════════════════════════════════════════════════════════════
DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;

        BEGIN
            PERFORM cron.unschedule('storefront-analytics-refresh');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
            PERFORM cron.unschedule('storefront-analytics-cleanup');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        PERFORM cron.schedule(
            'storefront-analytics-refresh',
            '*/15 * * * *',
            $job$SELECT public.run_storefront_analytics_jobs();$job$
        );
        PERFORM cron.schedule(
            'storefront-analytics-cleanup',
            '30 3 * * *',
            $job$SELECT public.storefront_analytics_cleanup();$job$
        );
    ELSE
        RAISE NOTICE 'pg_cron no disponible: los jobs de analítica correrán bajo demanda desde el panel.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo programar pg_cron (%). Los jobs correrán bajo demanda.', SQLERRM;
END;
$do$;
