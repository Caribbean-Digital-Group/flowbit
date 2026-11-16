<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { downloadCsv } from '~/utils/csv'
import {
  AGING_BUCKET_LABELS,
  STATEMENT_KIND_LABELS,
  agingBucket,
  bucketBalances,
  buildStatement,
  overdueAmount,
  statementTotals,
  type PartnerStatement
} from '~/utils/receivables'
import type { BalanceKind } from '~/composables/useReceivables'

definePageMeta({ layout: 'admin' })

/**
 * Estado de cuenta de un contacto: órdenes confirmadas, cobros/pagos,
 * devoluciones y reembolsos en orden cronológico con saldo acumulado, más las
 * órdenes abiertas con días de atraso. Imprimible y exportable a CSV.
 */
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getPartnerStatement, lastError } = useReceivables()

const partnerId = computed(() => String(route.params.partnerId ?? ''))
const kind = computed<BalanceKind>(() => (route.query.kind === 'purchase' ? 'purchase' : 'sale'))
const isSale = computed(() => kind.value === 'sale')

type Period = 'all' | 'last_90' | 'this_year' | 'custom'
const periodOptions: { value: Period; label: string }[] = [
  { value: 'all', label: 'Todo el historial' },
  { value: 'last_90', label: 'Últimos 90 días' },
  { value: 'this_year', label: 'Este año' },
  { value: 'custom', label: 'Desde…' }
]

const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const period = ref<Period>('all')
const customFrom = ref('')

const fromDate = computed<string | null>(() => {
  const now = new Date()
  if (period.value === 'last_90') {
    const d = new Date(now)
    d.setDate(d.getDate() - 89)
    return toIsoDate(d)
  }
  if (period.value === 'this_year') return toIsoDate(new Date(now.getFullYear(), 0, 1))
  if (period.value === 'custom') return customFrom.value || null
  return null
})

const statement = ref<PartnerStatement | null>(null)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !partnerId.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    statement.value = await getPartnerStatement(companyId, partnerId.value, kind.value, fromDate.value)
    if (!statement.value) errorMessage.value = lastError.value
    else if (!statement.value.partner) errorMessage.value = 'No se encontró el contacto.'
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, partnerId, kind, fromDate], () => { void load() }, { immediate: true })

const currency = computed(() => statement.value?.currency ?? 'MXN')
const money = (value: number | null | undefined, code?: string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: code || currency.value }).format(Number(value ?? 0))

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const kindLabels = computed(() => STATEMENT_KIND_LABELS[kind.value])
const lines = computed(() => (statement.value ? buildStatement(statement.value.opening_balance, statement.value.entries) : []))
const totals = computed(() =>
  statement.value ? statementTotals(statement.value.opening_balance, statement.value.entries) : null
)
const aging = computed(() => bucketBalances(statement.value?.open_orders ?? []))
const overdue = computed(() => overdueAmount(aging.value))

const partnerName = computed(() => statement.value?.partner?.name ?? 'Contacto')
const title = computed(() => `Estado de cuenta · ${partnerName.value}`)

const handleBack = () => {
  void router.push(`/admin/reports/receivables${isSale.value ? '' : '?kind=purchase'}`)
}

const overdueTone = (days: number): string => {
  const bucket = agingBucket(days)
  if (bucket === 'current') return 'bg-emerald-50 text-emerald-700'
  if (bucket === 'd1_30') return 'bg-amber-50 text-amber-700'
  if (bucket === 'd31_60') return 'bg-orange-50 text-orange-700'
  return 'bg-rose-50 text-rose-700'
}

const overdueLabel = (days: number): string => {
  if (days < 0) return `Vence en ${-days} d`
  if (days === 0) return 'Vence hoy'
  return `${days} d de atraso`
}

