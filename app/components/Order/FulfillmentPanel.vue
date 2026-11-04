<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type {
  DeliveryShortage,
  DeliveryStatus,
  OrderPaymentView,
  OrderRefundView,
  PaymentStatus,
  RefundLineInput
} from '~/types/sales.types'
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_VARIANTS,
  PAYMENT_SOURCE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS
} from '~/utils/sales'

type PickingView = Database['public']['Views']['v_pickings']['Row']

/**
 * Entregas, cobros y devoluciones de una orden confirmada.
 *
 * Todo lo que muestra lo calcula la base de datos: el estado de entrega sale
 * de los pickings confirmados y el de pago del libro de pagos. Aquí solo se
 * disparan las acciones (preparar entrega, registrar pago o devolución).
 */
interface Props {
  orderId: string
  companyId: string
  orderType: 'sale' | 'purchase'
  orderState: 'draft' | 'posted' | 'cancel'
  currency?: string
  amountTotal?: number
  amountPaid?: number
  amountRefunded?: number
  paymentStatus?: PaymentStatus
  deliveryStatus?: DeliveryStatus
  defaultPaymentMethodId?: string | null
  paymentMethodOptions?: { value: string; label: string }[]
  isAdmin?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currency: 'MXN',
  amountTotal: 0,
  amountPaid: 0,
  amountRefunded: 0,
  paymentStatus: 'unpaid',
  deliveryStatus: 'pending',
  defaultPaymentMethodId: null,
  paymentMethodOptions: () => [],
  isAdmin: false
})

const emit = defineEmits<{
  changed: []
}>()

interface PanelLine {
  id: string
  description: string
  productId: string | null
  quantity: number
  delivered: number
  returned: number
  refunded: number
  pending: number
  total: number
  isStockable: boolean
}

const { prepareDelivery, getDeliveryShortages } = useOrder()
const { getPickingsByOrder } = usePicking()
const { getOrderLineViewsByOrderId } = useOrderLine()
const {
  getPaymentsByOrder,
  registerPayment,
  voidPayment,
  condoneBalance,
  lastError: paymentError
} = useOrderPayment()
const { getRefundsByOrder, registerRefund, lastError: refundError } = useOrderRefund()

const isBusy = ref(false)
const panelError = ref<string | null>(null)
const panelNotice = ref<string | null>(null)

const pickings = ref<PickingView[]>([])
const payments = ref<OrderPaymentView[]>([])
const refunds = ref<OrderRefundView[]>([])
const lines = ref<PanelLine[]>([])
const shortages = ref<DeliveryShortage[]>([])

const isSale = computed(() => props.orderType === 'sale')
const isPosted = computed(() => props.orderState === 'posted')
const balance = computed(() =>
  Math.max(Math.round((props.amountTotal - props.amountRefunded - props.amountPaid) * 100) / 100, 0)
)
const creditBalance = computed(() =>
  Math.max(Math.round((props.amountPaid - (props.amountTotal - props.amountRefunded)) * 100) / 100, 0)
)
const canPrepare = computed(() =>
  isPosted.value && ['pending', 'partial'].includes(props.deliveryStatus)
)
const canPay = computed(() => isPosted.value && balance.value > 0.005)
const canRefund = computed(() =>
  isPosted.value && isSale.value && lines.value.some(l => l.quantity - l.refunded > 0.0005)
)
const canCondone = computed(() =>
  props.isAdmin && isPosted.value && balance.value > 0.005 && props.paymentStatus !== 'condoned'
)

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: props.currency || 'MXN' }).format(value || 0)

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const pickingStatusLabels: Record<string, string> = {
  borrador: 'Borrador',
  publicado: 'En surtido',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado'
}

const pickingStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  borrador: 'secondary',
  publicado: 'warning',
  confirmado: 'success',
  cancelado: 'danger'
}

const readNumber = (row: Record<string, unknown>, key: string): number => Number(row[key] ?? 0) || 0

