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
    key: 'origin',
    label: 'Origen',
    type: 'badge',
    badgeConfig: {
      labels: {
        dashboard: 'Panel',
        pos: 'POS',
        storefront: 'Tienda en línea'
      },
      colors: {
        dashboard: 'bg-slate-100 text-slate-600',
        pos: 'bg-fuchsia-100 text-fuchsia-700',
        storefront: 'bg-violet-100 text-violet-700'
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
    // `origin` aún no existe en los types generados; llega desde v_orders
    origin: (rowAny['origin'] as string | null) ?? 'dashboard',
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

// ── Stat cards ─────────────────────────────────────────────────────────────────

type StatAccent = 'emerald' | 'rose' | 'amber'

interface OrderStat {
  key: string
  label: string
  value: string
  sublabel: string
  iconPath: string
  accent: StatAccent
  valueClass: string
}

const accentStyles: Record<StatAccent, { icon: string; blob: string }> = {
  emerald: { icon: 'bg-emerald-50 text-emerald-600', blob: 'bg-emerald-400' },
  rose: { icon: 'bg-rose-50 text-rose-600', blob: 'bg-rose-400' },
  amber: { icon: 'bg-amber-50 text-amber-600', blob: 'bg-amber-400' }
}

const ICONS = {
  trendingUp: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
  trendingDown: 'M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181',
  banknotes: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
  alert: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'
} as const

const formatCurrency = (value: number, currency: string): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: 0
  }).format(value || 0)

const normalizeCurrency = (value: unknown): string =>
  (String(value ?? 'MXN').trim().toUpperCase()) || 'MXN'

const primaryCurrency = computed(() => {
  if (selectedCurrencyFilters.value.length === 1) return selectedCurrencyFilters.value[0] ?? 'MXN'
  return availableCurrencies.value[0] ?? 'MXN'
})

const orderMetrics = computed(() => {
  const currency = primaryCurrency.value
  let salesPosted = 0
  let salesPostedCount = 0
  let purchasesPosted = 0
  let purchasesPostedCount = 0
  let receivable = 0
  let receivableCount = 0
  let overdueAmount = 0
  let overdueCount = 0
  let draftCount = 0

  for (const row of orders.value) {
    if (normalizeCurrency(row.currency) !== currency) continue

    const type = row.order_type as 'sale' | 'purchase' | null
    const state = row.order_state as 'draft' | 'posted' | 'cancel' | null
    const pay = (row.payment_status as PaymentStatusValue) ?? 'unpaid'
    const amount = Number(row.amount_total ?? 0)

    if (state === 'draft') draftCount += 1

    if (state === 'posted' && type === 'sale') {
      salesPosted += amount
      salesPostedCount += 1
      if (pay !== 'paid' && pay !== 'condoned') {
        receivable += amount
        receivableCount += 1
      }
      if (pay === 'overdue') {
        overdueAmount += amount
        overdueCount += 1
      }
    }

    if (state === 'posted' && type === 'purchase') {
      purchasesPosted += amount
      purchasesPostedCount += 1
    }
  }

  return {
    currency,
    salesPosted,
    salesPostedCount,
    purchasesPosted,
    purchasesPostedCount,
    receivable,
    receivableCount,
    overdueAmount,
    overdueCount,
    draftCount
  }
})

const orderStats = computed<OrderStat[]>(() => {
  const m = orderMetrics.value
  return [
    {
      key: 'sales',
      label: 'Ventas confirmadas',
      value: formatCurrency(m.salesPosted, m.currency),
      sublabel: `${m.salesPostedCount} órdenes · ${m.draftCount} en borrador`,
      iconPath: ICONS.trendingUp,
      accent: 'emerald',
      valueClass: 'text-slate-900'
    },
    {
      key: 'purchases',
      label: 'Compras confirmadas',
      value: formatCurrency(m.purchasesPosted, m.currency),
      sublabel: `${m.purchasesPostedCount} órdenes en ${m.currency}`,
      iconPath: ICONS.trendingDown,
      accent: 'rose',
      valueClass: 'text-slate-900'
    },
    {
      key: 'receivable',
      label: 'Por cobrar',
      value: formatCurrency(m.receivable, m.currency),
      sublabel: `${m.receivableCount} ventas sin liquidar`,
      iconPath: ICONS.banknotes,
      accent: 'amber',
      valueClass: 'text-slate-900'
    },
    {
      key: 'overdue',
      label: 'Pagos vencidos',
      value: formatCurrency(m.overdueAmount, m.currency),
      sublabel: m.overdueCount > 0
        ? `${m.overdueCount} órdenes por regularizar`
        : 'Sin pagos vencidos',
      iconPath: ICONS.alert,
      accent: m.overdueCount > 0 ? 'rose' : 'emerald',
      valueClass: m.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'
    }
  ]
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

    <div v-else class="space-y-6">
      <!-- Stat cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="isLoadingOrders">
          <div
            v-for="i in 4"
            :key="`order-stat-skeleton-${i}`"
            class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 space-y-3">
                <div class="h-3 w-24 rounded bg-slate-200" />
                <div class="h-7 w-32 rounded bg-slate-200" />
              </div>
              <div class="h-11 w-11 rounded-xl bg-slate-200" />
            </div>
            <div class="mt-4 h-3 w-28 rounded bg-slate-200" />
          </div>
        </template>

        <template v-else>
          <div
            v-for="stat in orderStats"
            :key="stat.key"
            class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"
          >
            <div
              :class="[
                'pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]',
                accentStyles[stat.accent].blob
              ]"
            />

            <div class="relative flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-500">{{ stat.label }}</p>
                <p :class="['mt-2 truncate text-2xl font-bold tracking-tight', stat.valueClass]">
                  {{ stat.value }}
                </p>
              </div>
              <span
                :class="[
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  accentStyles[stat.accent].icon
                ]"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="stat.iconPath" />
                </svg>
              </span>
            </div>

            <p class="relative mt-3 truncate text-xs text-slate-500">{{ stat.sublabel }}</p>
          </div>
        </template>
      </div>

      <div
        v-if="isLoadingOrders"
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
  </div>
</template>
