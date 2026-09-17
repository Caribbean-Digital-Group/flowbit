-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  create_website_module                                                     ║
-- ║                                                                            ║
-- ║  Sitio web público por empresa (CMS + blog + galería + contacto).          ║
-- ║  Cada company puede publicar un sitio en /sites/[company_slug] gestionado  ║
-- ║  desde el panel: páginas por secciones, menús, blog completo (categorías,  ║
-- ║  etiquetas, autores, comentarios, aplausos), galerías de fotos, formulario ║
-- ║  de contacto, redirecciones y SEO.                                         ║
-- ║                                                                            ║
-- ║  Principios (mismos que el storefront):                                    ║
-- ║   · anon NUNCA lee tablas: todo el contenido público sale por RPCs         ║
-- ║     SECURITY DEFINER que resuelven company_id desde el slug.               ║
-- ║   · Miembros leen y editan contenido; solo admins tocan ajustes, menús y   ║
-- ║     publican (salvo website_settings.members_can_publish).                 ║
-- ║   · Primer uso de Supabase Storage en la plataforma: bucket website-media  ║
-- ║     con rutas {company_id}/... y políticas por prefijo.                    ║
-- ║   · Sin vistas para el cliente. Funciones internas sin EXECUTE para anon.  ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Helpers
-- ════════════════════════════════════════════════════════════════════════════

-- Slug URL-amigable en español: quita acentos, deja [a-z0-9-], máx. 120.
CREATE OR REPLACE FUNCTION public.website_slugify(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT left(
        btrim(
            regexp_replace(
                regexp_replace(
                    lower(translate(COALESCE(p_text, ''),
                        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                        'aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc')),
                    '[^a-z0-9]+', '-', 'g'),
                '-{2,}', '-', 'g'),
            '-'),
        120);
$$;

REVOKE ALL ON FUNCTION public.website_slugify(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.website_slugify(TEXT) TO authenticated;

-- Extrae el company_id del primer segmento de la ruta de un objeto de Storage.
-- Devuelve NULL (en vez de fallar) si el segmento no es un UUID.
CREATE OR REPLACE FUNCTION public.website_media_path_company(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_first TEXT;
BEGIN
    v_first := split_part(COALESCE(p_name, ''), '/', 1);
    IF v_first ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN v_first::uuid;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.website_media_path_company(TEXT) FROM PUBLIC, anon;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. website_settings — configuración del sitio (una fila por empresa)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.website_settings (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID NOT NULL UNIQUE REFERENCES public.company(id) ON DELETE CASCADE,

    is_active              BOOLEAN NOT NULL DEFAULT false,

    -- Identidad
    site_name              VARCHAR(160),
    tagline                VARCHAR(240),
    logo_url               TEXT,
    favicon_url            TEXT,
    og_image_url           TEXT,

    -- Contacto público
    contact_email          VARCHAR(255),
    contact_phone          VARCHAR(50),
    whatsapp_phone         VARCHAR(30),
    contact_address        VARCHAR(500),
    contact_hours          VARCHAR(240),
    map_embed_url          TEXT,
    social_links           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{network, url}]

    -- Diseño (mismas claves que storefront_settings para compartir el motor)
    theme                  VARCHAR(40)  NOT NULL DEFAULT 'aurora',
    palette                VARCHAR(40)  NOT NULL DEFAULT 'indigo',
    font_pairing           VARCHAR(40)  NOT NULL DEFAULT 'system',
    color_primary          VARCHAR(9),
    color_secondary        VARCHAR(9),
    color_accent           VARCHAR(9),
    radius_style           VARCHAR(20),
    header_layout          VARCHAR(20)  NOT NULL DEFAULT 'classic'
                           CHECK (header_layout IN ('classic', 'centered', 'minimal')),
    footer_layout          VARCHAR(20)  NOT NULL DEFAULT 'columns'
                           CHECK (footer_layout IN ('columns', 'simple', 'minimal')),
    footer_text            TEXT,
    show_powered_by        BOOLEAN NOT NULL DEFAULT true,

    -- Barra de anuncio
    announcement           VARCHAR(200),
    announcement_link      VARCHAR(500),

    -- SEO global
    seo_title              VARCHAR(120),
    seo_description        VARCHAR(320),
    noindex                BOOLEAN NOT NULL DEFAULT false,

    -- Página 404
    not_found_title        VARCHAR(160),
    not_found_text         TEXT,

    -- Integración con la tienda en línea
    show_storefront_link   BOOLEAN NOT NULL DEFAULT true,
    storefront_link_label  VARCHAR(40),

    -- Blog
    blog_enabled           BOOLEAN NOT NULL DEFAULT true,
    blog_title             VARCHAR(120),
    blog_description       VARCHAR(320),
    posts_per_page         SMALLINT NOT NULL DEFAULT 9 CHECK (posts_per_page BETWEEN 3 AND 30),
    comments_enabled       BOOLEAN NOT NULL DEFAULT false,
    comments_auto_approve  BOOLEAN NOT NULL DEFAULT false,
    reactions_enabled      BOOLEAN NOT NULL DEFAULT true,

    -- Galería
    gallery_enabled        BOOLEAN NOT NULL DEFAULT true,

    -- Flujo editorial
    members_can_publish    BOOLEAN NOT NULL DEFAULT false,

    -- Reservado para fases posteriores
    custom_domain          VARCHAR(255) UNIQUE,
    lang                   VARCHAR(10)  NOT NULL DEFAULT 'es',

    active                 BOOLEAN DEFAULT true,
    created_at             TIMESTAMPTZ DEFAULT now(),
    updated_at             TIMESTAMPTZ DEFAULT now(),
    created_by             UUID REFERENCES auth.users(id),
    updated_by             UUID REFERENCES auth.users(id)
);

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_website_settings_updated_at
    BEFORE UPDATE ON public.website_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_website_settings_company ON public.website_settings(company_id);
CREATE INDEX idx_website_settings_active  ON public.website_settings(is_active) WHERE is_active = true;

COMMENT ON TABLE public.website_settings IS
    'Configuración del sitio web público de cada empresa (una fila por empresa).';
COMMENT ON COLUMN public.website_settings.members_can_publish IS
    'Si es false, solo owner/admin pueden pasar páginas y posts a publicado/programado.';
COMMENT ON COLUMN public.website_settings.custom_domain IS
    'Reservado: dominio propio del sitio. Sin uso hasta implementar el middleware host → slug.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. website_page — páginas construidas con secciones
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.website_page (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    title            VARCHAR(180) NOT NULL,
    slug             VARCHAR(180),
    status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'archived')),
    is_home          BOOLEAN NOT NULL DEFAULT false,
    layout           VARCHAR(20) NOT NULL DEFAULT 'default'
                     CHECK (layout IN ('default', 'full_width', 'landing')),
    show_title       BOOLEAN NOT NULL DEFAULT false,

    -- Arreglo de secciones tipadas (ver app/utils/website/sections.ts)
    content          JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_version  SMALLINT NOT NULL DEFAULT 1,
    excerpt          VARCHAR(320),

    -- SEO
    seo_title        VARCHAR(120),
    seo_description  VARCHAR(320),
    og_image_url     TEXT,
    canonical_url    VARCHAR(500),
    noindex          BOOLEAN NOT NULL DEFAULT false,
    show_in_search   BOOLEAN NOT NULL DEFAULT true,

    published_at     TIMESTAMPTZ,
    display_order    INT NOT NULL DEFAULT 0,

    active           BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    created_by       UUID REFERENCES auth.users(id),
    updated_by       UUID REFERENCES auth.users(id),

    CONSTRAINT website_page_company_slug_unique UNIQUE (company_id, slug),
    CONSTRAINT website_page_content_is_array CHECK (jsonb_typeof(content) = 'array')
);

ALTER TABLE public.website_page ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_website_page_updated_at
    BEFORE UPDATE ON public.website_page
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_website_page_company ON public.website_page(company_id);
CREATE INDEX idx_website_page_active  ON public.website_page(active);
CREATE INDEX idx_website_page_status  ON public.website_page(company_id, status);
CREATE UNIQUE INDEX idx_website_page_single_home
    ON public.website_page(company_id) WHERE is_home = true AND active = true;
CREATE INDEX idx_website_page_search
    ON public.website_page USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(excerpt, '')));

COMMENT ON TABLE public.website_page IS
    'Páginas del sitio web. content es un arreglo de secciones tipadas renderizadas por Website/SectionRenderer.';

-- Historial de versiones de una página (para deshacer)
CREATE TABLE IF NOT EXISTS public.website_page_revision (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    page_id      UUID NOT NULL REFERENCES public.website_page(id) ON DELETE CASCADE,
    revision_no  INT NOT NULL,
    title        VARCHAR(180) NOT NULL,
    content      JSONB NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE public.website_page_revision ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_website_page_revision_page ON public.website_page_revision(page_id, revision_no DESC);
CREATE INDEX idx_website_page_revision_company ON public.website_page_revision(company_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Menús de navegación
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.website_menu (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    code        VARCHAR(40) NOT NULL,          -- main | footer
    name        VARCHAR(80) NOT NULL,

    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id),
    updated_by  UUID REFERENCES auth.users(id),

    CONSTRAINT website_menu_company_code_unique UNIQUE (company_id, code)
);

ALTER TABLE public.website_menu ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_menu_updated_at
    BEFORE UPDATE ON public.website_menu
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_menu_company ON public.website_menu(company_id);

CREATE TABLE IF NOT EXISTS public.website_menu_item (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    menu_id          UUID NOT NULL REFERENCES public.website_menu(id) ON DELETE CASCADE,
    parent_id        UUID REFERENCES public.website_menu_item(id) ON DELETE SET NULL,

    label            VARCHAR(80) NOT NULL,
    link_type        VARCHAR(20) NOT NULL DEFAULT 'page'
                     CHECK (link_type IN ('home', 'page', 'post', 'category', 'blog', 'gallery', 'galleries', 'storefront', 'url')),
    page_id          UUID REFERENCES public.website_page(id) ON DELETE SET NULL,
    post_id          UUID,                     -- FK se agrega tras crear website_post
    category_id      UUID,                     -- FK se agrega tras crear website_category
    gallery_id       UUID,                     -- FK se agrega tras crear website_gallery
    url              VARCHAR(500),
    open_in_new_tab  BOOLEAN NOT NULL DEFAULT false,
    is_visible       BOOLEAN NOT NULL DEFAULT true,
    display_order    INT NOT NULL DEFAULT 0,

    active           BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    created_by       UUID REFERENCES auth.users(id),
    updated_by       UUID REFERENCES auth.users(id)
);

ALTER TABLE public.website_menu_item ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_menu_item_updated_at
    BEFORE UPDATE ON public.website_menu_item
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_menu_item_company ON public.website_menu_item(company_id);
CREATE INDEX idx_website_menu_item_menu    ON public.website_menu_item(menu_id, display_order);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Biblioteca de medios + bucket de Storage
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.website_media (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    bucket       VARCHAR(60) NOT NULL DEFAULT 'website-media',
    path         TEXT NOT NULL,
    public_url   TEXT NOT NULL,
    file_name    VARCHAR(255),
    mime_type    VARCHAR(120),
    size_bytes   BIGINT,
    width        INT,
    height       INT,
    alt_text     VARCHAR(255),
    title        VARCHAR(160),
    folder       VARCHAR(120) NOT NULL DEFAULT 'general',

    active       BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id),
    updated_by   UUID REFERENCES auth.users(id),

    CONSTRAINT website_media_bucket_path_unique UNIQUE (bucket, path)
);

ALTER TABLE public.website_media ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_media_updated_at
    BEFORE UPDATE ON public.website_media
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_media_company ON public.website_media(company_id, created_at DESC);
CREATE INDEX idx_website_media_active  ON public.website_media(active);
CREATE INDEX idx_website_media_folder  ON public.website_media(company_id, folder);

COMMENT ON TABLE public.website_media IS
    'Metadatos de los archivos subidos al bucket website-media (ruta {company_id}/aaaa/mm/uuid-nombre.ext).';

-- Bucket público de lectura; 10 MB por archivo; solo imágenes, video mp4 y PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'website-media',
    'website-media',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'video/mp4', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "website_media_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "website_media_member_insert" ON storage.objects;
