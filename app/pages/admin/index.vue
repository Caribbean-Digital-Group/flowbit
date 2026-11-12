<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Database, Tables } from '~/types/database.types'
import type { RevenueLedgerView, SalesKpis } from '~/types/sales.types'
import type { DashboardPreset, DateRange } from '~/utils/dashboard'
import {
  buildBuckets,
  bucketKeyFor,
  formatRangeLabel,
  granularityFor,
  isDashboardPreset,
  isInRange,
  isIsoDate,
  presetRange,
  previousRange,
  toIsoDate,
  toLocalDateKey
} from '~/utils/dashboard'
import type { DashboardStat, DashboardStatTrend } from '~/components/Dashboard/StatCard.vue'
import type { AttentionItem } from '~/components/Dashboard/AttentionList.vue'
import type { BarListItem } from '~/components/Dashboard/BarList.vue'

definePageMeta({
  layout: 'admin'
})

/**
 * Tablero principal. Las métricas financieras se calculan para el periodo
 * elegido y se comparan con el periodo anterior equivalente. En base de caja
 * (ingreso = lo cobrado) cuando la base tiene `get_sales_kpis`; si no, se
 * conserva el cálculo con órdenes confirmadas.
 *
 * Los paneles «Pendientes» y «Requiere atención» son una foto al día de hoy y
 * no dependen del periodo.
 */

type OrderRow = Database['public']['Views']['v_orders']['Row']
type PartnerRow = Tables<'partner'>
type ProductRow = Tables<'product'>
type ProjectViewRow = Database['public']['Views']['v_projects']['Row']
type PickingViewRow = Database['public']['Views']['v_pickings']['Row']
type ApprovalRequestViewRow = Database['public']['Views']['v_approval_requests']['Row']
type ProjectTaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type CrmLeadViewRow = Database['public']['Views']['v_crm_leads']['Row']
type ApprovalRequestStatus = Database['public']['Enums']['approval_request_status']
type PickingStatus = Database['public']['Enums']['picking_status']
type PickingType = Database['public']['Enums']['picking_type']
type ProjectTaskStatusEnum = Database['public']['Enums']['project_task_status']
type ProjectStatusEnum = Database['public']['Enums']['project_status']

interface ActivityItem {
  id: string
  typeLabel: string
  title: string
  detail: string
  dateIso: string | null
  href: string
}

interface PeriodFinance {
  income: number
  expense: number
  net: number
  incomeCount: number
  expenseCount: number
  averageTicket: number
  /** Margen bruto % (solo en base de caja, cuando hay costo registrado). */
  marginPercent: number | null
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)

const { getPartnersByCompany } = usePartner()
const { getProductsByCompany } = useProduct()
const { getOrdersByCompany } = useOrder()
const { getProjectsByCompany } = useProject()
const { getPickingsByCompany } = usePicking()
const { getRequestsByCompany } = useApprovalRequest()
const { getTasksByCompany } = useProjectTask()
const { getLeadsByCompany } = useCrmLead()
const { getSalesKpis, getRevenueLedger, lastError: kpisError } = useSalesReport()

// ── Periodo (sincronizado con la URL: ?periodo=…&desde=…&hasta=…) ───────────

const initialPeriod = (): { preset: DashboardPreset; range: DateRange } => {
  const { periodo, desde, hasta } = route.query
  const preset: DashboardPreset = isDashboardPreset(periodo) ? periodo : 'this_month'
  if (preset === 'custom' && isIsoDate(desde) && isIsoDate(hasta) && desde <= hasta) {
    return { preset, range: { from: desde, to: hasta } }
  }
  return { preset: preset === 'custom' ? 'this_month' : preset, range: presetRange(preset) }
}

const initial = initialPeriod()
const preset = ref<DashboardPreset>(initial.preset)
const rangeFrom = ref(initial.range.from)
const rangeTo = ref(initial.range.to)

watch(preset, (value) => {
  if (value === 'custom') return
  const range = presetRange(value)
  rangeFrom.value = range.from
  rangeTo.value = range.to
})

const rangeError = computed<string | null>(() => {
  if (!isIsoDate(rangeFrom.value) || !isIsoDate(rangeTo.value)) return 'Selecciona ambas fechas del periodo.'
  if (rangeTo.value < rangeFrom.value) return 'La fecha final debe ser posterior a la inicial.'
  return null
})

const activeRange = computed<DateRange | null>(() =>
  rangeError.value ? null : { from: rangeFrom.value, to: rangeTo.value }
)

const comparisonRange = computed<DateRange | null>(() =>
  activeRange.value ? previousRange(preset.value, activeRange.value) : null
)

const granularity = computed(() => (activeRange.value ? granularityFor(activeRange.value) : 'month'))

watch([preset, rangeFrom, rangeTo], ([p, from, to]) => {
  const query = { ...route.query, periodo: p } as Record<string, string | undefined>
  if (p === 'custom') {
    query.desde = from
    query.hasta = to
  } else {
    delete query.desde
    delete query.hasta
  }
  void router.replace({ query })
})

// ── Datos base (por empresa) ────────────────────────────────────────────────

const isLoading = ref(false)
const partners = ref<PartnerRow[]>([])
const products = ref<ProductRow[]>([])
const orders = ref<OrderRow[]>([])
const projects = ref<ProjectViewRow[]>([])
const pickings = ref<PickingViewRow[]>([])
const approvalRequests = ref<ApprovalRequestViewRow[]>([])
const projectTasks = ref<ProjectTaskViewRow[]>([])
const leads = ref<CrmLeadViewRow[]>([])

const resetBaseData = () => {
  partners.value = []
  products.value = []
  orders.value = []
  projects.value = []
  pickings.value = []
  approvalRequests.value = []
  projectTasks.value = []
  leads.value = []
}

