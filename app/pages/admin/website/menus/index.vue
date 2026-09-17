<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteMenuRow, WebsiteMenuItemRow } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getMenus, getItems } = useWebsiteMenu()
const { getAllByCompany: getPages } = useWebsitePage()
const { getAllByCompany: getPosts } = useWebsitePost()
const { getAllByCompany: getCategories } = useWebsiteCategory()
const { getAllByCompany: getGalleries } = useWebsiteGallery()
const { getByCompany: getStorefrontSettings } = useStorefrontSettings()

const menus = ref<WebsiteMenuRow[]>([])
const items = ref<WebsiteMenuItemRow[]>([])
const activeMenuId = ref<string | null>(null)
const pages = ref<{ value: string; label: string }[]>([])
const posts = ref<{ value: string; label: string }[]>([])
const categories = ref<{ value: string; label: string }[]>([])
const galleries = ref<{ value: string; label: string }[]>([])
const storefrontActive = ref(false)
const isLoading = ref(false)

const MENU_LABEL: Record<string, string> = { main: 'Menú principal', footer: 'Pie de página' }

const loadItems = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  items.value = await getItems(cid)
}

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    const [m, p, po, c, g, s] = await Promise.all([getMenus(cid), getPages(cid), getPosts(cid), getCategories(cid), getGalleries(cid), getStorefrontSettings(cid)])
    menus.value = m
    activeMenuId.value = m.find(x => x.code === 'main')?.id ?? m[0]?.id ?? null
    pages.value = p.map(x => ({ value: x.id, label: x.is_home ? `${x.title} (inicio)` : x.title }))
    posts.value = po.filter(x => x.status !== 'archived').map(x => ({ value: x.id, label: x.title }))
    categories.value = c.map(x => ({ value: x.id, label: x.name }))
    galleries.value = g.map(x => ({ value: x.id, label: x.name }))
    storefrontActive.value = !!s?.is_active
    await loadItems()
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const activeItems = computed(() => items.value.filter(i => i.menu_id === activeMenuId.value))
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Menús de navegación</h1>
      <p class="text-slate-500 mt-1">Define los enlaces de la cabecera y del pie de página. Los enlaces a contenido no publicado se ocultan automáticamente.</p>
    </div>

    <div v-if="isLoading" class="py-16 text-center text-slate-400">Cargando…</div>
    <div v-else-if="!menus.length" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-10 text-center text-slate-500">
      Primero crea el sitio web desde <NuxtLink to="/admin/website" class="text-indigo-600 font-semibold">Sitio web</NuxtLink>.
    </div>
    <template v-else>
      <div class="flex gap-1 rounded-2xl bg-white shadow-lg shadow-slate-200/50 p-1.5 w-fit">
        <button v-for="menu in menus" :key="menu.id" type="button" :class="['px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors', activeMenuId === menu.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800']" @click="activeMenuId = menu.id">
          {{ MENU_LABEL[menu.code] ?? menu.name }}
        </button>
      </div>
      <div v-if="activeMenuId && selectedCompanyId" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <WebsiteMenuEditor
          :menu-id="activeMenuId"
          :company-id="selectedCompanyId"
          :items="activeItems"
          :pages="pages"
          :posts="posts"
          :categories="categories"
          :galleries="galleries"
          :storefront-active="storefrontActive"
          @changed="loadItems"
        />
      </div>
    </template>
  </div>
</template>