DROP POLICY IF EXISTS "website_media_member_update" ON storage.objects;
DROP POLICY IF EXISTS "website_media_member_delete" ON storage.objects;

CREATE POLICY "website_media_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'website-media');

CREATE POLICY "website_media_member_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'website-media'
        AND public.website_media_path_company(name) IS NOT NULL
        AND public.user_belongs_to_company(public.website_media_path_company(name))
    );

CREATE POLICY "website_media_member_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'website-media'
        AND public.website_media_path_company(name) IS NOT NULL
        AND public.user_belongs_to_company(public.website_media_path_company(name))
    );

CREATE POLICY "website_media_member_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'website-media'
        AND public.website_media_path_company(name) IS NOT NULL
        AND public.user_belongs_to_company(public.website_media_path_company(name))
    );

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Galerías de fotos
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.website_gallery (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name           VARCHAR(160) NOT NULL,
    slug           VARCHAR(160),
    description    TEXT,
    cover_url      TEXT,
    layout         VARCHAR(20) NOT NULL DEFAULT 'grid' CHECK (layout IN ('grid', 'masonry', 'carousel')),
    status         VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    display_order  INT NOT NULL DEFAULT 0,

    active         BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    created_by     UUID REFERENCES auth.users(id),
    updated_by     UUID REFERENCES auth.users(id),

    CONSTRAINT website_gallery_company_slug_unique UNIQUE (company_id, slug)
);

ALTER TABLE public.website_gallery ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_gallery_updated_at
    BEFORE UPDATE ON public.website_gallery
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_gallery_company ON public.website_gallery(company_id, display_order);
CREATE INDEX idx_website_gallery_active  ON public.website_gallery(active);

CREATE TABLE IF NOT EXISTS public.website_gallery_item (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    gallery_id     UUID NOT NULL REFERENCES public.website_gallery(id) ON DELETE CASCADE,
    media_id       UUID REFERENCES public.website_media(id) ON DELETE SET NULL,

    image_url      TEXT NOT NULL,
    alt_text       VARCHAR(255),
    caption        VARCHAR(300),
    display_order  INT NOT NULL DEFAULT 0,

    active         BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    created_by     UUID REFERENCES auth.users(id),
    updated_by     UUID REFERENCES auth.users(id)
);

ALTER TABLE public.website_gallery_item ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_gallery_item_updated_at
    BEFORE UPDATE ON public.website_gallery_item
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_gallery_item_gallery ON public.website_gallery_item(gallery_id, display_order);
CREATE INDEX idx_website_gallery_item_company ON public.website_gallery_item(company_id);

ALTER TABLE public.website_menu_item
    ADD CONSTRAINT website_menu_item_gallery_fk
    FOREIGN KEY (gallery_id) REFERENCES public.website_gallery(id) ON DELETE SET NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Blog — autores, categorías, etiquetas, posts
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.website_author (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    partner_id    UUID REFERENCES public.partner(id) ON DELETE SET NULL,

    display_name  VARCHAR(160) NOT NULL,
    slug          VARCHAR(160),
    role_title    VARCHAR(120),
    bio           TEXT,
    avatar_url    TEXT,
    social_links  JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public     BOOLEAN NOT NULL DEFAULT true,

    active        BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    created_by    UUID REFERENCES auth.users(id),
    updated_by    UUID REFERENCES auth.users(id),

    CONSTRAINT website_author_company_slug_unique UNIQUE (company_id, slug)
);

ALTER TABLE public.website_author ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_author_updated_at
    BEFORE UPDATE ON public.website_author
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_author_company ON public.website_author(company_id);
CREATE INDEX idx_website_author_active  ON public.website_author(active);
CREATE UNIQUE INDEX idx_website_author_partner
    ON public.website_author(company_id, partner_id) WHERE partner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.website_category (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    parent_id      UUID REFERENCES public.website_category(id) ON DELETE SET NULL,

    name           VARCHAR(120) NOT NULL,
    slug           VARCHAR(120),
    description    TEXT,
    color          VARCHAR(9),
    image_url      TEXT,
    display_order  INT NOT NULL DEFAULT 0,
    is_featured    BOOLEAN NOT NULL DEFAULT false,

    active         BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    created_by     UUID REFERENCES auth.users(id),
    updated_by     UUID REFERENCES auth.users(id),

    CONSTRAINT website_category_company_slug_unique UNIQUE (company_id, slug)
);

ALTER TABLE public.website_category ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_category_updated_at
    BEFORE UPDATE ON public.website_category
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_category_company ON public.website_category(company_id, display_order);
CREATE INDEX idx_website_category_active  ON public.website_category(active);

ALTER TABLE public.website_menu_item
    ADD CONSTRAINT website_menu_item_category_fk
    FOREIGN KEY (category_id) REFERENCES public.website_category(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.website_tag (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    name        VARCHAR(60) NOT NULL,
    slug        VARCHAR(60),

    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id),
    updated_by  UUID REFERENCES auth.users(id),

    CONSTRAINT website_tag_company_slug_unique UNIQUE (company_id, slug)
);

ALTER TABLE public.website_tag ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_tag_updated_at
    BEFORE UPDATE ON public.website_tag
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_tag_company ON public.website_tag(company_id);
CREATE INDEX idx_website_tag_active  ON public.website_tag(active);

CREATE TABLE IF NOT EXISTS public.website_post (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    title             VARCHAR(200) NOT NULL,
    subtitle          VARCHAR(300),
    slug              VARCHAR(200),
    status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
    published_at      TIMESTAMPTZ,

    author_id         UUID REFERENCES public.website_author(id) ON DELETE SET NULL,
    category_id       UUID REFERENCES public.website_category(id) ON DELETE SET NULL,

    cover_url         TEXT,
    cover_alt         VARCHAR(255),
    excerpt           VARCHAR(400),

    -- Cuerpo: documento Tiptap (JSON) + HTML saneado en servidor + texto plano
    body              JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
    body_html         TEXT NOT NULL DEFAULT '',
    body_text         TEXT NOT NULL DEFAULT '',
    reading_minutes   SMALLINT NOT NULL DEFAULT 1,
    word_count        INT NOT NULL DEFAULT 0,

    is_featured       BOOLEAN NOT NULL DEFAULT false,
    is_pinned         BOOLEAN NOT NULL DEFAULT false,
    allow_comments    BOOLEAN NOT NULL DEFAULT true,
    related_post_ids  UUID[] NOT NULL DEFAULT '{}',

    -- SEO
    seo_title         VARCHAR(120),
    seo_description   VARCHAR(320),
    og_image_url      TEXT,
    canonical_url     VARCHAR(500),
    noindex           BOOLEAN NOT NULL DEFAULT false,

    -- Contadores mantenidos por triggers / RPCs
    view_count        INT NOT NULL DEFAULT 0,
    clap_count        INT NOT NULL DEFAULT 0,
    comment_count     INT NOT NULL DEFAULT 0,

    search_vector     TSVECTOR GENERATED ALWAYS AS (
                          setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
                          setweight(to_tsvector('spanish', coalesce(subtitle, '') || ' ' || coalesce(excerpt, '')), 'B') ||
                          setweight(to_tsvector('spanish', coalesce(body_text, '')), 'C')
                      ) STORED,

    active            BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id),
    updated_by        UUID REFERENCES auth.users(id),

    CONSTRAINT website_post_company_slug_unique UNIQUE (company_id, slug)
);

ALTER TABLE public.website_post ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_post_updated_at
    BEFORE UPDATE ON public.website_post
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_post_company   ON public.website_post(company_id);
CREATE INDEX idx_website_post_active    ON public.website_post(active);
CREATE INDEX idx_website_post_published ON public.website_post(company_id, status, published_at DESC);
CREATE INDEX idx_website_post_category  ON public.website_post(category_id);
CREATE INDEX idx_website_post_author    ON public.website_post(author_id);
CREATE INDEX idx_website_post_search    ON public.website_post USING gin(search_vector);

COMMENT ON TABLE public.website_post IS
    'Publicaciones del blog. body_html se genera y sanea en servidor (/api/website/render); el público solo recibe body_html.';

ALTER TABLE public.website_menu_item
    ADD CONSTRAINT website_menu_item_post_fk
    FOREIGN KEY (post_id) REFERENCES public.website_post(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.website_post_tag (
    post_id     UUID NOT NULL REFERENCES public.website_post(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES public.website_tag(id) ON DELETE CASCADE,
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (post_id, tag_id)
);

ALTER TABLE public.website_post_tag ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_website_post_tag_tag     ON public.website_post_tag(tag_id);
CREATE INDEX idx_website_post_tag_company ON public.website_post_tag(company_id);

CREATE TABLE IF NOT EXISTS public.website_post_revision (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    post_id      UUID NOT NULL REFERENCES public.website_post(id) ON DELETE CASCADE,
    revision_no  INT NOT NULL,
    title        VARCHAR(200) NOT NULL,
    body         JSONB NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now(),
    created_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE public.website_post_revision ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_website_post_revision_post    ON public.website_post_revision(post_id, revision_no DESC);
CREATE INDEX idx_website_post_revision_company ON public.website_post_revision(company_id);

-- Vistas únicas por visitante y día (alimenta view_count)
CREATE TABLE IF NOT EXISTS public.website_post_view (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES public.website_post(id) ON DELETE CASCADE,
    visitor_id  VARCHAR(64) NOT NULL,
    view_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT website_post_view_unique UNIQUE (post_id, visitor_id, view_date)
);

ALTER TABLE public.website_post_view ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_website_post_view_company ON public.website_post_view(company_id, view_date DESC);

-- Aplausos (estilo Medium): hasta 50 por visitante y post
CREATE TABLE IF NOT EXISTS public.website_reaction (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES public.website_post(id) ON DELETE CASCADE,
    visitor_id  VARCHAR(64) NOT NULL,
    count       SMALLINT NOT NULL DEFAULT 1 CHECK (count BETWEEN 1 AND 50),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT website_reaction_unique UNIQUE (post_id, visitor_id)
);

ALTER TABLE public.website_reaction ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_reaction_updated_at
    BEFORE UPDATE ON public.website_reaction
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_reaction_company ON public.website_reaction(company_id);

-- Comentarios con moderación
CREATE TABLE IF NOT EXISTS public.website_comment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    post_id         UUID NOT NULL REFERENCES public.website_post(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES public.website_comment(id) ON DELETE CASCADE,

    author_name     VARCHAR(120) NOT NULL,
    author_email    VARCHAR(255),
    author_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'spam', 'rejected')),
    visitor_id      VARCHAR(64),
    user_agent      VARCHAR(300),

    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    updated_by      UUID REFERENCES auth.users(id)
);

ALTER TABLE public.website_comment ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_comment_updated_at
    BEFORE UPDATE ON public.website_comment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_comment_company ON public.website_comment(company_id, status, created_at DESC);
CREATE INDEX idx_website_comment_post    ON public.website_comment(post_id, status);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Redirecciones y formulario de contacto
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.website_redirect (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

    from_path     VARCHAR(500) NOT NULL,
    to_path       VARCHAR(500) NOT NULL,
    status_code   SMALLINT NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302)),
    is_automatic  BOOLEAN NOT NULL DEFAULT false,
    hits          INT NOT NULL DEFAULT 0,

    active        BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    created_by    UUID REFERENCES auth.users(id),
    updated_by    UUID REFERENCES auth.users(id),

    CONSTRAINT website_redirect_company_from_unique UNIQUE (company_id, from_path)
);

ALTER TABLE public.website_redirect ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_redirect_updated_at
    BEFORE UPDATE ON public.website_redirect
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_redirect_company ON public.website_redirect(company_id);
CREATE INDEX idx_website_redirect_active  ON public.website_redirect(active);

