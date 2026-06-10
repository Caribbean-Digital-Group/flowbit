<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Database, Tables } from '~/types/database.types'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { PosSessionSummary } from '~/composables/usePosSession'

definePageMeta({ layout: 'admin' })

type PosSessionView = Database['public']['Views']['v_pos_sessions']['Row']
type PosCashMovement = Tables<'pos_cash_movement'>
type PosSessionCount = Tables<'pos_session_count'>
type PosPaymentView = Database['public']['Views']['v_pos_payments']['Row']
type OrderRowView = Database['public']['Views']['v_orders']['Row']

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const supabase = useSupabase()
const { selectedCompanyId } = storeToRefs(authStore)
const {
  getSessionViewById,
  getSessionSummary,
  getCashMovements,
  getSessionCounts,
  getSessionPayments
} = usePosSession()

const sessionId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isLoading = ref(true)
const session = ref<PosSessionView | null>(null)
const summary = ref<PosSessionSummary | null>(null)
const movements = ref<PosCashMovement[]>([])
const counts = ref<PosSessionCount[]>([])
const payments = ref<PosPaymentView[]>([])
const orders = ref<OrderRowView[]>([])

const methodNames = computed(() => {
  const map = new Map<string, string>()
  for (const m of summary.value?.methods ?? []) {
    map.set(m.payment_method_id, m.name)
  }
  for (const p of payments.value) {
    if (p.payment_method_id && p.payment_method_name) {
      map.set(p.payment_method_id, p.payment_method_name)
    }
  }
  return map
})

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0)

const formatDateTime = (value: string | null): string => {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'print',
    label: 'Imprimir reporte',
    icon: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
    action: () => printReport()
  }
])

const load = async () => {
  const id = sessionId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return

  isLoading.value = true
  try {
    const view = await getSessionViewById(id, cid)
    if (!view) { router.push('/admin/pos/sessions'); return }
    session.value = view

    const [summ, movs, cnts, pays, ordersResult] = await Promise.all([
      getSessionSummary(id),
      getCashMovements(id),
      getSessionCounts(id),
      getSessionPayments(id),
      supabase
        .from('v_orders')
        .select('*')
        .eq('company_id', cid)
        .eq('pos_session_id', id)
        .order('created_at', { ascending: false })
    ])

    summary.value = summ
    movements.value = movs
    counts.value = cnts
    payments.value = pays
    orders.value = ordersResult.data ?? []
  } finally {
    isLoading.value = false
  }
}

watch([sessionId, selectedCompanyId], () => { void load() }, { immediate: true })

const printReport = (): void => {
  const s = summary.value
  if (!s || !session.value) return

  const countRows = counts.value.map(c => `<tr>
      <td>${methodNames.value.get(c.payment_method_id) ?? c.payment_method_id}</td>
      <td style="text-align:right">${formatCurrency(Number(c.expected))}</td>
      <td style="text-align:right">${formatCurrency(Number(c.counted))}</td>
      <td style="text-align:right">${formatCurrency(Number(c.difference))}</td>
    </tr>`).join('')

  const methodRows = s.methods.map(m => `<tr>
      <td>${m.name}</td>
      <td style="text-align:right">${formatCurrency(m.sales_amount)}</td>
      <td style="text-align:right">-${formatCurrency(m.refunds_amount)}</td>
    </tr>`).join('')

  const movementRows = movements.value.map(m => `<tr>
      <td>${m.movement_type === 'in' ? 'Entrada' : 'Salida'}: ${m.reason}</td>
      <td style="text-align:right">${m.movement_type === 'in' ? '' : '-'}${formatCurrency(Number(m.amount))}</td>
    </tr>`).join('')

  const win = window.open('', '_blank', 'width=420,height=680')
  if (!win) return

  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
    <title>Corte — ${s.session_name}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 320px; margin: 0 auto; padding: 12px; color: #111; }
      h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
      p { margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; }
      td, th { padding: 2px 0; text-align: left; vertical-align: top; }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
    </style></head><body>
    <h1>REPORTE DE CORTE</h1>
    <p style="text-align:center">${session.value.register_name ?? ''} · ${s.session_name}</p>
    <p style="text-align:center">Apertura: ${formatDateTime(s.opened_at)}</p>
    <p style="text-align:center">Cierre: ${formatDateTime(s.closed_at)}</p>
    <div class="sep"></div>
    <p>Fondo de apertura: ${formatCurrency(s.opening_balance)}</p>
    <p>Ventas (${s.sales_count}): ${formatCurrency(s.sales_total)}</p>
    <p>Ticket promedio: ${formatCurrency(s.avg_ticket)}</p>
    <p>Descuentos: ${formatCurrency(s.discounts_total)}</p>
    <p>Devoluciones (${s.refunds_count}): -${formatCurrency(s.refunds_total)}</p>
    <p>Cancelaciones: ${s.cancelled_count}</p>
    <p>Entradas: ${formatCurrency(s.cash_in)} · Salidas: -${formatCurrency(s.cash_out)}</p>
    <p><strong>Efectivo esperado: ${formatCurrency(s.expected_cash)}</strong></p>
    <div class="sep"></div>
    <table>
      <tr><th>Método</th><th style="text-align:right">Ventas</th><th style="text-align:right">Dev.</th></tr>
      ${methodRows}
    </table>
    ${countRows ? `<div class="sep"></div><p><strong>Arqueo</strong></p>
      <table>
        <tr><th>Método</th><th style="text-align:right">Esperado</th><th style="text-align:right">Contado</th><th style="text-align:right">Dif.</th></tr>
        ${countRows}
      </table>` : ''}
    ${movementRows ? `<div class="sep"></div><p><strong>Movimientos</strong></p><table>${movementRows}</table>` : ''}
    </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 250)
}

