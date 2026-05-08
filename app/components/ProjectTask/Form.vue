<script lang="ts">
import type { Database } from '~/types/database.types'

export type TaskStatus = Database['public']['Enums']['project_task_status']
export type TaskPriority = Database['public']['Enums']['project_priority']

export interface ProjectTaskFormData {
  code: string
  name: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  responsible_partner_id: string | null
  responsible_name: string
  start_date: string
  due_date: string
  estimated_hours: number
  actual_hours: number
  estimated_cost: number
  actual_cost: number
  progress: number
  order_index: number
  notes: string
}

export const createEmptyProjectTaskForm = (
  defaultResponsibleId?: string | null,
  defaultResponsibleName?: string
): ProjectTaskFormData => ({
  code: '',
  name: '',
  description: '',
  status: 'pending',
  priority: 'medium',
  responsible_partner_id: defaultResponsibleId ?? null,
  responsible_name: defaultResponsibleName ?? '',
  start_date: '',
  due_date: '',
  estimated_hours: 0,
  actual_hours: 0,
  estimated_cost: 0,
  actual_cost: 0,
  progress: 0,
  order_index: 10,
  notes: ''
})

export const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'pending', label: 'Inicio' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'completed', label: 'Terminado' },
  { value: 'cancelled', label: 'Cancelado' }
]

export const taskPriorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' }
]
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  partnerOptions?: { value: string; label: string }[]
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  partnerOptions: () => []
})

const formData = defineModel<ProjectTaskFormData>({ required: true })

const isEditing = computed(() => !props.readonly)

const responsibleSelectModel = computed({
  get: () => formData.value.responsible_partner_id ?? '',
  set: (v: string) => {
    formData.value.responsible_partner_id = v ? v : null
    const opt = props.partnerOptions.find(o => o.value === v)
    if (opt) formData.value.responsible_name = opt.label
  }
})

const hoursVariance = computed(() => {
  const estimated = Number(formData.value.estimated_hours ?? 0)
  const actual = Number(formData.value.actual_hours ?? 0)
  return actual - estimated
})

const costVariance = computed(() => {
  const estimated = Number(formData.value.estimated_cost ?? 0)
  const actual = Number(formData.value.actual_cost ?? 0)
  return actual - estimated
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value || 0)
}
</script>

<template>
  <div class="space-y-6">
    <!-- DATOS PRINCIPALES -->
    <div class="space-y-4">
      <FormInput
        v-model="formData.name"
        label="Nombre de la Tarea"
        placeholder="Describe brevemente el entregable…"
        :readonly="readonly"
        required
        size="md"
      />

      <FormTextArea
        v-model="formData.description"
        label="Descripción"
        placeholder="Detalla el alcance, criterios de aceptación o pasos…"
        :readonly="readonly"
        :rows="3"
        size="md"
      />
    </div>

    <!-- CLASIFICACIÓN -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormSelect
        v-model="formData.status"
        label="Estatus"
        :options="taskStatusOptions"
        :readonly="readonly"
        required
        size="md"
      />

      <FormSelect
        v-model="formData.priority"
        label="Prioridad"
        :options="taskPriorityOptions"
        :readonly="readonly"
        required
        size="md"
      />

      <div class="sm:col-span-2">
        <FormSelect
          v-if="partnerOptions.length > 0 && isEditing"
          v-model="responsibleSelectModel"
          label="Responsable"
          :options="partnerOptions"
          :readonly="readonly"
          placeholder="Hereda del responsable del proyecto si se deja vacío"
          size="md"
        />
        <FormInput
          v-else
          v-model="formData.responsible_name"
          label="Responsable"
          placeholder="Sin responsable asignado"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <!-- FECHAS -->
    <div class="border-t border-slate-200 pt-4">
      <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Fechas y Plazos
      </h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          v-model="formData.start_date"
          type="date"
          label="Fecha de Inicio"
          :readonly="readonly"
          size="md"
        />
        <FormInput
          v-model="formData.due_date"
          type="date"
          label="Fecha Límite"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <!-- ESFUERZO Y COSTOS -->
    <div class="border-t border-slate-200 pt-4">
      <h4 class="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Esfuerzo y Costos
      </h4>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          v-model="formData.estimated_hours"
          type="number"
          label="Horas Estimadas"
          placeholder="0"
          :readonly="readonly"
          size="md"
        />
        <FormInput
          v-model="formData.actual_hours"
          type="number"
          label="Horas Reales"
          placeholder="0"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.estimated_cost"
          type="number"
          label="Costo Estimado"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />
        <FormInput
          v-model="formData.actual_cost"
          type="number"
          label="Costo Real"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />
      </div>

      <div class="mt-3 grid grid-cols-2 gap-3">
        <div class="bg-slate-50 rounded-lg p-3">
          <p class="text-xs text-slate-500">Diferencia de horas</p>
          <p
            class="text-base font-semibold"
            :class="hoursVariance > 0 ? 'text-red-600' : hoursVariance < 0 ? 'text-emerald-600' : 'text-slate-700'"
          >
            {{ hoursVariance > 0 ? '+' : '' }}{{ hoursVariance.toFixed(2) }} h
          </p>
        </div>
        <div class="bg-slate-50 rounded-lg p-3">
          <p class="text-xs text-slate-500">Diferencia de costo</p>
          <p
            class="text-base font-semibold"
            :class="costVariance > 0 ? 'text-red-600' : costVariance < 0 ? 'text-emerald-600' : 'text-slate-700'"
          >
            {{ costVariance > 0 ? '+' : '' }}{{ formatCurrency(costVariance) }}
          </p>
        </div>
      </div>
    </div>

    <!-- AVANCE -->
    <div class="border-t border-slate-200 pt-4">
      <label class="block text-base font-medium text-slate-700 mb-2">
        Avance: {{ formData.progress }}%
      </label>
      <input
        v-model.number="formData.progress"
        type="range"
        min="0"
        max="100"
        step="5"
        :disabled="readonly"
        class="w-full accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div class="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600"
          :style="{ width: `${Math.min(Math.max(formData.progress ?? 0, 0), 100)}%` }"
        />
      </div>
    </div>

    <!-- NOTAS -->
    <div class="border-t border-slate-200 pt-4">
      <FormTextArea
        v-model="formData.notes"
        label="Notas internas"
        placeholder="Bloqueos, riesgos, decisiones tomadas…"
        :readonly="readonly"
        :rows="3"
        size="md"
      />
    </div>
  </div>
</template>