CREATE TABLE IF NOT EXISTS public.website_contact_submission (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    page_id      UUID REFERENCES public.website_page(id) ON DELETE SET NULL,

    name         VARCHAR(160) NOT NULL,
    email        VARCHAR(255),
    phone        VARCHAR(50),
    subject      VARCHAR(200),
    message      TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_url   VARCHAR(500),
    visitor_id   VARCHAR(64),
    status       VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
    crm_lead_id  UUID REFERENCES public.crm_lead(id) ON DELETE SET NULL,

    active       BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    updated_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE public.website_contact_submission ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_website_contact_submission_updated_at
    BEFORE UPDATE ON public.website_contact_submission
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_website_contact_submission_company
    ON public.website_contact_submission(company_id, status, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Triggers de negocio
-- ════════════════════════════════════════════════════════════════════════════

-- 8.1 Slug único por empresa (página, post, categoría, etiqueta, galería, autor)
CREATE OR REPLACE FUNCTION public.website_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_row       JSONB := to_jsonb(NEW);
    v_source    TEXT;
    v_base      TEXT;
    v_candidate TEXT;
    v_n         INT := 1;
    v_exists    BOOLEAN;
BEGIN
    v_source := COALESCE(
        NULLIF(btrim(NEW.slug), ''),
        v_row ->> 'title',
        v_row ->> 'name',
        v_row ->> 'display_name',
        'item'
    );
    v_base := public.website_slugify(v_source);
    IF v_base = '' THEN
        v_base := 'item';
    END IF;

    -- Rutas fijas del sitio que una página no puede ocupar
    IF TG_TABLE_NAME = 'website_page'
       AND v_base IN ('blog', 'galeria', 'buscar', 'sitemap.xml', 'rss.xml', 'admin', 'api') THEN
        v_base := v_base || '-pagina';
    END IF;

    v_candidate := v_base;
    LOOP
        EXECUTE format(
            'SELECT EXISTS (SELECT 1 FROM public.%I WHERE company_id = $1 AND slug = $2 AND id <> $3)',
            TG_TABLE_NAME
        ) INTO v_exists USING NEW.company_id, v_candidate, NEW.id;
        EXIT WHEN NOT v_exists;
        v_n := v_n + 1;
        v_candidate := left(v_base, 110) || '-' || v_n;
    END LOOP;

    NEW.slug := v_candidate;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_set_slug() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_page_slug     BEFORE INSERT OR UPDATE ON public.website_page     FOR EACH ROW EXECUTE FUNCTION public.website_set_slug();
CREATE TRIGGER trg_website_post_slug     BEFORE INSERT OR UPDATE ON public.website_post     FOR EACH ROW EXECUTE FUNCTION public.website_set_slug();
CREATE TRIGGER trg_website_category_slug BEFORE INSERT OR UPDATE ON public.website_category FOR EACH ROW EXECUTE FUNCTION public.website_set_slug();
CREATE TRIGGER trg_website_tag_slug      BEFORE INSERT OR UPDATE ON public.website_tag      FOR EACH ROW EXECUTE FUNCTION public.website_set_slug();
CREATE TRIGGER trg_website_gallery_slug  BEFORE INSERT OR UPDATE ON public.website_gallery  FOR EACH ROW EXECUTE FUNCTION public.website_set_slug();
CREATE TRIGGER trg_website_author_slug   BEFORE INSERT OR UPDATE ON public.website_author   FOR EACH ROW EXECUTE FUNCTION public.website_set_slug();

-- 8.2 Solo una página de inicio por empresa (marcar una desmarca la anterior)
CREATE OR REPLACE FUNCTION public.website_page_single_home()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_home AND COALESCE(NEW.active, true) THEN
        UPDATE public.website_page
        SET is_home = false
        WHERE company_id = NEW.company_id
          AND id <> NEW.id
          AND is_home = true;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_page_single_home() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_page_single_home
    BEFORE INSERT OR UPDATE OF is_home, active ON public.website_page
    FOR EACH ROW EXECUTE FUNCTION public.website_page_single_home();

-- 8.3 Publicar requiere permiso (admin, o miembros si members_can_publish)
CREATE OR REPLACE FUNCTION public.website_enforce_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_was_public BOOLEAN := false;
    v_allowed    BOOLEAN := false;
BEGIN
    IF NEW.status IN ('published', 'scheduled') THEN
        IF TG_OP = 'UPDATE' THEN
            v_was_public := OLD.status IN ('published', 'scheduled');
        END IF;

        IF NOT v_was_public THEN
            SELECT public.is_company_admin(NEW.company_id)
                   OR COALESCE((SELECT s.members_can_publish
                                FROM public.website_settings s
                                WHERE s.company_id = NEW.company_id), false)
            INTO v_allowed;

            IF NOT COALESCE(v_allowed, false) THEN
                RAISE EXCEPTION 'website_publish_not_allowed'
                    USING HINT = 'Solo los administradores pueden publicar en este sitio.';
            END IF;
        END IF;

        IF NEW.published_at IS NULL THEN
            NEW.published_at := now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_enforce_publish() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_page_publish
    BEFORE INSERT OR UPDATE OF status, published_at ON public.website_page
    FOR EACH ROW EXECUTE FUNCTION public.website_enforce_publish();

CREATE TRIGGER trg_website_post_publish
    BEFORE INSERT OR UPDATE OF status, published_at ON public.website_post
    FOR EACH ROW EXECUTE FUNCTION public.website_enforce_publish();

-- 8.4 Programación de posts: published ↔ scheduled según published_at
CREATE OR REPLACE FUNCTION public.website_post_normalize_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'scheduled' AND (NEW.published_at IS NULL OR NEW.published_at <= now()) THEN
        NEW.status := 'published';
        NEW.published_at := COALESCE(NEW.published_at, now());
    ELSIF NEW.status = 'published' AND NEW.published_at IS NOT NULL AND NEW.published_at > now() THEN
        NEW.status := 'scheduled';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_post_normalize_status() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_post_normalize_status
    BEFORE INSERT OR UPDATE OF status, published_at ON public.website_post
    FOR EACH ROW EXECUTE FUNCTION public.website_post_normalize_status();

-- 8.5 Historial de versiones (últimas 20) para páginas y posts
CREATE OR REPLACE FUNCTION public.website_page_track_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_next INT;
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title <> NEW.title THEN
        SELECT COALESCE(max(revision_no), 0) + 1 INTO v_next
        FROM public.website_page_revision WHERE page_id = OLD.id;

        INSERT INTO public.website_page_revision (company_id, page_id, revision_no, title, content, created_by)
        VALUES (OLD.company_id, OLD.id, v_next, OLD.title, OLD.content, auth.uid());

        DELETE FROM public.website_page_revision
        WHERE page_id = OLD.id AND revision_no <= v_next - 20;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_page_track_revision() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_page_revision
    AFTER UPDATE OF content, title ON public.website_page
    FOR EACH ROW EXECUTE FUNCTION public.website_page_track_revision();

CREATE OR REPLACE FUNCTION public.website_post_track_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_next INT;
BEGIN
    IF OLD.body IS DISTINCT FROM NEW.body OR OLD.title <> NEW.title THEN
        SELECT COALESCE(max(revision_no), 0) + 1 INTO v_next
        FROM public.website_post_revision WHERE post_id = OLD.id;

        INSERT INTO public.website_post_revision (company_id, post_id, revision_no, title, body, created_by)
        VALUES (OLD.company_id, OLD.id, v_next, OLD.title, OLD.body, auth.uid());

        DELETE FROM public.website_post_revision
        WHERE post_id = OLD.id AND revision_no <= v_next - 20;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_post_track_revision() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_post_revision
    AFTER UPDATE OF body, title ON public.website_post
    FOR EACH ROW EXECUTE FUNCTION public.website_post_track_revision();

-- 8.6 Redirección 301 automática al cambiar el slug de contenido publicado
CREATE OR REPLACE FUNCTION public.website_track_slug_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_prefix  TEXT;
    v_from    TEXT;
    v_to      TEXT;
    v_is_home BOOLEAN := COALESCE((to_jsonb(NEW) ->> 'is_home')::boolean, false);
BEGIN
    IF OLD.slug IS NOT NULL AND NEW.slug IS NOT NULL AND OLD.slug <> NEW.slug
       AND OLD.status IN ('published', 'scheduled') AND NOT v_is_home THEN
        v_prefix := CASE WHEN TG_TABLE_NAME = 'website_post' THEN '/blog/' ELSE '/' END;
        v_from := v_prefix || OLD.slug;
        v_to   := v_prefix || NEW.slug;

        INSERT INTO public.website_redirect (company_id, from_path, to_path, status_code, is_automatic, created_by, updated_by)
        VALUES (NEW.company_id, v_from, v_to, 301, true, auth.uid(), auth.uid())
        ON CONFLICT (company_id, from_path) DO UPDATE
            SET to_path = EXCLUDED.to_path, active = true, updated_by = auth.uid();

        -- Encadenar redirecciones previas hacia la ruta nueva y evitar bucles
        UPDATE public.website_redirect SET to_path = v_to
        WHERE company_id = NEW.company_id AND to_path = v_from;

        DELETE FROM public.website_redirect
        WHERE company_id = NEW.company_id AND from_path = to_path;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_track_slug_change() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_page_slug_change
    AFTER UPDATE OF slug ON public.website_page
    FOR EACH ROW EXECUTE FUNCTION public.website_track_slug_change();

CREATE TRIGGER trg_website_post_slug_change
    AFTER UPDATE OF slug ON public.website_post
    FOR EACH ROW EXECUTE FUNCTION public.website_track_slug_change();

-- 8.7 Contadores de aplausos y comentarios aprobados
CREATE OR REPLACE FUNCTION public.website_sync_clap_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_post_id UUID := COALESCE(NEW.post_id, OLD.post_id);
BEGIN
    UPDATE public.website_post
    SET clap_count = (SELECT COALESCE(sum(count), 0) FROM public.website_reaction WHERE post_id = v_post_id)
    WHERE id = v_post_id;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.website_sync_clap_count() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_reaction_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.website_reaction
    FOR EACH ROW EXECUTE FUNCTION public.website_sync_clap_count();

CREATE OR REPLACE FUNCTION public.website_sync_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_post_id UUID := COALESCE(NEW.post_id, OLD.post_id);
BEGIN
    UPDATE public.website_post
    SET comment_count = (
        SELECT count(*) FROM public.website_comment
        WHERE post_id = v_post_id AND status = 'approved' AND COALESCE(active, true)
    )
    WHERE id = v_post_id;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.website_sync_comment_count() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_comment_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.website_comment
    FOR EACH ROW EXECUTE FUNCTION public.website_sync_comment_count();

-- 8.8 Guardia de HTML peligroso (defensa en profundidad; la sanitización real
--     ocurre en servidor antes de guardar)
CREATE OR REPLACE FUNCTION public.website_guard_html()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_text TEXT;
BEGIN
    v_text := CASE WHEN TG_TABLE_NAME = 'website_post' THEN NEW.body_html ELSE NEW.content::text END;

    IF v_text ~* '<\s*script' OR v_text ~* '(href|src|url)\W{0,4}\s*(javascript|vbscript)\s*:' THEN
        RAISE EXCEPTION 'website_unsafe_html'
            USING HINT = 'El contenido incluye código no permitido (<script> o enlaces javascript:).';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.website_guard_html() FROM PUBLIC, anon;

CREATE TRIGGER trg_website_post_guard_html
    BEFORE INSERT OR UPDATE OF body_html ON public.website_post
    FOR EACH ROW EXECUTE FUNCTION public.website_guard_html();

CREATE TRIGGER trg_website_page_guard_html
    BEFORE INSERT OR UPDATE OF content ON public.website_page
    FOR EACH ROW EXECUTE FUNCTION public.website_guard_html();

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Políticas RLS
--    · Miembros (user_belongs_to_company): leen todo y editan contenido.
--    · Admins (is_company_admin): ajustes, menús y redirecciones.
--    · anon: nada directo; solo RPCs.
-- ════════════════════════════════════════════════════════════════════════════

-- website_settings
CREATE POLICY "website_settings_select_member" ON public.website_settings
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_settings_admin_all" ON public.website_settings
    FOR ALL USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));

-- website_page (+ revisiones)
CREATE POLICY "website_page_select_member" ON public.website_page
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_page_insert_member" ON public.website_page
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_page_update_member" ON public.website_page
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));

CREATE POLICY "website_page_revision_select_member" ON public.website_page_revision
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_page_revision_insert_member" ON public.website_page_revision
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_page_revision_delete_member" ON public.website_page_revision
    FOR DELETE USING (public.user_belongs_to_company(company_id));

