<script setup lang="ts">
import type { Database } from '~/types/database.types'

type OrderView = Database['public']['Views']['v_orders']['Row']
type LeadView = Database['public']['Views']['v_crm_leads']['Row']

interface Props {
  orders: OrderView[]
  leads: LeadView[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), { loading: false })

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizeCurrency = (v: string | null | undefined) => v?.trim().toUpperCase() || 'MXN'

const formatFull = (amount: number, currency: string): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

const formatCompact = (amount: number, currency: string): string => {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const sym = new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? '$'

  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (abs >= 1_000) return `${sign}${sym}${Math.round(abs / 1_000)}K`
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

// ── Color map — all class strings must be literals for Tailwind scanning ──────

const colorMap = {
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50',
    icon: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    value: 'text-emerald-700'
  },
  rose: {
    card: 'border-rose-200 bg-rose-50/50 hover:bg-rose-50',
    icon: 'bg-rose-100',
    iconText: 'text-rose-600',
    value: 'text-rose-700'
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50',
    icon: 'bg-amber-100',
    iconText: 'text-amber-600',
    value: 'text-amber-700'
  },
  indigo: {
    card: 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50',
    icon: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    value: 'text-indigo-700'
  },
  slate: {
    card: 'border-slate-200 bg-slate-50/50 hover:bg-slate-50',
    icon: 'bg-slate-100',
    iconText: 'text-slate-600',
    value: 'text-slate-700'
  },
  violet: {
    card: 'border-violet-200 bg-violet-50/50 hover:bg-violet-50',
    icon: 'bg-violet-100',
    iconText: 'text-violet-600',
    value: 'text-violet-700'
  }
} as const

type ColorKey = keyof typeof colorMap

// ── Icon paths ────────────────────────────────────────────────────────────────

const ICONS = {
  trendingUp:
    'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
  trendingDown:
    'M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181',
  scale:
    'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z',
  doc:
    'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  users:
    'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  funnel:
    'M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z',
  checkBadge:
    'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
  xCircle:
    'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  currency:
    'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
} as const

// ── Card interface ────────────────────────────────────────────────────────────

interface MetricCard {
  id: string
  label: string
  value: string
  valueFull: string
  sub: string
  color: ColorKey
  iconPath: string
  href?: string
}

interface CurrencyGroup {
  currency: string
  cards: MetricCard[]
}

// ── Financial aggregation ─────────────────────────────────────────────────────

interface CurrencyFinancial {
  currency: string
  income: number
  incomeCount: number
  expense: number
  expenseCount: number
  draftSaleCount: number
  draftPurchaseCount: number
}

