<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyPaymentMethodForm,
  type PaymentMethodFormData
} from '~/components/PaymentMethod/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create } = usePaymentMethod()

const formData = ref<PaymentMethodFormData>(createEmptyPaymentMethodForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => router.push('/admin/payment-methods')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }

  errorMessage.value = null
  isSaving.value = true
  try {
    const result = await create(cid, {
      name: formData.value.name.trim(),
      code: formData.value.code.trim() || null,
      description: formData.value.description.trim() || null,
      active: formData.value.active
    })
    if (!result) { errorMessage.value = 'No se pudo crear el método de pago.'; return }
    router.push(`/admin/payment-methods/${result.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/payment-methods')
</script>

<template>
  <CardSheet
    title="Nuevo Método de Pago"
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

    <PaymentMethodForm v-model="formData" />
  </CardSheet>
</template>
