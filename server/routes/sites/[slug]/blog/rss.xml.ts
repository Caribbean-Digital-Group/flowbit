import { callWebsiteAnonRpc, escapeXml, isValidWebsiteSlug, requestBaseUrl } from '../../../../utils/websitePublic'

/** Feed RSS 2.0 del blog de una empresa (últimos 20 posts publicados). */
interface FeedPost {
  slug: string
  title: string
  excerpt: string | null
  cover_url: string | null
  published_at: string | null
  author: { name: string } | null
  category: { name: string } | null
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!isValidWebsiteSlug(slug)) {
    setResponseStatus(event, 404)
    return 'Not found'
  }

  const [site, posts] = await Promise.all([
    callWebsiteAnonRpc<{ status: string; site?: { name: string; tagline: string | null; blog_title: string; blog_description: string | null; blog_enabled: boolean } }>(
      event, 'get_website', { p_slug: slug, p_preview: false }
    ),
    callWebsiteAnonRpc<{ status: string; posts?: FeedPost[] }>(
      event, 'get_website_posts', { p_slug: slug, p_page: 1, p_page_size: 20, p_sort: 'newest' }
    )
  ])

  if (!site || site.status !== 'ok' || !site.site || !site.site.blog_enabled) {
    setResponseStatus(event, 404)
    return 'Not found'
  }

  const base = `${requestBaseUrl(event)}/sites/${slug}`
  const items = (posts?.posts ?? [])
    .map((post) => [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(`${base}/blog/${post.slug}`)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(`${base}/blog/${post.slug}`)}</guid>`,
      post.published_at ? `      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>` : null,
      post.author?.name ? `      <dc:creator>${escapeXml(post.author.name)}</dc:creator>` : null,
      post.category?.name ? `      <category>${escapeXml(post.category.name)}</category>` : null,
      post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : null,
      post.cover_url ? `      <enclosure url="${escapeXml(post.cover_url)}" type="image/jpeg" />` : null,
      '    </item>'
    ].filter(Boolean).join('\n'))
    .join('\n')

  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=900')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${site.site.blog_title} — ${site.site.name}`)}</title>
    <link>${escapeXml(`${base}/blog`)}</link>
    <atom:link href="${escapeXml(`${base}/blog/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(site.site.blog_description || site.site.tagline || `Publicaciones de ${site.site.name}`)}</description>
    <language>es</language>
${items}
  </channel>
</rss>
`
})
