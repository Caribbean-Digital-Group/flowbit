-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  create_storefront_module                                                 ║
-- ║                                                                           ║
-- ║  Tienda en línea pública por empresa (multi-tenant, resuelta por          ║
-- ║  company.slug):                                                           ║
-- ║   1. product.slug — URL amigable por producto (única por empresa)         ║
-- ║   2. order.origin + datos de cliente/envío/cupón + checkout_token         ║
-- ║      (idempotencia) y recreación de v_orders                              ║
-- ║   3. Tablas: storefront_settings, storefront_shipping_method,             ║
-- ║      storefront_coupon (estructura estándar + RLS)                        ║
-- ║   4. RPCs públicos SECURITY DEFINER (patrón get_public_project_view):     ║
-- ║      get_storefront, get_storefront_products, get_storefront_product,     ║
-- ║      get_storefront_checkout_info, validate_storefront_coupon,            ║
-- ║      place_storefront_order, get_storefront_order,                        ║
-- ║      get_storefront_my_orders                                             ║
-- ║                                                                           ║
-- ║  Decisiones:                                                              ║
-- ║   - La orden del storefront nace 'posted' (venta confirmada); el stock    ║
-- ║     se valida en el servidor al confirmar y se descuenta con el flujo     ║
-- ║     de pickings existente al marcar la entrega (igual que el resto del    ║
-- ║     ERP; el POS es la excepción porque entrega en el momento).            ║
-- ║   - Envío y cupón de monto fijo se insertan como líneas de la orden       ║
-- ║     para que los triggers existentes calculen los totales.                ║
-- ║   - Cupón porcentual se aplica como discount_percent en las líneas.       ║
-- ║   - No hay pasarela de pago en el stack: el checkout registra el          ║
-- ║     payment_method elegido y la orden queda payment_status='unpaid'.      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- 1. product.slug — URL amigable única por empresa
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.product
    ADD COLUMN IF NOT EXISTS slug VARCHAR(180);

CREATE OR REPLACE FUNCTION public.generate_product_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug = lower(regexp_replace(
            regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        )) || '-' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_slug ON public.product;
CREATE TRIGGER trigger_product_slug
    BEFORE INSERT OR UPDATE ON public.product
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_product_slug();

-- Backfill de productos existentes
UPDATE public.product
SET slug = lower(regexp_replace(
        regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
    )) || '-' || substr(gen_random_uuid()::text, 1, 8)
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.product
    ADD CONSTRAINT product_company_slug_unique UNIQUE (company_id, slug);

