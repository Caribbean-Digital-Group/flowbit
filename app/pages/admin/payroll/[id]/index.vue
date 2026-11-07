<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { Column } from '~/components/Datatable.vue'
import type { StatItem } from '~/components/StatGrid.vue'
import type { PayrollAdjustmentRow, PayrollPeriodRow, PayrollPeriodStatus, PayrollSlipViewRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const {
  getPeriod, updatePeriod, setStatus, calculate, getSlips, getAdjustments, createAdjustment, archiveAdjustment, lastError
} = usePayroll()
const { getAll: getEmployees } = useEmployee()

const period = ref<PayrollPeriodRow | null>(null)
const slips = ref<PayrollSlipViewRow[]>([])
const adjustments = ref<PayrollAdjustmentRow[]>([])
const employeeOptions = ref<HrOption[]>([])
const warnings = ref<string[]>([])
const isLoading = ref(false)
const isEditing = ref(false)
const form = ref({ name: '', payment_date: '', notes: '' })
const message = ref<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null)
const newAdjustment = ref({ employee_id: '', preset: 'bonus', name: 'Bono', amount: '' as string | number })

const periodId = computed(() => String(route.params.id ?? ''))
const isOpen = computed(() => period.value?.status === 'draft' || period.value?.status === 'calculated')

const presetOptions = PAYROLL_ADJUSTMENT_PRESETS.map(p => ({
  value: p.code,
  label: `${p.kind === 'perception' ? 'Percepción' : 'Deducción'} · ${p.name}`
}))

watch(() => newAdjustment.value.preset, (code) => {
  const preset = PAYROLL_ADJUSTMENT_PRESETS.find(p => p.code === code)
  if (preset) newAdjustment.value.name = preset.name
})

const statusVariant = computed(() => {
  switch (period.value?.status) {
    case 'paid': return 'success'
    case 'approved': return 'primary'
    case 'calculated': return 'info'
    case 'cancelled': return 'danger'
    default: return 'secondary'
  }
})

const stats = computed<StatItem[]>(() => {
  const p = period.value
  if (!p) return []
  const sum = (key: keyof PayrollSlipViewRow) => slips.value.reduce((s, r) => s + Number(r[key] ?? 0), 0)
  return [
    { label: 'Percepciones', value: formatMoney(p.total_perceptions) },
    { label: 'Deducciones', value: formatMoney(p.total_deductions) },
    { label: 'Neto a pagar', value: formatMoney(p.total_net) },
    { label: 'Costo total empresa', value: formatMoney(p.total_employer_cost) },
    { label: 'ISR retenido', value: formatMoney(sum('isr')) },
    { label: 'IMSS obrero', value: formatMoney(sum('imss_employee')) },
    { label: 'IMSS patronal + INFONAVIT', value: formatMoney(sum('imss_employer') + sum('infonavit_employer')) },
    { label: 'Impuesto sobre nómina', value: formatMoney(sum('isn')) }
  ]
})

const slipColumns: Column[] = [
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'paid_days', label: 'Días pagados', type: 'text', align: 'right' },
  { key: 'daily', label: 'Salario diario', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'perceptions', label: 'Percepciones', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'isr', label: 'ISR', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'imss', label: 'IMSS', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'deductions', label: 'Deducciones', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'net', label: 'Neto', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'cost', label: 'Costo empresa', type: 'currency', currency: 'MXN', align: 'right' }
]

const slipRows = computed(() => slips.value.map(s => ({
  id: s.id,
  employee: s.employee_name ?? '—',
  paid_days: Number(s.paid_days),
  daily: Number(s.daily_salary),
  perceptions: Number(s.total_perceptions),
  isr: Number(s.isr),
  imss: Number(s.imss_employee),
  deductions: Number(s.total_deductions),
  net: Number(s.net_pay),
  cost: Number(s.employer_cost)
})))

const adjustmentRows = computed(() => adjustments.value.map(a => ({
  ...a,
  employee: employeeOptions.value.find(e => e.value === a.employee_id)?.label ?? '—'
})))