// ── Exportación ──────────────────────────────────────────────────────────────
const exportCsv = () => {
  const s = statement.value
  if (!s || !totals.value) return
  const header = ['Fecha', 'Movimiento', 'Orden', 'Referencia', 'Cargo', 'Abono', 'Saldo']
  const body: (string | number)[][] = [
    ['', 'Saldo inicial', '', '', '', '', totals.value.opening],
    ...lines.value.map(l => [
      l.date,
      kindLabels.value[l.kind],
      l.order_name ?? '',
      l.reference ?? '',
      l.charge || '',
      l.credit || '',
      l.balance
    ]),
    ['', 'Saldo final', '', '', totals.value.charges, totals.value.credits, totals.value.closing]
  ]
  const slug = partnerName.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  downloadCsv(`estado-de-cuenta-${slug || 'contacto'}-${s.as_of}`, header, body)
}

const escapeHtml = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Imprime el estado de cuenta en un iframe oculto (sin el layout del panel). */
const printStatement = () => {
  const s = statement.value
  const t = totals.value
  if (!s || !t || !import.meta.client) return

  const rowsHtml = lines.value.map(l => `
    <tr>
      <td>${escapeHtml(formatDate(l.date))}</td>
      <td>${escapeHtml(kindLabels.value[l.kind])}</td>
      <td>${escapeHtml(l.order_name)}</td>
      <td>${escapeHtml(l.reference)}</td>
      <td class="num">${l.charge ? escapeHtml(money(l.charge)) : ''}</td>
      <td class="num">${l.credit ? escapeHtml(money(l.credit)) : ''}</td>
      <td class="num">${escapeHtml(money(l.balance))}</td>
    </tr>`).join('')

  const openHtml = s.open_orders.map(o => `
    <tr>
      <td>${escapeHtml(o.order_name)}</td>
      <td>${escapeHtml(formatDate(o.due_date))}</td>
      <td>${escapeHtml(overdueLabel(o.days_overdue))}</td>
      <td class="num">${escapeHtml(money(o.balance))}</td>
    </tr>`).join('')

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>${escapeHtml(title.value)}</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px;font-size:12px}
      h1{font-size:18px;margin:0}h2{font-size:13px;margin:24px 0 8px}
      .muted{color:#64748b}.num{text-align:right;font-variant-numeric:tabular-nums}
      table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
      th{background:#f8fafc;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#475569}
      .summary{display:flex;gap:24px;margin-top:16px}.summary div{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px}
      .summary strong{display:block;font-size:14px}
    </style></head><body>
    <h1>Estado de cuenta</h1>
    <p class="muted">${escapeHtml(selectedCompany.value?.name ?? '')}</p>
    <p><strong>${escapeHtml(partnerName.value)}</strong>${s.partner?.vat ? ` · RFC ${escapeHtml(s.partner.vat)}` : ''}<br>
      <span class="muted">${escapeHtml([s.partner?.email, s.partner?.phone].filter(Boolean).join(' · '))}</span></p>
    <p class="muted">${s.from ? `Del ${escapeHtml(formatDate(s.from))} ` : 'Todo el historial, '}al ${escapeHtml(formatDate(s.as_of))} · Importes en ${escapeHtml(s.currency)}</p>
    <div class="summary">
      <div><span class="muted">Saldo inicial</span><strong>${escapeHtml(money(t.opening))}</strong></div>
      <div><span class="muted">Cargos</span><strong>${escapeHtml(money(t.charges))}</strong></div>
      <div><span class="muted">Abonos</span><strong>${escapeHtml(money(t.credits))}</strong></div>
      <div><span class="muted">Saldo</span><strong>${escapeHtml(money(t.closing))}</strong></div>
    </div>
    <h2>Movimientos</h2>
    <table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Orden</th><th>Referencia</th><th class="num">Cargo</th><th class="num">Abono</th><th class="num">Saldo</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="7" class="muted">Sin movimientos en el periodo.</td></tr>'}</tbody></table>
    ${openHtml ? `<h2>Órdenes con saldo pendiente</h2>
    <table><thead><tr><th>Orden</th><th>Vence</th><th>Estado</th><th class="num">Saldo</th></tr></thead><tbody>${openHtml}</tbody></table>` : ''}
    </body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe)
    errorMessage.value = 'No se pudo inicializar la impresión en este navegador.'
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
    }, 1000)
  }, 150)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <button
          type="button"
          class="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
          @click="handleBack"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Antigüedad de saldos
        </button>
        <h1 class="truncate text-2xl font-bold text-slate-800">{{ partnerName }}</h1>
        <p class="mt-1 text-sm text-slate-500">
          Estado de cuenta {{ isSale ? 'como cliente' : 'como proveedor' }}
          <template v-if="statement?.partner?.email || statement?.partner?.phone">
            · {{ [statement?.partner?.email, statement?.partner?.phone].filter(Boolean).join(' · ') }}
          </template>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="statement?.partner"
          :to="`/admin/partners/${partnerId}`"
          class="inline-flex items-center rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Ver contacto
        </NuxtLink>
        <BtnApp variant="secondary" size="sm" :disabled="!statement?.partner" label="Imprimir" @click="printStatement" />
        <BtnApp variant="secondary" size="sm" :disabled="!statement?.partner" label="Exportar CSV" @click="exportCsv" />
      </div>
    </div>

    <!-- Periodo -->
    <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in periodOptions"
            :key="p.value"
            type="button"
            class="rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="period === p.value
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
            @click="period = p.value"
          >
            {{ p.label }}
          </button>
        </div>
        <FormInput v-if="period === 'custom'" v-model="customFrom" type="date" label="Desde" size="sm" />
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading && !statement" class="py-20 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
      <p class="mt-3 text-sm text-slate-400">Cargando estado de cuenta…</p>
    </div>

    <template v-if="statement?.partner && totals">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" :class="isLoading ? 'opacity-60' : ''">
        <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ isSale ? 'Saldo por cobrar' : 'Saldo por pagar' }}</p>
          <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">{{ money(aging.total) }}</p>
          <p class="mt-1 text-xs text-slate-400">{{ statement.open_orders.length }} órdenes abiertas</p>
        </div>
        <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Vencido</p>
          <p class="mt-1 text-xl font-bold tabular-nums" :class="overdue > 0 ? 'text-rose-600' : 'text-emerald-600'">{{ money(overdue) }}</p>
          <p class="mt-1 text-xs text-slate-400">
            {{ aging.d90_plus > 0 ? `${money(aging.d90_plus)} con más de 90 días` : overdue > 0 ? 'Revisa las órdenes abajo' : 'Todo al corriente' }}
          </p>
        </div>
        <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cargos del periodo</p>
          <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">{{ money(totals.charges) }}</p>
          <p class="mt-1 text-xs text-slate-400">Saldo inicial {{ money(totals.opening) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Abonos del periodo</p>
          <p class="mt-1 text-xl font-bold tabular-nums text-emerald-600">{{ money(totals.credits) }}</p>
          <p class="mt-1 text-xs text-slate-400">{{ isSale ? 'Cobros y devoluciones' : 'Pagos y devoluciones' }}</p>
        </div>
      </div>

      <!-- Órdenes abiertas -->
      <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
        <h2 class="px-5 pt-4 text-sm font-bold text-slate-800">Órdenes con saldo pendiente</h2>
        <div class="overflow-x-auto">
          <table class="mt-3 w-full min-w-[40rem] text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left">Orden</th>
                <th class="px-3 py-2 text-left">Fecha</th>
                <th class="px-3 py-2 text-left">Vence</th>
                <th class="px-3 py-2 text-left">Antigüedad</th>
                <th class="px-3 py-2 text-right">Total</th>
                <th class="px-5 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="statement.open_orders.length === 0">
                <td colspan="6" class="px-5 py-6 text-center text-slate-400">Sin saldos pendientes.</td>
              </tr>
              <tr v-for="o in statement.open_orders" :key="o.order_id" class="border-t border-slate-100">
                <td class="px-5 py-2">
                  <NuxtLink :to="`/admin/orders/${o.order_id}`" class="font-medium text-slate-700 hover:text-indigo-600">{{ o.order_name ?? '—' }}</NuxtLink>
                </td>
                <td class="px-3 py-2 text-slate-500">{{ formatDate(o.order_date) }}</td>
                <td class="px-3 py-2 text-slate-500">{{ formatDate(o.due_date) }}</td>
                <td class="px-3 py-2">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="overdueTone(o.days_overdue)" :title="AGING_BUCKET_LABELS[agingBucket(o.days_overdue)]">
                    {{ overdueLabel(o.days_overdue) }}
                  </span>
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-500">{{ money(o.amount_total, o.currency) }}</td>
                <td class="px-5 py-2 text-right font-semibold tabular-nums text-slate-800">{{ money(o.balance) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Movimientos -->
      <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
        <h2 class="px-5 pt-4 text-sm font-bold text-slate-800">Movimientos</h2>
        <p class="px-5 text-xs text-slate-500">
          Cargos: {{ isSale ? 'ventas confirmadas y reembolsos entregados' : 'compras confirmadas y reembolsos recibidos' }}.
          Abonos: {{ isSale ? 'cobros' : 'pagos' }} y devoluciones.
        </p>
        <div class="overflow-x-auto">
          <table class="mt-3 w-full min-w-[48rem] text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left">Fecha</th>
                <th class="px-3 py-2 text-left">Movimiento</th>
                <th class="px-3 py-2 text-left">Orden</th>
                <th class="px-3 py-2 text-left">Referencia</th>
                <th class="px-3 py-2 text-right">Cargo</th>
                <th class="px-3 py-2 text-right">Abono</th>
                <th class="px-5 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="statement.from" class="border-t border-slate-100 bg-slate-50/60">
                <td class="px-5 py-2 text-slate-500">{{ formatDate(statement.from) }}</td>
                <td colspan="5" class="px-3 py-2 font-medium text-slate-600">Saldo inicial</td>
                <td class="px-5 py-2 text-right font-semibold tabular-nums">{{ money(totals.opening) }}</td>
              </tr>
              <tr v-if="lines.length === 0">
                <td colspan="7" class="px-5 py-6 text-center text-slate-400">Sin movimientos en el periodo.</td>
              </tr>
              <tr v-for="(l, i) in lines" :key="`${l.kind}-${l.order_id}-${i}`" class="border-t border-slate-100">
                <td class="px-5 py-2 text-slate-500">{{ formatDate(l.date) }}</td>
                <td class="px-3 py-2 text-slate-700">{{ kindLabels[l.kind] }}</td>
                <td class="px-3 py-2">
                  <NuxtLink :to="`/admin/orders/${l.order_id}`" class="text-slate-600 hover:text-indigo-600">{{ l.order_name ?? '—' }}</NuxtLink>
                </td>
                <td class="px-3 py-2 text-slate-500">{{ l.reference ?? '' }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ l.charge ? money(l.charge) : '' }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-emerald-700">{{ l.credit ? money(l.credit) : '' }}</td>
                <td class="px-5 py-2 text-right font-medium tabular-nums">{{ money(l.balance) }}</td>
              </tr>
            </tbody>
            <tfoot v-if="lines.length > 0">
              <tr class="border-t border-slate-200 bg-slate-50 font-semibold">
                <td colspan="4" class="px-5 py-2 text-slate-800">Saldo final</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(totals.charges) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ money(totals.credits) }}</td>
                <td class="px-5 py-2 text-right tabular-nums">{{ money(totals.closing) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p class="text-xs text-slate-400">
        Importes en {{ currency }}: las órdenes en otra moneda se convierten con su tipo de cambio. Las órdenes condonadas aparecen en los movimientos, pero no cuentan como saldo pendiente.
      </p>
    </template>
  </div>
</template>
