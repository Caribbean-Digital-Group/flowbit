-- ╔══════════════════════════════════════════════════════════════╗
-- ║  create_stock_count (TRY-42)                                 ║
-- ║  Conteo físico de inventario guiado                          ║
-- ║  1. stock_count: sesión de conteo por almacén                ║
-- ║  2. stock_count_line: existencia congelada y lo contado      ║
-- ║  3. RPC: iniciar, capturar, aplicar y cancelar               ║
-- ║  4. RLS: el equipo lee; los cambios solo por RPC             ║
-- ╚══════════════════════════════════════════════════════════════╝
--
-- Regla central: la diferencia se calcula contra la existencia CONGELADA al
-- iniciar el conteo, no contra la actual. Si durante el conteo se vendieron
-- 2 piezas, el ajuste aplica «contado − esperado» sobre la existencia de hoy,
-- de modo que esa venta no se pierde.
--
-- El ajuste reutiliza record_stock_move (origen 'adjustment'): deja asiento en
-- el libro con el costo congelado y actualiza stock_quant y product.
-- Documentación: docs/inventory.md («Conteo físico»).

-- ═══════════════════════════════════════════════════════════════════
-- 1. stock_count
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stock_count (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    reference    VARCHAR(30) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES public.warehouse(id) ON DELETE RESTRICT,
    category_id  UUID REFERENCES public.product_category(id) ON DELETE SET NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress', 'applied', 'cancelled')),
    notes        TEXT,

    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at   TIMESTAMPTZ,
    applied_by   UUID REFERENCES auth.users(id),
    cancelled_at TIMESTAMPTZ,

    active       BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id),
    updated_by   UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.stock_count IS
    'Sesión de conteo físico por almacén. Congela la existencia esperada al iniciar; al aplicarse genera los ajustes en stock_move.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_count_company_reference
    ON public.stock_count(company_id, reference);

