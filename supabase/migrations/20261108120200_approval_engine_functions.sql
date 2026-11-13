-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  Aprobaciones: funciones del motor (TRY-18)                              ║
-- ║                                                                          ║
-- ║  1. Ajustes, membresía y elegibilidad de aprobadores                     ║
-- ║  2. Bitácora (hash encadenado, solo inserción) y avisos (actividades)    ║
-- ║  3. Reglas: contexto, condiciones, días hábiles                          ║
-- ║  4. Resolución del plan (la usan envío, vista previa y simulador)        ║
-- ║  5. Ejecución: activar niveles, evaluar, finalizar                       ║
-- ║  6. RPC de acciones (enviar, decidir, devolver, revocar, reasignar…)     ║
-- ║                                                                          ║
-- ║  Reglas de elegibilidad (decisión del dueño, TRY-18):                    ║
-- ║   - Aprueban los aprobadores registrados activos y los owners.           ║
-- ║   - Un aprobador sin categorías no autoriza ninguna.                     ║
-- ║   - Si no se puede resolver un aprobador, pasa a los owners.             ║
-- ║                                                                          ║
-- ║  Las columnas de estado de approval_request solo cambian con             ║
-- ║  `approval.engine = on` (trigger guard en la migración siguiente).       ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Ajustes, membresía y elegibilidad
-- ════════════════════════════════════════════════════════════════════════════

