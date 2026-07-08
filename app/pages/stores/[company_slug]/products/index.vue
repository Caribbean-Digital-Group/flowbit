<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StorefrontProductCard, StorefrontProductFilters } from '~/composables/useStorefront'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const router = useRouter()
const storefrontStore = useStorefrontStore()
const { store, categories, primaryColor } = storeToRefs(storefrontStore)
const { getProducts } = useStorefront()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const products = ref<StorefrontProductCard[]>([])
const total = ref(0)
const isLoading = ref(false)
const showFilters = ref(false)

const PAGE_SIZE = 12

// Filtros locales (se sincronizan con la URL para que sea compartible)
const search = ref('')
const categoryId = ref<string | null>(null)
const minPrice = ref<string>('')
const maxPrice = ref<string>('')
const onlyInStock = ref(false)
const sort = ref<NonNullable<StorefrontProductFilters['sort']>>('relevance')
const page = ref(1)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const tracker = useStorefrontTracker()
/** Evita re-emitir search al paginar u ordenar los mismos resultados */
const lastTrackedSearch = ref<string | null>(null)

const sortOptions = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'best_sellers', label: 'Más vendidos' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' }
]

const readQuery = () => {
  const q = route.query
  search.value = typeof q.search === 'string' ? q.search : ''
  categoryId.value = typeof q.category === 'string' && q.category ? q.category : null
  minPrice.value = typeof q.min === 'string' ? q.min : ''
  maxPrice.value = typeof q.max === 'string' ? q.max : ''
  onlyInStock.value = q.stock === '1'
  sort.value = (typeof q.sort === 'string' ? q.sort : 'relevance') as typeof sort.value
  page.value = Math.max(1, Number(q.page) || 1)
}

const writeQuery = () => {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.search = search.value.trim()
  if (categoryId.value) query.category = categoryId.value
  if (minPrice.value) query.min = minPrice.value
  if (maxPrice.value) query.max = maxPrice.value
  if (onlyInStock.value) query.stock = '1'
  if (sort.value !== 'relevance') query.sort = sort.value
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
}

const load = async () => {
  if (!companySlug.value) return
  isLoading.value = true
  try {
    const result = await getProducts(companySlug.value, {
      search: search.value,
      categoryId: categoryId.value,
      minPrice: minPrice.value ? Number(minPrice.value) : null,
      maxPrice: maxPrice.value ? Number(maxPrice.value) : null,
      onlyInStock: onlyInStock.value,
      sort: sort.value,
      page: page.value,
      pageSize: PAGE_SIZE
    })
    products.value = result?.products ?? []
    total.value = result?.total ?? 0

    const term = search.value.trim()
    if (term && term.toLowerCase() !== lastTrackedSearch.value) {
      lastTrackedSearch.value = term.toLowerCase()
      tracker.trackEvent('search', { term, results: total.value })
    }
    if (products.value.length) {
      tracker.trackEcommerce('view_item_list', {
        currency: store.value?.currency,
        items: products.value.map((p) => analyticsItemFromProduct(p)),
        properties: { list: term ? 'search_results' : 'catalog', page: page.value }
      })
    }
  } finally {
    isLoading.value = false
  }
}

watch(
  () => route.query,
  () => {
    readQuery()
    void load()
  },
  { immediate: true }
)

const applyFilters = () => {
  page.value = 1
  showFilters.value = false
  writeQuery()
}

const clearFilters = () => {
  search.value = ''
  categoryId.value = null
  minPrice.value = ''
  maxPrice.value = ''
  onlyInStock.value = false
  sort.value = 'relevance'
  page.value = 1
  writeQuery()
}

const goToPage = (target: number) => {
  page.value = Math.min(Math.max(1, target), totalPages.value)
  writeQuery()
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}

const hasActiveFilters = computed(
  () =>
    !!search.value.trim() ||
    !!categoryId.value ||
    !!minPrice.value ||
    !!maxPrice.value ||
    onlyInStock.value
)

const selectedCategoryName = computed(
  () => categories.value.find((category) => category.id === categoryId.value)?.name ?? null
)

useHead(() => ({
  title: store.value ? `Productos — ${store.value.name}` : 'Productos',
  meta: [
    {
      name: 'description',
      content: `Catálogo de productos de ${store.value?.name ?? 'la tienda'}. Encuentra lo que buscas y compra en línea.`
    }
  ]
}))
</script>