// ── Carga ────────────────────────────────────────────────────────────────────
const load = async () => {
  if (!props.orderId || !props.companyId) return

  const [pickingRows, paymentRows, refundRows, lineRows] = await Promise.all([
    getPickingsByOrder(props.orderId, props.companyId),
    getPaymentsByOrder(props.orderId, props.companyId),
    getRefundsByOrder(props.orderId, props.companyId),
    getOrderLineViewsByOrderId(props.orderId, props.companyId)
  ])

  pickings.value = pickingRows
  payments.value = paymentRows
  refunds.value = refundRows
  lines.value = lineRows.map((row) => {
    const r = row as unknown as Record<string, unknown>
    return {
      id: String(r['id'] ?? ''),
      description: String(r['description'] ?? r['product_name'] ?? 'Línea'),
      productId: (r['product_id'] as string | null) ?? null,
      quantity: readNumber(r, 'quantity'),
      delivered: readNumber(r, 'quantity_delivered'),
      returned: readNumber(r, 'quantity_returned'),
      refunded: readNumber(r, 'quantity_refunded'),
      pending: readNumber(r, 'quantity_pending'),
      total: readNumber(r, 'total'),
      isStockable: Boolean(r['product_id'])
    }
  })

  shortages.value = isSale.value && canPrepare.value
    ? await getDeliveryShortages(props.orderId)
    : []
}

watch(
  () => [props.orderId, props.companyId, props.orderState, props.deliveryStatus, props.amountPaid, props.amountRefunded],
  () => { void load() },
  { immediate: true }
)

const afterChange = async (notice: string | null) => {
  panelNotice.value = notice
  await load()
  emit('changed')
}

// ── Preparar entrega ─────────────────────────────────────────────────────────
const handlePrepare = async () => {
  if (!canPrepare.value || isBusy.value) return
  isBusy.value = true
  panelError.value = null
  try {
    const { result, errorMessage } = await prepareDelivery(props.orderId)
    if (!result) {
      panelError.value = errorMessage
      return
    }
    const messages: Record<string, string> = {
      ok: isSale.value
        ? 'Entrega preparada: el stock quedó apartado y el almacén ya puede surtirla.'
        : 'Recepción preparada: el almacén ya puede registrar la entrada.',
      in_progress: 'El almacén ya está surtiendo esta orden; se conserva el movimiento en curso.',
      nothing_pending: 'No hay nada pendiente por entregar.'
    }
    await afterChange(messages[result.status] ?? null)
  } finally {
    isBusy.value = false
  }
}

// ── Registrar pago ───────────────────────────────────────────────────────────
const showPayment = ref(false)
const paymentForm = reactive({
  amount: 0,
  paidAt: '',
  methodId: '',
  reference: '',
  notes: ''
})

const openPayment = () => {
  if (!canPay.value) return
  paymentForm.amount = balance.value
  paymentForm.paidAt = new Date().toISOString().slice(0, 10)
  paymentForm.methodId = props.defaultPaymentMethodId ?? ''
  paymentForm.reference = ''
  paymentForm.notes = ''
  panelError.value = null
  showPayment.value = true
}

const submitPayment = async () => {
  if (isBusy.value) return
  if (!paymentForm.methodId) {
    panelError.value = 'Selecciona el método de pago.'
    return
  }
  isBusy.value = true
  panelError.value = null
  try {
    // Mediodía local: evita que la fecha cambie de día al convertir a UTC
    const paidAt = paymentForm.paidAt ? new Date(`${paymentForm.paidAt}T12:00:00`).toISOString() : null
    const result = await registerPayment({
      orderId: props.orderId,
      amount: Number(paymentForm.amount),
      paymentMethodId: paymentForm.methodId,
      paidAt,
      reference: paymentForm.reference,
      notes: paymentForm.notes
    })
    if (!result) {
      panelError.value = paymentError.value
      return
    }
    showPayment.value = false
    await afterChange(
      result.balance > 0.005
        ? `Abono registrado. Saldo pendiente: ${formatCurrency(result.balance)}.`
        : 'Pago registrado: la orden quedó liquidada.'
    )
  } finally {
    isBusy.value = false
  }
}

