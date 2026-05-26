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
  /** Fechas de resolución (vista detalle); la creación se muestra en el pie del CardSheet */
  previewApprovedAt?: string | null
  previewRejectedAt?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  readonlyStatus: null,
  categoryOptions: () => [],
  managerOptions: () => [],
  requestNumberDisplay: null,
  previewApprovedAt: null,
  previewRejectedAt: null
})

const formData = defineModel<ApprovalRequestFormData>({ required: true })

const statusLabel = computed(() => {
  if (!props.readonlyStatus) return null
  return approvalRequestStatusLabels[props.readonlyStatus] ?? props.readonlyStatus
})

const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d)
}

const sectionClass =
  'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-lg shadow-slate-200/40'
const headingClass =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4 border-b border-slate-100 pb-2'
</script>

<template>
  <div class="space-y-6">
    <!-- Identificación + estado (principalmente detalle con folio) -->
    <div
      v-if="requestNumberDisplay || (readonlyStatus && statusLabel)"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div
        v-if="requestNumberDisplay"
        class="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-5 py-4 shadow-sm"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Folio interno
        </p>
        <p class="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
          #{{ requestNumberDisplay }}
        </p>
      </div>
      <div
        v-if="readonlyStatus && statusLabel"
        class="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Estado
        </p>
        <p class="mt-1 text-lg font-semibold text-slate-800">
          {{ statusLabel }}
        </p>
      </div>
    </div>

    <!-- Resolución (evita repetir fecha de alta; esa va en el pie del CardSheet) -->
    <section
      v-if="previewApprovedAt || previewRejectedAt"
      :class="sectionClass"
    >
      <h3 :class="headingClass">
        Resolución
      </h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div class="rounded-xl bg-emerald-50/60 px-3 py-2.5 border border-emerald-100/80">
          <p class="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
            Fecha de aprobación
          </p>
          <p class="mt-0.5 font-medium text-emerald-900">
            {{ fmtDateTime(previewApprovedAt) }}
          </p>
        </div>
        <div class="rounded-xl bg-rose-50/60 px-3 py-2.5 border border-rose-100/80">
          <p class="text-[11px] font-medium uppercase tracking-wide text-rose-700">
            Fecha de rechazo
          </p>
          <p class="mt-0.5 font-medium text-rose-900">
            {{ fmtDateTime(previewRejectedAt) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Asunto -->
    <section :class="sectionClass">
      <h3 :class="headingClass">
        Información general
      </h3>
      <FormInput
        v-model="formData.title"
        label="Asunto / título"
        placeholder="Describe brevemente la solicitud"
        required
        :readonly="readonly"
      />
    </section>

    <!-- Categoría + fecha en fila en desktop -->
    <section :class="sectionClass">
      <h3 :class="headingClass">
        Clasificación y fechas
      </h3>
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
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
      </div>
    </section>

    <!-- Aprobador -->
    <section :class="sectionClass">
      <h3 :class="headingClass">
        Asignación
      </h3>
      <FormSelect
        v-model="formData.assigned_approval_manager_id"
        label="Aprobador asignado"
        placeholder="Opcional en borrador; obligatorio al publicar"
        :options="managerOptions"
        :disabled="readonly"
        searchable
      />
      <p class="mt-2 text-xs text-slate-500">
        Solo aparecen gerentes activos autorizados para la categoría elegida.
      </p>
    </section>

    <!-- Monto + referencia -->
    <section :class="sectionClass">
      <h3 :class="headingClass">
        Importe y referencia
      </h3>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-end">
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
      <div class="mt-5">
        <FormInput
          v-model="formData.reference"
          label="Referencia externa"
          placeholder="Contrato, ticket, proyecto…"
          :readonly="readonly"
        />
      </div>
    </section>

    <!-- Descripción amplia -->
    <section :class="sectionClass">
      <h3 :class="headingClass">
        Descripción del trámite
      </h3>
      <FormTextArea
        v-model="formData.description"
        label="Detalle para el aprobador"
        placeholder="Contexto, alcance y documentación relevante para la decisión"
        :rows="6"
        :readonly="readonly"
      />
    </section>
  </div>
</template>
