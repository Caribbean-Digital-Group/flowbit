<script lang="ts">
export interface WebsiteRedirectFormData {
  from_path: string
  to_path: string
  status_code: 301 | 302
}

export const createEmptyWebsiteRedirectForm = (): WebsiteRedirectFormData => ({
  from_path: '',
  to_path: '',
  status_code: 301
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), { readonly: false })
const formData = defineModel<WebsiteRedirectFormData>({ required: true })

const codeOptions = [
  { value: 301, label: '301 — Permanente' },
  { value: 302, label: '302 — Temporal' }
]
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <FormInput v-model="formData.from_path" label="Desde (ruta antigua)" placeholder="/servicios-viejos" hint="Relativa al sitio, empieza con /" :readonly="readonly" required size="md" />
    <FormInput v-model="formData.to_path" label="Hacia (ruta nueva o URL)" placeholder="/servicios o https://…" :readonly="readonly" required size="md" />
    <FormSelect v-model="formData.status_code" label="Código" :options="codeOptions" :disabled="readonly" :searchable="false" size="md" />
  </div>
</template>
