<script lang="ts">
export interface OrderLine {
  id: string
  sequence: number
  product_id: string
  product_name: string
  description: string
  quantity: number
  quantity_delivered: number
  quantity_invoiced: number
  unit_price: number
  unit_cost: number
  discount_percent: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  subtotal: number
  total: number
  margin: number
  margin_percent: number
}

export interface OrderFormData {
  name: string
  order_type: 'sale' | 'purchase'
  reference: string
  order_state: 'draft' | 'posted' | 'cancel'
  partner_id: string | null
  partner_name: string
  created_by_partner_id: string | null
  created_by_partner_name: string
  order_date: string
  confirmation_date: string | null
  delivery_date: string
  currency: string
  exchange_rate: number
  tax_rate: number
  tax_included: boolean
  amount_untaxed: number
  amount_tax: number
  amount_total: number
  amount_discount: number
  payment_term: string
  payment_due_date: string
  shipping_street: string
  shipping_street2: string
  shipping_city: string
  shipping_state: string
  shipping_zip: string
  shipping_country_code: string
  notes: string
  terms: string
  is_invoiced: boolean
  is_delivered: boolean
  is_paid: boolean
}

export const createEmptyOrderForm = (): OrderFormData => ({
  name: '',
  order_type: 'sale',
  reference: '',
  order_state: 'draft',
  partner_id: null,
  partner_name: '',
  created_by_partner_id: null,
  created_by_partner_name: '',
  order_date: new Date().toISOString().split('T')[0] || '',
  confirmation_date: null,
  delivery_date: '',
  currency: 'MXN',
  exchange_rate: 1.000000,
  tax_rate: 16.00,
  tax_included: false,
  amount_untaxed: 0,
  amount_tax: 0,
  amount_total: 0,
  amount_discount: 0,
  payment_term: '',
  payment_due_date: '',
  shipping_street: '',
  shipping_street2: '',
  shipping_city: '',
  shipping_state: '',
  shipping_zip: '',
  shipping_country_code: 'MX',
  notes: '',
  terms: '',
  is_invoiced: false,
  is_delivered: false,
  is_paid: false
})

export const createEmptyOrderLine = (): OrderLine => ({
  id: crypto.randomUUID(),
  sequence: 10,
  product_id: '',
  product_name: '',
  description: '',
  quantity: 1,
  quantity_delivered: 0,
  quantity_invoiced: 0,
  unit_price: 0,
  unit_cost: 0,
  discount_percent: 0,
  discount_amount: 0,
  tax_rate: 16.00,
  tax_amount: 0,
  subtotal: 0,
  total: 0,
  margin: 0,
  margin_percent: 0
})
</script>

<script setup lang="ts">
import { createEmptyOrderLineForm, type OrderLineFormData } from '~/components/OrderLine/Form.vue'

interface Props {
  readonly?: boolean
  partnerOptions?: { value: string; label: string }[]
  /** Permite catálogo, autocompletado y alta de productos al guardar la línea. */
  companyId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  partnerOptions: () => [],
  companyId: null
})

const orderTypeOptions = [
  { value: 'sale', label: 'Venta' },
  { value: 'purchase', label: 'Compra' }
]

const partnerSelectModel = computed({
  get: () => formData.value.partner_id ?? '',
  set: (v: string) => {
    formData.value.partner_id = v ? v : null
    const opt = props.partnerOptions.find(o => o.value === v)
    if (opt) formData.value.partner_name = opt.label
  }
})

const formData = defineModel<OrderFormData>({ required: true })
const lines = defineModel<OrderLine[]>('lines', { default: () => [] })

const { ensureCatalogProductFromOrderLine } = useProduct()

const activeTab = ref('other_info')

