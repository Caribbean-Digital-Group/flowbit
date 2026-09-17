<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

const props = defineProps<{ section: WebsiteSection }>()
const html = computed(() => String(props.section.props.html ?? ''))
const width = computed(() => {
  const w = props.section.props.max_width
  return w === 'narrow' ? 'max-w-2xl' : w === 'wide' ? 'max-w-6xl' : 'max-w-3xl'
})
</script>

<template>
  <div :class="['mx-auto px-4 sm:px-6 lg:px-8', width]">
    <!-- HTML saneado en servidor (/api/website/render) -->
    <div class="ws-prose" v-html="html" />
  </div>
</template>
