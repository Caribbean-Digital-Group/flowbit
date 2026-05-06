<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyOrderForm,
  type OrderFormData,
  type OrderLine
} from '~/components/Order/Form.vue'
import type { Database, TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type OrderViewRow = Database['public']['Views']['v_orders']['Row']
type OrderLineViewRow = Database['public']['Views']['v_order_lines']['Row']

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const {
  getOrderViewById,
  updateOrder,
  previewOrderStockShortages,
  postOrderById,
  cancelOrderById,
  addOrderLineRpc
} = useOrder()

const { getPartnersByCompany } = usePartner()
const {
  getOrderLineViewsByOrderId,
  deleteOrderLine,
  updateOrderLine
} = useOrderLine()

const orderId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

type StockShortageRow = {
  product_id: string
  product_name: string
  requested: number
  available: number
}

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const stockShortageLines = ref<StockShortageRow[]>([])
const partnerOptions = ref<{ value: string; label: string }[]>([])

const formData = ref<OrderFormData>(createEmptyOrderForm())
const orderLines = ref<OrderLine[]>([])
const initialLineIds = ref<Set<string>>(new Set())

const orderTypeLabels: Record<string, string> = {
  sale: 'Venta',
  purchase: 'Compra'
}

const stateLabels: Record<string, string> = {
  draft: 'Borrador',
  posted: 'Confirmada',
  cancel: 'Cancelada'
}

const stateVariants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  draft: 'secondary',
  posted: 'success',
  cancel: 'danger'
}

const auditFooter = reactive({
  createdBy: '—',
  createdAt: '',
  updatedBy: '—',
  updatedAt: ''
})

const canEdit = computed(() => formData.value.order_state === 'draft')

const canPost = computed(
  () => formData.value.order_state === 'draft' && orderLines.value.length > 0
)

const canCancel = computed(
  () =>
    formData.value.order_state !== 'cancel'
    && !formData.value.is_delivered
    && !formData.value.is_invoiced
)

const menuOptions = computed<MenuOption[]>(() => {
  const opts: MenuOption[] = []
  if (canPost.value) {
    opts.push({
      id: 'post',
      label: 'Confirmar Orden',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => void handlePostOrder(),
      variant: 'success'
    })
  }
  if (canCancel.value) {
    opts.push({
      id: 'cancel-order',
      label: 'Cancelar Orden',
      icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => void handleCancelOrder(),
      variant: 'warning'
    })
  }
  return opts
})

const refreshStockShortagePreview = async () => {
  stockShortageLines.value = []
  const id = orderId.value
  if (!id || !selectedCompanyId.value) return
  if (formData.value.order_state !== 'draft' || formData.value.order_type !== 'sale') {
    return
  }
  stockShortageLines.value = await previewOrderStockShortages(id)
}

watch(isEditing, (editing) => {
  if (editing) {
    stockShortageLines.value = []
  }
})

const mapViewToForm = (v: OrderViewRow): OrderFormData => ({
  name: v.name ?? '',
  order_type: v.order_type ?? 'sale',
  reference: v.reference ?? '',
  order_state: v.order_state ?? 'draft',
  partner_id: v.partner_id ?? null,
  partner_name: v.partner_name ?? '',
  created_by_partner_id: v.created_by_partner_id ?? null,
  created_by_partner_name: v.created_by_partner_name ?? '',
  order_date: v.order_date ?? '',
  confirmation_date: v.confirmation_date ?? null,
  delivery_date: v.delivery_date ?? '',
  currency: v.currency ?? 'MXN',
  exchange_rate: v.exchange_rate ?? 1,
  tax_rate: v.tax_rate ?? 0,
  tax_included: v.tax_included ?? false,
  amount_untaxed: v.amount_untaxed ?? 0,
  amount_tax: v.amount_tax ?? 0,
  amount_total: v.amount_total ?? 0,
  amount_discount: v.amount_discount ?? 0,
  payment_term: v.payment_term ?? '',
  payment_due_date: v.payment_due_date ?? '',
  shipping_street: v.shipping_street ?? '',
  shipping_street2: v.shipping_street2 ?? '',
  shipping_city: v.shipping_city ?? '',
  shipping_state: v.shipping_state ?? '',
  shipping_zip: v.shipping_zip ?? '',
  shipping_country_code: v.shipping_country_code ?? 'MX',
  notes: v.notes ?? '',
  terms: v.terms ?? '',
  is_invoiced: v.is_invoiced ?? false,
  is_delivered: v.is_delivered ?? false,
  is_paid: v.is_paid ?? false
})