const tabs = [
  { id: 'other_info', label: 'Otra Información', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'shipping', label: 'Envío', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { id: 'notes', label: 'Notas', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
]

const currencyOptions = [
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'USD', label: 'USD - Dólar Americano' },
  { value: 'EUR', label: 'EUR - Euro' }
]

const isEditing = computed(() => !props.readonly)

// Slide-over state for line form
const showLinePanel = ref(false)
const editingLineId = ref<string | null>(null)
const lineFormData = ref<OrderLineFormData>(createEmptyOrderLineForm())
const linePanelKey = ref(0)
const lineFormError = ref<string | null>(null)

const linePanelTitle = computed(() =>
  editingLineId.value ? 'Editar Línea' : 'Agregar Línea'
)

const openAddLine = () => {
  linePanelKey.value += 1
  lineFormError.value = null
  editingLineId.value = null
  lineFormData.value = createEmptyOrderLineForm(formData.value.tax_rate)
  showLinePanel.value = true
}

const openEditLine = (lineId: string) => {
  const line = lines.value.find(l => l.id === lineId)
  if (!line) return

  linePanelKey.value += 1
  lineFormError.value = null
  editingLineId.value = lineId
  lineFormData.value = {
    product_id: line.product_id,
    product_name: line.product_name,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    unit_cost: line.unit_cost,
    discount_percent: line.discount_percent,
    tax_rate: line.tax_rate
  }
  showLinePanel.value = true
}

const calculateLineFields = (data: OrderLineFormData) => {
  const discountAmount = Math.round(data.quantity * data.unit_price * data.discount_percent / 100 * 100) / 100
  const subtotal = Math.round((data.quantity * data.unit_price - discountAmount) * 100) / 100
  const taxAmount = Math.round(subtotal * data.tax_rate / 100 * 100) / 100
  const total = Math.round((subtotal + taxAmount) * 100) / 100
  const marginVal = Math.round((subtotal - data.quantity * data.unit_cost) * 100) / 100
  const marginPct = subtotal > 0 ? Math.round(marginVal / subtotal * 100 * 100) / 100 : 0

  return {
    product_id: data.product_id,
    product_name: data.product_name,
    description: data.description,
    quantity: data.quantity,
    unit_price: data.unit_price,
    unit_cost: data.unit_cost,
    discount_percent: data.discount_percent,
    discount_amount: discountAmount,
    tax_rate: data.tax_rate,
    tax_amount: taxAmount,
    subtotal,
    total,
    margin: marginVal,
    margin_percent: marginPct
  }
}

const recalculateOrderTotals = () => {
  formData.value.amount_untaxed = lines.value.reduce((sum, l) => sum + l.subtotal, 0)
  formData.value.amount_tax = lines.value.reduce((sum, l) => sum + l.tax_amount, 0)
  formData.value.amount_total = lines.value.reduce((sum, l) => sum + l.total, 0)
  formData.value.amount_discount = lines.value.reduce((sum, l) => sum + l.discount_amount, 0)
}

const saveLine = async () => {
  lineFormError.value = null

  const nameOrDesc =
    lineFormData.value.product_name.trim() || lineFormData.value.description.trim()
  if (!nameOrDesc) return

  let draft: OrderLineFormData = { ...lineFormData.value }

  if (!draft.product_id.trim()) {
    const cid = props.companyId?.trim()
    if (!cid) {
      lineFormError.value =
        'Selecciona una empresa en el panel superior para crear el producto en el catálogo.'
      return
    }

    const lineName =
      draft.product_name.trim() || draft.description.trim()
    const created = await ensureCatalogProductFromOrderLine(cid, {
      orderType: formData.value.order_type,
      orderCurrency: formData.value.currency,
      lineName,
      unitPrice: draft.unit_price,
      unitCost: draft.unit_cost,
      defaultTaxRate: formData.value.tax_rate
    })

    if (!created) {
      lineFormError.value =
        'No se pudo crear el producto en el catálogo. Revisa permisos o los datos de la línea.'
      return
    }

    draft = {
      ...draft,
      product_id: created.id,
      product_name: (created.display_name ?? created.name).trim() || draft.product_name
    }
    lineFormData.value = draft
  }

  const calculated = calculateLineFields(draft)

  if (editingLineId.value) {
    const idx = lines.value.findIndex(l => l.id === editingLineId.value)
    if (idx !== -1) {
      const existing = lines.value[idx]!
      lines.value[idx] = {
        id: existing.id,
        sequence: existing.sequence,
        quantity_delivered: existing.quantity_delivered,
        quantity_invoiced: existing.quantity_invoiced,
        ...calculated
      }
    }
  } else {
    const maxSequence = lines.value.length > 0
      ? Math.max(...lines.value.map(l => l.sequence))
      : 0

    lines.value.push({
      id: crypto.randomUUID(),
      sequence: maxSequence + 10,
      quantity_delivered: 0,
      quantity_invoiced: 0,
      ...calculated
    })
  }

  recalculateOrderTotals()
  showLinePanel.value = false
}

const cancelLineForm = () => {
  lineFormError.value = null
  showLinePanel.value = false
}

const removeLine = (lineId: string) => {
  lines.value = lines.value.filter(l => l.id !== lineId)
  recalculateOrderTotals()
}

const totalMargin = computed(() => {
  return lines.value.reduce((sum, line) => sum + line.margin, 0)
})

const totalMarginPercent = computed(() => {
  if (formData.value.amount_untaxed > 0) {
    return ((totalMargin.value / formData.value.amount_untaxed) * 100).toFixed(2)
  }
  return '0.00'
})

const totalQuantity = computed(() => {
  return lines.value.reduce((sum, line) => sum + line.quantity, 0)
})

const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: formData.value.currency
  }).format(value)
}
</script>

