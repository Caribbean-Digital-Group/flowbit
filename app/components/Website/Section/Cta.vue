<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'

interface CtaProps { title?: string; text?: string; button_label?: string; button_href?: string; secondary_label?: string; secondary_href?: string }

const props = defineProps<{ section: WebsiteSection }>()
const p = computed(() => props.section.props as CtaProps)
const onMedia = computed(() => props.section.style.background === 'primary' || props.section.style.background === 'dark')
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="sf-heading text-3xl sm:text-4xl font-bold">{{ p.title }}</h2>
    <p v-if="p.text" class="sf-muted mt-4 text-lg leading-relaxed whitespace-pre-line">{{ p.text }}</p>
    <div :class="['mt-8 flex flex-wrap gap-3', section.style.align === 'center' ? 'justify-center' : '']">
      <WebsiteSmartLink v-if="p.button_label && p.button_href" :href="p.button_href" :class="['sf-btn', onMedia ? 'sf-btn--on-media' : 'sf-btn--primary']">{{ p.button_label }}</WebsiteSmartLink>
      <WebsiteSmartLink v-if="p.secondary_label && p.secondary_href" :href="p.secondary_href" :class="['sf-btn', onMedia ? 'sf-btn--outline-on-media' : 'sf-btn--outline']">{{ p.secondary_label }}</WebsiteSmartLink>
    </div>
  </div>
</template>