// ── Anular pago / condonar saldo (motivo obligatorio) ────────────────────────
const reasonDialog = reactive<{
  open: boolean
  mode: 'void' | 'condone'
  paymentId: string | null
  reason: string
}>({ open: false, mode: 'void', paymentId: null, reason: '' })

const openVoid = (paymentId: string) => {
  reasonDialog.open = true
  reasonDialog.mode = 'void'
  reasonDialog.paymentId = paymentId
  reasonDialog.reason = ''
}

const openCondone = () => {
  if (!canCondone.value) return
  reasonDialog.open = true
  reasonDialog.mode = 'condone'
  reasonDialog.paymentId = null
  reasonDialog.reason = ''
}

const submitReason = async () => {
  if (!reasonDialog.reason.trim() || isBusy.value) return
  isBusy.value = true
  panelError.value = null
  try {
    const ok = reasonDialog.mode === 'void' && reasonDialog.paymentId
      ? await voidPayment(reasonDialog.paymentId, reasonDialog.reason.trim())
      : await condoneBalance(props.orderId, reasonDialog.reason.trim())
    if (!ok) {
      panelError.value = paymentError.value
      return
    }
    const notice = reasonDialog.mode === 'void' ? 'Pago anulado.' : 'Saldo condonado.'
    reasonDialog.open = false
    await afterChange(notice)
  } finally {
    isBusy.value = false
  }
}

// ── Registrar devolución ─────────────────────────────────────────────────────
const showRefund = ref(false)

interface RefundDraftLine {
  id: string
  description: string
  max: number
  maxRestock: number
  quantity: number
  restock: number
  unitTotal: number
}

const refundLines = ref<RefundDraftLine[]>([])
const refundForm = reactive({
  reason: '',
  reimburse: true,
  methodId: '',
  amount: 0
})

const refundTotal = computed(() =>
  Math.round(refundLines.value.reduce((sum, l) => sum + l.quantity * l.unitTotal, 0) * 100) / 100
)
const maxReimbursable = computed(() => Math.max(props.amountPaid, 0))

watch(refundTotal, (total) => {
  refundForm.amount = Math.min(total, maxReimbursable.value)
})

const openRefund = () => {
  if (!canRefund.value) return
  refundLines.value = lines.value
    .filter(l => l.quantity - l.refunded > 0.0005)
    .map(l => ({
      id: l.id,
      description: l.description,
      max: Math.round((l.quantity - l.refunded) * 1000) / 1000,
      maxRestock: l.isStockable ? Math.max(Math.round((l.delivered - l.returned) * 1000) / 1000, 0) : 0,
      quantity: 0,
      restock: 0,
      unitTotal: l.quantity > 0 ? l.total / l.quantity : 0
    }))
  refundForm.reason = ''
  refundForm.reimburse = props.amountPaid > 0
  refundForm.methodId = props.defaultPaymentMethodId ?? ''
  refundForm.amount = 0
  panelError.value = null
  showRefund.value = true
}

const onRefundQuantity = (line: RefundDraftLine, value: string | number) => {
  const qty = Math.min(Math.max(Number(value) || 0, 0), line.max)
  line.quantity = qty
  // Por defecto regresa al almacén lo que se entregó
  line.restock = Math.min(qty, line.maxRestock)
}

const onRefundRestock = (line: RefundDraftLine, value: string | number) => {
  line.restock = Math.min(Math.max(Number(value) || 0, 0), line.quantity, line.maxRestock)
}

