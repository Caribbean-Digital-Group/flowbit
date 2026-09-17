<script lang="ts">
import type { WebsitePageLayout, WebsitePageStatus } from '~/types/website.types'

export interface WebsitePageFormData {
  title: string
  slug: string
  status: WebsitePageStatus
  is_home: boolean
  layout: WebsitePageLayout
  show_title: boolean
  excerpt: string
  seo_title: string
  seo_description: string
  og_image_url: string
  canonical_url: string
  noindex: boolean
  show_in_search: boolean
  display_order: number
}

export const createEmptyWebsitePageForm = (): WebsitePageFormData => ({
  title: '',
  slug: '',
  status: 'draft',
  is_home: false,
  layout: 'default',
  show_title: true,
  excerpt: '',
  seo_title: '',
  seo_description: '',
  og_image_url: '',
  canonical_url: '',
  noindex: false,
  show_in_search: true,
  display_order: 0
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  companyId: string
  siteUrl?: string
}

withDefaults(defineProps<Props>(), { readonly: false, siteUrl: '' })

const formData = defineModel<WebsitePageFormData>({ required: true })

const statusOptions = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicada' },
  { value: 'archived', label: 'Archivada' }
]

const layoutOptions = [
  { value: 'default', label: 'Estándar (con título)' },
  { value: 'landing', label: 'Landing (sin título, secciones a todo lo ancho)' },
  { value: 'full_width', label: 'Ancho completo' }
]
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput v-model="formData.title" label="Título" placeholder="Ej: Nosotros" :readonly="readonly" required size="md" />
      <FormInput v-model="formData.slug" label="URL (slug)" placeholder="Se genera del título" :hint="siteUrl ? `${siteUrl}/${formData.is_home ? '' : formData.slug || 'slug'}` : 'Solo minúsculas, números y guiones.'" :readonly="readonly" size="md" />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <FormSelect v-model="formData.status" label="Estado" :options="statusOptions" :disabled="readonly" :searchable="false" size="md" />
      <FormSelect v-model="formData.layout" label="Distribución" :options="layoutOptions" :disabled="readonly" :searchable="false" size="md" />
      <FormInput v-model.number="formData.display_order" label="Orden" type="number" :min="0" hint="Orden en menús y listados." :readonly="readonly" size="md" />
    </div>
    <FormTextArea v-model="formData.excerpt" label="Resumen" placeholder="Descripción corta usada en buscadores y en la búsqueda del sitio." :rows="2" :maxlength="320" :readonly="readonly" show-count />

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
        <input v-model="formData.is_home" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
        <span class="text-sm text-slate-700">Página de inicio</span>
      </label>
      <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
        <input v-model="formData.show_title" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
        <span class="text-sm text-slate-700">Mostrar título arriba</span>
      </label>
      <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
        <input v-model="formData.show_in_search" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
        <span class="text-sm text-slate-700">Incluir en la búsqueda del sitio</span>
      </label>
    </div>

    <details class="rounded-2xl border border-slate-200 p-5">
      <summary class="cursor-pointer text-sm font-semibold text-slate-700">SEO y redes sociales</summary>
      <div class="mt-5 space-y-5">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormInput v-model="formData.seo_title" label="Título SEO" :maxlength="120" hint="Vacío = título de la página." :readonly="readonly" size="md" />
          <FormInput v-model="formData.canonical_url" label="URL canónica" type="url" placeholder="https://…" :readonly="readonly" size="md" />
        </div>
        <FormTextArea v-model="formData.seo_description" label="Descripción SEO" :rows="2" :maxlength="320" show-count :readonly="readonly" />
        <WebsiteImageField v-model="formData.og_image_url" label="Imagen para redes (Open Graph)" hint="Recomendado 1200×630 px." :company-id="companyId" :readonly="readonly" />
        <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
          <input v-model="formData.noindex" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
          <span class="text-sm text-slate-700">Pedir a los buscadores no indexar esta página</span>
        </label>
      </div>
    </details>
  </div>
</template>
