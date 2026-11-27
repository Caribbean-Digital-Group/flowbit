<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyOrderForm,
  createEmptyOrderLine,
  type OrderFormData,
  type OrderLine
} from '~/components/Order/Form.vue'
import type { TablesUpdate } from '~/types/database.types'
import {
  duplicateOrderHeader,
  duplicateOrderLines,
  type DuplicateCatalogProduct,
  type DuplicatePriceMode,
  type DuplicateSourceLine,
  type DuplicateSourceOrder
} from '~/utils/orderDuplicate'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const route = useRoute()

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const preselectedPartnerId = computed(() => {
  const v = route.query.partner_id
  return typeof v === 'string' && v ? v : null
})

// Duplicar una orden: /admin/orders/create?from=<id> precarga contacto, condiciones y líneas
const duplicateFromId = computed(() => {
  const v = route.query.from
  return typeof v === 'string' && v ? v : null
})

const { createDraftOrder, updateOrder, addOrderLineRpc, getOrderViewById } = useOrder()
const { getOrderLineViewsByOrderId } = useOrderLine()
const { getProductsByCompany } = useProduct()
const { getPartnersByCompany } = usePartner()
const { getProjectsByCompany } = useProject()
const { getAllByCompany: getPaymentMethodsByCompany } = usePaymentMethod()
const { getWarehousesByCompany } = useWarehouse()

const formData = ref<OrderFormData>(createEmptyOrderForm())
const orderLines = ref<OrderLine[]>([])
const partnerOptions = ref<{ value: string; label: string }[]>([])
const projectOptions = ref<{ value: string; label: string }[]>([])
const paymentMethodOptions = ref<{ value: string; label: string }[]>([])
const warehouseOptions = ref<{ value: string; label: string }[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

// Estado del duplicado
const duplicateSourceName = ref<string | null>(null)
const duplicatePriceMode = ref<DuplicatePriceMode>('original')
const duplicateSkipped = ref<string[]>([])
const duplicateSourceLines = ref<DuplicateSourceLine[]>([])
const duplicateCatalog = ref<DuplicateCatalogProduct[]>([])
const isLoadingDuplicate = ref(false)

const mapFormToOrderUpdate = (value: OrderFormData): TablesUpdate<'order'> => ({
  partner_id: value.partner_id ?? undefined,
  project_id: value.project_id ?? null,
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
  order_type: value.order_type,
  // Entrega y pago los deriva la base de datos; warehouse_id llega con db:types
  ...({ payment_method_id: value.payment_method_id || null, warehouse_id: value.warehouse_id || null } as Record<string, unknown>)
} as TablesUpdate<'order'>)

const loadPartners = async () => {
  const companyId = selectedCompanyId.value
  partnerOptions.value = []
  projectOptions.value = []
  formData.value.partner_id = null
  formData.value.partner_name = ''
  formData.value.project_id = null
  formData.value.project_name = ''

  if (!companyId) return

  const [partners, projects, paymentMethods, warehouses] = await Promise.all([
    getPartnersByCompany(companyId),
    getProjectsByCompany(companyId),
    getPaymentMethodsByCompany(companyId),
    getWarehousesByCompany(companyId)
  ])
  warehouseOptions.value = warehouses
    .filter(w => w.active !== false)
    .map(w => ({ value: w.id, label: w.code ? `${w.name} (${w.code})` : w.name }))
  partnerOptions.value = partners.map((p) => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))
  projectOptions.value = projects.map((p) => ({
    value: p.id ?? '',
    label: [p.code, p.name].filter(Boolean).join(' · ') || 'Proyecto'
  })).filter((p) => p.value)
  paymentMethodOptions.value = (paymentMethods as Array<{ id: string; name: string }>).map((pm) => ({
    value: pm.id,
    label: pm.name
  }))

  const pid = preselectedPartnerId.value
  if (pid && partnerOptions.value.some(p => p.value === pid)) {
    formData.value.partner_id = pid
    formData.value.partner_name = partnerOptions.value.find(p => p.value === pid)?.label ?? ''
  }
}

