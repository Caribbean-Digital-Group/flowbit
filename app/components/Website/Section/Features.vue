<script setup lang="ts">
import { SECTION_ICON_PATHS, type WebsiteSection } from '~/utils/website/sections'

interface FeatureItem { icon?: string; title?: string; text?: string }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => (Array.isArray(props.section.props.items) ? props.section.props.items : []) as FeatureItem[])
const columns = computed(() => Number(props.section.props.columns ?? 3))
const gridClass = computed(() => columns.value === 2 ? 'sm:grid-cols-2' : columns.value === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3')
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading
      :eyebrow="String(section.props.eyebrow ?? '')"
      :title="String(section.props.title ?? '')"
      :text="String(section.props.text ?? '')"
      :align="section.style.align"
    />
    <div :class="['grid grid-cols-1 gap-6', gridClass]">
      <div v-for="(item, index) in items" :key="index" :class="['ws-card p-6', section.style.align === 'center' ? 'text-center' : 'text-left']">
        <span :class="['ws-icon-badge mb-4', section.style.align === 'center' ? 'mx-auto' : '']">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="SECTION_ICON_PATHS[item.icon ?? 'star'] ?? SECTION_ICON_PATHS.star" />
          </svg>
        </span>
        <h3 class="sf-heading text-lg font-semibold">{{ item.title }}</h3>
        <p v-if="item.text" class="sf-muted mt-2 text-sm leading-relaxed">{{ item.text }}</p>
      </div>
    </div>
  </div>
</template>
