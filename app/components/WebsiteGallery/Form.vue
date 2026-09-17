<script lang="ts">
import type { WebsiteGalleryLayout, WebsitePageStatus } from '~/types/website.types'

export interface WebsiteGalleryFormData {
  name: string
  slug: string
  description: string
  cover_url: string
  layout: WebsiteGalleryLayout
  status: WebsitePageStatus
  display_order: number
}

export const createEmptyWebsiteGalleryForm = (): WebsiteGalleryFormData => ({
  name: '',
  slug: '',
  description: '',
  cover_url: '',
  layout: 'grid',
  status: 'draft',
  display_order: 0
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  companyId: string
}

withDefaults(defineProps<Props>(), { readonly: false })
const formData = defineModel<WebsiteGalleryFormData>({ required: true })

const layoutOptions = [
  { value: 'grid', label: 'Cuadrícula' },
  { value: 'masonry', label: 'Mosaico (alturas variables)' },
  { value: 'carousel', label: 'Carrusel' }
]

const statusOptions = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicada' },
  { value: 'archived', label: 'Archivada' }
]
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput v-model="formData.name" label="Nombre" placeholder="Ej: Nuestras instalaciones" :readonly="readonly" required size="md" />
      <FormInput v-model="formData.slug" label="URL (slug)" placeholder="Se genera del nombre" :readonly="readonly" size="md" />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <FormSelect v-model="formData.layout" label="Presentación" :options="layoutOptions" :disabled="readonly" :searchable="false" size="md" />
      <FormSelect v-model="formData.status" label="Estado" :options="statusOptions" :disabled="readonly" :searchable="false" size="md" />
      <FormInput v-model.number="formData.display_order" label="Orden" type="number" :min="0" :readonly="readonly" size="md" />
    </div>
    <FormTextArea v-model="formData.description" label="Descripción" :rows="3" :readonly="readonly" />
    <WebsiteImageField v-model="formData.cover_url" label="Portada" hint="Vacío = primera foto de la galería." :company-id="companyId" :readonly="readonly" />
  </div>
</template>
