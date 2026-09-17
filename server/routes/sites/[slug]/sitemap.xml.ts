import { callWebsiteAnonRpc, escapeXml, isValidWebsiteSlug, requestBaseUrl } from '../../../utils/websitePublic'

/**
 * Sitemap del sitio web de una empresa: páginas, blog, posts, categorías y
 * galerías publicadas. Se declara en robots.txt para cada sitio activo.
 */
interface SitemapEntry {
  loc: string
  lastmod: string | null
  changefreq: string
  priority: string
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!isValidWebsiteSlug(slug)) {
    setResponseStatus(event, 404)
    return 'Not found'
  }

  const result = await callWebsiteAnonRpc<{ status: string; entries?: SitemapEntry[] }>(
    event,
    'get_website_sitemap',
    { p_slug: slug }
  )

  if (!result || result.status !== 'ok') {
    setResponseStatus(event, 404)
    return 'Not found'
  }

  const base = `${requestBaseUrl(event)}/sites/${slug}`
  const urls = (result.entries ?? [])
    .map((entry) => {
      const lastmod = entry.lastmod ? new Date(entry.lastmod).toISOString().slice(0, 10) : null
      return [
        '  <url>',
        `    <loc>${escapeXml(base + entry.loc)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>'
      ].filter(Boolean).join('\n')
    })
    .join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=1800')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
})
