# Website — CMS y blog por empresa

Cada `company` de Flowbit puede publicar un **sitio web público** en
`/sites/[company_slug]`, gestionado desde el panel (**Sitio web** en el sidebar):
páginas construidas con secciones, menús, blog completo (categorías, etiquetas,
autores, comentarios, aplausos, RSS), galerías de fotos, formulario de contacto
integrado con el CRM, biblioteca de medios, redirecciones y SEO.

Es un CMS estilo WordPress con un blog estilo Medium; toma como referencia de
producto el módulo *Website* de Odoo. El análisis previo que originó el diseño
está resumido al final del documento.

---

## Cómo publicar un sitio

1. **Sitio web → Ajustes del sitio** (`/admin/website`) y pulsar **«Crear mi sitio web»**
   (solo owner/admin). El RPC `initialize_website` genera: `website_settings`,
   los menús `main` y `footer`, las páginas *Inicio* (landing con hero,
   características, últimas publicaciones y CTA), *Nosotros* y *Contacto* (con
   formulario), y el perfil de autor del usuario.
2. Confirmar el **slug** de la empresa (compartido con la tienda en línea).
3. Completar identidad, contacto, redes y **diseño** (plantilla, paleta,
   tipografía; opción «Copiar el diseño de mi tienda»).
4. Editar páginas, menú y escribir en el blog. Revisar con **Vista previa**
   (`?preview=1`, solo miembros).
5. Activar el switch **Estado del sitio**. Queda en
   `NUXT_PUBLIC_SITE_URL/sites/{slug}`, con sitemap propio y RSS.

## Rutas públicas (layout `website`)

| Ruta | Contenido |
|---|---|
| `/sites/[slug]` | Página marcada como inicio |
| `/sites/[slug]/[page_slug]` | Página publicada |
| `/sites/[slug]/blog` | Portada del blog: destacado, grid paginado, categorías, etiquetas, búsqueda, RSS |
| `/sites/[slug]/blog/[post_slug]` | Post: portada, autor, tiempo de lectura, cuerpo, etiquetas, aplausos, compartir, anterior/siguiente, comentarios, relacionados, JSON-LD `Article` |
| `/sites/[slug]/blog/categoria/[slug]` · `/blog/etiqueta/[slug]` · `/blog/autor/[slug]` | Listados filtrados |
| `/sites/[slug]/blog/rss.xml` | Feed RSS 2.0 (ruta Nitro) |
| `/sites/[slug]/galeria` · `/galeria/[gallery_slug]` | Galerías (cuadrícula, mosaico o carrusel) con visor |
| `/sites/[slug]/buscar?q=` | Búsqueda FTS `spanish` en posts y páginas |
| `/sites/[slug]/sitemap.xml` | Sitemap del tenant (ruta Nitro) |

Si el slug no existe, la empresa no está activa o `website_settings.is_active`
es `false`, se muestra «Sitio no disponible» (los RPCs devuelven `not_found`).
Con `?preview=1`, un miembro autenticado ve el sitio inactivo y el contenido en
borrador (los RPCs reciben `p_preview = true` y lo validan con
`website_can_preview`).

## Panel admin (`/admin/website/**`)

| Ruta | Vista |
|---|---|
| `/admin/website` | Ajustes por pestañas (general, identidad y contacto, diseño, blog y comunidad, SEO y avanzado), estadísticas y accesos rápidos |
| `/admin/website/pages` · `/create` · `/[id]` | Páginas y **constructor de secciones** (lista + formulario + vista previa en vivo, escritorio/celular, historial de 20 versiones) |
| `/admin/website/menus` | Menú principal y pie (dos niveles, reordenable) |
| `/admin/website/blog/posts` · `/create` · `/[id]` | Posts con editor **Tiptap** y panel lateral (estado, programación, autor, categoría, etiquetas, portada, relacionados, SEO) |
| `/admin/website/blog/categories` · `/tags` · `/authors` · `/comments` | Taxonomía, autores y moderación |
| `/admin/website/media` | Biblioteca de medios (subida, carpetas, alt text, borrado) |
| `/admin/website/galleries` · `/[id]` | Galerías y sus fotos |
| `/admin/website/submissions` | Mensajes del formulario → **crear lead en CRM** |
| `/admin/website/redirects` | Redirecciones 301/302 (manuales y automáticas) |

## Arquitectura y decisiones