COMMENT ON COLUMN public.product.slug IS
    'Identificador URL-amigable del producto en el storefront (único por empresa).';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Extensiones a public.order — origen, cliente, envío, cupón, idempotencia
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public."order"
    ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'dashboard'
        CHECK (origin IN ('dashboard', 'pos', 'storefront')),
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS shipping_method_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(15, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(15, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS checkout_token UUID UNIQUE;

-- Backfill: las órdenes creadas desde el POS ya son identificables
UPDATE public."order"
SET origin = 'pos'
WHERE pos_session_id IS NOT NULL
  AND origin = 'dashboard';

CREATE INDEX IF NOT EXISTS idx_order_origin ON public."order"(origin);
CREATE INDEX IF NOT EXISTS idx_order_customer_email
    ON public."order"(company_id, lower(customer_email))
    WHERE customer_email IS NOT NULL;

COMMENT ON COLUMN public."order".origin IS
    'Origen de la orden: dashboard (panel), pos (punto de venta) o storefront (tienda en línea).';
COMMENT ON COLUMN public."order".checkout_token IS
    'Token de idempotencia generado por el cliente del storefront para evitar órdenes duplicadas.';

-- Recrear v_orders para re-expandir o.* con las nuevas columnas
DROP VIEW IF EXISTS public.v_orders CASCADE;

CREATE VIEW public.v_orders AS
SELECT
  o.*,
  p.name AS partner_name,
  p.email AS partner_email,
  p.vat AS partner_vat,
  cbp.name AS created_by_partner_name,
  c.name AS company_name,
  c.currency AS company_currency,
  pr.name AS project_name,
  pr.code AS project_code,
  (SELECT COUNT(*) FROM public.order_line ol WHERE ol.order_id = o.id) AS line_count
FROM public.order o
LEFT JOIN public.partner p ON p.id = o.partner_id
LEFT JOIN public.partner cbp ON cbp.id = o.created_by_partner_id
LEFT JOIN public.company c ON c.id = o.company_id
LEFT JOIN public.project pr ON pr.id = o.project_id;

COMMENT ON VIEW public.v_orders IS
    'Órdenes con socio, empresa, proyecto, pago, origen (dashboard/pos/storefront) y conteo de líneas';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Tablas del storefront
-- ════════════════════════════════════════════════════════════════════════════

-- ── 3.1 storefront_settings — configuración de la tienda por empresa ────────
CREATE TABLE IF NOT EXISTS public.storefront_settings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL UNIQUE REFERENCES public.company(id) ON DELETE CASCADE,

    is_active      BOOLEAN NOT NULL DEFAULT false,

    -- Textos de la landing
    hero_title     VARCHAR(180),
    hero_subtitle  VARCHAR(500),
    announcement   VARCHAR(200),
    about_text     TEXT,

    -- Contacto público
    contact_email  VARCHAR(255),
    contact_phone  VARCHAR(50),
    contact_address VARCHAR(500),

    -- Políticas
    policy_shipping TEXT,
    policy_returns  TEXT,
    policy_privacy  TEXT,
    policy_terms    TEXT,

    -- Comportamiento del catálogo
    show_out_of_stock BOOLEAN NOT NULL DEFAULT true,

    active         BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    created_by     UUID REFERENCES auth.users(id),
    updated_by     UUID REFERENCES auth.users(id)
);

ALTER TABLE public.storefront_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_storefront_settings_updated_at
    BEFORE UPDATE ON public.storefront_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_storefront_settings_company ON public.storefront_settings(company_id);
CREATE INDEX idx_storefront_settings_active  ON public.storefront_settings(is_active) WHERE is_active = true;

CREATE POLICY "storefront_settings_select_company" ON public.storefront_settings
    FOR SELECT USING (public.user_belongs_to_company(company_id));

CREATE POLICY "storefront_settings_admin_all" ON public.storefront_settings
    FOR ALL
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

COMMENT ON TABLE public.storefront_settings IS
    'Configuración de la tienda en línea pública de cada empresa (una fila por empresa).';

-- ── 3.2 storefront_shipping_method — métodos de envío ───────────────────────
CREATE TABLE IF NOT EXISTS public.storefront_shipping_method (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name              VARCHAR(160) NOT NULL,
    description       TEXT,
    price             DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    delivery_estimate VARCHAR(120), -- Ej: "2 a 5 días hábiles"
    display_order     INT DEFAULT 0,

    active            BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id),
    updated_by        UUID REFERENCES auth.users(id)
);

ALTER TABLE public.storefront_shipping_method ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_storefront_shipping_method_updated_at
    BEFORE UPDATE ON public.storefront_shipping_method
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_storefront_shipping_method_company ON public.storefront_shipping_method(company_id);
CREATE INDEX idx_storefront_shipping_method_active  ON public.storefront_shipping_method(active);

CREATE POLICY "storefront_shipping_select_company" ON public.storefront_shipping_method
    FOR SELECT USING (public.user_belongs_to_company(company_id));

CREATE POLICY "storefront_shipping_admin_all" ON public.storefront_shipping_method
    FOR ALL
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

COMMENT ON TABLE public.storefront_shipping_method IS
    'Métodos de envío ofrecidos en el checkout del storefront, con costo y tiempo estimado.';

