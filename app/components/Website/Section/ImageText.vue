<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface ImageTextProps {
  eyebrow?: string
  title?: string
  html?: string
  image_url?: string
  image_alt?: string
  image_position?: 'left' | 'right'
  button_label?: string
  button_href?: string
}

const props = defineProps<{ section: WebsiteSection }>()
const p = computed(() => props.section.props as ImageTextProps)
const onMedia = computed(() => props.section.style.background === 'primary' || props.section.style.background === 'dark')
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center text-left">
      <div :class="p.image_position === 'left' ? 'lg:order-2' : ''">
        <p v-if="p.eyebrow" class="sf-eyebrow mb-3">{{ p.eyebrow }}</p>
        <h2 v-if="p.title" class="sf-heading text-3xl sm:text-4xl font-bold mb-5">{{ p.title }}</h2>
        <div class="ws-prose ws-prose--compact" v-html="p.html ?? ''" />
        <WebsiteSmartLink v-if="p.button_label && p.button_href" :href="p.button_href" :class="['sf-btn mt-7', onMedia ? 'sf-btn--on-media' : 'sf-btn--primary']">
          {{ p.button_label }}
        </WebsiteSmartLink>
      </div>
      <div v-if="p.image_url" :class="p.image_position === 'left' ? 'lg:order-1' : ''">
        <img :src="p.image_url" :alt="p.image_alt || p.title || ''" class="w-full object-cover ws-aspect-4-3" :style="{ borderRadius: 'var(--sf-radius-xl)' }" />
      </div>
    </div>
  </div>
</template>