const submitRefund = async () => {
  if (isBusy.value) return
  const selected = refundLines.value.filter(l => l.quantity > 0)
  if (selected.length === 0) {
    panelError.value = 'Indica al menos una cantidad a devolver.'
    return
  }
  if (!refundForm.reason.trim()) {
    panelError.value = 'El motivo de la devolución es obligatorio.'
    return
  }
  if (refundForm.reimburse && !refundForm.methodId) {
    panelError.value = 'Selecciona el método con el que se reembolsa.'
    return
  }

  isBusy.value = true
  panelError.value = null
  try {
    const payload: RefundLineInput[] = selected.map(l => ({
      order_line_id: l.id,
      quantity: l.quantity,
      restock_quantity: l.restock
    }))
    const result = await registerRefund({
      orderId: props.orderId,
      lines: payload,
      reason: refundForm.reason.trim(),
      refundMethodId: refundForm.reimburse ? refundForm.methodId : null,
      refundAmount: refundForm.reimburse ? Number(refundForm.amount) : null
    })
    if (!result) {
      panelError.value = refundError.value
      return
    }
    showRefund.value = false
    await afterChange(
      `Devolución ${result.refund_name} registrada por ${formatCurrency(result.refund_total)}`
      + (result.reimbursed > 0 ? `; se reembolsaron ${formatCurrency(result.reimbursed)}.` : '.')
    )
  } finally {
    isBusy.value = false
  }
}

defineExpose({ openPayment, openRefund, handlePrepare, openCondone, canPay, canRefund, canPrepare, canCondone })
</script>

