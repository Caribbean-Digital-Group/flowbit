import { checkDatabase, readHeartbeat, worstStatus, deploymentInfo, type HealthStatus } from '../utils/health'

/**
 * `/health` — estado público de la plataforma.
 *
 * Pensado para monitores de disponibilidad (UptimeRobot, Better Stack, el
 * healthcheck de un contenedor…). Responde `200` cuando la plataforma opera
 * y `503` cuando la base no contesta, de modo que un monitor pueda alertar
 * sin interpretar el cuerpo.
 *
 * Efecto secundario buscado: cada consulta hace una lectura real contra
 * Supabase, así que un monitor apuntando aquí ya cuenta como actividad del
 * proyecto. La garantía fuerte contra la suspensión es el latido escrito de
 * `/api/health/keepalive`.
 *
 * No expone secretos ni datos de ningún tenant.
 */

interface HealthCheck {
  status: HealthStatus
  latency_ms: number | null
  mode?: string
  error?: string
}

interface HealthResponse {
  status: HealthStatus
  service: 'flowbit'
  timestamp: string
  instance_uptime_s: number
  deployment: ReturnType<typeof deploymentInfo>
  checks: Record<string, HealthCheck>
  keepalive: {
    status: 'ok' | 'stale' | 'unknown'
    last_ping_at: string | null
    ping_count: number | null
    age_hours: number | null
  }
}

/** Umbral de latido rancio: Supabase tolera días, avisamos a las 48 h. */
const STALE_AFTER_SECONDS = 48 * 60 * 60

export default defineEventHandler(async (event): Promise<HealthResponse> => {
  const database = await checkDatabase(event)

  // El latido solo se consulta si hay clave de servicio; es informativo y
  // nunca degrada el estado general (un cron caído no es una caída del sitio).
  const heartbeat = await readHeartbeat(event)

  const status = worstStatus([database.status])

  setHeader(event, 'cache-control', 'no-store, max-age=0')
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseStatus(event, status === 'down' ? 503 : 200)

  return {
    status,
    service: 'flowbit',
    timestamp: new Date().toISOString(),
    instance_uptime_s: Math.round(process.uptime()),
    deployment: deploymentInfo(),
    checks: {
      app: { status: 'ok', latency_ms: 0 },
      database: {
        status: database.status,
        latency_ms: database.latency_ms,
        mode: database.mode,
        ...(database.error ? { error: database.error } : {})
      }
    },
    keepalive: heartbeat
      ? {
          status: heartbeat.age_seconds > STALE_AFTER_SECONDS ? 'stale' : 'ok',
          last_ping_at: heartbeat.last_ping_at,
          ping_count: heartbeat.ping_count,
          age_hours: Math.round((heartbeat.age_seconds / 3600) * 10) / 10
        }
      : { status: 'unknown', last_ping_at: null, ping_count: null, age_hours: null }
  }
})
