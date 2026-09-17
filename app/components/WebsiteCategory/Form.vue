<script lang="ts">
export interface WebsiteCategoryFormData {
  name: string
  slug: string
  description: string
  parent_id: string | null
  color: string
  image_url: string
  display_order: number
  is_featured: boolean
  active: boolean
}

export const createEmptyWebsiteCategoryForm = (): WebsiteCategoryFormData => ({
  name: '',
  slug: '',
  description: '',
  parent_id: null,
  color: '#6366f1',
  image_url: '',
  display_order: 0,
  is_featured: false,
  active: true
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  companyId: string
  parentOptions: { value: string; label: string }[]
}

withDefaults(defineProps<Props>(), { readonly: false })
const formData = defineModel<WebsiteCategoryFormData>({ required: true })
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput v-model="formData.name" label="Nombre" placeholder="Ej: Noticias" :readonly="readonly" required size="md" />
      <FormInput v-model="formData.slug" label="URL (slug)" placeholder="Se genera del nombre" :readonly="readonly" size="md" />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <FormSelect v-model="formData.parent_id" label="Categoría padre" :options="parentOptions" placeholder="Ninguna (raíz)" clearable :disabled="readonly" size="md" />
      <FormInput v-model.number="formData.display_order" label="Orden" type="number" :min="0" :readonly="readonly" size="md" />
      <div>
        <label for="ws-cat-color" class="block text-sm font-medium text-slate-700 mb-1.5">Color</label>
        <div class="flex items-center gap-3">
          <input id="ws-cat-color" v-model="formData.color" type="color" :disabled="readonly" class="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-white" />
          <span class="text-sm text-slate-500 font-mono">{{ formData.color }}</span>
        </div>
      </div>
    </div>
    <FormTextArea v-model="formData.description" label="Descripción" :rows="3" :readonly="readonly" />
    <WebsiteImageField v-model="formData.image_url" label="Imagen de la categoría" :company-id="companyId" :readonly="readonly" />
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
        <input v-model="formData.is_featured" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
        <span class="text-sm text-slate-700">Destacada (tema principal del blog)</span>
      </label>
      <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
        <input v-model="formData.active" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
        <span class="text-sm text-slate-700">Activa</span>
      </label>
    </div>
  </div>
</template>