let baseRequest = 0
const loadBase = async () => {
  const companyId = selectedCompanyId.value
  const requestId = ++baseRequest
  if (!companyId) {
    resetBaseData()
    return
  }

  isLoading.value = true
  try {
    const [
      partnerList,
      productList,
      orderList,
      projectList,
      pickingList,
      approvalList,
      taskList,
      leadList
    ] = await Promise.all([
      getPartnersByCompany(companyId),
      getProductsByCompany(companyId),
      getOrdersByCompany(companyId),
      getProjectsByCompany(companyId),
      getPickingsByCompany(companyId),
      getRequestsByCompany(companyId),
      getTasksByCompany(companyId, { active: true, orderByCreatedDesc: true }),
      getLeadsByCompany(companyId)
    ])
    if (requestId !== baseRequest) return

    partners.value = partnerList
    products.value = productList
    orders.value = orderList
    projects.value = projectList
    pickings.value = pickingList
    approvalRequests.value = approvalList
    projectTasks.value = taskList
    leads.value = leadList
  } finally {
    if (requestId === baseRequest) isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void loadBase() }, { immediate: true })

// ── Reabastecimiento: aviso cuando hay productos bajo su mínimo ─────────────

const { getSuggestions: getRestockSuggestions } = useRestock()
const restockCount = ref(0)
let restockRequest = 0
const loadRestock = async () => {
  const companyId = selectedCompanyId.value
  const requestId = ++restockRequest
  if (!companyId) {
    restockCount.value = 0
    return
  }
  const suggestions = await getRestockSuggestions(companyId)
  if (requestId === restockRequest) restockCount.value = suggestions.length
}

watch(selectedCompanyId, () => { void loadRestock() }, { immediate: true })

// ── Datos del periodo (KPIs en base de caja) ────────────────────────────────

const isPeriodLoading = ref(false)
const kpis = ref<SalesKpis | null>(null)
const previousKpis = ref<SalesKpis | null>(null)
const ledger = ref<RevenueLedgerView[]>([])

let periodRequest = 0
const loadPeriod = async () => {
  const companyId = selectedCompanyId.value
  const range = activeRange.value
  const previous = comparisonRange.value
  const requestId = ++periodRequest
  if (!companyId || !range || !previous) {
    kpis.value = null
    previousKpis.value = null
    ledger.value = []
    return
  }

  isPeriodLoading.value = true
  try {
    const [current, before] = await Promise.all([
      getSalesKpis(companyId, range.from, range.to),
      getSalesKpis(companyId, previous.from, previous.to)
    ])
    // La serie diaria/semanal sale del libro de ingresos; la mensual ya viene en el RPC.
    const rows = current && granularityFor(range) !== 'month'
      ? await getRevenueLedger(companyId, range.from, range.to)
      : []
    if (requestId !== periodRequest) return

    kpis.value = current
    previousKpis.value = before
    ledger.value = rows
  } finally {
    if (requestId === periodRequest) isPeriodLoading.value = false
  }
}

watch([selectedCompanyId, activeRange, preset], () => { void loadPeriod() }, { immediate: true })

// ── Moneda ──────────────────────────────────────────────────────────────────

const companyCurrency = computed(() =>
  kpis.value?.totals.currency?.trim().toUpperCase()
  || orders.value.find((o) => o.company_currency)?.company_currency?.trim().toUpperCase()
  || 'MXN'
)

const normalizeCurrency = (value: string | null | undefined): string =>
  value?.trim().toUpperCase() || companyCurrency.value

const activeCurrencies = computed(() => {
  const currencies = new Set<string>([companyCurrency.value])
  for (const order of orders.value) currencies.add(normalizeCurrency(order.currency))
  return Array.from(currencies).sort()
})

const selectedCurrency = ref('')
watch(
  activeCurrencies,
  (currencies) => {
    if (!currencies.includes(selectedCurrency.value)) {
      selectedCurrency.value = currencies.includes(companyCurrency.value)
        ? companyCurrency.value
        : (currencies[0] ?? 'MXN')
    }
  },
  { immediate: true }
)

const displayCurrency = computed(() => selectedCurrency.value || companyCurrency.value)

/** Base de caja disponible para la moneda elegida. */
const isCashBasis = computed(() =>
  kpis.value !== null && displayCurrency.value === kpis.value.totals.currency?.trim().toUpperCase()
)

/** El RPC de reportes no existe aún en la base (migraciones pendientes). */
const showLegacyNotice = computed(() => !isPeriodLoading.value && kpis.value === null && Boolean(kpisError.value))

// ── Formato ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency = displayCurrency.value): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)

