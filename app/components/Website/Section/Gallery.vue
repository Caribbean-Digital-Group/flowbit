<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface GalleryItem { image_url?: string; alt_text?: string; caption?: string }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => ((Array.isArray(props.section.props.items) ? props.section.props.items : []) as GalleryItem[]).filter(i => i.image_url))
const columns = computed(() => Number(props.section.props.columns ?? 3))
const gridClass = computed(() => columns.value === 2 ? 'sm:grid-cols-2' : columns.value === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3')
const gallerySlug = computed(() => String(props.section.props.gallery_slug ?? '').trim())
const lightboxIndex = ref<number | null>(null)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :eyebrow="String(section.props.eyebrow ?? '')" :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div :class="['grid gap-4', gridClass]">
      <figure v-for="(item, index) in items" :key="index" class="group">
        <button type="button" class="block w-full overflow-hidden" :style="{ borderRadius: 'var(--sf-radius-lg)' }" @click="lightboxIndex = index">
          <img :src="item.image_url" :alt="item.alt_text || item.caption || ''" class="w-full ws-aspect-4-3 object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        </button>
        <figcaption v-if="item.caption" class="sf-subtle text-xs mt-2 text-center">{{ item.caption }}</figcaption>
      </figure>
    </div>
    <div v-if="gallerySlug" class="mt-8 text-center">
      <WebsiteSmartLink :href="`/galeria/${gallerySlug}`" class="sf-btn sf-btn--outline">Ver galería completa</WebsiteSmartLink>
    </div>
    <WebsiteLightbox
      v-if="lightboxIndex !== null"
      :items="items.map(i => ({ image_url: i.image_url ?? '', alt_text: i.alt_text ?? null, caption: i.caption ?? null }))"
      :index="lightboxIndex"
      @close="lightboxIndex = null"
      @navigate="lightboxIndex = $event"
    />
  </div>
</template>