-- ── 3.3 storefront_coupon — cupones de descuento ────────────────────────────
CREATE TABLE IF NOT EXISTS public.storefront_coupon (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    code           VARCHAR(64) NOT NULL,
    description    TEXT,
    discount_type  VARCHAR(10) NOT NULL DEFAULT 'percent'
        CHECK (discount_type IN ('percent', 'fixed')),
    discount_value DECIMAL(15, 2) NOT NULL CHECK (discount_value > 0),
    min_purchase   DECIMAL(15, 2) DEFAULT 0.00,
    usage_limit    INT,                     -- NULL = ilimitado
    usage_count    INT NOT NULL DEFAULT 0,
    starts_at      DATE,
    expires_at     DATE,

    active         BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    created_by     UUID REFERENCES auth.users(id),
    updated_by     UUID REFERENCES auth.users(id),

    UNIQUE (company_id, code)
);

ALTER TABLE public.storefront_coupon ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_storefront_coupon_updated_at
    BEFORE UPDATE ON public.storefront_coupon
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_storefront_coupon_company ON public.storefront_coupon(company_id);
CREATE INDEX idx_storefront_coupon_active  ON public.storefront_coupon(active);

CREATE POLICY "storefront_coupon_select_company" ON public.storefront_coupon
    FOR SELECT USING (public.user_belongs_to_company(company_id));

CREATE POLICY "storefront_coupon_admin_all" ON public.storefront_coupon
    FOR ALL
    USING (public.is_company_admin(company_id))
    WITH CHECK (public.is_company_admin(company_id));

-- Normalizar el código a mayúsculas sin espacios
CREATE OR REPLACE FUNCTION public.normalize_storefront_coupon_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.code = upper(btrim(NEW.code));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_storefront_coupon_code
    BEFORE INSERT OR UPDATE ON public.storefront_coupon
    FOR EACH ROW EXECUTE FUNCTION public.normalize_storefront_coupon_code();

COMMENT ON TABLE public.storefront_coupon IS
    'Cupones de descuento del storefront: porcentaje o monto fijo, con vigencia, mínimo de compra y límite de uso.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Helpers internos (no expuestos a anon)
-- ════════════════════════════════════════════════════════════════════════════

