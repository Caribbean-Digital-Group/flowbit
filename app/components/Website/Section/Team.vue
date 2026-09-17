<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface Member { name?: string; role?: string; photo_url?: string; text?: string }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => (Array.isArray(props.section.props.items) ? props.section.props.items : []) as Member[])
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :eyebrow="String(section.props.eyebrow ?? '')" :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div :class="['grid gap-8', items.length <= 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4']">
      <div v-for="(member, index) in items" :key="index" class="text-center">
        <img v-if="member.photo_url" :src="member.photo_url" :alt="member.name ?? ''" class="w-32 h-32 mx-auto rounded-full object-cover shadow-lg" />
        <span v-else class="w-32 h-32 mx-auto rounded-full flex items-center justify-center text-3xl font-bold" :style="{ backgroundColor: 'var(--sf-primary-soft)', color: 'var(--sf-primary-readable)' }">{{ (member.name ?? '?').slice(0, 1) }}</span>
        <h3 class="sf-heading mt-4 text-lg font-semibold">{{ member.name }}</h3>
        <p v-if="member.role" class="text-sm font-medium" :style="{ color: 'var(--sf-primary-readable)' }">{{ member.role }}</p>
        <p v-if="member.text" class="sf-muted mt-2 text-sm leading-relaxed">{{ member.text }}</p>
      </div>
    </div>
  </div>
</template>
