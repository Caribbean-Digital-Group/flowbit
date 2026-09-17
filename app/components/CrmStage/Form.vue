<script lang="ts">
import type { CrmLeadStageRow, CrmLeadStageUpdate, CrmStageColor } from '~/types/crm.types'

export interface CrmStageFormData {
  name: string
  sequence: number
  description: string
  is_won: boolean
  is_lost: boolean
  color: CrmStageColor
  /** Cadena vacía = sin probabilidad por defecto */
  probability: number | ''
  /** Cadena vacía = sin alerta de estancamiento */
  rotting_days: number | ''
}

export const createEmptyCrmStageForm = (): CrmStageFormData => ({
  name: '',
  sequence: 10,
  description: '',
  is_won: false,
  is_lost: false,
  color: 'indigo',
  probability: '',
  rotting_days: ''
})

export const mapCrmStageToForm = (stage: CrmLeadStageRow): CrmStageFormData => ({
  name: stage.name,
  sequence: stage.sequence,
  description: stage.description ?? '',
  is_won: stage.is_won,
  is_lost: stage.is_lost,
  color: stage.color ?? 'indigo',
  probability: stage.probability ?? '',
  rotting_days: stage.rotting_days ?? ''
})

export const mapCrmStageFormToPayload = (value: CrmStageFormData): CrmLeadStageUpdate & { name: string } => {
  const isClosing = value.is_won || value.is_lost
  const rotting = Number(value.rotting_days)
  return {
    name: value.name.trim(),
    sequence: Number(value.sequence) || 10,
    description: value.description.trim() || null,
    is_won: value.is_won,
    is_lost: value.is_lost,
    color: value.color,
    probability: value.probability === '' ? null : Math.min(100, Math.max(0, Number(value.probability))),
    rotting_days: !isClosing && rotting > 0 ? Math.round(rotting) : null
  }
}
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<CrmStageFormData>({ required: true })

const hasProbability = computed(() => formData.value.probability !== '')
const palette = computed(() => getStagePalette(formData.value.color))

const handleIsWonChange = (checked: boolean) => {
  formData.value.is_won = checked
  if (checked) {
    formData.value.is_lost = false
    formData.value.color = 'emerald'
    formData.value.probability = 100
    formData.value.rotting_days = ''
  }
}

const handleIsLostChange = (checked: boolean) => {
  formData.value.is_lost = checked
  if (checked) {
    formData.value.is_won = false
    formData.value.color = 'rose'
    formData.value.probability = 0
    formData.value.rotting_days = ''
  }
}

const toggleProbability = () => {
  if (props.readonly) return
  formData.value.probability = hasProbability.value ? '' : 50
}

const selectColor = (color: CrmStageColor) => {
  if (props.readonly) return
  formData.value.color = color
}
</script>

