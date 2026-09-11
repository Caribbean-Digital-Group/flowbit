-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  add_theme_to_storefront                                                  ║
-- ║                                                                           ║
-- ║  Sistema de plantillas y personalización visual de la tienda en línea.    ║
-- ║  Agrega a storefront_settings la plantilla, la paleta, la tipografía, los ║
-- ║  colores personalizados, las secciones visibles de la portada y los       ║
-- ║  beneficios editables, y los expone en el RPC público get_storefront.     ║
-- ║                                                                           ║
-- ║  Todos los campos son de presentación: no afectan precios, inventario ni  ║
-- ║  el flujo de checkout.                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Plantilla y estilo ──────────────────────────────────────────────────────
ALTER TABLE public.storefront_settings
    ADD COLUMN IF NOT EXISTS theme          VARCHAR(40)  NOT NULL DEFAULT 'aurora',
    ADD COLUMN IF NOT EXISTS palette        VARCHAR(40)  NOT NULL DEFAULT 'indigo',
    ADD COLUMN IF NOT EXISTS font_pairing   VARCHAR(40)  NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS color_primary   VARCHAR(9),
    ADD COLUMN IF NOT EXISTS color_secondary VARCHAR(9),
    ADD COLUMN IF NOT EXISTS color_accent    VARCHAR(9),
    ADD COLUMN IF NOT EXISTS radius_style   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS card_style     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS hero_layout    VARCHAR(20);

COMMENT ON COLUMN public.storefront_settings.theme IS
    'Plantilla de diseño de la tienda (aurora, boutique, impulse, mercado, noir, esencial). Define hero, tarjetas, radios y tipografía por defecto.';
COMMENT ON COLUMN public.storefront_settings.palette IS
    'Paleta de colores predefinida. Los campos color_* la sobrescriben cuando el vendedor personaliza.';
COMMENT ON COLUMN public.storefront_settings.font_pairing IS
    'Par tipográfico (system, editorial, modern, friendly, refined).';
COMMENT ON COLUMN public.storefront_settings.color_primary IS
    'Color de marca en hex (#rrggbb). NULL = usar el de la paleta.';
COMMENT ON COLUMN public.storefront_settings.radius_style IS
    'Redondeo global (sharp, soft, rounded, pill). NULL = el de la plantilla.';
COMMENT ON COLUMN public.storefront_settings.card_style IS
    'Estilo de la tarjeta de producto (elevated, bordered, minimal, overlay). NULL = el de la plantilla.';
COMMENT ON COLUMN public.storefront_settings.hero_layout IS
    'Composición del hero (split, centered, banner, editorial, compact). NULL = el de la plantilla.';

-- ── Secciones de la portada ─────────────────────────────────────────────────
ALTER TABLE public.storefront_settings
    ADD COLUMN IF NOT EXISTS show_categories BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_featured   BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_benefits   BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_story      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS featured_limit  SMALLINT NOT NULL DEFAULT 8,
    ADD COLUMN IF NOT EXISTS hero_cta_label  VARCHAR(60),
    ADD COLUMN IF NOT EXISTS announcement_link VARCHAR(500),
    ADD COLUMN IF NOT EXISTS benefits        JSONB;

COMMENT ON COLUMN public.storefront_settings.featured_limit IS
    'Número de productos destacados en la portada (4 a 12).';
COMMENT ON COLUMN public.storefront_settings.show_story IS
    'Muestra en la portada un bloque con el texto «Quiénes somos» (about_text).';
COMMENT ON COLUMN public.storefront_settings.benefits IS
    'Beneficios de la portada: arreglo JSON de {icon, title, text}. NULL = usar los de ejemplo.';

-- Rango sensato para el número de destacados
ALTER TABLE public.storefront_settings
    DROP CONSTRAINT IF EXISTS storefront_settings_featured_limit_check;
ALTER TABLE public.storefront_settings
    ADD CONSTRAINT storefront_settings_featured_limit_check
    CHECK (featured_limit BETWEEN 4 AND 12);

-- ── Recrear get_storefront incluyendo la configuración de diseño ────────────
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
    v_featured_limit INT;
BEGIN
    v_company_id := public.resolve_storefront_company(p_slug);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_company FROM public.company WHERE id = v_company_id;
    SELECT * INTO v_settings FROM public.storefront_settings WHERE company_id = v_company_id;

    -- El vendedor decide cuántos destacados muestra la portada
    v_featured_limit := LEAST(GREATEST(COALESCE(v_settings.featured_limit, 8), 4), 12);

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
        LIMIT v_featured_limit
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
            'whatsapp_phone', v_settings.whatsapp_phone,
            'policy_shipping', v_settings.policy_shipping,
            'policy_returns', v_settings.policy_returns,
            'policy_privacy', v_settings.policy_privacy,
            'policy_terms', v_settings.policy_terms,
            'show_out_of_stock', COALESCE(v_settings.show_out_of_stock, true),

            -- Diseño de la tienda
            'theme', COALESCE(v_settings.theme, 'aurora'),
            'palette', COALESCE(v_settings.palette, 'indigo'),
            'font_pairing', COALESCE(v_settings.font_pairing, 'system'),
            'color_primary', v_settings.color_primary,
            'color_secondary', v_settings.color_secondary,
            'color_accent', v_settings.color_accent,
            'radius_style', v_settings.radius_style,
            'card_style', v_settings.card_style,
            'hero_layout', v_settings.hero_layout,
            'show_categories', COALESCE(v_settings.show_categories, true),
            'show_featured', COALESCE(v_settings.show_featured, true),
            'show_benefits', COALESCE(v_settings.show_benefits, true),
            'show_story', COALESCE(v_settings.show_story, false),
            'hero_cta_label', v_settings.hero_cta_label,
            'announcement_link', v_settings.announcement_link,
            'benefits', v_settings.benefits
        ),
        'categories', v_categories,
        'featured_products', v_featured
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront(TEXT) TO anon, authenticated;