const mapViewLineToUi = (row: OrderLineViewRow): OrderLine => ({
  id: row.id ?? crypto.randomUUID(),
  sequence: row.sequence ?? 10,
  product_id: row.product_id ?? '',
  product_name: row.product_name ?? '',
  description: row.description ?? '',
  quantity: row.quantity ?? 1,
  quantity_delivered: row.quantity_delivered ?? 0,
  quantity_invoiced: row.quantity_invoiced ?? 0,
  unit_price: row.unit_price ?? 0,
  unit_cost: row.unit_cost ?? 0,
  discount_percent: row.discount_percent ?? 0,
  discount_amount: row.discount_amount ?? 0,
  tax_rate: row.tax_rate ?? 0,
  tax_amount: row.tax_amount ?? 0,
  subtotal: row.subtotal ?? 0,
  total: row.total ?? 0,
  margin: row.margin ?? 0,
  margin_percent: row.margin_percent ?? 0
})

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
  if (!companyId) return

  const partners = await getPartnersByCompany(companyId)
  partnerOptions.value = partners.map((p) => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))
}

const loadOrder = async () => {
  const id = orderId.value
  const companyId = selectedCompanyId.value
  errorMessage.value = null

  if (!id) {
    errorMessage.value = 'Identificador de orden no válido.'
    return
  }
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa para ver esta orden.'
    return
  }

  isLoading.value = true
  try {
    await loadPartners()

    const view = await getOrderViewById(id, companyId)
    if (!view) {
      errorMessage.value = 'No se encontró la orden o no tienes acceso.'
      return
    }

    const mappedForm = mapViewToForm(view)
    formData.value = mappedForm

    auditFooter.createdBy = view.created_by ?? '—'
    auditFooter.createdAt = view.created_at ?? ''
    auditFooter.updatedBy = view.updated_by ?? '—'
    auditFooter.updatedAt = view.updated_at ?? ''

    const lineRows = await getOrderLineViewsByOrderId(id, companyId)
    const lines = lineRows.map(mapViewLineToUi)
    orderLines.value = lines
    initialLineIds.value = new Set(lines.map((l) => l.id))

    await refreshStockShortagePreview()
  } finally {
    isLoading.value = false
  }
}

watch([orderId, selectedCompanyId], () => {
  isEditing.value = false
  void loadOrder()
}, { immediate: true })

const handleBack = () => {
  router.push('/admin/orders')
}

const handlePostOrder = async () => {
  const id = orderId.value
  if (!id || !canPost.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    if (formData.value.order_type === 'sale') {
      stockShortageLines.value = await previewOrderStockShortages(id)
      if (stockShortageLines.value.length > 0) {
        errorMessage.value =
          'No se puede confirmar la orden hasta resolver el inventario. Revisa el aviso amarillo o ajusta las líneas.'
        return
      }
    }

    const result = await postOrderById(id)
    if (!result.success) {
      errorMessage.value =
        result.errorMessage
        ?? 'No se pudo confirmar la orden. Debe estar en borrador y tener al menos una línea.'
      await refreshStockShortagePreview()
      return
    }

    stockShortageLines.value = []
    await loadOrder()
  } finally {
    isLoading.value = false
  }
}

const handleCancelOrder = async () => {
  const id = orderId.value
  if (!id || !canCancel.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const ok = await cancelOrderById(id)
    if (!ok) {
      errorMessage.value = 'No se pudo cancelar la orden.'
      return
    }
    await loadOrder()
  } finally {
    isLoading.value = false
  }
}

const handleEdit = () => {
  if (canEdit.value) {
    errorMessage.value = null
    isEditing.value = true
  }
}

