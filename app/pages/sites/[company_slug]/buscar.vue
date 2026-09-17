<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsitePostCard } from '~/composables/useWebsite'

definePageMeta({ layout: 'website' })

const route = useRoute()
const router = useRouter()
const websiteStore = useWebsiteStore()
const { slug, site, preview } = storeToRefs(websiteStore)
const { search } = useWebsite()
const nav = useWebsiteNav()

const query = computed(() => String(route.query.q ?? '').trim())
const term = ref(query.value)
const posts = ref<WebsitePostCard[]>([])
const pages = ref<{ id: string; title: string; slug: string; is_home: boolean; excerpt: string | null }[]>([])
const isLoading = ref(false)

watch([slug, query], async () => {
  term.value = query.value
  if (!slug.value || query.value.length < 2) {
    posts.value = []
    pages.value = []
    return
  }
  isLoading.value = true
  const result = await search(slug.value, query.value)
  posts.value = result?.posts ?? []
  pages.value = result?.pages ?? []
  isLoading.value = false
}, { immediate: true })

const submit = () => {
  router.push({ path: route.path, query: { q: term.value.trim(), ...(preview.value ? { preview: '1' } : {}) } })
}

useHead(() => ({
  title: query.value ? `Buscar: ${query.value}` : 'Buscar',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
}))
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
    <h1 class="sf-heading text-4xl font-bold">Buscar</h1>
    <form class="flex gap-2 mt-6" @submit.prevent="submit">
      <input v-model="term" type="search" class="sf-input text-base" placeholder="¿Qué estás buscando?" autofocus />
      <button type="submit" class="sf-btn sf-btn--primary">Buscar</button>
    </form>

    <div v-if="isLoading" class="flex justify-center py-16">
      <div class="w-9 h-9 rounded-full border-4 animate-spin" :style="{ borderColor: 'var(--sf-border)', borderTopColor: 'var(--sf-primary)' }" />
    </div>

    <template v-else-if="query.length >= 2">
      <p class="sf-muted text-sm mt-8">
        {{ posts.length + pages.length }} resultado{{ posts.length + pages.length === 1 ? '' : 's' }} para «{{ query }}»
      </p>

      <section v-if="pages.length" class="mt-8">
        <p class="sf-eyebrow mb-3">Páginas</p>
        <ul class="space-y-2">
          <li v-for="page in pages" :key="page.id">
            <NuxtLink :to="nav.to(page.is_home ? '' : `/${page.slug}`)" class="ws-card ws-card--hover block p-4 text-left">
              <p class="font-semibold">{{ page.title }}</p>
              <p v-if="page.excerpt" class="sf-muted text-sm mt-1 ws-line-clamp-2">{{ page.excerpt }}</p>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section v-if="posts.length && site?.blog_enabled" class="mt-10">
        <p class="sf-eyebrow mb-3">Publicaciones</p>
        <div class="space-y-6">
          <WebsitePostCard v-for="post in posts" :key="post.id" :post="post" variant="row" />
        </div>
      </section>

      <div v-if="!posts.length && !pages.length" class="ws-card p-12 text-center sf-muted mt-8">
        No encontramos resultados. Intenta con otras palabras.
      </div>
    </template>
  </div>
</template>
