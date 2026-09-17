import type { Database, Json } from './database.types'

/**
 * Tipos temporales del módulo Website.
 *
 * `types/database.types.ts` aún no incluye las tablas creadas en la migración
 * `20260916180000_create_website_module` (el CLI no regenera tipos desde la
 * sesión de desarrollo asistido). Este shim replica el shape que generará
 * Supabase para mantener TypeScript estricto sin `any`.
 *
 * Cuando se regenere `npm run db:types`, estos alias pueden sustituirse por
 * `Tables<'website_settings'>`, etc., y este archivo puede eliminarse.
 */

type Audit = {
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

export type WebsiteSocialLink = { network: string; url: string }

export type WebsiteSettingsRow = Audit & {
  id: string
  company_id: string
  is_active: boolean
  site_name: string | null
  tagline: string | null
  logo_url: string | null
  favicon_url: string | null
  og_image_url: string | null
  contact_email: string | null
  contact_phone: string | null
  whatsapp_phone: string | null
  contact_address: string | null
  contact_hours: string | null
  map_embed_url: string | null
  social_links: WebsiteSocialLink[]
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
  show_storefront_link: boolean
  storefront_link_label: string | null
  blog_enabled: boolean
  blog_title: string | null
  blog_description: string | null
  posts_per_page: number
  comments_enabled: boolean
  comments_auto_approve: boolean
  reactions_enabled: boolean
  gallery_enabled: boolean
  members_can_publish: boolean
  custom_domain: string | null
  lang: string
}
export type WebsiteSettingsInsert = Partial<WebsiteSettingsRow> & { company_id: string }
export type WebsiteSettingsUpdate = Partial<WebsiteSettingsRow>

export type WebsitePageStatus = 'draft' | 'published' | 'archived'
export type WebsitePageLayout = 'default' | 'full_width' | 'landing'

export type WebsitePageRow = Audit & {
  id: string
  company_id: string
  title: string
  slug: string | null
  status: WebsitePageStatus
  is_home: boolean
  layout: WebsitePageLayout
  show_title: boolean
  content: Json
  content_version: number
  excerpt: string | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  canonical_url: string | null
  noindex: boolean
  show_in_search: boolean
  published_at: string | null
  display_order: number
}
export type WebsitePageInsert = Partial<WebsitePageRow> & { company_id: string; title: string }
export type WebsitePageUpdate = Partial<WebsitePageRow>

export type WebsitePageRevisionRow = {
  id: string
  company_id: string
  page_id: string
  revision_no: number
  title: string
  content: Json
  created_at: string | null
  created_by: string | null
}

export type WebsiteMenuRow = Audit & {
  id: string
  company_id: string
  code: string
  name: string
}
export type WebsiteMenuInsert = Partial<WebsiteMenuRow> & { company_id: string; code: string; name: string }
export type WebsiteMenuUpdate = Partial<WebsiteMenuRow>

export type WebsiteMenuLinkType =
  | 'home' | 'page' | 'post' | 'category' | 'blog' | 'gallery' | 'galleries' | 'storefront' | 'url'

export type WebsiteMenuItemRow = Audit & {
  id: string
  company_id: string
  menu_id: string
  parent_id: string | null
  label: string
  link_type: WebsiteMenuLinkType
  page_id: string | null
  post_id: string | null
  category_id: string | null
  gallery_id: string | null
  url: string | null
  open_in_new_tab: boolean
  is_visible: boolean
  display_order: number
}
export type WebsiteMenuItemInsert = Partial<WebsiteMenuItemRow> & { company_id: string; menu_id: string; label: string }
export type WebsiteMenuItemUpdate = Partial<WebsiteMenuItemRow>

export type WebsiteMediaRow = Audit & {
  id: string
  company_id: string
  bucket: string
  path: string
  public_url: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  width: number | null
  height: number | null
  alt_text: string | null
  title: string | null
  folder: string
}
export type WebsiteMediaInsert = Partial<WebsiteMediaRow> & { company_id: string; path: string; public_url: string }
export type WebsiteMediaUpdate = Partial<WebsiteMediaRow>

export type WebsiteGalleryLayout = 'grid' | 'masonry' | 'carousel'

export type WebsiteGalleryRow = Audit & {
  id: string
  company_id: string
  name: string
  slug: string | null
  description: string | null
  cover_url: string | null
  layout: WebsiteGalleryLayout
  status: WebsitePageStatus
  display_order: number
}
export type WebsiteGalleryInsert = Partial<WebsiteGalleryRow> & { company_id: string; name: string }
export type WebsiteGalleryUpdate = Partial<WebsiteGalleryRow>

export type WebsiteGalleryItemRow = Audit & {
  id: string
  company_id: string
  gallery_id: string
  media_id: string | null
  image_url: string
  alt_text: string | null
  caption: string | null
  display_order: number
}
export type WebsiteGalleryItemInsert = Partial<WebsiteGalleryItemRow> & { company_id: string; gallery_id: string; image_url: string }
export type WebsiteGalleryItemUpdate = Partial<WebsiteGalleryItemRow>

export type WebsiteAuthorRow = Audit & {
  id: string
  company_id: string
  partner_id: string | null
  display_name: string
  slug: string | null
  role_title: string | null
  bio: string | null
  avatar_url: string | null
  social_links: WebsiteSocialLink[]
  is_public: boolean
}
export type WebsiteAuthorInsert = Partial<WebsiteAuthorRow> & { company_id: string; display_name: string }
export type WebsiteAuthorUpdate = Partial<WebsiteAuthorRow>

export type WebsiteCategoryRow = Audit & {
  id: string
  company_id: string
  parent_id: string | null
  name: string
  slug: string | null
  description: string | null
  color: string | null
  image_url: string | null
  display_order: number
  is_featured: boolean
}
export type WebsiteCategoryInsert = Partial<WebsiteCategoryRow> & { company_id: string; name: string }
export type WebsiteCategoryUpdate = Partial<WebsiteCategoryRow>

export type WebsiteTagRow = Audit & {
  id: string
  company_id: string
  name: string
  slug: string | null
}
export type WebsiteTagInsert = Partial<WebsiteTagRow> & { company_id: string; name: string }
export type WebsiteTagUpdate = Partial<WebsiteTagRow>

export type WebsitePostStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export type WebsitePostRow = Audit & {
  id: string
  company_id: string
  title: string
  subtitle: string | null
  slug: string | null
  status: WebsitePostStatus
  published_at: string | null
  author_id: string | null
  category_id: string | null
  cover_url: string | null
  cover_alt: string | null
  excerpt: string | null
  body: Json
  body_html: string
  body_text: string
  reading_minutes: number
  word_count: number
  is_featured: boolean
  is_pinned: boolean
  allow_comments: boolean
  related_post_ids: string[]
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  canonical_url: string | null
  noindex: boolean
  view_count: number
  clap_count: number
  comment_count: number
}
export type WebsitePostInsert = Partial<Omit<WebsitePostRow, 'search_vector'>> & { company_id: string; title: string }
export type WebsitePostUpdate = Partial<WebsitePostRow>

export type WebsitePostTagRow = {
  post_id: string
  tag_id: string
  company_id: string
  created_at: string | null
}

export type WebsitePostRevisionRow = {
  id: string
  company_id: string
  post_id: string
  revision_no: number
  title: string
  body: Json
  created_at: string | null
  created_by: string | null
}

export type WebsiteCommentStatus = 'pending' | 'approved' | 'spam' | 'rejected'

export type WebsiteCommentRow = {
  id: string
  company_id: string
  post_id: string
  parent_id: string | null
  author_name: string
  author_email: string | null
  author_user_id: string | null
  body: string
  status: WebsiteCommentStatus
  visitor_id: string | null
  user_agent: string | null
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  updated_by: string | null
}
export type WebsiteCommentUpdate = Partial<WebsiteCommentRow>

export type WebsiteRedirectRow = Audit & {
  id: string
  company_id: string
  from_path: string
  to_path: string
  status_code: 301 | 302
  is_automatic: boolean
  hits: number
}
export type WebsiteRedirectInsert = Partial<WebsiteRedirectRow> & { company_id: string; from_path: string; to_path: string }
export type WebsiteRedirectUpdate = Partial<WebsiteRedirectRow>

export type WebsiteSubmissionStatus = 'new' | 'read' | 'archived'

export type WebsiteContactSubmissionRow = {
  id: string
  company_id: string
  page_id: string | null
  name: string
  email: string | null
  phone: string | null
  subject: string | null
  message: string
  payload: Json
  source_url: string | null
  visitor_id: string | null
  status: WebsiteSubmissionStatus
  crm_lead_id: string | null
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  updated_by: string | null
}
export type WebsiteContactSubmissionUpdate = Partial<WebsiteContactSubmissionRow>

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

/**
 * Esquema para castear el cliente de Supabase mientras `database.types.ts`
 * no incluye las tablas del sitio web (mismo patrón que StorefrontDatabase).
 */
export type WebsiteDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      website_settings: Table<WebsiteSettingsRow, WebsiteSettingsInsert, WebsiteSettingsUpdate>
      website_page: Table<WebsitePageRow, WebsitePageInsert, WebsitePageUpdate>
      website_page_revision: Table<WebsitePageRevisionRow>
      website_menu: Table<WebsiteMenuRow, WebsiteMenuInsert, WebsiteMenuUpdate>
      website_menu_item: Table<WebsiteMenuItemRow, WebsiteMenuItemInsert, WebsiteMenuItemUpdate>
      website_media: Table<WebsiteMediaRow, WebsiteMediaInsert, WebsiteMediaUpdate>
      website_gallery: Table<WebsiteGalleryRow, WebsiteGalleryInsert, WebsiteGalleryUpdate>
      website_gallery_item: Table<WebsiteGalleryItemRow, WebsiteGalleryItemInsert, WebsiteGalleryItemUpdate>
      website_author: Table<WebsiteAuthorRow, WebsiteAuthorInsert, WebsiteAuthorUpdate>
      website_category: Table<WebsiteCategoryRow, WebsiteCategoryInsert, WebsiteCategoryUpdate>
      website_tag: Table<WebsiteTagRow, WebsiteTagInsert, WebsiteTagUpdate>
      website_post: Table<WebsitePostRow, WebsitePostInsert, WebsitePostUpdate>
      website_post_tag: Table<WebsitePostTagRow>
      website_post_revision: Table<WebsitePostRevisionRow>
      website_comment: Table<WebsiteCommentRow, Partial<WebsiteCommentRow>, WebsiteCommentUpdate>
      website_redirect: Table<WebsiteRedirectRow, WebsiteRedirectInsert, WebsiteRedirectUpdate>
      website_contact_submission: Table<WebsiteContactSubmissionRow, Partial<WebsiteContactSubmissionRow>, WebsiteContactSubmissionUpdate>
    }
  }
}
