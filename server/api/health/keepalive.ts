import { isRateLimited } from '../../utils/analyticsIngest'
import { pingDatabase } from '../../utils/health'

/**
 * `/api/health/keepalive` — latido anti-suspensión de Supabase Cloud.
 *
 * Los proyectos del plan gratuito se pausan tras varios días sin actividad;
 * un proyecto pausado deja la plataforma sin base de datos hasta reactivarlo
 * a mano. Este endpoint hace una escritura real en `platform_heartbeat`
 * (RPC `platform_health_ping`), suficiente para que el proyecto cuente como
 * activo.
 *
 * Lo invoca un cron externo — la función programada de Netlify
 * (`netlify/functions/keepalive.mts`), el workflow de GitHub Actions o
 * cualquier servicio de ping. Acepta GET y POST para ser compatible con
 * servicios de cron que solo saben hacer GET.
 *
 * Protección:
 *  - Si `HEALTH_PING_TOKEN` está configurado, se exige (cabecera
 *    `Authorization: Bearer …`, `x-health-token` o `?token=`).
 *  - Estrangulado a un latido por minuto por instancia, aunque el token sea
 *    válido, para que nadie pueda convertirlo en escrituras en ráfaga.
 */

/** Un latido por minuto basta de sobra; el resto se responde sin escribir. */
const MIN_INTERVAL_MS = 60_000

let lastPingAt = 0

/** Comparación en tiempo constante: no filtra el token por latencia. */
const secureEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export default defineEventHandler(async (event) => {
  const method = event.method
  if (method !== 'GET' && method !== 'POST') {
    setResponseStatus(event, 405)
    return { status: 'method_not_allowed' }
  }

  setHeader(event, 'cache-control', 'no-store, max-age=0')

  const headers = getHeaders(event)
  const query = getQuery(event)
  const ip =
    headers['x-nf-client-connection-ip'] ||
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'

  if (isRateLimited(`health-keepalive:${ip}`)) {
    setResponseStatus(event, 429)
    return { status: 'rate_limited' }
  }

  // runtimeConfig se resuelve en tiempo de build; el `process.env` de respaldo
  // permite rotar el token sin reconstruir (o usar NUXT_HEALTH_PING_TOKEN).
  const expectedToken = useRuntimeConfig(event).healthPingToken || process.env.HEALTH_PING_TOKEN || ''
  const providedToken =
    headers.authorization?.replace(/^Bearer\s+/i, '').trim() ||
    headers['x-health-token']?.trim() ||
    (typeof query.token === 'string' ? query.token.trim() : '')

  const authorized = Boolean(expectedToken) && secureEquals(String(expectedToken), providedToken)

  if (expectedToken && !authorized) {
    setResponseStatus(event, 401)
    return { status: 'unauthorized' }
  }

  const source = typeof query.source === 'string' && query.source.trim()
    ? query.source.trim().slice(0, 40)
    : 'keepalive'

  const now = Date.now()
  if (now - lastPingAt < MIN_INTERVAL_MS) {
    return {
      status: 'skipped',
      reason: 'throttled',
      next_ping_in_s: Math.ceil((MIN_INTERVAL_MS - (now - lastPingAt)) / 1000)
    }
  }
  lastPingAt = now

  const result = await pingDatabase(event, source)

  if (result.status === 'down') {
    setResponseStatus(event, 503)
    // Se reintenta en el siguiente ciclo: no se bloquea el minuto siguiente.
    lastPingAt = 0
  }

  return {
    status: result.status,
    mode: result.mode,
    latency_ms: result.latency_ms,
    heartbeat: result.heartbeat,
    ...(result.error ? { error: result.error } : {}),
    timestamp: new Date().toISOString()
  }
})
