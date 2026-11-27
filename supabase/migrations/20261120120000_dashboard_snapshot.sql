-- ============================================================================
-- TRY-33 — Dashboard: foto agregada en la base
-- ============================================================================
-- Antes, `/admin` descargaba ocho listados completos de la empresa (contactos,
-- productos, órdenes, proyectos, pickings, solicitudes, tareas y leads) para
-- contar y mostrar unas cuantas filas. Con muchas órdenes eran decenas de
-- peticiones en bloques de 1000 filas cada vez que alguien abría el panel.
--
-- `get_dashboard_snapshot` devuelve en una sola llamada todo lo que el tablero
-- no obtiene de `get_sales_kpis`:
--
--   · counts          Contactos, productos y proyectos activos (y avance medio).
--   · currencies      Monedas usadas en órdenes (selector de moneda).
--   · drafts          Ventas y compras en borrador por moneda.
--   · posted_daily    Órdenes confirmadas por día y moneda en el periodo y en
--                     el periodo de comparación (modo sin base de caja).
--   · attention       Conteos de «Requiere atención» al día de hoy.
--   · crm             Leads del periodo y embudo abierto por moneda.
--   · recent          Últimas filas de cada vista para «Actividad reciente».
--   · public_projects Proyectos compartidos públicamente.
--
-- SECURITY INVOKER a propósito: consulta las mismas tablas y vistas
-- (`security_invoker = true`) que antes consultaba el navegador, con el mismo
-- rol y las mismas políticas RLS. Los números coinciden por construcción y no
-- se expone nada nuevo a un `member`.
--
-- Las fechas se agrupan en la zona horaria del navegador (`p_tz`) y «hoy» lo
-- define quien llama (`p_today`), igual que el cálculo anterior en el cliente.
-- Sin tablas nuevas: solo una función de lectura.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_snapshot(
    p_company_id   UUID,
    p_from         DATE,
    p_to           DATE,
    p_compare_from DATE DEFAULT NULL,
    p_compare_to   DATE DEFAULT NULL,
    p_today        DATE DEFAULT CURRENT_DATE,
    p_tz           TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_tz        TEXT := COALESCE(NULLIF(TRIM(p_tz), ''), 'UTC');
    v_today     DATE := COALESCE(p_today, CURRENT_DATE);
    v_currency  TEXT;
    v_result    JSONB;
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'No tienes acceso a esta empresa';
    END IF;

    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        RAISE EXCEPTION 'Periodo inválido';
    END IF;

    -- Zona horaria desconocida → UTC, en lugar de fallar todo el tablero.
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_tz) THEN
        v_tz := 'UTC';
    END IF;

    SELECT COALESCE(NULLIF(UPPER(TRIM(c.currency)), ''), 'MXN') INTO v_currency
    FROM public.company c WHERE c.id = p_company_id;
    v_currency := COALESCE(v_currency, 'MXN');

    WITH
    orders AS (
        SELECT
            o.order_type,
            o.order_state,
            o.order_date,
            COALESCE(NULLIF(UPPER(TRIM(o.currency)), ''), v_currency) AS currency,
            COALESCE(o.amount_total, 0) AS amount
        FROM public.v_orders o
        WHERE o.company_id = p_company_id
    ),
    partners AS (
        SELECT p.*
        FROM public.partner p
        WHERE p.id IN (
            SELECT r.partner_id
            FROM public.rel_partner_company r
            WHERE r.company_id = p_company_id
              AND r.relationship_type = 'partner'
              AND r.is_active = true
        )
    ),
    projects AS (
        SELECT * FROM public.v_projects
        WHERE company_id = p_company_id AND active = true
    ),
    tasks AS (
        SELECT * FROM public.v_project_tasks
        WHERE company_id = p_company_id AND active = true
    ),
    leads AS (
        SELECT
            l.*,
            COALESCE(NULLIF(UPPER(TRIM(l.currency)), ''), v_currency) AS norm_currency,
            COALESCE(
                l.actual_close_date,
                (l.stage_changed_at AT TIME ZONE v_tz)::DATE,
                (l.updated_at AT TIME ZONE v_tz)::DATE
            ) AS close_day,
            (l.created_at AT TIME ZONE v_tz)::DATE AS created_day,
            NOT COALESCE(l.is_won, false) AND NOT COALESCE(l.is_lost, false) AS is_open
        FROM public.v_crm_leads l
        WHERE l.company_id = p_company_id AND l.active = true
    ),
    overdue_tasks AS (
        SELECT * FROM tasks
        WHERE due_date < v_today AND status IN ('pending', 'in_progress')
    )
    SELECT jsonb_build_object(
        'company_currency', v_currency,

        'currencies', COALESCE(
            (SELECT jsonb_agg(DISTINCT currency ORDER BY currency) FROM orders),
            '[]'::jsonb
        ),

        'counts', jsonb_build_object(
            'active_partners', (SELECT COUNT(*) FROM partners WHERE active IS DISTINCT FROM false),
            'active_products', (SELECT COUNT(*) FROM public.product
                                WHERE company_id = p_company_id AND status = 'active'),
            'active_projects', (SELECT COUNT(*) FROM projects WHERE status = 'in_progress'),
            'average_project_progress', COALESCE(
                (SELECT ROUND(AVG(COALESCE(progress, 0))) FROM projects WHERE status = 'in_progress'),
                0
            )
        ),

        'drafts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'currency', d.currency,
                'sale_amount', d.sale_amount,
                'sale_count', d.sale_count,
                'purchase_amount', d.purchase_amount,
                'purchase_count', d.purchase_count
            ) ORDER BY d.currency)
            FROM (
                SELECT
                    currency,
                    COALESCE(SUM(amount) FILTER (WHERE order_type = 'sale'), 0)     AS sale_amount,
                    COUNT(*) FILTER (WHERE order_type = 'sale')                     AS sale_count,
                    COALESCE(SUM(amount) FILTER (WHERE order_type = 'purchase'), 0) AS purchase_amount,
                    COUNT(*) FILTER (WHERE order_type = 'purchase')                 AS purchase_count
                FROM orders
                WHERE order_state = 'draft'
                GROUP BY currency
            ) d
        ), '[]'::jsonb),

        'posted_daily', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'day', d.order_date,
                'currency', d.currency,
                'sale_amount', d.sale_amount,
                'sale_count', d.sale_count,
                'purchase_amount', d.purchase_amount,
                'purchase_count', d.purchase_count
            ) ORDER BY d.order_date, d.currency)
            FROM (
                SELECT
                    order_date,
                    currency,
                    COALESCE(SUM(amount) FILTER (WHERE order_type = 'sale'), 0)     AS sale_amount,
                    COUNT(*) FILTER (WHERE order_type = 'sale')                     AS sale_count,
                    COALESCE(SUM(amount) FILTER (WHERE order_type = 'purchase'), 0) AS purchase_amount,
                    COUNT(*) FILTER (WHERE order_type = 'purchase')                 AS purchase_count
                FROM orders
                WHERE order_state = 'posted'
                  AND order_type IN ('sale', 'purchase')
                  AND (
                      order_date BETWEEN p_from AND p_to
                      OR (p_compare_from IS NOT NULL AND p_compare_to IS NOT NULL
                          AND order_date BETWEEN p_compare_from AND p_compare_to)
                  )
                GROUP BY order_date, currency
            ) d
        ), '[]'::jsonb),

        'attention', jsonb_build_object(
            'overdue_tasks', (SELECT COUNT(*) FROM overdue_tasks),
            'oldest_overdue_task', (
                SELECT COALESCE(NULLIF(TRIM(name), ''), code, 'Tarea')
                FROM overdue_tasks
                ORDER BY due_date ASC, created_at DESC
                LIMIT 1
            ),
            'pending_approvals', (
                SELECT COUNT(*) FROM public.v_approval_requests
                WHERE company_id = p_company_id AND status = 'published'
            ),
            'crm_overdue_activities', (
                SELECT COALESCE(SUM(COALESCE(overdue_activity_count, 0)), 0) FROM leads WHERE is_open
            ),
            'crm_leads_with_overdue', (
                SELECT COUNT(*) FROM leads WHERE is_open AND COALESCE(overdue_activity_count, 0) > 0
            ),
            'crm_rotting_leads', (
                SELECT COUNT(*) FROM leads WHERE is_open AND is_rotting = true
            ),
            'open_pickings', (
                SELECT COUNT(*) FROM public.v_pickings
                WHERE company_id = p_company_id AND status IN ('borrador', 'publicado')
            )
        ),

        'crm', jsonb_build_object(
            'created', (SELECT COUNT(*) FROM leads WHERE created_day BETWEEN p_from AND p_to),
            'won', (SELECT COUNT(*) FROM leads
                    WHERE COALESCE(is_won, false) AND close_day BETWEEN p_from AND p_to),
            'lost', (SELECT COUNT(*) FROM leads
                     WHERE NOT COALESCE(is_won, false) AND COALESCE(is_lost, false)
                       AND close_day BETWEEN p_from AND p_to),
            'open_count', (SELECT COUNT(*) FROM leads WHERE is_open),
            'by_currency', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'currency', c.norm_currency,
                    'won_amount', c.won_amount,
                    'open_amount', c.open_amount,
                    'weighted_amount', c.weighted_amount
                ) ORDER BY c.norm_currency)
                FROM (
                    SELECT
                        norm_currency,
                        COALESCE(SUM(COALESCE(won_amount, amount, 0)) FILTER (
                            WHERE COALESCE(is_won, false) AND close_day BETWEEN p_from AND p_to
                        ), 0) AS won_amount,
                        COALESCE(SUM(COALESCE(amount, 0)) FILTER (WHERE is_open), 0) AS open_amount,
                        COALESCE(SUM(
                            COALESCE(amount, 0) * COALESCE(probability, stage_probability, 0) / 100.0
                        ) FILTER (WHERE is_open), 0) AS weighted_amount
                    FROM leads
                    GROUP BY norm_currency
                ) c
            ), '[]'::jsonb)
        ),

        'recent', jsonb_build_object(
            'orders', COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
                FROM (SELECT * FROM public.v_orders WHERE company_id = p_company_id
                      ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 6) x
            ), '[]'::jsonb),
            'pickings', COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
                FROM (SELECT * FROM public.v_pickings WHERE company_id = p_company_id
                      ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 4) x
            ), '[]'::jsonb),
            'approvals', COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
                FROM (SELECT * FROM public.v_approval_requests WHERE company_id = p_company_id
                      ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 4) x
            ), '[]'::jsonb),
            'projects', COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
                FROM (SELECT * FROM projects ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 4) x
            ), '[]'::jsonb),
            'tasks', COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
                FROM (SELECT * FROM tasks ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 4) x
            ), '[]'::jsonb),
            'leads', COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
                FROM (SELECT * FROM public.v_crm_leads WHERE company_id = p_company_id AND active = true
                      ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 4) x
            ), '[]'::jsonb),
            'partners', COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
                FROM (SELECT * FROM partners ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 3) x
            ), '[]'::jsonb)
        ),

        'public_projects', COALESCE((
            SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC NULLS LAST)
            FROM (SELECT * FROM projects WHERE is_public = true
                  ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 4) x
        ), '[]'::jsonb)
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_snapshot(UUID, DATE, DATE, DATE, DATE, DATE, TEXT) IS
    'Foto agregada del tablero principal (TRY-33): conteos, borradores, atención, CRM, actividad reciente. SECURITY INVOKER: respeta RLS.';

REVOKE ALL ON FUNCTION public.get_dashboard_snapshot(UUID, DATE, DATE, DATE, DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_snapshot(UUID, DATE, DATE, DATE, DATE, DATE, TEXT) TO authenticated;
