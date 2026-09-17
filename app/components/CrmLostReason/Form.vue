<script lang="ts">
export interface CrmLostReasonFormData {
  name: string
  sequence: number
  description: string
}

export const createEmptyCrmLostReasonForm = (): CrmLostReasonFormData => ({
  name: '',
  sequence: 10,
  description: ''
})

export const crmLostReasonSuggestions = [
  'Precio fuera de presupuesto',
  'Eligió a la competencia',
  'Sin respuesta',
  'Necesidad no calificada',
  'Proyecto pospuesto'
]
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<CrmLostReasonFormData>({ required: true })

const applySuggestion = (value: string) => {
  formData.value.name = value
}
</script>

<template>
  <div class="space-y-0">
    <div class="grid grid-cols-1 gap-6 pb-6 md:grid-cols-2 lg:grid-cols-4">
      <div class="lg:col-span-3">
        <FormInput
          v-model="formData.name"
          label="Motivo de pérdida"
          placeholder="Ej. Eligió a la competencia"
          :readonly="readonly"
          required
          size="md"
        />
        <div v-if="!readonly && !formData.name" class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500">Sugerencias:</span>
          <button
            v-for="suggestion in crmLostReasonSuggestions"
            :key="suggestion"
            type="button"
            class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            @click="applySuggestion(suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <div>
        <FormInput
          v-model="formData.sequence"
          type="number"
          label="Orden en la lista"
          placeholder="10"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <div class="border-t border-slate-200 pt-6">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <h4 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descripción / cuándo usarlo
          </h4>
          <FormTextArea
            v-model="formData.description"
            label=""
            placeholder="Explica al equipo en qué casos debe elegirse este motivo…"
            :readonly="readonly"
            :rows="4"
            size="md"
          />
        </div>

        <div class="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-slate-600">
          <p class="flex items-center gap-2 font-semibold text-indigo-700">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ¿Para qué sirve?
          </p>
          <p class="mt-2">
            Al mover un lead a una etapa de cierre perdido, el equipo elige uno de estos motivos.
            Así puedes detectar patrones (precio, competencia, falta de seguimiento) y ajustar tu
            estrategia comercial.
          </p>
          <p class="mt-2">
            Usa nombres cortos y excluyentes; entre 4 y 8 motivos suele ser suficiente.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
