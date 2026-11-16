<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { downloadCsv, type CsvCell } from '~/utils/csv'
import type { ProfitLoss } from '~/utils/expenses'

definePageMeta({ layout: 'admin' })

/**
 * Estado de resultados en base de caja (TRY-10):
 *   ingresos (cobrado neto) − compras pagadas a proveedores − gastos pagados.
 * Ingresos y compras salen de `get_sales_kpis`; los gastos, de la tabla `expense`.
 * El armado es puro y está probado: `buildProfitLoss` en app/utils/expenses.ts.
 */
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getSalesKpis, lastError: kpiError } = useSalesReport()
const { getPaidInRange, lastError: expenseError } = useExpense()
const { getByCompany: getCategories } = useExpenseCategory()

type Preset = 'this_year' | 'last_year' | 'last_12' | 'this_quarter' | 'custom'

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const presetRange = (preset: Preset): { from: string; to: string } => {
  const now = new Date()
  if (preset === 'last_year') {
    return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` }
  }
  if (preset === 'last_12') {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: toIsoDate(now) }
  }
  if (preset === 'this_quarter') {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3
    return { from: toIsoDate(new Date(now.getFullYear(), quarterStart, 1)), to: toIsoDate(now) }
  }
  return { from: `${now.getFullYear()}-01-01`, to: toIsoDate(now) }
}

const presetOptions: { value: Preset; label: string }[] = [
  { value: 'this_year', label: 'Este año' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'last_12', label: 'Últimos 12 meses' },
  { value: 'last_year', label: 'Año anterior' },
  { value: 'custom', label: 'Personalizado' }
]

const preset = ref<Preset>('this_year')
const range = reactive(presetRange('this_year'))
const report = ref<ProfitLoss | null>(null)
const currency = ref('MXN')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const salesWarning = ref<string | null>(null)

const selectPreset = (value: Preset) => {
  preset.value = value
  if (value !== 'custom') Object.assign(range, presetRange(value))
}

let requestId = 0

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !range.from || !range.to) return
  if (range.to < range.from) {
    errorMessage.value = 'La fecha final debe ser posterior a la inicial.'
    return
  }
  if (monthsInRange(range.from, range.to).length > 60) {
    errorMessage.value = 'Elige un periodo de cinco años o menos.'
    return
  }

  const current = ++requestId
  isLoading.value = true
  errorMessage.value = null
  salesWarning.value = null
  try {
    const [kpis, expenses, categories] = await Promise.all([
      getSalesKpis(companyId, range.from, range.to),
      getPaidInRange(companyId, range.from, range.to),
      getCategories(companyId, { includeArchived: true })
    ])
    if (current !== requestId) return

    if (expenseError.value) {
      errorMessage.value = expenseError.value
    }
    if (!kpis) {
      // Sin el RPC de ventas el reporte sigue siendo útil: muestra solo los gastos.
      salesWarning.value = `No se pudieron leer los ingresos y las compras: ${kpiError.value ?? 'reporte de ventas no disponible'}. Se muestran solo los gastos.`
    }

    currency.value = kpis?.totals.currency || selectedCompany.value?.currency || 'MXN'
    const categoryNames = new Map(categories.map(c => [c.id, c.name]))

    report.value = buildProfitLoss({
      from: range.from,
      to: range.to,
      monthly: (kpis?.monthly ?? []).map(m => ({ month: m.month, income: m.income, purchases: m.expense })),
      expenses: expenses.map(e => ({
        date: e.expense_date,
        paidAt: e.paid_at,
        amount: expenseTotal(e.amount, e.tax_amount),
        category: e.category_id ? (categoryNames.get(e.category_id) ?? null) : null,
        status: e.status
      }))
    })
  } finally {
    if (current === requestId) isLoading.value = false
  }
}

watch([selectedCompanyId, () => range.from, () => range.to], () => { void load() }, { immediate: true })

const money = (value: number | null | undefined): string => {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.value }).format(Number(value ?? 0))
  } catch {
    return Number(value ?? 0).toFixed(2)
  }
}

const percent = (part: number, whole: number): string =>
  whole > 0 ? `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format((part / whole) * 100)} %` : '—'

const cards = computed(() => {
  const t = report.value?.totals
  if (!t) return []
  return [
    { key: 'income', label: 'Ingresos cobrados', value: money(t.income), hint: 'Cobrado neto de devoluciones, con IVA', tone: 'text-emerald-600' },
    { key: 'purchases', label: 'Compras pagadas', value: money(t.purchases), hint: `${percent(t.purchases, t.income)} de los ingresos`, tone: 'text-slate-800' },
    { key: 'expenses', label: 'Gastos pagados', value: money(t.expenses), hint: `${percent(t.expenses, t.income)} de los ingresos`, tone: 'text-rose-600' },
    { key: 'net', label: 'Resultado', value: money(t.net), hint: `Margen ${percent(t.net, t.income)}`, tone: t.net >= 0 ? 'text-emerald-600' : 'text-rose-600' }
  ]
})

const exportCsv = () => {
  const r = report.value
  if (!r) return
  const header = ['Mes', 'Ingresos', 'Compras', 'Gastos', ...r.categories.map(c => `Gastos: ${c}`), 'Resultado']
  const body: CsvCell[][] = r.rows.map(row => [
    row.month,
    row.income,
    row.purchases,
    row.expenses,
    ...r.categories.map(c => row.expensesByCategory[c] ?? 0),
    row.net
  ])
  body.push([
    'Total',
    r.totals.income,
    r.totals.purchases,
    r.totals.expenses,
    ...r.categories.map(c => r.totals.expensesByCategory[c] ?? 0),
    r.totals.net
  ])
  downloadCsv(`estado-de-resultados-${range.from}-a-${range.to}`, header, body)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Estado de resultados</h1>
        <p class="mt-1 text-sm text-slate-500">
          Base de caja: ingresos cobrados − compras pagadas a proveedores − gastos pagados, por mes.
        </p>
      </div>
      <div class="flex gap-3">
        <BtnApp variant="ghost" size="sm" label="Ver gastos" @click="navigateTo('/admin/expenses')" />
        <BtnApp variant="secondary" size="sm" :disabled="!report" label="Exportar CSV" @click="exportCsv" />
      </div>
    </div>

    <!-- Periodo -->
    <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in presetOptions"
            :key="p.value"
            type="button"
            class="rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="preset === p.value
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
            @click="selectPreset(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
        <div v-if="preset === 'custom'" class="flex flex-wrap gap-3">
          <FormInput v-model="range.from" type="date" label="Desde" size="sm" />
          <FormInput v-model="range.to" type="date" label="Hasta" size="sm" />
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>
    <div v-if="salesWarning" class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-800">
      {{ salesWarning }}
    </div>

    <div v-if="isLoading && !report" class="py-20 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
      <p class="mt-3 text-sm text-slate-400">Calculando…</p>
    </div>

    <template v-if="report">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" :class="isLoading ? 'opacity-60' : ''">
        <div
          v-for="card in cards"
          :key="card.key"
          class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-1 text-xl font-bold tabular-nums" :class="card.tone">{{ card.value }}</p>
          <p class="mt-1 text-xs text-slate-400">{{ card.hint }}</p>
        </div>
      </div>

      <!-- Mensual -->
      <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
        <h2 class="px-5 pt-4 text-sm font-bold text-slate-800">Resultado por mes</h2>
        <p class="px-5 text-xs text-slate-500">Importes con IVA, en la fecha del cobro o del pago.</p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left">Mes</th>
                <th class="px-3 py-2 text-right">Ingresos</th>
                <th class="px-3 py-2 text-right">Compras</th>
                <th class="px-3 py-2 text-right">Gastos</th>
                <th class="px-5 py-2 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.rows" :key="row.month" class="border-t border-slate-100">
                <td class="px-5 py-2 capitalize text-slate-700">{{ formatExpenseMonth(row.month) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(row.income) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(row.purchases) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(row.expenses) }}</td>
                <td class="px-5 py-2 text-right font-semibold tabular-nums" :class="row.net < 0 ? 'text-rose-600' : 'text-emerald-700'">
                  {{ money(row.net) }}
                </td>
              </tr>
              <tr class="border-t border-slate-200 bg-slate-50 font-semibold">
                <td class="px-5 py-2 text-slate-800">Total</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(report.totals.income) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(report.totals.purchases) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(report.totals.expenses) }}</td>
                <td class="px-5 py-2 text-right tabular-nums" :class="report.totals.net < 0 ? 'text-rose-600' : 'text-emerald-700'">
                  {{ money(report.totals.net) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Gastos por categoría -->
      <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
        <div class="flex items-center justify-between px-5 pt-4">
          <h2 class="text-sm font-bold text-slate-800">Gastos por categoría</h2>
          <NuxtLink to="/admin/expense-categories" class="text-xs font-medium text-indigo-600 hover:underline">Categorías</NuxtLink>
        </div>
        <p class="px-5 text-xs text-slate-500">Solo gastos en estado «Pagado», en el mes de su fecha de pago.</p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="sticky left-0 bg-slate-50 px-5 py-2 text-left">Categoría</th>
                <th v-for="row in report.rows" :key="row.month" class="whitespace-nowrap px-3 py-2 text-right">
                  {{ formatExpenseMonth(row.month) }}
                </th>
                <th class="px-3 py-2 text-right">Total</th>
                <th class="px-5 py-2 text-right">% del gasto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="report.categories.length === 0">
                <td :colspan="report.rows.length + 3" class="px-5 py-6 text-center text-slate-400">
                  Sin gastos pagados en el periodo.
                </td>
              </tr>
              <tr v-for="category in report.categories" :key="category" class="border-t border-slate-100">
                <td class="sticky left-0 bg-white px-5 py-2 text-slate-700">{{ category }}</td>
                <td v-for="row in report.rows" :key="row.month" class="px-3 py-2 text-right tabular-nums text-slate-600">
                  {{ row.expensesByCategory[category] ? money(row.expensesByCategory[category]) : '—' }}
                </td>
                <td class="px-3 py-2 text-right font-semibold tabular-nums">{{ money(report.totals.expensesByCategory[category]) }}</td>
                <td class="px-5 py-2 text-right tabular-nums text-slate-500">
                  {{ percent(report.totals.expensesByCategory[category] ?? 0, report.totals.expenses) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="text-xs text-slate-400">
        Los ingresos y las compras vienen del reporte de ventas (cobros y pagos registrados en las órdenes).
        Los gastos en borrador, aprobados sin pagar o cancelados no cuentan. No sustituye la contabilidad fiscal.
      </p>
    </template>
  </div>
</template>