const formatDateTime = (iso: string | null): string => {
  if (!iso) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

const rangeLabel = computed(() => (activeRange.value ? formatRangeLabel(activeRange.value) : ''))
const comparisonLabel = computed(() => (comparisonRange.value ? formatRangeLabel(comparisonRange.value) : ''))

// ── Finanzas del periodo ────────────────────────────────────────────────────

const financeFromKpis = (k: SalesKpis): PeriodFinance => {
  const t = k.totals
  return {
    income: t.net_collected,
    expense: t.purchases_paid,
    net: t.net_cash_flow,
    incomeCount: t.paying_orders,
    expenseCount: k.monthly.reduce((sum, m) => sum + m.expense_count, 0),
    averageTicket: t.average_ticket,
    marginPercent: t.cogs > 0 ? t.margin_percent : null
  }
}

const financeFromOrders = (range: DateRange): PeriodFinance => {
  let income = 0
  let expense = 0
  let incomeCount = 0
  let expenseCount = 0

  for (const order of orders.value) {
    if (order.order_state !== 'posted') continue
    if (normalizeCurrency(order.currency) !== displayCurrency.value) continue
    if (!isInRange(toLocalDateKey(order.order_date ?? order.created_at), range)) continue

    const amount = Number(order.amount_total ?? 0)
    if (order.order_type === 'sale') {
      income += amount
      incomeCount += 1
    } else if (order.order_type === 'purchase') {
      expense += amount
      expenseCount += 1
    }
  }

  return {
    income,
    expense,
    net: income - expense,
    incomeCount,
    expenseCount,
    averageTicket: incomeCount > 0 ? income / incomeCount : 0,
    marginPercent: null
  }
}

const currentFinance = computed<PeriodFinance | null>(() => {
  if (isCashBasis.value && kpis.value) return financeFromKpis(kpis.value)
  return activeRange.value ? financeFromOrders(activeRange.value) : null
})

const previousFinance = computed<PeriodFinance | null>(() => {
  if (isCashBasis.value) return previousKpis.value ? financeFromKpis(previousKpis.value) : null
  return comparisonRange.value ? financeFromOrders(comparisonRange.value) : null
})

const computeTrend = (
  current: number,
  previous: number | undefined,
  higherIsBetter = true
): DashboardStatTrend | undefined => {
  if (previous === undefined) return undefined
  if (current === 0 && previous === 0) return undefined
  if (previous === 0) {
    const up = current > 0
    return { label: 'Nuevo', direction: up ? 'up' : 'down', favorable: higherIsBetter === up }
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100)
  if (pct === 0) return { label: 'Sin cambios', direction: 'neutral', favorable: null }
  const up = pct > 0
  return {
    label: `${up ? '+' : ''}${formatNumber(pct)} %`,
    direction: up ? 'up' : 'down',
    favorable: higherIsBetter === up
  }
}

const ICONS = {
  trendingUp: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
  trendingDown: 'M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181',
  scale: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.99 5.99 0 0 1-2.031.352 5.99 5.99 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z',
  receipt: 'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z'
} as const

const dashboardStats = computed<DashboardStat[]>(() => {
  const cur = currentFinance.value
  if (!cur) return []
  const prev = previousFinance.value ?? undefined
  const cash = isCashBasis.value
  const netShare = cur.income > 0 ? Math.round((cur.net / cur.income) * 100) : null

  return [
    {
      key: 'income',
      label: cash ? 'Ingresos cobrados' : 'Ventas confirmadas',
      value: formatCurrency(cur.income),
      sublabel: [
        `${cur.incomeCount} ${cur.incomeCount === 1 ? 'orden' : 'órdenes'}`,
        cur.marginPercent !== null ? `margen bruto ${formatNumber(cur.marginPercent)} %` : null
      ].filter(Boolean).join(' · '),
      iconPath: ICONS.trendingUp,
      accent: 'emerald',
      to: cash ? '/admin/reports/sales' : '/admin/orders',
      trend: computeTrend(cur.income, prev?.income)
    },
    {
      key: 'expense',
      label: cash ? 'Pagado a proveedores' : 'Compras confirmadas',
      value: formatCurrency(cur.expense),
      sublabel: `${cur.expenseCount} ${cur.expenseCount === 1 ? 'compra' : 'compras'}`,
      iconPath: ICONS.trendingDown,
      accent: 'rose',
      to: '/admin/orders',
      trend: computeTrend(cur.expense, prev?.expense, false)
    },
    {
      key: 'net',
      label: cash ? 'Flujo neto' : 'Balance neto',
      value: formatCurrency(cur.net),
      sublabel: netShare !== null ? `${netShare} % de los ingresos` : 'Sin ingresos en el periodo',
      iconPath: ICONS.scale,
      accent: cur.net >= 0 ? 'sky' : 'rose',
      trend: computeTrend(cur.net, prev?.net)
    },
    {
      key: 'ticket',
      label: 'Ticket promedio',
      value: formatCurrency(cur.averageTicket),
      sublabel: cash ? 'Cobrado neto por orden' : 'Venta confirmada por orden',
      iconPath: ICONS.receipt,
      accent: 'violet',
      to: '/admin/reports/sales',
      trend: computeTrend(cur.averageTicket, prev?.averageTicket)
    }
  ]
})

// ── Gráfica del periodo ─────────────────────────────────────────────────────

interface ChartBar {
  label: string
  fullLabel: string
  income: number
  expense: number
  incomeCount: number
  expenseCount: number
}

const chartTitle = computed(() => {
  if (granularity.value === 'day') return 'Ingresos y egresos por día'
  if (granularity.value === 'week') return 'Ingresos y egresos por semana'
  return 'Ingresos y egresos por mes'
})

const chartData = computed<ChartBar[]>(() => {
  const range = activeRange.value
  if (!range) return []
  const gran = granularity.value

  const buckets = buildBuckets(range, gran).map((b) => ({
    ...b,
    income: 0,
    expense: 0,
    incomeOrders: new Set<string>(),
    expenseOrders: new Set<string>(),
    incomeCount: 0,
    expenseCount: 0
  }))
  const byKey = new Map(buckets.map((b) => [b.key, b]))

  if (isCashBasis.value && kpis.value) {
    if (gran === 'month') {
      for (const m of kpis.value.monthly) {
        const bucket = byKey.get(m.month)
        if (!bucket) continue
        bucket.income = m.income
        bucket.expense = m.expense
        bucket.incomeCount = m.income_count
        bucket.expenseCount = m.expense_count
      }
    } else {
      for (const row of ledger.value) {
        const key = bucketKeyFor(toLocalDateKey(row.occurred_at), range, gran)
        const bucket = key ? byKey.get(key) : undefined
        if (!bucket) continue
        const amount = Number(row.amount ?? 0)
        if (row.kind === 'collection' || row.kind === 'reimbursement') {
          bucket.income += amount
          if (row.kind === 'collection') bucket.incomeOrders.add(row.order_id)
        } else if (row.kind === 'supplier_payment' || row.kind === 'supplier_refund') {
          bucket.expense += amount
          if (row.kind === 'supplier_payment') bucket.expenseOrders.add(row.order_id)
        }
      }
      for (const bucket of buckets) {
        bucket.incomeCount = bucket.incomeOrders.size
        bucket.expenseCount = bucket.expenseOrders.size
      }
    }
  } else {
    for (const order of orders.value) {
      if (order.order_state !== 'posted') continue
      if (normalizeCurrency(order.currency) !== displayCurrency.value) continue
      const key = bucketKeyFor(toLocalDateKey(order.order_date ?? order.created_at), range, gran)
      const bucket = key ? byKey.get(key) : undefined
      if (!bucket) continue
      const amount = Number(order.amount_total ?? 0)
      if (order.order_type === 'sale') {
        bucket.income += amount
        bucket.incomeCount += 1
      } else if (order.order_type === 'purchase') {
        bucket.expense += amount
        bucket.expenseCount += 1
      }
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    fullLabel: b.fullLabel,
    income: b.income,
    expense: b.expense,
    incomeCount: b.incomeCount,
    expenseCount: b.expenseCount
  }))
})

