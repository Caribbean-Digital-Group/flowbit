-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  add_whatsapp_to_storefront                                                ║
-- ║                                                                           ║
-- ║  Agrega el número de WhatsApp de contacto a la configuración de la tienda ║
-- ║  (storefront_settings.whatsapp_phone) y lo expone en el RPC público       ║
-- ║  get_storefront para mostrar el botón flotante de mensajería y compartir  ║
-- ║  la orden por WhatsApp en el storefront.                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Nueva columna ───────────────────────────────────────────────────────────
ALTER TABLE public.storefront_settings
    ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(30);

COMMENT ON COLUMN public.storefront_settings.whatsapp_phone IS
    'Número de WhatsApp de contacto (formato internacional, solo dígitos, ej: 529982XXXXXX) para el botón de mensajería del storefront.';

-- ── Recrear get_storefront incluyendo whatsapp_phone ────────────────────────
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
            'whatsapp_phone', v_settings.whatsapp_phone,
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
