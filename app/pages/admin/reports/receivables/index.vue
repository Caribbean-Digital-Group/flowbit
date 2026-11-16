<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { downloadCsv } from '~/utils/csv'
import {
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  bucketShare,
  filterAgingPartners,
  overdueAmount,
  type AgingBucket,
  type AgingReport
} from '~/utils/receivables'
import type { BalanceKind } from '~/composables/useReceivables'

definePageMeta({ layout: 'admin' })

/**
 * Antigüedad de saldos: quién debe (o a quién le debemos), cuánto y desde
 * cuándo. La agregación ocurre en `get_aging_report`; esta página presenta,
 * filtra y exporta. «Por pagar» usa las órdenes de compra.
 */
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAgingReport, lastError } = useReceivables()

const kind = ref<BalanceKind>(route.query.kind === 'purchase' ? 'purchase' : 'sale')
const report = ref<AgingReport | null>(null)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const search = ref('')
const onlyOverdue = ref(false)

const kindOptions: { value: BalanceKind; label: string }[] = [
  { value: 'sale', label: 'Por cobrar (clientes)' },
  { value: 'purchase', label: 'Por pagar (proveedores)' }
]

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  errorMessage.value = null
  try {
    report.value = await getAgingReport(companyId, kind.value)
    if (!report.value) errorMessage.value = lastError.value
  } finally {
    isLoading.value = false
  }
}

const selectKind = (value: BalanceKind) => {
  if (kind.value === value) return
  kind.value = value
  void router.replace({ query: { ...route.query, kind: value === 'purchase' ? 'purchase' : undefined } })
}

watch([selectedCompanyId, kind], () => { void load() }, { immediate: true })

const isSale = computed(() => kind.value === 'sale')
const partyLabel = computed(() => (isSale.value ? 'Cliente' : 'Proveedor'))
const currency = computed(() => report.value?.currency ?? 'MXN')

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.value }).format(Number(value ?? 0))

const asOfLabel = computed(() => {
  const asOf = report.value?.as_of
  if (!asOf) return ''
  const [y, m, d] = asOf.split('-').map(Number)
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
})

const rows = computed(() => {
  const all = report.value?.partners ?? []
  const filtered = filterAgingPartners(all, search.value)
  return onlyOverdue.value ? filtered.filter(r => overdueAmount(r) > 0.005) : filtered
})

const bucketTone: Record<AgingBucket, string> = {
  current: 'bg-emerald-500',
  d1_30: 'bg-amber-400',
  d31_60: 'bg-orange-500',
  d61_90: 'bg-rose-500',
  d90_plus: 'bg-rose-700'
}

const cards = computed(() => {
  const t = report.value?.totals
  if (!t) return []
  const overdue = overdueAmount(t)
  return [
    {
      key: 'total',
      label: isSale.value ? 'Total por cobrar' : 'Total por pagar',
      value: money(t.total),
      hint: `${t.count} órdenes de ${t.partners} ${isSale.value ? 'clientes' : 'proveedores'}`,
      tone: 'text-slate-800'
    },
    {
      key: 'current',
      label: 'Al corriente',
      value: money(t.current),
      hint: `${bucketShare(t.current, t.total)} % del total`,
      tone: 'text-emerald-600'
    },
    {
      key: 'overdue',
      label: 'Vencido',
      value: money(overdue),
      hint: `${bucketShare(overdue, t.total)} % del total`,
      tone: overdue > 0 ? 'text-amber-600' : 'text-slate-800'
    },
    {
      key: 'd90',
      label: 'Más de 90 días',
      value: money(t.d90_plus),
      hint: t.d90_plus > 0 ? 'Prioridad de cobranza' : 'Sin saldos críticos',
      tone: t.d90_plus > 0 ? 'text-rose-600' : 'text-slate-800'
    }
  ]
})

const statementLink = (partnerId: string): string =>
  `/admin/reports/receivables/${partnerId}${isSale.value ? '' : '?kind=purchase'}`

