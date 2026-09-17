<script lang="ts">
import type { WebsitePostStatus } from '~/types/website.types'

export interface WebsitePostFormData {
  title: string
  subtitle: string
  slug: string
  status: WebsitePostStatus
  published_at: string
  author_id: string | null
  category_id: string | null
  tags: string[]
  cover_url: string
  cover_alt: string
  excerpt: string
  is_featured: boolean
  is_pinned: boolean
  allow_comments: boolean
  related_post_ids: string[]
  seo_title: string
  seo_description: string
  og_image_url: string
  canonical_url: string
  noindex: boolean
}

export const createEmptyWebsitePostForm = (): WebsitePostFormData => ({
  title: '',
  subtitle: '',
  slug: '',
  status: 'draft',
  published_at: '',
  author_id: null,
  category_id: null,
  tags: [],
  cover_url: '',
  cover_alt: '',
  excerpt: '',
  is_featured: false,
  is_pinned: false,
  allow_comments: true,
  related_post_ids: [],
  seo_title: '',
  seo_description: '',
  og_image_url: '',
  canonical_url: '',
  noindex: false
})

/** Convierte un ISO a valor para <input type="datetime-local"> en hora local. */
export const toDateTimeLocal = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
</script>

<script setup lang="ts">
type Option = { value: string; label: string }

interface Props {
  readonly?: boolean
  companyId: string
  authors: Option[]
  categories: Option[]
  tagSuggestions: string[]
  postOptions: Option[]
}

withDefaults(defineProps<Props>(), { readonly: false })

const formData = defineModel<WebsitePostFormData>({ required: true })

const statusOptions = [
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Archivado' }
]

const tagInput = ref('')

const addTag = () => {
  const value = tagInput.value.replace(/,/g, '').trim()
  if (!value) return
  if (!formData.value.tags.some(t => t.toLowerCase() === value.toLowerCase())) {
    formData.value.tags = [...formData.value.tags, value.slice(0, 60)]
  }
  tagInput.value = ''
}

const removeTag = (tag: string) => {
  formData.value.tags = formData.value.tags.filter(t => t !== tag)
}

const toggleRelated = (id: string) => {
  const current = formData.value.related_post_ids
  formData.value.related_post_ids = current.includes(id) ? current.filter(x => x !== id) : [...current, id].slice(0, 6)
}
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-4">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Publicación</p>
      <FormSelect v-model="formData.status" label="Estado" :options="statusOptions" :disabled="readonly" :searchable="false" size="md" />
      <FormInput
        v-model="formData.published_at"
        label="Fecha de publicación"
        type="datetime-local"
        hint="Una fecha futura programa el post. Vacío = al publicar."
        :readonly="readonly"
        size="md"
      />
      <FormSelect v-model="formData.author_id" label="Autor" :options="authors" placeholder="Sin autor" clearable :disabled="readonly" size="md" />
      <FormSelect v-model="formData.category_id" label="Categoría" :options="categories" placeholder="Sin categoría" clearable :disabled="readonly" size="md" />

      <div>
        <p class="block text-sm font-medium text-slate-700 mb-1.5">Etiquetas</p>
        <div class="flex flex-wrap gap-2 mb-2">
          <span v-for="tag in formData.tags" :key="tag" class="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold">
            #{{ tag }}
            <button v-if="!readonly" type="button" class="hover:text-indigo-900" :aria-label="`Quitar ${tag}`" @click="removeTag(tag)">×</button>
          </span>
        </div>
        <FormInput
          v-if="!readonly"
          v-model="tagInput"
          placeholder="Escribe y presiona Enter"
          list="website-tag-suggestions"
          size="sm"
          @keydown.enter.prevent="addTag"
          @keydown.,.prevent="addTag"
          @blur="addTag"
        />
        <datalist id="website-tag-suggestions">
          <option v-for="tag in tagSuggestions" :key="tag" :value="tag" />
        </datalist>
      </div>

      <div class="grid grid-cols-1 gap-2">
        <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
          <input v-model="formData.is_featured" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
          <span class="text-sm text-slate-700">Destacado</span>
        </label>
        <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
          <input v-model="formData.is_pinned" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
          <span class="text-sm text-slate-700">Fijar al inicio del blog</span>
        </label>
        <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
          <input v-model="formData.allow_comments" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
          <span class="text-sm text-slate-700">Permitir comentarios</span>
        </label>
      </div>
    </section>

    <section class="space-y-4 pt-5 border-t border-slate-100">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Portada y resumen</p>
      <WebsiteImageField v-model="formData.cover_url" label="Imagen de portada" :company-id="companyId" :readonly="readonly" />
      <FormInput v-model="formData.cover_alt" label="Texto alternativo / pie de portada" :readonly="readonly" size="sm" />
      <FormTextArea v-model="formData.excerpt" label="Extracto" hint="Vacío = se genera del cuerpo." :rows="3" :maxlength="400" show-count :readonly="readonly" size="sm" />
      <FormInput v-model="formData.slug" label="URL (slug)" placeholder="Se genera del título" :readonly="readonly" size="sm" />
    </section>

    <section v-if="postOptions.length" class="space-y-3 pt-5 border-t border-slate-100">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Relacionados (manual)</p>
      <p class="text-xs text-slate-500">Hasta 6. Si no eliges ninguno, se sugieren por etiquetas y categoría.</p>
      <div class="max-h-48 overflow-y-auto space-y-1 pr-1">
        <label v-for="option in postOptions" :key="option.value" class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-1 py-1 rounded hover:bg-slate-50">
          <input type="checkbox" :checked="formData.related_post_ids.includes(option.value)" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" @change="toggleRelated(option.value)" />
          <span class="truncate">{{ option.label }}</span>
        </label>
      </div>
    </section>

    <details class="pt-5 border-t border-slate-100">
      <summary class="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-400">SEO</summary>
      <div class="mt-4 space-y-4">
        <FormInput v-model="formData.seo_title" label="Título SEO" :maxlength="120" :readonly="readonly" size="sm" />
        <FormTextArea v-model="formData.seo_description" label="Descripción SEO" :rows="2" :maxlength="320" show-count :readonly="readonly" size="sm" />
        <WebsiteImageField v-model="formData.og_image_url" label="Imagen para redes" hint="Vacío = portada." :company-id="companyId" :readonly="readonly" />
        <FormInput v-model="formData.canonical_url" label="URL canónica" type="url" :readonly="readonly" size="sm" />
        <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
          <input v-model="formData.noindex" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
          <span class="text-sm text-slate-700">No indexar</span>
        </label>
      </div>
    </details>
  </div>
</template>
