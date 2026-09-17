<script setup lang="ts">
import type { WebsiteMenuItemRow, WebsiteMenuLinkType } from '~/types/website.types'

/**
 * Editor de un menú (árbol de dos niveles): agregar, editar, reordenar y anidar.
 * Los cambios se guardan de inmediato vía useWebsiteMenu.
 */
type Option = { value: string; label: string }

interface Props {
  menuId: string
  companyId: string
  items: WebsiteMenuItemRow[]
  pages: Option[]
  posts: Option[]
  categories: Option[]
  galleries: Option[]
  storefrontActive: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ changed: [] }>()

const { createItem, updateItem, removeItem, reorder, lastError } = useWebsiteMenu()

const roots = computed(() => props.items.filter(i => !i.parent_id).sort((a, b) => a.display_order - b.display_order))
const childrenOf = (id: string) => props.items.filter(i => i.parent_id === id).sort((a, b) => a.display_order - b.display_order)

const LINK_TYPES: { value: WebsiteMenuLinkType; label: string }[] = [
  { value: 'page', label: 'Página' },
  { value: 'home', label: 'Inicio' },
  { value: 'blog', label: 'Blog' },
  { value: 'category', label: 'Categoría del blog' },
  { value: 'post', label: 'Publicación' },
  { value: 'galleries', label: 'Galerías' },
  { value: 'gallery', label: 'Una galería' },
  { value: 'storefront', label: 'Tienda en línea' },
  { value: 'url', label: 'URL externa' }
]

const editing = ref<WebsiteMenuItemRow | null>(null)
const isNew = ref(false)
const draft = reactive({
  label: '',
  link_type: 'page' as WebsiteMenuLinkType,
  page_id: null as string | null,
  post_id: null as string | null,
  category_id: null as string | null,
  gallery_id: null as string | null,
  url: '',
  open_in_new_tab: false,
  is_visible: true,
  parent_id: null as string | null
})
const errorMessage = ref<string | null>(null)
const isSaving = ref(false)

const openNew = (parentId: string | null = null) => {
  isNew.value = true
  editing.value = null
  Object.assign(draft, { label: '', link_type: 'page', page_id: null, post_id: null, category_id: null, gallery_id: null, url: '', open_in_new_tab: false, is_visible: true, parent_id: parentId })
  errorMessage.value = null
}

const openEdit = (item: WebsiteMenuItemRow) => {
  isNew.value = false
  editing.value = item
  Object.assign(draft, {
    label: item.label,
    link_type: item.link_type,
    page_id: item.page_id,
    post_id: item.post_id,
    category_id: item.category_id,
    gallery_id: item.gallery_id,
    url: item.url ?? '',
    open_in_new_tab: item.open_in_new_tab,
    is_visible: item.is_visible,
    parent_id: item.parent_id
  })
  errorMessage.value = null
}

const closeDialog = () => {
  editing.value = null
  isNew.value = false
}

const dialogOpen = computed(() => isNew.value || editing.value !== null)

const save = async () => {
  if (!draft.label.trim()) {
    errorMessage.value = 'Escribe el texto del enlace.'
    return
  }
  if (draft.link_type === 'url' && !/^(https?:\/\/|mailto:|tel:|\/)/i.test(draft.url.trim())) {
    errorMessage.value = 'Escribe una URL válida.'
    return
  }
  isSaving.value = true
  errorMessage.value = null
  const payload = {
    label: draft.label.trim(),
    link_type: draft.link_type,
    page_id: draft.link_type === 'page' ? draft.page_id : null,
    post_id: draft.link_type === 'post' ? draft.post_id : null,
    category_id: draft.link_type === 'category' ? draft.category_id : null,
    gallery_id: draft.link_type === 'gallery' ? draft.gallery_id : null,
    url: draft.link_type === 'url' ? draft.url.trim() : null,
    open_in_new_tab: draft.open_in_new_tab,
    is_visible: draft.is_visible,
    parent_id: draft.parent_id
  }
  try {
    const ok = isNew.value
      ? await createItem({ ...payload, company_id: props.companyId, menu_id: props.menuId, display_order: (props.items.length + 1) * 10 })
      : editing.value ? await updateItem(editing.value.id, props.companyId, payload) : null
    if (!ok) {
      errorMessage.value = lastError.value ?? 'No se pudo guardar.'
      return
    }
    closeDialog()
    emit('changed')
  } finally {
    isSaving.value = false
  }
}

const remove = async (item: WebsiteMenuItemRow) => {
  if (await removeItem(item.id, props.companyId)) emit('changed')
}

const move = async (list: WebsiteMenuItemRow[], index: number, delta: number) => {
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const next = [...list]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved as WebsiteMenuItemRow)
  const ok = await reorder(props.companyId, next.map((item, i) => ({ id: item.id, display_order: (i + 1) * 10, parent_id: item.parent_id })))
  if (ok) emit('changed')
}