const exportCsv = () => {
  if (!report.value) return
  const header = [partyLabel.value, 'Correo', 'Teléfono', 'Órdenes', ...AGING_BUCKETS.map(b => AGING_BUCKET_LABELS[b]), 'Total', 'Días máx. de atraso']
  const body = rows.value.map(r => [
    r.partner_name,
    r.partner_email ?? '',
    r.partner_phone ?? '',
    r.order_count,
    ...AGING_BUCKETS.map(b => r[b]),
    r.total,
    r.max_days_overdue
  ])
  const prefix = isSale.value ? 'cuentas-por-cobrar' : 'cuentas-por-pagar'
  downloadCsv(`${prefix}-${report.value.as_of}`, header, body)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Antigüedad de saldos</h1>
        <p class="mt-1 text-sm text-slate-500">
          {{ isSale ? 'Quién te debe' : 'A quién le debes' }}, cuánto y desde cuándo.
          <span v-if="asOfLabel">Corte al {{ asOfLabel }}.</span>
        </p>
      </div>
      <BtnApp
        variant="secondary"
        size="sm"
        :disabled="!report || rows.length === 0"
        label="Exportar CSV"
        @click="exportCsv"
      />
    </div>

    <!-- Tipo y filtros -->
    <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="k in kindOptions"
            :key="k.value"
            type="button"
            class="rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
            :class="kind === k.value
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
            @click="selectKind(k.value)"
          >
            {{ k.label }}
          </button>
        </div>
        <div class="min-w-[14rem] flex-1">
          <FormInput v-model="search" type="search" :placeholder="`Buscar ${partyLabel.toLowerCase()} por nombre, correo o teléfono`" size="sm" />
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input v-model="onlyOverdue" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600">
          Solo con saldo vencido
        </label>
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
      {{ errorMessage }}
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

      <!-- Distribución por antigüedad -->
      <section
        v-if="report.totals.total > 0"
        class="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50"
      >
        <h2 class="text-sm font-bold text-slate-800">Distribución por antigüedad</h2>
        <div class="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            v-for="b in AGING_BUCKETS"
            :key="b"
            :class="bucketTone[b]"
            :style="{ width: `${bucketShare(report.totals[b], report.totals.total)}%` }"
            :title="`${AGING_BUCKET_LABELS[b]}: ${money(report.totals[b])}`"
          />
        </div>
        <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          <li v-for="b in AGING_BUCKETS" :key="b" class="flex items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 rounded-full" :class="bucketTone[b]" />
            {{ AGING_BUCKET_LABELS[b] }} · <span class="tabular-nums font-medium">{{ money(report.totals[b]) }}</span>
          </li>
        </ul>
      </section>

      <!-- Por contacto -->
      <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[56rem] text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left">{{ partyLabel }}</th>
                <th class="px-3 py-2 text-right">Órdenes</th>
                <th v-for="b in AGING_BUCKETS" :key="b" class="px-3 py-2 text-right">{{ AGING_BUCKET_LABELS[b] }}</th>
                <th class="px-5 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td :colspan="AGING_BUCKETS.length + 3" class="px-5 py-10 text-center text-slate-400">
                  <template v-if="report.partners.length === 0">
                    {{ isSale ? 'No hay saldos por cobrar. ¡Todo al día!' : 'No hay saldos por pagar a proveedores.' }}
                  </template>
                  <template v-else>Ningún contacto coincide con los filtros.</template>
                </td>
              </tr>
              <tr v-for="r in rows" :key="r.partner_id" class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-2">
                  <NuxtLink :to="statementLink(r.partner_id)" class="font-medium text-slate-700 hover:text-indigo-600">
                    {{ r.partner_name }}
                  </NuxtLink>
                  <p v-if="r.partner_email || r.partner_phone" class="text-xs text-slate-400">
                    {{ [r.partner_email, r.partner_phone].filter(Boolean).join(' · ') }}
                  </p>
                </td>
                <td class="px-3 py-2 text-right tabular-nums">{{ r.order_count }}</td>
                <td
                  v-for="b in AGING_BUCKETS"
                  :key="b"
                  class="px-3 py-2 text-right tabular-nums"
                  :class="r[b] > 0 && b !== 'current' ? (b === 'd90_plus' || b === 'd61_90' ? 'font-semibold text-rose-600' : 'font-semibold text-amber-700') : 'text-slate-500'"
                >
                  {{ r[b] > 0 ? money(r[b]) : '—' }}
                </td>
                <td class="px-5 py-2 text-right font-semibold tabular-nums text-slate-800">{{ money(r.total) }}</td>
              </tr>
            </tbody>
            <tfoot v-if="rows.length > 0 && !search && !onlyOverdue">
              <tr class="border-t border-slate-200 bg-slate-50 font-semibold">
                <td class="px-5 py-2 text-slate-800">Total</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ report.totals.count }}</td>
                <td v-for="b in AGING_BUCKETS" :key="b" class="px-3 py-2 text-right tabular-nums">{{ money(report.totals[b]) }}</td>
                <td class="px-5 py-2 text-right tabular-nums">{{ money(report.totals.total) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p class="text-xs text-slate-400">
        Solo órdenes confirmadas con saldo. El vencimiento es la fecha de pago de la orden; si no la tiene, la fecha de confirmación.
        Importes en {{ currency }}: las órdenes en otra moneda se convierten con su tipo de cambio.
      </p>
    </template>
  </div>
</template>
