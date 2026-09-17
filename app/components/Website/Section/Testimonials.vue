<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface Testimonial { quote?: string; name?: string; role?: string; avatar_url?: string }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => (Array.isArray(props.section.props.items) ? props.section.props.items : []) as Testimonial[])
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :eyebrow="String(section.props.eyebrow ?? '')" :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div :class="['grid gap-6', items.length === 1 ? 'max-w-2xl mx-auto' : items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3']">
      <blockquote v-for="(item, index) in items" :key="index" class="ws-card p-7 text-left flex flex-col">
        <svg class="w-8 h-8 mb-4 opacity-40" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 6C4.9 6 3 7.9 3 10.2c0 2.1 1.5 3.8 3.5 4.1-.4 1.6-1.5 2.8-3 3.4l.6 1.3C7.6 17.9 10 15 10 11V9c0-1.7-1.3-3-2.8-3zm9.6 0c-2.3 0-4.2 1.9-4.2 4.2 0 2.1 1.5 3.8 3.5 4.1-.4 1.6-1.5 2.8-3 3.4l.6 1.3c3.5-1.1 5.9-4 5.9-8V9c0-1.7-1.3-3-2.8-3z" /></svg>
        <p class="text-base leading-relaxed flex-1">{{ item.quote }}</p>
        <footer class="mt-6 flex items-center gap-3">
          <img v-if="item.avatar_url" :src="item.avatar_url" :alt="item.name ?? ''" class="w-11 h-11 rounded-full object-cover" />
          <span v-else class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm" :style="{ backgroundColor: 'var(--sf-primary-soft)', color: 'var(--sf-primary-readable)' }">{{ (item.name ?? '?').slice(0, 1) }}</span>
          <div>
            <p class="font-semibold text-sm">{{ item.name }}</p>
            <p v-if="item.role" class="sf-muted text-xs">{{ item.role }}</p>
          </div>
        </footer>
      </blockquote>
    </div>
  </div>
</template>
