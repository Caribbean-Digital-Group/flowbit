<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteCategoryInfo } from '~/composables/useWebsite'

definePageMeta({ layout: 'website' })

const route = useRoute()
const websiteStore = useWebsiteStore()
const { slug, site, preview } = storeToRefs(websiteStore)
const { getTaxonomy } = useWebsite()

const categorySlug = computed(() => String(Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug ?? ''))
const category = ref<WebsiteCategoryInfo | null>(null)

watch([slug, categorySlug, preview], async () => {
  if (!slug.value) return
  const taxonomy = await getTaxonomy(slug.value, preview.value)
  category.value = taxonomy?.categories.find(c => c.slug === categorySlug.value) ?? null
}, { immediate: true })

useHead(() => ({
  title: category.value ? `${category.value.name} — ${site.value?.blog_title ?? 'Blog'}` : 'Categoría',
  meta: [{ name: 'description', content: category.value?.description || `Publicaciones sobre ${category.value?.name ?? ''}` }]
}))
</script>

<template>
  <div>
    <header class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
      <WebsiteSmartLink href="/blog" class="sf-link text-sm">← {{ site?.blog_title ?? 'Blog' }}</WebsiteSmartLink>
      <p class="sf-eyebrow mt-4 mb-2">Categoría</p>
      <h1 class="sf-heading text-4xl sm:text-5xl font-bold flex items-center gap-3">
        <span v-if="category?.color" class="w-4 h-4 rounded-full" :style="{ backgroundColor: category.color }" />
        {{ category?.name ?? categorySlug }}
      </h1>
      <p v-if="category?.description" class="sf-muted mt-3 text-lg max-w-2xl">{{ category.description }}</p>
    </header>
    <WebsitePostListing :filters="{ category: categorySlug }" empty-message="No hay publicaciones en esta categoría." />
  </div>
</template>