<template>
  <div class="space-y-0">
    <!-- HEADER: Información principal de la orden -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
      <div class="lg:col-span-2">
        <FormSelect
          v-if="partnerOptions.length > 0 && isEditing"
          v-model="partnerSelectModel"
          :label="formData.order_type === 'sale' ? 'Cliente' : 'Proveedor'"
          :options="partnerOptions"
          :readonly="readonly"
          placeholder="Selecciona…"
          required
          size="md"
        />
        <FormInput
          v-else
          v-model="formData.partner_name"
          :label="formData.order_type === 'sale' ? 'Cliente' : 'Proveedor'"
          placeholder="Seleccionar cliente o proveedor…"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="formData.order_type"
          label="Tipo"
          :options="orderTypeOptions"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.order_date"
          type="date"
          label="Fecha de Orden"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.delivery_date"
          type="date"
          label="Fecha de Entrega"
          :readonly="readonly"
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.reference"
          label="Referencia"
          placeholder="Ref. externa"
          :readonly="readonly"
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="formData.currency"
          label="Moneda"
          :options="currencyOptions"
          :readonly="readonly"
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.payment_term"
          label="Términos de Pago"
          placeholder="Ej: 30 días neto"
          :readonly="readonly"
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.payment_due_date"
          type="date"
          label="Vencimiento de Pago"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <!-- LÍNEAS DE LA ORDEN -->
    <div class="border-t border-slate-200 pt-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-slate-800">Líneas de la Orden</h3>
        <BtnApp
          v-if="isEditing"
          label="Agregar Línea"
          variant="primary"
          size="sm"
          @click="openAddLine"
        />
      </div>

      <div class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Producto
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                Cantidad
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-32">
                Precio Unit.
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                Dto. %
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                IVA %
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-36">
                Subtotal
              </th>
              <th v-if="isEditing" class="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-200">
            <tr v-for="line in lines" :key="line.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3">
                <div class="text-sm font-medium text-slate-900">{{ line.product_name }}</div>
                <div class="text-xs text-slate-500">{{ line.description }}</div>
              </td>
              <td class="px-4 py-3 text-right text-sm text-slate-900 font-medium">
                {{ line.quantity }}
              </td>
              <td class="px-4 py-3 text-right text-sm text-slate-900">
                {{ formatCurrency(line.unit_price) }}
              </td>
              <td class="px-4 py-3 text-right text-sm text-slate-900">
                <span v-if="line.discount_percent > 0" class="text-red-600">{{ line.discount_percent }}%</span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td class="px-4 py-3 text-right text-sm text-slate-900">
                {{ line.tax_rate }}%
              </td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                {{ formatCurrency(line.subtotal) }}
              </td>
              <td v-if="isEditing" class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button
                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title="Editar"
                    @click="openEditLine(line.id)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar"
                    @click="removeLine(line.id)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="lines.length === 0">
              <td :colspan="isEditing ? 7 : 6" class="px-4 py-8 text-center text-slate-500">
                <div class="flex flex-col items-center gap-2">
                  <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span class="text-sm">No hay líneas en esta orden</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Resumen de totales -->
      <div class="flex justify-end mt-4">
        <div class="w-full max-w-sm bg-slate-50 rounded-lg p-4 space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-slate-600">Subtotal:</span>
            <span class="font-medium text-slate-800">{{ formatCurrency(formData.amount_untaxed) }}</span>
          </div>
          <div v-if="formData.amount_discount > 0" class="flex justify-between text-sm">
            <span class="text-slate-600">Descuento:</span>
            <span class="font-medium text-red-600">-{{ formatCurrency(formData.amount_discount) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-slate-600">Impuestos:</span>
            <span class="font-medium text-slate-800">{{ formatCurrency(formData.amount_tax) }}</span>
          </div>
          <div class="border-t border-slate-200 pt-2 flex justify-between">
            <span class="text-base font-semibold text-slate-800">Total:</span>
            <span class="text-base font-bold text-indigo-600">{{ formatCurrency(formData.amount_total) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- TABS ADICIONALES -->
    <div class="border-t border-slate-200 pt-6 mt-6">
      <div class="border-b border-slate-200">
        <nav class="flex gap-1" aria-label="Tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg"
            :class="[
              activeTab === tab.id
                ? 'text-indigo-600 bg-white border border-slate-200 border-b-white -mb-px'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            ]"
            @click="activeTab = tab.id"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
            </svg>
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <div class="pt-6">
        <!-- TAB: Otra Información -->
        <div v-show="activeTab === 'other_info'" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Configuración Fiscal
              </h4>
              <div class="space-y-4 bg-slate-50 rounded-lg p-4">
                <FormInput
                  v-model="formData.tax_rate"
                  type="number"
                  label="Tasa de Impuesto (%)"
                  placeholder="16.00"
                  :readonly="readonly"
                  size="md"
                />
                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="formData.tax_included"
                      type="checkbox"
                      :disabled="readonly"
                      class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span class="text-sm text-slate-700">Impuesto incluido</span>
                  </label>
                </div>
                <FormInput
                  v-model="formData.exchange_rate"
                  type="number"
                  label="Tipo de Cambio"
                  placeholder="1.000000"
                  :readonly="readonly"
                  size="md"
                />
              </div>
            </div>

            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Estado de Cumplimiento
              </h4>
              <div class="space-y-3 bg-slate-50 rounded-lg p-4">
                <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <input
                    v-model="formData.is_invoiced"
                    type="checkbox"
                    :disabled="readonly"
                    class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span class="text-sm text-slate-700">Facturada</span>
                  </div>
                </label>

                <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <input
                    v-model="formData.is_delivered"
                    type="checkbox"
                    :disabled="readonly"
                    class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <span class="text-sm text-slate-700">Entregada</span>
                  </div>
                </label>

                <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <input
                    v-model="formData.is_paid"
                    type="checkbox"
                    :disabled="readonly"
                    class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span class="text-sm text-slate-700">Pagada</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Métricas
              </h4>
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-green-50 rounded-lg p-3 text-center">
                  <p class="text-lg font-bold text-green-600">{{ formatCurrency(totalMargin) }}</p>
                  <p class="text-xs text-green-700">Margen</p>
                </div>
                <div class="bg-green-50 rounded-lg p-3 text-center">
                  <p class="text-lg font-bold text-green-600">{{ totalMarginPercent }}%</p>
                  <p class="text-xs text-green-700">% Margen</p>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 text-center">
                  <p class="text-lg font-bold text-blue-600">{{ totalQuantity }}</p>
                  <p class="text-xs text-blue-700">Unidades</p>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 text-center">
                  <p class="text-lg font-bold text-blue-600">{{ lines.length }}</p>
                  <p class="text-xs text-blue-700">Líneas</p>
                </div>
              </div>
            </div>
          </div>

          <div v-if="formData.confirmation_date" class="pt-4 border-t border-slate-100">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="flex items-center gap-3 text-sm">
                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span class="text-slate-500">Confirmada el:</span>
                  <span class="ml-2 font-medium text-slate-700">{{ formatShortDate(formData.confirmation_date) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: Envío -->
        <div v-show="activeTab === 'shipping'" class="space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Dirección de Envío
              </h4>

              <div class="space-y-4 bg-slate-50 rounded-lg p-4">
                <FormInput
                  v-model="formData.shipping_street"
                  label="Calle"
                  placeholder="Dirección principal"
                  :readonly="readonly"
                  size="md"
                />

                <FormInput
                  v-model="formData.shipping_street2"
                  label="Calle 2"
                  placeholder="Departamento, piso, oficina, etc."
                  :readonly="readonly"
                  size="md"
                />

                <div class="grid grid-cols-2 gap-4">
                  <FormInput
                    v-model="formData.shipping_city"
                    label="Ciudad"
                    placeholder="Ciudad"
                    :readonly="readonly"
                    size="md"
                  />

                  <FormInput
                    v-model="formData.shipping_state"
                    label="Estado/Provincia"
                    placeholder="Estado"
                    :readonly="readonly"
                    size="md"
                  />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <FormInput
                    v-model="formData.shipping_zip"
                    label="Código Postal"
                    placeholder="CP"
                    :readonly="readonly"
                    size="md"
                  />

                  <FormInput
                    v-model="formData.shipping_country_code"
                    label="País"
                    placeholder="MX"
                    :readonly="readonly"
                    size="md"
                  />
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Vista Previa
              </h4>
              <div class="bg-white border border-slate-200 rounded-lg p-6">
                <div class="flex items-start gap-4">
                  <div class="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-slate-900">{{ formData.partner_name }}</p>
                    <div class="mt-2 text-sm text-slate-600 space-y-0.5">
                      <p v-if="formData.shipping_street">{{ formData.shipping_street }}</p>
                      <p v-if="formData.shipping_street2">{{ formData.shipping_street2 }}</p>
                      <p v-if="formData.shipping_city || formData.shipping_state || formData.shipping_zip">
                        {{ [formData.shipping_city, formData.shipping_state, formData.shipping_zip].filter(Boolean).join(', ') }}
                      </p>
                      <p v-if="formData.shipping_country_code" class="font-medium">{{ formData.shipping_country_code }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-amber-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-amber-800">Fecha de entrega estimada</p>
                    <p class="text-sm text-amber-700 mt-1">{{ formatShortDate(formData.delivery_date) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: Notas -->
        <div v-show="activeTab === 'notes'" class="space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Notas Internas
              </h4>
              <div class="bg-slate-50 rounded-lg p-4">
                <textarea
                  v-model="formData.notes"
                  :readonly="readonly"
                  rows="6"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  :class="{ 'bg-white': isEditing, 'bg-slate-100 cursor-default': !isEditing }"
                  placeholder="Notas internas sobre la orden (no visibles para el cliente)..."
                />
                <p class="mt-2 text-xs text-slate-500">
                  Estas notas son solo para uso interno y no se mostrarán al cliente.
                </p>
              </div>
            </div>

            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Términos y Condiciones
              </h4>
              <div class="bg-slate-50 rounded-lg p-4">
                <textarea
                  v-model="formData.terms"
                  :readonly="readonly"
                  rows="6"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  :class="{ 'bg-white': isEditing, 'bg-slate-100 cursor-default': !isEditing }"
                  placeholder="Términos y condiciones de la orden..."
                />
                <p class="mt-2 text-xs text-slate-500">
                  Estos términos se mostrarán en los documentos impresos de la orden.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Slide-over Panel: OrderLine Form -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showLinePanel" class="fixed inset-0 z-50 overflow-hidden">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="cancelLineForm" />

          <Transition
            enter-active-class="transition duration-300 ease-out transform"
            enter-from-class="translate-x-full"
            enter-to-class="translate-x-0"
            leave-active-class="transition duration-200 ease-in transform"
            leave-from-class="translate-x-0"
            leave-to-class="translate-x-full"
          >
            <div
              v-if="showLinePanel"
              class="absolute right-0 inset-y-0 w-full max-w-lg flex flex-col bg-white shadow-2xl"
            >
              <!-- Header -->
              <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50">
                <div>
                  <h3 class="text-lg font-semibold text-slate-800">{{ linePanelTitle }}</h3>
                  <p class="text-sm text-slate-500">
                    {{ editingLineId ? 'Modifica los datos de la línea' : 'Completa los datos para agregar una línea' }}
                  </p>
                </div>
                <button
                  class="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-lg transition-colors"
                  @click="cancelLineForm"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Body -->
              <div class="flex-1 overflow-y-auto px-6 py-6">
                <p v-if="lineFormError" class="mb-4 text-sm text-red-600">
                  {{ lineFormError }}
                </p>
                <OrderLineForm
                  :key="linePanelKey"
                  v-model="lineFormData"
                  :currency="formData.currency"
                  :company-id="companyId"
                  :order-type="formData.order_type"
                  :catalog-tax-fallback="formData.tax_rate"
                />
              </div>

              <!-- Footer -->
              <div class="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-slate-50">
                <BtnApp
                  label="Cancelar"
                  variant="secondary"
                  size="sm"
                  @click="cancelLineForm"
                />
                <BtnApp
                  :label="editingLineId ? 'Actualizar' : 'Agregar'"
                  variant="primary"
                  size="sm"
                  @click="saveLine"
                />
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