### Acceso público a datos
Como en el storefront, **`anon` nunca lee tablas**: todo pasa por RPCs
`SECURITY DEFINER` que resuelven `company_id` desde el slug
(`resolve_website_company`) y filtran por él. Migración
`supabase/migrations/20260916180000_create_website_module.sql`:

- `get_website(slug, preview)` — settings + company, menús resueltos a `href`, banderas.
- `get_website_page(slug, page_slug, preview)` — página (NULL = inicio); devuelve `redirect` si la ruta tiene una redirección y contabiliza el hit.
- `get_website_posts(...)` — filtros por categoría (incluye hijas), etiqueta, autor, búsqueda, destacados; orden `newest|oldest|popular|relevance`; paginación.
- `get_website_post(slug, post_slug, preview)` — post + autor + etiquetas + relacionados (manuales ∪ automáticos por etiquetas/categoría) + anterior/siguiente + comentarios aprobados.
- `get_website_taxonomy`, `get_website_galleries`, `get_website_gallery`, `search_website`, `get_website_sitemap`, `get_active_websites`.
- Engagement: `register_website_post_view` (una vista por visitante y día), `react_website_post` (hasta 50 aplausos por visitante), `submit_website_comment` y `submit_website_contact` (honeypot + rate limit por `visitor_id` en BD).

Solo `authenticated`: `initialize_website`, `set_website_post_tags` (crea
etiquetas al vuelo), `convert_website_submission_to_lead`, `get_website_admin_stats`.

### Modelo de datos (19 tablas `website_*`)
`website_settings` (una por empresa), `website_page` + `website_page_revision`,
`website_menu` + `website_menu_item`, `website_media`, `website_gallery` +
`website_gallery_item`, `website_author`, `website_category` (jerárquica),
`website_tag`, `website_post` + `website_post_tag` + `website_post_revision` +
`website_post_view`, `website_reaction`, `website_comment`, `website_redirect`,
`website_contact_submission`. Todas con `company_id`, RLS, auditoría,
`active` y `update_updated_at_column`.

Triggers: slug único por empresa (`website_set_slug`, rutas reservadas
`blog|galeria|buscar`), una sola página de inicio, **permiso de publicación**
(`website_enforce_publish`: admin o `members_can_publish`), normalización
`published ↔ scheduled` por `published_at`, historial de 20 revisiones,
**redirección 301 automática** al cambiar el slug de contenido publicado,
contadores de aplausos/comentarios y guardia de HTML peligroso.

### Contenido y sanitización
- El cuerpo de los posts es un documento **Tiptap (JSON)**. Al guardar, el
  cliente llama a `POST /api/website/render` (exige sesión, rate limit por IP),
  que genera el HTML con las mismas extensiones del editor (`@tiptap/html`),
  lo pasa por **sanitize-html** (lista blanca de etiquetas, `href`/`src`
  solo `http(s)|mailto|tel`, iframes solo de YouTube, Vimeo, Google Maps y
  OpenStreetMap) y calcula texto plano, palabras, tiempo de lectura y extracto.
  El público solo recibe `body_html`.
- Las secciones con HTML (`text`, `image_text`, `html`) se sanean con el mismo
  endpoint antes de guardar la página. Un trigger en BD rechaza además
  `<script` y URLs `javascript:` como defensa en profundidad.
- Programación: un post con `published_at` futuro queda `scheduled` y los RPCs
  lo muestran solo cuando `published_at <= now()` (sin pg_cron).

### Secciones (constructor de páginas)
`app/utils/website/sections.ts` es la fuente única del catálogo (19 tipos:
hero, texto, imagen y texto, características, cifras, galería, testimonios,
precios, FAQ, equipo, CTA, logos, video, mapa, formulario de contacto,
últimas publicaciones, productos de la tienda, HTML, separador). Define
etiqueta, campos del editor, props por defecto y estilo (`background`,
`padding`, `align`). `normalizeSections` valida el JSON guardado.
`Website/SectionRenderer.vue` renderiza tanto el sitio público como la vista
previa del editor (`Website/PageEditor.vue`), así lo que se edita es lo que se
publica.

### Tema compartido con la tienda
El sitio reutiliza el motor `app/utils/storefrontTheme.ts` y las utilidades
`sf-*` de `storefront.css`; `app/assets/css/website.css` añade fondos de
sección, prosa del blog y utilidades `ws-*`. Las columnas de diseño de
`website_settings` replican las de `storefront_settings` para poder copiar el
diseño de la tienda con un clic. Regla: ningún componente escribe colores
literales.

