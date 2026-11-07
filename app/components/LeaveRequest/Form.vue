<script lang="ts">
import type { HrLeaveRequestRow } from '~/types/hr.types'

export interface LeaveRequestFormData {
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  half_day: boolean
  reason: string
}

export const createEmptyLeaveRequestForm = (employeeId = ''): LeaveRequestFormData => ({
  employee_id: employeeId,
  leave_type_id: '',
  start_date: '',
  end_date: '',
  half_day: false,
  reason: ''
})

export const mapLeaveRequestToForm = (row: HrLeaveRequestRow): LeaveRequestFormData => ({
  employee_id: row.employee_id,
  leave_type_id: row.leave_type_id,
  start_date: row.start_date,
  end_date: row.end_date,
  half_day: row.half_day,
  reason: row.reason ?? ''
})

export const validateLeaveRequestForm = (form: LeaveRequestFormData): string | null => {
  if (!form.employee_id) return 'Elige al empleado.'
  if (!form.leave_type_id) return 'Elige el tipo de ausencia.'
  if (!form.start_date || !form.end_date) return 'Indica las fechas de inicio y fin.'
  if (form.end_date < form.start_date) return 'La fecha de fin no puede ser anterior a la de inicio.'
  if (form.half_day && form.start_date !== form.end_date) return 'El medio día solo aplica a solicitudes de un día.'
  return null
}
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  employeeOptions?: HrOption[]
  typeOptions?: HrOption[]
  lockEmployee?: boolean
  /** Saldo disponible del tipo elegido, si descuenta saldo. */
  balance?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  employeeOptions: () => [],
  typeOptions: () => [],
  lockEmployee: false,
  balance: null
})

const formData = defineModel<LeaveRequestFormData>({ required: true })
const { countDays } = useLeave()
const days = ref<number | null>(null)

watch(
  () => [formData.value.employee_id, formData.value.start_date, formData.value.end_date, formData.value.half_day] as const,
  async ([employeeId, start, end, halfDay]) => {
    if (start && !end) formData.value.end_date = start
    days.value = await countDays(employeeId, start, end || start, halfDay)
  },
  { immediate: true }
)

const exceedsBalance = computed(() => props.balance !== null && days.value !== null && days.value > props.balance)
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <FormSelect
      v-model="formData.employee_id"
      label="Empleado"
      :options="employeeOptions"
      :disabled="readonly || lockEmployee"
      placeholder="Selecciona un empleado"
      searchable
      required
      size="md"
    />
    <FormSelect
      v-model="formData.leave_type_id"
      label="Tipo de ausencia"
      :options="typeOptions"
      :disabled="readonly"
      placeholder="Selecciona un tipo"
      required
      size="md"
    />
    <FormInput v-model="formData.start_date" type="date" label="Desde" :readonly="readonly" required size="md" />
    <FormInput v-model="formData.end_date" type="date" label="Hasta" :readonly="readonly" required size="md" />
    <label class="flex items-center gap-2 text-sm text-slate-700">
      <input
        v-model="formData.half_day"
        type="checkbox"
        class="h-4 w-4 rounded border-slate-300 text-indigo-600"
        :disabled="readonly || formData.start_date !== formData.end_date"
      >
      Medio día
    </label>
    <div class="rounded-xl bg-slate-50 px-4 py-3 text-sm" :class="exceedsBalance ? 'text-red-700' : 'text-slate-600'">
      <template v-if="days !== null">
        {{ days }} {{ days === 1 ? 'día laborable' : 'días laborables' }}
        <template v-if="balance !== null">
          · saldo disponible: {{ balance }}
        </template>
      </template>
      <template v-else>
        Elige las fechas para contar los días laborables.
      </template>
    </div>
    <div class="sm:col-span-2">
      <FormTextArea v-model="formData.reason" label="Motivo" :rows="3" :readonly="readonly" size="md" />
    </div>
  </div>
</template>
