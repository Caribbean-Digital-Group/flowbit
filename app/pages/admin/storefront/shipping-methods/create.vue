<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyStorefrontShippingMethodForm,
  type StorefrontShippingMethodFormData
} from '~/components/StorefrontShippingMethod/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create } = useStorefrontShippingMethod()

const formData = ref<StorefrontShippingMethodFormData>(createEmptyStorefrontShippingMethodForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => router.push('/admin/storefront/shipping-methods')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  if (formData.value.price < 0) { errorMessage.value = 'El costo no puede ser negativo.'; return }

  errorMessage.value = null
  isSaving.value = true
  try {
    const result = await create({
      company_id: cid,
      name: formData.value.name.trim(),
      description: formData.value.description.trim() || null,
      price: formData.value.price || 0,
      delivery_estimate: formData.value.delivery_estimate.trim() || null,
      display_order: formData.value.display_order || 0,
      active: formData.value.active
    })
    if (!result) { errorMessage.value = 'No se pudo crear el método de envío.'; return }
    router.push(`/admin/storefront/shipping-methods/${result.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/storefront/shipping-methods')
</script>

<template>
  <CardSheet
    title="Nuevo Método de Envío"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <StorefrontShippingMethodForm v-model="formData" />
  </CardSheet>
</template>
