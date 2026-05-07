<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StatItem } from '~/components/StatGrid.vue'
import type { Database, Tables } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type OrderRow = Database['public']['Views']['v_orders']['Row']
type OrderLineRow = Database['public']['Views']['v_order_lines']['Row']
type PartnerRow = Tables<'partner'>
type ProductRow = Tables<'product'>

interface CurrencyMetrics {
  currency: string
  saleDraft: number
  salePosted: number
  purchaseDraft: number
  purchasePosted: number
  saleDraftCount: number
  salePostedCount: number
  purchaseDraftCount: number
  purchasePostedCount: number
}

interface ActivityItem {
  id: string
  typeLabel: string
  title: string
  detail: string
  dateIso: string | null
  href: string
}

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getPartnersByCompany } = usePartner()
const { getProductsByCompany } = useProduct()
const { getOrdersByCompany } = useOrder()
const { getOrderLinesByCompany } = useOrderLine()

const isLoading = ref(false)
const partners = ref<PartnerRow[]>([])
const products = ref<ProductRow[]>([])
const orders = ref<OrderRow[]>([])
const orderLines = ref<OrderLineRow[]>([])

const normalizeCurrency = (value: string | null | undefined): string =>
  value?.trim().toUpperCase() || 'MXN'

const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

const formatDateTime = (iso: string | null): string => {
  if (!iso) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))
}

const activePartnersCount = computed(() =>
  partners.value.filter((partner) => partner.active !== false).length
)

const activeProductsCount = computed(() => {
  let count = 0
  for (const product of products.value) {
    if (product.status === 'active') count += 1
  }
  return count
})

const draftOrdersCount = computed(() =>
  orders.value.filter((order) => order.order_state === 'draft').length
)

const postedOrdersCount = computed(() =>
  orders.value.filter((order) => order.order_state === 'posted').length
)

const activeCurrencies = computed(() => {
  const currencies = new Set<string>()

  for (const order of orders.value) {
    currencies.add(normalizeCurrency(order.currency))
  }

  return Array.from(currencies).sort()
})

const stats = computed<StatItem[]>(() => [
  {
    label: 'Partners activos',
    value: activePartnersCount.value
  },
  {
    label: 'Productos activos',
    value: activeProductsCount.value
  },
  {
    label: 'Órdenes borrador',
    value: draftOrdersCount.value
  },
  {
    label: 'Órdenes confirmadas',
    value: postedOrdersCount.value
  }
])

const metricsByCurrency = computed<CurrencyMetrics[]>(() => {
  const summary = new Map<string, CurrencyMetrics>()

  const ensureCurrencyBucket = (currency: string): CurrencyMetrics => {
    const current = summary.get(currency)
    if (current) return current

    const initial: CurrencyMetrics = {
      currency,
      saleDraft: 0,
      salePosted: 0,
      purchaseDraft: 0,
      purchasePosted: 0,
      saleDraftCount: 0,
      salePostedCount: 0,
      purchaseDraftCount: 0,
      purchasePostedCount: 0
    }
    summary.set(currency, initial)
    return initial
  }

  for (const order of orders.value) {
    if (!order.order_type || !order.order_state) continue
    if (order.order_state !== 'draft' && order.order_state !== 'posted') continue

    const amount = order.amount_total ?? 0
    const bucket = ensureCurrencyBucket(normalizeCurrency(order.currency))

    if (order.order_type === 'sale' && order.order_state === 'draft') {
      bucket.saleDraft += amount
      bucket.saleDraftCount += 1
      continue
    }

    if (order.order_type === 'sale' && order.order_state === 'posted') {
      bucket.salePosted += amount
      bucket.salePostedCount += 1
      continue
    }

    if (order.order_type === 'purchase' && order.order_state === 'draft') {
      bucket.purchaseDraft += amount
      bucket.purchaseDraftCount += 1
      continue
    }

    if (order.order_type === 'purchase' && order.order_state === 'posted') {
      bucket.purchasePosted += amount
      bucket.purchasePostedCount += 1
    }
  }

  return Array.from(summary.values()).sort((a, b) => a.currency.localeCompare(b.currency))
})

const recentActivity = computed<ActivityItem[]>(() => {
  const events: ActivityItem[] = []

  for (const order of orders.value.slice(0, 8)) {
    events.push({
      id: `order-${order.id}`,
      typeLabel: order.order_type === 'sale' ? 'Venta' : 'Compra',
      title: order.name || 'Orden sin nombre',
      detail: `${order.order_state === 'posted' ? 'Confirmada' : order.order_state === 'draft' ? 'Borrador' : 'Cancelada'} • ${normalizeCurrency(order.currency)} ${formatCurrency(order.amount_total ?? 0, normalizeCurrency(order.currency))}`,
      dateIso: order.order_date ?? order.created_at,
      href: order.id ? `/admin/orders/${order.id}` : '/admin/orders'
    })
  }

  for (const line of orderLines.value.slice(0, 5)) {
    events.push({
      id: `order-line-${line.id}`,
      typeLabel: 'Línea',
      title: line.description?.trim() || line.product_name?.trim() || 'Línea de orden',
      detail: `${line.order_name || 'Orden'} • ${formatCurrency(line.total ?? 0, normalizeCurrency(line.currency))}`,
      dateIso: line.created_at,
      href: line.order_id ? `/admin/orders/${line.order_id}` : '/admin/order-lines'
    })
  }

  for (const partner of partners.value.slice(0, 5)) {
    events.push({
      id: `partner-${partner.id}`,
      typeLabel: 'Partner',
      title: partner.display_name?.trim() || partner.name,
      detail: partner.active === false ? 'Inactivo' : 'Activo',
      dateIso: partner.created_at,
      href: `/admin/partners/${partner.id}`
    })
  }

  for (const product of products.value.slice(0, 5)) {
    events.push({
      id: `product-${product.id}`,
      typeLabel: 'Producto',
      title: product.display_name?.trim() || product.name,
      detail: product.status === 'active' ? 'Activo' : 'No activo',
      dateIso: product.created_at,
      href: `/admin/products/${product.id}`
    })
  }

  return events
    .filter((event) => Boolean(event.dateIso))
    .sort((a, b) => {
      const aTime = a.dateIso ? new Date(a.dateIso).getTime() : 0
      const bTime = b.dateIso ? new Date(b.dateIso).getTime() : 0
      return bTime - aTime
    })
    .slice(0, 10)
})

