<script setup lang="ts">
import type { Tables } from '~/types/database.types'
import type { PosSessionSummary, PosSessionCloseCount } from '~/composables/usePosSession'

definePageMeta({ layout: 'pos' })

type PosSession = Tables<'pos_session'>
type PosRegister = Tables<'pos_register'>
type PaymentMethod = Tables<'payment_method'>
type PosCashMovement = Tables<'pos_cash_movement'>

interface CountRow {
  payment_method_id: string
  name: string
  is_cash: boolean
  expected: number
  counted: number
  justification: string
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const supabase = useSupabase()

const { getById: getRegisterById } = usePosRegister()
const { getSessionSummary, closeSession, getCashMovements } = usePosSession()
const { getAllByCompany: getPaymentMethods } = usePaymentMethod()

const sessionId = computed(() => String(route.query.session ?? ''))
const companyId = computed(() => authStore.selectedCompanyId ?? '')

const isLoading = ref(true)
const session = ref<PosSession | null>(null)
const register = ref<PosRegister | null>(null)
const summary = ref<PosSessionSummary | null>(null)
const movements = ref<PosCashMovement[]>([])
const paymentMethods = ref<PaymentMethod[]>([])

const countRows = ref<CountRow[]>([])
const closingNotes = ref('')
const closeError = ref('')
const isClosing = ref(false)
const closedSummary = ref<PosSessionSummary | null>(null)

const isBlind = computed(() => Boolean(register.value?.blind_close))
const tolerance = computed(() => Number(register.value?.difference_tolerance ?? 0))

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0)

