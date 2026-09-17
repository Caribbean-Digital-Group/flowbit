<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsitePostCard, WebsitePostFilters, WebsiteCategoryInfo, WebsiteTagInfo } from '~/composables/useWebsite'

/**
 * Listado paginado de posts con barra lateral de categorías y etiquetas.
 * Lo comparten la portada del blog, categorías, etiquetas y autores.
 */
interface Props {
  filters: WebsitePostFilters
  showFeatured?: boolean
  emptyMessage?: string
}

const props = withDefaults(defineProps<Props>(), { showFeatured: false, emptyMessage: 'Aún no hay publicaciones.' })

const route = useRoute()
const router = useRouter()
const websiteStore = useWebsiteStore()
const { slug, site, preview } = storeToRefs(websiteStore)
const { getPosts, getTaxonomy } = useWebsite()
const nav = useWebsiteNav()

const posts = ref<WebsitePostCard[]>([])
const total = ref(0)
const pageSize = ref(9)
const isLoading = ref(true)
const categories = ref<WebsiteCategoryInfo[]>([])
const tags = ref<WebsiteTagInfo[]>([])

const page = computed(() => Math.max(1, Number(route.query.pagina ?? 1) || 1))

const load = async () => {
  if (!slug.value) return
  isLoading.value = true
  const result = await getPosts(slug.value, { ...props.filters, page: page.value }, preview.value)
  posts.value = result?.posts ?? []
  total.value = result?.total ?? 0
  pageSize.value = result?.pageSize ?? 9
  isLoading.value = false
}

const loadTaxonomy = async () => {
  if (!slug.value) return
  const result = await getTaxonomy(slug.value, preview.value)
  categories.value = (result?.categories ?? []).filter(c => (c.post_count ?? 0) > 0)
  tags.value = (result?.tags ?? []).slice(0, 30)
}

watch([slug, page, () => JSON.stringify(props.filters), preview], load, { immediate: true })
watch([slug, preview], loadTaxonomy, { immediate: true })

const featured = computed(() => (props.showFeatured && page.value === 1 ? posts.value.find(p => p.is_pinned || p.is_featured) ?? null : null))
const rest = computed(() => (featured.value ? posts.value.filter(p => p.id !== featured.value?.id) : posts.value))

const changePage = (p: number) => {
  router.push({ path: route.path, query: { ...route.query, pagina: p > 1 ? String(p) : undefined } })
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}

const searchTerm = ref('')
const submitSearch = () => {
  const term = searchTerm.value.trim()
  if (!term || !slug.value) return
  router.push({ path: websitePath(slug.value, '/buscar'), query: { q: term, ...(preview.value ? { preview: '1' } : {}) } })
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
    <div class="grid lg:grid-cols-12 gap-10">
      <div class="lg:col-span-8 xl:col-span-9">
        <div v-if="isLoading" class="flex items-center justify-center py-24">
          <div class="w-9 h-9 rounded-full border-4 animate-spin" :style="{ borderColor: 'var(--sf-border)', borderTopColor: 'var(--sf-primary)' }" />
        </div>
        <template v-else>
          <WebsitePostCard v-if="featured" :post="featured" variant="featured" class="mb-8" />
          <div v-if="rest.length" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <WebsitePostCard v-for="post in rest" :key="post.id" :post="post" />
          </div>
          <div v-else-if="!featured" class="ws-card p-12 text-center sf-muted">{{ emptyMessage }}</div>
          <WebsitePagination :page="page" :total="total" :page-size="pageSize" class="mt-12" @change="changePage" />
        </template>
      </div>

      <aside class="lg:col-span-4 xl:col-span-3 space-y-8">
        <form class="flex gap-2" @submit.prevent="submitSearch">
          <input v-model="searchTerm" type="search" class="sf-input" placeholder="Buscar publicaciones…" />
          <button type="submit" class="sf-btn sf-btn--primary sf-btn--sm" aria-label="Buscar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.3-4.3M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
          </button>
        </form>

        <div v-if="categories.length">
          <p class="sf-eyebrow mb-3">Categorías</p>
          <ul class="space-y-1">
            <li v-for="category in categories" :key="category.id">
              <NuxtLink
                :to="nav.to(`/blog/categoria/${category.slug}`)"
                :class="['flex items-center justify-between px-3 py-2 rounded-md text-sm sf-hover-muted transition-colors', filters.category === category.slug ? 'sf-text-strong font-semibold' : 'sf-muted']"
              >
                <span class="flex items-center gap-2">
                  <span v-if="category.color" class="w-2 h-2 rounded-full" :style="{ backgroundColor: category.color }" />
                  {{ category.name }}
                </span>
                <span class="sf-subtle text-xs">{{ category.post_count }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div v-if="tags.length">
          <p class="sf-eyebrow mb-3">Etiquetas</p>
          <div class="flex flex-wrap gap-2">
            <NuxtLink v-for="tag in tags" :key="tag.id" :to="nav.to(`/blog/etiqueta/${tag.slug}`)" :class="['ws-chip', filters.tag === tag.slug ? 'ring-2 ring-offset-1' : '']">#{{ tag.name }}</NuxtLink>
          </div>
        </div>

        <div v-if="site?.blog_enabled" class="ws-card p-5">
          <p class="font-semibold text-sm">Suscríbete por RSS</p>
          <p class="sf-muted text-xs mt-1">Recibe las nuevas publicaciones en tu lector favorito.</p>
          <a :href="`${websiteStore.basePath}/blog/rss.xml`" class="sf-link text-xs mt-3 inline-block" target="_blank" rel="noopener">Abrir feed RSS</a>
        </div>
      </aside>
    </div>
  </div>
</template>
