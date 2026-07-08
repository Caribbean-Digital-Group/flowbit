<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyStorefrontCouponForm,
  type StorefrontCouponFormData
} from '~/components/StorefrontCoupon/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create } = useStorefrontCoupon()

const formData = ref<StorefrontCouponFormData>(createEmptyStorefrontCouponForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => router.push('/admin/storefront/coupons')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.code.trim()) { errorMessage.value = 'El código es obligatorio.'; return }
  if (!formData.value.discount_value || formData.value.discount_value <= 0) {
    errorMessage.value = 'El descuento debe ser mayor a cero.'
    return
  }
  if (formData.value.discount_type === 'percent' && formData.value.discount_value > 100) {
    errorMessage.value = 'El porcentaje no puede ser mayor a 100.'
    return
  }

  errorMessage.value = null
  isSaving.value = true
  try {
    const result = await create({
      company_id: cid,
      code: formData.value.code.trim(),
      description: formData.value.description.trim() || null,
      discount_type: formData.value.discount_type,
      discount_value: formData.value.discount_value,
      min_purchase: formData.value.min_purchase || 0,
      usage_limit: formData.value.usage_limit || null,
      starts_at: formData.value.starts_at || null,
      expires_at: formData.value.expires_at || null,
      active: formData.value.active
    })
    if (!result) {
      errorMessage.value = 'No se pudo crear el cupón. Verifica que el código no esté repetido.'
      return
    }
    router.push(`/admin/storefront/coupons/${result.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/storefront/coupons')
</script>

<template>
  <CardSheet
    title="Nuevo Cupón"
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

    <StorefrontCouponForm v-model="formData" />
  </CardSheet>
</template>