const targetLabel = (item: WebsiteMenuItemRow): string => {
  switch (item.link_type) {
    case 'page': return props.pages.find(p => p.value === item.page_id)?.label ?? 'Página (sin definir)'
    case 'post': return props.posts.find(p => p.value === item.post_id)?.label ?? 'Publicación (sin definir)'
    case 'category': return props.categories.find(c => c.value === item.category_id)?.label ?? 'Categoría (sin definir)'
    case 'gallery': return props.galleries.find(g => g.value === item.gallery_id)?.label ?? 'Galería (sin definir)'
    case 'url': return item.url ?? ''
    default: return LINK_TYPES.find(t => t.value === item.link_type)?.label ?? item.link_type
  }
}

const parentOptions = computed(() => roots.value.filter(r => r.id !== editing.value?.id).map(r => ({ value: r.id, label: r.label })))
</script>

<template>
  <div>
    <ul class="space-y-2">
      <li v-for="(item, index) in roots" :key="item.id">
        <div :class="['flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3', item.is_visible ? '' : 'opacity-60']">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">{{ item.label }} <span v-if="!item.is_visible" class="text-xs font-normal text-slate-400">(oculto)</span></p>
            <p class="text-xs text-slate-500 truncate">{{ targetLabel(item) }}<span v-if="item.link_type === 'storefront' && !storefrontActive" class="text-amber-600"> · la tienda no está activa: no se mostrará</span></p>
          </div>
          <div class="flex items-center gap-0.5">
            <button type="button" class="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === 0" title="Subir" @click="move(roots, index, -1)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg></button>
            <button type="button" class="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === roots.length - 1" title="Bajar" @click="move(roots, index, 1)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></button>
            <button type="button" class="p-1.5 text-slate-400 hover:text-indigo-600" title="Agregar subelemento" @click="openNew(item.id)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg></button>
            <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2" @click="openEdit(item)">Editar</button>
            <button type="button" class="text-xs font-semibold text-red-500 hover:text-red-700 px-2" @click="remove(item)">Quitar</button>
          </div>
        </div>
        <ul v-if="childrenOf(item.id).length" class="ml-8 mt-2 space-y-2 border-l-2 border-slate-100 pl-4">
          <li v-for="(child, cIndex) in childrenOf(item.id)" :key="child.id" :class="['flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5', child.is_visible ? '' : 'opacity-60']">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">{{ child.label }}</p>
              <p class="text-xs text-slate-500 truncate">{{ targetLabel(child) }}</p>
            </div>
            <div class="flex items-center gap-0.5">
              <button type="button" class="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="cIndex === 0" title="Subir" @click="move(childrenOf(item.id), cIndex, -1)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg></button>
              <button type="button" class="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="cIndex === childrenOf(item.id).length - 1" title="Bajar" @click="move(childrenOf(item.id), cIndex, 1)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg></button>
              <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2" @click="openEdit(child)">Editar</button>
              <button type="button" class="text-xs font-semibold text-red-500 hover:text-red-700 px-2" @click="remove(child)">Quitar</button>
            </div>
          </li>
        </ul>
      </li>
    </ul>
    <p v-if="!roots.length" class="text-sm text-slate-400 py-6 text-center">Este menú está vacío.</p>
    <BtnApp label="Agregar elemento" variant="secondary" size="sm" class="mt-4" @click="openNew(null)" />

    <Teleport to="body">
      <div v-if="dialogOpen" class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" @click.self="closeDialog">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
          <h3 class="text-lg font-bold text-slate-800">{{ isNew ? 'Nuevo elemento' : 'Editar elemento' }}</h3>
          <p v-if="errorMessage" class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{{ errorMessage }}</p>
          <FormInput v-model="draft.label" label="Texto del enlace" required size="md" />
          <FormSelect v-model="draft.link_type" label="Tipo de destino" :options="LINK_TYPES" :searchable="false" size="md" />
          <FormSelect v-if="draft.link_type === 'page'" v-model="draft.page_id" label="Página" :options="pages" size="md" />
          <FormSelect v-else-if="draft.link_type === 'post'" v-model="draft.post_id" label="Publicación" :options="posts" size="md" />
          <FormSelect v-else-if="draft.link_type === 'category'" v-model="draft.category_id" label="Categoría" :options="categories" size="md" />
          <FormSelect v-else-if="draft.link_type === 'gallery'" v-model="draft.gallery_id" label="Galería" :options="galleries" size="md" />
          <FormInput v-else-if="draft.link_type === 'url'" v-model="draft.url" label="URL" type="url" placeholder="https://…" size="md" />
          <FormSelect v-model="draft.parent_id" label="Dentro de" :options="parentOptions" placeholder="Nivel principal" clearable size="md" />
          <div class="grid grid-cols-2 gap-3">
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
              <input v-model="draft.open_in_new_tab" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
              <span class="text-sm text-slate-700">Abrir en nueva pestaña</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
              <input v-model="draft.is_visible" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
              <span class="text-sm text-slate-700">Visible</span>
            </label>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <BtnApp label="Cancelar" variant="ghost" size="md" @click="closeDialog" />
            <BtnApp label="Guardar" size="md" :loading="isSaving" @click="save" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
