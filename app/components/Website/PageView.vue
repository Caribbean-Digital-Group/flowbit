<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { normalizeSections, type WebsiteSection } from '~/utils/website/sections'
import type { WebsitePageInfo } from '~/composables/useWebsite'

/**
 * Carga y renderiza una página del sitio (inicio o por slug): resuelve
 * redirecciones, SEO y el estado 404 personalizable.
 */
interface Props {
  pageSlug: string | null
}

const props = defineProps<Props>()
const route = useRoute()
const router = useRouter()
const websiteStore = useWebsiteStore()
const { site, slug, preview } = storeToRefs(websiteStore)
const { getPage } = useWebsite()
const nav = useWebsiteNav()

const page = ref<WebsitePageInfo | null>(null)
const sections = ref<WebsiteSection[]>([])
const isLoading = ref(true)
const notFound = ref(false)

const load = async () => {
  if (!slug.value || !site.value) return
  isLoading.value = true
  notFound.value = false
  const result = await getPage(slug.value, props.pageSlug, preview.value)
  if (result.status === 'redirect') {
    await router.replace(nav.to(result.to_path))
    return
  }
  if (result.status === 'not_found') {
    page.value = null
    sections.value = []
    notFound.value = true
    isLoading.value = false
    return
  }
  page.value = result.data
  sections.value = normalizeSections(result.data.content)
  isLoading.value = false
}

watch([slug, site, () => props.pageSlug, preview], load, { immediate: true })

const isLanding = computed(() => page.value?.layout === 'landing')

useHead(() => {
  if (!page.value || !site.value) {
    return { title: notFound.value ? (site.value?.not_found_title || 'Página no encontrada') : undefined }
  }
  const title = page.value.seo_title || (page.value.is_home ? (site.value.seo_title || site.value.name) : page.value.title)
  const description = page.value.seo_description || page.value.excerpt || site.value.seo_description || site.value.tagline || ''
  const image = page.value.og_image_url || site.value.og_image_url
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      ...(image ? [{ property: 'og:image', content: image }] : []),
      ...(page.value.noindex ? [{ name: 'robots', content: 'noindex, follow' }] : [])
    ],
    link: page.value.canonical_url ? [{ rel: 'canonical', href: page.value.canonical_url }] : [],
    script: page.value.is_home
      ? [{
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: site.value.company_name,
            url: typeof window !== 'undefined' ? window.location.origin + route.path : undefined,
            logo: site.value.logo_url ?? undefined,
            email: site.value.contact_email ?? undefined,
            telephone: site.value.contact_phone ?? undefined,
            sameAs: site.value.social_links?.map(l => l.url)
          })
        }]
      : []
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
      <h1 class="sf-heading text-4xl font-bold">{{ site?.not_found_title || 'Página no encontrada' }}</h1>
      <p class="sf-muted mt-4 leading-relaxed">{{ site?.not_found_text || 'La página que buscas no existe o fue movida.' }}</p>
      <div class="mt-8 flex justify-center gap-3">
        <WebsiteSmartLink href="" class="sf-btn sf-btn--primary">Ir al inicio</WebsiteSmartLink>
        <WebsiteSmartLink v-if="site?.blog_enabled" href="/blog" class="sf-btn sf-btn--outline">Ver el blog</WebsiteSmartLink>
      </div>
    </div>

    <template v-else-if="page">
      <header v-if="page.show_title && !isLanding" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-2">
        <h1 class="sf-heading text-4xl sm:text-5xl font-bold">{{ page.title }}</h1>
        <p v-if="page.excerpt" class="sf-muted mt-3 text-lg max-w-3xl">{{ page.excerpt }}</p>
      </header>
      <WebsiteSectionRenderer :sections="sections" :page-id="page.id" />
    </template>
  </div>
</template>
