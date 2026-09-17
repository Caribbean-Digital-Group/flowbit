<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

const props = defineProps<{ section: WebsiteSection }>()
const embedUrl = computed(() => {
  const url = String(props.section.props.embed_url ?? '').trim()
  return isAllowedMapEmbed(url) ? url : null
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div class="grid lg:grid-cols-3 gap-6 items-start text-left">
      <div :class="['overflow-hidden ws-card', section.props.address ? 'lg:col-span-2' : 'lg:col-span-3']">
        <iframe v-if="embedUrl" :src="embedUrl" class="w-full h-[380px] border-0" title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen />
        <div v-else class="h-[380px] flex items-center justify-center sf-muted text-sm px-6 text-center">Pega la URL de inserción de Google Maps (Compartir → Insertar un mapa).</div>
      </div>
      <div v-if="section.props.address" class="ws-card p-6">
        <p class="sf-eyebrow mb-2">Dirección</p>
        <p class="whitespace-pre-line leading-relaxed">{{ section.props.address }}</p>
      </div>
    </div>
  </div>
</template>
