<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface FaqItem { question?: string; answer?: string }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => (Array.isArray(props.section.props.items) ? props.section.props.items : []) as FaqItem[])
const openIndex = ref<number | null>(0)
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :eyebrow="String(section.props.eyebrow ?? '')" :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div class="space-y-3 text-left">
      <div v-for="(item, index) in items" :key="index" class="ws-card overflow-hidden">
        <button
          type="button"
          class="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-semibold"
          :aria-expanded="openIndex === index"
          @click="openIndex = openIndex === index ? null : index"
        >
          <span>{{ item.question }}</span>
          <svg :class="['w-5 h-5 flex-shrink-0 transition-transform', openIndex === index ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div v-if="openIndex === index" class="px-5 pb-5 sf-muted text-sm leading-relaxed whitespace-pre-line">{{ item.answer }}</div>
      </div>
    </div>
  </div>
</template>