const syncLines = async (id: string, companyId: string): Promise<boolean> => {
  const currentIds = new Set(orderLines.value.map((l) => l.id))

  for (const oldId of initialLineIds.value) {
    if (!currentIds.has(oldId)) {
      const ok = await deleteOrderLine(oldId)
      if (!ok) {
        return false
      }
    }
  }

  for (const line of orderLines.value) {
    const productId = line.product_id?.trim() || null
    const desc = line.description.trim() || line.product_name.trim() || 'Línea'

    if (initialLineIds.value.has(line.id)) {
      const updated = await updateOrderLine(line.id, {
        product_id: productId,
        description: desc,
        quantity: line.quantity,
        unit_price: line.unit_price,
        unit_cost: line.unit_cost,
        discount_percent: line.discount_percent,
        tax_rate: line.tax_rate,
        sequence: line.sequence
      })
      if (!updated) {
        return false
      }
    } else {
      const newId = await addOrderLineRpc({
        orderId: id,
        productId,
        description: desc,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        unitCost: line.unit_cost,
        discountPercent: line.discount_percent,
        taxRate: line.tax_rate
      })
      if (!newId) {
        return false
      }
    }
  }

  return true
}

const handleSave = async () => {
  const id = orderId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId || !canEdit.value) return

  if (!formData.value.partner_id) {
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

  isLoading.value = true
  errorMessage.value = null

  try {
    const updated = await updateOrder(id, companyId, mapFormToOrderUpdate(formData.value))
    if (!updated) {
      errorMessage.value = 'No se pudo guardar la orden.'
      return
    }

    const linesOk = await syncLines(id, companyId)
    if (!linesOk) {
      errorMessage.value = 'Se guardó el encabezado pero hubo un error al sincronizar las líneas.'
      await loadOrder()
      return
    }

    await loadOrder()
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleCancelEdit = async () => {
  isEditing.value = false
  errorMessage.value = null
  await loadOrder()
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div>
    <div
      v-if="errorMessage"
      class="mb-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700 whitespace-pre-line"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="
        stockShortageLines.length > 0
          && !isEditing
          && formData.order_state === 'draft'
          && formData.order_type === 'sale'
      "
      class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-950 shadow-sm shadow-amber-100/50"
    >
      <p class="font-semibold flex items-start gap-2">
        <svg class="w-5 h-5 shrink-0 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Inventario insuficiente para confirmar esta venta
      </p>
      <ul class="mt-3 list-disc pl-5 text-sm leading-relaxed space-y-1.5">
        <li v-for="row in stockShortageLines" :key="row.product_id">
          <span class="font-medium">{{ row.product_name }}</span>:
          piden {{ row.requested }}, disponibles {{ row.available }}
        </li>
      </ul>
      <p class="mt-3 text-xs text-amber-900/85">
        Aumenta stock en el catálogo, reduce cantidades en las líneas o elimina productos antes de usar «Confirmar orden».
      </p>
    </div>

    <CardSheet
      :title="formData.name || 'Orden'"
      :subtitle="`${orderTypeLabels[formData.order_type] || formData.order_type} — ${formData.partner_name || 'Sin socio'}`"
      :show-back-button="true"
      :show-options-button="menuOptions.length > 0"
      :show-edit-button="canEdit"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="auditFooter.createdBy"
      :created-at="formatDate(auditFooter.createdAt)"
      :updated-by="auditFooter.updatedBy"
      :updated-at="formatDate(auditFooter.updatedAt)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      :full-height="false"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancelEdit"
    >
      <template #status>
        <div class="flex flex-wrap items-center gap-2">
          <BadgeApp
            :label="orderTypeLabels[formData.order_type] || formData.order_type"
            :variant="formData.order_type === 'sale' ? 'primary' : 'warning'"
          />
          <BadgeApp
            :label="stateLabels[formData.order_state] || formData.order_state"
            :variant="stateVariants[formData.order_state] || 'secondary'"
          />
          <BadgeApp
            v-if="formData.is_paid"
            label="Pagada"
            variant="success"
          />
          <BadgeApp
            v-if="formData.is_delivered"
            label="Entregada"
            variant="success"
          />
          <BadgeApp
            v-if="formData.is_invoiced"
            label="Facturada"
            variant="primary"
          />
        </div>
      </template>

      <OrderForm
        v-model="formData"
        v-model:lines="orderLines"
        :readonly="!isEditing"
        :partner-options="partnerOptions"
        :company-id="selectedCompanyId"
      />
    </CardSheet>
  </div>
</template>
