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

type ProjectViewRow = Database['public']['Views']['v_projects']['Row']
type PickingViewRow = Database['public']['Views']['v_pickings']['Row']
type ApprovalRequestViewRow = Database['public']['Views']['v_approval_requests']['Row']
type ProjectTaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type ApprovalRequestStatus = Database['public']['Enums']['approval_request_status']
type PickingStatus = Database['public']['Enums']['picking_status']
type PickingType = Database['public']['Enums']['picking_type']
type ProjectTaskStatusEnum = Database['public']['Enums']['project_task_status']
type ProjectStatusEnum = Database['public']['Enums']['project_status']

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getPartnersByCompany } = usePartner()
const { getProductsByCompany } = useProduct()
const { getOrdersByCompany } = useOrder()
const { getOrderLinesByCompany } = useOrderLine()
const { getProjectsByCompany } = useProject()
const { getPickingsByCompany } = usePicking()
const { getRequestsByCompany } = useApprovalRequest()
const { getTasksByCompany } = useProjectTask()

const isLoading = ref(false)
const partners = ref<PartnerRow[]>([])
const products = ref<ProductRow[]>([])
const orders = ref<OrderRow[]>([])
const orderLines = ref<OrderLineRow[]>([])
const projects = ref<ProjectViewRow[]>([])
const pickings = ref<PickingViewRow[]>([])
const approvalRequests = ref<ApprovalRequestViewRow[]>([])
const projectTasks = ref<ProjectTaskViewRow[]>([])

const publicProjects = computed(() =>
  projects.value.filter(
    (p) => Boolean((p as ProjectViewRow & { is_public?: boolean | null }).is_public)
  )
)

const openPublicProjectView = (projectId: string | null) => {
  if (!projectId) return
  if (typeof window === 'undefined') return
  window.open(`${window.location.origin}/public/projects/${projectId}`, '_blank', 'noopener,noreferrer')
}

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

const approvalRequestStatusLabels: Record<ApprovalRequestStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
}

const pickingStatusLabels: Record<PickingStatus, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado'
}

const pickingTypeLabels: Record<PickingType, string> = {
  entrada: 'Entrada',
  salida: 'Salida'
}

const projectTaskStatusLabels: Record<ProjectTaskStatusEnum, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada'
}

const projectStatusLabels: Record<ProjectStatusEnum, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completado',
  paused: 'Pausado',
  cancelled: 'Cancelado'
}

