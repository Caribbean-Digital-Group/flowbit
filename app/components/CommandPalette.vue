<script lang="ts">
/** Grupo de navegación tal como lo define el sidebar de `layouts/admin.vue`. */
export interface CommandNavGroup {
  id: string
  title?: string
  items: { title: string; to: string; iconPaths: string[] }[]
}
</script>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { filterByQuery, normalizeSearch } from '~/utils/search'

interface Props {
  /** Grupos del sidebar: la paleta usa la misma fuente que la navegación. */
  groups: CommandNavGroup[]
}

const props = withDefaults(defineProps<Props>(), {})

const isOpen = defineModel<boolean>('open', { default: false })

type Section = 'Acciones rápidas' | 'Ir a' | 'Contactos' | 'Productos'

interface CommandItem {
  id: string
  section: Section
  title: string
  subtitle?: string
  keywords?: string
  to: string
  iconPaths: string[]
}

const ICON_PLUS = ['M12 4v16m8-8H4']
const ICON_USER = ['M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z']
const ICON_BOX = ['M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4']
const SECTION_ORDER: Section[] = ['Acciones rápidas', 'Ir a', 'Contactos', 'Productos']

/** Acciones de creación más usadas. Solo rutas `create.vue` existentes. */
const QUICK_ACTIONS: CommandItem[] = [
  { title: 'Nuevo contacto', to: '/admin/partners/create', keywords: 'crear cliente proveedor partner' },
  { title: 'Nuevo producto', to: '/admin/products/create', keywords: 'crear servicio articulo inventario' },
  { title: 'Nueva orden', to: '/admin/orders/create', keywords: 'crear venta compra cotizacion pedido' },
  { title: 'Nuevo lead', to: '/admin/crm/leads/create', keywords: 'crear oportunidad crm prospecto' },
  { title: 'Nuevo proyecto', to: '/admin/projects/create', keywords: 'crear proyecto' },
  { title: 'Nuevo empleado', to: '/admin/employees/create', keywords: 'crear empleado rrhh personal' },
  { title: 'Nueva solicitud de aprobación', to: '/admin/approval-requests/create', keywords: 'crear aprobacion gasto permiso' }
].map(action => ({ ...action, id: `action:${action.to}`, section: 'Acciones rápidas' as const, iconPaths: ICON_PLUS }))

const navCommands = computed<CommandItem[]>(() =>
  props.groups.flatMap(group =>
    group.items.map(item => ({
      id: `nav:${item.to}`,
      section: 'Ir a' as const,
      title: item.title,
      subtitle: group.title,
      keywords: group.title,
      to: item.to,
      iconPaths: item.iconPaths
    }))
  )
)

// ─── Estado ──────────────────────────────────────────────────────────────────
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

// ─── Búsqueda de registros (contactos y productos de la empresa) ─────────────
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { searchPartnersByCompany } = usePartner()
const { searchProductsByCompany } = useProduct()

const recordResults = ref<CommandItem[]>([])
const isSearchingRecords = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

const searchRecords = async (term: string) => {
  const companyId = selectedCompanyId.value
  const seq = ++searchSeq
  if (!companyId || normalizeSearch(term).length < 2) {
    recordResults.value = []
    isSearchingRecords.value = false
    return
  }
  isSearchingRecords.value = true
  try {
    const [partners, products] = await Promise.all([
      searchPartnersByCompany(companyId, term, 5),
      searchProductsByCompany(companyId, term, 5)
    ])
    if (seq !== searchSeq) return
    recordResults.value = [
      ...partners.map(p => ({
        id: `partner:${p.id}`,
        section: 'Contactos' as const,
        title: p.display_name || p.name,
        subtitle: p.email ?? undefined,
        to: `/admin/partners/${p.id}`,
        iconPaths: ICON_USER
      })),
      ...products.map(p => ({
        id: `product:${p.id}`,
        section: 'Productos' as const,
        title: p.name,
        subtitle: p.sku ?? undefined,
        to: `/admin/products/${p.id}`,
        iconPaths: ICON_BOX
      }))
    ]
  } finally {
    if (seq === searchSeq) isSearchingRecords.value = false
  }
}