-- Resuelve slug → empresa con tienda activa. Devuelve NULL si no existe o
-- la tienda está desactivada.
CREATE OR REPLACE FUNCTION public.resolve_storefront_company(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
BEGIN
    IF p_slug IS NULL OR btrim(p_slug) = '' THEN
        RETURN NULL;
    END IF;

    SELECT c.id
    INTO v_company_id
    FROM public.company c
    INNER JOIN public.storefront_settings s
        ON s.company_id = c.id
       AND s.is_active = true
       AND COALESCE(s.active, true) = true
    WHERE c.slug = p_slug
      AND c.status = 'active';

    RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_storefront_company(TEXT) FROM PUBLIC;

-- Precio final al consumidor (IVA incluido cuando el producto no lo incluye)
CREATE OR REPLACE FUNCTION public.storefront_display_price(
    p_price DECIMAL,
    p_tax_rate DECIMAL,
    p_tax_included BOOLEAN
)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(p_tax_included, false) THEN ROUND(COALESCE(p_price, 0), 2)
        ELSE ROUND(COALESCE(p_price, 0) * (1 + COALESCE(p_tax_rate, 0) / 100), 2)
    END;
$$;

REVOKE ALL ON FUNCTION public.storefront_display_price(DECIMAL, DECIMAL, BOOLEAN) FROM PUBLIC;

-- Payload de tarjeta de producto (reutilizado por varios RPCs)
CREATE OR REPLACE FUNCTION public.storefront_product_card(p_product_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'name', COALESCE(NULLIF(btrim(p.display_name), ''), p.name),
        'short_description', p.short_description,
        'price', COALESCE(p.sale_price, 0),
        'price_final', public.storefront_display_price(p.sale_price, p.tax_rate, p.tax_included),
        'list_price_final', CASE
            WHEN COALESCE(p.list_price, 0) > COALESCE(p.sale_price, 0)
            THEN public.storefront_display_price(p.list_price, p.tax_rate, p.tax_included)
            ELSE NULL
        END,
        'currency', COALESCE(p.currency, 'MXN'),
        'image_url', p.image_url,
        'featured', COALESCE(p.featured, false),
        'category_id', p.category_id,
        'is_stockable', COALESCE(p.is_stockable, true),
        'stock_available', CASE
            WHEN COALESCE(p.is_stockable, true) THEN GREATEST(COALESCE(p.stock_quantity, 0), 0)
            ELSE NULL
        END,
        'in_stock', (NOT COALESCE(p.is_stockable, true)) OR COALESCE(p.stock_quantity, 0) > 0
    )
    FROM public.product p
    WHERE p.id = p_product_id;
$$;

REVOKE ALL ON FUNCTION public.storefront_product_card(UUID) FROM PUBLIC;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. RPCs públicos
-- ════════════════════════════════════════════════════════════════════════════

-- ── 5.1 get_storefront — branding, textos, categorías y destacados ──────────
CREATE OR REPLACE FUNCTION public.get_storefront(p_slug TEXT)
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
    v_categories JSONB;
    v_featured JSONB;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_company FROM public.company WHERE id = v_company_id;
    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', pc.id,
            'name', pc.name,
            'slug', pc.slug,
            'image_url', pc.image_url,
            'color', pc.color,
            'product_count', (
                SELECT COUNT(*) FROM public.product p
                WHERE p.category_id = pc.id
                  AND p.company_id = v_company_id
                  AND p.is_published = true
                  AND p.can_be_sold = true
                  AND p.status = 'active'
            )
        ) ORDER BY pc.display_order, pc.name
    ), '[]'::jsonb)
    INTO v_categories
    FROM public.product_category pc
    WHERE pc.company_id = v_company_id
      AND pc.is_active = true
      AND EXISTS (
          SELECT 1 FROM public.product p
          WHERE p.category_id = pc.id
            AND p.company_id = v_company_id
            AND p.is_published = true
            AND p.can_be_sold = true
            AND p.status = 'active'
      );

    SELECT COALESCE(jsonb_agg(public.storefront_product_card(x.id) ORDER BY x.rn), '[]'::jsonb)
    INTO v_featured
    FROM (
        SELECT p.id,
               ROW_NUMBER() OVER (ORDER BY p.featured DESC, p.created_at DESC) AS rn
        FROM public.product p
        WHERE p.company_id = v_company_id
          AND p.is_published = true
          AND p.can_be_sold = true
          AND p.status = 'active'
        ORDER BY rn
        LIMIT 8
    ) x;

    RETURN jsonb_build_object(
        'status', 'ok',
        'store', jsonb_build_object(
            'company_id', v_company.id,
            'slug', v_company.slug,
            'name', COALESCE(NULLIF(btrim(v_company.display_name), ''), v_company.name),
            'description', v_company.description,
            'logo_url', v_company.logo_url,
            'banner_url', v_company.banner_url,
            'primary_color', COALESCE(v_company.primary_color, '#6366f1'),
            'currency', COALESCE(v_company.currency, 'MXN'),
            'website', v_company.website,
            'hero_title', v_settings.hero_title,
            'hero_subtitle', v_settings.hero_subtitle,
            'announcement', v_settings.announcement,
            'about_text', v_settings.about_text,
            'contact_email', COALESCE(v_settings.contact_email, v_company.email),
            'contact_phone', COALESCE(v_settings.contact_phone, v_company.phone),
            'contact_address', v_settings.contact_address,
            'policy_shipping', v_settings.policy_shipping,
            'policy_returns', v_settings.policy_returns,
            'policy_privacy', v_settings.policy_privacy,
            'policy_terms', v_settings.policy_terms,
            'show_out_of_stock', COALESCE(v_settings.show_out_of_stock, true)
        ),
        'categories', v_categories,
        'featured_products', v_featured
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront(TEXT) TO anon, authenticated;

-- ── 5.2 get_storefront_products — catálogo con filtros y paginación ─────────
CREATE OR REPLACE FUNCTION public.get_storefront_products(
    p_slug TEXT,
    p_search TEXT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_min_price DECIMAL DEFAULT NULL,
    p_max_price DECIMAL DEFAULT NULL,
    p_only_in_stock BOOLEAN DEFAULT false,
    p_sort TEXT DEFAULT 'relevance',   -- relevance | price_asc | price_desc | newest | best_sellers
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_settings public.storefront_settings%ROWTYPE;
    v_total BIGINT;
    v_products JSONB;
    v_page INT := GREATEST(COALESCE(p_page, 1), 1);
    v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 12), 1), 48);
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;

    WITH base AS (
        SELECT
            p.id,
            p.featured,
            p.created_at,
            public.storefront_display_price(p.sale_price, p.tax_rate, p.tax_included) AS price_final,
            CASE WHEN p_sort = 'best_sellers' THEN (
                SELECT COALESCE(SUM(ol.quantity), 0)
                FROM public.order_line ol
                INNER JOIN public.order o ON o.id = ol.order_id
                WHERE ol.product_id = p.id
                  AND o.order_type = 'sale'
                  AND o.order_state = 'posted'
            ) ELSE 0 END AS sold_qty
        FROM public.product p
        WHERE p.company_id = v_company_id
          AND p.is_published = true
          AND p.can_be_sold = true
          AND p.status = 'active'
          AND (p_category_id IS NULL OR p.category_id = p_category_id)
          AND (
              p_search IS NULL OR btrim(p_search) = ''
              OR p.name ILIKE '%' || btrim(p_search) || '%'
              OR COALESCE(p.description, '') ILIKE '%' || btrim(p_search) || '%'
              OR to_tsvector('spanish', COALESCE(p.name, '') || ' ' || COALESCE(p.description, ''))
                 @@ plainto_tsquery('spanish', btrim(p_search))
          )
          AND (
              (NOT COALESCE(p_only_in_stock, false) AND COALESCE(v_settings.show_out_of_stock, true))
              OR (NOT COALESCE(p.is_stockable, true))
              OR COALESCE(p.stock_quantity, 0) > 0
          )
    ),
    filtered AS (
        SELECT b.*
        FROM base b
        WHERE (p_min_price IS NULL OR b.price_final >= p_min_price)
          AND (p_max_price IS NULL OR b.price_final <= p_max_price)
    ),
    ranked AS (
        SELECT
            f.id,
            ROW_NUMBER() OVER (ORDER BY
                CASE WHEN p_sort = 'price_asc' THEN f.price_final END ASC NULLS LAST,
                CASE WHEN p_sort = 'price_desc' THEN f.price_final END DESC NULLS LAST,
                CASE WHEN p_sort = 'newest' THEN f.created_at END DESC NULLS LAST,
                CASE WHEN p_sort = 'best_sellers' THEN f.sold_qty END DESC NULLS LAST,
                f.featured DESC,
                f.created_at DESC
            ) AS rn
        FROM filtered f
    ),
    paged AS (
        SELECT r.id, r.rn
        FROM ranked r
        ORDER BY r.rn
        LIMIT v_page_size
        OFFSET (v_page - 1) * v_page_size
    )
    SELECT
        (SELECT COUNT(*) FROM filtered),
        COALESCE((SELECT jsonb_agg(public.storefront_product_card(paged.id) ORDER BY paged.rn) FROM paged), '[]'::jsonb)
    INTO v_total, v_products;

    RETURN jsonb_build_object(
        'status', 'ok',
        'total', COALESCE(v_total, 0),
        'page', v_page,
        'page_size', v_page_size,
        'products', v_products
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_products(TEXT, TEXT, UUID, DECIMAL, DECIMAL, BOOLEAN, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_products(TEXT, TEXT, UUID, DECIMAL, DECIMAL, BOOLEAN, TEXT, INT, INT) TO anon, authenticated;

-- ── 5.3 get_storefront_product — detalle + relacionados ─────────────────────
CREATE OR REPLACE FUNCTION public.get_storefront_product(
    p_slug TEXT,
    p_product_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_product public.product%ROWTYPE;
    v_category public.product_category%ROWTYPE;
    v_related JSONB;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_product
    FROM public.product p
    WHERE p.company_id = v_company_id
      AND p.slug = p_product_slug
      AND p.is_published = true
      AND p.can_be_sold = true
      AND p.status = 'active';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_product.category_id IS NOT NULL THEN
        SELECT * INTO v_category
        FROM public.product_category pc
        WHERE pc.id = v_product.category_id;
    END IF;

    SELECT COALESCE(jsonb_agg(public.storefront_product_card(x.id) ORDER BY x.rn), '[]'::jsonb)
    INTO v_related
    FROM (
        SELECT p.id,
               ROW_NUMBER() OVER (ORDER BY p.featured DESC, p.created_at DESC) AS rn
        FROM public.product p
        WHERE p.company_id = v_company_id
          AND p.id <> v_product.id
          AND p.is_published = true
          AND p.can_be_sold = true
          AND p.status = 'active'
          AND (v_product.category_id IS NULL OR p.category_id = v_product.category_id)
        ORDER BY rn
        LIMIT 4
    ) x;

    RETURN jsonb_build_object(
        'status', 'ok',
        'product', public.storefront_product_card(v_product.id) || jsonb_build_object(
            'description', v_product.description,
            'sku', v_product.sku,
            'images', COALESCE(v_product.images, '[]'::jsonb),
            'attributes', COALESCE(v_product.attributes, '{}'::jsonb),
            'tags', COALESCE(to_jsonb(v_product.tags), '[]'::jsonb),
            'tax_rate', COALESCE(v_product.tax_rate, 0),
            'tax_included', COALESCE(v_product.tax_included, false),
            'meta_title', v_product.meta_title,
            'meta_description', v_product.meta_description,
            'category_name', v_category.name,
            'category_slug', v_category.slug
        ),
        'related_products', v_related
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_product(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_product(TEXT, TEXT) TO anon, authenticated;

-- ── 5.4 get_storefront_checkout_info — envíos y métodos de pago ─────────────
CREATE OR REPLACE FUNCTION public.get_storefront_checkout_info(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_shipping JSONB;
    v_payments JSONB;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

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
        'payment_methods', v_payments
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_checkout_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_checkout_info(TEXT) TO anon, authenticated;

-- ── 5.5 validate_storefront_coupon ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_storefront_coupon(
    p_slug TEXT,
    p_code TEXT,
    p_subtotal DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_coupon public.storefront_coupon%ROWTYPE;
    v_discount DECIMAL(15, 2);
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_coupon
    FROM public.storefront_coupon sc
    WHERE sc.company_id = v_company_id
      AND sc.code = upper(btrim(COALESCE(p_code, '')))
      AND COALESCE(sc.active, true) = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'invalid', 'reason', 'El cupón no existe o está inactivo.');
    END IF;

    IF v_coupon.starts_at IS NOT NULL AND CURRENT_DATE < v_coupon.starts_at THEN
        RETURN jsonb_build_object('status', 'invalid', 'reason', 'El cupón aún no está vigente.');
    END IF;

    IF v_coupon.expires_at IS NOT NULL AND CURRENT_DATE > v_coupon.expires_at THEN
        RETURN jsonb_build_object('status', 'invalid', 'reason', 'El cupón ya expiró.');
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('status', 'invalid', 'reason', 'El cupón alcanzó su límite de usos.');
    END IF;

    IF COALESCE(v_coupon.min_purchase, 0) > COALESCE(p_subtotal, 0) THEN
        RETURN jsonb_build_object(
            'status', 'invalid',
            'reason', format('El cupón requiere una compra mínima de %s.', v_coupon.min_purchase)
        );
    END IF;

    IF v_coupon.discount_type = 'percent' THEN
        v_discount = ROUND(COALESCE(p_subtotal, 0) * LEAST(v_coupon.discount_value, 100) / 100, 2);
    ELSE
        v_discount = LEAST(v_coupon.discount_value, COALESCE(p_subtotal, 0));
    END IF;

    RETURN jsonb_build_object(
        'status', 'valid',
        'code', v_coupon.code,
        'description', v_coupon.description,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'discount_amount', v_discount
    );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_storefront_coupon(TEXT, TEXT, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_storefront_coupon(TEXT, TEXT, DECIMAL) TO anon, authenticated;

-- ── 5.6 place_storefront_order — checkout completo (idempotente) ────────────
-- p_customer: { name, email, phone, street, street2, city, state, zip, country_code }
-- p_items:    [ { product_id, quantity } ]  (los precios SIEMPRE se toman del servidor)
CREATE OR REPLACE FUNCTION public.place_storefront_order(
    p_slug TEXT,
    p_checkout_token UUID,
    p_customer JSONB,
    p_items JSONB,
    p_shipping_method_id UUID,
    p_payment_method_id UUID,
    p_coupon_code TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_company public.company%ROWTYPE;
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
            'currency', v_existing.currency
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

    -- Método de pago
    IF NOT EXISTS (
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
        payment_method_id, payment_status,
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
        p_payment_method_id, 'unpaid',
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
        'currency', v_order.currency
    );
END;
$$;

REVOKE ALL ON FUNCTION public.place_storefront_order(TEXT, UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_storefront_order(TEXT, UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- ── 5.7 get_storefront_order — confirmación (requiere email coincidente) ────
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

-- ── 5.8 get_storefront_my_orders — historial del cliente autenticado ────────
CREATE OR REPLACE FUNCTION public.get_storefront_my_orders(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_email TEXT;
    v_orders JSONB;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('status', 'unauthenticated');
    END IF;

    SELECT lower(p.email) INTO v_email
    FROM public.partner p
    WHERE p.user_id = auth.uid()
    LIMIT 1;

    IF v_email IS NULL THEN
        RETURN jsonb_build_object('status', 'ok', 'orders', '[]'::jsonb);
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'order_ref', o.name,
            'order_date', o.order_date,
            'order_state', o.order_state,
            'payment_status', o.payment_status,
            'is_delivered', o.is_delivered,
            'amount_total', o.amount_total,
            'currency', o.currency,
            'line_count', (SELECT COUNT(*) FROM public.order_line ol WHERE ol.order_id = o.id)
        ) ORDER BY o.created_at DESC
    ), '[]'::jsonb)
    INTO v_orders
    FROM public."order" o
    WHERE o.company_id = v_company_id
      AND o.origin = 'storefront'
      AND lower(o.customer_email) = v_email;

    RETURN jsonb_build_object('status', 'ok', 'email', v_email, 'orders', v_orders);
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_my_orders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_my_orders(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Comentarios
-- ════════════════════════════════════════════════════════════════════════════
COMMENT ON FUNCTION public.get_storefront(TEXT) IS
    'Datos públicos de la tienda de una empresa: branding, textos, categorías y destacados.';
COMMENT ON FUNCTION public.get_storefront_products(TEXT, TEXT, UUID, DECIMAL, DECIMAL, BOOLEAN, TEXT, INT, INT) IS
    'Catálogo público con búsqueda, filtros, ordenamiento y paginación.';
COMMENT ON FUNCTION public.get_storefront_product(TEXT, TEXT) IS
    'Detalle público de un producto publicado + productos relacionados.';
COMMENT ON FUNCTION public.get_storefront_checkout_info(TEXT) IS
    'Métodos de envío y de pago disponibles para el checkout de la tienda.';
COMMENT ON FUNCTION public.validate_storefront_coupon(TEXT, TEXT, DECIMAL) IS
    'Valida un cupón contra vigencia, límite de usos y compra mínima.';
COMMENT ON FUNCTION public.place_storefront_order(TEXT, UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT) IS
    'Crea una orden de venta origin=storefront con precios/stock/impuestos validados en servidor. Idempotente por checkout_token.';
COMMENT ON FUNCTION public.get_storefront_order(TEXT, TEXT, TEXT) IS
    'Devuelve una orden del storefront por referencia, solo si el email coincide.';
COMMENT ON FUNCTION public.get_storefront_my_orders(TEXT) IS
    'Historial de órdenes del storefront para el usuario autenticado (por email del partner).';
