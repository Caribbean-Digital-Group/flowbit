<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

const props = defineProps<{ section: WebsiteSection }>()
const html = computed(() => String(props.section.props.html ?? ''))
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- HTML saneado en servidor antes de guardarse -->
    <div class="ws-prose ws-prose--compact" v-html="html" />
  </div>
</template>