-- Menús: lectura miembros, escritura admins
CREATE POLICY "website_menu_select_member" ON public.website_menu
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_menu_admin_all" ON public.website_menu
    FOR ALL USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "website_menu_item_select_member" ON public.website_menu_item
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_menu_item_admin_all" ON public.website_menu_item
    FOR ALL USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));

-- Medios: miembros gestionan (incluye borrado físico del registro al eliminar el archivo)
CREATE POLICY "website_media_select_member" ON public.website_media
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_media_insert_member" ON public.website_media
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_media_update_member" ON public.website_media
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_media_delete_member" ON public.website_media
    FOR DELETE USING (public.user_belongs_to_company(company_id));

-- Galerías
CREATE POLICY "website_gallery_select_member" ON public.website_gallery
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_gallery_insert_member" ON public.website_gallery
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_gallery_update_member" ON public.website_gallery
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));

CREATE POLICY "website_gallery_item_select_member" ON public.website_gallery_item
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_gallery_item_insert_member" ON public.website_gallery_item
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_gallery_item_update_member" ON public.website_gallery_item
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_gallery_item_delete_member" ON public.website_gallery_item
    FOR DELETE USING (public.user_belongs_to_company(company_id));

-- Blog
CREATE POLICY "website_author_select_member" ON public.website_author
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_author_insert_member" ON public.website_author
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_author_update_member" ON public.website_author
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));

CREATE POLICY "website_category_select_member" ON public.website_category
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_category_insert_member" ON public.website_category
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_category_update_member" ON public.website_category
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));

CREATE POLICY "website_tag_select_member" ON public.website_tag
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_tag_insert_member" ON public.website_tag
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_tag_update_member" ON public.website_tag
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));

CREATE POLICY "website_post_select_member" ON public.website_post
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_post_insert_member" ON public.website_post
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_post_update_member" ON public.website_post
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));

CREATE POLICY "website_post_tag_select_member" ON public.website_post_tag
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_post_tag_insert_member" ON public.website_post_tag
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_post_tag_delete_member" ON public.website_post_tag
    FOR DELETE USING (public.user_belongs_to_company(company_id));

CREATE POLICY "website_post_revision_select_member" ON public.website_post_revision
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_post_revision_insert_member" ON public.website_post_revision
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_post_revision_delete_member" ON public.website_post_revision
    FOR DELETE USING (public.user_belongs_to_company(company_id));

-- Métricas y engagement: miembros solo leen; las escrituras vienen de RPCs
CREATE POLICY "website_post_view_select_member" ON public.website_post_view
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_reaction_select_member" ON public.website_reaction
    FOR SELECT USING (public.user_belongs_to_company(company_id));

-- Comentarios: miembros moderan
CREATE POLICY "website_comment_select_member" ON public.website_comment
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_comment_update_member" ON public.website_comment
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_comment_delete_member" ON public.website_comment
    FOR DELETE USING (public.user_belongs_to_company(company_id));

-- Redirecciones: miembros leen y crean (el trigger de slug inserta como el
-- editor), admins modifican y eliminan
CREATE POLICY "website_redirect_select_member" ON public.website_redirect
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_redirect_insert_member" ON public.website_redirect
    FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_redirect_update_member" ON public.website_redirect
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));
CREATE POLICY "website_redirect_delete_admin" ON public.website_redirect
    FOR DELETE USING (public.is_company_admin(company_id));

-- Mensajes de contacto: miembros leen y gestionan; la inserción es vía RPC
CREATE POLICY "website_contact_submission_select_member" ON public.website_contact_submission
    FOR SELECT USING (public.user_belongs_to_company(company_id));
CREATE POLICY "website_contact_submission_update_member" ON public.website_contact_submission
    FOR UPDATE USING (public.user_belongs_to_company(company_id)) WITH CHECK (public.user_belongs_to_company(company_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 10. RPCs públicos (rol anon) — SECURITY DEFINER
--     Cada función resuelve company_id desde el slug y filtra por él.
-- ════════════════════════════════════════════════════════════════════════════

-- ¿La sesión actual puede ver borradores de esta empresa? (vista previa)
CREATE OR REPLACE FUNCTION public.website_can_preview(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL AND public.user_belongs_to_company(p_company_id);
$$;

REVOKE ALL ON FUNCTION public.website_can_preview(UUID) FROM PUBLIC, anon;

-- Resuelve la empresa por slug. Sitios inactivos solo se resuelven en vista
-- previa para miembros autenticados.
CREATE OR REPLACE FUNCTION public.resolve_website_company(p_slug TEXT, p_preview BOOLEAN DEFAULT false)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_active     BOOLEAN;
BEGIN
    IF p_slug IS NULL OR btrim(p_slug) = '' THEN
        RETURN NULL;
    END IF;

    SELECT c.id, (COALESCE(s.is_active, false) AND COALESCE(s.active, true))
    INTO v_company_id, v_active
    FROM public.company c
    INNER JOIN public.website_settings s ON s.company_id = c.id
    WHERE c.slug = p_slug
      AND c.status = 'active';

    IF v_company_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF v_active THEN
        RETURN v_company_id;
    END IF;

    IF COALESCE(p_preview, false) AND public.website_can_preview(v_company_id) THEN
        RETURN v_company_id;
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_website_company(TEXT, BOOLEAN) FROM PUBLIC, anon;

-- Autor en formato público
CREATE OR REPLACE FUNCTION public.website_author_json(p_author_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', a.id,
        'slug', a.slug,
        'name', a.display_name,
        'role_title', a.role_title,
        'bio', a.bio,
        'avatar_url', a.avatar_url,
        'social_links', a.social_links,
        'is_public', a.is_public
    ) END
    FROM public.website_author a
    WHERE a.id = p_author_id AND COALESCE(a.active, true);
$$;

REVOKE ALL ON FUNCTION public.website_author_json(UUID) FROM PUBLIC, anon;

-- Tarjeta de post (nunca incluye el cuerpo)
CREATE OR REPLACE FUNCTION public.website_post_card(p_post_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'title', p.title,
        'subtitle', p.subtitle,
        'excerpt', p.excerpt,
        'cover_url', p.cover_url,
        'cover_alt', p.cover_alt,
        'status', p.status,
        'published_at', p.published_at,
        'reading_minutes', p.reading_minutes,
        'is_featured', p.is_featured,
        'is_pinned', p.is_pinned,
        'clap_count', p.clap_count,
        'comment_count', p.comment_count,
        'view_count', p.view_count,
        'author', public.website_author_json(p.author_id),
        'category', (
            SELECT jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'color', c.color)
            FROM public.website_category c
            WHERE c.id = p.category_id AND COALESCE(c.active, true)
        ),
        'tags', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug) ORDER BY t.name), '[]'::jsonb)
            FROM public.website_post_tag pt
            INNER JOIN public.website_tag t ON t.id = pt.tag_id AND COALESCE(t.active, true)
            WHERE pt.post_id = p.id
        )
    )
    FROM public.website_post p
    WHERE p.id = p_post_id;
$$;

REVOKE ALL ON FUNCTION public.website_post_card(UUID) FROM PUBLIC, anon;

