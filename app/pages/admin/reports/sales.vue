<script setup lang="ts">
import { downloadCsv } from '~/utils/csv'
import { storeToRefs } from 'pinia'
import type { OrderChannel, RevenueLedgerKind, SalesKpis } from '~/types/sales.types'
import { CHANNEL_LABELS } from '~/utils/sales'

definePageMeta({ layout: 'admin' })

/**
 * Reporte de ventas en base de caja: el ingreso cuenta cuando se cobra
 * (decisión de negocio), el costo cuando la mercancía sale del almacén.
 * Todos los cálculos ocurren en `get_sales_kpis`; esta página solo presenta.
 */
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getSalesKpis, getRevenueLedger, lastError } = useSalesReport()

type Preset = 'this_month' | 'last_month' | 'last_90' | 'this_year' | 'custom'

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const presetRange = (preset: Preset): { from: string; to: string } => {
  const now = new Date()
  if (preset === 'last_month') {
    return {
      from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0))
    }
  }
  if (preset === 'last_90') {
    const from = new Date(now)
    from.setDate(from.getDate() - 89)
    return { from: toIsoDate(from), to: toIsoDate(now) }
  }
  if (preset === 'this_year') {
    return { from: toIsoDate(new Date(now.getFullYear(), 0, 1)), to: toIsoDate(now) }
  }
  return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toIsoDate(now) }
}

const presetOptions: { value: Preset; label: string }[] = [
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'last_90', label: 'Últimos 90 días' },
  { value: 'this_year', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' }
]

const preset = ref<Preset>('this_month')
const range = reactive(presetRange('this_month'))
const kpis = ref<SalesKpis | null>(null)
const isLoading = ref(false)
const isExporting = ref(false)
const errorMessage = ref<string | null>(null)

const selectPreset = (value: Preset) => {
  preset.value = value
  if (value !== 'custom') Object.assign(range, presetRange(value))
}

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !range.from || !range.to) return
  if (range.to < range.from) {
    errorMessage.value = 'La fecha final debe ser posterior a la inicial.'
    return
  }
  isLoading.value = true
  errorMessage.value = null
  try {
    kpis.value = await getSalesKpis(companyId, range.from, range.to)
    if (!kpis.value) errorMessage.value = lastError.value
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, () => range.from, () => range.to], () => { void load() }, { immediate: true })

const currency = computed(() => kpis.value?.totals.currency ?? 'MXN')

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.value }).format(Number(value ?? 0))

const units = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value ?? 0))

interface KpiCard {
  key: string
  label: string
  value: string
  hint: string
  tone: 'slate' | 'emerald' | 'rose' | 'amber' | 'indigo'
}

const toneClasses: Record<KpiCard['tone'], string> = {
  slate: 'text-slate-800',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
  indigo: 'text-indigo-600'
}

const cards = computed<KpiCard[]>(() => {
  const k = kpis.value
  if (!k) return []
  const t = k.totals
  return [
    { key: 'net_collected', label: 'Cobrado neto', value: money(t.net_collected), hint: `${money(t.collected)} cobrado − ${money(t.reimbursed)} reembolsado`, tone: 'emerald' },
    { key: 'net_revenue', label: 'Ingreso sin IVA', value: money(t.net_revenue), hint: `IVA cobrado ${money(t.tax_collected)}`, tone: 'slate' },
    { key: 'cogs', label: 'Costo de lo vendido', value: money(t.cogs), hint: `${units(t.units_sold)} unidades entregadas, al costo real del almacén`, tone: 'rose' },
    { key: 'margin', label: 'Margen bruto', value: money(t.gross_margin), hint: `${units(t.margin_percent)} % del ingreso sin IVA`, tone: t.gross_margin >= 0 ? 'emerald' : 'rose' },
    { key: 'receivables', label: 'Por cobrar (hoy)', value: money(k.receivables.total), hint: `${k.receivables.count} órdenes con saldo`, tone: 'amber' },
    { key: 'deliveries', label: 'Por entregar (hoy)', value: money(k.pending_deliveries.value), hint: `${units(k.pending_deliveries.units)} unidades en ${k.pending_deliveries.orders} órdenes`, tone: 'amber' },
    { key: 'refunds', label: 'Devoluciones', value: money(k.refunds.total), hint: `${k.refunds.count} en el periodo · reembolsado ${money(k.refunds.reimbursed)}`, tone: 'rose' },
    { key: 'ticket', label: 'Ticket promedio', value: money(t.average_ticket), hint: `${t.paying_orders} órdenes con cobro`, tone: 'indigo' },
    { key: 'purchases', label: 'Pagos a proveedores', value: money(t.purchases_paid), hint: `Por pagar hoy: ${money(k.payables.total)}`, tone: 'slate' },
    { key: 'cash_flow', label: 'Flujo neto', value: money(t.net_cash_flow), hint: 'Cobrado neto − pagado a proveedores', tone: t.net_cash_flow >= 0 ? 'emerald' : 'rose' }
  ]
})