<template>
  <section v-if="isPosted || payments.length > 0" class="mt-6 space-y-5">
    <div
      v-if="panelError"
      class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-line"
    >
      {{ panelError }}
    </div>
    <div
      v-if="panelNotice"
      class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      {{ panelNotice }}
    </div>

    <!-- Resumen -->
    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {{ isSale ? 'Entrega' : 'Recepción' }}
        </p>
        <div class="mt-2">
          <BadgeApp
            :label="DELIVERY_STATUS_LABELS[deliveryStatus] ?? deliveryStatus"
            :variant="DELIVERY_STATUS_VARIANTS[deliveryStatus] ?? 'secondary'"
          />
        </div>
        <p class="mt-3 text-sm text-slate-500">
          {{ lines.reduce((s, l) => s + l.pending, 0) }} unidades pendientes ·
          {{ pickings.filter(p => p.status === 'confirmado').length }} movimientos confirmados
        </p>
        <div
          v-if="shortages.length > 0"
          class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <p class="font-semibold">Faltan existencias en el almacén de salida:</p>
          <ul class="mt-1 list-disc pl-4">
            <li v-for="s in shortages" :key="s.product_id">
              {{ s.product_name }}: pendiente {{ s.pending }}, disponible {{ s.available }}
            </li>
          </ul>
        </div>
        <BtnApp
          v-if="canPrepare"
          class="mt-4"
          variant="primary"
          size="sm"
          :disabled="isBusy"
          :label="isSale ? 'Preparar entrega' : 'Preparar recepción'"
          @click="handlePrepare"
        />
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {{ isSale ? 'Cobranza' : 'Pagos a proveedor' }}
        </p>
        <div class="mt-2">
          <BadgeApp
            :label="PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus"
            :variant="PAYMENT_STATUS_VARIANTS[paymentStatus] ?? 'secondary'"
          />
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt class="text-slate-500">Total</dt>
          <dd class="text-right text-slate-800 tabular-nums">{{ formatCurrency(amountTotal) }}</dd>
          <template v-if="amountRefunded > 0">
            <dt class="text-slate-500">Devuelto</dt>
            <dd class="text-right text-slate-800 tabular-nums">−{{ formatCurrency(amountRefunded) }}</dd>
          </template>
          <dt class="text-slate-500">{{ isSale ? 'Cobrado' : 'Pagado' }}</dt>
          <dd class="text-right text-slate-800 tabular-nums">{{ formatCurrency(amountPaid) }}</dd>
          <dt class="font-semibold text-slate-700">Saldo</dt>
          <dd class="text-right font-semibold text-slate-800 tabular-nums">{{ formatCurrency(balance) }}</dd>
          <template v-if="creditBalance > 0">
            <dt class="text-slate-500">Saldo a favor</dt>
            <dd class="text-right text-emerald-700 tabular-nums">{{ formatCurrency(creditBalance) }}</dd>
          </template>
        </dl>
        <div class="mt-4 flex flex-wrap gap-2">
          <BtnApp
            v-if="canPay"
            variant="success"
            size="sm"
            :disabled="isBusy"
            :label="isSale ? 'Registrar cobro' : 'Registrar pago'"
            @click="openPayment"
          />
          <BtnApp
            v-if="canCondone"
            variant="ghost"
            size="sm"
            :disabled="isBusy"
            label="Condonar saldo"
            @click="openCondone"
          />
        </div>
      </div>

      <div v-if="isSale" class="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Devoluciones</p>
        <p class="mt-2 text-2xl font-bold text-slate-800 tabular-nums">{{ formatCurrency(amountRefunded) }}</p>
        <p class="mt-1 text-sm text-slate-500">
          {{ refunds.length }} {{ refunds.length === 1 ? 'devolución' : 'devoluciones' }}
        </p>
        <BtnApp
          v-if="canRefund"
          class="mt-4"
          variant="secondary"
          size="sm"
          :disabled="isBusy"
          label="Registrar devolución"
          @click="openRefund"
        />
      </div>
    </div>

    <!-- Seguimiento por línea -->
    <div v-if="lines.length > 0" class="rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
      <h4 class="px-5 pt-4 text-sm font-semibold text-slate-800">Seguimiento por línea</h4>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-2 text-left">Producto</th>
              <th class="px-3 py-2 text-right">Pedido</th>
              <th class="px-3 py-2 text-right">{{ isSale ? 'Entregado' : 'Recibido' }}</th>
              <th v-if="isSale" class="px-3 py-2 text-right">Devuelto</th>
              <th v-if="isSale" class="px-3 py-2 text-right">Acreditado</th>
              <th class="px-5 py-2 text-right">Pendiente</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lines" :key="l.id" class="border-t border-slate-100">
              <td class="px-5 py-2 text-slate-700">{{ l.description }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ l.quantity }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ l.isStockable ? l.delivered : '—' }}</td>
              <td v-if="isSale" class="px-3 py-2 text-right tabular-nums">{{ l.returned || '—' }}</td>
              <td v-if="isSale" class="px-3 py-2 text-right tabular-nums">{{ l.refunded || '—' }}</td>
              <td class="px-5 py-2 text-right tabular-nums" :class="l.pending > 0 ? 'font-semibold text-amber-700' : 'text-slate-400'">
                {{ l.isStockable ? l.pending : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Movimientos de almacén -->
    <div v-if="pickings.length > 0" class="rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
      <h4 class="px-5 pt-4 text-sm font-semibold text-slate-800">Movimientos de almacén</h4>
      <ul class="mt-3 divide-y divide-slate-100">
        <li v-for="p in pickings" :key="p.id ?? ''" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
          <div class="min-w-0">
            <NuxtLink :to="`/admin/pickings/${p.id}`" class="font-medium text-indigo-600 hover:underline">
              {{ p.name || 'Movimiento' }}
            </NuxtLink>
            <span class="ml-2 text-slate-500">
              {{ p.is_return ? 'Devolución' : (p.type === 'salida' ? 'Salida' : 'Entrada') }}
              · {{ p.warehouse_name }} · {{ formatDate(p.confirmed_at ?? p.created_at) }}
            </span>
          </div>
          <BadgeApp
            :label="pickingStatusLabels[p.status ?? ''] ?? (p.status ?? '')"
            :variant="pickingStatusVariant[p.status ?? ''] ?? 'secondary'"
          />
        </li>
      </ul>
    </div>

    <!-- Pagos -->
    <div v-if="payments.length > 0" class="rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
      <h4 class="px-5 pt-4 text-sm font-semibold text-slate-800">{{ isSale ? 'Cobros y reembolsos' : 'Pagos' }}</h4>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-2 text-left">Fecha</th>
              <th class="px-3 py-2 text-left">Método</th>
              <th class="px-3 py-2 text-left">Origen</th>
              <th class="px-3 py-2 text-left">Referencia</th>
              <th class="px-3 py-2 text-right">Monto</th>
              <th class="px-5 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pay in payments"
              :key="pay.id"
              class="border-t border-slate-100"
              :class="pay.active ? '' : 'opacity-50 line-through'"
            >
              <td class="px-5 py-2 text-slate-700">{{ formatDate(pay.paid_at) }}</td>
              <td class="px-3 py-2 text-slate-700">
                {{ pay.payment_method_name || (pay.source === 'stripe' ? 'Tarjeta (Stripe)' : '—') }}
              </td>
              <td class="px-3 py-2 text-slate-500">
                {{ PAYMENT_SOURCE_LABELS[pay.source] ?? pay.source }}
                <span v-if="pay.pos_session_name"> · {{ pay.pos_session_name }}</span>
              </td>
              <td class="px-3 py-2 text-slate-500">{{ pay.refund_name || pay.reference || '—' }}</td>
              <td class="px-3 py-2 text-right tabular-nums" :class="pay.amount < 0 ? 'text-red-600' : 'text-slate-800'">
                {{ formatCurrency(pay.amount) }}
              </td>
              <td class="px-5 py-2 text-right">
                <button
                  v-if="isAdmin && pay.active && (pay.source === 'dashboard' || pay.source === 'backfill') && !pay.refund_id"
                  type="button"
                  class="text-xs font-medium text-slate-500 hover:text-red-600"
                  @click="openVoid(pay.id)"
                >
                  Anular
                </button>
                <span v-else-if="!pay.active" class="text-xs text-slate-400">Anulado</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Devoluciones -->
    <div v-if="refunds.length > 0" class="rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
      <h4 class="px-5 pt-4 text-sm font-semibold text-slate-800">Devoluciones registradas</h4>
      <ul class="mt-3 divide-y divide-slate-100">
        <li v-for="r in refunds" :key="r.id" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
          <div class="min-w-0">
            <span class="font-medium text-slate-800">{{ r.name }}</span>
            <span class="ml-2 text-slate-500">{{ formatDate(r.created_at) }} · {{ r.reason }}</span>
            <NuxtLink
              v-if="r.picking_id"
              :to="`/admin/pickings/${r.picking_id}`"
              class="ml-2 text-indigo-600 hover:underline"
            >
              {{ r.picking_name || 'Reingreso' }}
            </NuxtLink>
          </div>
          <div class="text-right tabular-nums">
            <p class="font-semibold text-slate-800">{{ formatCurrency(r.amount_total) }}</p>
            <p class="text-xs text-slate-500">Reembolsado {{ formatCurrency(r.amount_reimbursed) }}</p>
          </div>
        </li>
      </ul>
    </div>

    <!-- Modal: registrar pago -->
    <Teleport to="body">
      <div
        v-if="showPayment"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="showPayment = false"
      >
        <form
          class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          @submit.prevent="submitPayment"
        >
          <div>
            <h3 class="text-lg font-semibold text-slate-900">{{ isSale ? 'Registrar cobro' : 'Registrar pago' }}</h3>
            <p class="mt-1 text-sm text-slate-500">
              Saldo pendiente: {{ formatCurrency(balance) }}. Puedes registrar un abono parcial.
            </p>
          </div>
          <FormInput v-model="paymentForm.amount" type="number" label="Monto" :min="0.01" :max="balance" step="0.01" required />
          <FormInput v-model="paymentForm.paidAt" type="date" label="Fecha del pago" required />
          <FormSelect
            v-model="paymentForm.methodId"
            label="Método de pago"
            placeholder="Selecciona un método"
            :options="paymentMethodOptions"
            required
          />
          <FormInput v-model="paymentForm.reference" label="Referencia" placeholder="Folio de transferencia, voucher…" />
          <FormTextArea v-model="paymentForm.notes" label="Notas" :rows="2" />
          <p v-if="panelError" class="text-sm text-red-600">{{ panelError }}</p>
          <div class="flex justify-end gap-3 pt-2">
            <BtnApp variant="ghost" type="button" label="Cancelar" :disabled="isBusy" @click="showPayment = false" />
            <BtnApp variant="primary" type="submit" :loading="isBusy" label="Registrar" />
          </div>
        </form>
      </div>
    </Teleport>

    <!-- Modal: devolución -->
    <Teleport to="body">
      <div
        v-if="showRefund"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="showRefund = false"
      >
        <form
          class="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          @submit.prevent="submitRefund"
        >
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Registrar devolución</h3>
            <p class="mt-1 text-sm text-slate-500">
              «Devolver» acredita al cliente. «Regresa al almacén» reingresa la mercancía al costo con que salió;
              déjalo en 0 si el cliente conserva el producto o si nunca se le entregó.
            </p>
          </div>
          <div class="overflow-x-auto rounded-xl border border-slate-100">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-3 py-2 text-left">Línea</th>
                  <th class="px-3 py-2 text-right">Devolver</th>
                  <th class="px-3 py-2 text-right">Regresa al almacén</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in refundLines" :key="l.id" class="border-t border-slate-100">
                  <td class="px-3 py-2 text-slate-700">
                    {{ l.description }}
                    <span class="block text-xs text-slate-400">Máximo {{ l.max }}</span>
                  </td>
                  <td class="px-3 py-2 w-28">
                    <FormInput
                      :model-value="l.quantity"
                      type="number"
                      :min="0"
                      :max="l.max"
                      step="1"
                      size="sm"
                      @update:model-value="onRefundQuantity(l, $event)"
                    />
                  </td>
                  <td class="px-3 py-2 w-28">
                    <FormInput
                      :model-value="l.restock"
                      type="number"
                      :min="0"
                      :max="Math.min(l.quantity, l.maxRestock)"
                      step="1"
                      size="sm"
                      :disabled="l.maxRestock <= 0"
                      @update:model-value="onRefundRestock(l, $event)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-right text-sm text-slate-600">
            Importe de la devolución: <span class="font-semibold text-slate-800">{{ formatCurrency(refundTotal) }}</span>
          </p>
          <FormTextArea v-model="refundForm.reason" label="Motivo" :rows="2" required />
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input
              v-model="refundForm.reimburse"
              type="checkbox"
              :disabled="maxReimbursable <= 0"
              class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Reembolsar dinero (máximo cobrado: {{ formatCurrency(maxReimbursable) }})
          </label>
          <div v-if="refundForm.reimburse" class="grid gap-4 md:grid-cols-2">
            <FormSelect
              v-model="refundForm.methodId"
              label="Método del reembolso"
              placeholder="Selecciona un método"
              :options="paymentMethodOptions"
              required
            />
            <FormInput
              v-model="refundForm.amount"
              type="number"
              label="Monto a reembolsar"
              :min="0"
              :max="Math.min(refundTotal, maxReimbursable)"
              step="0.01"
            />
          </div>
          <p v-if="panelError" class="text-sm text-red-600">{{ panelError }}</p>
          <div class="flex justify-end gap-3 pt-2">
            <BtnApp variant="ghost" type="button" label="Cancelar" :disabled="isBusy" @click="showRefund = false" />
            <BtnApp variant="danger" type="submit" :loading="isBusy" label="Registrar devolución" />
          </div>
        </form>
      </div>
    </Teleport>

    <!-- Modal: motivo (anular pago / condonar saldo) -->
    <Teleport to="body">
      <div
        v-if="reasonDialog.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="reasonDialog.open = false"
      >
        <form class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl" @submit.prevent="submitReason">
          <h3 class="text-lg font-semibold text-slate-900">
            {{ reasonDialog.mode === 'void' ? 'Anular pago' : 'Condonar saldo' }}
          </h3>
          <p class="text-sm text-slate-500">
            {{ reasonDialog.mode === 'void'
              ? 'El pago deja de contar como cobrado. Queda en el historial, marcado como anulado.'
              : `Se perdona el saldo pendiente de ${formatCurrency(balance)}. No cuenta como ingreso.` }}
          </p>
          <FormTextArea v-model="reasonDialog.reason" label="Motivo" :rows="3" required />
          <p v-if="panelError" class="text-sm text-red-600">{{ panelError }}</p>
          <div class="flex justify-end gap-3">
            <BtnApp variant="ghost" type="button" label="Cancelar" :disabled="isBusy" @click="reasonDialog.open = false" />
            <BtnApp variant="danger" type="submit" :loading="isBusy" :disabled="!reasonDialog.reason.trim()" label="Confirmar" />
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>
