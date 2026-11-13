<script lang="ts">
import type {
  ApprovalCategoryRow,
  ApprovalFieldValues,
  ApprovalPriority,
  ApprovalRequestRow
} from '~/types/approval.types'
import type { ApprovalLineDraft } from '~/composables/useApprovalRequest'
import { APPROVAL_STATUS_LABELS } from '~/utils/approvals'

export type { ApprovalRequestStatus } from '~/types/approval.types'

export interface ApprovalRequestFormData {
  title: string
  category_id: string
  request_date: string
  description: string
  /** `FormInput` tipo number puede emitir número; el guardado siempre normaliza. */
  amount: string | number
  currency: string
  reference: string
  assigned_approval_manager_id: string
  priority: ApprovalPriority
  due_date: string
  field_values: ApprovalFieldValues
  /** Vacío = la persona que captura. Con valor = se solicita en nombre de otra persona. */
  requesting_partner_id: string
  lines: ApprovalLineDraft[]
}

export const createEmptyApprovalRequestForm = (): ApprovalRequestFormData => ({
  title: '',
  category_id: '',
  request_date: new Date().toISOString().split('T')[0] || '',
  description: '',
  amount: '',
  currency: 'MXN',
  reference: '',
  assigned_approval_manager_id: '',
  priority: 'normal',
  due_date: '',
  field_values: {},
  requesting_partner_id: '',
  lines: []
})

export const approvalRequestToForm = (
  r: ApprovalRequestRow,
  lines: ApprovalLineDraft[] = []
): ApprovalRequestFormData => ({
  title: r.title ?? '',
  category_id: r.category_id,
  request_date: (r.request_date ?? '').slice(0, 10),
  description: r.description ?? '',
  amount: r.amount != null ? String(r.amount) : '',
  currency: (r.currency ?? 'MXN').trim(),
  reference: r.reference ?? '',
  assigned_approval_manager_id: r.assigned_approval_manager_id ?? '',
  priority: r.priority ?? 'normal',
  due_date: r.due_date ?? '',
  field_values: { ...(r.field_values ?? {}) },
  requesting_partner_id: r.requesting_partner_id,
  lines
})

/** Convierte el valor del campo importe (texto o número desde FormInput) a string para parseo. */
export const approvalRequestAmountToTrimmedString = (
  raw: string | number | null | undefined
): string => {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'number') return Number.isNaN(raw) ? '' : String(raw)
  return String(raw).trim()
}

export const parseApprovalAmount = (raw: string | number | null | undefined): number | null => {
  const text = approvalRequestAmountToTrimmedString(raw)
  if (text === '') return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export const approvalRequestCurrencyOptions = [
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'CAD', label: 'CAD — Dólar canadiense' }
]

/** Compatibilidad: etiquetas de estado (fuente única en app/utils/approvals.ts). */
export const approvalRequestStatusLabels = APPROVAL_STATUS_LABELS

/** Usa un `ApprovalCategoryRow` para saber si la categoría trabaja con flujo. */
export const categoryUsesFlow = (category: ApprovalCategoryRow | undefined | null): boolean =>
  Boolean(category?.flow_id)
</script>

<script setup lang="ts">
import { APPROVAL_PRIORITY_OPTIONS } from '~/utils/approvals'

type Option = {
  value: string
  label: string
}

interface Props {
  readonly?: boolean
  categories: ApprovalCategoryRow[]
  managerOptions: Option[]
  /** Miembros del equipo para «solicitar en nombre de»; vacío = no se muestra. */
  memberOptions?: Option[]
  lookups?: Record<'partner' | 'employee' | 'product', Option[]>
  /** Bloquea la categoría (por ejemplo, al editar una solicitud enviada). */
  lockCategory?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  memberOptions: () => [],
  lookups: () => ({ partner: [], employee: [], product: [] }),
  lockCategory: false
})

const formData = defineModel<ApprovalRequestFormData>({ required: true })

const category = computed(() => props.categories.find(c => c.id === formData.value.category_id))
const usesFlow = computed(() => categoryUsesFlow(category.value))
const allowLines = computed(() => Boolean(category.value?.allow_lines))
const schema = computed(() => category.value?.field_schema ?? [])

