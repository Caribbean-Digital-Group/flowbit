<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyWebsiteGalleryForm, type WebsiteGalleryFormData } from '~/components/WebsiteGallery/Form.vue'
import type { WebsiteGalleryItemRow, WebsiteMediaRow } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getById, update, archive, getItems, addItem, updateItem, removeItem, reorderItems, lastError } = useWebsiteGallery()
const { upload, lastError: mediaError } = useWebsiteMedia()

const galleryId = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id ?? ''))
const isEditing = ref(false)
const isLoading = ref(false)
const isUploading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<WebsiteGalleryFormData>(createEmptyWebsiteGalleryForm())
const items = ref<WebsiteGalleryItemRow[]>([])
const pickerOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const gallerySlug = ref('')
let snapshot = createEmptyWebsiteGalleryForm()

const previewPath = computed(() => (selectedCompany.value?.slug && gallerySlug.value ? `${websitePath(selectedCompany.value.slug, `/galeria/${gallerySlug.value}`)}?preview=1` : null))

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !galleryId.value) return
  isLoading.value = true
  try {
    const [row, list] = await Promise.all([getById(galleryId.value, cid), getItems(galleryId.value, cid)])
    if (!row) { errorMessage.value = 'Galería no encontrada.'; return }
    gallerySlug.value = row.slug ?? ''
    const mapped: WebsiteGalleryFormData = { name: row.name, slug: row.slug ?? '', description: row.description ?? '', cover_url: row.cover_url ?? '', layout: row.layout, status: row.status, display_order: row.display_order }
    formData.value = mapped
    snapshot = { ...mapped }
    items.value = list
  } finally {
    isLoading.value = false
  }
}

watch([galleryId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  errorMessage.value = null
  isLoading.value = true
  try {
    const f = formData.value
    const result = await update(galleryId.value, cid, { name: f.name.trim(), slug: f.slug.trim() || null, description: f.description.trim() || null, cover_url: f.cover_url.trim() || null, layout: f.layout, status: f.status, display_order: f.display_order })
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo guardar.'; return }
    gallerySlug.value = result.slug ?? ''
    snapshot = { ...formData.value }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const addFromMedia = async (payload: { url: string; alt: string; media: WebsiteMediaRow | null }) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const created = await addItem({ company_id: cid, gallery_id: galleryId.value, media_id: payload.media?.id ?? null, image_url: payload.url, alt_text: payload.alt || null, display_order: (items.value.length + 1) * 10 })
  if (!created) { errorMessage.value = lastError.value; return }
  items.value = await getItems(galleryId.value, cid)
}

const handleFiles = async (files: FileList | null) => {
  const cid = selectedCompanyId.value
  if (!cid || !files?.length) return
  isUploading.value = true
  errorMessage.value = null
  try {
    for (const file of Array.from(files)) {
      const media = await upload(cid, file, 'galerias')
      if (!media) { errorMessage.value = mediaError.value; break }
      await addItem({ company_id: cid, gallery_id: galleryId.value, media_id: media.id, image_url: media.public_url, alt_text: media.alt_text, display_order: (items.value.length + 1) * 10 })
      items.value = await getItems(galleryId.value, cid)
    }
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const saveCaption = async (item: WebsiteGalleryItemRow, caption: string) => {
  if (!selectedCompanyId.value) return
  await updateItem(item.id, selectedCompanyId.value, { caption: caption.trim() || null })
}

const remove = async (item: WebsiteGalleryItemRow) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  if (await removeItem(item.id, cid)) items.value = await getItems(galleryId.value, cid)
}

const move = async (index: number, delta: number) => {
  const cid = selectedCompanyId.value
  const target = index + delta
  if (!cid || target < 0 || target >= items.value.length) return
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved as WebsiteGalleryItemRow)
  items.value = next
  await reorderItems(cid, next.map(i => i.id))
}

const menuOptions = computed<MenuOption[]>(() => [
  { id: 'archive', label: 'Archivar', variant: 'danger', action: async () => { if (selectedCompanyId.value && await archive(galleryId.value, selectedCompanyId.value)) router.push('/admin/website/galleries') } }
])
</script>

<template>
  <div class="space-y-4">
    <CardSheet :title="formData.name || 'Galería'" :subtitle="`${items.length} ${items.length === 1 ? 'foto' : 'fotos'}`" :is-editing="isEditing" :is-loading="isLoading" :menu-options="menuOptions" @back="router.push('/admin/website/galleries')" @edit="isEditing = true" @save="handleSave" @cancel="formData = { ...snapshot }; isEditing = false">
      <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
      <WebsiteGalleryForm v-if="selectedCompanyId" v-model="formData" :company-id="selectedCompanyId" :readonly="!isEditing" />
      <NuxtLink v-if="previewPath" :to="previewPath" target="_blank" class="inline-block mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Vista previa de la galería →</NuxtLink>
    </CardSheet>

    <section v-if="selectedCompanyId" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 class="text-base font-bold text-slate-800">Fotos</h2>
        <div class="flex items-center gap-2">
          <BtnApp label="Elegir de la biblioteca" variant="secondary" size="sm" @click="pickerOpen = true" />
          <label class="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold cursor-pointer hover:bg-indigo-700">
            {{ isUploading ? 'Subiendo…' : 'Subir fotos' }}
            <input ref="fileInput" type="file" class="hidden" accept="image/*" multiple :disabled="isUploading" @change="handleFiles(($event.target as HTMLInputElement).files)" />
          </label>
        </div>
      </div>
      <div v-if="items.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" @dragover.prevent @drop.prevent="handleFiles($event.dataTransfer?.files ?? null)">
        <div v-for="(item, index) in items" :key="item.id" class="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
          <div class="aspect-[4/3] overflow-hidden"><img :src="item.image_url" :alt="item.alt_text ?? ''" class="w-full h-full object-cover" loading="lazy" /></div>
          <div class="p-2 space-y-2">
            <input :value="item.caption ?? ''" type="text" placeholder="Pie de foto" class="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5" @change="saveCaption(item, ($event.target as HTMLInputElement).value)" />
            <div class="flex items-center justify-between">
              <div class="flex gap-1">
                <button type="button" class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === 0" aria-label="Mover antes" @click="move(index, -1)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
                <button type="button" class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === items.length - 1" aria-label="Mover después" @click="move(index, 1)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></button>
              </div>
              <button type="button" class="text-xs font-semibold text-red-500 hover:text-red-700" @click="remove(item)">Quitar</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-400" @dragover.prevent @drop.prevent="handleFiles($event.dataTransfer?.files ?? null)">
        Arrastra fotos aquí, súbelas o elígelas de la biblioteca.
      </div>
      <WebsiteMediaPicker v-model:open="pickerOpen" :company-id="selectedCompanyId" folder="galerias" @select="addFromMedia" />
    </section>
  </div>
</template>
