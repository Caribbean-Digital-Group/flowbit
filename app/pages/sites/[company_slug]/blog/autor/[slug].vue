<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteAuthorInfo } from '~/composables/useWebsite'

definePageMeta({ layout: 'website' })

const route = useRoute()
const websiteStore = useWebsiteStore()
const { slug, site, preview } = storeToRefs(websiteStore)
const { getTaxonomy } = useWebsite()

const authorSlug = computed(() => String(Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug ?? ''))
const author = ref<WebsiteAuthorInfo | null>(null)

watch([slug, authorSlug, preview], async () => {
  if (!slug.value) return
  const taxonomy = await getTaxonomy(slug.value, preview.value)
  author.value = taxonomy?.authors.find(a => a.slug === authorSlug.value) ?? null
}, { immediate: true })

useHead(() => ({
  title: author.value ? `${author.value.name} — ${site.value?.blog_title ?? 'Blog'}` : 'Autor',
  meta: [{ name: 'description', content: author.value?.bio || `Publicaciones de ${author.value?.name ?? ''}` }]
}))
</script>

<template>
  <div>
    <header class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
      <WebsiteSmartLink href="/blog" class="sf-link text-sm">← {{ site?.blog_title ?? 'Blog' }}</WebsiteSmartLink>
      <div v-if="author" class="mt-6 max-w-3xl">
        <WebsiteAuthorCard :author="author" :linked="false" />
      </div>
      <h1 v-else class="sf-heading text-4xl font-bold mt-4">Autor</h1>
    </header>
    <WebsitePostListing :filters="{ author: authorSlug }" empty-message="Este autor aún no tiene publicaciones." />
  </div>
</template>
