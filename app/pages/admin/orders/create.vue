<script setup lang="ts">
import { createEmptyOrderForm, type OrderFormData, type OrderLine } from '~/components/Order/Form.vue'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()

const formData = ref<OrderFormData>(createEmptyOrderForm())
const orderLines = ref<OrderLine[]>([])
const isSaving = ref(false)

const handleBack = () => {
  router.push('/admin/orders')
}

const handleSave = async () => {
  if (!formData.value.partner_name.trim()) return

  isSaving.value = true
  try {
    // TODO: integrate with useOrder composable
    await new Promise(resolve => setTimeout(resolve, 1000))
    router.push('/admin/orders')
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  router.push('/admin/orders')
}
</script>

<template>
  <CardSheet
    title="Nueva Orden"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <OrderForm
      v-model="formData"
      v-model:lines="orderLines"
    />
  </CardSheet>
</template>
