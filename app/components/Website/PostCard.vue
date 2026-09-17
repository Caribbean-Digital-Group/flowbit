<script setup lang="ts">
import type { WebsitePostCard } from '~/composables/useWebsite'

interface Props {
  post: WebsitePostCard
  variant?: 'card' | 'featured' | 'row'
}

withDefaults(defineProps<Props>(), { variant: 'card' })
</script>

<template>
  <article v-if="variant === 'featured'" class="ws-card ws-card--hover overflow-hidden grid lg:grid-cols-2 text-left">
    <WebsiteSmartLink :href="`/blog/${post.slug}`" class="block overflow-hidden" :style="{ backgroundColor: 'var(--sf-surface-muted)' }">
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.cover_alt || post.title" class="ws-cover min-h-[260px] lg:min-h-full" />
      <div v-else class="min-h-[260px] lg:min-h-full" />
    </WebsiteSmartLink>
    <div class="p-7 lg:p-10 flex flex-col">
      <div class="flex items-center gap-2 flex-wrap">
        <WebsiteSmartLink v-if="post.category" :href="`/blog/categoria/${post.category.slug}`" class="ws-chip">{{ post.category.name }}</WebsiteSmartLink>
        <span v-if="post.is_pinned" class="ws-chip">Fijado</span>
      </div>
      <h2 class="sf-heading text-2xl lg:text-3xl font-bold mt-4">
        <WebsiteSmartLink :href="`/blog/${post.slug}`" class="hover:opacity-80">{{ post.title }}</WebsiteSmartLink>
      </h2>
      <p v-if="post.subtitle || post.excerpt" class="sf-muted mt-3 leading-relaxed ws-line-clamp-3">{{ post.subtitle || post.excerpt }}</p>
      <WebsitePostMeta :post="post" class="mt-auto pt-6" />
    </div>
  </article>

  <article v-else-if="variant === 'row'" class="flex gap-5 text-left">
    <WebsiteSmartLink :href="`/blog/${post.slug}`" class="flex-shrink-0 w-28 h-28 sm:w-40 sm:h-28 overflow-hidden" :style="{ borderRadius: 'var(--sf-radius-md)', backgroundColor: 'var(--sf-surface-muted)' }">
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.cover_alt || post.title" class="ws-cover" loading="lazy" />
    </WebsiteSmartLink>
    <div class="min-w-0 flex-1">
      <WebsiteSmartLink v-if="post.category" :href="`/blog/categoria/${post.category.slug}`" class="text-xs font-semibold" :style="{ color: 'var(--sf-primary-readable)' }">{{ post.category.name }}</WebsiteSmartLink>
      <h3 class="sf-heading text-lg font-semibold mt-1 ws-line-clamp-2">
        <WebsiteSmartLink :href="`/blog/${post.slug}`" class="hover:opacity-80">{{ post.title }}</WebsiteSmartLink>
      </h3>
      <WebsitePostMeta :post="post" compact class="mt-2" />
    </div>
  </article>

  <article v-else class="ws-card ws-card--hover overflow-hidden flex flex-col text-left group">
    <WebsiteSmartLink :href="`/blog/${post.slug}`" class="block ws-aspect-video overflow-hidden" :style="{ backgroundColor: 'var(--sf-surface-muted)' }">
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.cover_alt || post.title" class="ws-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
    </WebsiteSmartLink>
    <div class="p-6 flex flex-col flex-1">
      <div class="flex items-center gap-2 flex-wrap">
        <WebsiteSmartLink v-if="post.category" :href="`/blog/categoria/${post.category.slug}`" class="ws-chip">{{ post.category.name }}</WebsiteSmartLink>
        <span v-if="post.is_pinned" class="ws-chip">Fijado</span>
      </div>
      <h3 class="sf-heading text-xl font-semibold mt-3 ws-line-clamp-2">
        <WebsiteSmartLink :href="`/blog/${post.slug}`" class="hover:opacity-80">{{ post.title }}</WebsiteSmartLink>
      </h3>
      <p v-if="post.excerpt" class="sf-muted mt-2 text-sm leading-relaxed ws-line-clamp-3">{{ post.excerpt }}</p>
      <WebsitePostMeta :post="post" compact class="mt-auto pt-5" />
    </div>
  </article>
</template>
