<script lang="ts">
import type { Database } from '~/types/database.types'

export type CrmActivityType = Database['public']['Enums']['crm_activity_type']

export interface CrmActivityFormData {
  type: CrmActivityType
  title: string
  scheduled_at: string
  responsible_partner_id: string | null
  notes: string
}

export const createEmptyCrmActivityForm = (): CrmActivityFormData => ({
  type: 'task',
  title: '',
  scheduled_at: '',
  responsible_partner_id: null,
  notes: ''
})

export const crmActivityTypeOptions: Array<{ value: CrmActivityType; label: string }> = [
  { value: 'call', label: 'Llamada' },
  { value: 'meeting', label: 'Reunión' },
  { value: 'email', label: 'Correo electrónico' },
  { value: 'demo', label: 'Demo / presentación' },
  { value: 'followup', label: 'Seguimiento' },
  { value: 'task', label: 'Tarea' }
]
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  responsibleOptions?: { value: string; label: string }[]
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  responsibleOptions: () => []
})

const formData = defineModel<CrmActivityFormData>({ required: true })

const responsibleSelectModel = computed({
  get: () => formData.value.responsible_partner_id ?? '',
  set: (v: string) => { formData.value.responsible_partner_id = v || null }
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="md:col-span-2">
      <FormInput
        v-model="formData.title"
        label="Título de la actividad"
        placeholder="Ej. Llamada de seguimiento inicial"
        :readonly="readonly"
        required
        size="md"
      />
    </div>

    <div>
      <FormSelect
        v-model="formData.type"
        label="Tipo de actividad"
        :options="crmActivityTypeOptions"
        :readonly="readonly"
        required
        size="md"
      />
    </div>

    <div>
      <FormInput
        v-model="formData.scheduled_at"
        type="datetime-local"
        label="Fecha y hora programada"
        :readonly="readonly"
        size="md"
      />
    </div>

    <div>
      <FormSelect
        v-if="responsibleOptions.length > 0 || !readonly"
        v-model="responsibleSelectModel"
        label="Responsable de ejecutarla"
        :options="responsibleOptions"
        :readonly="readonly"
        placeholder="Selecciona un responsable…"
        size="md"
      />
    </div>

    <div class="md:col-span-2">
      <FormTextArea
        v-model="formData.notes"
        label="Notas / resultado"
        placeholder="Resultado de la actividad, puntos tratados, próximos pasos…"
        :readonly="readonly"
        :rows="3"
        size="md"
      />
    </div>
  </div>
</template>