const toUiLines = (orderType: 'sale' | 'purchase'): OrderLine[] => {
  const { lines, skipped } = duplicateOrderLines(
    orderType,
    duplicateSourceLines.value,
    duplicateCatalog.value,
    duplicatePriceMode.value,
    formData.value.tax_rate
  )
  duplicateSkipped.value = skipped
  return lines.map((l) => {
    // Misma fórmula que la base de datos (respeta «precios con IVA»)
    const amounts = computeOrderLineAmounts({
      quantity: l.quantity,
      unitPrice: l.unit_price,
      discountPercent: l.discount_percent,
      taxRate: l.tax_rate,
      unitCost: l.unit_cost,
      priceIncludesTax: formData.value.tax_included
    })
    return {
      ...createEmptyOrderLine(),
      ...l,
      discount_amount: amounts.discount,
      subtotal: amounts.subtotal,
      tax_amount: amounts.tax,
      total: amounts.total,
      margin: amounts.margin,
      margin_percent: amounts.marginPercent
    }
  })
}

const applyDuplicateLines = () => {
  orderLines.value = toUiLines(formData.value.order_type)
  formData.value.amount_untaxed = orderLines.value.reduce((sum, l) => sum + l.subtotal, 0)
  formData.value.amount_tax = orderLines.value.reduce((sum, l) => sum + l.tax_amount, 0)
  formData.value.amount_total = orderLines.value.reduce((sum, l) => sum + l.total, 0)
  formData.value.amount_discount = orderLines.value.reduce((sum, l) => sum + l.discount_amount, 0)
}

const loadDuplicateSource = async () => {
  const sourceId = duplicateFromId.value
  const companyId = selectedCompanyId.value
  duplicateSourceName.value = null
  duplicateSkipped.value = []
  duplicateSourceLines.value = []
  if (!sourceId || !companyId) return

  isLoadingDuplicate.value = true
  try {
    const [view, lineRows, products] = await Promise.all([
      getOrderViewById(sourceId, companyId),
      getOrderLineViewsByOrderId(sourceId, companyId),
      getProductsByCompany(companyId)
    ])
    if (!view) {
      errorMessage.value = 'No se encontró la orden a duplicar o no tienes acceso.'
      return
    }

    // payment_method_id y warehouse_id llegan con db:types (igual que en el detalle)
    const row = view as Record<string, unknown>
    const source: DuplicateSourceOrder = {
      order_type: view.order_type ?? 'sale',
      partner_id: view.partner_id ?? null,
      project_id: view.project_id ?? null,
      currency: view.currency ?? null,
      exchange_rate: view.exchange_rate ?? null,
      tax_rate: view.tax_rate ?? null,
      tax_included: view.tax_included ?? null,
      payment_method_id: (row['payment_method_id'] as string | null) ?? null,
      warehouse_id: (row['warehouse_id'] as string | null) ?? null,
      payment_term: view.payment_term ?? null,
      shipping_street: view.shipping_street ?? null,
      shipping_street2: view.shipping_street2 ?? null,
      shipping_city: view.shipping_city ?? null,
      shipping_state: view.shipping_state ?? null,
      shipping_zip: view.shipping_zip ?? null,
      shipping_country_code: view.shipping_country_code ?? null,
      notes: view.notes ?? null,
      terms: view.terms ?? null
    }

    const header = duplicateOrderHeader(source, createEmptyOrderForm().order_date)
    const partnerLabel = partnerOptions.value.find(p => p.value === header.partner_id)?.label
    const projectLabel = projectOptions.value.find(p => p.value === header.project_id)?.label
    const paymentLabel = paymentMethodOptions.value.find(p => p.value === header.payment_method_id)?.label

    formData.value = {
      ...createEmptyOrderForm(),
      ...header,
      partner_name: partnerLabel ?? view.partner_name ?? '',
      project_id: projectLabel ? header.project_id : null,
      project_name: projectLabel ?? '',
      payment_method_id: paymentLabel ? header.payment_method_id : null,
      payment_method_name: paymentLabel ?? '',
      warehouse_id: warehouseOptions.value.some(w => w.value === header.warehouse_id)
        ? header.warehouse_id
        : null
    }

    duplicateCatalog.value = products.map(p => ({
      id: p.id,
      name: (p.display_name?.trim() || p.name || '').trim(),
      status: p.status,
      sale_price: p.sale_price,
      cost_price: p.cost_price,
      tax_rate: p.tax_rate
    }))
    duplicateSourceLines.value = lineRows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      description: r.description,
      quantity: r.quantity,
      unit_price: r.unit_price,
      unit_cost: r.unit_cost,
      discount_percent: r.discount_percent,
      tax_rate: r.tax_rate,
      sequence: r.sequence
    }))
    duplicateSourceName.value = view.name ?? 'orden'
    applyDuplicateLines()
  } finally {
    isLoadingDuplicate.value = false
  }
}

