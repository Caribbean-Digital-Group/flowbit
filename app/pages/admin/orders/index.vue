<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type OrderListRow = Database['public']['Views']['v_orders']['Row']

const paymentStatusValues = ['unpaid', 'partial', 'paid', 'condoned', 'overdue'] as const
type PaymentStatusValue = typeof paymentStatusValues[number]

const paymentStatusConfig = {
  labels: { unpaid: 'No pagado', partial: 'Parcial', paid: 'Pagado', condoned: 'Condonado', overdue: 'Vencido' },
  colors: {
    unpaid:   'bg-slate-100 text-slate-600',
    partial:  'bg-amber-100 text-amber-700',
    paid:     'bg-emerald-100 text-emerald-700',
    condoned: 'bg-indigo-100 text-indigo-700',
    overdue:  'bg-red-100 text-red-700'
  }
}

const columns: Column[] = [
  {
    key: 'name',
    label: 'Orden',
    type: 'avatar',
    subtitleKey: 'partner_name'
  },
  {
    key: 'order_type',
    label: 'Tipo',
    type: 'badge',
    badgeConfig: {
      labels: {
        sale: 'Venta',
        purchase: 'Compra'
      }
    }
  },
  {
    key: 'order_state',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: {
        draft: 'Borrador',
        posted: 'Confirmada',
        cancel: 'Cancelada'
      }
    }
  },
  {
    key: 'payment_status',
    label: 'Pago',
    type: 'badge',
    badgeConfig: paymentStatusConfig
  },
  { key: 'amount_total', label: 'Total', type: 'currency', currencyKey: 'currency' },
  { key: 'order_date', label: 'Fecha', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getOrdersByCompany, cancelOrderById } = useOrder()

const orders = ref<Record<string, unknown>[]>([])
const isLoadingOrders = ref(false)
const selectedTypeFilters = ref<Array<'sale' | 'purchase'>>(['sale', 'purchase'])
const selectedStateFilters = ref<Array<'draft' | 'posted' | 'cancel'>>(['draft', 'posted', 'cancel'])
const selectedFulfillmentFilters = ref<Array<'compliant' | 'invoiced' | 'delivered'>>([])
const selectedPaymentStatusFilters = ref<PaymentStatusValue[]>([...paymentStatusValues])
const selectedCurrencyFilters = ref<string[]>([])

function mapOrderToTableRow(raw: OrderListRow): Record<string, unknown> {
  const rowAny = raw as Record<string, unknown>
  const rawStatus = rowAny['payment_status'] as string | null | undefined
  const paymentStatus: PaymentStatusValue = paymentStatusValues.includes(rawStatus as PaymentStatusValue)
    ? (rawStatus as PaymentStatusValue)
    : ((raw.is_paid ?? false) ? 'paid' : 'unpaid')

  return {
    id: raw.id,
    name: raw.name ?? '—',
    partner_name: raw.partner_name?.trim() || '—',
    order_type: raw.order_type,
    order_state: raw.order_state,
    payment_status: paymentStatus,
    amount_total: raw.amount_total ?? 0,
    currency: raw.currency ?? 'MXN',
    order_date: raw.order_date ?? '',
    is_invoiced: raw.is_invoiced ?? false,
    is_delivered: raw.is_delivered ?? false,
    is_paid: raw.is_paid ?? false
  }
}

const loadOrders = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    orders.value = []
    return
  }

  isLoadingOrders.value = true
  try {
    const list = await getOrdersByCompany(companyId)
    orders.value = list.map(mapOrderToTableRow)
  } finally {
    isLoadingOrders.value = false
  }
}

watch(selectedCompanyId, () => {
  loadOrders()
}, { immediate: true })

