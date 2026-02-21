<script setup lang="ts">
import { createEmptyProductForm, type ProductFormData } from '~/components/Product/Form.vue'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()

const formData = ref<ProductFormData>(createEmptyProductForm())
const isSaving = ref(false)

const handleBack = () => {
  router.push('/admin/products')
}

const handleSave = async () => {
  if (!formData.value.name.trim()) return

  isSaving.value = true
  try {
    // TODO: integrate with useProduct composable
    await new Promise(resolve => setTimeout(resolve, 1000))
    router.push('/admin/products')
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  router.push('/admin/products')
}
</script>

<template>
  <CardSheet
    title="Nuevo Producto"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <ProductForm v-model="formData" />
  </CardSheet>
</template>
