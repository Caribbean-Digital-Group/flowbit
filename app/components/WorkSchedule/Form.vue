<script lang="ts">
import type { HrWorkScheduleLineInput } from '~/types/hr.types'
import type { WorkScheduleWithLines } from '~/composables/useWorkSchedule'

export interface WorkScheduleDayForm {
  weekday: number
  enabled: boolean
  start_time: string
  end_time: string
  break_minutes: string | number
}

export interface WorkScheduleFormData {
  name: string
  description: string
  late_tolerance_minutes: string | number
  days: WorkScheduleDayForm[]
}

/** Horario de oficina de lunes a viernes, 9:00 a 18:00 con una hora de comida. */
export const createEmptyWorkScheduleForm = (): WorkScheduleFormData => ({
  name: '',
  description: '',
  late_tolerance_minutes: '',
  days: WEEKDAY_ORDER.map(weekday => ({
    weekday,
    enabled: weekday >= 1 && weekday <= 5,
    start_time: '09:00',
    end_time: '18:00',
    break_minutes: 60
  }))
})

export const mapWorkScheduleToForm = (schedule: WorkScheduleWithLines): WorkScheduleFormData => ({
  name: schedule.name,
  description: schedule.description ?? '',
  late_tolerance_minutes: schedule.late_tolerance_minutes ?? '',
  days: WEEKDAY_ORDER.map(weekday => {
    const line = schedule.lines.find(l => l.weekday === weekday)
    return {
      weekday,
      enabled: Boolean(line),
      start_time: line?.start_time.slice(0, 5) ?? '09:00',
      end_time: line?.end_time.slice(0, 5) ?? '18:00',
      break_minutes: line?.break_minutes ?? 60
    }
  })
})

export const mapFormToScheduleLines = (form: WorkScheduleFormData): HrWorkScheduleLineInput[] =>
  form.days
    .filter(d => d.enabled)
    .map(d => ({
      weekday: d.weekday,
      start_time: d.start_time,
      end_time: d.end_time,
      break_minutes: Number(d.break_minutes) || 0
    }))

export const mapFormToSchedule = (form: WorkScheduleFormData) => ({
  name: form.name.trim(),
  description: trimToNull(form.description),
  late_tolerance_minutes: toNumberOrNull(form.late_tolerance_minutes)
})

export const validateWorkScheduleForm = (form: WorkScheduleFormData): string | null => {
  if (!form.name.trim()) return 'El nombre es obligatorio.'
  return validateScheduleLines(mapFormToScheduleLines(form))
}
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<WorkScheduleFormData>({ required: true })

const weeklyMinutes = computed(() =>
  formData.value.days
    .filter(d => d.enabled && d.end_time > d.start_time)
    .reduce((sum, d) => sum + scheduledMinutes(d.start_time, d.end_time, Number(d.break_minutes) || 0), 0)
)
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormInput
        v-model="formData.name"
        label="Nombre"
        placeholder="Ej: Oficina 9 a 6"
        :readonly="readonly"
        required
        size="md"
      />
      <FormInput
        v-model="formData.late_tolerance_minutes"
        type="number"
        label="Tolerancia de retardo (min)"
        placeholder="Usa la de la empresa"
        hint="Minutos después de la entrada antes de contar retardo."
        min="0"
        max="240"
        :readonly="readonly"
        size="md"
      />
      <div class="sm:col-span-2">
        <FormTextArea
          v-model="formData.description"
          label="Descripción"
          :rows="2"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <div>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-800">
          Jornada por día
        </h3>
        <span class="text-sm text-slate-500">
          {{ formatMinutes(weeklyMinutes) }} a la semana
        </span>
      </div>

      <div class="divide-y divide-slate-100 rounded-2xl border border-slate-200">
        <div
          v-for="day in formData.days"
          :key="day.weekday"
          class="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[10rem_1fr_1fr_1fr] sm:items-center"
        >
          <label class="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              v-model="day.enabled"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              :disabled="readonly"
            >
            {{ WEEKDAY_LABELS[day.weekday] }}
          </label>
          <template v-if="day.enabled">
            <FormInput v-model="day.start_time" type="time" label="Entrada" :readonly="readonly" size="sm" />
            <FormInput v-model="day.end_time" type="time" label="Salida" :readonly="readonly" size="sm" />
            <FormInput v-model="day.break_minutes" type="number" label="Comida (min)" min="0" :readonly="readonly" size="sm" />
          </template>
          <p v-else class="text-sm text-slate-400 sm:col-span-3">
            Descanso
          </p>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500">
        Los turnos no cruzan la medianoche. Un día sin jornada es de descanso: trabajarlo se paga doble.
      </p>
    </div>
  </div>
</template>
