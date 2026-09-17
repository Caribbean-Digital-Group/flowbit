<script setup lang="ts">
definePageMeta({ layout: 'website' })

const route = useRoute()
const pageSlug = computed(() => {
  const raw = route.params.page_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})
</script>

<template>
  <WebsitePageView :page-slug="pageSlug" />
</template>