const formatApprovalDetail = (request: ApprovalRequestViewRow): string => {
  const rawStatus = request.status
  const statusLabel = rawStatus
    ? approvalRequestStatusLabels[rawStatus]
    : 'Sin estado'

  const cur = normalizeCurrency(request.currency ?? null)
  const amountNum = Number(request.amount ?? 0)

  let amountPart = ''
  if ((request.amount ?? null) !== null && !Number.isNaN(amountNum)) {
    amountPart = ` • ${formatCurrency(amountNum, cur)}`
  }

  const refPart = request.reference?.trim()
    ? ` • Ref. ${request.reference.trim()}`
    : ''

  const partnerPart = request.requesting_partner_display?.trim()
    ? ` • ${request.requesting_partner_display.trim()}`
    : ''

  const categoryPart = request.category_name?.trim()
    ? ` • ${request.category_name.trim()}`
    : ''

  return `${statusLabel}${partnerPart}${categoryPart}${amountPart}${refPart}`
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

// ── Chart ────────────────────────────────────────────────────────────────────

interface ChartBar {
  label: string
  income: number
  expense: number
  incomeCount: number
  expenseCount: number
}

const chartFilter = ref(12)
const chartCurrency = ref('')

watch(
  activeCurrencies,
  (currencies) => {
    if (currencies.length > 0 && !currencies.includes(chartCurrency.value)) {
      chartCurrency.value = currencies[0] ?? ''
    }
  },
  { immediate: true }
)

const chartData = computed<ChartBar[]>(() => {
  const now = new Date()
  const months: (ChartBar & { key: string })[] = []

  for (let i = chartFilter.value - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthStr = d.toLocaleDateString('es-MX', { month: 'short' }).replace(/\./g, '').slice(0, 3).toUpperCase()
    const yearStr = String(d.getFullYear()).slice(2)
    months.push({ key, label: `${monthStr} ${yearStr}`, income: 0, expense: 0, incomeCount: 0, expenseCount: 0 })
  }

  const monthMap = new Map(months.map((m) => [m.key, m]))
  const currency = chartCurrency.value

  for (const order of orders.value) {
    if (order.order_state !== 'posted') continue
    if (!currency || normalizeCurrency(order.currency) !== currency) continue

    const dateStr = order.order_date ?? order.created_at
    if (!dateStr) continue

    const d = new Date(dateStr)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = monthMap.get(key)
    if (!bucket) continue

    const amount = Number(order.amount_total ?? 0)
    if (order.order_type === 'sale') {
      bucket.income += amount
      bucket.incomeCount++
    } else if (order.order_type === 'purchase') {
      bucket.expense += amount
      bucket.expenseCount++
    }
  }

  return months
})

// ── Financial summary ─────────────────────────────────────────────────────────

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

  for (const picking of pickings.value.slice(0, 6)) {
    const pid = picking.id
    if (!pid) continue
    const st = picking.status
    const statusLabel = st ? pickingStatusLabels[st] : 'Sin estado'
    const typ = picking.type
    const typeLabel = typ ? pickingTypeLabels[typ] : 'Picking'

    events.push({
      id: `picking-${pid}`,
      typeLabel: `Picking · ${typeLabel}`,
      title: picking.name?.trim() || 'Picking sin nombre',
      detail: `${statusLabel}${picking.order_name?.trim()
        ? ` • Orden ${picking.order_name.trim()}`
        : ''}${typeof picking.line_count === 'number'
          ? ` • ${picking.line_count} líneas`
          : ''}`,
      dateIso: picking.created_at ?? picking.updated_at,
      href: `/admin/pickings/${pid}`
    })
  }

  for (const request of approvalRequests.value.slice(0, 6)) {
    const rid = request.id
    if (!rid) continue
    const titleBase = request.title?.trim()
    const numLabel = typeof request.request_number === 'number'
      ? `#${request.request_number}`
      : ''

    events.push({
      id: `approval-${rid}`,
      typeLabel: 'Aprobación',
      title:
        titleBase
        ?? (numLabel ? `Solicitud ${numLabel}` : 'Solicitud de aprobación'),
      detail: formatApprovalDetail(request),
      dateIso: request.created_at
        ?? request.approved_at
        ?? request.rejected_at,
      href: `/admin/approval-requests/${rid}`
    })
  }

  for (const proj of projects.value.slice(0, 6)) {
    const projectId = proj.id
    if (!projectId) continue
    const statusKey = proj.status
    const statusLabel = statusKey ? projectStatusLabels[statusKey] : 'Sin estado'

    events.push({
      id: `project-${projectId}`,
      typeLabel: 'Proyecto',
      title: proj.name?.trim() || proj.code || 'Proyecto',
      detail: `${statusLabel} • Avance ${proj.progress ?? 0}%`,
      dateIso: proj.created_at ?? proj.updated_at,
      href: `/admin/projects/${projectId}`
    })
  }

  for (const task of projectTasks.value.slice(0, 6)) {
    const taskId = task.id
    if (!taskId) continue
    const st = task.status
    const statusLabel = st ? projectTaskStatusLabels[st] : 'Sin estado'
    const projectLabel = task.project_name?.trim() || task.project_code?.trim()

    events.push({
      id: `task-${taskId}`,
      typeLabel: 'Tarea',
      title: task.name?.trim() || task.code || 'Tarea',
      detail: `${statusLabel}${projectLabel ? ` • ${projectLabel}` : ''}`,
      dateIso: task.created_at ?? task.updated_at ?? task.completed_at,
      href: `/admin/tasks/${taskId}`
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
    projects.value = []
    pickings.value = []
    approvalRequests.value = []
    projectTasks.value = []
    return
  }

  isLoading.value = true
  try {
    const [
      partnerList,
      productList,
      orderList,
      lineList,
      projectList,
      pickingList,
      approvalList,
      recentTaskList
    ] = await Promise.all([
      getPartnersByCompany(companyId),
      getProductsByCompany(companyId),
      getOrdersByCompany(companyId),
      getOrderLinesByCompany(companyId),
      getProjectsByCompany(companyId),
      getPickingsByCompany(companyId),
      getRequestsByCompany(companyId),
      getTasksByCompany(companyId, {
        orderByCreatedDesc: true,
        limit: 12
      })
    ])

    partners.value = partnerList
    products.value = productList
    orders.value = orderList
    orderLines.value = lineList
    projects.value = projectList
    pickings.value = pickingList
    approvalRequests.value = approvalList
    projectTasks.value = recentTaskList
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

      <!-- ── Bar chart: ingresos y egresos por mes ──────────────────────────── -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              Ingresos y egresos por mes
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Comparativa mensual de ventas y compras confirmadas.
            </p>
          </div>

          <!-- Currency switcher -->
          <div
            v-if="activeCurrencies.length > 0"
            class="flex flex-wrap items-center gap-1.5"
          >
            <span class="text-xs font-medium text-slate-500">Moneda:</span>
            <button
              v-for="c in activeCurrencies"
              :key="c"
              type="button"
              :class="[
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                chartCurrency === c
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              ]"
              @click="chartCurrency = c"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <!-- Period filters -->
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <span class="text-xs font-medium text-slate-500">Periodo:</span>
          <div class="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
            <button
              v-for="f in [12, 6, 3, 1]"
              :key="f"
              type="button"
              :class="[
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                chartFilter === f
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
              @click="chartFilter = f"
            >
              {{ f === 1 ? '1 mes' : `${f} meses` }}
            </button>
          </div>
        </div>

        <!-- Chart canvas -->
        <div class="mt-5 min-h-[200px]">
          <div
            v-if="isLoading"
            class="flex h-48 items-center justify-center text-sm text-slate-400"
          >
            Cargando datos…
          </div>
          <ChartMonthlyBars
            v-else
            :data="chartData"
            :currency="chartCurrency || activeCurrencies[0] || 'MXN'"
          />
        </div>

        <!-- Legend -->
        <div class="mt-3 flex flex-wrap items-center gap-5">
          <div class="flex items-center gap-1.5">
            <span class="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
            <span class="text-xs text-slate-600">Ingresos (ventas confirmadas)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-block h-3 w-3 rounded-sm bg-rose-500" />
            <span class="text-xs text-slate-600">Egresos (compras confirmadas)</span>
          </div>
        </div>
      </div>

      <!-- ── Financial summary table ─────────────────────────────────────── -->
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
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              Proyectos con vista pública
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Accede rápidamente al diagrama de seguimiento que ven las personas externas mediante el enlace compartido.
            </p>
          </div>
          <NuxtLink
            to="/admin/projects"
            class="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Ver todos los proyectos →
          </NuxtLink>
        </div>

        <div v-if="isLoading" class="mt-6 text-sm text-slate-500">
          Cargando proyectos…
        </div>

        <div
          v-else-if="publicProjects.length === 0"
          class="mt-6 rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
        >
          Aún no hay proyectos marcados como públicos. Activa la opción «Permitir vista pública» dentro del proyecto para compartirlo.
        </div>

        <div v-else class="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="project in publicProjects"
            :key="project.id ?? ''"
            class="group rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/10"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-xs font-mono text-slate-400">{{ project.code }}</p>
                <p class="mt-0.5 text-sm font-semibold text-slate-800 truncate">
                  {{ project.name }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ project.responsible_display_name?.trim() || project.responsible_name?.trim() || 'Sin responsable' }}
                </p>
              </div>
              <span class="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                Público
              </span>
            </div>
            <div class="mt-3">
              <div class="flex items-center justify-between text-xs text-slate-500">
                <span>Avance</span>
                <span class="font-semibold tabular-nums text-slate-700">{{ project.progress ?? 0 }}%</span>
              </div>
              <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 transition-all"
                  :style="{ width: `${Math.min(Math.max(project.progress ?? 0, 0), 100)}%` }"
                />
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between gap-2">
              <NuxtLink
                :to="`/admin/projects/${project.id}`"
                class="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Editar proyecto
              </NuxtLink>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-violet-700"
                @click="openPublicProjectView(project.id)"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Vista pública
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 class="text-lg font-semibold text-slate-900">
          Actividad reciente
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          Órdenes, pickings, aprobaciones, proyectos, tareas, partners y productos recientes en la empresa.
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