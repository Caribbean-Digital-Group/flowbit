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

const handleAddLine = () => {
  // TODO: open line creation dialog
}

const handleEditLine = (_lineId: string) => {
  // TODO: open line edit dialog
}

const handleRemoveLine = (lineId: string) => {
  orderLines.value = orderLines.value.filter(l => l.id !== lineId)
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
      :lines="orderLines"
      @add-line="handleAddLine"
      @edit-line="handleEditLine"
      @remove-line="handleRemoveLine"
    />
  </CardSheet>
</template>