-- Menú resuelto a enlaces. href relativo al sitio salvo url/storefront (scoped = false).
CREATE OR REPLACE FUNCTION public.website_menu_json(p_company_id UUID, p_code TEXT, p_company_slug TEXT, p_preview BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH items AS (
        SELECT
            mi.id, mi.parent_id, mi.label, mi.link_type, mi.open_in_new_tab, mi.display_order,
            CASE mi.link_type
                WHEN 'home'       THEN ''
                WHEN 'blog'       THEN '/blog'
                WHEN 'galleries'  THEN '/galeria'
                WHEN 'storefront' THEN '/stores/' || p_company_slug
                WHEN 'url'        THEN mi.url
                WHEN 'page'       THEN (SELECT CASE WHEN pg.is_home THEN '' ELSE '/' || pg.slug END
                                        FROM public.website_page pg WHERE pg.id = mi.page_id)
                WHEN 'post'       THEN (SELECT '/blog/' || po.slug FROM public.website_post po WHERE po.id = mi.post_id)
                WHEN 'category'   THEN (SELECT '/blog/categoria/' || c.slug FROM public.website_category c WHERE c.id = mi.category_id)
                WHEN 'gallery'    THEN (SELECT '/galeria/' || g.slug FROM public.website_gallery g WHERE g.id = mi.gallery_id)
            END AS href,
            mi.link_type IN ('url', 'storefront') AS external,
            CASE mi.link_type
                WHEN 'page' THEN EXISTS (
                    SELECT 1 FROM public.website_page pg
                    WHERE pg.id = mi.page_id AND COALESCE(pg.active, true)
                      AND (p_preview OR pg.status = 'published'))
                WHEN 'post' THEN EXISTS (
                    SELECT 1 FROM public.website_post po
                    WHERE po.id = mi.post_id AND COALESCE(po.active, true)
                      AND (p_preview OR (po.status IN ('published', 'scheduled') AND po.published_at <= now())))
                WHEN 'category' THEN EXISTS (
                    SELECT 1 FROM public.website_category c WHERE c.id = mi.category_id AND COALESCE(c.active, true))
                WHEN 'gallery' THEN EXISTS (
                    SELECT 1 FROM public.website_gallery g
                    WHERE g.id = mi.gallery_id AND COALESCE(g.active, true)
                      AND (p_preview OR g.status = 'published'))
                WHEN 'storefront' THEN EXISTS (
                    SELECT 1 FROM public.storefront_settings ss
                    WHERE ss.company_id = p_company_id AND ss.is_active AND COALESCE(ss.active, true))
                ELSE true
            END AS target_visible
        FROM public.website_menu_item mi
        INNER JOIN public.website_menu m ON m.id = mi.menu_id
        WHERE m.company_id = p_company_id
          AND m.code = p_code
          AND COALESCE(m.active, true)
          AND COALESCE(mi.active, true)
          AND mi.is_visible
    ),
    visible AS (
        SELECT * FROM items WHERE target_visible AND href IS NOT NULL
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', v.id,
            'label', v.label,
            'href', v.href,
            'external', v.external,
            'new_tab', v.open_in_new_tab,
            'children', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object('id', ch.id, 'label', ch.label, 'href', ch.href, 'external', ch.external, 'new_tab', ch.open_in_new_tab)
                    ORDER BY ch.display_order, ch.label
                ), '[]'::jsonb)
                FROM visible ch WHERE ch.parent_id = v.id
            )
        ) ORDER BY v.display_order, v.label
    ), '[]'::jsonb)
    INTO v_result
    FROM visible v
    WHERE v.parent_id IS NULL;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.website_menu_json(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;

-- Datos del sitio (settings + company) en formato público
CREATE OR REPLACE FUNCTION public.website_site_json(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company   public.company%ROWTYPE;
    v_settings  public.website_settings%ROWTYPE;
    v_store_on  BOOLEAN;
    v_home_slug TEXT;
BEGIN
    SELECT * INTO v_company  FROM public.company WHERE id = p_company_id;
    SELECT * INTO v_settings FROM public.website_settings WHERE company_id = p_company_id;

    SELECT EXISTS (
        SELECT 1 FROM public.storefront_settings ss
        WHERE ss.company_id = p_company_id AND ss.is_active AND COALESCE(ss.active, true)
    ) INTO v_store_on;

    SELECT pg.slug INTO v_home_slug
    FROM public.website_page pg
    WHERE pg.company_id = p_company_id AND pg.is_home AND COALESCE(pg.active, true)
    LIMIT 1;

    RETURN jsonb_build_object(
        'company_id', v_company.id,
        'slug', v_company.slug,
        'name', COALESCE(NULLIF(btrim(v_settings.site_name), ''), NULLIF(btrim(v_company.display_name), ''), v_company.name),
        'company_name', v_company.name,
        'tagline', v_settings.tagline,
        'description', v_company.description,
        'logo_url', COALESCE(v_settings.logo_url, v_company.logo_url),
        'favicon_url', v_settings.favicon_url,
        'og_image_url', COALESCE(v_settings.og_image_url, v_company.banner_url),
        'primary_color', COALESCE(v_company.primary_color, '#6366f1'),
        'currency', COALESCE(v_company.currency, 'MXN'),
        'lang', COALESCE(v_settings.lang, 'es'),
        'is_active', COALESCE(v_settings.is_active, false),

        'contact_email', COALESCE(v_settings.contact_email, v_company.email),
        'contact_phone', COALESCE(v_settings.contact_phone, v_company.phone),
        'whatsapp_phone', v_settings.whatsapp_phone,
        'contact_address', COALESCE(v_settings.contact_address,
            NULLIF(concat_ws(', ', v_company.street, v_company.city, v_company.state, v_company.zip), '')),
        'contact_hours', v_settings.contact_hours,
        'map_embed_url', v_settings.map_embed_url,
        'social_links', COALESCE(v_settings.social_links, '[]'::jsonb),

        'theme', COALESCE(v_settings.theme, 'aurora'),
        'palette', COALESCE(v_settings.palette, 'indigo'),
        'font_pairing', COALESCE(v_settings.font_pairing, 'system'),
        'color_primary', v_settings.color_primary,
        'color_secondary', v_settings.color_secondary,
        'color_accent', v_settings.color_accent,
        'radius_style', v_settings.radius_style,
        'header_layout', COALESCE(v_settings.header_layout, 'classic'),
        'footer_layout', COALESCE(v_settings.footer_layout, 'columns'),
        'footer_text', v_settings.footer_text,
        'show_powered_by', COALESCE(v_settings.show_powered_by, true),

        'announcement', v_settings.announcement,
        'announcement_link', v_settings.announcement_link,

        'seo_title', v_settings.seo_title,
        'seo_description', v_settings.seo_description,
        'noindex', COALESCE(v_settings.noindex, false),
        'not_found_title', v_settings.not_found_title,
        'not_found_text', v_settings.not_found_text,

        'blog_enabled', COALESCE(v_settings.blog_enabled, true),
        'blog_title', COALESCE(NULLIF(btrim(v_settings.blog_title), ''), 'Blog'),
        'blog_description', v_settings.blog_description,
        'posts_per_page', COALESCE(v_settings.posts_per_page, 9),
        'comments_enabled', COALESCE(v_settings.comments_enabled, false),
        'reactions_enabled', COALESCE(v_settings.reactions_enabled, true),
        'gallery_enabled', COALESCE(v_settings.gallery_enabled, true),

        'storefront_url', CASE WHEN v_store_on AND COALESCE(v_settings.show_storefront_link, true)
                               THEN '/stores/' || v_company.slug ELSE NULL END,
        'storefront_link_label', COALESCE(NULLIF(btrim(v_settings.storefront_link_label), ''), 'Tienda'),
        'home_slug', v_home_slug
    );
END;
$$;

REVOKE ALL ON FUNCTION public.website_site_json(UUID) FROM PUBLIC, anon;

-- ── get_website — sitio + menús ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_website(p_slug TEXT, p_preview BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_preview    BOOLEAN;
    v_slug       TEXT;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, p_preview);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_preview := COALESCE(p_preview, false) AND public.website_can_preview(v_company_id);
    SELECT slug INTO v_slug FROM public.company WHERE id = v_company_id;

    RETURN jsonb_build_object(
        'status', 'ok',
        'preview', v_preview,
        'site', public.website_site_json(v_company_id),
        'menus', jsonb_build_object(
            'main',   public.website_menu_json(v_company_id, 'main', v_slug, v_preview),
            'footer', public.website_menu_json(v_company_id, 'footer', v_slug, v_preview)
        ),
        'has_posts', EXISTS (
            SELECT 1 FROM public.website_post p
            WHERE p.company_id = v_company_id AND COALESCE(p.active, true)
              AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
        ),
        'has_galleries', EXISTS (
            SELECT 1 FROM public.website_gallery g
            WHERE g.company_id = v_company_id AND COALESCE(g.active, true) AND g.status = 'published'
        ),
        'pages', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('title', pg.title, 'slug', pg.slug, 'is_home', pg.is_home)
                                      ORDER BY pg.display_order, pg.title), '[]'::jsonb)
            FROM public.website_page pg
            WHERE pg.company_id = v_company_id AND COALESCE(pg.active, true) AND pg.status = 'published'
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website(TEXT, BOOLEAN) TO anon, authenticated;

-- ── get_website_page — página por slug (NULL = inicio); registra redirecciones ──
CREATE OR REPLACE FUNCTION public.get_website_page(p_slug TEXT, p_page_slug TEXT DEFAULT NULL, p_preview BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_preview    BOOLEAN;
    v_page       public.website_page%ROWTYPE;
    v_redirect   public.website_redirect%ROWTYPE;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, p_preview);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_preview := COALESCE(p_preview, false) AND public.website_can_preview(v_company_id);

    IF p_page_slug IS NULL OR btrim(p_page_slug) = '' THEN
        SELECT * INTO v_page FROM public.website_page
        WHERE company_id = v_company_id AND is_home AND COALESCE(active, true)
          AND (v_preview OR status = 'published')
        LIMIT 1;
    ELSE
        SELECT * INTO v_page FROM public.website_page
        WHERE company_id = v_company_id AND slug = p_page_slug AND COALESCE(active, true)
          AND (v_preview OR status = 'published')
        LIMIT 1;
    END IF;

    IF v_page.id IS NULL THEN
        -- ¿Existe una redirección para esta ruta?
        IF p_page_slug IS NOT NULL THEN
            SELECT * INTO v_redirect FROM public.website_redirect
            WHERE company_id = v_company_id AND from_path = '/' || p_page_slug AND COALESCE(active, true)
            LIMIT 1;
            IF v_redirect.id IS NOT NULL THEN
                UPDATE public.website_redirect SET hits = hits + 1 WHERE id = v_redirect.id;
                RETURN jsonb_build_object('status', 'redirect', 'to_path', v_redirect.to_path, 'status_code', v_redirect.status_code);
            END IF;
        END IF;
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'page', jsonb_build_object(
            'id', v_page.id,
            'title', v_page.title,
            'slug', v_page.slug,
            'status', v_page.status,
            'is_home', v_page.is_home,
            'layout', v_page.layout,
            'show_title', v_page.show_title,
            'content', v_page.content,
            'excerpt', v_page.excerpt,
            'seo_title', v_page.seo_title,
            'seo_description', v_page.seo_description,
            'og_image_url', v_page.og_image_url,
            'canonical_url', v_page.canonical_url,
            'noindex', v_page.noindex,
            'published_at', v_page.published_at,
            'updated_at', v_page.updated_at
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_page(TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_page(TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- ── get_website_posts — listado con filtros, orden y paginación ─────────────
CREATE OR REPLACE FUNCTION public.get_website_posts(
    p_slug          TEXT,
    p_category      TEXT     DEFAULT NULL,
    p_tag           TEXT     DEFAULT NULL,
    p_author        TEXT     DEFAULT NULL,
    p_search        TEXT     DEFAULT NULL,
    p_page          INT      DEFAULT 1,
    p_page_size     INT      DEFAULT NULL,
    p_sort          TEXT     DEFAULT 'newest',
    p_featured_only BOOLEAN  DEFAULT false,
    p_exclude_id    UUID     DEFAULT NULL,
    p_preview       BOOLEAN  DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id  UUID;
    v_preview     BOOLEAN;
    v_page        INT := GREATEST(COALESCE(p_page, 1), 1);
    v_page_size   INT;
    v_total       INT;
    v_posts       JSONB;
    v_query       TSQUERY;
    v_category_id UUID;
    v_tag_id      UUID;
    v_author_id   UUID;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, p_preview);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_preview := COALESCE(p_preview, false) AND public.website_can_preview(v_company_id);

    SELECT LEAST(GREATEST(COALESCE(p_page_size, s.posts_per_page, 9), 1), 30)
    INTO v_page_size
    FROM public.website_settings s WHERE s.company_id = v_company_id;
    v_page_size := COALESCE(v_page_size, 9);

    IF p_category IS NOT NULL AND btrim(p_category) <> '' THEN
        SELECT id INTO v_category_id FROM public.website_category
        WHERE company_id = v_company_id AND slug = p_category AND COALESCE(active, true);
        IF v_category_id IS NULL THEN
            RETURN jsonb_build_object('status', 'ok', 'total', 0, 'page', v_page, 'page_size', v_page_size, 'posts', '[]'::jsonb);
        END IF;
    END IF;

    IF p_tag IS NOT NULL AND btrim(p_tag) <> '' THEN
        SELECT id INTO v_tag_id FROM public.website_tag
        WHERE company_id = v_company_id AND slug = p_tag AND COALESCE(active, true);
        IF v_tag_id IS NULL THEN
            RETURN jsonb_build_object('status', 'ok', 'total', 0, 'page', v_page, 'page_size', v_page_size, 'posts', '[]'::jsonb);
        END IF;
    END IF;

    IF p_author IS NOT NULL AND btrim(p_author) <> '' THEN
        SELECT id INTO v_author_id FROM public.website_author
        WHERE company_id = v_company_id AND slug = p_author AND COALESCE(active, true);
        IF v_author_id IS NULL THEN
            RETURN jsonb_build_object('status', 'ok', 'total', 0, 'page', v_page, 'page_size', v_page_size, 'posts', '[]'::jsonb);
        END IF;
    END IF;

    IF p_search IS NOT NULL AND btrim(p_search) <> '' THEN
        v_query := websearch_to_tsquery('spanish', left(btrim(p_search), 200));
    END IF;

    WITH filtered AS (
        SELECT p.id, p.published_at, p.is_pinned, p.view_count, p.clap_count,
               CASE WHEN v_query IS NULL THEN 0 ELSE ts_rank(p.search_vector, v_query) END AS rank
        FROM public.website_post p
        WHERE p.company_id = v_company_id
          AND COALESCE(p.active, true)
          AND (v_preview OR (p.status IN ('published', 'scheduled') AND p.published_at <= now()))
          AND (v_preview OR p.status <> 'archived')
          AND (v_category_id IS NULL OR p.category_id = v_category_id
               OR p.category_id IN (SELECT c.id FROM public.website_category c WHERE c.parent_id = v_category_id))
          AND (v_tag_id IS NULL OR EXISTS (SELECT 1 FROM public.website_post_tag pt WHERE pt.post_id = p.id AND pt.tag_id = v_tag_id))
          AND (v_author_id IS NULL OR p.author_id = v_author_id)
          AND (v_query IS NULL OR p.search_vector @@ v_query)
          AND (NOT COALESCE(p_featured_only, false) OR p.is_featured)
          AND (p_exclude_id IS NULL OR p.id <> p_exclude_id)
    ),
    counted AS (SELECT count(*) AS total FROM filtered),
    paged AS (
        SELECT f.id
        FROM filtered f
        ORDER BY
            f.is_pinned DESC,
            CASE WHEN p_sort = 'relevance' AND v_query IS NOT NULL THEN f.rank END DESC NULLS LAST,
            CASE WHEN p_sort = 'popular' THEN f.view_count + f.clap_count * 3 END DESC NULLS LAST,
            CASE WHEN p_sort = 'oldest' THEN f.published_at END ASC NULLS LAST,
            f.published_at DESC NULLS LAST
        LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
    )
    SELECT (SELECT total FROM counted),
           COALESCE((SELECT jsonb_agg(public.website_post_card(paged.id)) FROM paged), '[]'::jsonb)
    INTO v_total, v_posts;

    RETURN jsonb_build_object(
        'status', 'ok',
        'total', COALESCE(v_total, 0),
        'page', v_page,
        'page_size', v_page_size,
        'posts', v_posts
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_posts(TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_posts(TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT, BOOLEAN, UUID, BOOLEAN) TO anon, authenticated;

-- ── get_website_post — post completo + relacionados + comentarios aprobados ──
CREATE OR REPLACE FUNCTION public.get_website_post(p_slug TEXT, p_post_slug TEXT, p_preview BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_preview    BOOLEAN;
    v_post       public.website_post%ROWTYPE;
    v_redirect   public.website_redirect%ROWTYPE;
    v_related    JSONB;
    v_comments   JSONB;
    v_prev       JSONB;
    v_next       JSONB;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, p_preview);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_preview := COALESCE(p_preview, false) AND public.website_can_preview(v_company_id);

    SELECT * INTO v_post FROM public.website_post
    WHERE company_id = v_company_id AND slug = p_post_slug AND COALESCE(active, true)
      AND (v_preview OR (status IN ('published', 'scheduled') AND published_at <= now()))
    LIMIT 1;

    IF v_post.id IS NULL THEN
        SELECT * INTO v_redirect FROM public.website_redirect
        WHERE company_id = v_company_id AND from_path = '/blog/' || p_post_slug AND COALESCE(active, true)
        LIMIT 1;
        IF v_redirect.id IS NOT NULL THEN
            UPDATE public.website_redirect SET hits = hits + 1 WHERE id = v_redirect.id;
            RETURN jsonb_build_object('status', 'redirect', 'to_path', v_redirect.to_path, 'status_code', v_redirect.status_code);
        END IF;
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    -- Relacionados: manuales primero, luego por etiquetas/categoría compartidas
    WITH manual AS (
        SELECT p.id, 0 AS ord, p.published_at
        FROM public.website_post p
        WHERE p.company_id = v_company_id
          AND p.id = ANY (v_post.related_post_ids)
          AND p.id <> v_post.id
          AND COALESCE(p.active, true)
          AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
    ),
    automatic AS (
        SELECT p.id,
               1 AS ord,
               p.published_at,
               (SELECT count(*) FROM public.website_post_tag a
                INNER JOIN public.website_post_tag b ON b.tag_id = a.tag_id
                WHERE a.post_id = v_post.id AND b.post_id = p.id) * 2
               + CASE WHEN p.category_id IS NOT NULL AND p.category_id = v_post.category_id THEN 1 ELSE 0 END AS score
        FROM public.website_post p
        WHERE p.company_id = v_company_id
          AND p.id <> v_post.id
          AND p.id <> ALL (v_post.related_post_ids)
          AND COALESCE(p.active, true)
          AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
    ),
    unioned AS (
        SELECT id, ord, published_at, 1000 AS score FROM manual
        UNION ALL
        SELECT id, ord, published_at, score FROM automatic WHERE score > 0
    ),
    picked AS (
        SELECT id FROM unioned ORDER BY ord, score DESC, published_at DESC LIMIT 3
    )
    SELECT COALESCE(jsonb_agg(public.website_post_card(picked.id)), '[]'::jsonb) INTO v_related FROM picked;

    -- Anterior / siguiente por fecha de publicación
    SELECT jsonb_build_object('slug', p.slug, 'title', p.title) INTO v_prev
    FROM public.website_post p
    WHERE p.company_id = v_company_id AND COALESCE(p.active, true)
      AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
      AND p.published_at < v_post.published_at
    ORDER BY p.published_at DESC LIMIT 1;

    SELECT jsonb_build_object('slug', p.slug, 'title', p.title) INTO v_next
    FROM public.website_post p
    WHERE p.company_id = v_company_id AND COALESCE(p.active, true)
      AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
      AND p.published_at > v_post.published_at
    ORDER BY p.published_at ASC LIMIT 1;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', c.id,
            'parent_id', c.parent_id,
            'author_name', c.author_name,
            'body', c.body,
            'created_at', c.created_at,
            'is_staff', c.author_user_id IS NOT NULL
        ) ORDER BY c.created_at
    ), '[]'::jsonb)
    INTO v_comments
    FROM public.website_comment c
    WHERE c.post_id = v_post.id AND c.status = 'approved' AND COALESCE(c.active, true);

    RETURN jsonb_build_object(
        'status', 'ok',
        'post', public.website_post_card(v_post.id) || jsonb_build_object(
            'body_html', v_post.body_html,
            'word_count', v_post.word_count,
            'allow_comments', v_post.allow_comments,
            'seo_title', v_post.seo_title,
            'seo_description', v_post.seo_description,
            'og_image_url', v_post.og_image_url,
            'canonical_url', v_post.canonical_url,
            'noindex', v_post.noindex,
            'updated_at', v_post.updated_at
        ),
        'related', v_related,
        'previous', v_prev,
        'next', v_next,
        'comments', v_comments
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_post(TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_post(TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- ── get_website_taxonomy — categorías, etiquetas y autores con conteos ──────
CREATE OR REPLACE FUNCTION public.get_website_taxonomy(p_slug TEXT, p_preview BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, p_preview);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'categories', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', c.id, 'name', c.name, 'slug', c.slug, 'description', c.description,
                'color', c.color, 'image_url', c.image_url, 'parent_id', c.parent_id,
                'is_featured', c.is_featured, 'display_order', c.display_order,
                'post_count', (
                    SELECT count(*) FROM public.website_post p
                    WHERE p.company_id = v_company_id AND COALESCE(p.active, true)
                      AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
                      AND (p.category_id = c.id OR p.category_id IN (SELECT ch.id FROM public.website_category ch WHERE ch.parent_id = c.id))
                )
            ) ORDER BY c.display_order, c.name), '[]'::jsonb)
            FROM public.website_category c
            WHERE c.company_id = v_company_id AND COALESCE(c.active, true)
        ),
        'tags', (
            SELECT COALESCE(jsonb_agg(x ORDER BY (x ->> 'post_count')::int DESC, x ->> 'name'), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'id', t.id, 'name', t.name, 'slug', t.slug,
                    'post_count', (
                        SELECT count(*) FROM public.website_post_tag pt
                        INNER JOIN public.website_post p ON p.id = pt.post_id
                        WHERE pt.tag_id = t.id AND COALESCE(p.active, true)
                          AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
                    )
                ) AS x
                FROM public.website_tag t
                WHERE t.company_id = v_company_id AND COALESCE(t.active, true)
            ) s
            WHERE (x ->> 'post_count')::int > 0
        ),
        'authors', (
            SELECT COALESCE(jsonb_agg(public.website_author_json(a.id) || jsonb_build_object(
                'post_count', (
                    SELECT count(*) FROM public.website_post p
                    WHERE p.author_id = a.id AND COALESCE(p.active, true)
                      AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
                )
            ) ORDER BY a.display_name), '[]'::jsonb)
            FROM public.website_author a
            WHERE a.company_id = v_company_id AND COALESCE(a.active, true) AND a.is_public
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_taxonomy(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_taxonomy(TEXT, BOOLEAN) TO anon, authenticated;

-- ── Galerías ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_website_galleries(p_slug TEXT, p_preview BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_preview    BOOLEAN;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, p_preview);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    v_preview := COALESCE(p_preview, false) AND public.website_can_preview(v_company_id);

    RETURN jsonb_build_object(
        'status', 'ok',
        'galleries', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', g.id, 'name', g.name, 'slug', g.slug, 'description', g.description,
                'layout', g.layout, 'status', g.status,
                'cover_url', COALESCE(g.cover_url, (
                    SELECT gi.image_url FROM public.website_gallery_item gi
                    WHERE gi.gallery_id = g.id AND COALESCE(gi.active, true)
                    ORDER BY gi.display_order LIMIT 1)),
                'item_count', (SELECT count(*) FROM public.website_gallery_item gi WHERE gi.gallery_id = g.id AND COALESCE(gi.active, true))
            ) ORDER BY g.display_order, g.name), '[]'::jsonb)
            FROM public.website_gallery g
            WHERE g.company_id = v_company_id AND COALESCE(g.active, true)
              AND (v_preview OR g.status = 'published')
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_galleries(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_galleries(TEXT, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_website_gallery(p_slug TEXT, p_gallery_slug TEXT, p_preview BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_preview    BOOLEAN;
    v_gallery    public.website_gallery%ROWTYPE;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, p_preview);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    v_preview := COALESCE(p_preview, false) AND public.website_can_preview(v_company_id);

    SELECT * INTO v_gallery FROM public.website_gallery
    WHERE company_id = v_company_id AND slug = p_gallery_slug AND COALESCE(active, true)
      AND (v_preview OR status = 'published')
    LIMIT 1;

    IF v_gallery.id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'gallery', jsonb_build_object(
            'id', v_gallery.id, 'name', v_gallery.name, 'slug', v_gallery.slug,
            'description', v_gallery.description, 'layout', v_gallery.layout,
            'cover_url', v_gallery.cover_url, 'updated_at', v_gallery.updated_at,
            'items', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', gi.id, 'image_url', gi.image_url, 'alt_text', gi.alt_text, 'caption', gi.caption
                ) ORDER BY gi.display_order, gi.created_at), '[]'::jsonb)
                FROM public.website_gallery_item gi
                WHERE gi.gallery_id = v_gallery.id AND COALESCE(gi.active, true)
            )
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_gallery(TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_gallery(TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- ── search_website — búsqueda FTS (spanish) en posts y páginas ──────────────
CREATE OR REPLACE FUNCTION public.search_website(p_slug TEXT, p_q TEXT, p_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_query      TSQUERY;
    v_limit      INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
    v_company_id := public.resolve_website_company(p_slug, false);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF p_q IS NULL OR char_length(btrim(p_q)) < 2 THEN
        RETURN jsonb_build_object('status', 'ok', 'query', COALESCE(p_q, ''), 'posts', '[]'::jsonb, 'pages', '[]'::jsonb);
    END IF;

    v_query := websearch_to_tsquery('spanish', left(btrim(p_q), 200));

    RETURN jsonb_build_object(
        'status', 'ok',
        'query', btrim(p_q),
        'posts', (
            SELECT COALESCE(jsonb_agg(public.website_post_card(x.id)), '[]'::jsonb)
            FROM (
                SELECT p.id
                FROM public.website_post p
                WHERE p.company_id = v_company_id AND COALESCE(p.active, true)
                  AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
                  AND p.search_vector @@ v_query
                ORDER BY ts_rank(p.search_vector, v_query) DESC, p.published_at DESC
                LIMIT v_limit
            ) x
        ),
        'pages', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', pg.id, 'title', pg.title, 'slug', pg.slug, 'is_home', pg.is_home, 'excerpt', pg.excerpt
            )), '[]'::jsonb)
            FROM (
                SELECT pg.id, pg.title, pg.slug, pg.is_home, pg.excerpt
                FROM public.website_page pg
                WHERE pg.company_id = v_company_id AND COALESCE(pg.active, true)
                  AND pg.status = 'published' AND pg.show_in_search
                  AND (
                      to_tsvector('spanish', coalesce(pg.title, '') || ' ' || coalesce(pg.excerpt, '')) @@ v_query
                      OR pg.content::text ILIKE '%' || btrim(p_q) || '%'
                  )
                ORDER BY pg.is_home DESC, pg.title
                LIMIT v_limit
            ) pg
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.search_website(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_website(TEXT, TEXT, INT) TO anon, authenticated;

-- ── Engagement: vistas, aplausos, comentarios ───────────────────────────────
CREATE OR REPLACE FUNCTION public.register_website_post_view(p_slug TEXT, p_post_slug TEXT, p_visitor_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_post_id    UUID;
    v_count      INT;
    v_inserted   BOOLEAN := false;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, false);
    IF v_company_id IS NULL OR p_visitor_id IS NULL OR p_visitor_id !~ '^[A-Za-z0-9_-]{8,64}$' THEN
        RETURN jsonb_build_object('status', 'ignored');
    END IF;

    SELECT id INTO v_post_id FROM public.website_post
    WHERE company_id = v_company_id AND slug = p_post_slug AND COALESCE(active, true)
      AND status IN ('published', 'scheduled') AND published_at <= now();
    IF v_post_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    INSERT INTO public.website_post_view (company_id, post_id, visitor_id)
    VALUES (v_company_id, v_post_id, p_visitor_id)
    ON CONFLICT (post_id, visitor_id, view_date) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_inserted := v_count > 0;

    IF v_inserted THEN
        UPDATE public.website_post SET view_count = view_count + 1 WHERE id = v_post_id
        RETURNING view_count INTO v_count;
    ELSE
        SELECT view_count INTO v_count FROM public.website_post WHERE id = v_post_id;
    END IF;

    RETURN jsonb_build_object('status', 'ok', 'view_count', v_count, 'counted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.register_website_post_view(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_website_post_view(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.react_website_post(p_slug TEXT, p_post_slug TEXT, p_visitor_id TEXT, p_count INT DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_post_id    UUID;
    v_enabled    BOOLEAN;
    v_mine       INT;
    v_total      INT;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, false);
    IF v_company_id IS NULL OR p_visitor_id IS NULL OR p_visitor_id !~ '^[A-Za-z0-9_-]{8,64}$' THEN
        RETURN jsonb_build_object('status', 'ignored');
    END IF;

    SELECT COALESCE(reactions_enabled, true) INTO v_enabled FROM public.website_settings WHERE company_id = v_company_id;
    IF NOT COALESCE(v_enabled, true) THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    SELECT id INTO v_post_id FROM public.website_post
    WHERE company_id = v_company_id AND slug = p_post_slug AND COALESCE(active, true)
      AND status IN ('published', 'scheduled') AND published_at <= now();
    IF v_post_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    INSERT INTO public.website_reaction (company_id, post_id, visitor_id, count)
    VALUES (v_company_id, v_post_id, p_visitor_id, LEAST(GREATEST(COALESCE(p_count, 1), 1), 50))
    ON CONFLICT (post_id, visitor_id) DO UPDATE
        SET count = LEAST(public.website_reaction.count + LEAST(GREATEST(COALESCE(p_count, 1), 1), 50), 50)
    RETURNING count INTO v_mine;

    SELECT clap_count INTO v_total FROM public.website_post WHERE id = v_post_id;

    RETURN jsonb_build_object('status', 'ok', 'clap_count', v_total, 'my_count', v_mine);
END;
$$;

REVOKE ALL ON FUNCTION public.react_website_post(TEXT, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.react_website_post(TEXT, TEXT, TEXT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_website_comment(
    p_slug        TEXT,
    p_post_slug   TEXT,
    p_author_name TEXT,
    p_author_email TEXT,
    p_body        TEXT,
    p_parent_id   UUID DEFAULT NULL,
    p_visitor_id  TEXT DEFAULT NULL,
    p_honeypot    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_settings   public.website_settings%ROWTYPE;
    v_post       public.website_post%ROWTYPE;
    v_recent     INT;
    v_status     TEXT;
    v_id         UUID;
BEGIN
    -- Honeypot lleno: bot. Responder ok sin guardar.
    IF p_honeypot IS NOT NULL AND btrim(p_honeypot) <> '' THEN
        RETURN jsonb_build_object('status', 'ok', 'comment_status', 'pending');
    END IF;

    v_company_id := public.resolve_website_company(p_slug, false);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_settings FROM public.website_settings WHERE company_id = v_company_id;
    IF NOT COALESCE(v_settings.comments_enabled, false) THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    SELECT * INTO v_post FROM public.website_post
    WHERE company_id = v_company_id AND slug = p_post_slug AND COALESCE(active, true)
      AND status IN ('published', 'scheduled') AND published_at <= now();
    IF v_post.id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    IF NOT v_post.allow_comments THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    IF p_author_name IS NULL OR char_length(btrim(p_author_name)) < 2 THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_name');
    END IF;
    IF p_body IS NULL OR char_length(btrim(p_body)) < 2 OR char_length(p_body) > 4000 THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_body');
    END IF;
    IF p_author_email IS NOT NULL AND btrim(p_author_email) <> '' AND p_author_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_email');
    END IF;

    -- Rate limit: 5 comentarios por visitante cada 10 minutos
    IF p_visitor_id IS NOT NULL THEN
        SELECT count(*) INTO v_recent FROM public.website_comment
        WHERE company_id = v_company_id AND visitor_id = left(p_visitor_id, 64)
          AND created_at > now() - INTERVAL '10 minutes';
        IF v_recent >= 5 THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'rate_limited');
        END IF;
    END IF;

    IF p_parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.website_comment c WHERE c.id = p_parent_id AND c.post_id = v_post.id AND c.status = 'approved'
    ) THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_parent');
    END IF;

    v_status := CASE WHEN COALESCE(v_settings.comments_auto_approve, false) THEN 'approved' ELSE 'pending' END;

    INSERT INTO public.website_comment (
        company_id, post_id, parent_id, author_name, author_email, author_user_id, body, status, visitor_id
    ) VALUES (
        v_company_id, v_post.id, p_parent_id,
        left(btrim(p_author_name), 120), NULLIF(left(btrim(p_author_email), 255), ''), auth.uid(),
        btrim(p_body), v_status, left(p_visitor_id, 64)
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object('status', 'ok', 'comment_status', v_status, 'comment_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_website_comment(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_website_comment(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- ── submit_website_contact — formulario de contacto ─────────────────────────
CREATE OR REPLACE FUNCTION public.submit_website_contact(
    p_slug       TEXT,
    p_name       TEXT,
    p_email      TEXT,
    p_phone      TEXT,
    p_subject    TEXT,
    p_message    TEXT,
    p_payload    JSONB DEFAULT '{}'::jsonb,
    p_source_url TEXT DEFAULT NULL,
    p_visitor_id TEXT DEFAULT NULL,
    p_honeypot   TEXT DEFAULT NULL,
    p_page_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_recent     INT;
    v_id         UUID;
BEGIN
    IF p_honeypot IS NOT NULL AND btrim(p_honeypot) <> '' THEN
        RETURN jsonb_build_object('status', 'ok');
    END IF;

    v_company_id := public.resolve_website_company(p_slug, false);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF p_name IS NULL OR char_length(btrim(p_name)) < 2 THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_name');
    END IF;
    IF p_message IS NULL OR char_length(btrim(p_message)) < 5 OR char_length(p_message) > 5000 THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_message');
    END IF;
    IF (p_email IS NULL OR btrim(p_email) = '') AND (p_phone IS NULL OR btrim(p_phone) = '') THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'contact_required');
    END IF;
    IF p_email IS NOT NULL AND btrim(p_email) <> '' AND p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'invalid_email');
    END IF;

    -- Rate limit: 5 mensajes por visitante por hora
    IF p_visitor_id IS NOT NULL THEN
        SELECT count(*) INTO v_recent FROM public.website_contact_submission
        WHERE company_id = v_company_id AND visitor_id = left(p_visitor_id, 64)
          AND created_at > now() - INTERVAL '1 hour';
        IF v_recent >= 5 THEN
            RETURN jsonb_build_object('status', 'error', 'code', 'rate_limited');
        END IF;
    END IF;

    INSERT INTO public.website_contact_submission (
        company_id, page_id, name, email, phone, subject, message, payload, source_url, visitor_id
    ) VALUES (
        v_company_id,
        (SELECT id FROM public.website_page WHERE id = p_page_id AND company_id = v_company_id),
        left(btrim(p_name), 160),
        NULLIF(left(btrim(p_email), 255), ''),
        NULLIF(left(btrim(p_phone), 50), ''),
        NULLIF(left(btrim(p_subject), 200), ''),
        btrim(p_message),
        CASE WHEN jsonb_typeof(COALESCE(p_payload, '{}'::jsonb)) = 'object' THEN p_payload ELSE '{}'::jsonb END,
        left(p_source_url, 500),
        left(p_visitor_id, 64)
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object('status', 'ok', 'submission_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_website_contact(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_website_contact(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- ── Sitemap por tenant e índice de sitios activos ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_website_sitemap(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_settings   public.website_settings%ROWTYPE;
BEGIN
    v_company_id := public.resolve_website_company(p_slug, false);
    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    SELECT * INTO v_settings FROM public.website_settings WHERE company_id = v_company_id;
    IF COALESCE(v_settings.noindex, false) THEN
        RETURN jsonb_build_object('status', 'ok', 'entries', '[]'::jsonb);
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'entries', (
            SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                    'loc', CASE WHEN pg.is_home THEN '' ELSE '/' || pg.slug END,
                    'lastmod', pg.updated_at, 'changefreq', 'weekly',
                    'priority', CASE WHEN pg.is_home THEN '1.0' ELSE '0.8' END) AS e
                FROM public.website_page pg
                WHERE pg.company_id = v_company_id AND COALESCE(pg.active, true) AND pg.status = 'published' AND NOT pg.noindex
                UNION ALL
                SELECT jsonb_build_object('loc', '/blog', 'lastmod', max(p.published_at), 'changefreq', 'daily', 'priority', '0.8')
                FROM public.website_post p
                WHERE p.company_id = v_company_id AND COALESCE(p.active, true) AND p.status IN ('published', 'scheduled') AND p.published_at <= now()
                HAVING count(*) > 0 AND COALESCE(v_settings.blog_enabled, true)
                UNION ALL
                SELECT jsonb_build_object('loc', '/blog/' || p.slug, 'lastmod', GREATEST(p.updated_at, p.published_at), 'changefreq', 'monthly', 'priority', '0.7')
                FROM public.website_post p
                WHERE p.company_id = v_company_id AND COALESCE(p.active, true) AND p.status IN ('published', 'scheduled')
                  AND p.published_at <= now() AND NOT p.noindex AND COALESCE(v_settings.blog_enabled, true)
                UNION ALL
                SELECT jsonb_build_object('loc', '/blog/categoria/' || c.slug, 'lastmod', c.updated_at, 'changefreq', 'weekly', 'priority', '0.5')
                FROM public.website_category c
                WHERE c.company_id = v_company_id AND COALESCE(c.active, true) AND COALESCE(v_settings.blog_enabled, true)
                  AND EXISTS (SELECT 1 FROM public.website_post p WHERE p.category_id = c.id AND COALESCE(p.active, true)
                              AND p.status IN ('published', 'scheduled') AND p.published_at <= now())
                UNION ALL
                SELECT jsonb_build_object('loc', '/galeria/' || g.slug, 'lastmod', g.updated_at, 'changefreq', 'monthly', 'priority', '0.5')
                FROM public.website_gallery g
                WHERE g.company_id = v_company_id AND COALESCE(g.active, true) AND g.status = 'published' AND COALESCE(v_settings.gallery_enabled, true)
            ) s
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_sitemap(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_sitemap(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_active_websites()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', c.slug, 'updated_at', s.updated_at) ORDER BY c.slug), '[]'::jsonb)
    FROM public.website_settings s
    INNER JOIN public.company c ON c.id = s.company_id AND c.status = 'active' AND c.slug IS NOT NULL
    WHERE s.is_active AND COALESCE(s.active, true) AND NOT s.noindex;
$$;

REVOKE ALL ON FUNCTION public.get_active_websites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_websites() TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. RPCs de administración (rol authenticated)
-- ════════════════════════════════════════════════════════════════════════════

-- Crea la configuración inicial del sitio: ajustes, menús, páginas y autor.
CREATE OR REPLACE FUNCTION public.initialize_website(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company     public.company%ROWTYPE;
    v_settings_id UUID;
    v_main_menu   UUID;
    v_footer_menu UUID;
    v_home_id     UUID;
    v_about_id    UUID;
    v_contact_id  UUID;
    v_partner_id  UUID;
    v_partner     public.partner%ROWTYPE;
    v_uid         UUID := auth.uid();
    v_name        TEXT;
BEGIN
    IF v_uid IS NULL OR NOT public.is_company_admin(p_company_id) THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;

    SELECT * INTO v_company FROM public.company WHERE id = p_company_id;
    IF v_company.id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF EXISTS (SELECT 1 FROM public.website_settings WHERE company_id = p_company_id) THEN
        RETURN jsonb_build_object('status', 'exists');
    END IF;

    v_name := COALESCE(NULLIF(btrim(v_company.display_name), ''), v_company.name);

    INSERT INTO public.website_settings (
        company_id, site_name, tagline, logo_url, contact_email, contact_phone,
        seo_title, seo_description, blog_title, created_by, updated_by
    ) VALUES (
        p_company_id, v_name, v_company.description, v_company.logo_url, v_company.email, v_company.phone,
        v_name, left(v_company.description, 320), 'Blog', v_uid, v_uid
    ) RETURNING id INTO v_settings_id;

    INSERT INTO public.website_menu (company_id, code, name, created_by, updated_by)
    VALUES (p_company_id, 'main', 'Menú principal', v_uid, v_uid) RETURNING id INTO v_main_menu;
    INSERT INTO public.website_menu (company_id, code, name, created_by, updated_by)
    VALUES (p_company_id, 'footer', 'Pie de página', v_uid, v_uid) RETURNING id INTO v_footer_menu;

    -- Página de inicio con secciones de ejemplo
    INSERT INTO public.website_page (company_id, title, slug, status, is_home, layout, content, published_at, created_by, updated_by)
    VALUES (
        p_company_id, 'Inicio', 'inicio', 'published', true, 'landing',
        jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid()::text, 'type', 'hero', 'style', jsonb_build_object('background', 'primary', 'padding', 'lg', 'align', 'center'),
                'props', jsonb_build_object(
                    'eyebrow', 'Bienvenido',
                    'title', v_name,
                    'subtitle', COALESCE(v_company.description, 'Conoce lo que hacemos y cómo podemos ayudarte.'),
                    'primary_label', 'Contáctanos', 'primary_href', '/contacto',
                    'secondary_label', 'Leer el blog', 'secondary_href', '/blog',
                    'image_url', v_company.banner_url, 'layout', 'split')),
            jsonb_build_object('id', gen_random_uuid()::text, 'type', 'features', 'style', jsonb_build_object('background', 'surface', 'padding', 'lg', 'align', 'center'),
                'props', jsonb_build_object(
                    'eyebrow', 'Lo que ofrecemos', 'title', 'Nuestros servicios', 'columns', 3,
                    'items', jsonb_build_array(
                        jsonb_build_object('icon', 'star', 'title', 'Calidad', 'text', 'Describe aquí tu primera propuesta de valor.'),
                        jsonb_build_object('icon', 'shield', 'title', 'Confianza', 'text', 'Cuenta por qué tus clientes confían en ti.'),
                        jsonb_build_object('icon', 'chat', 'title', 'Atención', 'text', 'Explica cómo acompañas a tus clientes.')))),
            jsonb_build_object('id', gen_random_uuid()::text, 'type', 'blog_latest', 'style', jsonb_build_object('background', 'muted', 'padding', 'lg', 'align', 'left'),
                'props', jsonb_build_object('eyebrow', 'Novedades', 'title', 'Últimas publicaciones', 'limit', 3)),
            jsonb_build_object('id', gen_random_uuid()::text, 'type', 'cta', 'style', jsonb_build_object('background', 'primary', 'padding', 'md', 'align', 'center'),
                'props', jsonb_build_object('title', '¿Hablamos?', 'text', 'Cuéntanos qué necesitas y te respondemos a la brevedad.', 'button_label', 'Escríbenos', 'button_href', '/contacto'))
        ),
        now(), v_uid, v_uid
    ) RETURNING id INTO v_home_id;

    INSERT INTO public.website_page (company_id, title, slug, status, layout, show_title, content, published_at, display_order, created_by, updated_by)
    VALUES (
        p_company_id, 'Nosotros', 'nosotros', 'published', 'default', true,
        jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid()::text, 'type', 'image_text', 'style', jsonb_build_object('background', 'surface', 'padding', 'lg', 'align', 'left'),
                'props', jsonb_build_object('eyebrow', 'Quiénes somos', 'title', 'Nuestra historia',
                    'html', '<p>' || COALESCE(v_company.description, 'Cuenta aquí la historia de tu empresa, tu misión y lo que te hace diferente.') || '</p>',
                    'image_url', v_company.banner_url, 'image_position', 'right'))
        ),
        now(), 10, v_uid, v_uid
    ) RETURNING id INTO v_about_id;

    INSERT INTO public.website_page (company_id, title, slug, status, layout, show_title, content, published_at, display_order, created_by, updated_by)
    VALUES (
        p_company_id, 'Contacto', 'contacto', 'published', 'default', true,
        jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid()::text, 'type', 'contact_form', 'style', jsonb_build_object('background', 'surface', 'padding', 'lg', 'align', 'left'),
                'props', jsonb_build_object('title', 'Escríbenos', 'text', 'Responderemos tu mensaje lo antes posible.', 'show_contact_info', true, 'show_map', true))
        ),
        now(), 20, v_uid, v_uid
    ) RETURNING id INTO v_contact_id;

    INSERT INTO public.website_menu_item (company_id, menu_id, label, link_type, page_id, display_order, created_by, updated_by) VALUES
        (p_company_id, v_main_menu, 'Inicio',   'page', v_home_id,    10, v_uid, v_uid),
        (p_company_id, v_main_menu, 'Nosotros', 'page', v_about_id,   20, v_uid, v_uid),
        (p_company_id, v_main_menu, 'Contacto', 'page', v_contact_id, 40, v_uid, v_uid);
    INSERT INTO public.website_menu_item (company_id, menu_id, label, link_type, display_order, created_by, updated_by) VALUES
        (p_company_id, v_main_menu, 'Blog', 'blog', 30, v_uid, v_uid),
        (p_company_id, v_main_menu, 'Tienda', 'storefront', 50, v_uid, v_uid),
        (p_company_id, v_footer_menu, 'Blog', 'blog', 10, v_uid, v_uid);
    INSERT INTO public.website_menu_item (company_id, menu_id, label, link_type, page_id, display_order, created_by, updated_by) VALUES
        (p_company_id, v_footer_menu, 'Nosotros', 'page', v_about_id,   20, v_uid, v_uid),
        (p_company_id, v_footer_menu, 'Contacto', 'page', v_contact_id, 30, v_uid, v_uid);

    -- Autor para el usuario que inicializa
    v_partner_id := public.current_user_partner_row_id();
    IF v_partner_id IS NOT NULL THEN
        SELECT * INTO v_partner FROM public.partner WHERE id = v_partner_id;
        INSERT INTO public.website_author (company_id, partner_id, display_name, role_title, created_by, updated_by)
        VALUES (p_company_id, v_partner_id, COALESCE(NULLIF(btrim(v_partner.display_name), ''), v_partner.name), v_partner.function, v_uid, v_uid)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object('status', 'ok', 'settings_id', v_settings_id, 'home_page_id', v_home_id);
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_website(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_website(UUID) TO authenticated;

-- Sincroniza las etiquetas de un post a partir de nombres (crea las que falten)
CREATE OR REPLACE FUNCTION public.set_website_post_tags(p_post_id UUID, p_tag_names TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_name       TEXT;
    v_tag_id     UUID;
    v_keep       UUID[] := '{}';
    v_uid        UUID := auth.uid();
BEGIN
    SELECT company_id INTO v_company_id FROM public.website_post WHERE id = p_post_id;
    IF v_company_id IS NULL OR v_uid IS NULL OR NOT public.user_belongs_to_company(v_company_id) THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;

    FOREACH v_name IN ARRAY COALESCE(p_tag_names, '{}') LOOP
        v_name := left(btrim(v_name), 60);
        CONTINUE WHEN v_name = '';

        SELECT id INTO v_tag_id FROM public.website_tag
        WHERE company_id = v_company_id AND (lower(name) = lower(v_name) OR slug = public.website_slugify(v_name))
        LIMIT 1;

        IF v_tag_id IS NULL THEN
            INSERT INTO public.website_tag (company_id, name, created_by, updated_by)
            VALUES (v_company_id, v_name, v_uid, v_uid) RETURNING id INTO v_tag_id;
        ELSE
            UPDATE public.website_tag SET active = true WHERE id = v_tag_id AND COALESCE(active, true) = false;
        END IF;

        v_keep := array_append(v_keep, v_tag_id);
        INSERT INTO public.website_post_tag (post_id, tag_id, company_id)
        VALUES (p_post_id, v_tag_id, v_company_id)
        ON CONFLICT DO NOTHING;
    END LOOP;

    DELETE FROM public.website_post_tag WHERE post_id = p_post_id AND tag_id <> ALL (v_keep);

    RETURN jsonb_build_object('status', 'ok', 'tag_ids', to_jsonb(v_keep));
END;
$$;

REVOKE ALL ON FUNCTION public.set_website_post_tags(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_website_post_tags(UUID, TEXT[]) TO authenticated;

-- Convierte un mensaje de contacto en un lead del CRM
CREATE OR REPLACE FUNCTION public.convert_website_submission_to_lead(p_submission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sub      public.website_contact_submission%ROWTYPE;
    v_stage_id UUID;
    v_lead_id  UUID;
    v_uid      UUID := auth.uid();
BEGIN
    SELECT * INTO v_sub FROM public.website_contact_submission WHERE id = p_submission_id;
    IF v_sub.id IS NULL OR v_uid IS NULL OR NOT public.user_belongs_to_company(v_sub.company_id) THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;
    IF v_sub.crm_lead_id IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'exists', 'lead_id', v_sub.crm_lead_id);
    END IF;

    SELECT id INTO v_stage_id FROM public.crm_lead_stage
    WHERE company_id = v_sub.company_id AND active AND NOT is_won AND NOT is_lost
    ORDER BY sequence LIMIT 1;
    IF v_stage_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'code', 'no_stage');
    END IF;

    INSERT INTO public.crm_lead (
        company_id, name, contact_name, contact_email, contact_phone, origin, description, stage_id, tags, created_by, updated_by
    ) VALUES (
        v_sub.company_id,
        left(COALESCE(NULLIF(btrim(v_sub.subject), ''), 'Contacto web: ' || v_sub.name), 255),
        v_sub.name, v_sub.email, v_sub.phone, 'web',
        v_sub.message, v_stage_id, ARRAY['sitio-web'], v_uid, v_uid
    ) RETURNING id INTO v_lead_id;

    UPDATE public.website_contact_submission
    SET crm_lead_id = v_lead_id, status = CASE WHEN status = 'new' THEN 'read' ELSE status END, updated_by = v_uid
    WHERE id = v_sub.id;

    RETURN jsonb_build_object('status', 'ok', 'lead_id', v_lead_id);
END;
$$;

REVOKE ALL ON FUNCTION public.convert_website_submission_to_lead(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_website_submission_to_lead(UUID) TO authenticated;

-- Resumen para el panel del sitio
CREATE OR REPLACE FUNCTION public.get_website_admin_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(p_company_id) THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'pages_published', (SELECT count(*) FROM public.website_page WHERE company_id = p_company_id AND COALESCE(active, true) AND status = 'published'),
        'pages_draft',     (SELECT count(*) FROM public.website_page WHERE company_id = p_company_id AND COALESCE(active, true) AND status = 'draft'),
        'posts_published', (SELECT count(*) FROM public.website_post WHERE company_id = p_company_id AND COALESCE(active, true) AND status = 'published'),
        'posts_scheduled', (SELECT count(*) FROM public.website_post WHERE company_id = p_company_id AND COALESCE(active, true) AND status = 'scheduled'),
        'posts_draft',     (SELECT count(*) FROM public.website_post WHERE company_id = p_company_id AND COALESCE(active, true) AND status = 'draft'),
        'views_30d',       (SELECT count(*) FROM public.website_post_view WHERE company_id = p_company_id AND view_date >= CURRENT_DATE - 30),
        'claps_total',     (SELECT COALESCE(sum(clap_count), 0) FROM public.website_post WHERE company_id = p_company_id AND COALESCE(active, true)),
        'comments_pending',(SELECT count(*) FROM public.website_comment WHERE company_id = p_company_id AND status = 'pending' AND COALESCE(active, true)),
        'submissions_new', (SELECT count(*) FROM public.website_contact_submission WHERE company_id = p_company_id AND status = 'new' AND COALESCE(active, true)),
        'media_count',     (SELECT count(*) FROM public.website_media WHERE company_id = p_company_id AND COALESCE(active, true)),
        'media_bytes',     (SELECT COALESCE(sum(size_bytes), 0) FROM public.website_media WHERE company_id = p_company_id AND COALESCE(active, true)),
        'top_posts', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'slug', p.slug, 'view_count', p.view_count, 'clap_count', p.clap_count) ORDER BY p.view_count DESC), '[]'::jsonb)
            FROM (SELECT * FROM public.website_post WHERE company_id = p_company_id AND COALESCE(active, true) AND status = 'published' ORDER BY view_count DESC LIMIT 5) p
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_website_admin_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_website_admin_stats(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 12. Comentarios finales
-- ════════════════════════════════════════════════════════════════════════════
COMMENT ON FUNCTION public.get_website(TEXT, BOOLEAN) IS
    'Sitio web público de una empresa por slug: settings, menús y banderas. p_preview permite a miembros ver sitios inactivos.';
COMMENT ON FUNCTION public.get_website_post(TEXT, TEXT, BOOLEAN) IS
    'Post completo con autor, etiquetas, relacionados, anterior/siguiente y comentarios aprobados. Devuelve redirect si el slug cambió.';
COMMENT ON FUNCTION public.initialize_website(UUID) IS
    'Crea settings, menús, páginas de ejemplo y autor inicial. Solo owner/admin de la empresa.';
