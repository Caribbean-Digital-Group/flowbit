/**
 * Acceso público (rol anon) al sitio web de una empresa mediante los RPCs
 * SECURITY DEFINER de la migración `create_website_module`.
 *
 * Los RPCs solo devuelven contenido publicado de sitios activos; con
 * `preview = true` un miembro autenticado de la empresa también ve borradores
 * y sitios inactivos (vista previa desde el panel).
 *
 * Los tipos generados aún no conocen estos RPCs: se castea a `never` (patrón
 * de useStorefront) y se valida el shape en runtime.
 */

export interface WebsiteSocialLinkInfo {
  network: string
  url: string
}

export interface WebsiteSiteInfo {
  company_id: string
  slug: string
  name: string
  company_name: string
  tagline: string | null
  description: string | null
  logo_url: string | null
  favicon_url: string | null
  og_image_url: string | null
  primary_color: string
  currency: string
  lang: string
  is_active: boolean
  contact_email: string | null
  contact_phone: string | null
  whatsapp_phone: string | null
  contact_address: string | null
  contact_hours: string | null
  map_embed_url: string | null
  social_links: WebsiteSocialLinkInfo[]
  theme: string
  palette: string
  font_pairing: string
  color_primary: string | null
  color_secondary: string | null
  color_accent: string | null
  radius_style: string | null
  header_layout: 'classic' | 'centered' | 'minimal'
  footer_layout: 'columns' | 'simple' | 'minimal'
  footer_text: string | null
  show_powered_by: boolean
  announcement: string | null
  announcement_link: string | null
  seo_title: string | null
  seo_description: string | null
  noindex: boolean
  not_found_title: string | null
  not_found_text: string | null
  blog_enabled: boolean
  blog_title: string
  blog_description: string | null
  posts_per_page: number
  comments_enabled: boolean
  reactions_enabled: boolean
  gallery_enabled: boolean
  storefront_url: string | null
  storefront_link_label: string
  home_slug: string | null
}

export interface WebsiteMenuLink {
  id: string
  label: string
  href: string
  external: boolean
  new_tab: boolean
  children?: WebsiteMenuLink[]
}

export interface WebsiteInfo {
  preview: boolean
  site: WebsiteSiteInfo
  menus: { main: WebsiteMenuLink[]; footer: WebsiteMenuLink[] }
  has_posts: boolean
  has_galleries: boolean
  pages: { title: string; slug: string; is_home: boolean }[]
}

export interface WebsitePageInfo {
  id: string
  title: string
  slug: string
  status: string
  is_home: boolean
  layout: 'default' | 'full_width' | 'landing'
  show_title: boolean
  content: unknown
  excerpt: string | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  canonical_url: string | null
  noindex: boolean
  published_at: string | null
  updated_at: string | null
}

export interface WebsiteAuthorInfo {
  id: string
  slug: string
  name: string
  role_title: string | null
  bio: string | null
  avatar_url: string | null
  social_links: WebsiteSocialLinkInfo[]
  is_public: boolean
  post_count?: number
}

export interface WebsiteCategoryInfo {
  id: string
  name: string
  slug: string
  description?: string | null
  color: string | null
  image_url?: string | null
  parent_id?: string | null
  is_featured?: boolean
  post_count?: number
}

export interface WebsiteTagInfo {
  id: string
  name: string
  slug: string
  post_count?: number
}

export interface WebsitePostCard {
  id: string
  slug: string
  title: string
  subtitle: string | null
  excerpt: string | null
  cover_url: string | null
  cover_alt: string | null
  status: string
  published_at: string | null
  reading_minutes: number
  is_featured: boolean
  is_pinned: boolean
  clap_count: number
  comment_count: number
  view_count: number
  author: WebsiteAuthorInfo | null
  category: WebsiteCategoryInfo | null
  tags: WebsiteTagInfo[]
}

export interface WebsiteCommentInfo {
  id: string
  parent_id: string | null
  author_name: string
  body: string
  created_at: string
  is_staff: boolean
}

export interface WebsitePostDetail extends WebsitePostCard {
  body_html: string
  word_count: number
  allow_comments: boolean
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  canonical_url: string | null
  noindex: boolean
  updated_at: string | null
}

export interface WebsitePostResult {
  post: WebsitePostDetail
  related: WebsitePostCard[]
  previous: { slug: string; title: string } | null
  next: { slug: string; title: string } | null
  comments: WebsiteCommentInfo[]
}

