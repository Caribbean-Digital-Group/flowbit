/**
 * Utilidades puras del módulo Website (sin Vue).
 */

/** Ruta base del sitio público de una empresa. */
export const websitePath = (companySlug: string, path = ''): string => {
  const base = `/sites/${companySlug}`
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** Convierte un href devuelto por los RPCs en una ruta navegable. */
export const resolveWebsiteHref = (companySlug: string, href: string, external: boolean): string => {
  if (external) return href
  return websitePath(companySlug, href)
}

export const isExternalHref = (href: string): boolean => /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')

/** Slug en español (misma regla que website_slugify en la base). */
export const slugifyWebsite = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

export const formatWebsiteDate = (value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-MX', options ?? { day: 'numeric', month: 'long', year: 'numeric' })
}

export const formatWebsiteDateTime = (value: string | null | undefined): string => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const readingLabel = (minutes: number | null | undefined): string => {
  const m = Math.max(1, Math.round(minutes ?? 1))
  return `${m} min de lectura`
}

export const formatBytes = (bytes: number | null | undefined): string => {
  const b = bytes ?? 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

/** Identificador anónimo del visitante (aplausos, vistas, rate limit). Nunca PII. */
const VISITOR_KEY = 'flowbit:website-visitor'

export const getWebsiteVisitorId = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY)
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing
    const fresh = (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
    window.localStorage.setItem(VISITOR_KEY, fresh)
    return fresh
  } catch {
    return null
  }
}

/** Convierte una URL de YouTube/Vimeo en su URL embebible; null si no es válida. */
export const toEmbedUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  const trimmed = url.trim()
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (yt?.[1]) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

/** Solo se permiten mapas embebidos de Google Maps / OpenStreetMap. */
export const isAllowedMapEmbed = (url: string | null | undefined): boolean => {
  if (!url) return false
  return /^https:\/\/(www\.google\.com\/maps\/embed|maps\.google\.com|www\.openstreetmap\.org\/export\/embed)/i.test(url.trim())
}

export const SOCIAL_NETWORKS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'website', label: 'Sitio web' }
] as const

export const POST_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  published: 'Publicado',
  archived: 'Archivado'
}

export const POST_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-red-100 text-red-700'
}

/** Extrae un mensaje legible de un error de Supabase (triggers del módulo). */
export const websiteErrorMessage = (error: { message?: string; hint?: string | null; code?: string } | null, fallback: string): string => {
  if (!error) return fallback
  if (error.message?.includes('website_publish_not_allowed')) {
    return 'Solo los administradores pueden publicar en este sitio. Guarda como borrador o pide a un administrador que lo publique.'
  }
  if (error.message?.includes('website_unsafe_html')) {
    return 'El contenido incluye código no permitido (<script> o enlaces javascript:).'
  }
  if (error.code === '42P01' || error.code === '42703' || error.code === '42883') {
    return `La base de datos no tiene el módulo de sitio web completo (código ${error.code}: ${error.message ?? 'objeto inexistente'}). Verifica que la migración create_website_module se haya aplicado con «npm run db:push».`
  }
  if (error.code === 'PGRST205' || error.code === 'PGRST202') {
    return `La API de Supabase aún no conoce los objetos nuevos (${error.code}). Recarga el esquema en Supabase → Settings → API → «Reload schema» o espera un minuto y vuelve a intentar.`
  }
  if (error.code === '23505') {
    return 'Ya existe un registro con ese identificador (slug). Elige otro.'
  }
  return error.hint || error.message || fallback
}