const menuOptions = computed<MenuOption[]>(() => {
  const status = period.value?.status
  const options: MenuOption[] = []
  if (status === 'approved') {
    options.push({ id: 'reopen', label: 'Reabrir para recalcular', action: () => void changeStatus('calculated'), variant: 'warning' })
  }
  if (status === 'draft' || status === 'calculated') {
    options.push({ id: 'cancel', label: 'Cancelar nómina', icon: 'M6 18L18 6M6 6l12 12', action: () => void changeStatus('cancelled'), variant: 'danger' })
  }
  return options
})

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !periodId.value || !isSelectedCompanyAdmin.value) return
  isLoading.value = true
  try {
    const [p, s, a, e] = await Promise.all([
      getPeriod(periodId.value, companyId),
      getSlips(periodId.value),
      getAdjustments(periodId.value),
      employeeOptions.value.length ? Promise.resolve(null) : getEmployees(companyId)
    ])
    period.value = p
    slips.value = s
    adjustments.value = a
    if (e) employeeOptions.value = e.filter(x => x.status === 'active').map(x => ({ value: x.id, label: x.partner_name ?? '—' }))
    if (p) form.value = { name: p.name, payment_date: p.payment_date ?? '', notes: p.notes ?? '' }
    else message.value = { kind: 'error', text: 'No se encontró la nómina.' }
  } finally {
    isLoading.value = false
  }
}

const handleCalculate = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    const result = await calculate(periodId.value, companyId)
    if (!result) {
      message.value = { kind: 'error', text: lastError.value ?? 'No se pudo calcular la nómina.' }
      return
    }
    warnings.value = result.warnings
    message.value = { kind: 'success', text: `Nómina calculada para ${result.period.employee_count} empleados.` }
  } finally {
    isLoading.value = false
  }
  await load()
}

const changeStatus = async (status: PayrollPeriodStatus) => {
  const updated = await setStatus(periodId.value, status)
  if (!updated) {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo cambiar el estado.' }
    return
  }
  const labels: Partial<Record<PayrollPeriodStatus, string>> = {
    approved: 'Nómina aprobada. Los recibos ya son visibles para cada empleado con usuario.',
    paid: 'Nómina marcada como pagada.',
    calculated: 'Nómina reabierta: puedes ajustar y recalcular.',
    cancelled: 'Nómina cancelada.'
  }
  message.value = { kind: 'success', text: labels[status] ?? 'Estado actualizado.' }
  await load()
}

const handleSaveHeader = async () => {
  if (!form.value.name.trim()) {
    message.value = { kind: 'error', text: 'Indica el nombre del periodo.' }
    return
  }
  const saved = await updatePeriod(periodId.value, {
    name: form.value.name.trim(),
    payment_date: form.value.payment_date || null,
    notes: trimToNull(form.value.notes)
  })
  if (!saved) {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo guardar.' }
    return
  }
  isEditing.value = false
  await load()
}

const handleAddAdjustment = async () => {
  const companyId = selectedCompanyId.value
  const preset = PAYROLL_ADJUSTMENT_PRESETS.find(p => p.code === newAdjustment.value.preset)
  const amount = toNumberOrNull(newAdjustment.value.amount)
  if (!companyId || !preset) return
  if (!newAdjustment.value.employee_id || !amount || amount <= 0) {
    message.value = { kind: 'error', text: 'Elige al empleado e indica un importe mayor a cero.' }
    return
  }
  const created = await createAdjustment({
    company_id: companyId,
    period_id: periodId.value,
    employee_id: newAdjustment.value.employee_id,
    kind: preset.kind,
    code: preset.code,
    name: newAdjustment.value.name.trim() || preset.name,
    amount,
    is_taxable: preset.taxable,
    sat_code: preset.satCode
  })
  if (!created) {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo agregar el ajuste.' }
    return
  }
  newAdjustment.value.amount = ''
  message.value = { kind: 'info', text: 'Ajuste agregado. Recalcula la nómina para incluirlo.' }
  adjustments.value = await getAdjustments(periodId.value)
}

const handleRemoveAdjustment = async (id: string) => {
  if (await archiveAdjustment(id)) {
    adjustments.value = await getAdjustments(periodId.value)
    message.value = { kind: 'info', text: 'Ajuste quitado. Recalcula la nómina para reflejarlo.' }
  } else {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo quitar el ajuste.' }
  }
}

