<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteSection } from '~/utils/website/sections'
import type { WebsitePostCard } from '~/composables/useWebsite'

const props = defineProps<{ section: WebsiteSection }>()
const websiteStore = useWebsiteStore()
const { slug, preview, site } = storeToRefs(websiteStore)
const { getPosts } = useWebsite()

const posts = ref<WebsitePostCard[]>([])
const limit = computed(() => Math.min(Math.max(Number(props.section.props.limit ?? 3), 1), 9))
const category = computed(() => String(props.section.props.category_slug ?? '').trim() || null)

const load = async () => {
  if (!slug.value) return
  const result = await getPosts(slug.value, { pageSize: limit.value, category: category.value }, preview.value)
  posts.value = result?.posts ?? []
}

watch([slug, limit, category, preview], load, { immediate: true })
</script>

<template>
  <div v-if="site?.blog_enabled !== false" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <WebsiteSectionHeading :eyebrow="String(section.props.eyebrow ?? '')" :title="String(section.props.title ?? '')" :align="section.style.align" class="mb-0 flex-1" />
      <WebsiteSmartLink v-if="section.props.show_more !== false && posts.length" href="/blog" class="sf-link text-sm mb-10">Ver el blog →</WebsiteSmartLink>
    </div>
    <div v-if="posts.length" :class="['grid gap-6 mt-8 text-left', posts.length === 1 ? 'max-w-xl' : posts.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3']">
      <WebsitePostCard v-for="post in posts" :key="post.id" :post="post" />
    </div>
    <p v-else class="sf-muted text-sm mt-8">Aún no hay publicaciones.</p>
  </div>
</template>
