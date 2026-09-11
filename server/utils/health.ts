import type { H3Event } from 'h3'

/**
 * Chequeos de salud de la plataforma y latido anti-suspensión.
 *
 * Los proyectos gratuitos de Supabase Cloud se pausan tras varios días sin
 * actividad, lo que tumbaría el despliegue público. Aquí viven las dos piezas
 * que lo evitan y que además alimentan el endpoint `/health`:
 *
 *  - `checkDatabase`  — lectura ligera contra PostgREST (sin secretos).
 *  - `pingDatabase`   — escritura real vía RPC `platform_health_ping`,
 *                       requiere SUPABASE_SECRET_KEY (solo servidor).
 *
 * Ambas cuentan como actividad del proyecto; la escritura es la garantía
 * fuerte y la lectura es el respaldo cuando no hay clave de servicio.
 */

export type HealthStatus = 'ok' | 'degraded' | 'down'

export interface DatabaseCheck {
  status: HealthStatus
  /** 'write' = RPC de latido; 'read' = lectura contra PostgREST. */
  mode: 'write' | 'read' | 'disabled'
  latency_ms: number | null
  error?: string
}

export interface HeartbeatInfo {
  source: string
  last_ping_at: string
  ping_count: number
  age_seconds: number
}

export interface PingResult {
  status: HealthStatus
  mode: 'write' | 'read' | 'disabled'
  latency_ms: number | null
  heartbeat: HeartbeatInfo | null
  error?: string
}

interface PingRpcResponse {
  status: string
  source: string
  last_ping_at: string
  previous_ping_at: string | null
  ping_count: number
  server_time: string
}

interface StatusRpcResponse {
  status: string
  server_time: string
  heartbeat: HeartbeatInfo | null
}

/** Tiempo máximo de espera: un chequeo lento vale como caído. */
const TIMEOUT_MS = 6000

/** Mensaje de error acotado: nunca se filtran URLs ni claves al cliente. */
const describeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/https?:\/\/[^\s"']+/g, '[supabase]').slice(0, 120)
}

/**
 * Caché muy corta del chequeo de lectura.
 *
 * `/health` es público y lo consultan monitores: sin esto, una ráfaga de
 * peticiones se traduce en una ráfaga de consultas a la base. Diez segundos
 * son irrelevantes para detectar una caída y acotan el costo.
 */
const CHECK_CACHE_MS = 10_000
let cachedCheck: { at: number, result: DatabaseCheck } | null = null

/** Una base despierta responde en decenas de ms; más de 2 s es degradada. */
const rate = (latency: number): HealthStatus => (latency > 2000 ? 'degraded' : 'ok')

/**
 * Prueba de vida de la base con la clave publicable.
 *
 * Llama al RPC `platform_health_check`, que no lee ninguna tabla: solo
 * confirma que la consulta llegó a Postgres y volvió. Antes se pedía la raíz
 * de PostgREST, pero con el formato nuevo de claves (`sb_publishable_…`) ese
 * endpoint responde 401 salvo con clave secreta.
 *
 * Si el RPC aún no existe (migración sin aplicar) se cae a la prueba de vida
 * de Auth y se reporta `degraded`: la plataforma responde, pero el chequeo de
 * base no es concluyente.
 */
export const checkDatabase = async (event: H3Event): Promise<DatabaseCheck> => {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabaseUrl
  const anonKey = config.public.supabasePublishableKey

  if (!supabaseUrl || !anonKey) {
    return { status: 'down', mode: 'disabled', latency_ms: null, error: 'Supabase no está configurado' }
  }

  const now = Date.now()
  if (cachedCheck && now - cachedCheck.at < CHECK_CACHE_MS) return cachedCheck.result

  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  const startedAt = Date.now()
  let result: DatabaseCheck

  try {
    await $fetch(`${supabaseUrl}/rest/v1/rpc/platform_health_check`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: {},
      timeout: TIMEOUT_MS
    })

    const latency = Date.now() - startedAt
    result = { status: rate(latency), mode: 'read', latency_ms: latency }
  } catch (error) {
    result = await fallbackCheck(supabaseUrl, headers, error)
  }

  cachedCheck = { at: Date.now(), result }
  return result
}