-- Devuelve los ajustes de la empresa, creando la fila con valores por defecto.
CREATE OR REPLACE FUNCTION public.approval_get_settings(p_company_id UUID)
RETURNS public.approval_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings public.approval_settings;
BEGIN
    INSERT INTO public.approval_settings (company_id)
    VALUES (p_company_id)
    ON CONFLICT (company_id) DO NOTHING;

    SELECT * INTO v_settings FROM public.approval_settings WHERE company_id = p_company_id;
    RETURN v_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_partner_name(p_partner_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(NULLIF(trim(p.display_name), ''), NULLIF(trim(p.name), ''), p.email, p.id::TEXT)
    FROM public.partner p
    WHERE p.id = p_partner_id
      -- Llamada desde el panel: solo nombres de contactos de las empresas del usuario
      AND (
          auth.uid() IS NULL
          OR p.user_id = auth.uid()
          OR public.partner_shares_company_with_user(p.id)
          OR EXISTS (SELECT 1 FROM public.employee e
                     WHERE e.partner_id = p.id AND public.user_belongs_to_company(e.company_id))
      );
$$;

CREATE OR REPLACE FUNCTION public.approval_is_owner(p_company_id UUID, p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.rel_partner_company r
        JOIN public.partner p ON p.id = r.partner_id
        WHERE r.company_id = p_company_id
          AND r.partner_id = p_partner_id
          AND r.role = 'owner'
          AND r.invitation_status = 'accepted'
          AND r.is_active = true
          AND p.user_id IS NOT NULL
    );
$$;

-- Owners activos con usuario, en orden estable.
CREATE OR REPLACE FUNCTION public.approval_owner_partners(p_company_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.partner_id
    FROM public.rel_partner_company r
    JOIN public.partner p ON p.id = r.partner_id
    WHERE r.company_id = p_company_id
      AND r.role = 'owner'
      AND r.invitation_status = 'accepted'
      AND r.is_active = true
      AND p.user_id IS NOT NULL
    ORDER BY r.created_at NULLS LAST, r.partner_id;
$$;

-- Aprobador registrado activo con usuario. Con categoría, además debe autorizarla.
CREATE OR REPLACE FUNCTION public.approval_is_registered(
    p_company_id UUID,
    p_partner_id UUID,
    p_category_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.approval_manager am
        JOIN public.partner p ON p.id = am.partner_id
        WHERE am.company_id = p_company_id
          AND am.partner_id = p_partner_id
          AND am.active = true
          AND p.user_id IS NOT NULL
          AND (
              p_category_id IS NULL
              OR EXISTS (
                  SELECT 1 FROM public.approval_manager_category amc
                  WHERE amc.approval_manager_id = am.id
                    AND amc.approval_category_id = p_category_id
              )
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.approval_is_eligible(
    p_company_id UUID,
    p_partner_id UUID,
    p_category_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_partner_id IS NOT NULL AND (
        public.approval_is_owner(p_company_id, p_partner_id)
        OR public.approval_is_registered(p_company_id, p_partner_id, p_category_id)
    );
$$;

-- Límite de autorización. NULL = sin límite (owners y aprobadores sin tope).
CREATE OR REPLACE FUNCTION public.approval_amount_limit(
    p_company_id UUID,
    p_partner_id UUID,
    p_category_id UUID
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN public.approval_is_owner(p_company_id, p_partner_id) THEN NULL
        ELSE (
            SELECT COALESCE(amc.max_amount, am.max_amount)
            FROM public.approval_manager am
            LEFT JOIN public.approval_manager_category amc
              ON amc.approval_manager_id = am.id AND amc.approval_category_id = p_category_id
            WHERE am.company_id = p_company_id AND am.partner_id = p_partner_id AND am.active = true
            LIMIT 1
        )
    END;
$$;

CREATE OR REPLACE FUNCTION public.approval_covers_amount(
    p_company_id UUID,
    p_partner_id UUID,
    p_category_id UUID,
    p_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit NUMERIC := public.approval_amount_limit(p_company_id, p_partner_id, p_category_id);
BEGIN
    RETURN p_amount IS NULL OR v_limit IS NULL OR p_amount <= v_limit;
END;
$$;

-- Jefe directo (partner) según RR. HH.
CREATE OR REPLACE FUNCTION public.approval_manager_of(p_company_id UUID, p_partner_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT m.partner_id
    FROM public.employee e
    JOIN public.employee m ON m.id = e.manager_id AND m.company_id = e.company_id
    WHERE e.company_id = p_company_id
      AND e.partner_id = p_partner_id
      AND e.active IS TRUE
      AND m.active IS TRUE
    LIMIT 1;
$$;

-- Responsable del departamento del solicitante.
CREATE OR REPLACE FUNCTION public.approval_department_manager_of(p_company_id UUID, p_partner_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT m.partner_id
    FROM public.employee e
    JOIN public.employee_department d ON d.id = e.department_id AND d.company_id = e.company_id
    JOIN public.employee m ON m.id = d.manager_id AND m.company_id = e.company_id
    WHERE e.company_id = p_company_id
      AND e.partner_id = p_partner_id
      AND e.active IS TRUE
      AND m.active IS TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.approval_department_of(p_company_id UUID, p_partner_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.department_id
    FROM public.employee e
    WHERE e.company_id = p_company_id AND e.partner_id = p_partner_id AND e.active IS TRUE
    LIMIT 1;
$$;

-- Sube por la cadena de jefes hasta encontrar a alguien elegible que cubra el monto.
CREATE OR REPLACE FUNCTION public.approval_escalate_for_amount(
    p_company_id UUID,
    p_from_partner_id UUID,
    p_category_id UUID,
    p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current UUID := p_from_partner_id;
    v_seen    UUID[] := ARRAY[p_from_partner_id];
    v_i       INTEGER := 0;
BEGIN
    LOOP
        v_i := v_i + 1;
        EXIT WHEN v_i > 15;
        v_current := public.approval_manager_of(p_company_id, v_current);
        EXIT WHEN v_current IS NULL OR v_current = ANY (v_seen);
        v_seen := v_seen || v_current;
        IF public.approval_is_eligible(p_company_id, v_current, NULL)
           AND public.approval_covers_amount(p_company_id, v_current, p_category_id, p_amount) THEN
            RETURN v_current;
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;

-- Delegado vigente (sigue la cadena, sin ciclos). Devuelve el mismo partner si no hay.
CREATE OR REPLACE FUNCTION public.approval_delegate_of(
    p_company_id UUID,
    p_partner_id UUID,
    p_category_id UUID,
    p_on DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current UUID := p_partner_id;
    v_next    UUID;
    v_seen    UUID[] := ARRAY[p_partner_id];
    v_i       INTEGER := 0;
BEGIN
    LOOP
        v_i := v_i + 1;
        EXIT WHEN v_i > 5;
        SELECT d.to_partner_id INTO v_next
        FROM public.approval_delegation d
        WHERE d.company_id = p_company_id
          AND d.from_partner_id = v_current
          AND d.active = true
          AND (d.category_id IS NULL OR d.category_id = p_category_id)
          AND (d.starts_on IS NULL OR d.starts_on <= p_on)
          AND (d.ends_on IS NULL OR d.ends_on >= p_on)
        ORDER BY (d.category_id IS NULL), d.created_at DESC
        LIMIT 1;

        EXIT WHEN v_next IS NULL OR v_next = ANY (v_seen);
        EXIT WHEN NOT public.approval_is_eligible(p_company_id, v_next, NULL);
        v_seen := v_seen || v_next;
        v_current := v_next;
        v_next := NULL;
    END LOOP;
    RETURN v_current;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Bitácora y avisos
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_event_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev_seq  INTEGER;
    v_prev_hash VARCHAR(64);
BEGIN
    SELECT e.seq, e.hash INTO v_prev_seq, v_prev_hash
    FROM public.approval_request_event e
    WHERE e.request_id = NEW.request_id
    ORDER BY e.seq DESC
    LIMIT 1;

    NEW.seq := COALESCE(v_prev_seq, 0) + 1;
    NEW.prev_hash := v_prev_hash;
    NEW.created_at := COALESCE(NEW.created_at, clock_timestamp());
    NEW.hash := encode(sha256(convert_to(
        COALESCE(v_prev_hash, '') || '|' || NEW.request_id::TEXT || '|' || NEW.seq::TEXT || '|'
        || NEW.event_type || '|' || COALESCE(NEW.actor_user_id::TEXT, '') || '|'
        || NEW.payload::TEXT || '|' || to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        'UTF8'
    )), 'hex');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_event_before_insert ON public.approval_request_event;
CREATE TRIGGER trigger_approval_event_before_insert
    BEFORE INSERT ON public.approval_request_event
    FOR EACH ROW EXECUTE FUNCTION public.approval_event_before_insert();

-- Solo inserción. El borrado solo procede en cascada (la solicitud ya no existe).
CREATE OR REPLACE FUNCTION public.approval_event_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM public.approval_request r WHERE r.id = OLD.request_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'La bitácora de aprobaciones no se puede modificar' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trigger_approval_event_immutable ON public.approval_request_event;
CREATE TRIGGER trigger_approval_event_immutable
    BEFORE UPDATE OR DELETE ON public.approval_request_event
    FOR EACH ROW EXECUTE FUNCTION public.approval_event_immutable();

CREATE OR REPLACE FUNCTION public.approval_log(
    p_request_id UUID,
    p_event_type TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_automatic BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
    v_headers JSON;
BEGIN
    SELECT company_id INTO v_company FROM public.approval_request WHERE id = p_request_id;
    IF v_company IS NULL THEN
        RETURN;
    END IF;

    BEGIN
        v_headers := NULLIF(current_setting('request.headers', true), '')::JSON;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    INSERT INTO public.approval_request_event (
        company_id, request_id, seq, event_type, actor_user_id, actor_partner_id,
        automatic, payload, ip, user_agent, hash
    ) VALUES (
        v_company, p_request_id, 0, p_event_type, auth.uid(),
        CASE WHEN p_automatic THEN NULL ELSE public.current_user_partner_row_id() END,
        p_automatic, COALESCE(p_payload, '{}'::jsonb),
        left(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1), 80),
        left(v_headers ->> 'user-agent', 400),
        ''
    );
END;
$$;

-- Recalcula la cadena y devuelve el primer evento alterado, si lo hay.
CREATE OR REPLACE FUNCTION public.approval_verify_event_chain(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event     RECORD;
    v_prev_hash VARCHAR(64) := NULL;
    v_expected  VARCHAR(64);
    v_count     INTEGER := 0;
BEGIN
    IF NOT public.approval_can_view(p_request_id) THEN
        RAISE EXCEPTION 'Sin acceso a la solicitud' USING ERRCODE = '42501';
    END IF;

    FOR v_event IN
        SELECT * FROM public.approval_request_event WHERE request_id = p_request_id ORDER BY seq
    LOOP
        v_count := v_count + 1;
        v_expected := encode(sha256(convert_to(
            COALESCE(v_prev_hash, '') || '|' || v_event.request_id::TEXT || '|' || v_event.seq::TEXT || '|'
            || v_event.event_type || '|' || COALESCE(v_event.actor_user_id::TEXT, '') || '|'
            || v_event.payload::TEXT || '|' || to_char(v_event.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
            'UTF8'
        )), 'hex');
        IF v_expected <> v_event.hash OR v_event.prev_hash IS DISTINCT FROM v_prev_hash THEN
            RETURN jsonb_build_object('ok', false, 'events', v_count, 'broken_at_seq', v_event.seq);
        END IF;
        v_prev_hash := v_event.hash;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'events', v_count, 'last_hash', v_prev_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_notify(
    p_request_id UUID,
    p_partner_id UUID,
    p_kind TEXT,
    p_title TEXT,
    p_actionable BOOLEAN DEFAULT false,
    p_scheduled_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
BEGIN
    IF p_partner_id IS NULL THEN
        RETURN;
    END IF;
    SELECT company_id INTO v_company FROM public.approval_request WHERE id = p_request_id;
    IF v_company IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.approval_activity (company_id, partner_id, request_id, kind, title, scheduled_at, actionable)
    VALUES (v_company, p_partner_id, p_request_id, p_kind, left(p_title, 255), COALESCE(p_scheduled_at, now()), p_actionable);
END;
$$;

-- Cierra los avisos de acción pendientes (de una persona o de todas).
CREATE OR REPLACE FUNCTION public.approval_close_actions(p_request_id UUID, p_partner_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.approval_activity
    SET done_at = now(), read_at = COALESCE(read_at, now())
    WHERE request_id = p_request_id
      AND actionable = true
      AND done_at IS NULL
      AND (p_partner_id IS NULL OR partner_id = p_partner_id);
$$;

-- Texto corto para títulos de avisos: «#12 · Compra de laptops»
CREATE OR REPLACE FUNCTION public.approval_request_label(p_request_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT '#' || r.request_number::TEXT || ' · ' || COALESCE(NULLIF(trim(r.title), ''), 'Solicitud')
    FROM public.approval_request r WHERE r.id = p_request_id;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Reglas
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_try_numeric(p_value TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_value IS NULL OR trim(p_value) = '' THEN
        RETURN NULL;
    END IF;
    RETURN trim(p_value)::NUMERIC;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Contexto con que se evalúan las condiciones de un flujo.
CREATE OR REPLACE FUNCTION public.approval_build_context(
    p_company_id UUID,
    p_category_id UUID,
    p_requester_partner_id UUID,
    p_amount NUMERIC,
    p_priority TEXT,
    p_field_values JSONB,
    p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lines_total NUMERIC;
    v_line_count  INTEGER := 0;
    v_products    JSONB := '[]'::jsonb;
BEGIN
    IF p_request_id IS NOT NULL THEN
        SELECT COALESCE(sum(subtotal), 0), count(*),
               COALESCE(jsonb_agg(DISTINCT product_id) FILTER (WHERE product_id IS NOT NULL), '[]'::jsonb)
        INTO v_lines_total, v_line_count, v_products
        FROM public.approval_request_line
        WHERE request_id = p_request_id AND active = true;
    END IF;

    RETURN jsonb_build_object(
        'amount', p_amount,
        'priority', COALESCE(p_priority, 'normal'),
        'category_id', p_category_id,
        'requester_partner_id', p_requester_partner_id,
        'department_id', public.approval_department_of(p_company_id, p_requester_partner_id),
        'fields', COALESCE(p_field_values, '{}'::jsonb),
        'lines_total', v_lines_total,
        'line_count', v_line_count,
        'product_ids', v_products
    );
END;
$$;

-- Una regla: {"field": "amount" | "priority" | "department_id" | "requester_partner_id"
--             | "lines_total" | "line_count" | "product_ids" | "field.<clave>",
--             "op": eq|neq|gt|gte|lt|lte|between|in|not_in|contains|empty|not_empty,
--             "value": ...}
CREATE OR REPLACE FUNCTION public.approval_eval_rule(p_rule JSONB, p_ctx JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_field  TEXT := p_rule ->> 'field';
    v_op     TEXT := COALESCE(p_rule ->> 'op', 'eq');
    v_value  JSONB := p_rule -> 'value';
    v_actual JSONB;
    v_text   TEXT;
    v_num    NUMERIC;
    v_empty  BOOLEAN;
BEGIN
    IF v_field IS NULL THEN
        RETURN true;
    END IF;

    IF v_field LIKE 'field.%' THEN
        v_actual := p_ctx -> 'fields' -> substr(v_field, 7);
    ELSE
        v_actual := p_ctx -> v_field;
    END IF;

    v_text := CASE WHEN v_actual IS NULL OR jsonb_typeof(v_actual) = 'null' THEN NULL
                   WHEN jsonb_typeof(v_actual) IN ('array', 'object') THEN v_actual::TEXT
                   ELSE v_actual #>> '{}' END;
    v_empty := v_text IS NULL OR trim(v_text) = '' OR v_text = '[]' OR v_text = '{}';
    v_num := public.approval_try_numeric(v_text);

    CASE v_op
        WHEN 'empty' THEN RETURN v_empty;
        WHEN 'not_empty' THEN RETURN NOT v_empty;
        WHEN 'eq' THEN
            IF v_num IS NOT NULL AND public.approval_try_numeric(v_value #>> '{}') IS NOT NULL THEN
                RETURN v_num = public.approval_try_numeric(v_value #>> '{}');
            END IF;
            RETURN lower(COALESCE(v_text, '')) = lower(COALESCE(v_value #>> '{}', ''));
        WHEN 'neq' THEN
            IF v_num IS NOT NULL AND public.approval_try_numeric(v_value #>> '{}') IS NOT NULL THEN
                RETURN v_num <> public.approval_try_numeric(v_value #>> '{}');
            END IF;
            RETURN lower(COALESCE(v_text, '')) <> lower(COALESCE(v_value #>> '{}', ''));
        WHEN 'gt' THEN RETURN v_num IS NOT NULL AND v_num > public.approval_try_numeric(v_value #>> '{}');
        WHEN 'gte' THEN RETURN v_num IS NOT NULL AND v_num >= public.approval_try_numeric(v_value #>> '{}');
        WHEN 'lt' THEN RETURN v_num IS NOT NULL AND v_num < public.approval_try_numeric(v_value #>> '{}');
        WHEN 'lte' THEN RETURN v_num IS NOT NULL AND v_num <= public.approval_try_numeric(v_value #>> '{}');
        WHEN 'between' THEN
            RETURN v_num IS NOT NULL
               AND v_num >= COALESCE(public.approval_try_numeric(v_value ->> 0), v_num)
               AND v_num <= COALESCE(public.approval_try_numeric(v_value ->> 1), v_num);
        WHEN 'in', 'not_in' THEN
            IF jsonb_typeof(v_value) <> 'array' THEN
                RETURN v_op = 'not_in';
            END IF;
            IF EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(v_value) x
                WHERE lower(x) = lower(COALESCE(v_text, ''))
            ) THEN
                RETURN v_op = 'in';
            END IF;
            RETURN v_op = 'not_in';
        WHEN 'contains' THEN
            IF jsonb_typeof(v_actual) = 'array' THEN
                RETURN EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(v_actual) x
                    WHERE lower(x) = lower(COALESCE(v_value #>> '{}', ''))
                );
            END IF;
            RETURN v_text IS NOT NULL AND position(lower(COALESCE(v_value #>> '{}', '')) IN lower(v_text)) > 0;
        ELSE
            RETURN false;
    END CASE;
END;
$$;

-- Condición de un nivel: {"match": "all" | "any", "rules": [...]}. NULL = siempre.
CREATE OR REPLACE FUNCTION public.approval_eval_condition(p_condition JSONB, p_ctx JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_rules JSONB;
    v_rule  JSONB;
    v_any   BOOLEAN;
    v_hit   BOOLEAN;
BEGIN
    IF p_condition IS NULL OR jsonb_typeof(p_condition) <> 'object' THEN
        RETURN true;
    END IF;
    v_rules := p_condition -> 'rules';
    IF v_rules IS NULL OR jsonb_typeof(v_rules) <> 'array' OR jsonb_array_length(v_rules) = 0 THEN
        RETURN true;
    END IF;
    v_any := COALESCE(p_condition ->> 'match', 'all') = 'any';

    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules) LOOP
        v_hit := public.approval_eval_rule(v_rule, p_ctx);
        IF v_any AND v_hit THEN
            RETURN true;
        END IF;
        IF NOT v_any AND NOT v_hit THEN
            RETURN false;
        END IF;
    END LOOP;
    RETURN NOT v_any;
END;
$$;

-- Suma días hábiles: sin sábados, domingos ni días festivos de la empresa (hr_holiday).
CREATE OR REPLACE FUNCTION public.approval_add_business_days(
    p_company_id UUID,
    p_from TIMESTAMPTZ,
    p_days INTEGER
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day   DATE := (p_from AT TIME ZONE 'America/Mexico_City')::DATE;
    v_count INTEGER := 0;
    v_guard INTEGER := 0;
BEGIN
    IF p_days IS NULL OR p_days <= 0 THEN
        RETURN NULL;
    END IF;
    WHILE v_count < p_days AND v_guard < 400 LOOP
        v_guard := v_guard + 1;
        v_day := v_day + 1;
        IF EXTRACT(ISODOW FROM v_day) < 6 AND NOT EXISTS (
            SELECT 1 FROM public.hr_holiday h
            WHERE h.company_id = p_company_id AND h.holiday_date = v_day AND h.active IS TRUE
        ) THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    -- Vence al final del día hábil, hora de la Ciudad de México
    RETURN ((v_day + 1)::TIMESTAMP AT TIME ZONE 'America/Mexico_City') - INTERVAL '1 second';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Resolución del plan
--
-- Devuelve un arreglo de niveles:
--   [{sequence, name, mode, quorum, informative, sla_days, flow_step_id,
--     skipped, note, approvers: [{partner_id, resolved_via, delegated_from}]}]
-- La usan el envío, la vista previa y el simulador: nunca muestran algo
-- distinto de lo que pasará.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_resolve_plan(
    p_company_id UUID,
    p_category_id UUID,
    p_requester_partner_id UUID,
    p_assigned_manager_id UUID,
    p_ctx JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings     public.approval_settings;
    v_category     public.approval_category;
    v_flow         public.approval_flow;
    v_amount       NUMERIC := public.approval_try_numeric(p_ctx ->> 'amount');
    v_steps        JSONB := '[]'::jsonb;
    v_step         RECORD;
    v_rule         RECORD;
    v_approvers    JSONB;
    v_partner      UUID;
    v_via          TEXT;
    v_owner        UUID;
    v_chain        UUID;
    v_seen         UUID[];
    v_i            INTEGER;
    v_result       JSONB := '[]'::jsonb;
    v_item         JSONB;
    v_list         JSONB;
    v_clean        JSONB;
    v_entry        JSONB;
    v_prev_people  UUID[] := ARRAY[]::UUID[];
    v_step_people  UUID[];
    v_delegate     UUID;
    v_prevent_self BOOLEAN;
    v_mode         TEXT;
BEGIN
    SELECT * INTO v_settings FROM public.approval_settings WHERE company_id = p_company_id;
    IF NOT FOUND THEN
        v_settings.prevent_self_approval := true;
        v_settings.self_approval_fallback := 'next_level';
        v_settings.dedupe_consecutive := true;
        v_settings.advanced_enabled := false;
    END IF;
    SELECT * INTO v_category FROM public.approval_category WHERE id = p_category_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Categoría inválida o inexistente';
    END IF;
    IF v_category.flow_id IS NOT NULL THEN
        SELECT * INTO v_flow FROM public.approval_flow WHERE id = v_category.flow_id AND active = true;
    END IF;

    -- El modo simple respeta lo que el solicitante eligió (comportamiento previo).
    -- La regla «no aprobar lo propio» aplica cuando la empresa usa funciones avanzadas.
    v_prevent_self := v_settings.advanced_enabled AND v_settings.prevent_self_approval;

    IF v_flow.id IS NULL THEN
        -- ── Modo simple ──
        v_approvers := '[]'::jsonb;
        IF p_assigned_manager_id IS NOT NULL THEN
            SELECT am.partner_id INTO v_partner
            FROM public.approval_manager am
            WHERE am.id = p_assigned_manager_id AND am.company_id = p_company_id AND am.active = true;
            IF v_partner IS NOT NULL
               AND (public.approval_is_registered(p_company_id, v_partner, p_category_id)
                    OR public.approval_is_owner(p_company_id, v_partner)) THEN
                v_approvers := jsonb_build_array(jsonb_build_object('partner_id', v_partner, 'resolved_via', 'manager'));
            END IF;
        ELSE
            -- Sin aprobador elegido (documentos de otros módulos): jefe directo, si no, owners.
            v_partner := public.approval_manager_of(p_company_id, p_requester_partner_id);
            IF public.approval_is_eligible(p_company_id, v_partner, NULL) THEN
                v_approvers := jsonb_build_array(jsonb_build_object('partner_id', v_partner, 'resolved_via', 'direct_manager'));
            END IF;
        END IF;
        v_steps := jsonb_build_array(jsonb_build_object(
            'sequence', 1, 'name', 'Aprobación', 'mode', 'any', 'quorum', NULL,
            'informative', false, 'sla_days', v_category.sla_days, 'flow_step_id', NULL,
            'approvers', v_approvers
        ));
    ELSE
        -- ── Flujo multinivel ──
        FOR v_step IN
            SELECT * FROM public.approval_flow_step
            WHERE flow_id = v_flow.id AND active = true
            ORDER BY sequence, created_at
        LOOP
            IF NOT public.approval_eval_condition(v_step.condition, p_ctx) THEN
                CONTINUE;
            END IF;

            v_approvers := '[]'::jsonb;
            v_mode := v_step.mode;

            FOR v_rule IN
                SELECT * FROM public.approval_flow_step_approver
                WHERE step_id = v_step.id AND active = true
                ORDER BY created_at
            LOOP
                IF v_rule.kind = 'manager' THEN
                    SELECT am.partner_id INTO v_partner
                    FROM public.approval_manager am
                    JOIN public.partner p ON p.id = am.partner_id
                    WHERE am.id = v_rule.approval_manager_id AND am.active = true AND p.user_id IS NOT NULL;
                    IF v_partner IS NOT NULL THEN
                        IF NOT public.approval_covers_amount(p_company_id, v_partner, p_category_id, v_amount) THEN
                            v_chain := public.approval_escalate_for_amount(p_company_id, v_partner, p_category_id, v_amount);
                            v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                                'partner_id', v_chain, 'resolved_via', 'limit_escalation'));
                        ELSE
                            v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                                'partner_id', v_partner, 'resolved_via', 'manager'));
                        END IF;
                    END IF;
                ELSIF v_rule.kind = 'category_managers' THEN
                    FOR v_partner IN
                        SELECT am.partner_id
                        FROM public.approval_manager am
                        JOIN public.partner p ON p.id = am.partner_id
                        JOIN public.approval_manager_category amc
                          ON amc.approval_manager_id = am.id AND amc.approval_category_id = p_category_id
                        WHERE am.company_id = p_company_id AND am.active = true AND p.user_id IS NOT NULL
                          AND public.approval_covers_amount(p_company_id, am.partner_id, p_category_id, v_amount)
                        ORDER BY am.created_at
                    LOOP
                        v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                            'partner_id', v_partner, 'resolved_via', 'category_managers'));
                    END LOOP;
                ELSIF v_rule.kind = 'owners' THEN
                    FOR v_owner IN SELECT * FROM public.approval_owner_partners(p_company_id) LOOP
                        v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                            'partner_id', v_owner, 'resolved_via', 'owners'));
                    END LOOP;
                ELSIF v_rule.kind IN ('direct_manager', 'department_manager') THEN
                    v_partner := CASE v_rule.kind
                        WHEN 'direct_manager' THEN public.approval_manager_of(p_company_id, p_requester_partner_id)
                        ELSE public.approval_department_manager_of(p_company_id, p_requester_partner_id)
                    END;
                    IF public.approval_is_eligible(p_company_id, v_partner, NULL) THEN
                        IF public.approval_covers_amount(p_company_id, v_partner, p_category_id, v_amount) THEN
                            v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                                'partner_id', v_partner, 'resolved_via', v_rule.kind));
                        ELSE
                            v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                                'partner_id', public.approval_escalate_for_amount(p_company_id, v_partner, p_category_id, v_amount),
                                'resolved_via', 'limit_escalation'));
                        END IF;
                    END IF;
                ELSIF v_rule.kind = 'manager_chain' THEN
                    -- Jefe, jefe del jefe… hasta cubrir el monto. Todos aprueban, en orden.
                    v_partner := p_requester_partner_id;
                    v_seen := ARRAY[p_requester_partner_id];
                    v_i := 0;
                    LOOP
                        v_i := v_i + 1;
                        EXIT WHEN v_i > 15;
                        v_partner := public.approval_manager_of(p_company_id, v_partner);
                        EXIT WHEN v_partner IS NULL OR v_partner = ANY (v_seen);
                        v_seen := v_seen || v_partner;
                        IF public.approval_is_eligible(p_company_id, v_partner, NULL) THEN
                            v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                                'partner_id', v_partner, 'resolved_via', 'manager_chain'));
                            EXIT WHEN public.approval_covers_amount(p_company_id, v_partner, p_category_id, v_amount);
                        END IF;
                    END LOOP;
                    v_mode := 'all';
                END IF;
                v_partner := NULL;
            END LOOP;

            -- Quita vacíos (escalamientos sin resultado) antes de decidir el respaldo
            SELECT COALESCE(jsonb_agg(a), '[]'::jsonb) INTO v_approvers
            FROM jsonb_array_elements(v_approvers) a
            WHERE a ->> 'partner_id' IS NOT NULL;

            -- Nadie resuelto: pasa a los owners (decisión del dueño)
            IF jsonb_array_length(v_approvers) = 0 THEN
                FOR v_owner IN SELECT * FROM public.approval_owner_partners(p_company_id) LOOP
                    v_approvers := v_approvers || jsonb_build_array(jsonb_build_object(
                        'partner_id', v_owner, 'resolved_via', 'owners_fallback'));
                END LOOP;
            END IF;

            v_steps := v_steps || jsonb_build_array(jsonb_build_object(
                'sequence', v_step.sequence, 'name', v_step.name, 'mode', v_mode,
                'quorum', v_step.quorum, 'informative', v_step.informative,
                'sla_days', COALESCE(v_step.sla_days, v_category.sla_days),
                'flow_step_id', v_step.id, 'approvers', v_approvers
            ));
        END LOOP;

        -- Ninguna condición aplicó: los owners deciden (nunca se aprueba sin nadie).
        IF jsonb_array_length(v_steps) = 0 THEN
            v_steps := jsonb_build_array(jsonb_build_object(
                'sequence', 1, 'name', 'Aprobación', 'mode', 'any', 'quorum', NULL,
                'informative', false, 'sla_days', v_category.sla_days, 'flow_step_id', NULL,
                'approvers', '[]'::jsonb
            ));
        END IF;
    END IF;

    -- ── Post-proceso por nivel: respaldo, auto-aprobación, delegación, duplicados ──
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_steps) LOOP
        v_list := v_item -> 'approvers';

        IF jsonb_array_length(v_list) = 0 THEN
            FOR v_owner IN SELECT * FROM public.approval_owner_partners(p_company_id) LOOP
                v_list := v_list || jsonb_build_array(jsonb_build_object('partner_id', v_owner, 'resolved_via', 'owners_fallback'));
            END LOOP;
        END IF;

        v_clean := '[]'::jsonb;
        v_step_people := ARRAY[]::UUID[];
        FOR v_entry IN SELECT * FROM jsonb_array_elements(v_list) LOOP
            v_partner := (v_entry ->> 'partner_id')::UUID;
            CONTINUE WHEN v_partner IS NULL;

            -- Delegación vigente
            v_delegate := public.approval_delegate_of(p_company_id, v_partner, p_category_id, CURRENT_DATE);
            IF v_delegate IS DISTINCT FROM v_partner THEN
                v_entry := v_entry || jsonb_build_object('partner_id', v_delegate, 'delegated_from', v_partner);
                v_partner := v_delegate;
            END IF;

            CONTINUE WHEN v_prevent_self AND v_partner = p_requester_partner_id;
            CONTINUE WHEN v_partner = ANY (v_step_people);
            CONTINUE WHEN v_settings.dedupe_consecutive AND NOT (v_item ->> 'informative')::BOOLEAN
                          AND v_partner = ANY (v_prev_people);

            v_step_people := v_step_people || v_partner;
            v_clean := v_clean || jsonb_build_array(v_entry);
        END LOOP;

        IF jsonb_array_length(v_clean) = 0 THEN
            IF jsonb_array_length(v_list) > 0
               AND v_settings.dedupe_consecutive
               AND NOT EXISTS (
                   SELECT 1 FROM jsonb_array_elements(v_list) x
                   WHERE NOT ((x ->> 'partner_id')::UUID = ANY (v_prev_people))
                     AND NOT (v_prevent_self AND (x ->> 'partner_id')::UUID = p_requester_partner_id)
               )
               AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_list) x WHERE (x ->> 'partner_id')::UUID = ANY (v_prev_people)) THEN
                v_item := v_item || jsonb_build_object('skipped', true, 'note', 'Ya aprobó en un nivel anterior', 'approvers', v_list);
            ELSIF v_settings.self_approval_fallback = 'next_level' AND jsonb_array_length(v_steps) > 1 THEN
                v_item := v_item || jsonb_build_object('skipped', true, 'note', 'El solicitante no puede aprobar su propia solicitud', 'approvers', '[]'::jsonb);
            ELSE
                -- Owners distintos del solicitante; si solo existe él, decide él (empresa unipersonal).
                v_clean := '[]'::jsonb;
                FOR v_owner IN SELECT * FROM public.approval_owner_partners(p_company_id) LOOP
                    IF v_owner <> p_requester_partner_id OR NOT v_prevent_self THEN
                        v_clean := v_clean || jsonb_build_array(jsonb_build_object('partner_id', v_owner, 'resolved_via', 'owners_fallback'));
                    END IF;
                END LOOP;
                IF jsonb_array_length(v_clean) = 0 THEN
                    v_clean := jsonb_build_array(jsonb_build_object('partner_id', p_requester_partner_id, 'resolved_via', 'self_unavoidable'));
                END IF;
                v_item := v_item || jsonb_build_object('approvers', v_clean);
            END IF;
        ELSE
            v_item := v_item || jsonb_build_object('approvers', v_clean);
        END IF;

        -- Quórum mayor que la gente disponible: se ajusta al total
        IF v_item ->> 'mode' = 'quorum'
           AND (v_item ->> 'quorum')::INTEGER > jsonb_array_length(v_item -> 'approvers')
           AND jsonb_array_length(v_item -> 'approvers') > 0 THEN
            v_item := v_item || jsonb_build_object('quorum', jsonb_array_length(v_item -> 'approvers'));
        END IF;

        IF NOT COALESCE((v_item ->> 'informative')::BOOLEAN, false) AND NOT COALESCE((v_item ->> 'skipped')::BOOLEAN, false) THEN
            v_prev_people := ARRAY(
                SELECT (x ->> 'partner_id')::UUID FROM jsonb_array_elements(v_item -> 'approvers') x
            );
        END IF;

        v_result := v_result || jsonb_build_array(v_item);
    END LOOP;

    RETURN v_result;
END;
$$;

-- Agrega nombres al plan para mostrarlo en pantalla.
CREATE OR REPLACE FUNCTION public.approval_plan_with_names(p_plan JSONB)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(
        s || jsonb_build_object('approvers', (
            SELECT COALESCE(jsonb_agg(
                a || jsonb_build_object(
                    'name', public.approval_partner_name((a ->> 'partner_id')::UUID),
                    'delegated_from_name', public.approval_partner_name(NULLIF(a ->> 'delegated_from', '')::UUID)
                )
            ), '[]'::jsonb)
            FROM jsonb_array_elements(s -> 'approvers') a
        ))
        ORDER BY (s ->> 'sequence')::INTEGER
    ), '[]'::jsonb)
    FROM jsonb_array_elements(p_plan) s;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Ejecución
-- ════════════════════════════════════════════════════════════════════════════

-- Escribe el plan como la ronda p_round de la solicitud.
CREATE OR REPLACE FUNCTION public.approval_materialize_plan(
    p_request_id UUID,
    p_plan JSONB,
    p_round INTEGER,
    p_skip_below_sequence INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
    v_item    JSONB;
    v_entry   JSONB;
    v_step_id UUID;
    v_skip    BOOLEAN;
    v_note    TEXT;
BEGIN
    SELECT company_id INTO v_company FROM public.approval_request WHERE id = p_request_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_plan) LOOP
        v_skip := COALESCE((v_item ->> 'skipped')::BOOLEAN, false);
        v_note := v_item ->> 'note';
        IF NOT v_skip AND p_skip_below_sequence IS NOT NULL AND (v_item ->> 'sequence')::INTEGER < p_skip_below_sequence THEN
            v_skip := true;
            v_note := 'Aprobado en la ronda anterior';
        END IF;

        INSERT INTO public.approval_request_step (
            company_id, request_id, round, sequence, name, mode, quorum, informative,
            sla_days, flow_step_id, status, note, completed_at
        ) VALUES (
            v_company, p_request_id, p_round, (v_item ->> 'sequence')::INTEGER,
            COALESCE(v_item ->> 'name', 'Aprobación'), COALESCE(v_item ->> 'mode', 'any'),
            NULLIF(v_item ->> 'quorum', '')::INTEGER, COALESCE((v_item ->> 'informative')::BOOLEAN, false),
            NULLIF(v_item ->> 'sla_days', '')::INTEGER, NULLIF(v_item ->> 'flow_step_id', '')::UUID,
            CASE WHEN v_skip THEN 'skipped' ELSE 'waiting' END, v_note,
            CASE WHEN v_skip THEN now() END
        )
        RETURNING id INTO v_step_id;

        FOR v_entry IN SELECT * FROM jsonb_array_elements(COALESCE(v_item -> 'approvers', '[]'::jsonb)) LOOP
            CONTINUE WHEN v_entry ->> 'partner_id' IS NULL;
            INSERT INTO public.approval_request_approver (
                company_id, request_id, step_id, partner_id, delegated_from_partner_id, resolved_via, status
            ) VALUES (
                v_company, p_request_id, v_step_id, (v_entry ->> 'partner_id')::UUID,
                NULLIF(v_entry ->> 'delegated_from', '')::UUID,
                COALESCE(v_entry ->> 'resolved_via', 'manager'),
                CASE WHEN v_skip THEN 'skipped' ELSE 'pending' END
            );
        END LOOP;
    END LOOP;
END;
$$;

-- Resultado de un nivel según su modo: 'approved' | 'pending'
CREATE OR REPLACE FUNCTION public.approval_step_outcome(p_step_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_step     public.approval_request_step;
    v_approved INTEGER;
    v_pending  INTEGER;
BEGIN
    SELECT * INTO v_step FROM public.approval_request_step WHERE id = p_step_id;
    SELECT count(*) FILTER (WHERE status = 'approved'),
           count(*) FILTER (WHERE status = 'pending')
    INTO v_approved, v_pending
    FROM public.approval_request_approver
    WHERE step_id = p_step_id;

    IF v_step.mode = 'any' AND v_approved >= 1 THEN
        RETURN 'approved';
    ELSIF v_step.mode = 'all' AND v_pending = 0 AND v_approved >= 1 THEN
        RETURN 'approved';
    ELSIF v_step.mode = 'quorum' AND v_approved >= COALESCE(v_step.quorum, 1) THEN
        RETURN 'approved';
    END IF;
    RETURN 'pending';
END;
$$;

-- Cierra la solicitud: aprobada, rechazada, cancelada o expirada.
CREATE OR REPLACE FUNCTION public.approval_finalize(
    p_request_id UUID,
    p_status public.approval_request_status,
    p_note TEXT DEFAULT NULL,
    p_reason_id UUID DEFAULT NULL,
    p_forced BOOLEAN DEFAULT false,
    p_auto BOOLEAN DEFAULT false,
    p_automatic BOOLEAN DEFAULT false
)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
    v_label   TEXT;
    v_kind    TEXT;
    v_title   TEXT;
BEGIN
    PERFORM set_config('approval.engine', 'on', true);

    UPDATE public.approval_request
    SET status = p_status,
        approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
        rejected_at = CASE WHEN p_status = 'rejected' THEN now() ELSE NULL END,
        cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END,
        expired_at = CASE WHEN p_status = 'expired' THEN now() ELSE expired_at END,
        resolution_note = NULLIF(trim(COALESCE(p_note, '')), ''),
        rejection_reason_id = CASE WHEN p_status = 'rejected' THEN p_reason_id ELSE NULL END,
        resolved_by_partner_id = CASE WHEN p_automatic THEN NULL ELSE public.current_user_partner_row_id() END,
        forced = p_forced,
        auto_approved = p_auto,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO v_request;

    UPDATE public.approval_request_step
    SET status = 'cancelled', completed_at = now()
    WHERE request_id = p_request_id AND status IN ('waiting', 'active');

    UPDATE public.approval_request_approver
    SET status = 'cancelled'
    WHERE request_id = p_request_id AND status = 'pending';

    PERFORM public.approval_close_actions(p_request_id, NULL);
    PERFORM set_config('approval.engine', 'off', true);

    v_label := public.approval_request_label(p_request_id);
    v_kind := CASE p_status
        WHEN 'approved' THEN CASE WHEN p_auto THEN 'auto_approved' ELSE 'approved' END
        WHEN 'rejected' THEN 'rejected'
        WHEN 'cancelled' THEN 'cancelled'
        ELSE 'expired' END;
    v_title := CASE p_status
        WHEN 'approved' THEN 'Aprobada: ' || v_label
        WHEN 'rejected' THEN 'Rechazada: ' || v_label
        WHEN 'cancelled' THEN 'Cancelada: ' || v_label
        ELSE 'Expiró sin resolverse: ' || v_label END;

    -- Al solicitante (y a quien capturó, si es otra persona), salvo que sea quien actuó
    IF v_request.requesting_partner_id IS DISTINCT FROM public.current_user_partner_row_id() OR p_automatic THEN
        PERFORM public.approval_notify(p_request_id, v_request.requesting_partner_id, v_kind, v_title);
    END IF;
    IF v_request.captured_by_partner_id IS NOT NULL
       AND v_request.captured_by_partner_id <> v_request.requesting_partner_id
       AND v_request.captured_by_partner_id IS DISTINCT FROM public.current_user_partner_row_id() THEN
        PERFORM public.approval_notify(p_request_id, v_request.captured_by_partner_id, v_kind, v_title);
    END IF;

    PERFORM public.approval_log(p_request_id, 'resolved', jsonb_build_object(
        'status', p_status, 'note', p_note, 'reason_id', p_reason_id,
        'forced', p_forced, 'auto_approved', p_auto
    ), p_automatic);

    -- Documento de origen (RR. HH., etc.)
    PERFORM public.approval_on_resolved(p_request_id);

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    RETURN v_request;
END;
$$;

-- Activa el siguiente nivel (o los paralelos de la misma secuencia).
CREATE OR REPLACE FUNCTION public.approval_activate_next(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request   public.approval_request;
    v_settings  public.approval_settings;
    v_category  public.approval_category;
    v_seq       INTEGER;
    v_step      public.approval_request_step;
    v_approver  public.approval_request_approver;
    v_due       TIMESTAMPTZ;
    v_label     TEXT;
    v_blocking  INTEGER := 0;
    v_first_seq INTEGER;
BEGIN
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    IF v_request.status <> 'published' THEN
        RETURN;
    END IF;
    v_settings := public.approval_get_settings(v_request.company_id);
    SELECT * INTO v_category FROM public.approval_category WHERE id = v_request.category_id;
    v_label := public.approval_request_label(p_request_id);

    -- Todavía hay un nivel activo: no se avanza
    IF EXISTS (
        SELECT 1 FROM public.approval_request_step
        WHERE request_id = p_request_id AND round = v_request.round AND status = 'active'
    ) THEN
        RETURN;
    END IF;

    SELECT min(sequence) INTO v_seq
    FROM public.approval_request_step
    WHERE request_id = p_request_id AND round = v_request.round AND status = 'waiting';

    IF v_seq IS NULL THEN
        PERFORM public.approval_finalize(p_request_id, 'approved');
        RETURN;
    END IF;

    SELECT min(sequence) INTO v_first_seq
    FROM public.approval_request_step
    WHERE request_id = p_request_id AND round = v_request.round AND status <> 'skipped';

    FOR v_step IN
        SELECT * FROM public.approval_request_step
        WHERE request_id = p_request_id AND round = v_request.round AND sequence = v_seq AND status = 'waiting'
        ORDER BY created_at
    LOOP
        v_due := public.approval_add_business_days(
            v_request.company_id, now(),
            COALESCE(v_step.sla_days, v_category.sla_days, v_settings.default_sla_days)
        );

        IF v_step.informative THEN
            UPDATE public.approval_request_step
            SET status = 'approved', activated_at = now(), completed_at = now()
            WHERE id = v_step.id;
            UPDATE public.approval_request_approver
            SET status = 'informed', decided_at = now()
            WHERE step_id = v_step.id AND status = 'pending';
            FOR v_approver IN SELECT * FROM public.approval_request_approver WHERE step_id = v_step.id LOOP
                PERFORM public.approval_notify(p_request_id, v_approver.partner_id, 'informed',
                    'Para tu conocimiento: ' || v_label);
            END LOOP;
        ELSE
            v_blocking := v_blocking + 1;
            UPDATE public.approval_request_step
            SET status = 'active', activated_at = now(), due_at = v_due
            WHERE id = v_step.id;
            FOR v_approver IN
                SELECT * FROM public.approval_request_approver WHERE step_id = v_step.id AND status = 'pending'
            LOOP
                PERFORM public.approval_notify(p_request_id, v_approver.partner_id, 'assigned',
                    'Pendiente de tu aprobación: ' || v_label, true, COALESCE(v_due, now()));
            END LOOP;
        END IF;
    END LOOP;

    PERFORM public.approval_log(p_request_id, 'level_activated', jsonb_build_object(
        'round', v_request.round, 'sequence', v_seq,
        'steps', (SELECT jsonb_agg(name) FROM public.approval_request_step
                  WHERE request_id = p_request_id AND round = v_request.round AND sequence = v_seq)
    ), true);

    IF v_settings.notify_requester_each_level AND v_seq > v_first_seq THEN
        PERFORM public.approval_notify(p_request_id, v_request.requesting_partner_id, 'level_advanced',
            'Tu solicitud avanzó de nivel: ' || v_label);
    END IF;

    -- Solo había niveles informativos en esta secuencia: seguir
    IF v_blocking = 0 THEN
        PERFORM public.approval_activate_next(p_request_id);
    END IF;
END;
$$;

-- Revisa los niveles activos de la ronda: cierra los cumplidos y avanza.
CREATE OR REPLACE FUNCTION public.approval_advance(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
    v_step    public.approval_request_step;
    v_skipped RECORD;
BEGIN
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    IF v_request.status <> 'published' THEN
        RETURN;
    END IF;

    FOR v_step IN
        SELECT * FROM public.approval_request_step
        WHERE request_id = p_request_id AND round = v_request.round AND status = 'active'
    LOOP
        IF public.approval_step_outcome(v_step.id) = 'approved' THEN
            UPDATE public.approval_request_step
            SET status = 'approved', completed_at = now()
            WHERE id = v_step.id;

            -- Los que no alcanzaron a decidir quedan omitidos y se cierran sus avisos
            FOR v_skipped IN
                UPDATE public.approval_request_approver
                SET status = 'skipped'
                WHERE step_id = v_step.id AND status = 'pending'
                RETURNING partner_id
            LOOP
                PERFORM public.approval_close_actions(p_request_id, v_skipped.partner_id);
            END LOOP;

            PERFORM public.approval_log(p_request_id, 'level_completed', jsonb_build_object(
                'step', v_step.name, 'sequence', v_step.sequence
            ), true);
        END IF;
    END LOOP;

    PERFORM public.approval_activate_next(p_request_id);
END;
$$;

-- Gancho al resolverse; la integración con RR. HH. lo redefine en la migración siguiente.
CREATE OR REPLACE FUNCTION public.approval_on_resolved(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Visibilidad y permisos
-- ════════════════════════════════════════════════════════════════════════════

-- Visibilidad a partir de las columnas de la fila (sin volver a leer approval_request).
-- Las políticas RLS la usan así para que un INSERT ... RETURNING vea la fila recién creada.
CREATE OR REPLACE FUNCTION public.approval_row_visible_to(
    p_partner_id UUID,
    p_request_id UUID,
    p_company_id UUID,
    p_requester_partner_id UUID,
    p_captured_by_partner_id UUID,
    p_category_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p_partner_id IS NOT NULL AND (
        p_requester_partner_id = p_partner_id
        OR p_captured_by_partner_id = p_partner_id
        OR EXISTS (
            SELECT 1 FROM public.rel_partner_company rpc
            WHERE rpc.company_id = p_company_id AND rpc.partner_id = p_partner_id
              AND rpc.role IN ('owner', 'admin') AND rpc.invitation_status = 'accepted' AND rpc.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM public.approval_request_approver a
            WHERE a.request_id = p_request_id AND a.partner_id = p_partner_id
        )
        OR (
            NOT COALESCE((SELECT c.confidential FROM public.approval_category c WHERE c.id = p_category_id), false)
            AND public.approval_department_manager_of(p_company_id, p_requester_partner_id) = p_partner_id
        )
    );
$$;

-- Política RLS de approval_request: el usuario actual y las columnas de la fila.
CREATE OR REPLACE FUNCTION public.approval_row_visible(
    p_request_id UUID,
    p_company_id UUID,
    p_requester_partner_id UUID,
    p_captured_by_partner_id UUID,
    p_category_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.user_belongs_to_company(p_company_id)
       AND public.approval_row_visible_to(public.current_user_partner_row_id(), p_request_id, p_company_id,
                                          p_requester_partner_id, p_captured_by_partner_id, p_category_id);
$$;

-- ¿Una persona concreta puede ver la solicitud? (para menciones y reasignaciones)
CREATE OR REPLACE FUNCTION public.approval_partner_can_view(p_request_id UUID, p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT public.approval_row_visible_to(p_partner_id, r.id, r.company_id, r.requesting_partner_id,
                                              r.captured_by_partner_id, r.category_id)
        FROM public.approval_request r
        WHERE r.id = p_request_id AND r.active = true
    ), false);
$$;

-- ¿El usuario actual puede ver la solicitud? (tablas hijas y RPC)
CREATE OR REPLACE FUNCTION public.approval_can_view(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT public.approval_row_visible(r.id, r.company_id, r.requesting_partner_id,
                                           r.captured_by_partner_id, r.category_id)
        FROM public.approval_request r
        WHERE r.id = p_request_id AND r.active = true
    ), false);
$$;

-- ¿El usuario actual puede editar el contenido? (borrador o devuelta, suya o admin)
CREATE OR REPLACE FUNCTION public.approval_can_edit(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.approval_request r
        WHERE r.id = p_request_id
          AND r.active = true
          AND r.status IN ('draft', 'returned')
          AND public.user_belongs_to_company(r.company_id)
          AND (
              public.is_company_admin(r.company_id)
              OR public.is_own_partner(r.requesting_partner_id)
              OR (r.captured_by_partner_id IS NOT NULL AND public.is_own_partner(r.captured_by_partner_id))
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.approval_assert_owner_or_admin(p_request public.approval_request)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.user_belongs_to_company(p_request.company_id) THEN
        RAISE EXCEPTION 'Sin acceso' USING ERRCODE = '42501';
    END IF;
    IF NOT (
        public.is_company_admin(p_request.company_id)
        OR public.is_own_partner(p_request.requesting_partner_id)
        OR (p_request.captured_by_partner_id IS NOT NULL AND public.is_own_partner(p_request.captured_by_partner_id))
    ) THEN
        RAISE EXCEPTION 'Solo el solicitante o un administrador puede hacer esto' USING ERRCODE = '42501';
    END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. RPC de acciones
-- ════════════════════════════════════════════════════════════════════════════

-- Valida y envía (o reenvía) una solicitud. Interno: sin comprobación de permisos.
CREATE OR REPLACE FUNCTION public.approval_submit_internal(p_request_id UUID)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request   public.approval_request;
    v_category  public.approval_category;
    v_settings  public.approval_settings;
    v_flow      public.approval_flow;
    v_field     JSONB;
    v_value     JSONB;
    v_ctx       JSONB;
    v_plan      JSONB;
    v_round     INTEGER;
    v_restart   BOOLEAN;
    v_skip_below INTEGER;
    v_resubmit  BOOLEAN;
    v_auto      BOOLEAN;
BEGIN
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR NOT v_request.active THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    IF v_request.status NOT IN ('draft', 'returned') THEN
        RAISE EXCEPTION 'Solo se envían solicitudes en borrador o devueltas';
    END IF;
    IF v_request.title IS NULL OR length(trim(v_request.title)) = 0 THEN
        RAISE EXCEPTION 'El asunto es obligatorio';
    END IF;

    SELECT * INTO v_category FROM public.approval_category WHERE id = v_request.category_id;
    IF v_category.archived OR NOT v_category.active THEN
        RAISE EXCEPTION 'La categoría no está disponible para nuevas solicitudes';
    END IF;

    -- Campos obligatorios del formulario de la categoría
    FOR v_field IN SELECT * FROM jsonb_array_elements(v_category.field_schema) LOOP
        IF COALESCE((v_field ->> 'required')::BOOLEAN, false) THEN
            v_value := v_request.field_values -> (v_field ->> 'key');
            IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' OR trim(v_value #>> '{}') = ''
               OR v_value = '[]'::jsonb OR v_value = '{}'::jsonb THEN
                RAISE EXCEPTION 'Falta el campo obligatorio «%»', COALESCE(v_field ->> 'label', v_field ->> 'key');
            END IF;
        END IF;
    END LOOP;

    IF v_category.require_attachment AND NOT EXISTS (
        SELECT 1 FROM public.approval_request_attachment
        WHERE request_id = p_request_id AND active = true
    ) THEN
        RAISE EXCEPTION 'Esta categoría requiere al menos un archivo adjunto';
    END IF;

    -- Modo simple: el aprobador elegido debe autorizar la categoría (comportamiento previo)
    IF v_category.flow_id IS NULL AND v_request.source_type IS NULL THEN
        IF v_request.assigned_approval_manager_id IS NULL THEN
            RAISE EXCEPTION 'Debe indicarse un aprobador';
        END IF;
        PERFORM public.assert_manager_assignable_for_request(
            v_request.company_id, v_request.assigned_approval_manager_id, v_request.category_id
        );
    END IF;

    v_settings := public.approval_get_settings(v_request.company_id);
    IF v_category.flow_id IS NOT NULL THEN
        SELECT * INTO v_flow FROM public.approval_flow WHERE id = v_category.flow_id;
    END IF;

    v_ctx := public.approval_build_context(
        v_request.company_id, v_request.category_id, v_request.requesting_partner_id,
        v_request.amount, v_request.priority, v_request.field_values, v_request.id
    );
    v_plan := public.approval_resolve_plan(
        v_request.company_id, v_request.category_id, v_request.requesting_partner_id,
        v_request.assigned_approval_manager_id, v_ctx
    );

    v_resubmit := v_request.status = 'returned';
    v_round := v_request.round + 1;
    v_restart := COALESCE(v_flow.restart_from_first, v_settings.restart_from_first);
    IF v_resubmit AND NOT v_restart THEN
        v_skip_below := v_request.returned_from_sequence;
    END IF;

    v_auto := v_category.auto_approve_max_amount IS NOT NULL
              AND v_request.amount IS NOT NULL
              AND v_request.amount <= v_category.auto_approve_max_amount;

    -- Rondas anteriores quedan como historial
    UPDATE public.approval_request_step
    SET status = 'cancelled', completed_at = now()
    WHERE request_id = p_request_id AND status IN ('waiting', 'active');
    UPDATE public.approval_request_approver
    SET status = 'cancelled'
    WHERE request_id = p_request_id AND status = 'pending';
    PERFORM public.approval_close_actions(p_request_id, NULL);

    IF NOT v_auto THEN
        PERFORM public.approval_materialize_plan(p_request_id, v_plan, v_round, v_skip_below);
    END IF;

    PERFORM set_config('approval.engine', 'on', true);
    UPDATE public.approval_request
    SET status = 'published',
        round = v_round,
        submitted_at = now(),
        flow_id = v_category.flow_id,
        flow_version = v_flow.version,
        returned_at = NULL,
        returned_from_sequence = NULL,
        approved_at = NULL,
        rejected_at = NULL,
        resolution_note = NULL,
        rejection_reason_id = NULL,
        resolved_by_partner_id = NULL,
        forced = false,
        auto_approved = false,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id;
    PERFORM set_config('approval.engine', 'off', true);

    PERFORM public.approval_log(p_request_id, CASE WHEN v_resubmit THEN 'resubmitted' ELSE 'submitted' END,
        jsonb_build_object('round', v_round, 'flow_id', v_category.flow_id, 'flow_version', v_flow.version,
                           'plan', public.approval_plan_with_names(v_plan)),
        v_request.source_type IS NOT NULL AND auth.uid() IS NULL);

    -- Aprobación automática por monto
    IF v_auto THEN
        RETURN public.approval_finalize(p_request_id, 'approved',
            'Aprobada automáticamente: monto dentro del límite de la categoría', NULL, false, true, true);
    END IF;

    PERFORM public.approval_activate_next(p_request_id);

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_submit_request(p_request_id UUID)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
BEGIN
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    PERFORM public.approval_assert_owner_or_admin(v_request);
    RETURN public.approval_submit_internal(p_request_id);
END;
$$;

-- Aprobar o rechazar como aprobador pendiente del nivel activo.
CREATE OR REPLACE FUNCTION public.approval_decide(
    p_request_id UUID,
    p_decision TEXT,
    p_comment TEXT DEFAULT NULL,
    p_reason_id UUID DEFAULT NULL
)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  public.approval_request;
    v_settings public.approval_settings;
    v_me       UUID := public.current_user_partner_row_id();
    v_rows     INTEGER;
    v_steps    JSONB;
    v_comment  TEXT := NULLIF(trim(COALESCE(p_comment, '')), '');
BEGIN
    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Decisión inválida';
    END IF;

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR NOT v_request.active THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    IF NOT public.user_belongs_to_company(v_request.company_id) THEN
        RAISE EXCEPTION 'Sin acceso' USING ERRCODE = '42501';
    END IF;
    IF v_request.status <> 'published' THEN
        RAISE EXCEPTION 'La solicitud no está en revisión';
    END IF;

    v_settings := public.approval_get_settings(v_request.company_id);
    IF p_decision = 'reject' AND v_settings.require_reject_reason AND v_comment IS NULL AND p_reason_id IS NULL THEN
        RAISE EXCEPTION 'Indica el motivo del rechazo';
    END IF;
    IF p_reason_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.approval_rejection_reason
        WHERE id = p_reason_id AND company_id = v_request.company_id
    ) THEN
        RAISE EXCEPTION 'Motivo de rechazo inválido';
    END IF;

    SELECT jsonb_agg(DISTINCT s.name) INTO v_steps
    FROM public.approval_request_approver a
    JOIN public.approval_request_step s ON s.id = a.step_id
    WHERE a.request_id = p_request_id AND a.partner_id = v_me AND a.status = 'pending'
      AND s.status = 'active' AND s.round = v_request.round;

    UPDATE public.approval_request_approver a
    SET status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
        decided_at = now(),
        comment = v_comment
    FROM public.approval_request_step s
    WHERE s.id = a.step_id
      AND a.request_id = p_request_id
      AND a.partner_id = v_me
      AND a.status = 'pending'
      AND s.status = 'active'
      AND s.round = v_request.round;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
        RAISE EXCEPTION 'No tienes una aprobación pendiente en esta solicitud' USING ERRCODE = '42501';
    END IF;

    PERFORM public.approval_close_actions(p_request_id, v_me);
    PERFORM public.approval_log(p_request_id,
        CASE WHEN p_decision = 'approve' THEN 'approved_by' ELSE 'rejected_by' END,
        jsonb_build_object('steps', v_steps, 'comment', v_comment, 'reason_id', p_reason_id));

    IF p_decision = 'reject' THEN
        UPDATE public.approval_request_step
        SET status = 'rejected', completed_at = now()
        WHERE request_id = p_request_id AND round = v_request.round AND status = 'active'
          AND EXISTS (SELECT 1 FROM public.approval_request_approver a
                      WHERE a.step_id = approval_request_step.id AND a.partner_id = v_me AND a.status = 'rejected');
        RETURN public.approval_finalize(p_request_id, 'rejected', v_comment, p_reason_id);
    END IF;

    -- Aprobó con observaciones: el solicitante se entera
    IF v_comment IS NOT NULL THEN
        PERFORM public.approval_notify(p_request_id, v_request.requesting_partner_id, 'comment',
            'Observación al aprobar: ' || public.approval_request_label(p_request_id));
    END IF;

    PERFORM public.approval_advance(p_request_id);
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    RETURN v_request;
END;
$$;

-- Devolver al solicitante para corrección (comentario obligatorio).
CREATE OR REPLACE FUNCTION public.approval_return_request(p_request_id UUID, p_comment TEXT)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
    v_me      UUID := public.current_user_partner_row_id();
    v_seq     INTEGER;
    v_comment TEXT := NULLIF(trim(COALESCE(p_comment, '')), '');
BEGIN
    IF v_comment IS NULL THEN
        RAISE EXCEPTION 'Explica qué debe corregirse';
    END IF;

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR v_request.status <> 'published' THEN
        RAISE EXCEPTION 'Solo se devuelven solicitudes en revisión';
    END IF;
    IF v_request.source_type IS NOT NULL THEN
        RAISE EXCEPTION 'Las solicitudes de otro módulo no se devuelven: recházala con el motivo';
    END IF;

    SELECT min(s.sequence) INTO v_seq
    FROM public.approval_request_approver a
    JOIN public.approval_request_step s ON s.id = a.step_id
    WHERE a.request_id = p_request_id AND a.partner_id = v_me AND a.status = 'pending'
      AND s.status = 'active' AND s.round = v_request.round;
    IF v_seq IS NULL THEN
        RAISE EXCEPTION 'No tienes una aprobación pendiente en esta solicitud' USING ERRCODE = '42501';
    END IF;

    UPDATE public.approval_request_step
    SET status = 'cancelled', completed_at = now(), note = 'Devuelta para corrección'
    WHERE request_id = p_request_id AND status IN ('waiting', 'active');
    UPDATE public.approval_request_approver
    SET status = 'cancelled'
    WHERE request_id = p_request_id AND status = 'pending';
    PERFORM public.approval_close_actions(p_request_id, NULL);

    PERFORM set_config('approval.engine', 'on', true);
    UPDATE public.approval_request
    SET status = 'returned', returned_at = now(), returned_from_sequence = v_seq,
        resolution_note = v_comment, updated_at = now(), updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO v_request;
    PERFORM set_config('approval.engine', 'off', true);

    PERFORM public.approval_notify(p_request_id, v_request.requesting_partner_id, 'returned',
        'Devuelta para corrección: ' || public.approval_request_label(p_request_id), true);
    IF v_request.captured_by_partner_id IS NOT NULL AND v_request.captured_by_partner_id <> v_request.requesting_partner_id THEN
        PERFORM public.approval_notify(p_request_id, v_request.captured_by_partner_id, 'returned',
            'Devuelta para corrección: ' || public.approval_request_label(p_request_id), true);
    END IF;
    PERFORM public.approval_log(p_request_id, 'returned', jsonb_build_object('comment', v_comment, 'sequence', v_seq));
    RETURN v_request;
END;
$$;

-- Revertir mi aprobación mientras la solicitud no esté resuelta (motivo obligatorio).
CREATE OR REPLACE FUNCTION public.approval_revoke_decision(p_request_id UUID, p_reason TEXT)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  public.approval_request;
    v_me       UUID := public.current_user_partner_row_id();
    v_approver public.approval_request_approver;
    v_step     public.approval_request_step;
    v_reason   TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Indica el motivo para revocar tu aprobación';
    END IF;

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR v_request.status <> 'published' THEN
        RAISE EXCEPTION 'Solo se revoca mientras la solicitud está en revisión';
    END IF;

    SELECT a.* INTO v_approver
    FROM public.approval_request_approver a
    JOIN public.approval_request_step s ON s.id = a.step_id
    WHERE a.request_id = p_request_id AND a.partner_id = v_me AND a.status = 'approved'
      AND s.round = v_request.round
    ORDER BY s.sequence DESC
    LIMIT 1;
    IF v_approver.id IS NULL THEN
        RAISE EXCEPTION 'No tienes una aprobación que revocar en esta solicitud' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_step FROM public.approval_request_step WHERE id = v_approver.step_id;

    UPDATE public.approval_request_approver
    SET status = 'revoked', comment = v_reason, decided_at = now()
    WHERE id = v_approver.id;

    -- Los niveles posteriores vuelven a esperar y sus decisiones se anulan
    PERFORM public.approval_close_actions(p_request_id, NULL);
    UPDATE public.approval_request_approver a
    SET status = 'pending', decided_at = NULL, comment = NULL
    FROM public.approval_request_step s
    WHERE s.id = a.step_id AND s.request_id = p_request_id AND s.round = v_request.round
      AND s.sequence > v_step.sequence AND s.status IN ('active', 'approved')
      AND a.status IN ('pending', 'approved', 'skipped', 'informed');
    UPDATE public.approval_request_step
    SET status = 'waiting', activated_at = NULL, due_at = NULL, completed_at = NULL
    WHERE request_id = p_request_id AND round = v_request.round
      AND sequence > v_step.sequence AND status IN ('active', 'approved');

    -- Mi nivel vuelve a estar activo si ya no se cumple
    IF public.approval_step_outcome(v_step.id) <> 'approved' THEN
        UPDATE public.approval_request_approver
        SET status = 'pending'
        WHERE step_id = v_step.id AND status = 'skipped';
        -- Quien revoca también puede volver a decidir
        INSERT INTO public.approval_request_approver (
            company_id, request_id, step_id, partner_id, delegated_from_partner_id, resolved_via, status
        ) VALUES (
            v_approver.company_id, p_request_id, v_step.id, v_me, v_approver.delegated_from_partner_id,
            v_approver.resolved_via, 'pending'
        );
        UPDATE public.approval_request_step
        SET status = 'active', completed_at = NULL, activated_at = COALESCE(activated_at, now())
        WHERE id = v_step.id;
        -- Avisos para quienes vuelven a tener la solicitud pendiente
        PERFORM public.approval_notify(p_request_id, a.partner_id, 'assigned',
            'Pendiente de tu aprobación: ' || public.approval_request_label(p_request_id), true,
            COALESCE(v_step.due_at, now()))
        FROM public.approval_request_approver a
        WHERE a.step_id = v_step.id AND a.status = 'pending';
    END IF;

    PERFORM public.approval_log(p_request_id, 'revoked', jsonb_build_object(
        'step', v_step.name, 'sequence', v_step.sequence, 'reason', v_reason
    ));
    PERFORM public.approval_advance(p_request_id);

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    RETURN v_request;
END;
$$;

-- Agregar a otra persona: en un nivel nuevo después del actual o en paralelo al actual.
CREATE OR REPLACE FUNCTION public.approval_add_approver(
    p_request_id UUID,
    p_partner_id UUID,
    p_reason TEXT,
    p_parallel BOOLEAN DEFAULT false
)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
    v_me      UUID := public.current_user_partner_row_id();
    v_step    public.approval_request_step;
    v_new_id  UUID;
    v_reason  TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Indica por qué agregas a esta persona';
    END IF;

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR v_request.status <> 'published' THEN
        RAISE EXCEPTION 'Solo se agregan aprobadores a solicitudes en revisión';
    END IF;

    SELECT s.* INTO v_step
    FROM public.approval_request_step s
    WHERE s.request_id = p_request_id AND s.round = v_request.round AND s.status = 'active'
      AND (
          public.is_company_admin(v_request.company_id)
          OR EXISTS (SELECT 1 FROM public.approval_request_approver a
                     WHERE a.step_id = s.id AND a.partner_id = v_me AND a.status = 'pending')
      )
    ORDER BY s.sequence
    LIMIT 1;
    IF v_step.id IS NULL THEN
        RAISE EXCEPTION 'Solo un aprobador del nivel actual o un administrador puede agregar aprobadores' USING ERRCODE = '42501';
    END IF;

    IF NOT public.approval_is_eligible(v_request.company_id, p_partner_id, NULL) THEN
        RAISE EXCEPTION 'Solo pueden aprobar los aprobadores registrados y los owners';
    END IF;

    IF p_parallel THEN
        IF EXISTS (SELECT 1 FROM public.approval_request_approver
                   WHERE step_id = v_step.id AND partner_id = p_partner_id AND status = 'pending') THEN
            RAISE EXCEPTION 'Esa persona ya está pendiente en este nivel';
        END IF;
        INSERT INTO public.approval_request_approver (company_id, request_id, step_id, partner_id, resolved_via, status)
        VALUES (v_request.company_id, p_request_id, v_step.id, p_partner_id, 'ad_hoc', 'pending');
        PERFORM public.approval_notify(p_request_id, p_partner_id, 'assigned',
            'Pendiente de tu aprobación: ' || public.approval_request_label(p_request_id), true, COALESCE(v_step.due_at, now()));
    ELSE
        UPDATE public.approval_request_step
        SET sequence = sequence + 1
        WHERE request_id = p_request_id AND round = v_request.round AND sequence > v_step.sequence;

        INSERT INTO public.approval_request_step (
            company_id, request_id, round, sequence, name, mode, status, ad_hoc, added_by_partner_id, note
        ) VALUES (
            v_request.company_id, p_request_id, v_request.round, v_step.sequence + 1,
            'Revisión adicional: ' || COALESCE(public.approval_partner_name(p_partner_id), ''),
            'any', 'waiting', true, v_me, v_reason
        )
        RETURNING id INTO v_new_id;

        INSERT INTO public.approval_request_approver (company_id, request_id, step_id, partner_id, resolved_via, status)
        VALUES (v_request.company_id, p_request_id, v_new_id, p_partner_id, 'ad_hoc', 'pending');
    END IF;

    PERFORM public.approval_log(p_request_id, 'approver_added', jsonb_build_object(
        'partner_id', p_partner_id, 'name', public.approval_partner_name(p_partner_id),
        'parallel', p_parallel, 'reason', v_reason
    ));
    RETURN v_request;
END;
$$;

-- Reasignar una aprobación pendiente (la propia o, como admin, la de cualquiera).
CREATE OR REPLACE FUNCTION public.approval_reassign(
    p_approver_id UUID,
    p_to_partner_id UUID,
    p_reason TEXT
)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row     public.approval_request_approver;
    v_request public.approval_request;
    v_step    public.approval_request_step;
    v_reason  TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Indica el motivo de la reasignación';
    END IF;

    SELECT * INTO v_row FROM public.approval_request_approver WHERE id = p_approver_id;
    IF NOT FOUND OR v_row.status <> 'pending' THEN
        RAISE EXCEPTION 'Solo se reasignan aprobaciones pendientes';
    END IF;
    SELECT * INTO v_request FROM public.approval_request WHERE id = v_row.request_id FOR UPDATE;
    IF v_request.status <> 'published' THEN
        RAISE EXCEPTION 'La solicitud no está en revisión';
    END IF;
    IF NOT (public.is_own_partner(v_row.partner_id) OR public.is_company_admin(v_request.company_id)) THEN
        RAISE EXCEPTION 'Solo el aprobador o un administrador puede reasignar' USING ERRCODE = '42501';
    END IF;
    IF p_to_partner_id = v_row.partner_id THEN
        RAISE EXCEPTION 'Elige a otra persona';
    END IF;
    IF NOT public.approval_is_eligible(v_request.company_id, p_to_partner_id, NULL) THEN
        RAISE EXCEPTION 'Solo pueden aprobar los aprobadores registrados y los owners';
    END IF;

    SELECT * INTO v_step FROM public.approval_request_step WHERE id = v_row.step_id;

    UPDATE public.approval_request_approver
    SET status = 'reassigned', decided_at = now(), comment = v_reason
    WHERE id = p_approver_id;
    PERFORM public.approval_close_actions(v_row.request_id, v_row.partner_id);

    INSERT INTO public.approval_request_approver (
        company_id, request_id, step_id, partner_id, delegated_from_partner_id, resolved_via, status
    ) VALUES (
        v_row.company_id, v_row.request_id, v_row.step_id, p_to_partner_id,
        COALESCE(v_row.delegated_from_partner_id, v_row.partner_id), 'reassigned', 'pending'
    );

    IF v_step.status = 'active' THEN
        PERFORM public.approval_notify(v_row.request_id, p_to_partner_id, 'delegated',
            'Te reasignaron: ' || public.approval_request_label(v_row.request_id), true, COALESCE(v_step.due_at, now()));
    END IF;

    PERFORM public.approval_log(v_row.request_id, 'reassigned', jsonb_build_object(
        'from', v_row.partner_id, 'from_name', public.approval_partner_name(v_row.partner_id),
        'to', p_to_partner_id, 'to_name', public.approval_partner_name(p_to_partner_id),
        'step', v_step.name, 'reason', v_reason
    ));
    RETURN v_request;
END;
$$;

-- Resolución forzada por un administrador (motivo obligatorio; queda en cumplimiento).
CREATE OR REPLACE FUNCTION public.approval_force_resolve(
    p_request_id UUID,
    p_decision TEXT,
    p_reason TEXT
)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
    v_reason  TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Decisión inválida';
    END IF;
    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Indica el motivo de la resolución forzada';
    END IF;

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR NOT v_request.active THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    IF NOT public.is_company_admin(v_request.company_id) THEN
        RAISE EXCEPTION 'Solo un owner o administrador puede forzar una resolución' USING ERRCODE = '42501';
    END IF;
    IF v_request.status NOT IN ('published', 'returned') THEN
        RAISE EXCEPTION 'Solo se fuerza una solicitud en revisión o devuelta';
    END IF;

    PERFORM public.approval_log(p_request_id, 'forced', jsonb_build_object('decision', p_decision, 'reason', v_reason));
    RETURN public.approval_finalize(p_request_id,
        CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END::public.approval_request_status,
        v_reason, NULL, true, false, false);
END;
$$;

-- Editar una solicitud enviada. Si cambia un campo crítico, el flujo se reinicia.
CREATE OR REPLACE FUNCTION public.approval_update_submitted(p_request_id UUID, p_changes JSONB)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  public.approval_request;
    v_category public.approval_category;
    v_key      TEXT;
    v_changed  JSONB := '{}'::jsonb;
    v_critical TEXT[] := ARRAY[]::TEXT[];
    v_old      JSONB;
    v_allowed  TEXT[] := ARRAY['title', 'description', 'amount', 'currency', 'due_date', 'priority',
                                'reference', 'field_values', 'category_id'];
BEGIN
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR v_request.status <> 'published' THEN
        RAISE EXCEPTION 'Solo se edita así una solicitud en revisión';
    END IF;
    PERFORM public.approval_assert_owner_or_admin(v_request);
    IF v_request.source_type IS NOT NULL THEN
        RAISE EXCEPTION 'Esta solicitud se edita desde su módulo de origen';
    END IF;

    SELECT * INTO v_category FROM public.approval_category WHERE id = v_request.category_id;
    v_old := to_jsonb(v_request);

    FOR v_key IN SELECT jsonb_object_keys(p_changes) LOOP
        CONTINUE WHEN NOT (v_key = ANY (v_allowed));
        CONTINUE WHEN (v_old -> v_key) IS NOT DISTINCT FROM (p_changes -> v_key);
        v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', p_changes -> v_key));
        IF v_key = ANY (v_category.critical_fields) THEN
            v_critical := v_critical || v_key;
        ELSIF v_key = 'field_values' THEN
            -- Campos dinámicos críticos: 'field.<clave>' en critical_fields
            IF EXISTS (
                SELECT 1 FROM unnest(v_category.critical_fields) cf
                WHERE cf LIKE 'field.%'
                  AND (v_request.field_values -> substr(cf, 7)) IS DISTINCT FROM (p_changes -> 'field_values' -> substr(cf, 7))
            ) OR 'field_values' = ANY (v_category.critical_fields) THEN
                v_critical := v_critical || v_key;
            END IF;
        END IF;
    END LOOP;

    IF v_changed = '{}'::jsonb THEN
        RETURN v_request;
    END IF;

    PERFORM set_config('approval.engine', 'on', true);
    UPDATE public.approval_request
    SET title = CASE WHEN p_changes ? 'title' THEN p_changes ->> 'title' ELSE title END,
        description = CASE WHEN p_changes ? 'description' THEN p_changes ->> 'description' ELSE description END,
        amount = CASE WHEN p_changes ? 'amount' THEN public.approval_try_numeric(p_changes ->> 'amount') ELSE amount END,
        currency = CASE WHEN p_changes ? 'currency' THEN COALESCE(p_changes ->> 'currency', 'MXN') ELSE currency END,
        due_date = CASE WHEN p_changes ? 'due_date' THEN NULLIF(p_changes ->> 'due_date', '')::DATE ELSE due_date END,
        priority = CASE WHEN p_changes ? 'priority' THEN COALESCE(p_changes ->> 'priority', 'normal') ELSE priority END,
        reference = CASE WHEN p_changes ? 'reference' THEN p_changes ->> 'reference' ELSE reference END,
        field_values = CASE WHEN p_changes ? 'field_values' THEN COALESCE(p_changes -> 'field_values', '{}'::jsonb) ELSE field_values END,
        category_id = CASE WHEN p_changes ? 'category_id' THEN (p_changes ->> 'category_id')::UUID ELSE category_id END,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_request_id;

    IF array_length(v_critical, 1) > 0 THEN
        -- Cambio crítico: se invalidan las aprobaciones y se reenvía desde el nivel 1
        UPDATE public.approval_request
        SET status = 'returned', returned_from_sequence = NULL
        WHERE id = p_request_id;
    END IF;
    PERFORM set_config('approval.engine', 'off', true);

    PERFORM public.approval_log(p_request_id, CASE WHEN array_length(v_critical, 1) > 0 THEN 'critical_change' ELSE 'edited' END,
        jsonb_build_object('changes', v_changed, 'critical', to_jsonb(v_critical)));

    IF array_length(v_critical, 1) > 0 THEN
        RETURN public.approval_submit_internal(p_request_id);
    END IF;

    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    RETURN v_request;
END;
$$;

-- Cancelar (solicitante o admin). La versión de un argumento conserva la firma original.
CREATE OR REPLACE FUNCTION public.approval_cancel_with_reason(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
BEGIN
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    PERFORM public.approval_assert_owner_or_admin(v_request);
    IF v_request.status NOT IN ('draft', 'published', 'returned') THEN
        RAISE EXCEPTION 'Solo puede cancelarse desde borrador, en revisión o devuelta';
    END IF;
    RETURN public.approval_finalize(p_request_id, 'cancelled', p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_cancel_request(p_request_id UUID)
RETURNS public.approval_request
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.approval_cancel_with_reason(p_request_id, NULL);
$$;

CREATE OR REPLACE FUNCTION public.approval_reset_request_to_draft(p_request_id UUID)
RETURNS public.approval_request
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
BEGIN
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada';
    END IF;
    PERFORM public.approval_assert_owner_or_admin(v_request);
    IF v_request.status NOT IN ('rejected', 'cancelled', 'expired') THEN
        RAISE EXCEPTION 'Solo puede restablecerse desde rechazada, cancelada o expirada';
    END IF;
    IF v_request.source_type IS NOT NULL THEN
        RAISE EXCEPTION 'Esta solicitud viene de otro módulo: crea una nueva desde ahí';
    END IF;

    PERFORM set_config('approval.engine', 'on', true);
    UPDATE public.approval_request
    SET status = 'draft', approved_at = NULL, rejected_at = NULL, cancelled_at = NULL, expired_at = NULL,
        resolution_note = NULL, rejection_reason_id = NULL, resolved_by_partner_id = NULL,
        forced = false, auto_approved = false, updated_at = now(), updated_by = auth.uid()
    WHERE id = p_request_id
    RETURNING * INTO v_request;
    PERFORM set_config('approval.engine', 'off', true);

    PERFORM public.approval_log(p_request_id, 'reset_to_draft', '{}'::jsonb);
    RETURN v_request;
END;
$$;

-- Firmas originales: siguen funcionando para cualquier cliente anterior.
CREATE OR REPLACE FUNCTION public.approval_publish_request(p_request_id UUID)
RETURNS public.approval_request
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.approval_submit_request(p_request_id);
$$;

CREATE OR REPLACE FUNCTION public.approval_approve_request(p_request_id UUID)
RETURNS public.approval_request
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.approval_decide(p_request_id, 'approve', NULL, NULL);
$$;

CREATE OR REPLACE FUNCTION public.approval_reject_request(p_request_id UUID)
RETURNS public.approval_request
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.approval_decide(p_request_id, 'reject', NULL, NULL);
$$;

-- Decidir varias a la vez. Devuelve el resultado de cada una.
CREATE OR REPLACE FUNCTION public.approval_bulk_decide(
    p_request_ids UUID[],
    p_decision TEXT,
    p_comment TEXT DEFAULT NULL,
    p_reason_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id     UUID;
    v_result JSONB := '[]'::jsonb;
BEGIN
    IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
        RETURN v_result;
    END IF;
    IF array_length(p_request_ids, 1) > 200 THEN
        RAISE EXCEPTION 'Máximo 200 solicitudes por operación';
    END IF;

    FOREACH v_id IN ARRAY p_request_ids LOOP
        BEGIN
            PERFORM public.approval_decide(v_id, p_decision, p_comment, p_reason_id);
            v_result := v_result || jsonb_build_array(jsonb_build_object('id', v_id, 'ok', true));
        EXCEPTION WHEN OTHERS THEN
            v_result := v_result || jsonb_build_array(jsonb_build_object('id', v_id, 'ok', false, 'error', SQLERRM));
        END;
    END LOOP;
    RETURN v_result;
END;
$$;

-- Comentario con menciones (solo a personas que pueden ver la solicitud).
CREATE OR REPLACE FUNCTION public.approval_add_comment(
    p_request_id UUID,
    p_body TEXT,
    p_mentions UUID[] DEFAULT '{}'
)
RETURNS public.approval_request_comment
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  public.approval_request;
    v_me       UUID := public.current_user_partner_row_id();
    v_comment  public.approval_request_comment;
    v_mention  UUID;
    v_valid    UUID[] := ARRAY[]::UUID[];
    v_notify   UUID;
    v_label    TEXT;
BEGIN
    IF NULLIF(trim(COALESCE(p_body, '')), '') IS NULL THEN
        RAISE EXCEPTION 'El comentario está vacío';
    END IF;
    IF NOT public.approval_can_view(p_request_id) THEN
        RAISE EXCEPTION 'Sin acceso a la solicitud' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id FOR UPDATE;
    v_label := public.approval_request_label(p_request_id);

    FOREACH v_mention IN ARRAY COALESCE(p_mentions, '{}') LOOP
        IF v_mention <> v_me AND public.approval_partner_can_view(p_request_id, v_mention) AND NOT (v_mention = ANY (v_valid)) THEN
            v_valid := v_valid || v_mention;
        END IF;
    END LOOP;

    INSERT INTO public.approval_request_comment (
        company_id, request_id, author_partner_id, body, mentions, created_by, updated_by
    ) VALUES (
        v_request.company_id, p_request_id, v_me, trim(p_body), v_valid, auth.uid(), auth.uid()
    )
    RETURNING * INTO v_comment;

    FOREACH v_mention IN ARRAY v_valid LOOP
        PERFORM public.approval_notify(p_request_id, v_mention, 'mention',
            public.approval_partner_name(v_me) || ' te mencionó en ' || v_label);
    END LOOP;

    -- Solicitante y aprobadores pendientes (sin repetir menciones ni al autor)
    FOR v_notify IN
        SELECT DISTINCT x FROM (
            SELECT v_request.requesting_partner_id AS x
            UNION SELECT a.partner_id FROM public.approval_request_approver a
                  WHERE a.request_id = p_request_id AND a.status = 'pending'
        ) t
        WHERE x IS NOT NULL AND x <> v_me AND NOT (x = ANY (v_valid))
    LOOP
        PERFORM public.approval_notify(p_request_id, v_notify, 'comment', 'Comentario nuevo en ' || v_label);
    END LOOP;

    PERFORM public.approval_log(p_request_id, 'comment', jsonb_build_object(
        'comment_id', v_comment.id, 'mentions', to_jsonb(v_valid)
    ));
    RETURN v_comment;
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_mark_activities_read(p_activity_ids UUID[] DEFAULT NULL, p_company_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me   UUID := public.current_user_partner_row_id();
    v_rows INTEGER;
BEGIN
    UPDATE public.approval_activity
    SET read_at = now(),
        -- Los avisos informativos se cierran al leerse; los de acción, al decidir
        done_at = CASE WHEN actionable THEN done_at ELSE COALESCE(done_at, now()) END
    WHERE partner_id = v_me
      AND read_at IS NULL
      AND (p_activity_ids IS NULL OR id = ANY (p_activity_ids))
      AND (p_company_id IS NULL OR company_id = p_company_id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Vista previa, simulador, contexto e indicadores
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approval_preview_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.approval_request;
BEGIN
    IF NOT public.approval_can_view(p_request_id) THEN
        RAISE EXCEPTION 'Sin acceso a la solicitud' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    RETURN public.approval_plan_with_names(public.approval_resolve_plan(
        v_request.company_id, v_request.category_id, v_request.requesting_partner_id,
        v_request.assigned_approval_manager_id,
        public.approval_build_context(v_request.company_id, v_request.category_id, v_request.requesting_partner_id,
            v_request.amount, v_request.priority, v_request.field_values, v_request.id)
    ));
END;
$$;

-- Simula qué flujo y aprobadores resultarían, sin crear nada.
CREATE OR REPLACE FUNCTION public.approval_simulate(
    p_company_id UUID,
    p_category_id UUID,
    p_requester_partner_id UUID,
    p_amount NUMERIC DEFAULT NULL,
    p_field_values JSONB DEFAULT '{}'::jsonb,
    p_priority TEXT DEFAULT 'normal',
    p_assigned_manager_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'Sin acceso' USING ERRCODE = '42501';
    END IF;
    -- Cualquiera ve la vista previa de su propia solicitud; simular a otra persona es de admin.
    IF NOT public.is_company_admin(p_company_id) AND NOT public.is_own_partner(p_requester_partner_id) THEN
        RAISE EXCEPTION 'Solo un owner o administrador puede usar el simulador' USING ERRCODE = '42501';
    END IF;
    RETURN public.approval_plan_with_names(public.approval_resolve_plan(
        p_company_id, p_category_id, p_requester_partner_id, p_assigned_manager_id,
        public.approval_build_context(p_company_id, p_category_id, p_requester_partner_id,
            p_amount, p_priority, COALESCE(p_field_values, '{}'::jsonb), NULL)
    ));
END;
$$;

-- Contexto para decidir: historial del solicitante e indicadores de riesgo.
CREATE OR REPLACE FUNCTION public.approval_request_insights(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request  public.approval_request;
    v_category public.approval_category;
    v_avg      NUMERIC;
    v_count    INTEGER;
    v_previous JSONB;
    v_dupes    JSONB;
    v_flags    JSONB := '[]'::jsonb;
    v_field    JSONB;
    v_value    TEXT;
BEGIN
    IF NOT public.approval_can_view(p_request_id) THEN
        RAISE EXCEPTION 'Sin acceso a la solicitud' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_request FROM public.approval_request WHERE id = p_request_id;
    SELECT * INTO v_category FROM public.approval_category WHERE id = v_request.category_id;

    SELECT avg(amount), count(*) INTO v_avg, v_count
    FROM public.approval_request
    WHERE company_id = v_request.company_id AND requesting_partner_id = v_request.requesting_partner_id
      AND category_id = v_request.category_id AND status = 'approved' AND active = true
      AND id <> v_request.id AND amount IS NOT NULL
      AND created_at > now() - INTERVAL '365 days';

    SELECT COALESCE(jsonb_agg(x ORDER BY x ->> 'created_at' DESC), '[]'::jsonb) INTO v_previous
    FROM (
        SELECT jsonb_build_object('id', id, 'request_number', request_number, 'title', title, 'status', status,
                                  'amount', amount, 'currency', currency, 'created_at', created_at) AS x
        FROM public.approval_request
        WHERE company_id = v_request.company_id AND requesting_partner_id = v_request.requesting_partner_id
          AND category_id = v_request.category_id AND active = true AND id <> v_request.id
        ORDER BY created_at DESC
        LIMIT 5
    ) t;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'request_number', request_number, 'title', title, 'status', status)), '[]'::jsonb)
    INTO v_dupes
    FROM public.approval_request
    WHERE company_id = v_request.company_id AND requesting_partner_id = v_request.requesting_partner_id
      AND category_id = v_request.category_id AND active = true AND id <> v_request.id
      AND status NOT IN ('cancelled', 'draft')
      AND created_at > COALESCE(v_request.created_at, now()) - INTERVAL '30 days'
      AND (
          lower(trim(title)) = lower(trim(v_request.title))
          OR (amount IS NOT NULL AND v_request.amount IS NOT NULL AND v_request.amount > 0
              AND abs(amount - v_request.amount) <= v_request.amount * 0.05)
      );

    IF v_avg IS NOT NULL AND v_count >= 3 AND v_request.amount IS NOT NULL AND v_request.amount > v_avg * 2 THEN
        v_flags := v_flags || jsonb_build_array(jsonb_build_object(
            'code', 'amount_above_average',
            'message', 'El monto es más del doble del promedio aprobado a esta persona en la categoría'));
    END IF;
    IF jsonb_array_length(v_dupes) > 0 THEN
        v_flags := v_flags || jsonb_build_array(jsonb_build_object(
            'code', 'possible_duplicate',
            'message', 'Hay solicitudes parecidas de la misma persona en los últimos 30 días'));
    END IF;

    -- Contactos nuevos (p. ej. proveedor) en campos de tipo contacto
    FOR v_field IN SELECT * FROM jsonb_array_elements(v_category.field_schema) LOOP
        CONTINUE WHEN v_field ->> 'type' <> 'partner';
        v_value := v_request.field_values ->> (v_field ->> 'key');
        CONTINUE WHEN v_value IS NULL OR v_value = '';
        IF NOT EXISTS (
            SELECT 1 FROM public.approval_request r
            WHERE r.company_id = v_request.company_id AND r.status = 'approved' AND r.id <> v_request.id
              AND r.field_values ->> (v_field ->> 'key') = v_value
        ) THEN
            v_flags := v_flags || jsonb_build_array(jsonb_build_object(
                'code', 'new_partner',
                'message', '«' || COALESCE(v_field ->> 'label', 'Contacto') || '» no aparece en solicitudes aprobadas anteriores'));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'requester_average', v_avg,
        'requester_approved_count', COALESCE(v_count, 0),
        'previous', v_previous,
        'duplicates', v_dupes,
        'flags', v_flags,
        'chain', public.approval_verify_event_chain(p_request_id)
    );
END;
$$;
