-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  add_warehouse_stock_report                                               ║
-- ║                                                                           ║
-- ║  Complemento del módulo de trazabilidad: existencias y valoración por     ║
-- ║  almacén, derivadas del libro de movimientos.                             ║
-- ║                                                                           ║
-- ║  `product.stock_quantity` es un saldo global de la empresa; el reparto    ║
-- ║  entre almacenes solo lo conoce `stock_move`, que guarda dónde ocurrió    ║
-- ║  cada entrada y salida. Esta función lo resuelve en la base en vez de     ║
-- ║  traer todos los asientos al navegador.                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_warehouse_stock(p_warehouse_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_warehouse RECORD;
    v_products  JSONB;
    v_totals    JSONB;
BEGIN
    SELECT * INTO v_warehouse FROM public.warehouse WHERE id = p_warehouse_id;

    IF v_warehouse.id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF NOT public.user_belongs_to_company(v_warehouse.company_id) THEN
        RAISE EXCEPTION 'Sin permiso sobre este almacén';
    END IF;

    -- Saldo por producto en este almacén: suma de sus asientos.
    -- Se descartan los productos cuyo neto quedó en cero (ya salieron todos).
    WITH balances AS (
        SELECT
            sm.product_id,
            SUM(sm.signed_quantity) AS quantity,
            -- Costo promedio de los asientos de entrada de este almacén;
            -- si no hubo entradas aquí, se usa el promedio vigente del producto.
            COALESCE(
                NULLIF(
                    SUM(sm.quantity * sm.unit_cost) FILTER (WHERE sm.move_type = 'in')
                    / NULLIF(SUM(sm.quantity) FILTER (WHERE sm.move_type = 'in'), 0),
                    0
                ),
                NULLIF(MAX(p.avg_cost), 0),
                MAX(p.cost_price),
                0
            ) AS unit_cost,
            MAX(sm.occurred_at) AS last_move_at
        FROM public.stock_move sm
        INNER JOIN public.product p ON p.id = sm.product_id
        WHERE sm.warehouse_id = p_warehouse_id
        GROUP BY sm.product_id
    )
    SELECT
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'product_id',   b.product_id,
                'name',         p.name,
                'sku',          p.sku,
                'quantity',     b.quantity,
                'unit_cost',    ROUND(b.unit_cost, 4),
                'stock_value',  ROUND(b.quantity * b.unit_cost, 2),
                'stock_min',    COALESCE(p.stock_min, 0),
                'last_move_at', b.last_move_at,
                'company_total', COALESCE(p.stock_quantity, 0)
            ) ORDER BY p.name
        ), '[]'::jsonb),
        jsonb_build_object(
            'product_count', COUNT(*),
            'units',         COALESCE(SUM(b.quantity), 0),
            'stock_value',   ROUND(COALESCE(SUM(b.quantity * b.unit_cost), 0), 2)
        )
    INTO v_products, v_totals
    FROM balances b
    INNER JOIN public.product p ON p.id = b.product_id
    WHERE b.quantity <> 0;

    RETURN jsonb_build_object(
        'status',    'ok',
        'warehouse', jsonb_build_object(
            'id',   v_warehouse.id,
            'name', v_warehouse.name,
            'code', v_warehouse.code
        ),
        'totals',   COALESCE(v_totals, jsonb_build_object('product_count', 0, 'units', 0, 'stock_value', 0)),
        'products', v_products
    );
END;
$$;

COMMENT ON FUNCTION public.get_warehouse_stock(UUID) IS
    'Existencias y valoración de un almacén, calculadas desde el libro de movimientos.';

REVOKE ALL ON FUNCTION public.get_warehouse_stock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_stock(UUID) TO authenticated;