### Storage (primer uso en la plataforma)
Bucket público **`website-media`** (10 MB, imágenes/MP4/PDF). Rutas
`{company_id}/aaaa/mm/uuid-nombre.ext`; políticas sobre `storage.objects`
verifican `user_belongs_to_company` con el primer segmento
(`website_media_path_company`). `useWebsiteMedia` sube, registra en
`website_media` y elimina; `Website/MediaPicker.vue` e `ImageField.vue` se usan
en todo el módulo.

### SEO
`useHead` por página y post (título, descripción, OG/Twitter, canonical,
noindex), JSON-LD `Organization`, `Article` y `BreadcrumbList`, sitemap por
tenant, `robots.txt` con un `Sitemap:` por sitio activo y `Disallow` de la
búsqueda, portada de cada sitio en el sitemap raíz, RSS.

### Tipos
`types/website.types.ts` es un shim (patrón `StorefrontDatabase`) hasta
regenerar `npm run db:types`; los RPCs se llaman con cast `as never`.

## Archivos principales

| Capa | Archivos |
|---|---|
| Migraciones | `supabase/migrations/20260916180000_create_website_module.sql`, `20260916190000_fix_website_guard_html.sql` (trigger compartido leído como JSONB) |
| Tipos | `types/website.types.ts` |
| Utils | `app/utils/website.ts`, `app/utils/website/sections.ts` |
| Servidor | `server/utils/websiteContent.ts`, `server/utils/websitePublic.ts`, `server/api/website/render.post.ts`, `server/routes/sites/[slug]/sitemap.xml.ts`, `server/routes/sites/[slug]/blog/rss.xml.ts` |
| Composables | `useWebsite` (público), `useWebsiteContent`, `useWebsiteSettings`, `useWebsitePage`, `useWebsiteMenu`, `useWebsiteMedia`, `useWebsiteGallery`, `useWebsiteAuthor`, `useWebsiteCategory`, `useWebsiteTag`, `useWebsitePost`, `useWebsiteComment`, `useWebsiteSubmission`, `useWebsiteRedirect`, `useWebsiteTheme`, `useWebsiteNav` |
| Estado | `app/stores/website.ts` |
| Layout / estilos | `app/layouts/website.vue`, `app/assets/css/website.css` |
| Público | `app/pages/sites/[company_slug]/**`, `app/components/Website/*` (SectionRenderer, Section/*, PostCard, PostListing, Comments, ClapButton, ShareBar, Lightbox…) |
| Admin | `app/pages/admin/website/**`, `Website/PageEditor|SectionList|SectionEditor|RichTextEditor|MediaPicker|MenuEditor.vue`, `WebsitePage|WebsitePost|WebsiteCategory|WebsiteAuthor|WebsiteGallery|WebsiteRedirect/Form.vue` |
| Manual | artículos `website-*` en `app/utils/manual/articles.ts`, módulo y ruta en `paths.ts` |

## Pendientes y fases posteriores

- **Aplicar la migración y regenerar tipos** desde la terminal del equipo:
  `npm run db:push && npm run db:types`, luego sustituir el shim.
- Dominio personalizado por empresa (columna `custom_domain` reservada; falta
  middleware `host → slug` y alias en Netlify).
- Analítica del sitio con el pipeline first-party del storefront
  (`surface = 'website'`).
- Suscripción por correo (newsletter) y edición *inline* en el lienzo.
- Multi-idioma (`lang` reservado).

## Resumen del análisis previo

Se evaluó Odoo Website, WordPress y Medium frente a la plataforma. Se
reutilizaron el precedente del storefront (slug, RPCs `anon`, motor de temas,
SEO), los helpers RLS y la búsqueda `spanish`; las brechas cubiertas fueron
Supabase Storage (inexistente), editor de texto enriquecido (Tiptap y
sanitize-html, primeras dependencias de UI del proyecto), sitemap dinámico por
tenant y el sistema de secciones. Decisiones tomadas: prefijo `/sites/`,
editor por secciones con vista previa en lugar de edición libre en lienzo,
comentarios apagados por defecto con moderación, publicación restringida a
admins salvo `members_can_publish`, tema independiente con copia desde la
tienda y bucket público.
