<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyOrderForm,
  createEmptyOrderLine,
  type OrderFormData,
  type OrderLine
} from '~/components/Order/Form.vue'
import type { TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { createDraftOrder, updateOrder, addOrderLineRpc } = useOrder()
const { getPartnersByCompany } = usePartner()

const formData = ref<OrderFormData>(createEmptyOrderForm())
const orderLines = ref<OrderLine[]>([createEmptyOrderLine()])
const partnerOptions = ref<{ value: string; label: string }[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const mapFormToOrderUpdate = (value: OrderFormData): TablesUpdate<'order'> => ({
  partner_id: value.partner_id ?? undefined,
  reference: value.reference.trim() || null,
  order_date: value.order_date,
  delivery_date: value.delivery_date.trim() || null,
  currency: value.currency.trim() || 'MXN',
  exchange_rate: value.exchange_rate,
  tax_rate: value.tax_rate,
  tax_included: value.tax_included,
  payment_term: value.payment_term.trim() || null,
  payment_due_date: value.payment_due_date.trim() || null,
  shipping_street: value.shipping_street.trim() || null,
  shipping_street2: value.shipping_street2.trim() || null,
  shipping_city: value.shipping_city.trim() || null,
  shipping_state: value.shipping_state.trim() || null,
  shipping_zip: value.shipping_zip.trim() || null,
  shipping_country_code: value.shipping_country_code.trim() || null,
  notes: value.notes.trim() || null,
  terms: value.terms.trim() || null,
  is_invoiced: value.is_invoiced,
  is_delivered: value.is_delivered,
  is_paid: value.is_paid,
  order_type: value.order_type
})

const loadPartners = async () => {
  const companyId = selectedCompanyId.value
  partnerOptions.value = []
  formData.value.partner_id = null
  formData.value.partner_name = ''

  if (!companyId) return

  const partners = await getPartnersByCompany(companyId)
  partnerOptions.value = partners.map((p) => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))
}

watch(selectedCompanyId, () => {
  void loadPartners()
}, { immediate: true })

const handleBack = () => {
  router.push('/admin/orders')
}

const handleSave = async () => {
  errorMessage.value = null

  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa antes de crear una orden.'
    return
  }

  const partnerId = formData.value.partner_id
  if (!partnerId) {
    errorMessage.value = `Selecciona un ${formData.value.order_type === 'sale' ? 'cliente' : 'proveedor'}.`
    return
  }

  const invalidLine = orderLines.value.some(
    line => !line.description.trim() && !line.product_name.trim()
  )
  if (invalidLine) {
    errorMessage.value = 'Cada línea debe tener descripción o nombre de producto.'
    return
  }

  isSaving.value = true
  try {
    const orderId = await createDraftOrder({
      companyId,
      orderType: formData.value.order_type,
      partnerId,
      currency: formData.value.currency,
      taxRate: formData.value.tax_rate
    })

    if (!orderId) {
      errorMessage.value = 'No se pudo crear la orden.'
      return
    }

    const updated = await updateOrder(orderId, companyId, mapFormToOrderUpdate(formData.value))
    if (!updated) {
      errorMessage.value = 'La orden se creó pero no se pudieron guardar los datos adicionales.'
      return
    }

    for (const line of orderLines.value) {
      const productId = line.product_id?.trim() || null
      const desc = line.description.trim() || line.product_name.trim() || 'Línea'
      const lineId = await addOrderLineRpc({
        orderId,
        productId,
        description: desc,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        unitCost: line.unit_cost,
        discountPercent: line.discount_percent,
        taxRate: line.tax_rate
      })
      if (!lineId) {
        errorMessage.value = 'La orden se creó pero una o más líneas no se pudieron guardar.'
        return
      }
    }

    router.push(`/admin/orders/${orderId}`)
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
    <div
      v-if="!selectedCompanyId"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para crear órdenes vinculadas a sus socios.
      </p>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <OrderForm
      v-model="formData"
      v-model:lines="orderLines"
      :partner-options="partnerOptions"
    />
  </CardSheet>
</template>
