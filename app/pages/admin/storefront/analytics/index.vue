<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StatItem } from '~/components/StatGrid.vue'
import type { DailyTrendPoint } from '~/components/Chart/DailyTrend.vue'
import type {
  StorefrontAnalyticsDailyRow,
  StorefrontAnalyticsDailyDimRow,
  StorefrontAnalyticsJobRunRow
} from '~/types/analytics.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const report = useStorefrontAnalyticsReport()

// ── Filtros ──────────────────────────────────────────────────────────
type RangePreset = '7d' | '30d' | '90d' | 'custom'

const rangePreset = ref<RangePreset>('30d')
const customFrom = ref('')
const customTo = ref('')
const deviceSegment = ref<'all' | 'desktop' | 'mobile' | 'tablet'>('all')

const toDateString = (date: Date): string => date.toISOString().slice(0, 10)

const range = computed<{ from: string; to: string; days: number }>(() => {
  const today = new Date()
  if (rangePreset.value === 'custom' && customFrom.value && customTo.value) {
    const from = customFrom.value <= customTo.value ? customFrom.value : customTo.value
    const to = customFrom.value <= customTo.value ? customTo.value : customFrom.value
    const days =
      Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1
    return { from, to, days }
  }
  const days = rangePreset.value === '7d' ? 7 : rangePreset.value === '90d' ? 90 : 30
  const from = new Date(today.getTime() - (days - 1) * 86_400_000)
  return { from: toDateString(from), to: toDateString(today), days }
})

/** Periodo anterior de la misma longitud, para comparar tendencias */
const previousRange = computed(() => {
  const fromMs = new Date(range.value.from).getTime()
  const to = new Date(fromMs - 86_400_000)
  const from = new Date(fromMs - range.value.days * 86_400_000)
  return { from: toDateString(from), to: toDateString(to) }
})

// ── Estado ───────────────────────────────────────────────────────────
const isLoading = ref(true)
const daily = ref<StorefrontAnalyticsDailyRow[]>([])
const previousDaily = ref<StorefrontAnalyticsDailyRow[]>([])
const dims = ref<StorefrontAnalyticsDailyDimRow[]>([])
const activeVisitors = ref(0)
const lastJobRun = ref<StorefrontAnalyticsJobRunRow | null>(null)
const segmentKpis = ref<Awaited<ReturnType<typeof report.getSegmentKpis>>>(null)

const currency = computed(
  () => (selectedCompany.value as { currency?: string } | null)?.currency ?? 'MXN'
)

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    // Refresco bajo demanda (el servidor lo limita a 1 vez cada 5 min)
    await report.refresh()

    const [current, previous, dimensions, visitors, jobRun] = await Promise.all([
      report.getDailySeries(cid, range.value.from, range.value.to),
      report.getDailySeries(cid, previousRange.value.from, previousRange.value.to),
      report.getDimensions(cid, range.value.from, range.value.to, [
        'page', 'product_view', 'product_purchased', 'source', 'device', 'country', 'search'
      ]),
      report.getActiveVisitors(cid),
      report.getLastJobRun()
    ])

    daily.value = current
    previousDaily.value = previous
    dims.value = dimensions
    activeVisitors.value = visitors
    lastJobRun.value = jobRun

    segmentKpis.value =
      deviceSegment.value === 'all'
        ? null
        : await report.getSegmentKpis(cid, range.value.from, range.value.to, deviceSegment.value)
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, range, deviceSegment], () => void load(), { immediate: true })

const hasData = computed(() => daily.value.some((d) => d.page_views > 0 || d.sessions > 0 || d.orders > 0))

// ── Totales y KPIs ───────────────────────────────────────────────────
interface Totals {
  pageViews: number
  sessions: number
  visitors: number
  newVisitors: number
  bounceSessions: number
  totalSeconds: number
  orders: number
  revenue: number
  convertedSessions: number
}