const categoryOptions = computed(() => props.categories.map(c => ({ value: c.id, label: c.name })))

const linesTotal = computed(() =>
  formData.value.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0))

// Con partidas, el monto es su suma (la base lo recalcula igual)
watch(linesTotal, (total) => {
  if (allowLines.value && formData.value.lines.length) formData.value.amount = String(Math.round(total * 100) / 100)
})

const sectionClass = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-lg shadow-slate-200/40'
const headingClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4 border-b border-slate-100 pb-2'
</script>

<template>
  <div class="space-y-6">
    <section :class="sectionClass">
      <h3 :class="headingClass">Información general</h3>
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div class="lg:col-span-2">
          <FormInput
            v-model="formData.title"
            label="Asunto"
            placeholder="Describe brevemente la solicitud"
            required
            :readonly="readonly"
          />
        </div>
        <FormSelect
          v-model="formData.category_id"
          label="Categoría"
          placeholder="Selecciona un tipo"
          :options="categoryOptions"
          :disabled="readonly || lockCategory"
          searchable
          required
        />
        <FormSelect
          v-model="formData.priority"
          label="Prioridad"
          :options="APPROVAL_PRIORITY_OPTIONS"
          :disabled="readonly"
        />
        <FormInput v-model="formData.request_date" label="Fecha de solicitud" type="date" required :readonly="readonly" />
        <FormInput
          v-model="formData.due_date"
          label="Fecha requerida"
          type="date"
          hint="Para cuándo necesitas la respuesta"
          :readonly="readonly"
        />
        <FormSelect
          v-if="memberOptions.length"
          v-model="formData.requesting_partner_id"
          label="Solicitante"
          :options="memberOptions"
          :disabled="readonly"
          searchable
          clearable
          placeholder="Yo"
          hint="Elige a otra persona si capturas en su nombre; quedarás registrado como capturista"
        />
      </div>
      <p v-if="category?.description" class="mt-4 text-sm text-slate-500">{{ category.description }}</p>
    </section>

    <section v-if="schema.length" :class="sectionClass">
      <h3 :class="headingClass">Datos de {{ category?.name }}</h3>
      <ApprovalRequestDynamicFields v-model="formData.field_values" :schema="schema" :readonly="readonly" :lookups="lookups" />
    </section>

    <section v-if="!usesFlow && formData.category_id" :class="sectionClass">
      <h3 :class="headingClass">Aprobador</h3>
      <FormSelect
        v-model="formData.assigned_approval_manager_id"
        label="Aprobador asignado"
        placeholder="Obligatorio al enviar"
        :options="managerOptions"
        :disabled="readonly"
        searchable
      />
      <p class="mt-2 text-xs text-slate-500">
        Solo aparecen aprobadores activos autorizados para esta categoría.
      </p>
    </section>

    <section v-if="allowLines" :class="sectionClass">
      <h3 :class="headingClass">Partidas</h3>
      <ApprovalRequestLinesEditor v-model="formData.lines" :readonly="readonly" :currency="formData.currency" />
    </section>

    <section :class="sectionClass">
      <h3 :class="headingClass">Importe y referencia</h3>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:items-end">
        <FormInput
          v-model="formData.amount"
          label="Importe"
          type="number"
          min="0"
          step="0.01"
          :placeholder="allowLines ? 'Suma de las partidas' : 'Opcional'"
          :readonly="readonly || (allowLines && formData.lines.length > 0)"
        />
        <FormSelect
          v-model="formData.currency"
          label="Moneda"
          :options="approvalRequestCurrencyOptions"
          :disabled="readonly"
          required
        />
        <FormInput
          v-model="formData.reference"
          label="Referencia externa"
          placeholder="Contrato, ticket, proyecto…"
          :readonly="readonly"
        />
      </div>
    </section>

    <section :class="sectionClass">
      <h3 :class="headingClass">Descripción</h3>
      <FormTextArea
        v-model="formData.description"
        label="Detalle para quien aprueba"
        placeholder="Contexto, alcance y documentación relevante para la decisión"
        :rows="5"
        :readonly="readonly"
      />
    </section>
  </div>
</template>
