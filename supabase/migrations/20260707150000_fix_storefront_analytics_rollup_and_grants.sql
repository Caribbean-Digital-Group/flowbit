-- ╔════════════════════════════════════════════════════════════════╗
-- ║  Fix Storefront Analytics                                        ║
-- ║                                                                  ║
-- ║  1. storefront_analytics_rollup fallaba con «column              ║
-- ║     storefront_session.browser must appear in the GROUP BY»:     ║
-- ║     los branches de browser/country usaban en dim_label una      ║
-- ║     expresión distinta a la agrupada. Se agrupan ahora todas     ║
-- ║     las columnas clave/etiqueta explícitamente.                  ║
-- ║  2. Endurecimiento de permisos: Supabase otorga EXECUTE a        ║
-- ║     anon/authenticated por default privileges, así que REVOKE    ║
-- ║     FROM PUBLIC no basta — se revoca explícitamente anon (y      ║
-- ║     authenticated en las funciones internas de jobs, que solo    ║
-- ║     invoca el orquestador SECURITY DEFINER o pg_cron).           ║
-- ╚════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. Rollup diario corregido
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
    GROUP BY 1, 2, 4, 5

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
    GROUP BY 1, 2, 4, 5

    UNION ALL
    -- Navegadores (por sesión)
    SELECT company_id, (started_at AT TIME ZONE 'UTC')::date, 'browser',
           COALESCE(browser, 'desconocido'), COALESCE(browser, 'Desconocido'),
           count(*), count(*), 0
    FROM public.storefront_session
    WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4, 5

    UNION ALL
    -- Países (por sesión)
    SELECT company_id, (started_at AT TIME ZONE 'UTC')::date, 'country',
           COALESCE(country, '??'), COALESCE(country, 'Desconocido'),
           count(*), count(*), 0
    FROM public.storefront_session
    WHERE (started_at AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4, 5

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
    GROUP BY 1, 2, 4, 5

    UNION ALL
    -- Conteo por tipo de evento (salud del catálogo + eventos comunes)
    SELECT company_id, (server_ts AT TIME ZONE 'UTC')::date, 'event',
           event_name, event_name,
           count(*), count(DISTINCT session_id), 0
    FROM public.storefront_event
    WHERE (server_ts AT TIME ZONE 'UTC')::date >= v_from
    GROUP BY 1, 2, 4, 5;

    RETURN v_rows;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Endurecimiento de permisos
--    (los default privileges de Supabase otorgan EXECUTE a anon y
--    authenticated en cada CREATE FUNCTION; revocar explícitamente)
-- ═══════════════════════════════════════════════════════════════════

-- Internas: solo el orquestador (SECURITY DEFINER) o pg_cron las invocan
REVOKE EXECUTE ON FUNCTION public.storefront_analytics_sessionize(INTERVAL)
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.storefront_analytics_rollup(INT)
    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.storefront_analytics_cleanup(INT)
    FROM PUBLIC, anon, authenticated;

-- Orquestador y utilidades del panel: solo usuarios autenticados
REVOKE EXECUTE ON FUNCTION public.run_storefront_analytics_jobs()
    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.storefront_analytics_forget_visitor(UUID, TEXT)
    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_storefront_active_visitors(UUID)
    FROM PUBLIC, anon;

-- La ingesta sí es pública por diseño (tracker anónimo del storefront):
-- ingest_storefront_events conserva anon + authenticated.
