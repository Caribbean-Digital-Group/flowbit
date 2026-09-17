<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface Plan { name?: string; price?: string; period?: string; features?: string; button_label?: string; button_href?: string; highlighted?: boolean }

const props = defineProps<{ section: WebsiteSection }>()
const items = computed(() => (Array.isArray(props.section.props.items) ? props.section.props.items : []) as Plan[])
const featureLines = (plan: Plan): string[] => (plan.features ?? '').split('\n').map(l => l.trim()).filter(Boolean)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :eyebrow="String(section.props.eyebrow ?? '')" :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div :class="['grid gap-6 items-stretch', items.length === 1 ? 'max-w-md mx-auto' : items.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : items.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3']">
      <div
        v-for="(plan, index) in items"
        :key="index"
        :class="['ws-card p-7 text-left flex flex-col relative', plan.highlighted ? 'ring-2' : '']"
        :style="plan.highlighted ? { '--tw-ring-color': 'var(--sf-primary-strong)' } : {}"
      >
        <span v-if="plan.highlighted" class="ws-chip absolute -top-3 left-6">Recomendado</span>
        <h3 class="sf-heading text-lg font-semibold">{{ plan.name }}</h3>
        <p class="mt-3 flex items-baseline gap-1">
          <span class="sf-heading text-4xl font-bold">{{ plan.price }}</span>
          <span v-if="plan.period" class="sf-muted text-sm">{{ plan.period }}</span>
        </p>
        <ul class="mt-6 space-y-2.5 flex-1">
          <li v-for="(line, i) in featureLines(plan)" :key="i" class="flex items-start gap-2 text-sm">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" :style="{ color: 'var(--sf-primary-readable)' }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
            <span>{{ line }}</span>
          </li>
        </ul>
        <WebsiteSmartLink v-if="plan.button_label && plan.button_href" :href="plan.button_href" :class="['sf-btn mt-7 w-full', plan.highlighted ? 'sf-btn--primary' : 'sf-btn--outline']">
          {{ plan.button_label }}
        </WebsiteSmartLink>
      </div>
    </div>
  </div>
</template>