const chartLabelStep = computed(() => Math.max(1, Math.ceil(chartData.value.length / 12)))
const chartHasData = computed(() => chartData.value.some((b) => b.income !== 0 || b.expense !== 0))

// ── Pendientes al día de hoy ────────────────────────────────────────────────

const receivablesAging = computed<BarListItem[]>(() => {
  const r = kpis.value?.receivables
  if (!r) return []
  return [
    { key: 'current', label: 'Al corriente', value: r.current },
    { key: 'd1_30', label: 'Vencido 1–30 días', value: r.d1_30 },
    { key: 'd31_60', label: 'Vencido 31–60 días', value: r.d31_60 },
    { key: 'd61_90', label: 'Vencido 61–90 días', value: r.d61_90 },
    { key: 'd90_plus', label: 'Vencido +90 días', value: r.d90_plus }
  ]
    .filter((row) => row.value !== 0)
    .map((row) => ({ ...row, display: formatCurrency(row.value, companyCurrency.value) }))
})

/** Borradores en la moneda elegida (cotizaciones y compras sin confirmar). */
const draftTotals = computed(() => {
  let saleDraft = 0
  let saleDraftCount = 0
  let purchaseDraft = 0
  let purchaseDraftCount = 0
  for (const order of orders.value) {
    if (order.order_state !== 'draft') continue
    if (normalizeCurrency(order.currency) !== displayCurrency.value) continue
    const amount = Number(order.amount_total ?? 0)
    if (order.order_type === 'sale') {
      saleDraft += amount
      saleDraftCount += 1
    } else if (order.order_type === 'purchase') {
      purchaseDraft += amount
      purchaseDraftCount += 1
    }
  }
  return { saleDraft, saleDraftCount, purchaseDraft, purchaseDraftCount }
})

// ── Requiere atención ───────────────────────────────────────────────────────

const today = toIsoDate(new Date())

const attentionItems = computed<AttentionItem[]>(() => {
  const items: AttentionItem[] = []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  const receivables = kpis.value?.receivables
  const overdueReceivables = receivables
    ? receivables.d1_30 + receivables.d31_60 + receivables.d61_90 + receivables.d90_plus
    : 0
  if (overdueReceivables > 0) {
    items.push({
      key: 'overdue-receivables',
      label: 'Cobranza vencida',
      value: formatCurrency(overdueReceivables, companyCurrency.value),
      detail: receivables && receivables.d90_plus > 0
        ? `${formatCurrency(receivables.d90_plus, companyCurrency.value)} con más de 90 días`
        : 'Saldos con fecha de pago vencida',
      to: '/admin/orders',
      tone: 'danger'
    })
  }

  const overdueTasks = projectTasks.value.filter((task) => {
    const due = toLocalDateKey(task.due_date)
    return due !== null && due < today && (task.status === 'pending' || task.status === 'in_progress')
  })
  if (overdueTasks.length > 0) {
    const oldest = overdueTasks.reduce((min, t) => ((t.due_date ?? '') < (min.due_date ?? '') ? t : min))
    items.push({
      key: 'overdue-tasks',
      label: 'Tareas vencidas',
      value: String(overdueTasks.length),
      detail: `La más antigua: ${oldest.name?.trim() || oldest.code || 'Tarea'}`,
      to: '/admin/tasks',
      tone: 'danger'
    })
  }

  const pendingApprovals = approvalRequests.value.filter((r) => r.status === 'published').length
  if (pendingApprovals > 0) {
    items.push({
      key: 'approvals',
      label: 'Aprobaciones por resolver',
      value: String(pendingApprovals),
      detail: plural(pendingApprovals, 'solicitud publicada', 'solicitudes publicadas'),
      to: '/admin/approval-requests',
      tone: 'warning'
    })
  }

  const pendingDeliveries = kpis.value?.pending_deliveries
  if (pendingDeliveries && pendingDeliveries.orders > 0) {
    items.push({
      key: 'deliveries',
      label: 'Órdenes por surtir',
      value: String(pendingDeliveries.orders),
      detail: `${formatNumber(pendingDeliveries.units)} unidades · ${formatCurrency(pendingDeliveries.value, companyCurrency.value)}`,
      to: '/admin/orders?delivery=pending',
      tone: 'warning'
    })
  }

  const openLeads = leads.value.filter((l) => !l.is_won && !l.is_lost)
  const overdueActivities = openLeads.reduce((sum, l) => sum + (l.overdue_activity_count ?? 0), 0)
  if (overdueActivities > 0) {
    items.push({
      key: 'crm-activities',
      label: 'Actividades de CRM vencidas',
      value: String(overdueActivities),
      detail: plural(openLeads.filter((l) => (l.overdue_activity_count ?? 0) > 0).length, 'lead afectado', 'leads afectados'),
      to: '/admin/crm/leads',
      tone: 'warning'
    })
  }

  const rottingLeads = openLeads.filter((l) => l.is_rotting).length
  if (rottingLeads > 0) {
    items.push({
      key: 'crm-rotting',
      label: 'Leads estancados',
      value: String(rottingLeads),
      detail: 'Superaron los días permitidos en su etapa',
      to: '/admin/crm/kanban',
      tone: 'info'
    })
  }

  const openPickings = pickings.value.filter((p) => p.status === 'borrador' || p.status === 'publicado').length
  if (openPickings > 0) {
    items.push({
      key: 'pickings',
      label: 'Movimientos de inventario abiertos',
      value: String(openPickings),
      detail: 'En borrador o publicados, sin confirmar',
      to: '/admin/pickings',
      tone: 'info'
    })
  }

  return items
})

