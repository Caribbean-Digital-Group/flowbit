<script setup lang="ts">
import { FEATURE_ICON_PATHS, type FeatureIcon } from '~/utils/features'

interface Props {
  icon: FeatureIcon
  /** Clases de tamaño y color del SVG. */
  iconClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  iconClass: 'w-6 h-6'
})

const path = computed(() => FEATURE_ICON_PATHS[props.icon])
</script>

<template>
  <svg :class="iconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="path" />
  </svg>
</template>