const filteredOrders = computed(() => {
  const typeFilters = selectedTypeFilters.value
  const stateFilters = selectedStateFilters.value
  const fulfillmentFilters = selectedFulfillmentFilters.value
  const paymentStatusFilters = selectedPaymentStatusFilters.value
  const currencyFilters = selectedCurrencyFilters.value

  if (typeFilters.length === 0 || stateFilters.length === 0 || paymentStatusFilters.length === 0) return []

  return orders.value.filter((row) => {
    const orderType = row.order_type as 'sale' | 'purchase' | null
    const orderState = row.order_state as 'draft' | 'posted' | 'cancel' | null
    const orderCurrency = (String(row.currency ?? 'MXN').trim().toUpperCase()) || 'MXN'
    const paymentStatus = (row.payment_status as PaymentStatusValue) ?? 'unpaid'
    const isInvoiced = row.is_invoiced === true
    const isDelivered = row.is_delivered === true
    const isCompliant = isInvoiced && isDelivered && paymentStatus === 'paid'

    if (!orderType || !orderState) return false
    if (!typeFilters.includes(orderType)) return false
    if (!stateFilters.includes(orderState)) return false
    if (!paymentStatusFilters.includes(paymentStatus)) return false
    if (currencyFilters.length > 0 && !currencyFilters.includes(orderCurrency)) return false

    if (fulfillmentFilters.includes('compliant') && !isCompliant) return false
    if (fulfillmentFilters.includes('invoiced') && !isInvoiced) return false
    if (fulfillmentFilters.includes('delivered') && !isDelivered) return false

    return true
  })
})

const availableCurrencies = computed(() => {
  const uniqueCurrencies = new Set<string>()
  for (const row of orders.value) {
    const currency = (String(row.currency ?? 'MXN').trim().toUpperCase()) || 'MXN'
    uniqueCurrencies.add(currency)
  }
  return Array.from(uniqueCurrencies).sort()
})

const selectedFiltersLabel = computed(() => {
  const typeCount = selectedTypeFilters.value.length
  const stateCount = selectedStateFilters.value.length
  const paymentCount = selectedPaymentStatusFilters.value.length
  const paymentTotal = paymentStatusValues.length
  const currencyCount = selectedCurrencyFilters.value.length
  const currencyTotal = availableCurrencies.value.length
  const paymentLabel = paymentCount === paymentTotal ? 'todos los pagos' : `${paymentCount} pago(s)`
  const currencyLabel = currencyCount === 0 ? `${currencyTotal} moneda(s)` : `${currencyCount} moneda(s)`

  return `${typeCount} tipo(s) · ${stateCount} estado(s) · ${paymentLabel} · ${currencyLabel}`
})

const toggleTypeFilter = (value: 'sale' | 'purchase') => {
  const current = selectedTypeFilters.value
  selectedTypeFilters.value = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}

const toggleStateFilter = (value: 'draft' | 'posted' | 'cancel') => {
  const current = selectedStateFilters.value
  selectedStateFilters.value = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}

const toggleFulfillmentFilter = (value: 'compliant' | 'invoiced' | 'delivered') => {
  const current = selectedFulfillmentFilters.value
  selectedFulfillmentFilters.value = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}

const togglePaymentStatusFilter = (value: PaymentStatusValue) => {
  const current = selectedPaymentStatusFilters.value
  selectedPaymentStatusFilters.value = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}

const toggleCurrencyFilter = (value: string) => {
  const current = selectedCurrencyFilters.value
  selectedCurrencyFilters.value = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
}

const resetFilters = () => {
  selectedTypeFilters.value = ['sale', 'purchase']
  selectedStateFilters.value = ['draft', 'posted', 'cancel']
  selectedFulfillmentFilters.value = []
  selectedPaymentStatusFilters.value = [...paymentStatusValues]
  selectedCurrencyFilters.value = []
}

const create = () => {
  navigateTo('/admin/orders/create')
}

const edit = (row: Record<string, unknown>) => {
  navigateTo(`/admin/orders/${row.id as string}`)
}

const remove = async (row: Record<string, unknown>) => {
  const ok = await cancelOrderById(row.id as string)
  if (ok) {
    await loadOrders()
  }
}