const sumDaily = (rows: StorefrontAnalyticsDailyRow[]): Totals =>
  rows.reduce(
    (acc, row) => {
      acc.pageViews += row.page_views
      acc.sessions += row.sessions
      acc.visitors += row.visitors
      acc.newVisitors += row.new_visitors
      acc.bounceSessions += row.bounce_sessions
      acc.totalSeconds += row.total_session_seconds
      acc.orders += row.orders
      acc.revenue += Number(row.revenue)
      acc.convertedSessions += row.converted_sessions
      return acc
    },
    {
      pageViews: 0, sessions: 0, visitors: 0, newVisitors: 0,
      bounceSessions: 0, totalSeconds: 0, orders: 0, revenue: 0, convertedSessions: 0
    }
  )

const totals = computed<Totals>(() => {
  if (segmentKpis.value) {
    const s = segmentKpis.value
    return {
      pageViews: s.pageViews,
      sessions: s.sessions,
      visitors: s.visitors,
      newVisitors: s.newVisitors,
      bounceSessions: s.bounceSessions,
      totalSeconds: s.totalSeconds,
      orders: s.orders,
      revenue: s.revenue,
      convertedSessions: s.convertedSessions
    }
  }
  return sumDaily(daily.value)
})

const previousTotals = computed<Totals>(() => sumDaily(previousDaily.value))

const formatNumber = (v: number): string => new Intl.NumberFormat('es-MX').format(v)

const formatCurrency = (v: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency.value,
    minimumFractionDigits: 2
  }).format(v)

const formatPercent = (v: number): string => `${(v * 100).toFixed(1)}%`

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const conversionRate = (t: Totals): number => (t.sessions > 0 ? t.convertedSessions / t.sessions : 0)
const bounceRate = (t: Totals): number => (t.sessions > 0 ? t.bounceSessions / t.sessions : 0)
const avgTicket = (t: Totals): number => (t.orders > 0 ? t.revenue / t.orders : 0)
const avgDuration = (t: Totals): number => (t.sessions > 0 ? t.totalSeconds / t.sessions : 0)

/** Cambio % vs periodo anterior (solo sin segmento activo) */
const changeVs = (current: number, previous: number): Pick<StatItem, 'change' | 'trend'> => {
  if (segmentKpis.value || previous <= 0) return {}
  const delta = (current - previous) / previous
  return {
    change: `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`,
    trend: delta > 0.001 ? 'up' : delta < -0.001 ? 'down' : 'neutral'
  }
}

const stats = computed<StatItem[]>(() => [
  { label: 'Visitas (páginas)', value: formatNumber(totals.value.pageViews), ...changeVs(totals.value.pageViews, previousTotals.value.pageViews) },
  { label: 'Sesiones', value: formatNumber(totals.value.sessions), ...changeVs(totals.value.sessions, previousTotals.value.sessions) },
  { label: 'Visitantes únicos', value: formatNumber(totals.value.visitors), ...changeVs(totals.value.visitors, previousTotals.value.visitors) },
  { label: 'Nuevos visitantes', value: formatNumber(totals.value.newVisitors), ...changeVs(totals.value.newVisitors, previousTotals.value.newVisitors) },
  { label: 'Tasa de conversión', value: formatPercent(conversionRate(totals.value)), ...changeVs(conversionRate(totals.value), conversionRate(previousTotals.value)) },
  { label: 'Órdenes', value: formatNumber(totals.value.orders), ...changeVs(totals.value.orders, previousTotals.value.orders) },
  { label: 'Ingresos', value: formatCurrency(totals.value.revenue), ...changeVs(totals.value.revenue, previousTotals.value.revenue) },
  { label: 'Ticket promedio', value: formatCurrency(avgTicket(totals.value)), ...changeVs(avgTicket(totals.value), avgTicket(previousTotals.value)) }
])