const handleViewOrder = (orderId: string | null): void => {
  if (orderId) router.push(`/admin/orders/${orderId}`)
}
</script>

<template>
  <CardSheet
    :title="session?.name ?? 'Sesión de caja'"
    :subtitle="`${session?.register_name ?? ''} · ${session?.status === 'open' ? 'Abierta' : 'Cerrada'}`"
    :is-editing="false"
    :is-loading="isLoading"
    :show-edit-button="false"
    :menu-options="menuOptions"
    @back="router.push('/admin/pos/sessions')"
  >
    <template v-if="summary">
      <!-- Indicadores -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-slate-50 rounded-xl p-4">
          <p class="text-xs font-semibold text-slate-400 uppercase">Ventas ({{ summary.sales_count }})</p>
          <p class="text-xl font-bold text-slate-800">{{ formatCurrency(summary.sales_total) }}</p>
        </div>
        <div class="bg-slate-50 rounded-xl p-4">
          <p class="text-xs font-semibold text-slate-400 uppercase">Ticket promedio</p>
          <p class="text-xl font-bold text-slate-800">{{ formatCurrency(summary.avg_ticket) }}</p>
        </div>
        <div class="bg-slate-50 rounded-xl p-4">
          <p class="text-xs font-semibold text-slate-400 uppercase">Devoluciones ({{ summary.refunds_count }})</p>
          <p class="text-xl font-bold text-rose-600">-{{ formatCurrency(summary.refunds_total) }}</p>
        </div>
        <div class="bg-slate-50 rounded-xl p-4">
          <p class="text-xs font-semibold text-slate-400 uppercase">Efectivo esperado</p>
          <p class="text-xl font-bold text-slate-800">{{ formatCurrency(summary.expected_cash) }}</p>
        </div>
      </div>

      <!-- Datos de sesión -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 text-sm">
        <div class="space-y-1.5">
          <p><span class="font-semibold text-slate-500">Apertura:</span> {{ formatDateTime(summary.opened_at) }} por {{ session?.opened_by_name ?? '—' }}</p>
          <p><span class="font-semibold text-slate-500">Cierre:</span> {{ formatDateTime(summary.closed_at) }} <template v-if="session?.closed_by_name">por {{ session.closed_by_name }}</template></p>
          <p><span class="font-semibold text-slate-500">Fondo inicial:</span> {{ formatCurrency(summary.opening_balance) }}</p>
        </div>
        <div class="space-y-1.5">
          <p><span class="font-semibold text-slate-500">Descuentos aplicados:</span> {{ formatCurrency(summary.discounts_total) }}</p>
          <p><span class="font-semibold text-slate-500">Cancelaciones:</span> {{ summary.cancelled_count }}</p>
          <p><span class="font-semibold text-slate-500">Mov. efectivo:</span> +{{ formatCurrency(summary.cash_in) }} / -{{ formatCurrency(summary.cash_out) }}</p>
        </div>
      </div>

      <!-- Arqueo -->
      <div v-if="counts.length > 0" class="mb-8">
        <h3 class="font-bold text-slate-800 mb-3">Arqueo del corte</h3>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs text-slate-500 uppercase">
                <th class="px-4 py-3">Método</th>
                <th class="px-4 py-3 text-right">Esperado</th>
                <th class="px-4 py-3 text-right">Contado</th>
                <th class="px-4 py-3 text-right">Diferencia</th>
                <th class="px-4 py-3">Justificación</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="count in counts" :key="count.id" class="border-t border-slate-100">
                <td class="px-4 py-3 font-semibold text-slate-700">
                  {{ methodNames.get(count.payment_method_id) ?? '—' }}
                </td>
                <td class="px-4 py-3 text-right">{{ formatCurrency(Number(count.expected)) }}</td>
                <td class="px-4 py-3 text-right">{{ formatCurrency(Number(count.counted)) }}</td>
                <td
                  class="px-4 py-3 text-right font-bold"
                  :class="Number(count.difference) === 0 ? 'text-slate-400' : Number(count.difference) > 0 ? 'text-emerald-600' : 'text-rose-600'"
                >
                  {{ Number(count.difference) > 0 ? '+' : '' }}{{ formatCurrency(Number(count.difference)) }}
                </td>
                <td class="px-4 py-3 text-slate-500">{{ count.justification ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Movimientos -->
      <div v-if="movements.length > 0" class="mb-8">
        <h3 class="font-bold text-slate-800 mb-3">Movimientos de efectivo</h3>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs text-slate-500 uppercase">
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">Motivo</th>
                <th class="px-4 py-3">Fecha</th>
                <th class="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="movement in movements" :key="movement.id" class="border-t border-slate-100">
                <td class="px-4 py-3">
                  <BadgeApp
                    :label="movement.movement_type === 'in' ? 'Entrada' : 'Salida'"
                    :variant="movement.movement_type === 'in' ? 'success' : 'danger'"
                  />
                </td>
                <td class="px-4 py-3 text-slate-700">{{ movement.reason }}</td>
                <td class="px-4 py-3 text-slate-500">{{ formatDateTime(movement.created_at) }}</td>
                <td class="px-4 py-3 text-right font-semibold" :class="movement.movement_type === 'in' ? 'text-emerald-600' : 'text-rose-600'">
                  {{ movement.movement_type === 'in' ? '+' : '-' }}{{ formatCurrency(Number(movement.amount)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Ventas de la sesión -->
      <div class="mb-8">
        <h3 class="font-bold text-slate-800 mb-3">Tickets de la sesión</h3>
        <p v-if="orders.length === 0" class="text-sm text-slate-400">Sin ventas registradas.</p>
        <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs text-slate-500 uppercase">
                <th class="px-4 py-3">Folio</th>
                <th class="px-4 py-3">Cliente</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Fecha</th>
                <th class="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="order in orders"
                :key="order.id ?? ''"
                class="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                @click="handleViewOrder(order.id)"
              >
                <td class="px-4 py-3 font-mono font-semibold text-indigo-600">{{ order.name }}</td>
                <td class="px-4 py-3 text-slate-700">{{ order.partner_name ?? '—' }}</td>
                <td class="px-4 py-3">
                  <BadgeApp
                    :label="order.order_state === 'posted' ? 'Confirmada' : order.order_state === 'cancel' ? 'Cancelada' : 'Borrador'"
                    :variant="order.order_state === 'posted' ? 'success' : order.order_state === 'cancel' ? 'danger' : 'secondary'"
                  />
                </td>
                <td class="px-4 py-3 text-slate-500">{{ formatDateTime(order.created_at) }}</td>
                <td class="px-4 py-3 text-right font-semibold text-slate-800">
                  {{ formatCurrency(Number(order.amount_total ?? 0)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagos -->
      <div v-if="payments.length > 0">
        <h3 class="font-bold text-slate-800 mb-3">Pagos y reembolsos</h3>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs text-slate-500 uppercase">
                <th class="px-4 py-3">Ticket</th>
                <th class="px-4 py-3">Método</th>
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">Fecha</th>
                <th class="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="payment in payments" :key="payment.id ?? ''" class="border-t border-slate-100">
                <td class="px-4 py-3 font-mono text-slate-700">{{ payment.order_name }}</td>
                <td class="px-4 py-3 text-slate-700">{{ payment.payment_method_name }}</td>
                <td class="px-4 py-3">
                  <BadgeApp
                    :label="payment.is_refund ? 'Reembolso' : 'Pago'"
                    :variant="payment.is_refund ? 'danger' : 'success'"
                  />
                </td>
                <td class="px-4 py-3 text-slate-500">{{ formatDateTime(payment.created_at) }}</td>
                <td class="px-4 py-3 text-right font-semibold" :class="payment.is_refund ? 'text-rose-600' : 'text-slate-800'">
                  {{ formatCurrency(Number(payment.amount ?? 0)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </CardSheet>
</template>