const loadDashboard = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    partners.value = []
    products.value = []
    orders.value = []
    orderLines.value = []
    return
  }

  isLoading.value = true
  try {
    const [partnerList, productList, orderList, lineList] = await Promise.all([
      getPartnersByCompany(companyId),
      getProductsByCompany(companyId),
      getOrdersByCompany(companyId),
      getOrderLinesByCompany(companyId)
    ])

    partners.value = partnerList
    products.value = productList
    orders.value = orderList
    orderLines.value = lineList
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => {
  loadDashboard()
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p class="mt-1 text-sm text-slate-500">
        Métricas de partners, productos y operaciones de compra/venta de la empresa seleccionada.
      </p>
    </div>

    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para visualizar el dashboard con sus métricas.
      </p>
    </div>

    <template v-else>
      <StatGrid :stats="stats" :columns="4" :loading="isLoading" />

      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              Resumen financiero por moneda
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Ingresos y gastos segmentados por estado de orden (borrador y confirmada).
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium text-slate-500">Monedas activas:</span>
            <span
              v-for="currency in activeCurrencies"
              :key="currency"
              class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
            >
              {{ currency }}
            </span>
          </div>
        </div>

        <div v-if="isLoading" class="mt-6 text-sm text-slate-500">
          Cargando resumen financiero…
        </div>

        <div
          v-else-if="metricsByCurrency.length === 0"
          class="mt-6 rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
        >
          No hay órdenes para calcular métricas financieras.
        </div>

        <div v-else class="mt-6 overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">Moneda</th>
                <th class="px-4 py-3">Ingresos borrador</th>
                <th class="px-4 py-3">Ingresos confirmados</th>
                <th class="px-4 py-3">Gastos borrador</th>
                <th class="px-4 py-3">Gastos confirmados</th>
                <th class="px-4 py-3">Balance confirmado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm text-slate-700">
              <tr
                v-for="currencyMetric in metricsByCurrency"
                :key="currencyMetric.currency"
                class="hover:bg-slate-50/60"
              >
                <td class="px-4 py-3 font-semibold text-slate-900">
                  {{ currencyMetric.currency }}
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-amber-700">
                    {{ formatCurrency(currencyMetric.saleDraft, currencyMetric.currency) }}
                  </div>
                  <div class="text-xs text-slate-500">
                    {{ currencyMetric.saleDraftCount }} órdenes
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-emerald-700">
                    {{ formatCurrency(currencyMetric.salePosted, currencyMetric.currency) }}
                  </div>
                  <div class="text-xs text-slate-500">
                    {{ currencyMetric.salePostedCount }} órdenes
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-amber-700">
                    {{ formatCurrency(currencyMetric.purchaseDraft, currencyMetric.currency) }}
                  </div>
                  <div class="text-xs text-slate-500">
                    {{ currencyMetric.purchaseDraftCount }} órdenes
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-rose-700">
                    {{ formatCurrency(currencyMetric.purchasePosted, currencyMetric.currency) }}
                  </div>
                  <div class="text-xs text-slate-500">
                    {{ currencyMetric.purchasePostedCount }} órdenes
                  </div>
                </td>
                <td class="px-4 py-3 font-semibold">
                  <span
                    :class="currencyMetric.salePosted - currencyMetric.purchasePosted >= 0 ? 'text-emerald-700' : 'text-red-700'"
                  >
                    {{ formatCurrency(currencyMetric.salePosted - currencyMetric.purchasePosted, currencyMetric.currency) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-semibold text-slate-900">
          Actividad reciente
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          Últimos movimientos en órdenes, líneas, partners y productos.
        </p>

        <div v-if="isLoading" class="mt-6 text-sm text-slate-500">
          Cargando actividad reciente…
        </div>

        <div
          v-else-if="recentActivity.length === 0"
          class="mt-6 rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
        >
          No hay actividad reciente para mostrar.
        </div>

        <div v-else class="mt-6 space-y-3">
          <NuxtLink
            v-for="item in recentActivity"
            :key="item.id"
            :to="item.href"
            class="flex items-start justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {{ item.typeLabel }}
                </span>
                <p class="text-sm font-semibold text-slate-900">{{ item.title }}</p>
              </div>
              <p class="mt-1 text-sm text-slate-600">{{ item.detail }}</p>
            </div>
            <span class="text-xs font-medium text-slate-500">
              {{ formatDateTime(item.dateIso) }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>