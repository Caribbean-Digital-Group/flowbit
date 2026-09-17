import { ARTICLES } from '../../app/utils/manual/articles'
import { callWebsiteAnonRpc } from '../utils/websitePublic'

/**
 * Sitemap dinámico.
 *
 * El estático solo listaba la portada. El manual público son decenas de
 * páginas indexables que no estaban declaradas en ningún lado. Los sitios web
 * de las empresas se agregan dinámicamente desde la base.
 */
interface SitemapEntry {
  loc: string
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host')
  const proto = getRequestHeader(event, 'x-forwarded-proto') ?? 'https'
  const base = host ? `${proto}://${host}` : String(config.public.siteUrl).replace(/\/$/, '')

  const lastmod = new Date().toISOString().slice(0, 10)

  const entries: SitemapEntry[] = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/manual', changefreq: 'weekly', priority: '0.8' },
    // Cada guía del manual es una página pública con contenido propio
    ...ARTICLES.map((article): SitemapEntry => ({
      loc: `/manual/${article.id}`,
      changefreq: 'monthly',
      priority: '0.6'
    }))
  ]

  // Portada de cada sitio web activo; el detalle de cada sitio vive en su
  // propio sitemap (/sites/{slug}/sitemap.xml), declarado en robots.txt.
  const sites = await callWebsiteAnonRpc<{ slug: string }[]>(event, 'get_active_websites', {})
  for (const site of sites ?? []) {
    if (/^[a-z0-9-]{1,100}$/.test(site.slug)) {
      entries.push({ loc: `/sites/${site.slug}`, changefreq: 'weekly', priority: '0.7' })
    }
  }

  const urls = entries
    .map(entry => [
      '  <url>',
      `    <loc>${base}${entry.loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      '  </url>'
    ].join('\n'))
    .join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return body
})
