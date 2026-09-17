<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface Logo { image_url?: string; name?: string; url?: string }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => ((Array.isArray(props.section.props.items) ? props.section.props.items : []) as Logo[]).filter(l => l.image_url || l.name))
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <p v-if="section.props.title" class="sf-eyebrow mb-6">{{ section.props.title }}</p>
    <div class="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
      <component
        :is="logo.url ? 'a' : 'div'"
        v-for="(logo, index) in items"
        :key="index"
        :href="logo.url || undefined"
        :target="logo.url ? '_blank' : undefined"
        :rel="logo.url ? 'noopener' : undefined"
        class="opacity-70 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
      >
        <img v-if="logo.image_url" :src="logo.image_url" :alt="logo.name ?? ''" class="h-10 sm:h-12 w-auto object-contain" loading="lazy" />
        <span v-else class="sf-heading text-lg font-semibold">{{ logo.name }}</span>
      </component>
    </div>
  </div>
</template>