const deleteMany = async (selected: Record<string, unknown>[]) => {
  for (const row of selected) {
    await cancelOrderById(row.id as string)
  }
  await loadOrders()
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para ver sus órdenes de venta y compra.
      </p>
    </div>

    <div
      v-else-if="isLoadingOrders"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando órdenes…
    </div>

    <Datatable
      v-else
      title="Órdenes"
      description="Órdenes de venta y compra de la empresa seleccionada"
      :data="filteredOrders"
      :columns="columns"
      :search-keys="['name', 'partner_name', 'order_type', 'order_state']"
      :selectable="true"
      :exportable="true"
      :creatable="true"
      create-label="Crear orden"
      export-filename="ordenes"
      @create="create"
    >
      <template #headerActions>
        <div class="flex w-full items-center justify-center sm:w-auto sm:justify-end">
          <details class="relative w-full sm:w-auto">
            <summary
              class="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-56"
            >
              <span>Filtros: {{ selectedFiltersLabel }}</span>
              <svg class="ml-2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div class="absolute right-0 z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:w-72">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tipo de orden
                </p>
                <div class="mt-2 space-y-2">
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedTypeFilters.includes('sale')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleTypeFilter('sale')"
                    >
                    Ventas
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedTypeFilters.includes('purchase')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleTypeFilter('purchase')"
                    >
                    Compras
                  </label>
                </div>
              </div>

              <div class="mt-4 border-t border-slate-100 pt-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </p>
                <div class="mt-2 space-y-2">
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedStateFilters.includes('draft')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleStateFilter('draft')"
                    >
                    Borrador
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedStateFilters.includes('posted')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleStateFilter('posted')"
                    >
                    Confirmada
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedStateFilters.includes('cancel')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleStateFilter('cancel')"
                    >
                    Cancelada
                  </label>
                </div>
              </div>

              <div class="mt-4 border-t border-slate-100 pt-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cumplimiento
                </p>
                <div class="mt-2 space-y-2">
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedFulfillmentFilters.includes('compliant')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleFulfillmentFilter('compliant')"
                    >
                    Cumplimiento total
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedFulfillmentFilters.includes('invoiced')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleFulfillmentFilter('invoiced')"
                    >
                    Facturada
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      :checked="selectedFulfillmentFilters.includes('delivered')"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleFulfillmentFilter('delivered')"
                    >
                    Entregada
                  </label>
                </div>
              </div>

              <div class="mt-4 border-t border-slate-100 pt-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estatus de Pago
                </p>
                <div class="mt-2 space-y-2">
                  <label
                    v-for="status in paymentStatusValues"
                    :key="status"
                    class="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedPaymentStatusFilters.includes(status)"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="togglePaymentStatusFilter(status)"
                    >
                    {{ paymentStatusConfig.labels[status] }}
                  </label>
                </div>
              </div>

              <div class="mt-4 border-t border-slate-100 pt-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Moneda
                </p>
                <div class="mt-2 space-y-2">
                  <label
                    v-for="currency in availableCurrencies"
                    :key="currency"
                    class="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedCurrencyFilters.includes(currency)"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleCurrencyFilter(currency)"
                    >
                    {{ currency }}
                  </label>
                </div>
              </div>

              <button
                type="button"
                class="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                @click="resetFilters"
              >
                Restablecer filtros
              </button>
            </div>
          </details>
        </div>
      </template>

      <template #actions="{ row }">
        <div class="flex items-center justify-center gap-2">
          <BtnApp variant="ghost" size="sm" @click="edit(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </template>
          </BtnApp>
          <BtnApp variant="ghost" size="sm" @click="remove(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </template>
          </BtnApp>
        </div>
      </template>

      <template #bulkActions="{ selected }">
        <BtnDelete @click="deleteMany(selected)" />
      </template>
    </Datatable>
  </div>
</template>
