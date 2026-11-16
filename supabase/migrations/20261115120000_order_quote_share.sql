-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Cotizaciones compartibles (TRY-29)                                       ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  1. Columnas quote_* en order (token, vigencia, respuesta, aviso visto)   ║
-- ║  2. Protección de las columnas quote_* (solo cambian por RPC)             ║
-- ║  3. order_quote_event — bitácora de solo inserción                        ║
-- ║  4. RPC del equipo: compartir, revocar, marcar respuesta como vista       ║
-- ║  5. RPC anónimos: ver y responder la cotización con el token              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Una cotización es una orden de venta en borrador. El vendedor genera un
-- enlace /q/{token}; el cliente la ve sin cuenta y la acepta (la orden se
-- confirma, igual que post_order para ventas) o la rechaza con un motivo.
-- El acceso anónimo es solo por RPC y solo con el token: nunca por la tabla.
-- Documentación: docs/sales-flow-analysis.md §«Cotizaciones compartibles».


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Columnas
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public."order"
  ADD COLUMN IF NOT EXISTS quote_token            TEXT,
  ADD COLUMN IF NOT EXISTS quote_status           TEXT,
  ADD COLUMN IF NOT EXISTS quote_valid_until      DATE,
  ADD COLUMN IF NOT EXISTS quote_shared_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_viewed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_responded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_response_name    TEXT,
  ADD COLUMN IF NOT EXISTS quote_response_note    TEXT,
  ADD COLUMN IF NOT EXISTS quote_response_seen_at TIMESTAMPTZ;

ALTER TABLE public."order"
  DROP CONSTRAINT IF EXISTS order_quote_status_check;
