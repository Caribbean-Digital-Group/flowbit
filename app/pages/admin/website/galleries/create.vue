<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyWebsiteGalleryForm, type WebsiteGalleryFormData } from '~/components/WebsiteGallery/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create, lastError } = useWebsiteGallery()

const formData = ref<WebsiteGalleryFormData>(createEmptyWebsiteGalleryForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => router.push('/admin/website/galleries')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  errorMessage.value = null
  isSaving.value = true
  try {
    const f = formData.value
    const result = await create({ company_id: cid, name: f.name.trim(), slug: f.slug.trim() || null, description: f.description.trim() || null, cover_url: f.cover_url.trim() || null, layout: f.layout, status: f.status, display_order: f.display_order })
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo crear la galería.'; return }
    router.push(`/admin/website/galleries/${result.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet title="Nueva galería" subtitle="Después agrega las fotos." :is-editing="true" :is-loading="isSaving" :show-edit-button="false" :show-options-button="false" :show-footer="false" @back="handleBack" @save="handleSave" @cancel="handleBack">
    <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <WebsiteGalleryForm v-if="selectedCompanyId" v-model="formData" :company-id="selectedCompanyId" />
  </CardSheet>
</template>