<template>
  <div class="space-y-0">
    <div class="grid grid-cols-1 gap-6 pb-6 md:grid-cols-2 lg:grid-cols-4">
      <div class="lg:col-span-2">
        <FormInput
          v-model="formData.name"
          label="Nombre de la etapa"
          placeholder="Ej. En negociación"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.sequence"
          type="number"
          label="Orden / posición"
          placeholder="10"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <!-- Vista previa del encabezado de columna -->
      <div>
        <p class="mb-2 block text-base font-medium text-slate-700">Vista previa en el tablero</p>
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div :class="['h-1', palette.bar]" />
          <div :class="['flex items-center gap-2 px-3 py-2.5', palette.soft]">
            <span :class="['h-2.5 w-2.5 rounded-full', palette.dot]" />
            <span class="truncate text-sm font-semibold text-slate-800">{{ formData.name || 'Nombre de la etapa' }}</span>
            <span class="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 shadow-sm">0</span>
          </div>
        </div>
      </div>
    </div>

    <!-- APARIENCIA Y PRONÓSTICO -->
    <div class="border-t border-slate-200 pt-6">
      <h4 class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        Apariencia y pronóstico
      </h4>

      <div class="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 lg:grid-cols-3">
        <!-- Color -->
        <div>
          <p class="mb-2 text-sm font-medium text-slate-700">Color de la columna</p>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de la etapa">
            <button
              v-for="color in CRM_STAGE_COLORS"
              :key="color"
              type="button"
              role="radio"
              :aria-checked="formData.color === color"
              :aria-label="CRM_STAGE_PALETTE[color].label"
              :title="CRM_STAGE_PALETTE[color].label"
              :disabled="props.readonly && formData.color !== color"
              :class="[
                'flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-slate-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                CRM_STAGE_PALETTE[color].dot,
                formData.color === color ? 'scale-110 ring-2 ring-slate-800' : 'opacity-80 hover:scale-105 hover:opacity-100',
                props.readonly && formData.color !== color ? 'hidden' : '',
                props.readonly ? 'cursor-default' : 'cursor-pointer'
              ]"
              @click="selectColor(color)"
            >
              <svg v-if="formData.color === color" class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Probabilidad -->
        <div>
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-slate-700">
              Probabilidad al entrar
              <span v-if="hasProbability" class="font-bold text-indigo-600">{{ formData.probability }}%</span>
            </p>
            <label v-if="!readonly" class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                :checked="hasProbability"
                class="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                @change="toggleProbability"
              >
              Asignar automáticamente
            </label>
          </div>
          <template v-if="hasProbability">
            <input
              v-model.number="formData.probability"
              type="range"
              min="0"
              max="100"
              step="5"
              class="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600"
              :disabled="readonly"
              aria-label="Probabilidad de cierre de la etapa"
            >
            <div class="mt-1 flex justify-between text-xs text-slate-400">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </template>
          <p v-else class="text-xs text-slate-500">
            El lead conserva su probabilidad actual al moverse a esta etapa.
          </p>
        </div>

        <!-- Estancamiento -->
        <div>
          <FormInput
            v-model="formData.rotting_days"
            type="number"
            label="Alerta de estancamiento (días)"
            placeholder="Sin alerta"
            :readonly="props.readonly || formData.is_won || formData.is_lost"
            size="md"
          />
          <p class="mt-1 text-xs text-slate-500">
            {{ formData.is_won || formData.is_lost
              ? 'No aplica a etapas de cierre.'
              : 'Resalta en el tablero los leads que llevan más días sin avanzar.' }}
          </p>
        </div>
      </div>
    </div>

    <div class="mt-6 border-t border-slate-200 pt-6">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <h4 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tipo de cierre
          </h4>

          <div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label
              class="flex cursor-pointer select-none items-start gap-3"
              :class="{ 'pointer-events-none opacity-70': readonly }"
            >
              <input
                type="checkbox"
                :checked="formData.is_won"
                class="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                :disabled="readonly"
                @change="handleIsWonChange(($event.target as HTMLInputElement).checked)"
              >
              <div>
                <p class="text-sm font-semibold text-slate-800">
                  Cierre ganado
                </p>
                <p class="mt-0.5 text-xs text-slate-500">
                  Al llegar a esta etapa el lead se marca como Ganado y se registra la fecha de cierre real.
                </p>
              </div>
            </label>

            <label
              class="flex cursor-pointer select-none items-start gap-3"
              :class="{ 'pointer-events-none opacity-70': readonly }"
            >
              <input
                type="checkbox"
                :checked="formData.is_lost"
                class="mt-1 h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                :disabled="readonly"
                @change="handleIsLostChange(($event.target as HTMLInputElement).checked)"
              >
              <div>
                <p class="text-sm font-semibold text-slate-800">
                  Cierre cancelado / perdido
                </p>
                <p class="mt-0.5 text-xs text-slate-500">
                  Al llegar a esta etapa se solicita el motivo de pérdida y se registra la fecha de cierre real.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descripción / criterio de entrada
          </h4>
          <FormTextArea
            v-model="formData.description"
            label=""
            placeholder="Describe el criterio para que un lead llegue a esta etapa…"
            :readonly="readonly"
            :rows="5"
            size="md"
          />
        </div>
      </div>
    </div>
  </div>
</template>
