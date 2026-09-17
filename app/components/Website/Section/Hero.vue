<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface HeroProps {
  eyebrow?: string
  title?: string
  subtitle?: string
  primary_label?: string
  primary_href?: string
  secondary_label?: string
  secondary_href?: string
  image_url?: string
  layout?: 'split' | 'centered' | 'banner'
}

const props = defineProps<{ section: WebsiteSection }>()
const p = computed(() => props.section.props as HeroProps)
const onMedia = computed(() => props.section.style.background === 'primary' || props.section.style.background === 'dark' || p.value.layout === 'banner')
const layout = computed(() => p.value.layout ?? 'split')
</script>

<template>
  <div
    :class="['relative overflow-hidden', layout === 'banner' ? 'min-h-[420px] flex items-center' : '']"
  >
    <template v-if="layout === 'banner' && p.image_url">
      <img :src="p.image_url" alt="" class="absolute inset-0 w-full h-full object-cover" />
      <div class="absolute inset-0 bg-black/55" />
    </template>

    <div
      :class="[
        'relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full',
        layout === 'split' && p.image_url ? 'grid lg:grid-cols-2 gap-10 lg:gap-16 items-center text-left' : 'text-center',
        layout === 'banner' ? 'text-white py-16' : ''
      ]"
    >
      <div :class="layout === 'split' && p.image_url ? '' : 'max-w-3xl mx-auto'">
        <p v-if="p.eyebrow" :class="['sf-eyebrow mb-3', layout === 'banner' ? 'text-white/80' : '']">{{ p.eyebrow }}</p>
        <h1 :class="['sf-heading font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.05]', layout === 'banner' ? 'text-white' : '']">{{ p.title }}</h1>
        <p v-if="p.subtitle" :class="['mt-5 text-lg sm:text-xl leading-relaxed whitespace-pre-line', layout === 'banner' ? 'text-white/85' : 'sf-muted']">{{ p.subtitle }}</p>
        <div v-if="p.primary_label || p.secondary_label" :class="['mt-8 flex flex-wrap gap-3', layout === 'split' && p.image_url ? '' : 'justify-center']">
          <WebsiteSmartLink v-if="p.primary_label && p.primary_href" :href="p.primary_href" :class="['sf-btn', onMedia ? 'sf-btn--on-media' : 'sf-btn--primary']">
            {{ p.primary_label }}
          </WebsiteSmartLink>
          <WebsiteSmartLink v-if="p.secondary_label && p.secondary_href" :href="p.secondary_href" :class="['sf-btn', onMedia ? 'sf-btn--outline-on-media' : 'sf-btn--outline']">
            {{ p.secondary_label }}
          </WebsiteSmartLink>
        </div>
      </div>
      <div v-if="layout === 'split' && p.image_url" class="relative">
        <img :src="p.image_url" :alt="p.title ?? ''" class="w-full rounded-3xl object-cover ws-aspect-4-3 shadow-2xl" :style="{ borderRadius: 'var(--sf-radius-xl)' }" />
      </div>
      <div v-else-if="layout === 'centered' && p.image_url" class="mt-12 max-w-4xl mx-auto">
        <img :src="p.image_url" :alt="p.title ?? ''" class="w-full object-cover ws-aspect-video shadow-2xl" :style="{ borderRadius: 'var(--sf-radius-xl)' }" />
      </div>
    </div>
  </div>
</template>