// ── Comercial (CRM) ─────────────────────────────────────────────────────────

const leadCloseDate = (lead: CrmLeadViewRow): string | null =>
  toLocalDateKey(lead.actual_close_date ?? lead.stage_changed_at ?? lead.updated_at)

const crmStats = computed(() => {
  const range = activeRange.value
  let created = 0
  let won = 0
  let lost = 0
  let wonAmount = 0
  let openCount = 0
  let openAmount = 0
  let weightedAmount = 0

  for (const lead of leads.value) {
    const sameCurrency = normalizeCurrency(lead.currency) === displayCurrency.value
    const amount = sameCurrency ? Number(lead.amount ?? 0) : 0

    if (range && isInRange(toLocalDateKey(lead.created_at), range)) created += 1

    if (lead.is_won) {
      if (range && isInRange(leadCloseDate(lead), range)) {
        won += 1
        wonAmount += sameCurrency ? Number(lead.won_amount ?? lead.amount ?? 0) : 0
      }
    } else if (lead.is_lost) {
      if (range && isInRange(leadCloseDate(lead), range)) lost += 1
    } else {
      openCount += 1
      openAmount += amount
      const probability = lead.probability ?? lead.stage_probability ?? 0
      weightedAmount += amount * (probability / 100)
    }
  }

  const closed = won + lost
  return {
    created,
    won,
    lost,
    wonAmount,
    winRate: closed > 0 ? Math.round((won / closed) * 100) : null,
    openCount,
    openAmount,
    weightedAmount
  }
})

// ── Productos más vendidos ──────────────────────────────────────────────────

const topProducts = computed<BarListItem[]>(() =>
  (kpis.value?.top_products ?? []).slice(0, 5).map((p) => ({
    key: p.product_id,
    label: p.name,
    value: p.revenue,
    display: formatCurrency(p.revenue, companyCurrency.value),
    hint: `${formatNumber(p.units)} uds · margen ${formatCurrency(p.revenue - p.cogs, companyCurrency.value)}`
  }))
)

// ── Operación ───────────────────────────────────────────────────────────────

const operationStats = computed(() => {
  let activeProjects = 0
  let progressSum = 0
  for (const project of projects.value) {
    if (project.status !== 'in_progress') continue
    activeProjects += 1
    progressSum += project.progress ?? 0
  }
  // Bucle explícito: `.filter` sobre `Tables<'product'>` dispara TS2589.
  let activeProducts = 0
  for (const product of products.value) {
    if (product.status === 'active') activeProducts += 1
  }
  return {
    activeProjects,
    averageProgress: activeProjects > 0 ? Math.round(progressSum / activeProjects) : 0,
    activePartners: partners.value.filter((p) => p.active !== false).length,
    activeProducts
  }
})

const publicProjects = computed(() =>
  projects.value
    .filter((p) => Boolean((p as ProjectViewRow & { is_public?: boolean | null }).is_public))
    .slice(0, 4)
)

const openPublicProjectView = (projectId: string | null) => {
  if (!projectId || typeof window === 'undefined') return
  window.open(`${window.location.origin}/public/projects/${projectId}`, '_blank', 'noopener,noreferrer')
}

// ── Actividad reciente ──────────────────────────────────────────────────────

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
  const parts: string[] = [request.status ? approvalRequestStatusLabels[request.status] : 'Sin estado']
  if (request.requesting_partner_display?.trim()) parts.push(request.requesting_partner_display.trim())
  if (request.category_name?.trim()) parts.push(request.category_name.trim())
  if (request.amount !== null && !Number.isNaN(Number(request.amount))) {
    parts.push(formatCurrency(Number(request.amount), normalizeCurrency(request.currency)))
  }
  if (request.reference?.trim()) parts.push(`Ref. ${request.reference.trim()}`)
  return parts.join(' • ')
}

const orderStateLabel = (state: OrderRow['order_state']): string =>
  state === 'posted' ? 'Confirmada' : state === 'draft' ? 'Borrador' : 'Cancelada'