const secondaryStats = computed<StatItem[]>(() => [
  { label: 'Tasa de rebote', value: formatPercent(bounceRate(totals.value)) },
  { label: 'Duración media de sesión', value: formatDuration(avgDuration(totals.value)) },
  { label: 'Páginas por sesión', value: totals.value.sessions > 0 ? (totals.value.pageViews / totals.value.sessions).toFixed(1) : '0' },
  { label: 'Visitantes activos ahora', value: formatNumber(activeVisitors.value) }
])

// ── Serie de tiempo ──────────────────────────────────────────────────
type TrendMetric = 'sessions' | 'page_views' | 'visitors' | 'orders' | 'revenue'

const trendMetric = ref<TrendMetric>('sessions')

const trendMetricOptions: { value: TrendMetric; label: string; format: 'number' | 'currency' }[] = [
  { value: 'sessions', label: 'Sesiones', format: 'number' },
  { value: 'page_views', label: 'Visitas', format: 'number' },
  { value: 'visitors', label: 'Visitantes', format: 'number' },
  { value: 'orders', label: 'Órdenes', format: 'number' },
  { value: 'revenue', label: 'Ingresos', format: 'currency' }
]

const activeTrendOption = computed(
  () => trendMetricOptions.find((option) => option.value === trendMetric.value) ?? trendMetricOptions[0]!
)

const shortDay = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fullDay = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
})

/** Serie continua: incluye en 0 los días sin fila de rollup */
const trendSeries = computed<DailyTrendPoint[]>(() => {
  const byDay = new Map(daily.value.map((row) => [row.day, row]))
  const points: DailyTrendPoint[] = []
  const start = new Date(`${range.value.from}T00:00:00Z`)

  for (let i = 0; i < range.value.days; i += 1) {
    const date = new Date(start.getTime() + i * 86_400_000)
    const key = toDateString(date)
    const row = byDay.get(key)
    points.push({
      label: shortDay.format(date),
      fullLabel: fullDay.format(date),
      value: row ? Number(row[trendMetric.value]) : 0
    })
  }
  return points
})

// ── Embudo de checkout ───────────────────────────────────────────────
const funnel = computed(() => {
  const sums = daily.value.reduce(
    (acc, row) => {
      acc.view_item += row.funnel_view_item
      acc.add_to_cart += row.funnel_add_to_cart
      acc.begin_checkout += row.funnel_begin_checkout
      acc.purchase += row.funnel_purchase
      return acc
    },
    { view_item: 0, add_to_cart: 0, begin_checkout: 0, purchase: 0 }
  )

  const steps = [
    { key: 'view_item', label: 'Vieron un producto', count: sums.view_item },
    { key: 'add_to_cart', label: 'Agregaron al carrito', count: sums.add_to_cart },
    { key: 'begin_checkout', label: 'Iniciaron el checkout', count: sums.begin_checkout },
    { key: 'purchase', label: 'Compraron', count: sums.purchase }
  ]
  const max = Math.max(steps[0]?.count ?? 0, 1)

  return steps.map((step, index) => {
    const prev = index > 0 ? steps[index - 1]!.count : null
    return {
      ...step,
      widthPercent: Math.max((step.count / max) * 100, step.count > 0 ? 3 : 0),
      ofFirst: steps[0]!.count > 0 ? step.count / steps[0]!.count : 0,
      stepRate: prev !== null && prev > 0 ? step.count / prev : null
    }
  })
})

const cartAbandonmentRate = computed(() => {
  const addToCart = funnel.value[1]?.count ?? 0
  const purchase = funnel.value[3]?.count ?? 0
  return addToCart > 0 ? (addToCart - purchase) / addToCart : 0
})

// ── Tablas top (agrega los rollups diarios del rango) ────────────────
interface TopRow {
  key: string
  label: string
  hits: number
  uniques: number
  value: number
}

