<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsitePostResult } from '~/composables/useWebsite'

definePageMeta({ layout: 'website' })

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const websiteStore = useWebsiteStore()
const { slug, site, preview } = storeToRefs(websiteStore)
const { getPost, registerView } = useWebsite()
const nav = useWebsiteNav()

const postSlug = computed(() => String(Array.isArray(route.params.post_slug) ? route.params.post_slug[0] : route.params.post_slug ?? ''))

const result = ref<WebsitePostResult | null>(null)
const isLoading = ref(true)
const notFound = ref(false)
const clapCount = ref(0)

const load = async () => {
  if (!slug.value || !postSlug.value) return
  isLoading.value = true
  notFound.value = false
  const lookup = await getPost(slug.value, postSlug.value, preview.value)
  if (lookup.status === 'redirect') {
    await router.replace(nav.to(lookup.to_path))
    return
  }
  if (lookup.status === 'not_found') {
    result.value = null
    notFound.value = true
    isLoading.value = false
    return
  }
  result.value = lookup.data
  clapCount.value = lookup.data.post.clap_count
  isLoading.value = false

  // Vista única por visitante y día; nunca en vista previa
  if (!preview.value && typeof window !== 'undefined') {
    const visitorId = getWebsiteVisitorId()
    if (visitorId) void registerView(slug.value, postSlug.value, visitorId)
  }
}

watch([slug, postSlug, preview], load, { immediate: true })

const post = computed(() => result.value?.post ?? null)
const pagePath = computed(() => (slug.value ? websitePath(slug.value, `/blog/${postSlug.value}`) : route.path))

