<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteMediaRow } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { list, upload, update, remove, folders, lastError } = useWebsiteMedia()

const items = ref<WebsiteMediaRow[]>([])
const folderList = ref<string[]>([])
const folder = ref<string | null>(null)
const search = ref('')
const isLoading = ref(false)
const isUploading = ref(false)
const errorMessage = ref<string | null>(null)
const selected = ref<WebsiteMediaRow | null>(null)
const editAlt = ref('')
const editTitle = ref('')
const editFolder = ref('')
const uploadFolder = ref('general')
const fileInput = ref<HTMLInputElement | null>(null)

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    ;[items.value, folderList.value] = await Promise.all([list(cid, { folder: folder.value, search: search.value, imagesOnly: false }), folders(cid)])
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, folder], load, { immediate: true })
let timer: ReturnType<typeof setTimeout> | null = null
watch(search, () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void load(), 300) })

const handleFiles = async (files: FileList | null) => {
  const cid = selectedCompanyId.value
  if (!cid || !files?.length) return
  errorMessage.value = null
  isUploading.value = true
  try {
    for (const file of Array.from(files)) {
      const media = await upload(cid, file, uploadFolder.value.trim() || 'general')
      if (!media) { errorMessage.value = lastError.value; break }
    }
    await load()
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const openDetail = (media: WebsiteMediaRow) => {
  selected.value = media
  editAlt.value = media.alt_text ?? ''
  editTitle.value = media.title ?? ''
  editFolder.value = media.folder
}

const saveDetail = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !selected.value) return
  const updated = await update(selected.value.id, cid, { alt_text: editAlt.value.trim() || null, title: editTitle.value.trim() || null, folder: editFolder.value.trim() || 'general' })
  if (!updated) { errorMessage.value = lastError.value; return }
  selected.value = null
  await load()
}

const deleteSelected = async () => {
  if (!selected.value) return
  if (!window.confirm('Se eliminará el archivo del almacenamiento. Las páginas que lo usen mostrarán una imagen rota. ¿Continuar?')) return
  if (await remove(selected.value)) { selected.value = null; await load() } else errorMessage.value = lastError.value
}

const copyUrl = async (url: string) => {
  try { await navigator.clipboard.writeText(url) } catch { errorMessage.value = 'No se pudo copiar.' }
}

const totalBytes = computed(() => items.value.reduce((sum, m) => sum + (m.size_bytes ?? 0), 0))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Biblioteca de medios</h1>
        <p class="text-slate-500 mt-1">Imágenes, videos y PDF del sitio. {{ items.length }} archivos · {{ formatBytes(totalBytes) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <FormInput v-model="uploadFolder" placeholder="Carpeta" size="sm" class="w-36" />
        <label class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold cursor-pointer shadow-lg shadow-indigo-500/25">
          {{ isUploading ? 'Subiendo…' : 'Subir archivos' }}
          <input ref="fileInput" type="file" class="hidden" :accept="WEBSITE_MEDIA_ACCEPT" multiple :disabled="isUploading" @change="handleFiles(($event.target as HTMLInputElement).files)" />
        </label>
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>

    <div class="flex flex-col sm:flex-row gap-3">
      <FormInput v-model="search" type="search" placeholder="Buscar por nombre, título o texto alternativo…" size="sm" class="flex-1" />
      <div class="flex gap-1 overflow-x-auto">
        <button type="button" :class="['px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap', folder === null ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-500 hover:text-slate-800']" @click="folder = null">Todas</button>
        <button v-for="f in folderList" :key="f" type="button" :class="['px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap', folder === f ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-500 hover:text-slate-800']" @click="folder = f">{{ f }}</button>
      </div>
    </div>

    <div v-if="isLoading" class="py-16 text-center text-slate-400">Cargando…</div>
    <div v-else-if="!items.length" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-12 text-center text-slate-400" @dragover.prevent @drop.prevent="handleFiles($event.dataTransfer?.files ?? null)">
      No hay archivos. Arrastra aquí o usa «Subir archivos».
    </div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4" @dragover.prevent @drop.prevent="handleFiles($event.dataTransfer?.files ?? null)">
      <button v-for="media in items" :key="media.id" type="button" class="group bg-white rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden text-left hover:ring-2 hover:ring-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" @click="openDetail(media)">
        <div class="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
          <img v-if="media.mime_type?.startsWith('image/')" :src="media.public_url" :alt="media.alt_text ?? ''" class="w-full h-full object-cover" loading="lazy" />
          <span v-else class="text-xs font-semibold text-slate-500 uppercase">{{ media.mime_type?.split('/')[1] ?? 'archivo' }}</span>
        </div>
        <div class="p-3">
          <p class="text-xs font-medium text-slate-700 truncate">{{ media.title || media.file_name }}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">{{ formatBytes(media.size_bytes) }}<span v-if="media.width"> · {{ media.width }}×{{ media.height }}</span></p>
        </div>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="selected" class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" @click.self="selected = null">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl grid md:grid-cols-2 overflow-hidden">
          <div class="bg-slate-100 flex items-center justify-center min-h-[260px]">
            <img v-if="selected.mime_type?.startsWith('image/')" :src="selected.public_url" :alt="selected.alt_text ?? ''" class="max-h-[60vh] w-full object-contain" />
            <a v-else :href="selected.public_url" target="_blank" rel="noopener" class="text-indigo-600 font-semibold text-sm">Abrir archivo</a>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Archivo</p>
              <p class="text-sm font-semibold text-slate-800 break-all">{{ selected.file_name }}</p>
              <p class="text-xs text-slate-500 mt-1">{{ selected.mime_type }} · {{ formatBytes(selected.size_bytes) }}<span v-if="selected.width"> · {{ selected.width }}×{{ selected.height }}</span> · {{ formatWebsiteDateTime(selected.created_at) }}</p>
            </div>
            <FormInput v-model="editTitle" label="Título" size="sm" />
            <FormInput v-model="editAlt" label="Texto alternativo (accesibilidad y SEO)" size="sm" />
            <FormInput v-model="editFolder" label="Carpeta" size="sm" />
            <div class="flex items-center gap-2">
              <input :value="selected.public_url" readonly class="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600" />
              <button type="button" class="text-xs font-semibold text-indigo-600" @click="copyUrl(selected.public_url)">Copiar URL</button>
            </div>
            <div class="flex flex-wrap gap-2 pt-2">
              <BtnApp label="Guardar" size="sm" @click="saveDetail" />
              <BtnApp label="Cerrar" size="sm" variant="ghost" @click="selected = null" />
              <BtnApp label="Eliminar" size="sm" variant="danger" class="ml-auto" @click="deleteSelected" />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
