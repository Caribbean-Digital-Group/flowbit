<script setup lang="ts">
import type { WebsiteMediaRow } from '~/types/website.types'

/**
 * Selector de medios: biblioteca de la empresa, subida de archivos y URL
 * externa. Emite la URL elegida (y el registro cuando proviene del bucket).
 */
interface Props {
  companyId: string
  imagesOnly?: boolean
  folder?: string
}

const props = withDefaults(defineProps<Props>(), { imagesOnly: true, folder: 'general' })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [payload: { url: string; alt: string; media: WebsiteMediaRow | null }] }>()

const { list, upload, lastError } = useWebsiteMedia()

const tab = ref<'library' | 'upload' | 'url'>('library')
const items = ref<WebsiteMediaRow[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const search = ref('')
const externalUrl = ref('')
const errorMessage = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const load = async () => {
  if (!props.companyId) return
  isLoading.value = true
  items.value = await list(props.companyId, { imagesOnly: props.imagesOnly, search: search.value })
  isLoading.value = false
}

watch(open, (value) => {
  if (value) {
    tab.value = 'library'
    errorMessage.value = null
    void load()
  }
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(), 300)
})

const choose = (media: WebsiteMediaRow) => {
  emit('select', { url: media.public_url, alt: media.alt_text ?? '', media })
  open.value = false
}

const handleFiles = async (files: FileList | null) => {
  if (!files?.length) return
  errorMessage.value = null
  isUploading.value = true
  try {
    let last: WebsiteMediaRow | null = null
    for (const file of Array.from(files)) {
      const media = await upload(props.companyId, file, props.folder)
      if (!media) {
        errorMessage.value = lastError.value
        break
      }
      last = media
    }
    if (last && files.length === 1) {
      choose(last)
    } else if (last) {
      tab.value = 'library'
      await load()
    }
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()
  void handleFiles(event.dataTransfer?.files ?? null)
}

const useExternal = () => {
  const url = externalUrl.value.trim()
  if (!/^https?:\/\//i.test(url)) {
    errorMessage.value = 'Escribe una URL completa que empiece con http:// o https://'
    return
  }
  emit('select', { url, alt: '', media: null })
  externalUrl.value = ''
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" @click.self="open = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        <header class="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button v-for="t in [{ id: 'library', label: 'Biblioteca' }, { id: 'upload', label: 'Subir' }, { id: 'url', label: 'URL externa' }]" :key="t.id" type="button" :class="['px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors', tab === t.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700']" @click="tab = t.id as typeof tab">{{ t.label }}</button>
          </div>
          <button type="button" class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Cerrar" @click="open = false">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto p-6">
          <p v-if="errorMessage" class="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{{ errorMessage }}</p>

          <template v-if="tab === 'library'">
            <FormInput v-model="search" type="search" placeholder="Buscar por nombre o texto alternativo…" size="sm" />
            <div v-if="isLoading" class="py-16 text-center text-slate-400 text-sm">Cargando…</div>
            <div v-else-if="items.length" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
              <button v-for="media in items" :key="media.id" type="button" class="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" :title="media.file_name ?? ''" @click="choose(media)">
                <img v-if="media.mime_type?.startsWith('image/')" :src="media.public_url" :alt="media.alt_text ?? ''" class="w-full h-full object-cover" loading="lazy" />
                <span v-else class="w-full h-full flex items-center justify-center text-xs text-slate-500 px-2 text-center">{{ media.file_name }}</span>
                <span class="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">{{ media.file_name }}</span>
              </button>
            </div>
            <div v-else class="py-16 text-center text-slate-400 text-sm">
              La biblioteca está vacía. <button type="button" class="text-indigo-600 font-semibold" @click="tab = 'upload'">Sube tu primer archivo</button>.
            </div>
          </template>

          <div v-else-if="tab === 'upload'" class="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-indigo-400 transition-colors" @dragover.prevent @drop="onDrop">
            <svg class="w-12 h-12 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <p class="mt-4 text-slate-700 font-medium">Arrastra archivos aquí o</p>
            <label class="inline-block mt-3">
              <span class="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold cursor-pointer hover:bg-indigo-700">{{ isUploading ? 'Subiendo…' : 'Elegir archivos' }}</span>
              <input ref="fileInput" type="file" class="hidden" :accept="imagesOnly ? 'image/*' : WEBSITE_MEDIA_ACCEPT" multiple :disabled="isUploading" @change="handleFiles(($event.target as HTMLInputElement).files)" />
            </label>
            <p class="mt-4 text-xs text-slate-400">JPG, PNG, WebP, GIF, SVG, AVIF{{ imagesOnly ? '' : ', MP4 o PDF' }} · máximo 10 MB por archivo</p>
          </div>

          <div v-else class="max-w-lg mx-auto py-8">
            <FormInput v-model="externalUrl" label="URL de la imagen" type="url" placeholder="https://…" hint="Se enlaza sin copiarla a tu biblioteca." size="md" />
            <BtnApp label="Usar esta URL" size="md" class="mt-4" @click="useExternal" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
