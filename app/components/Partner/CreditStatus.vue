<script setup lang="ts">
import {
  evaluateCreditStatus,
  toCompanyCurrency,
  type PartnerCreditSummary
} from '~/utils/receivables'

/**
 * Badge «Vencido» y aviso de límite de crédito de un cliente (TRY-44).
 *
 * Lee el saldo abierto y vencido de `get_partner_statement` (vía
 * `useReceivables`). Solo avisa: nunca bloquea guardar ni confirmar. Si el
 * RPC falla o no existe, no muestra nada.
 */
interface Props {
  companyId?: string | null
  partnerId?: string | null
  /** Total de la orden en captura, en su propia moneda. 0 = sin orden. */
  orderAmount?: number
  orderCurrency?: string | null
  exchangeRate?: number | null
  /** Orden que se está editando: su saldo no se suma dos veces. */
  excludeOrderId?: string | null
  /** `partner.credit_limit`. `undefined` = se consulta el contacto. */
  creditLimit?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  companyId: null,
  partnerId: null,
  orderAmount: 0,
  orderCurrency: null,
  exchangeRate: null,
  excludeOrderId: null,
  creditLimit: undefined
})

const { getPartnerCreditSummary } = useReceivables()
const { getPartnerById } = usePartner()

const summary = ref<(PartnerCreditSummary & { currency: string }) | null>(null)
const fetchedLimit = ref<number | null>(null)
let requestSeq = 0

const load = async (): Promise<void> => {
  const seq = ++requestSeq
  summary.value = null
  fetchedLimit.value = null
  const { companyId, partnerId } = props
  if (!companyId || !partnerId) return

  try {
    const [result, partner] = await Promise.all([
      getPartnerCreditSummary(companyId, partnerId, 'sale', props.excludeOrderId),
      props.creditLimit === undefined ? getPartnerById(partnerId) : Promise.resolve(null)
    ])
    if (seq !== requestSeq) return
    summary.value = result
    fetchedLimit.value = partner?.credit_limit ?? null
  } catch (error) {
    console.error('Error loading partner credit status:', error)
    if (seq === requestSeq) summary.value = null
  }
}

watch(
  () => [props.companyId, props.partnerId, props.excludeOrderId] as const,
  () => { void load() },
  { immediate: true }
)

const creditLimit = computed(() =>
  props.creditLimit === undefined ? fetchedLimit.value : props.creditLimit
)

const orderTotal = computed(() =>
  summary.value
    ? toCompanyCurrency(props.orderAmount, props.orderCurrency, summary.value.currency, props.exchangeRate)
    : 0
)

const status = computed(() =>
  summary.value
    ? evaluateCreditStatus({
        openBalance: summary.value.openBalance,
        overdue: summary.value.overdue,
        orderTotal: orderTotal.value,
        creditLimit: creditLimit.value
      })
    : null
)

const formatMoney = (amount: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: summary.value?.currency || 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

const statementHref = computed(() =>
  props.partnerId ? `/admin/reports/receivables/${props.partnerId}` : '/admin/reports/receivables'
)

const overdueDetail = computed(() => {
  const s = summary.value
  if (!s) return ''
  const orders = s.overdueOrderCount === 1 ? '1 orden' : `${s.overdueOrderCount} órdenes`
  const days = s.maxDaysOverdue === 1 ? '1 día' : `${s.maxDaysOverdue} días`
  return `${orders} · hasta ${days} de atraso`
})
</script>

<template>
  <div v-if="summary && status && (status.hasOverdue || status.exceedsLimit)" class="space-y-3">
    <NuxtLink
      v-if="status.hasOverdue"
      :to="statementHref"
      class="inline-flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 transition-colors hover:bg-rose-100"
      title="Ver estado de cuenta"
    >
      <span class="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-semibold text-white">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Vencido
      </span>
      <span class="font-semibold">{{ formatMoney(summary.overdue) }}</span>
      <span class="text-rose-700/80">{{ overdueDetail }}</span>
    </NuxtLink>

    <div
      v-if="status.exceedsLimit"
      class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      role="status"
    >
      <svg class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <div>
        <p class="font-semibold">
          {{ orderTotal > 0 ? 'Esta venta supera el límite de crédito del cliente' : 'El saldo del cliente supera su límite de crédito' }}
        </p>
        <p class="mt-1 text-amber-800/90">
          Saldo abierto {{ formatMoney(summary.openBalance) }}<template v-if="orderTotal > 0"> + esta orden {{ formatMoney(orderTotal) }}</template>
          = {{ formatMoney(status.projectedBalance) }}; límite {{ formatMoney(creditLimit ?? 0) }}
          (excede por {{ formatMoney(status.excess) }}).
        </p>
        <p class="mt-1 text-xs text-amber-700">
          Es solo un aviso: puedes guardar y confirmar la orden.
        </p>
      </div>
    </div>
  </div>
</template>