-- Un almacén solo admite un conteo abierto: dos conteos simultáneos ajustarían dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_count_open_warehouse
    ON public.stock_count(warehouse_id)
    WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_stock_count_company ON public.stock_count(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_active  ON public.stock_count(active);
CREATE INDEX IF NOT EXISTS idx_stock_count_status  ON public.stock_count(company_id, status);

ALTER TABLE public.stock_count ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_stock_count_updated_at ON public.stock_count;
CREATE TRIGGER update_stock_count_updated_at
    BEFORE UPDATE ON public.stock_count
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 2. stock_count_line
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stock_count_line (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    stock_count_id    UUID NOT NULL REFERENCES public.stock_count(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,

    -- Congelados al iniciar el conteo
    expected_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    unit_cost         DECIMAL(15, 4) NOT NULL DEFAULT 0,

    -- Captura (NULL = aún no contado)
    counted_quantity  DECIMAL(15, 3) CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
    counted_at        TIMESTAMPTZ,
    counted_by        UUID REFERENCES auth.users(id),

    -- Resultado al aplicar
    adjusted_quantity DECIMAL(15, 3),
    stock_move_id     UUID REFERENCES public.stock_move(id) ON DELETE SET NULL,

    active            BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id),
    updated_by        UUID REFERENCES auth.users(id),

    UNIQUE (stock_count_id, product_id)
);

COMMENT ON TABLE public.stock_count_line IS
    'Línea de un conteo físico: existencia y costo congelados al iniciar, cantidad contada y ajuste aplicado.';
COMMENT ON COLUMN public.stock_count_line.adjusted_quantity IS
    'Ajuste con signo escrito en el libro. Difiere de contado − esperado solo si la existencia actual no alcanzaba para la salida.';

CREATE INDEX IF NOT EXISTS idx_stock_count_line_company ON public.stock_count_line(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_line_count   ON public.stock_count_line(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_line_product ON public.stock_count_line(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_line_active  ON public.stock_count_line(active);

ALTER TABLE public.stock_count_line ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_stock_count_line_updated_at ON public.stock_count_line;
CREATE TRIGGER update_stock_count_line_updated_at
    BEFORE UPDATE ON public.stock_count_line
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS: lectura para el equipo; escritura solo vía RPC
-- ═══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view stock counts" ON public.stock_count;
CREATE POLICY "Members can view stock counts" ON public.stock_count
    FOR SELECT USING (public.user_belongs_to_company(company_id));

DROP POLICY IF EXISTS "Members can view stock count lines" ON public.stock_count_line;
CREATE POLICY "Members can view stock count lines" ON public.stock_count_line
    FOR SELECT USING (public.user_belongs_to_company(company_id));

REVOKE ALL ON public.stock_count, public.stock_count_line FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.stock_count, public.stock_count_line FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 4. RPC
-- ═══════════════════════════════════════════════════════════════════

/**
 * Inicia un conteo en un almacén. Congela, por cada producto inventariable
 * activo (opcionalmente de una categoría), la existencia del almacén y el
 * costo promedio vigente. Devuelve el id del conteo.
 */
CREATE OR REPLACE FUNCTION public.start_stock_count(
    p_warehouse_id UUID,
    p_category_id  UUID DEFAULT NULL,
    p_notes        TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company   UUID;
    v_count_id  UUID;
    v_next      INT;
    v_reference VARCHAR(30);
    v_lines     INT;
BEGIN
    SELECT company_id INTO v_company FROM public.warehouse WHERE id = p_warehouse_id AND active IS TRUE;
    IF v_company IS NULL THEN
        RAISE EXCEPTION 'Almacén no válido';
    END IF;

    IF NOT public.user_belongs_to_company(v_company) THEN
        RAISE EXCEPTION 'Sin permiso sobre este almacén';
    END IF;

    IF p_category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.product_category WHERE id = p_category_id AND company_id = v_company
    ) THEN
        RAISE EXCEPTION 'Categoría no válida';
    END IF;

    IF EXISTS (SELECT 1 FROM public.stock_count WHERE warehouse_id = p_warehouse_id AND status = 'in_progress') THEN
        RAISE EXCEPTION 'Este almacén ya tiene un conteo en curso. Termínalo o cancélalo antes de iniciar otro.';
    END IF;

    -- Folio consecutivo por empresa
    PERFORM pg_advisory_xact_lock(hashtext('stock_count:' || v_company::text));
    SELECT COUNT(*) + 1 INTO v_next FROM public.stock_count WHERE company_id = v_company;
    v_reference := 'CNT-' || lpad(v_next::text, 5, '0');

    INSERT INTO public.stock_count (company_id, reference, warehouse_id, category_id, notes, created_by, updated_by)
    VALUES (v_company, v_reference, p_warehouse_id, p_category_id, NULLIF(btrim(p_notes), ''), auth.uid(), auth.uid())
    RETURNING id INTO v_count_id;

    INSERT INTO public.stock_count_line (
        company_id, stock_count_id, product_id, expected_quantity, unit_cost, created_by, updated_by
    )
    SELECT v_company,
           v_count_id,
           p.id,
           COALESCE(q.quantity, 0),
           COALESCE(NULLIF(p.avg_cost, 0), p.cost_price, 0),
           auth.uid(),
           auth.uid()
    FROM public.product p
    LEFT JOIN public.stock_quant q ON q.product_id = p.id AND q.warehouse_id = p_warehouse_id
    WHERE p.company_id = v_company
      AND COALESCE(p.is_stockable, true)
      AND COALESCE(p.status::text, 'active') NOT IN ('inactive', 'discontinued')
      AND (p_category_id IS NULL OR p.category_id = p_category_id);

    GET DIAGNOSTICS v_lines = ROW_COUNT;
    IF v_lines = 0 THEN
        RAISE EXCEPTION 'No hay productos inventariables que contar con ese filtro';
    END IF;

    RETURN v_count_id;
END;
$$;

/**
 * Captura (o borra con NULL) la cantidad contada de una línea.
 * Cualquier miembro de la empresa puede capturar mientras el conteo esté abierto.
 */
CREATE OR REPLACE FUNCTION public.set_stock_count_line(
    p_line_id UUID,
    p_counted DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
    v_status  VARCHAR(20);
BEGIN
    SELECT l.company_id, c.status INTO v_company, v_status
    FROM public.stock_count_line l
    JOIN public.stock_count c ON c.id = l.stock_count_id
    WHERE l.id = p_line_id;

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'Línea de conteo no encontrada';
    END IF;

    IF NOT public.user_belongs_to_company(v_company) THEN
        RAISE EXCEPTION 'Sin permiso sobre este conteo';
    END IF;

    IF v_status <> 'in_progress' THEN
        RAISE EXCEPTION 'El conteo ya no está abierto';
    END IF;

    IF p_counted IS NOT NULL AND p_counted < 0 THEN
        RAISE EXCEPTION 'La cantidad contada no puede ser negativa';
    END IF;

    UPDATE public.stock_count_line
    SET counted_quantity = p_counted,
        counted_at       = CASE WHEN p_counted IS NULL THEN NULL ELSE now() END,
        counted_by       = CASE WHEN p_counted IS NULL THEN NULL ELSE auth.uid() END,
        updated_by       = auth.uid()
    WHERE id = p_line_id;
END;
$$;

/**
 * Aplica el conteo (solo owner/admin). Por cada línea contada:
 *   diferencia = contado − esperado (congelado al inicio)
 *   ajuste     = diferencia, salvo que la existencia actual del almacén no
 *                alcance para la salida: entonces se ajusta hasta cero.
 * Con p_uncounted_as_zero = true, las líneas sin capturar cuentan como 0;
 * si no, se omiten. Devuelve un resumen.
 */
CREATE OR REPLACE FUNCTION public.apply_stock_count(
    p_count_id          UUID,
    p_uncounted_as_zero BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count      RECORD;
    v_line       RECORD;
    v_counted    DECIMAL(15, 3);
    v_current    DECIMAL(15, 3);
    v_diff       DECIMAL(15, 3);
    v_adjust     DECIMAL(15, 3);
    v_move_id    UUID;
    v_adjusted   INT := 0;
    v_skipped    INT := 0;
    v_clamped    INT := 0;
    v_value      DECIMAL(15, 2) := 0;
BEGIN
    SELECT * INTO v_count FROM public.stock_count WHERE id = p_count_id FOR UPDATE;

    IF v_count.id IS NULL THEN
        RAISE EXCEPTION 'Conteo no encontrado';
    END IF;

    IF NOT public.is_company_admin(v_count.company_id) THEN
        RAISE EXCEPTION 'Solo un owner o admin puede aplicar un conteo';
    END IF;

    IF v_count.status <> 'in_progress' THEN
        RAISE EXCEPTION 'El conteo ya fue aplicado o cancelado';
    END IF;

    FOR v_line IN
        SELECT * FROM public.stock_count_line
        WHERE stock_count_id = p_count_id
        ORDER BY id
        FOR UPDATE
    LOOP
        v_counted := v_line.counted_quantity;
        IF v_counted IS NULL THEN
            IF NOT p_uncounted_as_zero THEN
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;
            v_counted := 0;
        END IF;

        v_diff := v_counted - v_line.expected_quantity;
        v_adjust := v_diff;

        IF v_diff < 0 THEN
            SELECT COALESCE(quantity, 0) INTO v_current
            FROM public.stock_quant
            WHERE product_id = v_line.product_id AND warehouse_id = v_count.warehouse_id;
            v_current := COALESCE(v_current, 0);

            IF v_current + v_diff < 0 THEN
                v_adjust := -GREATEST(v_current, 0);
                v_clamped := v_clamped + 1;
            END IF;
        END IF;

        v_move_id := NULL;
        IF v_adjust <> 0 THEN
            v_move_id := public.record_stock_move(
                p_company_id   => v_count.company_id,
                p_product_id   => v_line.product_id,
                p_move_type    => CASE WHEN v_adjust > 0 THEN 'in'::public.stock_move_type
                                       ELSE 'out'::public.stock_move_type END,
                p_quantity     => ABS(v_adjust),
                p_origin       => 'adjustment',
                p_warehouse_id => v_count.warehouse_id,
                p_unit_cost    => CASE WHEN v_adjust > 0 AND v_line.unit_cost > 0 THEN v_line.unit_cost END,
                p_reference    => v_count.reference,
                p_notes        => 'Conteo físico ' || v_count.reference
            );
            v_adjusted := v_adjusted + 1;
            v_value := v_value + v_adjust * v_line.unit_cost;
        END IF;

        UPDATE public.stock_count_line
        SET counted_quantity  = v_counted,
            adjusted_quantity = v_adjust,
            stock_move_id     = v_move_id,
            updated_by        = auth.uid()
        WHERE id = v_line.id;
    END LOOP;

    UPDATE public.stock_count
    SET status     = 'applied',
        applied_at = now(),
        applied_by = auth.uid(),
        updated_by = auth.uid()
    WHERE id = p_count_id;

    RETURN jsonb_build_object(
        'status', 'applied',
        'reference', v_count.reference,
        'adjusted_lines', v_adjusted,
        'skipped_lines', v_skipped,
        'clamped_lines', v_clamped,
        'adjustment_value', v_value
    );
END;
$$;

/** Cancela un conteo abierto (solo owner/admin). No toca el inventario. */
CREATE OR REPLACE FUNCTION public.cancel_stock_count(p_count_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company UUID;
    v_status  VARCHAR(20);
BEGIN
    SELECT company_id, status INTO v_company, v_status
    FROM public.stock_count WHERE id = p_count_id FOR UPDATE;

    IF v_company IS NULL THEN
        RAISE EXCEPTION 'Conteo no encontrado';
    END IF;

    IF NOT public.is_company_admin(v_company) THEN
        RAISE EXCEPTION 'Solo un owner o admin puede cancelar un conteo';
    END IF;

    IF v_status <> 'in_progress' THEN
        RAISE EXCEPTION 'El conteo ya fue aplicado o cancelado';
    END IF;

    UPDATE public.stock_count
    SET status       = 'cancelled',
        cancelled_at = now(),
        updated_by   = auth.uid()
    WHERE id = p_count_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_stock_count(UUID, UUID, TEXT)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_stock_count_line(UUID, DECIMAL)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_stock_count(UUID, BOOLEAN)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_stock_count(UUID)              FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_stock_count(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_stock_count_line(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stock_count(UUID, BOOLEAN)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_count(UUID)            TO authenticated;