const formatDateTime = (value: string | null): string => {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

const differenceOf = (row: CountRow): number =>
  Math.round((row.counted - row.expected + Number.EPSILON) * 100) / 100

const needsJustification = (row: CountRow): boolean =>
  Math.abs(differenceOf(row)) > tolerance.value

const buildCountRows = (): void => {
  if (!summary.value) return

  const rows = new Map<string, CountRow>()

  for (const m of summary.value.methods) {
    rows.set(m.payment_method_id, {
      payment_method_id: m.payment_method_id,
      name: m.name,
      is_cash: m.is_cash,
      expected: m.is_cash ? summary.value.expected_cash : m.expected,
      counted: 0,
      justification: ''
    })
  }

  // Asegurar que los métodos de efectivo aparezcan aunque no tengan ventas
  // (el fondo de apertura y los movimientos viven en efectivo)
  for (const method of paymentMethods.value) {
    if (method.is_cash && !rows.has(method.id)) {
      rows.set(method.id, {
        payment_method_id: method.id,
        name: method.name,
        is_cash: true,
        expected: summary.value.expected_cash,
        counted: 0,
        justification: ''
      })
    }
  }

  countRows.value = [...rows.values()].sort((a, b) => Number(b.is_cash) - Number(a.is_cash))
}

const loadData = async (): Promise<void> => {
  isLoading.value = true

  if (!sessionId.value || !companyId.value) {
    router.push('/pos')
    return
  }

  const { data, error } = await supabase
    .from('pos_session')
    .select('*')
    .eq('id', sessionId.value)
    .eq('company_id', companyId.value)
    .maybeSingle()

  if (error || !data) {
    router.push('/pos')
    return
  }

  if (data.status !== 'open') {
    router.push(`/admin/pos/sessions/${data.id}`)
    return
  }

  session.value = data

  const [reg, summ, movs, methods] = await Promise.all([
    getRegisterById(data.register_id, companyId.value),
    getSessionSummary(data.id),
    getCashMovements(data.id),
    getPaymentMethods(companyId.value)
  ])

  register.value = reg
  summary.value = summ
  movements.value = movs
  paymentMethods.value = methods

  buildCountRows()
  isLoading.value = false
}

const validationError = computed((): string => {
  for (const row of countRows.value) {
    if (needsJustification(row) && !row.justification.trim()) {
      return `Justifica la diferencia en "${row.name}" (excede la tolerancia de ${formatCurrency(tolerance.value)}).`
    }
  }
  return ''
})

const confirmClose = async (): Promise<void> => {
  closeError.value = ''

  if (!isBlind.value && validationError.value) {
    closeError.value = validationError.value
    return
  }

  if (!window.confirm('El corte Z cierra la sesión de forma definitiva e inmutable. ¿Continuar?')) {
    return
  }

  isClosing.value = true

  const counts: PosSessionCloseCount[] = countRows.value.map(row => ({
    payment_method_id: row.payment_method_id,
    counted: row.counted,
    justification: row.justification.trim() || null
  }))

  const { summary: result, errorMessage } = await closeSession({
    sessionId: sessionId.value,
    counts,
    notes: closingNotes.value.trim() || null
  })

  isClosing.value = false

  if (!result) {
    closeError.value = errorMessage ?? 'No se pudo cerrar la sesión.'
    return
  }

  closedSummary.value = result
}

const printReport = (type: 'X' | 'Z'): void => {
  const s = type === 'Z' ? closedSummary.value ?? summary.value : summary.value
  if (!s) return

  const rows = (type === 'Z' ? countRows.value : []).map(row => `<tr>
      <td>${row.name}</td>
      <td style="text-align:right">${formatCurrency(row.expected)}</td>
      <td style="text-align:right">${formatCurrency(row.counted)}</td>
      <td style="text-align:right">${formatCurrency(differenceOf(row))}</td>
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
    <title>Corte ${type} — ${s.session_name}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 320px; margin: 0 auto; padding: 12px; color: #111; }
      h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
      p { margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; }
      td, th { padding: 2px 0; text-align: left; vertical-align: top; }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
    </style></head><body>
    <h1>CORTE ${type} ${type === 'Z' ? '(cierre de sesión)' : '(informativo)'}</h1>
    <p style="text-align:center">${register.value?.name ?? ''} · ${s.session_name}</p>
    <p style="text-align:center">${new Date().toLocaleString('es-MX')}</p>
    <p style="text-align:center">Cajero: ${authStore.partnerDisplayName}</p>
    <div class="sep"></div>
    <p>Apertura: ${formatDateTime(s.opened_at)} · ${formatCurrency(s.opening_balance)}</p>
    <p>Transacciones: ${s.sales_count} · Ticket promedio: ${formatCurrency(s.avg_ticket)}</p>
    <p>Ventas: ${formatCurrency(s.sales_total)}</p>
    <p>Descuentos aplicados: ${formatCurrency(s.discounts_total)}</p>
    <p>Devoluciones (${s.refunds_count}): -${formatCurrency(s.refunds_total)}</p>
    <p>Cancelaciones: ${s.cancelled_count}</p>
    <p>Entradas de efectivo: ${formatCurrency(s.cash_in)}</p>
    <p>Salidas de efectivo: -${formatCurrency(s.cash_out)}</p>
    <p><strong>Efectivo esperado: ${formatCurrency(s.expected_cash)}</strong></p>
    <div class="sep"></div>
    <table>
      <tr><th>Método</th><th style="text-align:right">Ventas</th><th style="text-align:right">Dev.</th></tr>
      ${methodRows}
    </table>
    ${movementRows ? `<div class="sep"></div><p><strong>Movimientos de efectivo</strong></p><table>${movementRows}</table>` : ''}
    ${rows ? `<div class="sep"></div><p><strong>Arqueo</strong></p>
      <table>
        <tr><th>Método</th><th style="text-align:right">Esperado</th><th style="text-align:right">Contado</th><th style="text-align:right">Dif.</th></tr>
        ${rows}
      </table>` : ''}
    </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 250)
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="flex-1 flex flex-col">
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
      <NuxtLink
        :to="closedSummary ? '/pos' : `/pos/terminal?session=${sessionId}`"
        class="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>
      <div>
        <h1 class="text-xl font-bold text-slate-800">Corte de caja</h1>
        <p class="text-sm text-slate-500">
          {{ register?.name ?? '' }} · <span class="font-mono">{{ session?.name ?? '' }}</span>
        </p>
      </div>
    </header>

    <main class="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
      <div v-if="isLoading" class="flex items-center justify-center py-24">
        <div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>

      <!-- ── Sesión cerrada con éxito ── -->
      <div
        v-else-if="closedSummary"
        class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-8 text-center"
      >
        <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Corte Z completado</h2>
        <p class="text-slate-500 mb-6">
          La sesión <span class="font-mono font-semibold">{{ closedSummary.session_name }}</span> quedó cerrada e inmutable.
        </p>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-left">
          <div class="bg-slate-50 rounded-xl p-4">
            <p class="text-xs font-semibold text-slate-400 uppercase">Ventas</p>
            <p class="text-lg font-bold text-slate-800">{{ formatCurrency(closedSummary.sales_total) }}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-4">
            <p class="text-xs font-semibold text-slate-400 uppercase">Transacciones</p>
            <p class="text-lg font-bold text-slate-800">{{ closedSummary.sales_count }}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-4">
            <p class="text-xs font-semibold text-slate-400 uppercase">Devoluciones</p>
            <p class="text-lg font-bold text-slate-800">-{{ formatCurrency(closedSummary.refunds_total) }}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-4">
            <p class="text-xs font-semibold text-slate-400 uppercase">Efectivo esperado</p>
            <p class="text-lg font-bold text-slate-800">{{ formatCurrency(closedSummary.expected_cash) }}</p>
          </div>
        </div>

        <div class="flex gap-3 justify-center">
          <BtnApp label="Imprimir reporte de corte" variant="secondary" size="md" @click="printReport('Z')" />
          <BtnApp label="Volver a cajas" size="md" @click="router.push('/pos')" />
        </div>
      </div>

      <!-- ── Formulario de corte ── -->
      <template v-else-if="summary">
        <!-- Resumen -->
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-slate-800">Resumen de la sesión</h2>
            <BtnApp label="Imprimir corte X" variant="ghost" size="sm" @click="printReport('X')" />
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase">Apertura</p>
              <p class="text-base font-bold text-slate-800">{{ formatCurrency(summary.opening_balance) }}</p>
              <p class="text-xs text-slate-400">{{ formatDateTime(summary.opened_at) }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase">Ventas ({{ summary.sales_count }})</p>
              <p class="text-base font-bold text-slate-800">{{ formatCurrency(summary.sales_total) }}</p>
              <p class="text-xs text-slate-400">Promedio {{ formatCurrency(summary.avg_ticket) }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase">Devoluciones ({{ summary.refunds_count }})</p>
              <p class="text-base font-bold text-rose-600">-{{ formatCurrency(summary.refunds_total) }}</p>
              <p class="text-xs text-slate-400">Descuentos {{ formatCurrency(summary.discounts_total) }}</p>
            </div>
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase">Mov. efectivo</p>
              <p class="text-base font-bold text-slate-800">
                +{{ formatCurrency(summary.cash_in) }} / -{{ formatCurrency(summary.cash_out) }}
              </p>
              <p class="text-xs text-slate-400">{{ movements.length }} movimiento(s)</p>
            </div>
          </div>
        </div>

        <!-- Arqueo -->
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6 mb-6">
          <h2 class="font-bold text-slate-800 mb-1">Arqueo por método de pago</h2>
          <p class="text-sm text-slate-500 mb-5">
            <template v-if="isBlind">
              Corte ciego activado: declara lo contado sin ver el monto esperado. Las diferencias se calculan al cerrar.
            </template>
            <template v-else>
              Declara lo contado por método. Tolerancia configurada: {{ formatCurrency(tolerance) }}.
            </template>
          </p>

          <div class="space-y-4">
            <div
              v-for="row in countRows"
              :key="row.payment_method_id"
              class="border border-slate-200 rounded-xl p-4"
            >
              <div class="flex flex-wrap items-end gap-4">
                <div class="flex-1 min-w-40">
                  <p class="font-semibold text-slate-700">
                    {{ row.name }}
                    <span v-if="row.is_cash" class="ml-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">EFECTIVO</span>
                  </p>
                  <p v-if="!isBlind" class="text-sm text-slate-400">
                    Esperado: <span class="font-semibold text-slate-600">{{ formatCurrency(row.expected) }}</span>
                  </p>
                </div>
                <div class="w-44">
                  <FormInput
                    v-model="row.counted"
                    type="number"
                    label="Contado"
                    :min="0"
                    step="0.01"
                    size="sm"
                  />
                </div>
                <div v-if="!isBlind" class="w-36 pb-1">
                  <p class="text-xs font-semibold text-slate-400 uppercase mb-1">Diferencia</p>
                  <p
                    :class="[
                      'text-base font-bold',
                      differenceOf(row) === 0 ? 'text-slate-400'
                        : differenceOf(row) > 0 ? 'text-emerald-600' : 'text-rose-600'
                    ]"
                  >
                    {{ differenceOf(row) > 0 ? '+' : '' }}{{ formatCurrency(differenceOf(row)) }}
                  </p>
                </div>
              </div>

              <div v-if="!isBlind && needsJustification(row)" class="mt-3">
                <FormInput
                  v-model="row.justification"
                  type="text"
                  label="Justificación de la diferencia"
                  placeholder="Obligatoria: excede la tolerancia"
                  size="sm"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Notas y confirmación -->
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <FormInput
            v-model="closingNotes"
            type="text"
            label="Notas de cierre (opcional)"
            size="md"
          />

          <p v-if="closeError" class="mt-3 text-sm text-red-600">{{ closeError }}</p>

          <div class="mt-5 flex flex-col sm:flex-row gap-3 justify-end">
            <BtnApp
              label="Volver a la venta"
              variant="ghost"
              size="md"
              @click="router.push(`/pos/terminal?session=${sessionId}`)"
            />
            <BtnApp
              label="Confirmar corte Z y cerrar sesión"
              variant="danger"
              size="md"
              :loading="isClosing"
              loading-text="Cerrando…"
              @click="confirmClose"
            />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
