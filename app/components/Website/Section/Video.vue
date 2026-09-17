<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

const props = defineProps<{ section: WebsiteSection }>()
const embedUrl = computed(() => toEmbedUrl(String(props.section.props.url ?? '')))
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div v-if="embedUrl" class="overflow-hidden shadow-xl" :style="{ borderRadius: 'var(--sf-radius-xl)' }">
      <iframe :src="embedUrl" class="w-full ws-aspect-video" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" />
    </div>
    <div v-else class="ws-card ws-aspect-video flex items-center justify-center sf-muted text-sm">Agrega una URL de YouTube o Vimeo.</div>
    <p v-if="section.props.caption" class="sf-subtle text-sm mt-3 text-center">{{ section.props.caption }}</p>
  </div>
</template>