watch(duplicatePriceMode, () => {
  if (duplicateSourceName.value) applyDuplicateLines()
})

watch([selectedCompanyId, duplicateFromId], async () => {
  await loadPartners()
  await loadDuplicateSource()
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

  const linesToSave = orderLines.value.filter(
    line => !!line.description.trim() || !!line.product_name.trim()
  )
  if (linesToSave.length === 0) {
    errorMessage.value = 'Agrega al menos una línea con nombre de producto o descripción.'
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

    for (const line of linesToSave) {
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
    :title="duplicateSourceName ? `Duplicar ${duplicateSourceName}` : 'Nueva Orden'"
    :subtitle="duplicateSourceName ? 'Revisa los datos y guarda: la copia se crea en borrador con folio nuevo.' : undefined"
    :is-editing="true"
    :is-loading="isSaving || isLoadingDuplicate"
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

    <div
      v-if="duplicateSourceName"
      class="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-4 text-indigo-900"
    >
      <p class="font-semibold">
        Copia de {{ duplicateSourceName }}
      </p>
      <p class="mt-1 text-sm text-indigo-800/90">
        Se copiaron el contacto, el almacén, las condiciones y las líneas. La fecha es hoy y no se copian pagos, entregas ni el enlace de cotización.
      </p>
      <fieldset class="mt-3">
        <legend class="text-sm font-medium">
          Precios de las líneas
        </legend>
        <div class="mt-2 flex flex-wrap gap-2">
          <label
            v-for="option in [
              { value: 'original', label: 'Precios de la orden original' },
              { value: 'current', label: 'Precios actuales del catálogo' }
            ]"
            :key="option.value"
            class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition"
            :class="duplicatePriceMode === option.value
              ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm'
              : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-white'"
          >
            <input
              v-model="duplicatePriceMode"
              type="radio"
              name="duplicate-price-mode"
              class="accent-indigo-600"
              :value="option.value"
            >
            {{ option.label }}
          </label>
        </div>
        <p class="mt-2 text-xs text-indigo-800/80">
          Cambiar esta opción vuelve a cargar las líneas copiadas.
        </p>
      </fieldset>
      <p
        v-if="duplicateSkipped.length"
        class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        Se omitieron {{ duplicateSkipped.length }} {{ duplicateSkipped.length === 1 ? 'línea' : 'líneas' }} porque el producto ya no está activo: {{ duplicateSkipped.join(', ') }}.
      </p>
    </div>

    <OrderForm
      v-model="formData"
      v-model:lines="orderLines"
      :partner-options="partnerOptions"
      :project-options="projectOptions"
      :payment-method-options="paymentMethodOptions"
      :warehouse-options="warehouseOptions"
      :company-id="selectedCompanyId"
    />
  </CardSheet>
</template>