<template>
  <div v-if="store" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <!-- Encabezado -->
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">
        {{ selectedCategoryName ?? 'Todos los productos' }}
      </h1>
      <p class="mt-1 text-sm text-slate-500">
        <template v-if="isLoading">Buscando productos…</template>
        <template v-else>{{ total }} producto{{ total === 1 ? '' : 's' }} encontrado{{ total === 1 ? '' : 's' }}</template>
      </p>
    </div>

    <div class="flex flex-col lg:flex-row gap-8">
      <!-- Filtros -->
      <aside class="lg:w-64 flex-shrink-0">
        <button
          type="button"
          class="lg:hidden w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl shadow-lg shadow-slate-200/50 text-sm font-semibold text-slate-800 mb-4"
          :aria-expanded="showFilters"
          @click="showFilters = !showFilters"
        >
          Filtros
          <svg class="w-4 h-4 text-slate-400 transition-transform" :class="{ 'rotate-180': showFilters }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-5 space-y-6"
          :class="{ 'hidden lg:block': !showFilters }"
        >
          <!-- Búsqueda -->
          <div>
            <label for="sf-search" class="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Buscar
            </label>
            <input
              id="sf-search"
              v-model="search"
              type="search"
              placeholder="Nombre o descripción..."
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              @keyup.enter="applyFilters"
            />
          </div>

          <!-- Categorías -->
          <div v-if="categories.length">
            <p class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Categoría</p>
            <div class="space-y-1">
              <button
                type="button"
                class="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors"
                :class="!categoryId ? 'font-semibold text-slate-900 bg-slate-100' : 'text-slate-600 hover:bg-slate-50'"
                @click="categoryId = null; applyFilters()"
              >
                Todas
              </button>
              <button
                v-for="category in categories"
                :key="category.id"
                type="button"
                class="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between"
                :class="categoryId === category.id ? 'font-semibold text-slate-900 bg-slate-100' : 'text-slate-600 hover:bg-slate-50'"
                @click="categoryId = category.id; applyFilters()"
              >
                <span>{{ category.name }}</span>
                <span class="text-xs text-slate-400">{{ category.product_count }}</span>
              </button>
            </div>
          </div>

          <!-- Precio -->
          <div>
            <p class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Precio</p>
            <div class="flex items-center gap-2">
              <input
                v-model="minPrice"
                type="number"
                min="0"
                placeholder="Mín"
                aria-label="Precio mínimo"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              <span class="text-slate-400 text-sm">—</span>
              <input
                v-model="maxPrice"
                type="number"
                min="0"
                placeholder="Máx"
                aria-label="Precio máximo"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
          </div>

          <!-- Disponibilidad -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <input
              v-model="onlyInStock"
              type="checkbox"
              class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              @change="applyFilters"
            />
            <span class="text-sm text-slate-700">Solo disponibles</span>
          </label>

          <div class="flex flex-col gap-2 pt-2">
            <button
              type="button"
              class="w-full px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              :style="{ backgroundColor: primaryColor }"
              @click="applyFilters"
            >
              Aplicar filtros
            </button>
            <button
              v-if="hasActiveFilters"
              type="button"
              class="w-full px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              @click="clearFilters"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </aside>

      <!-- Resultados -->
      <div class="flex-1 min-w-0">
        <!-- Ordenamiento -->
        <div class="flex items-center justify-end mb-5">
          <label for="sf-sort" class="text-sm text-slate-500 mr-2">Ordenar por</label>
          <select
            id="sf-sort"
            v-model="sort"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            @change="applyFilters"
          >
            <option v-for="option in sortOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Skeleton -->
        <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          <div
            v-for="n in 8"
            :key="n"
            class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden animate-pulse"
          >
            <div class="aspect-square bg-slate-100" />
            <div class="p-4 space-y-2">
              <div class="h-3.5 bg-slate-100 rounded w-3/4" />
              <div class="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        </div>

        <!-- Grid -->
        <div
          v-else-if="products.length"
          class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
        >
          <StorefrontProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            :company-slug="companySlug"
          />
        </div>

        <!-- Vacío -->
        <div v-else class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 py-20 text-center">
          <svg class="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
          </svg>
          <p class="text-slate-600 font-medium">No encontramos productos</p>
          <p class="text-sm text-slate-400 mt-1">Prueba con otros términos o quita algún filtro.</p>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="mt-4 text-sm font-semibold transition-opacity hover:opacity-75"
            :style="{ color: primaryColor }"
            @click="clearFilters"
          >
            Limpiar filtros
          </button>
        </div>

        <!-- Paginación -->
        <nav
          v-if="!isLoading && totalPages > 1"
          class="mt-10 flex items-center justify-center gap-2"
          aria-label="Paginación del catálogo"
        >
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-white shadow-lg shadow-slate-200/50 text-sm font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-900 transition-colors"
            :disabled="page <= 1"
            @click="goToPage(page - 1)"
          >
            ← Anterior
          </button>
          <span class="px-4 text-sm text-slate-500">
            Página {{ page }} de {{ totalPages }}
          </span>
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-white shadow-lg shadow-slate-200/50 text-sm font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-900 transition-colors"
            :disabled="page >= totalPages"
            @click="goToPage(page + 1)"
          >
            Siguiente →
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>
