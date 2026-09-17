<script setup lang="ts">
import type { WebsitePostCard } from '~/composables/useWebsite'

interface Props {
  post: WebsitePostCard
  compact?: boolean
}

withDefaults(defineProps<Props>(), { compact: false })
</script>

<template>
  <div class="flex items-center gap-3 text-xs sf-muted">
    <WebsiteSmartLink v-if="post.author" :href="`/blog/autor/${post.author.slug}`" class="flex items-center gap-2 hover:opacity-80 min-w-0">
      <img v-if="post.author.avatar_url" :src="post.author.avatar_url" :alt="post.author.name" :class="[compact ? 'w-6 h-6' : 'w-8 h-8', 'rounded-full object-cover']" />
      <span v-else :class="[compact ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs', 'rounded-full flex items-center justify-center font-bold']" :style="{ backgroundColor: 'var(--sf-primary-soft)', color: 'var(--sf-primary-readable)' }">{{ post.author.name.slice(0, 1) }}</span>
      <span class="font-medium truncate" :class="compact ? '' : 'text-sm sf-text-strong'">{{ post.author.name }}</span>
    </WebsiteSmartLink>
    <span v-if="post.author && post.published_at" aria-hidden="true">·</span>
    <time v-if="post.published_at" :datetime="post.published_at">{{ formatWebsiteDate(post.published_at, { day: 'numeric', month: 'short', year: 'numeric' }) }}</time>
    <span aria-hidden="true">·</span>
    <span>{{ readingLabel(post.reading_minutes) }}</span>
  </div>
</template>
