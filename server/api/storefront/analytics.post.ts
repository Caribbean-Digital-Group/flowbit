import { parseUserAgent, resolveCountry, isRateLimited } from '../../utils/analyticsIngest'

/**
 * Endpoint de ingesta de analítica del storefront.
 *
 * Recibe lotes del tracker cliente (fetch con keepalive o sendBeacon),
 * valida el shape, enriquece en servidor (user-agent → dispositivo,
 * headers del CDN → país; nunca se almacena la IP) y reenvía al RPC
 * `ingest_storefront_events` (SECURITY DEFINER, rol anon), que valida el
 * catálogo, deduplica por id y aplica su propio rate limit.
 *
 * Responde rápido y nunca filtra detalles internos: un fallo aquí solo
 * significa que el tracker reintentará su cola.
 */

const MAX_BODY_EVENTS = 50

interface IngestBody {
  slug?: unknown
  events?: unknown
}

export default defineEventHandler(async (event) => {
  const headers = getHeaders(event)

  const ip =
    headers['x-nf-client-connection-ip'] ||
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'

  if (isRateLimited(`analytics:${ip}`)) {
    setResponseStatus(event, 429)
    return { status: 'rate_limited' }
  }

  // sendBeacon puede llegar como text/plain: parsear manualmente
  let body: IngestBody
  try {
    const raw = await readRawBody(event, 'utf-8')
    if (!raw || raw.length > 200_000) throw new Error('invalid body')
    body = JSON.parse(raw)
  } catch {
    setResponseStatus(event, 400)
    return { status: 'invalid_payload' }
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const events = Array.isArray(body.events) ? body.events : []

  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug) || !events.length || events.length > MAX_BODY_EVENTS) {
    setResponseStatus(event, 400)
    return { status: 'invalid_payload' }
  }

  // Enriquecimiento en servidor: dispositivo/navegador/SO + país aproximado
  const ua = parseUserAgent(headers['user-agent'])
  if (ua.device_type === 'bot') {
    // Los bots no cuentan como tráfico: aceptar en silencio sin persistir
    return { status: 'ok', accepted: 0 }
  }

  const context = {
    device_type: ua.device_type,
    browser: ua.browser,
    os: ua.os,
    country: resolveCountry(headers)
  }

  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabasePublishableKey

  if (!supabaseUrl || !supabaseKey) {
    setResponseStatus(event, 503)
    return { status: 'unavailable' }
  }

  try {
    const result = await $fetch<{ status: string; accepted?: number; rejected?: number }>(
      `${supabaseUrl}/rest/v1/rpc/ingest_storefront_events`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: {
          p_slug: slug,
          p_events: events,
          p_context: context
        },
        timeout: 8000
      }
    )

    if (result?.status === 'rate_limited') {
      setResponseStatus(event, 429)
      return { status: 'rate_limited' }
    }

    return { status: 'ok', accepted: result?.accepted ?? 0 }
  } catch (error) {
    console.error('Error ingesting storefront analytics:', error)
    setResponseStatus(event, 502)
    return { status: 'error' }
  }
})
