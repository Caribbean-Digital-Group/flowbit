<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface StatItem { value?: string; label?: string }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => (Array.isArray(props.section.props.items) ? props.section.props.items : []) as StatItem[])
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :title="String(section.props.title ?? '')" :align="section.style.align" />
    <dl :class="['grid gap-8', items.length <= 2 ? 'grid-cols-2' : items.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3']">
      <div v-for="(item, index) in items" :key="index" class="text-center">
        <dd class="sf-heading text-4xl sm:text-5xl font-bold" :style="section.style.background === 'surface' || section.style.background === 'muted' ? { color: 'var(--sf-primary-readable)' } : {}">{{ item.value }}</dd>
        <dt class="sf-muted mt-2 text-sm font-medium uppercase tracking-wider">{{ item.label }}</dt>
      </div>
    </dl>
  </div>
</template>
