import type { H3Event } from 'h3'

/**
 * Helpers del backend para el sitio web público.
 *
 * Los RPCs `get_website_*` están concedidos al rol anon, así que desde el
 * servidor se llaman con la clave publicable (misma visibilidad que un
 * visitante). Se usan para sitemap y RSS por tenant.
 */

export const isValidWebsiteSlug = (slug: unknown): slug is string =>
  typeof slug === 'string' && /^[a-z0-9-]{1,100}$/.test(slug)

export const callWebsiteAnonRpc = async <T>(
  event: H3Event,
  fn: string,
  args: Record<string, unknown>
): Promise<T | null> => {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabaseUrl as string | undefined
  const anonKey = config.public.supabasePublishableKey as string | undefined

  if (!supabaseUrl || !anonKey) {
    console.error(`Cannot call ${fn}: Supabase public config missing`)
    return null
  }

  try {
    const result = await $fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: args,
      timeout: 8000
    })
    return result as T
  } catch (error) {
    console.error(`Error calling ${fn}:`, error)
    return null
  }
}

/** Base pública de la petición (respeta el proxy de Netlify). */
export const requestBaseUrl = (event: H3Event): string => {
  const config = useRuntimeConfig(event)
  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host')
  const proto = getRequestHeader(event, 'x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : String(config.public.siteUrl).replace(/\/$/, '')
}

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
