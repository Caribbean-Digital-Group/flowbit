/**
 * Función programada de Netlify — cron anti-suspensión de Supabase.
 *
 * Supabase Cloud pausa los proyectos del plan gratuito tras varios días sin
 * actividad; un proyecto pausado deja Flowbit sin base de datos hasta
 * reactivarlo a mano desde el panel. Esta función corre cada 6 horas y
 * provoca una escritura en la base, con lo que el proyecto nunca llega al
 * umbral de inactividad.
 *
 * Estrategia en dos pasos:
 *  1. Llama a `/api/health/keepalive` del propio sitio (registra el latido y
 *     de paso mantiene caliente la función del servidor).
 *  2. Si el sitio no responde, llama al RPC de Supabase directamente, para
 *     que un despliegue roto no acabe además con la base suspendida.
 *
 * El horario se declara aquí mismo (Functions v2); no hace falta tocar
 * netlify.toml. Zona horaria del cron: UTC.
 */

const TIMEOUT_MS = 10_000

const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Paso 1: latido a través del endpoint de la plataforma. */
const pingViaSite = async (): Promise<string> => {
  const siteUrl = (process.env.URL || process.env.NUXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  if (!siteUrl) throw new Error('No hay URL del sitio en el entorno')

  const token = process.env.HEALTH_PING_TOKEN
  const response = await fetchWithTimeout(`${siteUrl}/api/health/keepalive?source=netlify-cron`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  })

  const body = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
  return body.slice(0, 300)
}

/** Paso 2 (respaldo): RPC directo contra Supabase con la clave de servicio. */
const pingViaSupabase = async (): Promise<string> => {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceKey) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY')

  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/platform_health_ping`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ p_source: 'netlify-cron-fallback' })
  })

  const body = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
  return body.slice(0, 300)
}

export default async () => {
  try {
    const result = await pingViaSite()
    console.log('Keepalive OK (site):', result)
    return new Response(JSON.stringify({ status: 'ok', via: 'site' }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    console.error('Keepalive vía sitio falló, se intenta Supabase directo:', error)
  }

  try {
    const result = await pingViaSupabase()
    console.log('Keepalive OK (supabase):', result)
    return new Response(JSON.stringify({ status: 'ok', via: 'supabase' }), {
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    console.error('Keepalive falló por completo:', error)
    return new Response(JSON.stringify({ status: 'failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}

// Cada 6 horas (UTC). Supabase tolera días de inactividad: este margen
// aguanta varios ciclos fallidos seguidos sin que el proyecto se suspenda.
export const config = { schedule: '0 */6 * * *' }
