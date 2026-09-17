<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'website' })

const websiteStore = useWebsiteStore()
const { site } = storeToRefs(websiteStore)

useHead(() => ({
  title: site.value?.blog_title ?? 'Blog',
  meta: [
    { name: 'description', content: site.value?.blog_description || `Publicaciones de ${site.value?.name ?? ''}` },
    { property: 'og:title', content: site.value?.blog_title ?? 'Blog' },
    ...(site.value?.og_image_url ? [{ property: 'og:image', content: site.value.og_image_url }] : [])
  ],
  link: site.value ? [{ rel: 'alternate', type: 'application/rss+xml', title: `${site.value.blog_title} — RSS`, href: `${websiteStore.basePath}/blog/rss.xml` }] : []
}))
</script>

<template>
  <div v-if="site">
    <div v-if="site.blog_enabled === false" class="max-w-2xl mx-auto px-4 py-28 text-center">
      <h1 class="sf-heading text-3xl font-bold">El blog no está disponible</h1>
    </div>
    <template v-else>
      <header class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <p class="sf-eyebrow mb-2">{{ site.name }}</p>
        <h1 class="sf-heading text-4xl sm:text-5xl font-bold">{{ site.blog_title }}</h1>
        <p v-if="site.blog_description" class="sf-muted mt-3 text-lg max-w-2xl">{{ site.blog_description }}</p>
      </header>
      <WebsitePostListing :filters="{}" show-featured />
    </template>
  </div>
</template>
