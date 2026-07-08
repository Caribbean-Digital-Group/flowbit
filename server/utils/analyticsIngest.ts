/**
 * Utilidades de enriquecimiento del endpoint de ingesta de analítica:
 * parseo de user-agent (propio, sin dependencias), país aproximado desde
 * headers del CDN (nunca se almacena la IP) y rate limiting en memoria
 * (mejor esfuerzo por instancia; el RPC aplica un segundo límite en BD).
 */

export interface UaInfo {
  device_type: 'mobile' | 'tablet' | 'desktop' | 'bot'
  browser: string
  os: string
}

/** Clasificación mínima de user-agent: suficiente para reportes agregados. */
export const parseUserAgent = (ua: string | undefined | null): UaInfo => {
  const value = ua ?? ''

  if (/bot|crawler|spider|crawling|preview|lighthouse|headless/i.test(value)) {
    return { device_type: 'bot', browser: 'Bot', os: 'Bot' }
  }

  const os = /windows nt/i.test(value)
    ? 'Windows'
    : /iphone|ipad|ipod/i.test(value)
      ? 'iOS'
      : /android/i.test(value)
        ? 'Android'
        : /mac os x|macintosh/i.test(value)
          ? 'macOS'
          : /linux/i.test(value)
            ? 'Linux'
            : 'Otro'

  const browser = /edg\//i.test(value)
    ? 'Edge'
    : /opr\/|opera/i.test(value)
      ? 'Opera'
      : /samsungbrowser/i.test(value)
        ? 'Samsung Internet'
        : /firefox\//i.test(value)
          ? 'Firefox'
          : /chrome\/|crios\//i.test(value)
            ? 'Chrome'
            : /safari\//i.test(value)
              ? 'Safari'
              : 'Otro'

  const device_type = /ipad|tablet|(?=.*android)(?!.*mobile)/i.test(value)
    ? 'tablet'
    : /mobile|iphone|ipod|android/i.test(value)
      ? 'mobile'
      : 'desktop'

  return { device_type, browser, os }
}

/**
 * País (ISO-3166 alpha-2) desde headers de geolocalización del CDN.
 * Netlify expone x-nf-geo (JSON, a veces base64); Cloudflare/Vercel usan
 * headers planos. Si no hay ninguno, se reporta desconocido.
 */
export const resolveCountry = (headers: Record<string, string | undefined>): string | null => {
  const plain =
    headers['x-vercel-ip-country'] ||
    headers['cf-ipcountry'] ||
    headers['x-country-code'] ||
    headers['x-nf-country']

  if (plain && /^[A-Za-z]{2}$/.test(plain)) return plain.toUpperCase()

  const nfGeo = headers['x-nf-geo']
  if (nfGeo) {
    for (const raw of [nfGeo, safeBase64Decode(nfGeo)]) {
      if (!raw) continue
      try {
        const geo = JSON.parse(raw)
        const code = geo?.country?.code
        if (typeof code === 'string' && /^[A-Za-z]{2}$/.test(code)) return code.toUpperCase()
      } catch {
        // formato no reconocido: seguir con el siguiente candidato
      }
    }
  }

  return null
}

const safeBase64Decode = (value: string): string | null => {
  try {
    return Buffer.from(value, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

// ── Rate limiting en memoria (por instancia) ─────────────────────────
// Defensa rápida contra ráfagas antes de tocar la base de datos. En
// serverless cada instancia tiene su propio contador, por eso el RPC
// ingest_storefront_events aplica además un límite por visitante en BD.

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 120

const requestCounts = new Map<string, { count: number; windowStart: number }>()

export const isRateLimited = (key: string): boolean => {
  const now = Date.now()
  const entry = requestCounts.get(key)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now })
    // Poda ocasional para no crecer sin límite
    if (requestCounts.size > 5000) {
      for (const [k, v] of requestCounts) {
        if (now - v.windowStart > WINDOW_MS) requestCounts.delete(k)
      }
    }
    return false
  }

  entry.count += 1
  return entry.count > MAX_REQUESTS_PER_WINDOW
}