const topByDim = (dim: StorefrontAnalyticsDailyDimRow['dim'], limit = 8): TopRow[] => {
  const grouped = new Map<string, TopRow>()
  for (const row of dims.value) {
    if (row.dim !== dim) continue
    const entry = grouped.get(row.dim_key) ?? {
      key: row.dim_key,
      label: row.dim_label ?? row.dim_key,
      hits: 0,
      uniques: 0,
      value: 0
    }
    entry.hits += row.hits
    entry.uniques += row.uniques
    entry.value += Number(row.value)
    grouped.set(row.dim_key, entry)
  }
  return [...grouped.values()].sort((a, b) => b.hits - a.hits).slice(0, limit)
}

const topPages = computed(() => topByDim('page'))
const topProductsViewed = computed(() => topByDim('product_view'))
const topProductsPurchased = computed(() =>
  topByDim('product_purchased').sort((a, b) => b.value - a.value)
)
const topSources = computed(() => topByDim('source'))
const topSearches = computed(() => topByDim('search'))
const topDevices = computed(() => topByDim('device', 4))
const topCountries = computed(() => topByDim('country', 6))

const deviceTotalSessions = computed(() =>
  topDevices.value.reduce((sum, row) => sum + row.hits, 0)
)

// ── Exportación CSV ──────────────────────────────────────────────────
const exportCsv = () => {
  const header = [
    'dia', 'visitas', 'sesiones', 'visitantes', 'nuevos_visitantes', 'rebotes',
    'ordenes', 'ingresos', 'sesiones_convertidas',
    'embudo_view_item', 'embudo_add_to_cart', 'embudo_begin_checkout', 'embudo_purchase'
  ]
  const lines = daily.value.map((row) =>
    [
      row.day, row.page_views, row.sessions, row.visitors, row.new_visitors,
      row.bounce_sessions, row.orders, row.revenue, row.converted_sessions,
      row.funnel_view_item, row.funnel_add_to_cart, row.funnel_begin_checkout, row.funnel_purchase
    ].join(',')
  )
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `analitica-tienda_${range.value.from}_${range.value.to}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const lastRunLabel = computed(() => {
  const finished = lastJobRun.value?.finished_at
  if (!finished) return null
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(finished)
  )
})

useHead({ title: 'Analítica de la tienda — Flowbit' })
</script>

<template>
  <div class="space-y-6">
    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Analítica de la tienda</h1>
        <p class="mt-1 text-sm text-slate-500">
          Comportamiento de los visitantes de tu tienda en línea: audiencia, embudo de compra e ingresos.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold"
          title="Sesiones con actividad en los últimos 5 minutos"
        >
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          {{ activeVisitors }} en línea
        </span>
        <BtnApp variant="secondary" :disabled="isLoading || !hasData" @click="exportCsv">
          Exportar CSV
        </BtnApp>
        <BtnApp variant="secondary" :disabled="isLoading" @click="load">
          Actualizar
        </BtnApp>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center gap-4">
        <div class="flex items-center gap-1.5">
          <button
            v-for="preset in ([
              { value: '7d', label: '7 días' },
              { value: '30d', label: '30 días' },
              { value: '90d', label: '90 días' },
              { value: 'custom', label: 'Personalizado' }
            ] as { value: RangePreset; label: string }[])"
            :key="preset.value"
            type="button"
            :class="[
              'px-3.5 py-2 rounded-xl text-sm font-medium transition-colors',
              rangePreset === preset.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
            ]"
            @click="rangePreset = preset.value"
          >
            {{ preset.label }}
          </button>
        </div>

        <div v-if="rangePreset === 'custom'" class="flex items-center gap-2">
          <input
            v-model="customFrom"
            type="date"
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Desde"
          />
          <span class="text-sm text-slate-400">a</span>
          <input
            v-model="customTo"
            type="date"
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Hasta"
          />
        </div>

        <div class="lg:ml-auto flex items-center gap-2">
          <label for="device-segment" class="text-sm text-slate-500">Dispositivo</label>
          <select
            id="device-segment"
            v-model="deviceSegment"
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="all">Todos</option>
            <option value="desktop">Escritorio</option>
            <option value="mobile">Móvil</option>
            <option value="tablet">Tablet</option>
          </select>
        </div>
      </div>
      <p v-if="deviceSegment !== 'all'" class="mt-3 text-xs text-slate-400">
        Segmento activo: los KPIs se calculan desde las sesiones del dispositivo seleccionado;
        la comparación con el periodo anterior se oculta.
      </p>
    </div>

    <!-- Vacío: aún sin datos -->
    <div
      v-if="!isLoading && !hasData"
      class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-12 text-center"
    >
      <div class="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <svg class="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-slate-800">Aún no hay datos en este periodo</h2>
      <p class="mt-2 text-sm text-slate-500 max-w-md mx-auto">
        Los datos aparecen cuando los visitantes navegan tu tienda y aceptan las cookies de analítica.
        Las métricas se actualizan aproximadamente cada 15 minutos.
      </p>
    </div>

    <template v-else>
      <!-- KPIs -->
      <StatGrid :stats="stats" :columns="4" :loading="isLoading" />
      <StatGrid :stats="secondaryStats" :columns="4" :loading="isLoading" />

      <!-- Serie de tiempo -->
      <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 class="text-base font-semibold text-slate-800">Tendencia diaria</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ range.from }} — {{ range.to }} (UTC)
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="option in trendMetricOptions"
              :key="option.value"
              type="button"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                trendMetric === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
              ]"
              @click="trendMetric = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <ChartDailyTrend
          :data="trendSeries"
          :series-label="activeTrendOption.label"
          :format="activeTrendOption.format"
          :currency="currency"
        />
      </div>

      <!-- Embudo + fuentes -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-1">Embudo de checkout</h2>
          <p class="text-xs text-slate-500 mb-5">Sesiones que alcanzaron cada paso en el periodo.</p>

          <div class="space-y-4">
            <div v-for="step in funnel" :key="step.key">
              <div class="flex items-baseline justify-between gap-3 mb-1.5">
                <span class="text-sm font-medium text-slate-700">{{ step.label }}</span>
                <span class="text-xs text-slate-500 tabular-nums">
                  <span class="font-semibold text-slate-800">{{ formatNumber(step.count) }}</span>
                  · {{ formatPercent(step.ofFirst) }}
                  <template v-if="step.stepRate !== null">
                    · paso: {{ formatPercent(step.stepRate) }}
                  </template>
                </span>
              </div>
              <div class="h-5 rounded-lg bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-lg bg-indigo-500 transition-all duration-500"
                  :style="{ width: `${step.widthPercent}%` }"
                />
              </div>
            </div>
          </div>

          <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span class="text-sm text-slate-500">Abandono de carrito</span>
            <span class="text-sm font-bold text-slate-800 tabular-nums">
              {{ formatPercent(cartAbandonmentRate) }}
            </span>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-1">Fuentes de tráfico</h2>
          <p class="text-xs text-slate-500 mb-4">Sesiones por origen (UTM o referrer) y sus ingresos.</p>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th class="pb-2 font-medium">Fuente</th>
                <th class="pb-2 font-medium text-right">Sesiones</th>
                <th class="pb-2 font-medium text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in topSources" :key="row.key" class="border-t border-slate-50">
                <td class="py-2 text-slate-700 truncate max-w-[12rem]">{{ row.label }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.hits) }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatCurrency(row.value) }}</td>
              </tr>
              <tr v-if="!topSources.length">
                <td colspan="3" class="py-6 text-center text-sm text-slate-400">Sin datos en el periodo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Páginas + búsquedas -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-4">Páginas más vistas</h2>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th class="pb-2 font-medium">Página</th>
                <th class="pb-2 font-medium text-right">Vistas</th>
                <th class="pb-2 font-medium text-right">Sesiones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in topPages" :key="row.key" class="border-t border-slate-50">
                <td class="py-2 text-slate-700 truncate max-w-[14rem]" :title="row.label">{{ row.label }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.hits) }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.uniques) }}</td>
              </tr>
              <tr v-if="!topPages.length">
                <td colspan="3" class="py-6 text-center text-sm text-slate-400">Sin datos en el periodo</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-4">Búsquedas frecuentes</h2>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th class="pb-2 font-medium">Término</th>
                <th class="pb-2 font-medium text-right">Búsquedas</th>
                <th class="pb-2 font-medium text-right">Resultados (prom.)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in topSearches" :key="row.key" class="border-t border-slate-50">
                <td class="py-2 text-slate-700 truncate max-w-[14rem]">{{ row.label }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.hits) }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ row.value.toFixed(0) }}</td>
              </tr>
              <tr v-if="!topSearches.length">
                <td colspan="3" class="py-6 text-center text-sm text-slate-400">Sin búsquedas en el periodo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Productos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-4">Productos más vistos</h2>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th class="pb-2 font-medium">Producto</th>
                <th class="pb-2 font-medium text-right">Vistas</th>
                <th class="pb-2 font-medium text-right">Sesiones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in topProductsViewed" :key="row.key" class="border-t border-slate-50">
                <td class="py-2 text-slate-700 truncate max-w-[14rem]" :title="row.label">{{ row.label }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.hits) }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.uniques) }}</td>
              </tr>
              <tr v-if="!topProductsViewed.length">
                <td colspan="3" class="py-6 text-center text-sm text-slate-400">Sin datos en el periodo</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-4">Productos más comprados</h2>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th class="pb-2 font-medium">Producto</th>
                <th class="pb-2 font-medium text-right">Unidades</th>
                <th class="pb-2 font-medium text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in topProductsPurchased" :key="row.key" class="border-t border-slate-50">
                <td class="py-2 text-slate-700 truncate max-w-[14rem]" :title="row.label">{{ row.label }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.hits) }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatCurrency(row.value) }}</td>
              </tr>
              <tr v-if="!topProductsPurchased.length">
                <td colspan="3" class="py-6 text-center text-sm text-slate-400">Sin compras en el periodo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Dispositivos + países -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-4">Dispositivos</h2>
          <div class="space-y-3">
            <div v-for="row in topDevices" :key="row.key">
              <div class="flex items-baseline justify-between gap-3 mb-1">
                <span class="text-sm text-slate-700">{{ row.label }}</span>
                <span class="text-xs text-slate-500 tabular-nums">
                  {{ formatNumber(row.hits) }} ·
                  {{ formatPercent(deviceTotalSessions > 0 ? row.hits / deviceTotalSessions : 0) }}
                </span>
              </div>
              <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-indigo-500"
                  :style="{ width: `${deviceTotalSessions > 0 ? (row.hits / deviceTotalSessions) * 100 : 0}%` }"
                />
              </div>
            </div>
            <p v-if="!topDevices.length" class="py-4 text-center text-sm text-slate-400">
              Sin datos en el periodo
            </p>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h2 class="text-base font-semibold text-slate-800 mb-4">Países</h2>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th class="pb-2 font-medium">País</th>
                <th class="pb-2 font-medium text-right">Sesiones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in topCountries" :key="row.key" class="border-t border-slate-50">
                <td class="py-2 text-slate-700">{{ row.label }}</td>
                <td class="py-2 text-right text-slate-600 tabular-nums">{{ formatNumber(row.hits) }}</td>
              </tr>
              <tr v-if="!topCountries.length">
                <td colspan="2" class="py-6 text-center text-sm text-slate-400">Sin datos en el periodo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <p class="text-xs text-slate-400 text-center">
      Datos agregados en UTC, actualizados cada ~15 minutos.
      <template v-if="lastRunLabel">Último procesamiento: {{ lastRunLabel }}.</template>
      Solo se registran visitantes que aceptaron las cookies de analítica.
    </p>
  </div>
</template>