export interface WebsiteGalleryCard {
  id: string
  name: string
  slug: string
  description: string | null
  layout: 'grid' | 'masonry' | 'carousel'
  status: string
  cover_url: string | null
  item_count: number
}

export interface WebsiteGalleryDetail {
  id: string
  name: string
  slug: string
  description: string | null
  layout: 'grid' | 'masonry' | 'carousel'
  cover_url: string | null
  updated_at: string | null
  items: { id: string; image_url: string; alt_text: string | null; caption: string | null }[]
}

export interface WebsitePostFilters {
  category?: string | null
  tag?: string | null
  author?: string | null
  search?: string | null
  page?: number
  pageSize?: number | null
  sort?: 'newest' | 'oldest' | 'popular' | 'relevance'
  featuredOnly?: boolean
  excludeId?: string | null
}

export type WebsiteLookup<T> =
  | { status: 'ok'; data: T }
  | { status: 'redirect'; to_path: string; status_code: number }
  | { status: 'not_found' }

export const useWebsite = () => {
  const supabase = useSupabase()

  const callRpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T | null> => {
    const { data, error } = await supabase.rpc(fn as never, args as never)
    if (error) {
      console.error(`Error calling ${fn}:`, error)
      return null
    }
    return data as T
  }

  const getWebsite = async (slug: string, preview = false): Promise<WebsiteInfo | null> => {
    if (!slug) return null
    const data = await callRpc<{ status: string } & WebsiteInfo>('get_website', { p_slug: slug, p_preview: preview })
    if (!data || data.status !== 'ok') return null
    return {
      preview: data.preview ?? false,
      site: data.site,
      menus: { main: data.menus?.main ?? [], footer: data.menus?.footer ?? [] },
      has_posts: data.has_posts ?? false,
      has_galleries: data.has_galleries ?? false,
      pages: data.pages ?? []
    }
  }

  const getPage = async (slug: string, pageSlug: string | null, preview = false): Promise<WebsiteLookup<WebsitePageInfo>> => {
    const data = await callRpc<{ status: string; page?: WebsitePageInfo; to_path?: string; status_code?: number }>(
      'get_website_page',
      { p_slug: slug, p_page_slug: pageSlug, p_preview: preview }
    )
    if (!data) return { status: 'not_found' }
    if (data.status === 'redirect' && data.to_path) return { status: 'redirect', to_path: data.to_path, status_code: data.status_code ?? 301 }
    if (data.status !== 'ok' || !data.page) return { status: 'not_found' }
    return { status: 'ok', data: data.page }
  }

  const getPosts = async (
    slug: string,
    filters: WebsitePostFilters = {},
    preview = false
  ): Promise<{ total: number; page: number; pageSize: number; posts: WebsitePostCard[] } | null> => {
    const data = await callRpc<{ status: string; total: number; page: number; page_size: number; posts: WebsitePostCard[] }>(
      'get_website_posts',
      {
        p_slug: slug,
        p_category: filters.category ?? null,
        p_tag: filters.tag ?? null,
        p_author: filters.author ?? null,
        p_search: filters.search ?? null,
        p_page: filters.page ?? 1,
        p_page_size: filters.pageSize ?? null,
        p_sort: filters.sort ?? 'newest',
        p_featured_only: filters.featuredOnly ?? false,
        p_exclude_id: filters.excludeId ?? null,
        p_preview: preview
      }
    )
    if (!data || data.status !== 'ok') return null
    return { total: data.total ?? 0, page: data.page ?? 1, pageSize: data.page_size ?? 9, posts: data.posts ?? [] }
  }

  const getPost = async (slug: string, postSlug: string, preview = false): Promise<WebsiteLookup<WebsitePostResult>> => {
    const data = await callRpc<{ status: string; to_path?: string; status_code?: number } & Partial<WebsitePostResult>>(
      'get_website_post',
      { p_slug: slug, p_post_slug: postSlug, p_preview: preview }
    )
    if (!data) return { status: 'not_found' }
    if (data.status === 'redirect' && data.to_path) return { status: 'redirect', to_path: data.to_path, status_code: data.status_code ?? 301 }
    if (data.status !== 'ok' || !data.post) return { status: 'not_found' }
    return {
      status: 'ok',
      data: {
        post: data.post,
        related: data.related ?? [],
        previous: data.previous ?? null,
        next: data.next ?? null,
        comments: data.comments ?? []
      }
    }
  }

  const getTaxonomy = async (slug: string, preview = false): Promise<{
    categories: WebsiteCategoryInfo[]
    tags: WebsiteTagInfo[]
    authors: WebsiteAuthorInfo[]
  } | null> => {
    const data = await callRpc<{ status: string; categories: WebsiteCategoryInfo[]; tags: WebsiteTagInfo[]; authors: WebsiteAuthorInfo[] }>(
      'get_website_taxonomy',
      { p_slug: slug, p_preview: preview }
    )
    if (!data || data.status !== 'ok') return null
    return { categories: data.categories ?? [], tags: data.tags ?? [], authors: data.authors ?? [] }
  }

  const getGalleries = async (slug: string, preview = false): Promise<WebsiteGalleryCard[]> => {
    const data = await callRpc<{ status: string; galleries: WebsiteGalleryCard[] }>('get_website_galleries', { p_slug: slug, p_preview: preview })
    if (!data || data.status !== 'ok') return []
    return data.galleries ?? []
  }

  const getGallery = async (slug: string, gallerySlug: string, preview = false): Promise<WebsiteGalleryDetail | null> => {
    const data = await callRpc<{ status: string; gallery?: WebsiteGalleryDetail }>('get_website_gallery', {
      p_slug: slug, p_gallery_slug: gallerySlug, p_preview: preview
    })
    if (!data || data.status !== 'ok' || !data.gallery) return null
    return data.gallery
  }

  const search = async (slug: string, query: string, limit = 20): Promise<{
    query: string
    posts: WebsitePostCard[]
    pages: { id: string; title: string; slug: string; is_home: boolean; excerpt: string | null }[]
  } | null> => {
    const data = await callRpc<{ status: string; query: string; posts: WebsitePostCard[]; pages: { id: string; title: string; slug: string; is_home: boolean; excerpt: string | null }[] }>(
      'search_website',
      { p_slug: slug, p_q: query, p_limit: limit }
    )
    if (!data || data.status !== 'ok') return null
    return { query: data.query ?? query, posts: data.posts ?? [], pages: data.pages ?? [] }
  }

  const registerView = async (slug: string, postSlug: string, visitorId: string): Promise<number | null> => {
    const data = await callRpc<{ status: string; view_count?: number }>('register_website_post_view', {
      p_slug: slug, p_post_slug: postSlug, p_visitor_id: visitorId
    })
    return data?.status === 'ok' ? data.view_count ?? null : null
  }

  const react = async (slug: string, postSlug: string, visitorId: string, count = 1): Promise<{ clap_count: number; my_count: number } | null> => {
    const data = await callRpc<{ status: string; clap_count?: number; my_count?: number }>('react_website_post', {
      p_slug: slug, p_post_slug: postSlug, p_visitor_id: visitorId, p_count: count
    })
    if (!data || data.status !== 'ok') return null
    return { clap_count: data.clap_count ?? 0, my_count: data.my_count ?? 0 }
  }

  const submitComment = async (
    slug: string,
    postSlug: string,
    payload: { name: string; email: string; body: string; parentId?: string | null; visitorId: string | null; honeypot: string }
  ): Promise<{ status: string; code?: string; comment_status?: string }> => {
    const data = await callRpc<{ status: string; code?: string; comment_status?: string }>('submit_website_comment', {
      p_slug: slug,
      p_post_slug: postSlug,
      p_author_name: payload.name,
      p_author_email: payload.email || null,
      p_body: payload.body,
      p_parent_id: payload.parentId ?? null,
      p_visitor_id: payload.visitorId,
      p_honeypot: payload.honeypot || null
    })
    return data ?? { status: 'error', code: 'network' }
  }

  const submitContact = async (
    slug: string,
    payload: {
      name: string
      email: string
      phone: string
      subject: string
      message: string
      extra?: Record<string, unknown>
      sourceUrl?: string
      visitorId: string | null
      honeypot: string
      pageId?: string | null
    }
  ): Promise<{ status: string; code?: string }> => {
    const data = await callRpc<{ status: string; code?: string }>('submit_website_contact', {
      p_slug: slug,
      p_name: payload.name,
      p_email: payload.email || null,
      p_phone: payload.phone || null,
      p_subject: payload.subject || null,
      p_message: payload.message,
      p_payload: payload.extra ?? {},
      p_source_url: payload.sourceUrl ?? null,
      p_visitor_id: payload.visitorId,
      p_honeypot: payload.honeypot || null,
      p_page_id: payload.pageId ?? null
    })
    return data ?? { status: 'error', code: 'network' }
  }

  return {
    getWebsite,
    getPage,
    getPosts,
    getPost,
    getTaxonomy,
    getGalleries,
    getGallery,
    search,
    registerView,
    react,
    submitComment,
    submitContact
  }
}
