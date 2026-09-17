<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyWebsiteCategoryForm, type WebsiteCategoryFormData } from '~/components/WebsiteCategory/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create, getAllByCompany, lastError } = useWebsiteCategory()

const formData = ref<WebsiteCategoryFormData>(createEmptyWebsiteCategoryForm())
const parentOptions = ref<{ value: string; label: string }[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

watch(selectedCompanyId, async (cid) => {
  parentOptions.value = cid ? (await getAllByCompany(cid)).filter(c => !c.parent_id).map(c => ({ value: c.id, label: c.name })) : []
}, { immediate: true })

const handleBack = () => router.push('/admin/website/blog/categories')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  errorMessage.value = null
  isSaving.value = true
  try {
    const f = formData.value
    const result = await create({
      company_id: cid,
      name: f.name.trim(),
      slug: f.slug.trim() || null,
      description: f.description.trim() || null,
      parent_id: f.parent_id,
      color: f.color || null,
      image_url: f.image_url.trim() || null,
      display_order: f.display_order,
      is_featured: f.is_featured,
      active: f.active
    })
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo crear la categoría.'; return }
    router.push(`/admin/website/blog/categories/${result.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet title="Nueva categoría" :is-editing="true" :is-loading="isSaving" :show-edit-button="false" :show-options-button="false" :show-footer="false" @back="handleBack" @save="handleSave" @cancel="handleBack">
    <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <WebsiteCategoryForm v-if="selectedCompanyId" v-model="formData" :company-id="selectedCompanyId" :parent-options="parentOptions" />
  </CardSheet>
</template>