useHead(() => {
  if (!post.value || !site.value) return { title: notFound.value ? 'Publicación no encontrada' : undefined }
  const title = post.value.seo_title || post.value.title
  const description = post.value.seo_description || post.value.excerpt || post.value.subtitle || ''
  const image = post.value.og_image_url || post.value.cover_url || site.value.og_image_url
  const base = String(config.public.siteUrl).replace(/\/$/, '')
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'article' },
      ...(image ? [{ property: 'og:image', content: image }] : []),
      ...(post.value.published_at ? [{ property: 'article:published_time', content: post.value.published_at }] : []),
      ...(post.value.author ? [{ property: 'article:author', content: post.value.author.name }] : []),
      ...(post.value.noindex ? [{ name: 'robots', content: 'noindex, follow' }] : [])
    ],
    link: post.value.canonical_url ? [{ rel: 'canonical', href: post.value.canonical_url }] : [],
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.value.title,
        description,
        image: image ? [image] : undefined,
        datePublished: post.value.published_at ?? undefined,
        dateModified: post.value.updated_at ?? undefined,
        wordCount: post.value.word_count,
        author: post.value.author ? { '@type': 'Person', name: post.value.author.name } : undefined,
        publisher: { '@type': 'Organization', name: site.value.company_name, logo: site.value.logo_url ? { '@type': 'ImageObject', url: site.value.logo_url } : undefined },
        mainEntityOfPage: `${base}${pagePath.value}`,
        keywords: post.value.tags.map(t => t.name).join(', ') || undefined
      })
    }, {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: site.value.name, item: `${base}${websitePath(site.value.slug)}` },
          { '@type': 'ListItem', position: 2, name: site.value.blog_title, item: `${base}${websitePath(site.value.slug, '/blog')}` },
          { '@type': 'ListItem', position: 3, name: post.value.title }
        ]
      })
    }]
  }
})
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex items-center justify-center py-32">
      <div class="w-10 h-10 rounded-full border-4 animate-spin" :style="{ borderColor: 'var(--sf-border)', borderTopColor: 'var(--sf-primary)' }" aria-label="Cargando" />
    </div>

    <div v-else-if="notFound" class="max-w-2xl mx-auto px-4 py-28 text-center">
      <p class="sf-eyebrow mb-3">Error 404</p>
      <h1 class="sf-heading text-4xl font-bold">Publicación no encontrada</h1>
      <p class="sf-muted mt-4">Puede que haya sido movida o despublicada.</p>
      <WebsiteSmartLink href="/blog" class="sf-btn sf-btn--primary mt-8">Ir al blog</WebsiteSmartLink>
    </div>

    <article v-else-if="post && result">
      <!-- Encabezado -->
      <header class="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        <div class="flex items-center justify-center gap-2 flex-wrap">
          <WebsiteSmartLink v-if="post.category" :href="`/blog/categoria/${post.category.slug}`" class="ws-chip">{{ post.category.name }}</WebsiteSmartLink>
          <span v-if="post.status !== 'published'" class="ws-chip">{{ POST_STATUS_LABELS[post.status] }}</span>
        </div>
        <h1 class="sf-heading text-4xl sm:text-5xl font-bold leading-tight mt-5">{{ post.title }}</h1>
        <p v-if="post.subtitle" class="sf-muted text-xl mt-4 leading-relaxed">{{ post.subtitle }}</p>
        <div class="mt-7 flex items-center justify-center">
          <WebsitePostMeta :post="post" />
        </div>
      </header>

      <figure v-if="post.cover_url" class="max-w-5xl mx-auto px-4 sm:px-6 mb-12">
        <img :src="post.cover_url" :alt="post.cover_alt || post.title" class="w-full ws-aspect-video object-cover shadow-xl" :style="{ borderRadius: 'var(--sf-radius-xl)' }" />
        <figcaption v-if="post.cover_alt" class="sf-subtle text-xs text-center mt-3">{{ post.cover_alt }}</figcaption>
      </figure>

      <!-- Cuerpo: HTML generado y saneado en servidor -->
      <div class="max-w-3xl mx-auto px-4 sm:px-6">
        <div class="ws-prose" v-html="post.body_html" />

        <div v-if="post.tags.length" class="flex flex-wrap gap-2 mt-10">
          <WebsiteSmartLink v-for="tag in post.tags" :key="tag.id" :href="`/blog/etiqueta/${tag.slug}`" class="ws-chip">#{{ tag.name }}</WebsiteSmartLink>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4 mt-8 py-6 sf-border-y">
          <WebsiteClapButton v-if="site?.reactions_enabled" :post-slug="post.slug" :count="clapCount" @update="clapCount = $event" />
          <span v-else />
          <WebsiteShareBar :title="post.title" :path="pagePath" />
        </div>

        <WebsiteAuthorCard v-if="post.author" :author="post.author" class="mt-10" />

        <!-- Anterior / siguiente -->
        <nav v-if="result.previous || result.next" class="grid sm:grid-cols-2 gap-4 mt-10" aria-label="Más publicaciones">
          <WebsiteSmartLink v-if="result.previous" :href="`/blog/${result.previous.slug}`" class="ws-card ws-card--hover p-5 text-left">
            <span class="sf-subtle text-xs uppercase tracking-wider">← Anterior</span>
            <p class="font-semibold mt-1 ws-line-clamp-2">{{ result.previous.title }}</p>
          </WebsiteSmartLink>
          <span v-else />
          <WebsiteSmartLink v-if="result.next" :href="`/blog/${result.next.slug}`" class="ws-card ws-card--hover p-5 text-right">
            <span class="sf-subtle text-xs uppercase tracking-wider">Siguiente →</span>
            <p class="font-semibold mt-1 ws-line-clamp-2">{{ result.next.title }}</p>
          </WebsiteSmartLink>
        </nav>

        <WebsiteComments
          v-if="site?.comments_enabled || result.comments.length"
          :post-slug="post.slug"
          :comments="result.comments"
          :enabled="!!site?.comments_enabled && post.allow_comments"
        />
      </div>

      <!-- Relacionados -->
      <section v-if="result.related.length" class="ws-bg-muted ws-pad-lg mt-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <WebsiteSectionHeading eyebrow="Sigue leyendo" title="Publicaciones relacionadas" />
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <WebsitePostCard v-for="related in result.related" :key="related.id" :post="related" />
          </div>
        </div>
      </section>
    </article>
  </div>
</template>