watch([periodId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <div v-if="!isSelectedCompanyAdmin" class="w-full py-4">
    <HrNotice kind="admin-only" />
  </div>
  <CardSheet
    v-else
    :title="period?.name || 'Nómina'"
    :subtitle="period ? `Del ${formatHrDate(period.start_date)} al ${formatHrDate(period.end_date)} · pago ${formatHrDate(period.payment_date)}` : ''"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-edit-button="Boolean(period && period.status !== 'cancelled')"
    :show-options-button="menuOptions.length > 0"
    :created-by="period?.created_by ?? '—'"
    :created-at="period?.created_at ?? ''"
    :updated-by="period?.updated_by ?? '—'"
    :updated-at="period?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="router.push('/admin/payroll')"
    @edit="isEditing = true"
    @save="handleSaveHeader"
    @cancel="isEditing = false"
  >
    <template v-if="period" #status>
      <BadgeApp :label="PAYROLL_STATUS_LABELS[period.status] ?? period.status" :variant="statusVariant" />
    </template>

    <HrNotice v-if="message" :kind="message.kind" :message="message.text" class="mb-4" />
    <HrNotice v-if="warnings.length" kind="info" message="Algunos empleados requieren atención:" class="mb-4">
      <ul class="mt-2 list-disc pl-5 text-sm">
        <li v-for="w in warnings" :key="w">
          {{ w }}
        </li>
      </ul>
    </HrNotice>

    <template v-if="period">
      <div v-if="isEditing" class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput v-model="form.name" label="Nombre" size="md" />
        <FormInput v-model="form.payment_date" type="date" label="Fecha de pago" size="md" />
        <div class="sm:col-span-2">
          <FormTextArea v-model="form.notes" label="Notas" :rows="2" size="md" />
        </div>
      </div>

      <div class="mb-6 flex flex-wrap gap-2">
        <BtnApp v-if="isOpen" variant="primary" size="md" :loading="isLoading" @click="handleCalculate">
          {{ period.status === 'draft' ? 'Calcular nómina' : 'Recalcular' }}
        </BtnApp>
        <BtnApp v-if="period.status === 'calculated'" variant="success" size="md" @click="changeStatus('approved')">
          Aprobar nómina
        </BtnApp>
        <BtnApp v-if="period.status === 'approved'" variant="success" size="md" @click="changeStatus('paid')">
          Marcar como pagada
        </BtnApp>
        <BtnApp variant="secondary" size="md" @click="navigateTo('/admin/attendances/report')">
          Revisar asistencia
        </BtnApp>
      </div>

      <StatGrid v-if="period.status !== 'draft'" :stats="stats" :columns="4" class="mb-8" />

      <section v-if="isOpen" class="mb-8">
        <h3 class="mb-1 text-base font-semibold text-slate-800">
          Ajustes del periodo
        </h3>
        <p class="mb-4 text-sm text-slate-500">
          Bonos, aguinaldo, comisiones, préstamos y otros conceptos que no salen de la asistencia.
        </p>
        <div class="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_8rem_auto] lg:items-end">
          <FormSelect v-model="newAdjustment.employee_id" label="Empleado" :options="employeeOptions" searchable size="sm" />
          <FormSelect v-model="newAdjustment.preset" label="Concepto" :options="presetOptions" size="sm" />
          <FormInput v-model="newAdjustment.name" label="Descripción" size="sm" />
          <FormInput v-model="newAdjustment.amount" type="number" step="0.01" min="0" label="Importe" size="sm" />
          <BtnApp variant="secondary" size="sm" @click="handleAddAdjustment">
            Agregar
          </BtnApp>
        </div>
        <div v-if="adjustmentRows.length" class="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          <div v-for="a in adjustmentRows" :key="a.id" class="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <div class="min-w-0">
              <p class="truncate font-medium text-slate-800">
                {{ a.employee }} · {{ a.name }}
              </p>
              <p class="text-xs text-slate-500">
                {{ a.kind === 'perception' ? 'Percepción' : 'Deducción' }}<template v-if="a.sat_code">
                  · clave SAT {{ a.sat_code }}
                </template>
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span :class="a.kind === 'perception' ? 'text-emerald-700' : 'text-red-700'">
                {{ a.kind === 'perception' ? '+' : '−' }}{{ formatMoney(a.amount) }}
              </span>
              <BtnApp variant="ghost" size="sm" @click="handleRemoveAdjustment(a.id)">
                Quitar
              </BtnApp>
            </div>
          </div>
        </div>
      </section>

      <Datatable
        v-if="period.status !== 'draft'"
        title="Recibos"
        description="Abre un recibo para ver el detalle de percepciones, deducciones y cuotas patronales."
        :data="slipRows"
        :columns="slipColumns"
        :search-keys="['employee']"
        :export-filename="`nomina-${period.start_date}`"
        empty-title="Sin recibos"
        empty-message="Ningún empleado tenía salario registrado en este periodo."
        @row-click="row => navigateTo(`/admin/payroll/slips/${row.id}`)"
      >
        <template #actions="{ row }">
          <BtnApp variant="ghost" size="sm" title="Ver detalle" @click="navigateTo(`/admin/payroll/slips/${row.id}`)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </template>
          </BtnApp>
        </template>
      </Datatable>
      <HrNotice
        v-else
        kind="info"
        message="Calcula la nómina para generar los recibos. El cálculo usa el salario vigente al final del periodo, las horas extra aprobadas, las vacaciones y permisos aprobados, las faltas que se descuentan y los ajustes de arriba."
      />
    </template>
  </CardSheet>
</template>