watch(query, (term) => {
  activeIndex.value = 0
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void searchRecords(term) }, 250)
})

// ─── Resultados ──────────────────────────────────────────────────────────────
const results = computed<CommandItem[]>(() => {
  const hasQuery = normalizeSearch(query.value).length > 0
  const actions = filterByQuery(QUICK_ACTIONS, query.value, hasQuery ? 4 : QUICK_ACTIONS.length)
  const navs = filterByQuery(navCommands.value, query.value, hasQuery ? 8 : 0)
  return [...actions, ...navs, ...(hasQuery ? recordResults.value : [])]
})

const sections = computed(() =>
  SECTION_ORDER
    .map(section => ({
      section,
      items: results.value
        .map((item, index) => ({ item, index }))
        .filter(entry => entry.item.section === section)
    }))
    .filter(group => group.items.length > 0)
)

// ─── Acciones ────────────────────────────────────────────────────────────────
const close = () => {
  isOpen.value = false
}

const select = async (item: CommandItem | undefined) => {
  if (!item) return
  close()
  await navigateTo(item.to)
}

const moveActive = (delta: number) => {
  const total = results.value.length
  if (total === 0) return
  activeIndex.value = (activeIndex.value + delta + total) % total
  nextTick(() => {
    listRef.value
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

const onInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1) }
  else if (event.key === 'Enter') { event.preventDefault(); void select(results.value[activeIndex.value]) }
  else if (event.key === 'Escape') { event.preventDefault(); close() }
}

/** Atajo global Ctrl+K / ⌘K. */
const onGlobalKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    isOpen.value = !isOpen.value
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})

watch(isOpen, (open) => {
  if (open) {
    query.value = ''
    recordResults.value = []
    activeIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-[10vh] backdrop-blur-sm"
        @mousedown.self="close"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Búsqueda global"
          class="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200"
        >
          <!-- Caja de búsqueda -->
          <div class="flex items-center gap-3 border-b border-slate-100 px-4">
            <svg class="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              :aria-activedescendant="results[activeIndex] ? `command-${activeIndex}` : undefined"
              placeholder="Busca módulos, acciones, contactos o productos…"
              class="h-14 w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
              autocomplete="off"
              spellcheck="false"
              @keydown="onInputKeydown"
            >
            <svg
              v-if="isSearchingRecords"
              class="h-4 w-4 shrink-0 animate-spin text-violet-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <kbd class="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-400 sm:block">Esc</kbd>
          </div>

          <!-- Resultados -->
          <div
            id="command-palette-list"
            ref="listRef"
            role="listbox"
            class="max-h-[60vh] overflow-y-auto py-2"
          >
            <div v-for="group in sections" :key="group.section" class="px-2 pb-1">
              <p class="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {{ group.section }}
              </p>
              <button
                v-for="{ item, index } in group.items"
                :id="`command-${index}`"
                :key="item.id"
                type="button"
                role="option"
                :aria-selected="index === activeIndex"
                :data-index="index"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                :class="index === activeIndex ? 'bg-violet-50 text-violet-700' : 'text-slate-700 hover:bg-slate-50'"
                @mousemove="activeIndex = index"
                @click="select(item)"
              >
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  :class="index === activeIndex ? 'bg-white text-violet-600' : 'bg-slate-100 text-slate-500'"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      v-for="(d, i) in item.iconPaths"
                      :key="i"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      :d="d"
                    />
                  </svg>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ item.title }}</span>
                  <span v-if="item.subtitle" class="block truncate text-xs text-slate-500">{{ item.subtitle }}</span>
                </span>
                <svg
                  v-if="index === activeIndex"
                  class="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>

            <p v-if="results.length === 0 && !isSearchingRecords" class="px-6 py-10 text-center text-sm text-slate-500">
              Sin resultados para «{{ query }}».
            </p>
          </div>

          <!-- Pie con atajos -->
          <div class="hidden items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 sm:flex">
            <span><kbd class="font-sans">↑ ↓</kbd> navegar</span>
            <span><kbd class="font-sans">Enter</kbd> abrir</span>
            <span><kbd class="font-sans">Ctrl K</kbd> abrir o cerrar</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
