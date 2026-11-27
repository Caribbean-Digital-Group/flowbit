/**
 * Base pública canónica para las URLs absolutas que genera el servidor
 * (robots.txt, sitemaps y RSS).
 *
 * La fuente de verdad es `NUXT_PUBLIC_SITE_URL` (`runtimeConfig.public.siteUrl`),
 * la misma que usan las etiquetas canónicas, el JSON-LD y los enlaces para
 * compartir. Antes estas rutas tomaban `X-Forwarded-Host` de la petición: un
 * alias (deploy preview, `main--…netlify.app`) o un encabezado falso terminaba
 * en una respuesta con `cache-control: public`.
 *
 * El encabezado solo se usa como respaldo cuando no hay URL configurada válida
 * (por ejemplo, en desarrollo sin variable), y solo si tiene formato de host.
 *
 * Es una función pura (sin h3) para poder probarla con Vitest.
 */

const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$/i

/** Normaliza una URL http(s) a `protocolo://host[:puerto][/ruta]` sin `/` final. */
export const normalizeSiteUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password || !url.hostname) return null
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${url.host}${path}`
}

/** Valida un encabezado Host / X-Forwarded-Host (toma el primero de una lista). */
export const sanitizeRequestHost = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const host = value.split(',')[0]?.trim() ?? ''
  if (!host || host.length > 255 || !HOST_PATTERN.test(host)) return null
  return host.toLowerCase()
}

export interface PublicBaseUrlInput {
  siteUrl: unknown
  forwardedHost?: string | null
  host?: string | null
  forwardedProto?: string | null
}

export const resolvePublicBaseUrl = (input: PublicBaseUrlInput): string => {
  const configured = normalizeSiteUrl(input.siteUrl)
  if (configured) return configured

  const host = sanitizeRequestHost(input.forwardedHost) ?? sanitizeRequestHost(input.host)
  if (!host) return ''
  const proto = input.forwardedProto?.split(',')[0]?.trim().toLowerCase()
  return `${proto === 'http' ? 'http' : 'https'}://${host}`
}