const financialByCurrency = computed<CurrencyFinancial[]>(() => {
  const map = new Map<string, CurrencyFinancial>()

  for (const order of props.orders) {
    if (!order.order_type || !order.order_state) continue
    if (order.order_state === 'cancelled') continue

    const cur = normalizeCurrency(order.currency)
    if (!map.has(cur)) {
      map.set(cur, {
        currency: cur,
        income: 0,
        incomeCount: 0,
        expense: 0,
        expenseCount: 0,
        draftSaleCount: 0,
        draftPurchaseCount: 0
      })
    }

    const b = map.get(cur)!
    const amt = Number(order.amount_total ?? 0)

    if (order.order_state === 'draft') {
      if (order.order_type === 'sale') b.draftSaleCount++
      else if (order.order_type === 'purchase') b.draftPurchaseCount++
    } else if (order.order_state === 'posted') {
      if (order.order_type === 'sale') {
        b.income += amt
        b.incomeCount++
      } else if (order.order_type === 'purchase') {
        b.expense += amt
        b.expenseCount++
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.currency.localeCompare(b.currency))
})

const financialGroups = computed<CurrencyGroup[]>(() =>
  financialByCurrency.value.map((m) => {
    const balance = m.income - m.expense
    const balancePositive = balance >= 0
    const totalDraft = m.draftSaleCount + m.draftPurchaseCount

    return {
      currency: m.currency,
      cards: [
        {
          id: `income-${m.currency}`,
          label: 'Ingresos confirmados',
          value: formatCompact(m.income, m.currency),
          valueFull: formatFull(m.income, m.currency),
          sub: `${m.incomeCount} ${m.incomeCount === 1 ? 'venta confirmada' : 'ventas confirmadas'}`,
          color: 'emerald',
          iconPath: ICONS.trendingUp,
          href: '/admin/orders'
        },
        {
          id: `expense-${m.currency}`,
          label: 'Egresos confirmados',
          value: formatCompact(m.expense, m.currency),
          valueFull: formatFull(m.expense, m.currency),
          sub: `${m.expenseCount} ${m.expenseCount === 1 ? 'compra confirmada' : 'compras confirmadas'}`,
          color: 'rose',
          iconPath: ICONS.trendingDown,
          href: '/admin/orders'
        },
        {
          id: `balance-${m.currency}`,
          label: 'Balance neto',
          value: (balancePositive ? '+' : '') + formatCompact(balance, m.currency),
          valueFull: (balancePositive ? '+' : '') + formatFull(balance, m.currency),
          sub: `${m.currency} · ventas − compras`,
          color: balancePositive ? 'emerald' : 'rose',
          iconPath: ICONS.scale
        },
        {
          id: `draft-${m.currency}`,
          label: 'Órdenes en borrador',
          value: String(totalDraft),
          valueFull: `${totalDraft} ${totalDraft === 1 ? 'orden' : 'órdenes'}`,
          sub: `${m.draftSaleCount} venta${m.draftSaleCount !== 1 ? 's' : ''} · ${m.draftPurchaseCount} compra${m.draftPurchaseCount !== 1 ? 's' : ''}`,
          color: 'amber',
          iconPath: ICONS.doc,
          href: '/admin/orders'
        }
      ] as MetricCard[]
    }
  })
)

// ── CRM / Leads aggregation ───────────────────────────────────────────────────

interface LeadCurrencyMetric {
  currency: string
  pipelineAmount: number
  wonAmount: number
}

const leadsTotal = computed(() => props.leads.length)
const leadsOpen = computed(() => props.leads.filter((l) => !l.is_won && !l.is_lost).length)
const leadsWon = computed(() => props.leads.filter((l) => l.is_won).length)
const leadsLost = computed(() => props.leads.filter((l) => l.is_lost).length)

const leadCurrencyMetrics = computed<LeadCurrencyMetric[]>(() => {
  const map = new Map<string, LeadCurrencyMetric>()

  for (const lead of props.leads) {
    const cur = normalizeCurrency(lead.currency)
    if (!map.has(cur)) map.set(cur, { currency: cur, pipelineAmount: 0, wonAmount: 0 })
    const b = map.get(cur)!
    const amt = Number(lead.amount ?? 0)
    if (lead.is_won) b.wonAmount += amt
    else if (!lead.is_lost) b.pipelineAmount += amt
  }

  return Array.from(map.values())
    .filter((m) => m.pipelineAmount > 0 || m.wonAmount > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency))
})

const crmCountCards = computed<MetricCard[]>(() => [
  {
    id: 'leads-total',
    label: 'Leads totales',
    value: String(leadsTotal.value),
    valueFull: `${leadsTotal.value} leads`,
    sub: leadsTotal.value === 1 ? 'lead registrado' : 'leads registrados',
    color: 'slate',
    iconPath: ICONS.users,
    href: '/admin/crm'
  },
  {
    id: 'leads-open',
    label: 'En pipeline',
    value: String(leadsOpen.value),
    valueFull: `${leadsOpen.value} leads activos`,
    sub: leadsOpen.value === 1 ? 'lead activo' : 'leads activos',
    color: 'indigo',
    iconPath: ICONS.funnel,
    href: '/admin/crm'
  },
  {
    id: 'leads-won',
    label: 'Ganados',
    value: String(leadsWon.value),
    valueFull: `${leadsWon.value} ganados`,
    sub: leadsWon.value === 1 ? 'lead cerrado' : 'leads cerrados',
    color: 'emerald',
    iconPath: ICONS.checkBadge,
    href: '/admin/crm'
  },
  {
    id: 'leads-lost',
    label: 'Perdidos',
    value: String(leadsLost.value),
    valueFull: `${leadsLost.value} perdidos`,
    sub: leadsLost.value === 1 ? 'lead perdido' : 'leads perdidos',
    color: 'rose',
    iconPath: ICONS.xCircle,
    href: '/admin/crm'
  }
])

const crmAmountGroups = computed<CurrencyGroup[]>(() =>
  leadCurrencyMetrics.value.map((m) => ({
    currency: m.currency,
    cards: [
      {
        id: `pipeline-${m.currency}`,
        label: 'Monto en pipeline',
        value: formatCompact(m.pipelineAmount, m.currency),
        valueFull: formatFull(m.pipelineAmount, m.currency),
        sub: `leads abiertos · ${m.currency}`,
        color: 'indigo',
        iconPath: ICONS.currency,
        href: '/admin/crm'
      },
      {
        id: `won-${m.currency}`,
        label: 'Monto ganado',
        value: formatCompact(m.wonAmount, m.currency),
        valueFull: formatFull(m.wonAmount, m.currency),
        sub: `leads cerrados · ${m.currency}`,
        color: 'emerald',
        iconPath: ICONS.currency,
        href: '/admin/crm'
      }
    ] as MetricCard[]
  }))
)

const financialCardCount = computed(() =>
  financialGroups.value.reduce((s, g) => s + g.cards.length, 0)
)

const allCards = computed<MetricCard[]>(() => {
  const cards: MetricCard[] = []
  for (const group of financialGroups.value) cards.push(...group.cards)
  cards.push(...crmCountCards.value)
  for (const group of crmAmountGroups.value) cards.push(...group.cards)
  return cards
})
</script>

<template>
  <div class="mt-6">
    <div class="mb-2.5 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-slate-700">
        Métricas del contacto
      </h3>
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/admin/orders"
          class="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Órdenes →
        </NuxtLink>
        <NuxtLink
          to="/admin/crm"
          class="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Leads →
        </NuxtLink>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="flex gap-2.5 overflow-x-auto pb-1">
      <div
        v-for="i in 8"
        :key="i"
        class="h-[88px] min-w-[130px] shrink-0 animate-pulse rounded-xl bg-slate-100"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="allCards.length === 0"
      class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 text-center text-xs text-slate-500"
    >
      Sin actividad registrada para este contacto.
    </div>

    <!-- Single row -->
    <div v-else class="flex gap-2.5 overflow-x-auto pb-1">
      <template v-for="(card, idx) in allCards" :key="card.id">
        <!-- Visual separator between financial and CRM sections -->
        <div
          v-if="idx === financialCardCount && financialCardCount > 0"
          class="mx-0.5 w-px shrink-0 self-stretch bg-slate-200"
        />

        <component
          :is="card.href ? 'NuxtLink' : 'div'"
          :to="card.href"
          :title="card.valueFull"
          :class="[
            'group min-w-[130px] shrink-0 rounded-xl border p-3 transition-all',
            colorMap[card.color].card,
            card.href ? 'cursor-pointer hover:shadow-md hover:shadow-slate-200/50' : ''
          ]"
        >
          <div class="flex items-start justify-between gap-1.5">
            <p class="text-[11px] font-medium leading-tight text-slate-500">
              {{ card.label }}
            </p>
            <div :class="['shrink-0 rounded-md p-1', colorMap[card.color].icon]">
              <svg
                class="h-3 w-3"
                :class="colorMap[card.color].iconText"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  :d="card.iconPath"
                />
              </svg>
            </div>
          </div>
          <p
            :class="[
              'mt-1.5 text-base font-bold leading-tight tabular-nums',
              colorMap[card.color].value
            ]"
          >
            {{ card.value }}
          </p>
          <p class="mt-0.5 text-[10px] leading-tight text-slate-400">
            {{ card.sub }}
          </p>
        </component>
      </template>
    </div>
  </div>
</template>
