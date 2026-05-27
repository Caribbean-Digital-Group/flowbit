<script lang="ts">
export interface CrmStageFormData {
  name: string
  sequence: number
  description: string
  is_won: boolean
  is_lost: boolean
}

export const createEmptyCrmStageForm = (): CrmStageFormData => ({
  name: '',
  sequence: 10,
  description: '',
  is_won: false,
  is_lost: false
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<CrmStageFormData>({ required: true })

const handleIsWonChange = (checked: boolean) => {
  formData.value.is_won = checked
  if (checked) formData.value.is_lost = false
}

const handleIsLostChange = (checked: boolean) => {
  formData.value.is_lost = checked
  if (checked) formData.value.is_won = false
}
</script>

<template>
  <div class="space-y-0">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
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
    </div>

    <div class="border-t border-slate-200 pt-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tipo de cierre
          </h4>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <label
              class="flex items-start gap-3 cursor-pointer select-none"
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
              class="flex items-start gap-3 cursor-pointer select-none"
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
                  Al llegar a esta etapa el lead se marca como Cancelado y se registra la fecha de cierre real.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
