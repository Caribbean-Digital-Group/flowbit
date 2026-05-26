<script lang="ts">
import type { Database } from '~/types/database.types'

export type ApprovalRequestStatus = Database['public']['Enums']['approval_request_status']

export interface ApprovalRequestFormData {
  title: string
  category_id: string
  request_date: string
  description: string
  /** `FormInput` tipo number puede emitir número; el guardado siempre normaliza a string aquí cuando hace falta. */
  amount: string | number
  currency: string
  reference: string
  assigned_approval_manager_id: string
}

export const createEmptyApprovalRequestForm = (): ApprovalRequestFormData => ({
  title: '',
  category_id: '',
  request_date: new Date().toISOString().split('T')[0] || '',
  description: '',
  amount: '',
  currency: 'MXN',
  reference: '',
  assigned_approval_manager_id: ''
})

/** Convierte el valor del campo importe (texto o número desde FormInput) a string para parseo. */
export const approvalRequestAmountToTrimmedString = (
  raw: string | number | null | undefined
): string => {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'number') {
    return Number.isNaN(raw) ? '' : String(raw)
  }
  return String(raw).trim()
}

export const approvalRequestCurrencyOptions = [
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'CAD', label: 'CAD — Dólar canadiense' }
]

export const approvalRequestStatusLabels: Record<ApprovalRequestStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado'
}
</script>

<script setup lang="ts">
interface CatOption {
  value: string
  label: string
}

interface ManagerOption {
  value: string
  label: string
}

interface Props {
  readonly?: boolean
  readonlyStatus?: ApprovalRequestStatus | null
  categoryOptions: CatOption[]
  managerOptions: ManagerOption[]
  requestNumberDisplay?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  readonlyStatus: null,
  categoryOptions: () => [],
  managerOptions: () => [],
  requestNumberDisplay: null
})

const formData = defineModel<ApprovalRequestFormData>({ required: true })

const statusLabel = computed(() => {
  if (!props.readonlyStatus) return null
  return approvalRequestStatusLabels[props.readonlyStatus] ?? props.readonlyStatus
})
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="requestNumberDisplay"
      class="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 px-4 py-3"
    >
      <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">
        Folio interno
      </p>
      <p class="text-xl font-semibold text-slate-900">
        #{{ requestNumberDisplay }}
      </p>
    </div>

    <div
      v-if="readonlyStatus && statusLabel"
      class="rounded-xl border border-slate-200 bg-white px-4 py-3"
    >
      <p class="text-xs uppercase tracking-wide text-slate-500 mb-1">
        Estado actual
      </p>
      <p class="text-base font-semibold text-slate-800">
        {{ statusLabel }}
      </p>
    </div>

    <FormInput
      v-model="formData.title"
      label="Asunto / título"
      placeholder="Describe brevemente la solicitud"
      required
      :readonly="readonly"
    />

    <FormSelect
      v-model="formData.category_id"
      label="Categoría de aprobación"
      placeholder="Selecciona un tipo"
      :options="categoryOptions"
      :disabled="readonly"
      searchable
      required
    />

    <FormInput
      v-model="formData.request_date"
      label="Fecha de solicitud"
      type="date"
      required
      :readonly="readonly"
    />

    <FormTextArea
      v-model="formData.description"
      label="Descripción detallada"
      placeholder="Contexto necesario para el aprobador"
      :rows="5"
      :readonly="readonly"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormInput
        v-model="formData.amount"
        label="Importe"
        type="number"
        min="0"
        step="0.01"
        placeholder="Opcional"
        :readonly="readonly"
      />

      <FormSelect
        v-model="formData.currency"
        label="Moneda"
        placeholder="Selecciona"
        :options="approvalRequestCurrencyOptions"
        :disabled="readonly"
        required
      />
    </div>

    <FormInput
      v-model="formData.reference"
      label="Referencia"
      placeholder="Número de contrato, ticket, proyecto…"
      :readonly="readonly"
    />

    <FormSelect
      v-model="formData.assigned_approval_manager_id"
      label="Aprobador asignado"
      placeholder="Puedes dejarlo vacío como borrador y asignarlo antes de publicar"
      :options="managerOptions"
      :disabled="readonly"
      searchable
    />
  </div>
</template>
