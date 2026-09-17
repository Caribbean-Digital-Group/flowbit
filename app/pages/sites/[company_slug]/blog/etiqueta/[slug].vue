<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'website' })

const route = useRoute()
const websiteStore = useWebsiteStore()
const { site } = storeToRefs(websiteStore)

const tagSlug = computed(() => String(Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug ?? ''))

useHead(() => ({
  title: `#${tagSlug.value} — ${site.value?.blog_title ?? 'Blog'}`,
  meta: [{ name: 'description', content: `Publicaciones etiquetadas con ${tagSlug.value}` }, { name: 'robots', content: 'noindex, follow' }]
}))
</script>

<template>
  <div>
    <header class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
      <WebsiteSmartLink href="/blog" class="sf-link text-sm">← {{ site?.blog_title ?? 'Blog' }}</WebsiteSmartLink>
      <p class="sf-eyebrow mt-4 mb-2">Etiqueta</p>
      <h1 class="sf-heading text-4xl sm:text-5xl font-bold">#{{ tagSlug }}</h1>
    </header>
    <WebsitePostListing :filters="{ tag: tagSlug }" empty-message="No hay publicaciones con esta etiqueta." />
  </div>
</template>
