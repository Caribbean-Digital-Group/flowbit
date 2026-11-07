<script lang="ts">
import type { HrLeaveTypeRow, LeaveKind } from '~/types/hr.types'

export interface LeaveTypeFormData {
  name: string
  kind: LeaveKind
  deducts_balance: boolean
  color: string
  description: string
}

export const createEmptyLeaveTypeForm = (): LeaveTypeFormData => ({
  name: '',
  kind: 'paid_leave',
  deducts_balance: false,
  color: 'indigo',
  description: ''
})

export const mapLeaveTypeToForm = (row: HrLeaveTypeRow): LeaveTypeFormData => ({
  name: row.name,
  kind: row.kind,
  deducts_balance: row.deducts_balance,
  color: row.color,
  description: row.description ?? ''
})

export const mapFormToLeaveType = (form: LeaveTypeFormData) => ({
  name: form.name.trim(),
  kind: form.kind,
  deducts_balance: form.deducts_balance,
  color: form.color,
  description: trimToNull(form.description)
})

/** Efecto de cada clase de ausencia en la nómina, para orientar al usuario. */
export const LEAVE_KIND_PAYROLL_EFFECT: Record<LeaveKind, string> = {
  vacation: 'Se paga el sueldo de esos días más la prima vacacional.',
  paid_leave: 'Se paga el sueldo de esos días.',
  unpaid_leave: 'Esos días no se pagan y no cotizan al IMSS.',
  sick: 'No los paga la empresa: el IMSS cubre la incapacidad y no se cotizan.'
}
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<LeaveTypeFormData>({ required: true })
const kindOptions = LEAVE_KIND_OPTIONS
const colorOptions = LEAVE_COLOR_OPTIONS

watch(() => formData.value.kind, (kind) => {
  if (kind === 'vacation') formData.value.deducts_balance = true
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <FormInput
      v-model="formData.name"
      label="Nombre"
      placeholder="Ej: Permiso por matrimonio"
      :readonly="readonly"
      required
      size="md"
    />
    <FormSelect
      v-model="formData.kind"
      label="Clase"
      :options="kindOptions"
      :disabled="readonly"
      required
      size="md"
    />
    <div class="sm:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
      {{ LEAVE_KIND_PAYROLL_EFFECT[formData.kind] }}
    </div>
    <FormSelect
      v-model="formData.color"
      label="Color"
      :options="colorOptions"
      :disabled="readonly"
      size="md"
    />
    <label class="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
      <input
        v-model="formData.deducts_balance"
        type="checkbox"
        class="h-4 w-4 rounded border-slate-300 text-indigo-600"
        :disabled="readonly || formData.kind === 'vacation'"
      >
      Descuenta saldo (requiere asignar días)
    </label>
    <div class="sm:col-span-2">
      <FormTextArea v-model="formData.description" label="Descripción" :rows="2" :readonly="readonly" size="md" />
    </div>
  </div>
</template>
