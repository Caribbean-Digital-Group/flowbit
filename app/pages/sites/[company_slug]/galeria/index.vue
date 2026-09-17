<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteGalleryCard } from '~/composables/useWebsite'

definePageMeta({ layout: 'website' })

const websiteStore = useWebsiteStore()
const { slug, site, preview } = storeToRefs(websiteStore)
const { getGalleries } = useWebsite()

const galleries = ref<WebsiteGalleryCard[]>([])
const isLoading = ref(true)

watch([slug, preview], async () => {
  if (!slug.value) return
  isLoading.value = true
  galleries.value = await getGalleries(slug.value, preview.value)
  isLoading.value = false
}, { immediate: true })

useHead(() => ({
  title: 'Galería',
  meta: [{ name: 'description', content: `Galería de fotos de ${site.value?.name ?? ''}` }]
}))
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
    <header class="mb-10">
      <p class="sf-eyebrow mb-2">{{ site?.name }}</p>
      <h1 class="sf-heading text-4xl sm:text-5xl font-bold">Galería</h1>
    </header>
    <div v-if="isLoading" class="flex justify-center py-20">
      <div class="w-9 h-9 rounded-full border-4 animate-spin" :style="{ borderColor: 'var(--sf-border)', borderTopColor: 'var(--sf-primary)' }" />
    </div>
    <div v-else-if="galleries.length" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <WebsiteSmartLink v-for="gallery in galleries" :key="gallery.id" :href="`/galeria/${gallery.slug}`" class="ws-card ws-card--hover overflow-hidden group text-left">
        <div class="ws-aspect-4-3 overflow-hidden" :style="{ backgroundColor: 'var(--sf-surface-muted)' }">
          <img v-if="gallery.cover_url" :src="gallery.cover_url" :alt="gallery.name" class="ws-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        </div>
        <div class="p-5">
          <h2 class="sf-heading text-lg font-semibold">{{ gallery.name }}</h2>
          <p v-if="gallery.description" class="sf-muted text-sm mt-1 ws-line-clamp-2">{{ gallery.description }}</p>
          <p class="sf-subtle text-xs mt-3">{{ gallery.item_count }} {{ gallery.item_count === 1 ? 'foto' : 'fotos' }}</p>
        </div>
      </WebsiteSmartLink>
    </div>
    <div v-else class="ws-card p-12 text-center sf-muted">Aún no hay galerías publicadas.</div>
  </div>
</template>