const chartData = computed(() =>
  (kpis.value?.monthly ?? []).map((m) => {
    const [y, mo] = m.month.split('-').map(Number)
    const d = new Date(y ?? 2000, (mo ?? 1) - 1, 1)
    const monthStr = d.toLocaleDateString('es-MX', { month: 'short' }).replace(/\./g, '').slice(0, 3).toUpperCase()
    return {
      label: `${monthStr} ${String(y).slice(2)}`,
      income: m.income,
      expense: m.expense,
      incomeCount: m.income_count,
      expenseCount: m.expense_count
    }
  })
)

const channelLabel = (c: string): string => CHANNEL_LABELS[c as OrderChannel] ?? c

const agingRows = computed(() => {
  const r = kpis.value?.receivables
  if (!r) return []
  return [
    { label: 'Al corriente', value: r.current },
    { label: '1 a 30 días', value: r.d1_30 },
    { label: '31 a 60 días', value: r.d31_60 },
    { label: '61 a 90 días', value: r.d61_90 },
    { label: 'Más de 90 días', value: r.d90_plus }
  ]
})

// ── Exportación del libro ────────────────────────────────────────────────────
const kindLabels: Record<RevenueLedgerKind, string> = {
  collection: 'Cobro',
  reimbursement: 'Reembolso',
  supplier_payment: 'Pago a proveedor',
  supplier_refund: 'Devolución de proveedor',
  cogs: 'Costo de venta',
  cogs_return: 'Reverso de costo (devolución)'
}

