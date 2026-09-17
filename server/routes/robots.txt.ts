/**
 * robots.txt dinámico.
 *
 * El archivo estático anterior fijaba `https://flowbit.app`, que no es el
 * dominio donde corre la plataforma: el sitemap declarado apuntaba a un sitio
 * inexistente. Aquí se toma el dominio real de la petición.
 */
import { callWebsiteAnonRpc } from '../utils/websitePublic'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Se prefiere el dominio desde el que se sirve; el configurado es el respaldo.
  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host')
  const proto = getRequestHeader(event, 'x-forwarded-proto') ?? 'https'
  const base = host ? `${proto}://${host}` : String(config.public.siteUrl).replace(/\/$/, '')

  const sites = await callWebsiteAnonRpc<{ slug: string }[]>(event, 'get_active_websites', {})
  const siteSlugs = (sites ?? []).map(s => s.slug).filter(slug => /^[a-z0-9-]{1,100}$/.test(slug))

  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Zonas privadas o sin valor de búsqueda',
    'Disallow: /admin/',
    'Disallow: /pos/',
    'Disallow: /api/',
    'Disallow: /health',
    'Disallow: /reset-password',
    'Disallow: /stores/*/cart',
    'Disallow: /stores/*/checkout',
    'Disallow: /stores/*/account',
    'Disallow: /public/projects/',
    'Disallow: /sites/*/buscar',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    // Un sitemap por cada sitio web de empresa activo
    ...siteSlugs.map(slug => `Sitemap: ${base}/sites/${slug}/sitemap.xml`),
    ''
  ].join('\n')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return body
})