const recentActivity = computed<ActivityItem[]>(() => {
  const events: ActivityItem[] = []

  for (const order of orders.value.slice(0, 6)) {
    const cur = normalizeCurrency(order.currency)
    events.push({
      id: `order-${order.id}`,
      typeLabel: order.order_type === 'sale' ? 'Venta' : 'Compra',
      title: order.name || 'Orden sin nombre',
      detail: `${orderStateLabel(order.order_state)} • ${formatCurrency(order.amount_total ?? 0, cur)}`,
      dateIso: order.created_at ?? order.order_date,
      href: order.id ? `/admin/orders/${order.id}` : '/admin/orders'
    })
  }

  for (const picking of pickings.value.slice(0, 4)) {
    if (!picking.id) continue
    const statusLabel = picking.status ? pickingStatusLabels[picking.status] : 'Sin estado'
    const typeLabel = picking.type ? pickingTypeLabels[picking.type] : 'Picking'
    events.push({
      id: `picking-${picking.id}`,
      typeLabel: `Movimiento · ${typeLabel}`,
      title: picking.name?.trim() || 'Movimiento sin nombre',
      detail: `${statusLabel}${picking.order_name?.trim() ? ` • Orden ${picking.order_name.trim()}` : ''}`,
      dateIso: picking.created_at ?? picking.updated_at,
      href: `/admin/pickings/${picking.id}`
    })
  }

  for (const request of approvalRequests.value.slice(0, 4)) {
    if (!request.id) continue
    const numLabel = typeof request.request_number === 'number' ? `#${request.request_number}` : ''
    events.push({
      id: `approval-${request.id}`,
      typeLabel: 'Aprobación',
      title: request.title?.trim() || (numLabel ? `Solicitud ${numLabel}` : 'Solicitud de aprobación'),
      detail: formatApprovalDetail(request),
      dateIso: request.created_at ?? request.approved_at ?? request.rejected_at,
      href: `/admin/approval-requests/${request.id}`
    })
  }

  for (const proj of projects.value.slice(0, 4)) {
    if (!proj.id) continue
    events.push({
      id: `project-${proj.id}`,
      typeLabel: 'Proyecto',
      title: proj.name?.trim() || proj.code || 'Proyecto',
      detail: `${proj.status ? projectStatusLabels[proj.status] : 'Sin estado'} • Avance ${proj.progress ?? 0}%`,
      dateIso: proj.created_at ?? proj.updated_at,
      href: `/admin/projects/${proj.id}`
    })
  }

  for (const task of projectTasks.value.slice(0, 4)) {
    if (!task.id) continue
    const projectLabel = task.project_name?.trim() || task.project_code?.trim()
    events.push({
      id: `task-${task.id}`,
      typeLabel: 'Tarea',
      title: task.name?.trim() || task.code || 'Tarea',
      detail: `${task.status ? projectTaskStatusLabels[task.status] : 'Sin estado'}${projectLabel ? ` • ${projectLabel}` : ''}`,
      dateIso: task.created_at ?? task.updated_at,
      href: `/admin/tasks/${task.id}`
    })
  }

  for (const lead of leads.value.slice(0, 4)) {
    if (!lead.id) continue
    events.push({
      id: `lead-${lead.id}`,
      typeLabel: 'Lead',
      title: lead.name?.trim() || 'Lead',
      detail: `${lead.is_won ? 'Ganado' : lead.is_lost ? 'Perdido' : (lead.stage_name ?? 'Abierto')}${lead.partner_display_name ? ` • ${lead.partner_display_name}` : ''}`,
      dateIso: lead.created_at,
      href: `/admin/crm/leads/${lead.id}`
    })
  }

  for (const partner of partners.value.slice(0, 3)) {
    events.push({
      id: `partner-${partner.id}`,
      typeLabel: 'Contacto',
      title: partner.display_name?.trim() || partner.name,
      detail: partner.active === false ? 'Inactivo' : 'Activo',
      dateIso: partner.created_at,
      href: `/admin/partners/${partner.id}`
    })
  }

  return events
    .filter((event) => Boolean(event.dateIso))
    .sort((a, b) => new Date(b.dateIso ?? 0).getTime() - new Date(a.dateIso ?? 0).getTime())
    .slice(0, 8)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p class="mt-1 text-sm text-slate-500">
          {{ selectedCompany?.name ? `Resumen de ${selectedCompany.name}` : 'Resumen de la empresa seleccionada' }}
        </p>
      </div>
      <NuxtLink
        v-if="selectedCompanyId"
        to="/admin/reports/sales"
        class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <svg class="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        Reporte de ventas
      </NuxtLink>
    </div>

    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para visualizar el dashboard con sus métricas.
      </p>
    </div>

    <template v-else>
      <!-- ── Filtro de periodo ─────────────────────────────────────────────── -->
      <DashboardPeriodFilter
        v-model:preset="preset"
        v-model:from="rangeFrom"
        v-model:to="rangeTo"
        v-model:currency="selectedCurrency"
        :currencies="activeCurrencies"
        :range-label="rangeLabel"
        :comparison-label="comparisonLabel"
        :loading="isPeriodLoading || isLoading"
      />

      <NuxtLink
        v-if="restockCount > 0"
        to="/admin/inventory/restock"
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100"
      >
        <span>
          <span class="font-semibold">{{ restockCount }} {{ restockCount === 1 ? 'producto está' : 'productos están' }} por debajo de su mínimo.</span>
          Genera las órdenes de compra sugeridas en un clic.
        </span>
        <span class="font-semibold">Ver por reabastecer →</span>
      </NuxtLink>

      <div
        v-if="rangeError"
        class="rounded-2xl border border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700"
      >
        {{ rangeError }}
      </div>

      <div
        v-if="showLegacyNotice"
        class="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-600"
      >
        Mostrando ventas y compras <strong>confirmadas</strong>. Los ingresos en base de caja (lo cobrado),
        la cartera y los productos más vendidos aparecerán cuando la base tenga los reportes de ventas.
      </div>

      <!-- ── KPIs del periodo ─────────────────────────────────────────────── -->
      <div
        :class="[
          'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity',
          isPeriodLoading && dashboardStats.length > 0 ? 'opacity-60' : ''
        ]"
      >
        <template v-if="(isLoading || isPeriodLoading) && !kpis && orders.length === 0">
          <DashboardStatCard v-for="i in 4" :key="`stat-skeleton-${i}`" loading />
        </template>
        <DashboardStatCard
          v-for="stat in dashboardStats"
          v-else
          :key="stat.key"
          :stat="stat"
        />
      </div>

      <!-- ── Gráfica + pendientes de hoy ──────────────────────────────────── -->
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">{{ chartTitle }}</h2>
              <p class="mt-1 text-sm text-slate-500">
                {{ isCashBasis ? 'Lo cobrado a clientes contra lo pagado a proveedores.' : 'Ventas y compras confirmadas.' }}
                {{ rangeLabel }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-4">
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
                <span class="text-xs text-slate-600">Ingresos</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm bg-rose-500" />
                <span class="text-xs text-slate-600">Egresos</span>
              </div>
            </div>
          </div>

          <div class="relative mt-5 min-h-[200px]">
            <div
              v-if="(isLoading || isPeriodLoading) && !chartHasData"
              class="flex h-48 items-center justify-center text-sm text-slate-400"
            >
              Cargando datos…
            </div>
            <template v-else>
              <ChartMonthlyBars
                :class="isPeriodLoading ? 'opacity-60' : ''"
                :data="chartData"
                :currency="displayCurrency"
                :label-step="chartLabelStep"
              />
              <p
                v-if="!chartHasData"
                class="pointer-events-none absolute inset-x-0 top-16 text-center text-sm text-slate-400"
              >
                Sin movimientos en este periodo.
              </p>
            </template>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-900">Pendientes al día de hoy</h2>
          <p class="mt-1 text-sm text-slate-500">No dependen del periodo seleccionado.</p>

          <div v-if="isLoading || (isPeriodLoading && !kpis)" class="mt-5 space-y-3">
            <div v-for="i in 3" :key="`pending-skeleton-${i}`" class="h-14 animate-pulse rounded-xl bg-slate-100" />
          </div>

          <div v-else-if="kpis" class="mt-5 space-y-5">
            <div>
              <div class="flex items-baseline justify-between gap-3">
                <p class="text-sm font-medium text-slate-500">Por cobrar</p>
                <p class="text-xl font-bold tabular-nums text-amber-600">
                  {{ formatCurrency(kpis.receivables.total, companyCurrency) }}
                </p>
              </div>
              <p class="text-xs text-slate-400">
                {{ kpis.receivables.count }} {{ kpis.receivables.count === 1 ? 'orden con saldo' : 'órdenes con saldo' }}
              </p>
              <div v-if="receivablesAging.length > 0" class="mt-3">
                <DashboardBarList :items="receivablesAging" bar-class="bg-amber-400" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <NuxtLink
                to="/admin/orders"
                class="rounded-xl bg-slate-50 p-3 transition-colors hover:bg-slate-100"
              >
                <p class="text-xs font-medium text-slate-500">Por pagar</p>
                <p class="mt-1 truncate text-base font-bold tabular-nums text-slate-800">
                  {{ formatCurrency(kpis.payables.total, companyCurrency) }}
                </p>
                <p class="text-[11px] text-slate-400">{{ kpis.payables.count }} compras</p>
              </NuxtLink>
              <NuxtLink
                to="/admin/orders?delivery=pending"
                class="rounded-xl bg-slate-50 p-3 transition-colors hover:bg-slate-100"
              >
                <p class="text-xs font-medium text-slate-500">Por entregar</p>
                <p class="mt-1 truncate text-base font-bold tabular-nums text-slate-800">
                  {{ formatCurrency(kpis.pending_deliveries.value, companyCurrency) }}
                </p>
                <p class="text-[11px] text-slate-400">{{ kpis.pending_deliveries.orders }} órdenes</p>
              </NuxtLink>
            </div>
          </div>

          <div v-else class="mt-5 grid grid-cols-1 gap-3">
            <NuxtLink to="/admin/orders" class="rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
              <p class="text-xs font-medium text-slate-500">Cotizaciones en borrador</p>
              <p class="mt-1 text-xl font-bold tabular-nums text-amber-600">
                {{ formatCurrency(draftTotals.saleDraft) }}
              </p>
              <p class="text-[11px] text-slate-400">{{ draftTotals.saleDraftCount }} ventas sin confirmar</p>
            </NuxtLink>
            <NuxtLink to="/admin/orders" class="rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
              <p class="text-xs font-medium text-slate-500">Compras en borrador</p>
              <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">
                {{ formatCurrency(draftTotals.purchaseDraft) }}
              </p>
              <p class="text-[11px] text-slate-400">{{ draftTotals.purchaseDraftCount }} compras sin confirmar</p>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- ── Atención · Comercial · Productos ─────────────────────────────── -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-6">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-slate-900">Requiere atención</h2>
            <span
              v-if="attentionItems.length > 0 && !isLoading"
              class="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700"
            >
              {{ attentionItems.length }}
            </span>
          </div>
          <p class="mt-1 text-sm text-slate-500">Pendientes operativos al día de hoy.</p>
          <DashboardAttentionList
            class="mt-5"
            :items="attentionItems"
            :loading="isLoading"
          />
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Comercial</h2>
              <p class="mt-1 text-sm text-slate-500">Leads del CRM en el periodo.</p>
            </div>
            <NuxtLink to="/admin/crm/kanban" class="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              Tablero →
            </NuxtLink>
          </div>

          <div v-if="isLoading" class="mt-5 grid grid-cols-2 gap-3">
            <div v-for="i in 4" :key="`crm-skeleton-${i}`" class="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>

          <template v-else>
            <div class="mt-5 grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-slate-50 p-3">
                <p class="text-xs font-medium text-slate-500">Nuevos leads</p>
                <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">{{ crmStats.created }}</p>
              </div>
              <div class="rounded-xl bg-slate-50 p-3">
                <p class="text-xs font-medium text-slate-500">Tasa de cierre</p>
                <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">
                  {{ crmStats.winRate !== null ? `${crmStats.winRate} %` : '—' }}
                </p>
                <p class="text-[11px] text-slate-400">{{ crmStats.won }} ganados · {{ crmStats.lost }} perdidos</p>
              </div>
              <div class="col-span-2 rounded-xl bg-emerald-50/70 p-3">
                <p class="text-xs font-medium text-emerald-700">Ganado en el periodo</p>
                <p class="mt-1 text-xl font-bold tabular-nums text-emerald-700">{{ formatCurrency(crmStats.wonAmount) }}</p>
              </div>
            </div>

            <div class="mt-4 border-t border-slate-100 pt-4">
              <div class="flex items-baseline justify-between gap-3">
                <p class="text-sm font-medium text-slate-500">Pipeline abierto</p>
                <p class="text-base font-bold tabular-nums text-violet-700">{{ formatCurrency(crmStats.openAmount) }}</p>
              </div>
              <div class="mt-1 flex items-baseline justify-between gap-3 text-xs text-slate-400">
                <span>{{ crmStats.openCount }} {{ crmStats.openCount === 1 ? 'lead abierto' : 'leads abiertos' }}</span>
                <span>Ponderado {{ formatCurrency(crmStats.weightedAmount) }}</span>
              </div>
            </div>
          </template>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2 xl:col-span-1">
          <template v-if="kpis || isPeriodLoading">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold text-slate-900">Productos más vendidos</h2>
                <p class="mt-1 text-sm text-slate-500">Por ingreso en el periodo.</p>
              </div>
              <NuxtLink to="/admin/reports/sales" class="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                Reporte →
              </NuxtLink>
            </div>
            <div v-if="isPeriodLoading && !kpis" class="mt-5 space-y-3">
              <div v-for="i in 4" :key="`product-skeleton-${i}`" class="h-10 animate-pulse rounded-xl bg-slate-100" />
            </div>
            <DashboardBarList
              v-else
              class="mt-5"
              :items="topProducts"
              bar-class="bg-gradient-to-r from-indigo-500 to-violet-500"
              empty-label="Sin productos entregados en el periodo."
            />
          </template>

          <template v-else>
            <h2 class="text-lg font-semibold text-slate-900">Operación</h2>
            <p class="mt-1 text-sm text-slate-500">Estado general de la empresa.</p>
            <dl class="mt-5 space-y-3">
              <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <dt class="text-sm text-slate-500">Proyectos activos</dt>
                <dd class="text-base font-bold tabular-nums text-slate-800">{{ operationStats.activeProjects }}</dd>
              </div>
              <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <dt class="text-sm text-slate-500">Contactos activos</dt>
                <dd class="text-base font-bold tabular-nums text-slate-800">{{ operationStats.activePartners }}</dd>
              </div>
              <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <dt class="text-sm text-slate-500">Productos activos</dt>
                <dd class="text-base font-bold tabular-nums text-slate-800">{{ operationStats.activeProducts }}</dd>
              </div>
            </dl>
          </template>
        </div>
      </div>

      <!-- ── Actividad reciente + proyectos ───────────────────────────────── -->
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <h2 class="text-lg font-semibold text-slate-900">Actividad reciente</h2>
          <p class="mt-1 text-sm text-slate-500">Últimos registros creados en la empresa.</p>

          <div v-if="isLoading" class="mt-5 space-y-2">
            <div v-for="i in 5" :key="`activity-skeleton-${i}`" class="h-14 animate-pulse rounded-xl bg-slate-100" />
          </div>

          <div
            v-else-if="recentActivity.length === 0"
            class="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
          >
            No hay actividad reciente para mostrar.
          </div>

          <ul v-else class="mt-5 divide-y divide-slate-100">
            <li v-for="item in recentActivity" :key="item.id">
              <NuxtLink
                :to="item.href"
                class="-mx-2 flex items-start justify-between gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-slate-50"
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {{ item.typeLabel }}
                    </span>
                    <p class="truncate text-sm font-semibold text-slate-900">{{ item.title }}</p>
                  </div>
                  <p class="mt-1 truncate text-xs text-slate-500">{{ item.detail }}</p>
                </div>
                <span class="shrink-0 text-xs text-slate-400">{{ formatDateTime(item.dateIso) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="space-y-6">
          <div v-if="kpis" class="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 class="text-lg font-semibold text-slate-900">Operación</h2>
            <dl class="mt-4 grid grid-cols-3 gap-3 text-center">
              <NuxtLink to="/admin/projects" class="rounded-xl bg-slate-50 px-2 py-3 transition-colors hover:bg-slate-100">
                <dd class="text-lg font-bold tabular-nums text-slate-800">{{ operationStats.activeProjects }}</dd>
                <dt class="text-[11px] text-slate-500">Proyectos activos</dt>
              </NuxtLink>
              <NuxtLink to="/admin/partners" class="rounded-xl bg-slate-50 px-2 py-3 transition-colors hover:bg-slate-100">
                <dd class="text-lg font-bold tabular-nums text-slate-800">{{ operationStats.activePartners }}</dd>
                <dt class="text-[11px] text-slate-500">Contactos</dt>
              </NuxtLink>
              <NuxtLink to="/admin/products" class="rounded-xl bg-slate-50 px-2 py-3 transition-colors hover:bg-slate-100">
                <dd class="text-lg font-bold tabular-nums text-slate-800">{{ operationStats.activeProducts }}</dd>
                <dt class="text-[11px] text-slate-500">Productos</dt>
              </NuxtLink>
            </dl>
            <p v-if="operationStats.activeProjects > 0" class="mt-3 text-xs text-slate-500">
              Avance promedio de proyectos activos: <strong class="text-slate-700">{{ operationStats.averageProgress }}%</strong>
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-6">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-lg font-semibold text-slate-900">Proyectos públicos</h2>
              <NuxtLink to="/admin/projects" class="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                Ver todos →
              </NuxtLink>
            </div>

            <div v-if="isLoading" class="mt-4 space-y-2">
              <div v-for="i in 2" :key="`project-skeleton-${i}`" class="h-16 animate-pulse rounded-xl bg-slate-100" />
            </div>

            <p
              v-else-if="publicProjects.length === 0"
              class="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500"
            >
              Activa «Permitir vista pública» dentro de un proyecto para compartir su avance.
            </p>

            <ul v-else class="mt-4 space-y-3">
              <li
                v-for="project in publicProjects"
                :key="project.id ?? ''"
                class="rounded-xl border border-slate-100 p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <NuxtLink
                    :to="`/admin/projects/${project.id}`"
                    class="min-w-0 truncate text-sm font-semibold text-slate-800 hover:text-indigo-700"
                  >
                    {{ project.name }}
                  </NuxtLink>
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
                    title="Abrir vista pública"
                    @click="openPublicProjectView(project.id)"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Ver
                  </button>
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600"
                      :style="{ width: `${Math.min(Math.max(project.progress ?? 0, 0), 100)}%` }"
                    />
                  </div>
                  <span class="text-[11px] font-semibold tabular-nums text-slate-600">{{ project.progress ?? 0 }}%</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