ALTER TABLE public."order"
  ADD CONSTRAINT order_quote_status_check
  CHECK (quote_status IS NULL OR quote_status IN ('shared', 'accepted', 'rejected', 'revoked'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_quote_token
  ON public."order" (quote_token)
  WHERE quote_token IS NOT NULL;

-- Campana: respuestas de clientes que nadie ha abierto todavía
CREATE INDEX IF NOT EXISTS idx_order_quote_unseen
  ON public."order" (company_id, quote_responded_at DESC)
  WHERE quote_responded_at IS NOT NULL AND quote_response_seen_at IS NULL;

COMMENT ON COLUMN public."order".quote_token IS
  'Token aleatorio del enlace público /q/{token}. NULL = la cotización no se comparte.';
COMMENT ON COLUMN public."order".quote_status IS
  'shared | accepted | rejected | revoked. «Vencida» se calcula con quote_valid_until; no se guarda.';
COMMENT ON COLUMN public."order".quote_valid_until IS
  'Último día en que el cliente puede aceptar la cotización (inclusive). NULL = sin vigencia.';
COMMENT ON COLUMN public."order".quote_response_seen_at IS
  'Cuándo alguien del equipo abrió la orden tras la respuesta del cliente (apaga el aviso de la campana).';


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Protección: las columnas quote_* solo cambian dentro de los RPC
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.protect_order_quote_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('flowbit.quote_sync', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.quote_token            := NULL;
        NEW.quote_status           := NULL;
        NEW.quote_valid_until      := NULL;
        NEW.quote_shared_at        := NULL;
        NEW.quote_viewed_at        := NULL;
        NEW.quote_responded_at     := NULL;
        NEW.quote_response_name    := NULL;
        NEW.quote_response_note    := NULL;
        NEW.quote_response_seen_at := NULL;
    ELSE
        NEW.quote_token            := OLD.quote_token;
        NEW.quote_status           := OLD.quote_status;
        NEW.quote_valid_until      := OLD.quote_valid_until;
        NEW.quote_shared_at        := OLD.quote_shared_at;
        NEW.quote_viewed_at        := OLD.quote_viewed_at;
        NEW.quote_responded_at     := OLD.quote_responded_at;
        NEW.quote_response_name    := OLD.quote_response_name;
        NEW.quote_response_note    := OLD.quote_response_note;
        NEW.quote_response_seen_at := OLD.quote_response_seen_at;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_01_protect_quote_fields ON public."order";
CREATE TRIGGER trigger_order_01_protect_quote_fields
    BEFORE INSERT OR UPDATE ON public."order"
    FOR EACH ROW EXECUTE FUNCTION public.protect_order_quote_fields();


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Bitácora de la cotización (solo inserción, solo desde los RPC)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.order_quote_event (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES public."order"(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('shared', 'viewed', 'accepted', 'rejected', 'revoked')),
  -- Nombre que escribió el cliente, o el del miembro del equipo
  actor_name TEXT,
  note       TEXT,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.order_quote_event IS
  'Bitácora de la cotización compartida: compartida, vista, aceptada, rechazada, revocada. Solo inserción.';

CREATE INDEX IF NOT EXISTS idx_order_quote_event_order
  ON public.order_quote_event (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_quote_event_company
  ON public.order_quote_event (company_id);

ALTER TABLE public.order_quote_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_quote_event_select_company" ON public.order_quote_event;
CREATE POLICY "order_quote_event_select_company"
  ON public.order_quote_event
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(company_id));
-- Sin políticas de INSERT/UPDATE/DELETE: solo escriben los RPC (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.block_order_quote_event_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La bitácora de cotizaciones no se puede modificar' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_quote_event_immutable ON public.order_quote_event;
CREATE TRIGGER trigger_order_quote_event_immutable
    BEFORE UPDATE OR DELETE ON public.order_quote_event
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION public.block_order_quote_event_changes();

REVOKE ALL ON public.order_quote_event FROM anon;
GRANT SELECT ON public.order_quote_event TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. RPC del equipo
-- ════════════════════════════════════════════════════════════════════════════

-- Nombre visible del usuario actual (para la bitácora)
CREATE OR REPLACE FUNCTION public._quote_actor_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(NULLIF(BTRIM(p.display_name), ''), p.name)
    FROM public.partner p
    WHERE p.user_id = auth.uid()
    ORDER BY p.created_at
    LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public._quote_actor_name() FROM PUBLIC, anon;

-- Comparte (o vuelve a compartir) una cotización. Conserva el token si ya
-- existía, para que el enlace enviado siga funcionando; reinicia la respuesta.
CREATE OR REPLACE FUNCTION public.order_quote_share(
    p_order_id    UUID,
    p_valid_until DATE DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_token TEXT;
BEGIN
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Orden no encontrada';
    END IF;
    IF v_order.order_type <> 'sale' THEN
        RAISE EXCEPTION 'Solo las órdenes de venta se comparten como cotización';
    END IF;
    IF v_order.order_state <> 'draft' THEN
        RAISE EXCEPTION 'Solo las órdenes en borrador se comparten como cotización';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.order_line WHERE order_id = p_order_id) THEN
        RAISE EXCEPTION 'Agrega al menos una línea antes de compartir la cotización';
    END IF;
    IF p_valid_until IS NOT NULL AND p_valid_until < CURRENT_DATE THEN
        RAISE EXCEPTION 'La vigencia no puede ser una fecha pasada';
    END IF;

    -- 2 × UUIDv4 sin guiones = 64 caracteres hex (≈ 244 bits aleatorios)
    v_token := COALESCE(
        v_order.quote_token,
        replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    );

    PERFORM set_config('flowbit.quote_sync', 'on', true);
    UPDATE public."order"
    SET quote_token            = v_token,
        quote_status           = 'shared',
        quote_valid_until      = p_valid_until,
        quote_shared_at        = now(),
        quote_responded_at     = NULL,
        quote_response_name    = NULL,
        quote_response_note    = NULL,
        quote_response_seen_at = NULL,
        updated_by             = auth.uid()
    WHERE id = p_order_id;
    PERFORM set_config('flowbit.quote_sync', 'off', true);

    INSERT INTO public.order_quote_event (company_id, order_id, event_type, actor_name, valid_until, created_by)
    VALUES (v_order.company_id, p_order_id, 'shared', public._quote_actor_name(), p_valid_until, auth.uid());

    RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.order_quote_share(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_quote_share(UUID, DATE) TO authenticated;

-- Revoca el enlace: el token deja de existir y el anterior ya no abre nada.
CREATE OR REPLACE FUNCTION public.order_quote_revoke(p_order_id UUID)
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
        RAISE EXCEPTION 'Orden no encontrada';
    END IF;
    IF v_order.quote_token IS NULL THEN
        RETURN FALSE;
    END IF;

    PERFORM set_config('flowbit.quote_sync', 'on', true);
    UPDATE public."order"
    SET quote_token  = NULL,
        quote_status = CASE WHEN quote_status = 'shared' THEN 'revoked' ELSE quote_status END,
        updated_by   = auth.uid()
    WHERE id = p_order_id;
    PERFORM set_config('flowbit.quote_sync', 'off', true);

    INSERT INTO public.order_quote_event (company_id, order_id, event_type, actor_name, created_by)
    VALUES (v_order.company_id, p_order_id, 'revoked', public._quote_actor_name(), auth.uid());

    RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.order_quote_revoke(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_quote_revoke(UUID) TO authenticated;

-- Apaga el aviso de la campana cuando alguien del equipo abre la orden.
CREATE OR REPLACE FUNCTION public.order_quote_mark_seen(p_order_id UUID)
RETURNS BOOLEAN
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

    PERFORM set_config('flowbit.quote_sync', 'on', true);
    UPDATE public."order"
    SET quote_response_seen_at = now()
    WHERE id = p_order_id
      AND quote_responded_at IS NOT NULL
      AND quote_response_seen_at IS NULL;
    PERFORM set_config('flowbit.quote_sync', 'off', true);

    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.order_quote_mark_seen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_quote_mark_seen(UUID) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. RPC anónimos (página pública /q/{token})
-- ════════════════════════════════════════════════════════════════════════════

-- Estado efectivo que ve el cliente: shared + vigencia vencida = expired.
CREATE OR REPLACE FUNCTION public._quote_effective_status(
    p_status      TEXT,
    p_order_state public.order_state,
    p_valid_until DATE
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p_status = 'shared' AND p_order_state = 'cancel' THEN 'cancelled'
        WHEN p_status = 'shared' AND p_order_state <> 'draft' THEN 'closed'
        WHEN p_status = 'shared' AND p_valid_until IS NOT NULL AND p_valid_until < CURRENT_DATE THEN 'expired'
        ELSE p_status
    END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_quote(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order    public."order"%ROWTYPE;
    v_company  public.company%ROWTYPE;
    v_customer TEXT;
    v_lines    JSONB;
BEGIN
    IF p_token IS NULL OR length(p_token) <> 64 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_order
    FROM public."order"
    WHERE quote_token = p_token
      AND order_type = 'sale';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_company FROM public.company WHERE id = v_order.company_id;

    SELECT COALESCE(
        NULLIF(BTRIM(v_order.customer_name), ''),
        NULLIF(BTRIM(p.display_name), ''),
        p.name
    )
    INTO v_customer
    FROM public.partner p
    WHERE p.id = v_order.partner_id;

    -- Sin costos ni márgenes: solo lo que el cliente necesita ver
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'description', ol.description,
            'quantity', ol.quantity,
            'unit_price', ol.unit_price,
            'discount_percent', COALESCE(ol.discount_percent, 0),
            'tax_rate', COALESCE(ol.tax_rate, 0),
            'subtotal', ol.subtotal,
            'total', ol.total
        )
        ORDER BY ol.sequence, ol.created_at
    ), '[]'::jsonb)
    INTO v_lines
    FROM public.order_line ol
    WHERE ol.order_id = v_order.id;

    -- Primera apertura: queda en la bitácora una sola vez
    IF v_order.quote_viewed_at IS NULL AND v_order.quote_status = 'shared' THEN
        PERFORM set_config('flowbit.quote_sync', 'on', true);
        UPDATE public."order" SET quote_viewed_at = now() WHERE id = v_order.id;
        PERFORM set_config('flowbit.quote_sync', 'off', true);

        INSERT INTO public.order_quote_event (company_id, order_id, event_type)
        VALUES (v_order.company_id, v_order.id, 'viewed');
    END IF;

    RETURN jsonb_build_object(
        'status', public._quote_effective_status(v_order.quote_status, v_order.order_state, v_order.quote_valid_until),
        'quote', jsonb_build_object(
            'name', v_order.name,
            'order_date', v_order.order_date,
            'valid_until', v_order.quote_valid_until,
            'currency', v_order.currency,
            'payment_term', v_order.payment_term,
            'notes', v_order.notes,
            'customer_name', v_customer,
            'amount_untaxed', COALESCE(v_order.amount_untaxed, 0),
            'amount_discount', COALESCE(v_order.amount_discount, 0),
            'amount_tax', COALESCE(v_order.amount_tax, 0),
            'amount_total', COALESCE(v_order.amount_total, 0),
            'responded_at', v_order.quote_responded_at,
            'response_name', v_order.quote_response_name
        ),
        'company', jsonb_build_object(
            'name', COALESCE(NULLIF(BTRIM(v_company.display_name), ''), v_company.name),
            'legal_name', v_company.legal_name,
            'vat', v_company.vat,
            'email', v_company.email,
            'phone', v_company.phone,
            'website', v_company.website,
            'logo_url', v_company.logo_url,
            'primary_color', v_company.primary_color,
            'city', v_company.city,
            'state', v_company.state
        ),
        'lines', v_lines
    );
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_quote(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_quote(TEXT) TO anon, authenticated;

-- Respuesta del cliente. Aceptar confirma la orden (misma lógica que
-- post_order para ventas: no reserva stock; la entrega se prepara a mano).
-- Rechazar deja la orden en borrador y avisa al responsable del lead.
CREATE OR REPLACE FUNCTION public.respond_public_quote(
    p_token    TEXT,
    p_decision TEXT,
    p_name     TEXT,
    p_note     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order  public."order"%ROWTYPE;
    v_name   TEXT := NULLIF(BTRIM(COALESCE(p_name, '')), '');
    v_note   TEXT := NULLIF(BTRIM(COALESCE(p_note, '')), '');
    v_status TEXT;
    r_lead   RECORD;
BEGIN
    IF p_decision NOT IN ('accept', 'reject') THEN
        RAISE EXCEPTION 'Respuesta no válida';
    END IF;
    IF v_name IS NULL OR length(v_name) > 120 THEN
        RAISE EXCEPTION 'Escribe tu nombre (máximo 120 caracteres)';
    END IF;
    IF v_note IS NOT NULL AND length(v_note) > 1000 THEN
        RAISE EXCEPTION 'El comentario admite hasta 1000 caracteres';
    END IF;
    IF p_decision = 'reject' AND v_note IS NULL THEN
        RAISE EXCEPTION 'Cuéntanos el motivo del rechazo';
    END IF;
    IF p_token IS NULL OR length(p_token) <> 64 THEN
        RAISE EXCEPTION 'Cotización no encontrada';
    END IF;

    SELECT * INTO v_order
    FROM public."order"
    WHERE quote_token = p_token
      AND order_type = 'sale'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cotización no encontrada';
    END IF;

    v_status := public._quote_effective_status(v_order.quote_status, v_order.order_state, v_order.quote_valid_until);
    IF v_status <> 'shared' THEN
        RAISE EXCEPTION 'Esta cotización ya no se puede responder (%)', v_status;
    END IF;

    PERFORM set_config('flowbit.quote_sync', 'on', true);
    UPDATE public."order"
    SET quote_status           = CASE WHEN p_decision = 'accept' THEN 'accepted' ELSE 'rejected' END,
        quote_responded_at     = now(),
        quote_response_name    = v_name,
        quote_response_note    = v_note,
        quote_response_seen_at = NULL
    WHERE id = v_order.id;
    PERFORM set_config('flowbit.quote_sync', 'off', true);

    IF p_decision = 'accept' THEN
        IF NOT EXISTS (SELECT 1 FROM public.order_line WHERE order_id = v_order.id) THEN
            RAISE EXCEPTION 'La cotización no tiene líneas';
        END IF;

        -- Igual que post_order (sales): confirmar y recalcular la entrega.
        -- El trigger del CRM pasa el lead vinculado a la etapa ganada.
        UPDATE public."order"
        SET order_state       = 'posted',
            confirmation_date = COALESCE(confirmation_date, now())
        WHERE id = v_order.id;

        PERFORM public.recompute_order_delivery(v_order.id);
    ELSE
        -- Aviso al responsable de cada lead vinculado (campana → CRM).
        -- El CRM nunca bloquea la respuesta del cliente.
        BEGIN
        FOR r_lead IN
            SELECT l.id, l.company_id, l.responsible_partner_id
            FROM public.crm_lead_order lo
            INNER JOIN public.crm_lead l ON l.id = lo.lead_id
            WHERE lo.order_id = v_order.id
        LOOP
            INSERT INTO public.crm_activity (
                company_id, lead_id, type, status, title, notes,
                responsible_partner_id, scheduled_at
            ) VALUES (
                r_lead.company_id, r_lead.id, 'followup', 'pending',
                'Cotización ' || COALESCE(v_order.name, '') || ' rechazada por el cliente',
                v_name || ': ' || v_note,
                r_lead.responsible_partner_id, now()
            );
        END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'No se pudo avisar al CRM del rechazo de %: %', v_order.name, SQLERRM;
        END;
    END IF;

    INSERT INTO public.order_quote_event (company_id, order_id, event_type, actor_name, note)
    VALUES (
        v_order.company_id, v_order.id,
        CASE WHEN p_decision = 'accept' THEN 'accepted' ELSE 'rejected' END,
        v_name, v_note
    );

    RETURN jsonb_build_object(
        'status', CASE WHEN p_decision = 'accept' THEN 'accepted' ELSE 'rejected' END
    );
END;
$$;
REVOKE ALL ON FUNCTION public.respond_public_quote(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_public_quote(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
