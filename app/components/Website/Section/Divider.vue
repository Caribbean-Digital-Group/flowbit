<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

const props = defineProps<{ section: WebsiteSection }>()
const variant = computed(() => String(props.section.props.variant ?? 'line'))
</script>

<template>
  <div :class="['max-w-6xl mx-auto px-4 sm:px-6 lg:px-8', variant === 'space' ? 'py-8' : 'py-4']">
    <hr v-if="variant === 'line'" class="sf-divider" />
  </div>
</template>
