<script lang="ts">
import type { HrSalaryRow, SalaryReason } from '~/types/hr.types'

export interface SalaryFormData {
  employee_id: string
  effective_date: string
  salary_type: 'monthly' | 'daily'
  amount: string | number
  integrated_daily_wage: string | number
  contribution_base: string | number
  reason: SalaryReason
  notes: string
}

export const createEmptySalaryForm = (employeeId = ''): SalaryFormData => ({
  employee_id: employeeId,
  effective_date: todayIn(),
  salary_type: 'monthly',
  amount: '',
  integrated_daily_wage: '',
  contribution_base: '',
  reason: 'adjustment',
  notes: ''
})

export const mapSalaryToForm = (row: HrSalaryRow): SalaryFormData => ({
  employee_id: row.employee_id,
  effective_date: row.effective_date,
  salary_type: row.salary_type,
  amount: row.amount,
  integrated_daily_wage: row.integrated_daily_wage ?? '',
  contribution_base: row.contribution_base ?? '',
  reason: row.reason,
  notes: row.notes ?? ''
})

export const mapFormToSalary = (form: SalaryFormData) => ({
  effective_date: form.effective_date,
  salary_type: form.salary_type,
  amount: toNumberOrNull(form.amount) ?? 0,
  integrated_daily_wage: toNumberOrNull(form.integrated_daily_wage),
  contribution_base: toNumberOrNull(form.contribution_base),
  reason: form.reason,
  notes: trimToNull(form.notes)
})

export const validateSalaryForm = (form: SalaryFormData): string | null => {
  if (!form.employee_id) return 'Elige al empleado.'
  if (!form.effective_date) return 'Indica la fecha de vigencia.'
  const amount = toNumberOrNull(form.amount)
  if (!amount || amount <= 0) return 'El salario debe ser mayor a cero.'
  return null
}

export const salaryDaily = (form: SalaryFormData): number => {
  const amount = toNumberOrNull(form.amount) ?? 0
  return form.salary_type === 'monthly' ? dailyFromMonthly(amount) : amount
}
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  lockEmployee?: boolean
  employeeOptions?: HrOption[]
  /** Fecha de ingreso del empleado elegido, para el factor de integración. */
  hireDate?: string | null
  minimumWage?: number
  aguinaldoDays?: number
  vacationPremiumRate?: number
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  lockEmployee: false,
  employeeOptions: () => [],
  hireDate: null,
  minimumWage: 315.04,
  aguinaldoDays: 15,
  vacationPremiumRate: 25
})

const formData = defineModel<SalaryFormData>({ required: true })

const daily = computed(() => salaryDaily(formData.value))
const belowMinimum = computed(() => daily.value > 0 && daily.value < props.minimumWage)
const years = computed(() => props.hireDate ? completedYears(props.hireDate, formData.value.effective_date || todayIn()) : 0)
const suggestedSdi = computed(() => suggestIntegratedDailyWage(daily.value, years.value, {
  aguinaldoDays: props.aguinaldoDays,
  vacationPremiumRate: props.vacationPremiumRate
}))

const applySuggestion = () => {
  formData.value.integrated_daily_wage = suggestedSdi.value
  formData.value.contribution_base = suggestedSdi.value
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <FormSelect
      v-model="formData.employee_id"
      label="Empleado"
      :options="employeeOptions"
      :disabled="readonly || lockEmployee"
      searchable
      required
      size="md"
    />
    <FormInput v-model="formData.effective_date" type="date" label="Vigente desde" :readonly="readonly" required size="md" />
    <FormSelect v-model="formData.salary_type" label="Tipo" :options="SALARY_TYPE_OPTIONS" :disabled="readonly" size="md" />
    <FormInput
      v-model="formData.amount"
      type="number"
      step="0.01"
      min="0"
      :label="formData.salary_type === 'monthly' ? 'Sueldo mensual' : 'Salario diario'"
      :readonly="readonly"
      required
      size="md"
    />

    <div
      :class="[
        'sm:col-span-2 rounded-xl px-4 py-3 text-sm',
        belowMinimum ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'
      ]"
    >
      Salario diario: <strong>{{ formatMoney(daily) }}</strong>
      · mensual (30 días): <strong>{{ formatMoney(daily * 30) }}</strong>
      <template v-if="belowMinimum">
        · está por debajo del salario mínimo ({{ formatMoney(minimumWage) }} diarios).
      </template>
    </div>

    <FormInput
      v-model="formData.integrated_daily_wage"
      type="number"
      step="0.01"
      min="0"
      label="Salario diario integrado (SDI)"
      :readonly="readonly"
      size="md"
    />
    <FormInput
      v-model="formData.contribution_base"
      type="number"
      step="0.01"
      min="0"
      label="Salario base de cotización (SBC)"
      hint="Si lo dejas vacío, la nómina usa el SDI sugerido."
      :readonly="readonly"
      size="md"
    />
    <div v-if="!readonly && daily > 0" class="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-indigo-200 px-4 py-3 text-sm text-slate-600">
      <span>
        SDI sugerido con prestaciones de ley ({{ years }} {{ years === 1 ? 'año' : 'años' }} de antigüedad, factor {{ integrationFactor(years, aguinaldoDays, vacationPremiumRate).toFixed(4) }}):
        <strong>{{ formatMoney(suggestedSdi) }}</strong>
      </span>
      <BtnApp variant="secondary" size="sm" @click="applySuggestion">
        Usar sugerido
      </BtnApp>
    </div>

    <FormSelect v-model="formData.reason" label="Motivo" :options="SALARY_REASON_OPTIONS" :disabled="readonly" size="md" />
    <div class="sm:col-span-2">
      <FormTextArea v-model="formData.notes" label="Notas" :rows="2" :readonly="readonly" size="md" />
    </div>
  </div>
</template>