const exportLedger = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || isExporting.value) return
  isExporting.value = true
  try {
    const rows = await getRevenueLedger(companyId, range.from, range.to)
    const header = ['Fecha', 'Concepto', 'Canal', 'Orden', 'Importe', 'Importe sin IVA', 'Cantidad']
    const body = rows.map(r => [
      new Date(r.occurred_at).toLocaleString('es-MX'),
      kindLabels[r.kind] ?? r.kind,
      channelLabel(r.channel),
      r.order_name ?? '',
      r.amount,
      r.amount_net,
      r.quantity ?? ''
    ])
    downloadCsv(`libro-ingresos-${range.from}-a-${range.to}`, header, body)
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Reporte de ventas</h1>
        <p class="mt-1 text-sm text-slate-500">
          Base de caja: el ingreso cuenta cuando se cobra; el costo, cuando la mercancía sale del almacén.
        </p>
      </div>
      <BtnApp
        variant="secondary"
        size="sm"
        :loading="isExporting"
        :disabled="!kpis"
        label="Exportar libro (CSV)"
        @click="exportLedger"
      />
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

    <div v-if="isLoading && !kpis" class="py-20 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
      <p class="mt-3 text-sm text-slate-400">Calculando…</p>
    </div>

    <template v-if="kpis">
      <!-- KPIs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" :class="isLoading ? 'opacity-60' : ''">
        <div
          v-for="card in cards"
          :key="card.key"
          class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-1 text-xl font-bold tabular-nums" :class="toneClasses[card.tone]">{{ card.value }}</p>
          <p class="mt-1 text-xs text-slate-400">{{ card.hint }}</p>
        </div>
      </div>

      <!-- Mensual -->
      <section class="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50">
        <h2 class="text-sm font-bold text-slate-800">Cobrado vs. pagado a proveedores, por mes</h2>
        <p class="mt-0.5 text-xs text-slate-500">Importes con IVA, en la fecha del pago.</p>
        <div class="mt-4">
          <ChartMonthlyBars :data="chartData" :currency="currency" />
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Canales -->
        <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
          <h2 class="px-5 pt-4 text-sm font-bold text-slate-800">Por canal</h2>
          <table class="mt-3 w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left">Canal</th>
                <th class="px-3 py-2 text-right">Cobrado</th>
                <th class="px-3 py-2 text-right">Sin IVA</th>
                <th class="px-3 py-2 text-right">Costo</th>
                <th class="px-5 py-2 text-right">Órdenes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="kpis.by_channel.length === 0">
                <td colspan="5" class="px-5 py-6 text-center text-slate-400">Sin movimientos en el periodo.</td>
              </tr>
              <tr v-for="c in kpis.by_channel" :key="c.channel" class="border-t border-slate-100">
                <td class="px-5 py-2 text-slate-700">{{ channelLabel(c.channel) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(c.net_collected) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(c.net_revenue) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(c.cogs) }}</td>
                <td class="px-5 py-2 text-right tabular-nums">{{ c.orders }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Cartera -->
        <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
          <div class="flex items-center justify-between px-5 pt-4">
            <h2 class="text-sm font-bold text-slate-800">Antigüedad de cuentas por cobrar</h2>
            <NuxtLink to="/admin/orders" class="text-xs font-medium text-indigo-600 hover:underline">Ver órdenes</NuxtLink>
          </div>
          <table class="mt-3 w-full text-sm">
            <tbody>
              <tr v-for="a in agingRows" :key="a.label" class="border-t border-slate-100">
                <td class="px-5 py-2 text-slate-700">{{ a.label }}</td>
                <td class="px-5 py-2 text-right tabular-nums" :class="a.value > 0 && a.label !== 'Al corriente' ? 'text-amber-700 font-semibold' : ''">
                  {{ money(a.value) }}
                </td>
              </tr>
              <tr class="border-t border-slate-200 bg-slate-50">
                <td class="px-5 py-2 font-semibold text-slate-800">Total</td>
                <td class="px-5 py-2 text-right font-semibold tabular-nums">{{ money(kpis.receivables.total) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Productos -->
        <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
          <h2 class="px-5 pt-4 text-sm font-bold text-slate-800">Productos más vendidos</h2>
          <p class="px-5 text-xs text-slate-500">Unidades entregadas en el periodo, valuadas a su precio de venta sin IVA.</p>
          <table class="mt-3 w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left">Producto</th>
                <th class="px-3 py-2 text-right">Unidades</th>
                <th class="px-3 py-2 text-right">Venta</th>
                <th class="px-3 py-2 text-right">Costo</th>
                <th class="px-5 py-2 text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="kpis.top_products.length === 0">
                <td colspan="5" class="px-5 py-6 text-center text-slate-400">Sin entregas en el periodo.</td>
              </tr>
              <tr v-for="p in kpis.top_products" :key="p.product_id" class="border-t border-slate-100">
                <td class="px-5 py-2">
                  <NuxtLink :to="`/admin/inventory/${p.product_id}`" class="text-slate-700 hover:text-indigo-600">{{ p.name }}</NuxtLink>
                </td>
                <td class="px-3 py-2 text-right tabular-nums">{{ units(p.units) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(p.revenue) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(p.cogs) }}</td>
                <td class="px-5 py-2 text-right tabular-nums" :class="p.revenue - p.cogs < 0 ? 'text-rose-600' : 'text-emerald-700'">
                  {{ money(p.revenue - p.cogs) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Métodos -->
        <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
          <h2 class="px-5 pt-4 text-sm font-bold text-slate-800">Por método de pago</h2>
          <table class="mt-3 w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left">Método</th>
                <th class="px-3 py-2 text-right">Movimientos</th>
                <th class="px-5 py-2 text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="kpis.by_payment_method.length === 0">
                <td colspan="3" class="px-5 py-6 text-center text-slate-400">Sin cobros en el periodo.</td>
              </tr>
              <tr v-for="m in kpis.by_payment_method" :key="`${m.payment_method_id}-${m.name}`" class="border-t border-slate-100">
                <td class="px-5 py-2 text-slate-700">{{ m.name }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ m.count }}</td>
                <td class="px-5 py-2 text-right tabular-nums">{{ money(m.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <!-- Campañas -->
      <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
        <h2 class="px-5 pt-4 text-sm font-bold text-slate-800">Campañas</h2>
        <p class="px-5 text-xs text-slate-500">
          Cobrado de órdenes atribuidas a una campaña: por la sesión de la tienda en línea o por el lead del CRM
          (formularios del sitio con utm_source / utm_campaign).
        </p>
        <table class="mt-3 w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-2 text-left">Fuente</th>
              <th class="px-3 py-2 text-left">Campaña</th>
              <th class="px-3 py-2 text-right">Órdenes</th>
              <th class="px-5 py-2 text-right">Cobrado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="kpis.by_campaign.length === 0">
              <td colspan="4" class="px-5 py-6 text-center text-slate-400">Sin cobros atribuidos en el periodo.</td>
            </tr>
            <tr v-for="c in kpis.by_campaign" :key="`${c.utm_source}-${c.utm_campaign}`" class="border-t border-slate-100">
              <td class="px-5 py-2 text-slate-700">{{ c.utm_source }}</td>
              <td class="px-3 py-2 text-slate-500">{{ c.utm_campaign }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ c.orders }}</td>
              <td class="px-5 py-2 text-right tabular-nums">{{ money(c.net_collected) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p class="text-xs text-slate-400">
        Referencia (no es ingreso): {{ kpis.orders_confirmed.count }} ventas confirmadas en el periodo por
        {{ money(kpis.orders_confirmed.total) }}, cobradas o no.
      </p>
    </template>
  </div>
</template>
