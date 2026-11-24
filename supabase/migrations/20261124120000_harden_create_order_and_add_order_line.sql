-- =============================================================================
-- Blindaje multi-tenant de create_order y add_order_line (TRY-63)
-- =============================================================================
-- Las dos funciones nacieron en 20260126233937 como SECURITY DEFINER sin validar
-- la empresa de quien llama y con EXECUTE para PUBLIC (incluido anon). Eso
-- permitía crear órdenes en borrador en cualquier empresa con solo conocer su
-- company_id y agregar líneas a cualquier orden en borrador.
--
-- Se aplica el mismo patrón que post_order / cancel_order
-- (20261103130000_sales_fulfillment_and_payments.sql):
--   * user_belongs_to_company() antes de escribir.
--   * SET search_path = public.
--   * REVOKE a PUBLIC y anon; EXECUTE solo para authenticated.
-- Las firmas no cambian: el frontend y los tipos generados siguen igual.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_order(
    p_company_id UUID,
    p_order_type order_type,
    p_partner_id UUID,
    p_currency VARCHAR(3) DEFAULT 'MXN',
    p_tax_rate DECIMAL DEFAULT 16.00
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_created_by_partner_id UUID;
BEGIN
    IF p_company_id IS NULL OR NOT public.user_belongs_to_company(p_company_id) THEN
        RAISE EXCEPTION 'Company not found' USING ERRCODE = '42501';
    END IF;

    IF p_partner_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.partner WHERE id = p_partner_id) THEN
        RAISE EXCEPTION 'Partner not found';
    END IF;

    SELECT id INTO v_created_by_partner_id
    FROM public.partner
    WHERE user_id = auth.uid()
    LIMIT 1;

    INSERT INTO public."order" (
        company_id,
        order_type,
        partner_id,
        created_by_partner_id,
        currency,
        tax_rate,
        created_by
    ) VALUES (
        p_company_id,
        p_order_type,
        p_partner_id,
        v_created_by_partner_id,
        p_currency,
        p_tax_rate,
        auth.uid()
    )
    RETURNING id INTO v_order_id;

    RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_order_line(
    p_order_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_quantity DECIMAL DEFAULT 1,
    p_unit_price DECIMAL DEFAULT 0,
    p_unit_cost DECIMAL DEFAULT 0,
    p_discount_percent DECIMAL DEFAULT 0,
    p_tax_rate DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_line_id UUID;
    v_order RECORD;
    v_next_sequence INT;
BEGIN
    -- FOR UPDATE: dos altas simultáneas no calculan la misma secuencia
    SELECT * INTO v_order FROM public."order" WHERE id = p_order_id FOR UPDATE;

    -- Mismo mensaje para «no existe» y «es de otra empresa»: no revela ids ajenos
    IF v_order.id IS NULL OR NOT public.user_belongs_to_company(v_order.company_id) THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.order_state <> 'draft' THEN
        RAISE EXCEPTION 'Cannot add lines to a non-draft order';
    END IF;

    IF p_product_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.product
        WHERE id = p_product_id AND company_id = v_order.company_id
    ) THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    SELECT COALESCE(MAX(sequence), 0) + 10 INTO v_next_sequence
    FROM public.order_line
    WHERE order_id = p_order_id;

    INSERT INTO public.order_line (
        order_id,
        product_id,
        sequence,
        description,
        quantity,
        unit_price,
        unit_cost,
        discount_percent,
        tax_rate
    ) VALUES (
        p_order_id,
        p_product_id,
        v_next_sequence,
        COALESCE(p_description, 'Line item'),
        p_quantity,
        p_unit_price,
        p_unit_cost,
        p_discount_percent,
        COALESCE(p_tax_rate, v_order.tax_rate)
    )
    RETURNING id INTO v_line_id;

    RETURN v_line_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(UUID, order_type, UUID, VARCHAR, DECIMAL) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(UUID, order_type, UUID, VARCHAR, DECIMAL) TO authenticated;

REVOKE ALL ON FUNCTION public.add_order_line(UUID, UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_order_line(UUID, UUID, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) TO authenticated;

COMMENT ON FUNCTION public.create_order IS 'Crea una orden en borrador; solo miembros de la empresa (TRY-63)';
COMMENT ON FUNCTION public.add_order_line IS 'Agrega una línea a una orden en borrador; solo miembros de su empresa y productos de la misma empresa (TRY-63)';
