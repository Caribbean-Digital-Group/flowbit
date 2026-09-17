<script setup lang="ts">
import type { WebsiteAuthorInfo } from '~/composables/useWebsite'

interface Props {
  author: WebsiteAuthorInfo
  linked?: boolean
}

withDefaults(defineProps<Props>(), { linked: true })
const SmartLink = resolveComponent('WebsiteSmartLink')
</script>

<template>
  <div class="ws-card p-6 flex flex-col sm:flex-row gap-5 text-left">
    <img v-if="author.avatar_url" :src="author.avatar_url" :alt="author.name" class="w-20 h-20 rounded-full object-cover flex-shrink-0" />
    <span v-else class="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0" :style="{ backgroundColor: 'var(--sf-primary-soft)', color: 'var(--sf-primary-readable)' }">{{ author.name.slice(0, 1) }}</span>
    <div class="min-w-0">
      <p class="sf-eyebrow mb-1">Escrito por</p>
      <component :is="linked ? SmartLink : 'span'" v-bind="linked ? { href: `/blog/autor/${author.slug}` } : {}" class="sf-heading text-xl font-bold hover:opacity-80">{{ author.name }}</component>
      <p v-if="author.role_title" class="text-sm font-medium mt-0.5" :style="{ color: 'var(--sf-primary-readable)' }">{{ author.role_title }}</p>
      <p v-if="author.bio" class="sf-muted text-sm mt-2 leading-relaxed">{{ author.bio }}</p>
      <div v-if="author.social_links?.length" class="flex flex-wrap gap-3 mt-3">
        <a v-for="link in author.social_links" :key="link.network + link.url" :href="link.url" target="_blank" rel="noopener" class="sf-link text-xs capitalize">{{ link.network }}</a>
      </div>
    </div>
  </div>
</template>