/** Respaldo cuando el RPC de salud no está disponible. */
const fallbackCheck = async (
  supabaseUrl: string,
  headers: Record<string, string>,
  originalError: unknown
): Promise<DatabaseCheck> => {
  const startedAt = Date.now()

  try {
    await $fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', headers, timeout: TIMEOUT_MS })

    console.error('platform_health_check no respondió; se usó el respaldo de Auth:', originalError)
    return {
      status: 'degraded',
      mode: 'read',
      latency_ms: Date.now() - startedAt,
      error: 'RPC platform_health_check no disponible (¿migración sin aplicar?)'
    }
  } catch (error) {
    console.error('Health check failed against Supabase:', error)
    return { status: 'down', mode: 'read', latency_ms: Date.now() - startedAt, error: describeError(originalError) }
  }
}

/** Llama un RPC de Supabase con la clave service_role (solo servidor). */
const callServiceRpc = async <T>(
  event: H3Event,
  fn: string,
  args: Record<string, unknown>
): Promise<T> => {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabaseUrl
  const serviceKey = config.supabaseSecretKey

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_SECRET_KEY no está configurada')
  }

  return await $fetch<T>(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: args,
    timeout: TIMEOUT_MS
  })
}

/**
 * Latido: escribe en `platform_heartbeat` para marcar actividad en la base.
 *
 * Sin clave de servicio degrada a una lectura (`checkDatabase`), que también
 * cuenta como actividad del proyecto aunque no deje rastro persistente.
 */
export const pingDatabase = async (event: H3Event, source: string): Promise<PingResult> => {
  const config = useRuntimeConfig(event)

  if (!config.supabaseSecretKey) {
    const check = await checkDatabase(event)
    return {
      status: check.status,
      mode: check.mode,
      latency_ms: check.latency_ms,
      heartbeat: null,
      error: check.error ?? 'Sin SUPABASE_SECRET_KEY: latido en modo lectura'
    }
  }

  const startedAt = Date.now()

  try {
    const data = await callServiceRpc<PingRpcResponse>(event, 'platform_health_ping', { p_source: source })
    const latency = Date.now() - startedAt

    return {
      status: rate(latency),
      mode: 'write',
      latency_ms: latency,
      heartbeat: {
        source: data.source,
        last_ping_at: data.last_ping_at,
        ping_count: data.ping_count,
        age_seconds: 0
      }
    }
  } catch (error) {
    console.error('Heartbeat ping failed:', error)
    return {
      status: 'down',
      mode: 'write',
      latency_ms: Date.now() - startedAt,
      heartbeat: null,
      error: describeError(error)
    }
  }
}

/** El latido cambia cada pocas horas: cachearlo un minuto es de sobra. */
const HEARTBEAT_CACHE_MS = 60_000
let cachedHeartbeat: { at: number, result: HeartbeatInfo | null } | null = null

/** Último latido registrado; `null` si no hay clave de servicio o falla. */
export const readHeartbeat = async (event: H3Event): Promise<HeartbeatInfo | null> => {
  const config = useRuntimeConfig(event)
  if (!config.supabaseSecretKey) return null

  const now = Date.now()
  if (cachedHeartbeat && now - cachedHeartbeat.at < HEARTBEAT_CACHE_MS) {
    const cached = cachedHeartbeat.result
    // La antigüedad se recalcula: lo que envejece es el dato, no la consulta.
    return cached
      ? { ...cached, age_seconds: cached.age_seconds + Math.floor((now - cachedHeartbeat.at) / 1000) }
      : null
  }

  try {
    const data = await callServiceRpc<StatusRpcResponse>(event, 'platform_health_status', {})
    cachedHeartbeat = { at: Date.now(), result: data.heartbeat ?? null }
    return cachedHeartbeat.result
  } catch (error) {
    console.error('Cannot read platform heartbeat:', error)
    cachedHeartbeat = { at: Date.now(), result: null }
    return null
  }
}

/** El peor estado manda: down > degraded > ok. */
export const worstStatus = (statuses: HealthStatus[]): HealthStatus => {
  if (statuses.includes('down')) return 'down'
  if (statuses.includes('degraded')) return 'degraded'
  return 'ok'
}

/** Datos del despliegue que Netlify expone por entorno (no son secretos). */
export const deploymentInfo = () => ({
  environment: process.env.CONTEXT || process.env.NODE_ENV || 'unknown',
  commit: process.env.COMMIT_REF ? process.env.COMMIT_REF.slice(0, 7) : null,
  branch: process.env.BRANCH || null,
  region: process.env.AWS_REGION || null
})
