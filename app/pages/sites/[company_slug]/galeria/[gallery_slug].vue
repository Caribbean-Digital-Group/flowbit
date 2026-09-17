<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteGalleryDetail } from '~/composables/useWebsite'

definePageMeta({ layout: 'website' })

const route = useRoute()
const websiteStore = useWebsiteStore()
const { slug, site, preview } = storeToRefs(websiteStore)
const { getGallery } = useWebsite()

const gallerySlug = computed(() => String(Array.isArray(route.params.gallery_slug) ? route.params.gallery_slug[0] : route.params.gallery_slug ?? ''))
const gallery = ref<WebsiteGalleryDetail | null>(null)
const isLoading = ref(true)
const lightboxIndex = ref<number | null>(null)
const carouselIndex = ref(0)

watch([slug, gallerySlug, preview], async () => {
  if (!slug.value) return
  isLoading.value = true
  gallery.value = await getGallery(slug.value, gallerySlug.value, preview.value)
  isLoading.value = false
}, { immediate: true })

useHead(() => ({
  title: gallery.value?.name ?? 'Galería',
  meta: [
    { name: 'description', content: gallery.value?.description || `Galería ${gallery.value?.name ?? ''} de ${site.value?.name ?? ''}` },
    ...(gallery.value?.cover_url || gallery.value?.items[0]?.image_url ? [{ property: 'og:image', content: gallery.value?.cover_url || gallery.value?.items[0]?.image_url }] : [])
  ]
}))
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
    <WebsiteSmartLink href="/galeria" class="sf-link text-sm">← Todas las galerías</WebsiteSmartLink>
    <div v-if="isLoading" class="flex justify-center py-20">
      <div class="w-9 h-9 rounded-full border-4 animate-spin" :style="{ borderColor: 'var(--sf-border)', borderTopColor: 'var(--sf-primary)' }" />
    </div>
    <template v-else-if="gallery">
      <header class="mt-4 mb-10">
        <h1 class="sf-heading text-4xl sm:text-5xl font-bold">{{ gallery.name }}</h1>
        <p v-if="gallery.description" class="sf-muted mt-3 text-lg max-w-2xl">{{ gallery.description }}</p>
      </header>

      <!-- Carrusel -->
      <div v-if="gallery.layout === 'carousel' && gallery.items.length" class="relative">
        <div class="overflow-hidden" :style="{ borderRadius: 'var(--sf-radius-xl)' }">
          <img :src="gallery.items[carouselIndex]?.image_url" :alt="gallery.items[carouselIndex]?.alt_text || ''" class="w-full ws-aspect-video object-cover cursor-zoom-in" @click="lightboxIndex = carouselIndex" />
        </div>
        <p v-if="gallery.items[carouselIndex]?.caption" class="sf-muted text-sm text-center mt-3">{{ gallery.items[carouselIndex]?.caption }}</p>
        <div class="flex items-center justify-center gap-2 mt-4">
          <button type="button" class="sf-icon-btn" aria-label="Anterior" @click="carouselIndex = (carouselIndex - 1 + gallery.items.length) % gallery.items.length">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span class="sf-subtle text-xs">{{ carouselIndex + 1 }} / {{ gallery.items.length }}</span>
          <button type="button" class="sf-icon-btn" aria-label="Siguiente" @click="carouselIndex = (carouselIndex + 1) % gallery.items.length">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <!-- Mosaico / cuadrícula -->
      <div v-else-if="gallery.items.length" :class="gallery.layout === 'masonry' ? 'ws-masonry' : 'grid grid-cols-2 lg:grid-cols-3 gap-4'">
        <figure v-for="(item, index) in gallery.items" :key="item.id" class="group">
          <button type="button" class="block w-full overflow-hidden" :style="{ borderRadius: 'var(--sf-radius-lg)' }" @click="lightboxIndex = index">
            <img :src="item.image_url" :alt="item.alt_text || item.caption || ''" :class="['w-full object-cover transition-transform duration-500 group-hover:scale-105', gallery.layout === 'masonry' ? '' : 'ws-aspect-4-3']" loading="lazy" />
          </button>
          <figcaption v-if="item.caption" class="sf-subtle text-xs mt-2 text-center">{{ item.caption }}</figcaption>
        </figure>
      </div>
      <div v-else class="ws-card p-12 text-center sf-muted">Esta galería aún no tiene fotos.</div>

      <WebsiteLightbox v-if="lightboxIndex !== null" :items="gallery.items" :index="lightboxIndex" @close="lightboxIndex = null" @navigate="lightboxIndex = $event" />
    </template>
    <div v-else class="max-w-2xl mx-auto py-24 text-center">
      <h1 class="sf-heading text-3xl font-bold">Galería no encontrada</h1>
    </div>
  </div>
</template>
