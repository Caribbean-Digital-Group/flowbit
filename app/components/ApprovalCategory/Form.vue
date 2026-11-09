<script lang="ts">
import type { ApprovalCategoryRow, ApprovalCategoryUpdate, ApprovalFieldDefinition } from '~/types/approval.types'

export interface ApprovalCategoryFormData {
  name: string
  internal_code: string
  description: string
  active: boolean
  color: string
  flow_id: string
  field_schema: ApprovalFieldDefinition[]
  allow_lines: boolean
  require_attachment: boolean
  confidential: boolean
  critical_fields: string[]
  sla_days: string | number
  auto_approve_max_amount: string | number
}

export const createEmptyApprovalCategoryForm = (): ApprovalCategoryFormData => ({
  name: '',
  internal_code: '',
  description: '',
  active: true,
  color: 'indigo',
  flow_id: '',
  field_schema: [],
  allow_lines: false,
  require_attachment: false,
  confidential: false,
  critical_fields: ['amount', 'currency', 'category_id', 'lines'],
  sla_days: '',
  auto_approve_max_amount: ''
})

export const approvalCategoryToForm = (c: ApprovalCategoryRow): ApprovalCategoryFormData => ({
  name: c.name ?? '',
  internal_code: c.internal_code ?? '',
  description: c.description ?? '',
  active: c.active ?? true,
  color: c.color ?? 'indigo',
  flow_id: c.flow_id ?? '',
  field_schema: (c.field_schema ?? []).map(f => ({ ...f })),
  allow_lines: c.allow_lines,
  require_attachment: c.require_attachment,
  confidential: c.confidential,
  critical_fields: [...(c.critical_fields ?? [])],
  sla_days: c.sla_days ?? '',
  auto_approve_max_amount: c.auto_approve_max_amount ?? ''
})

const toNumberOrNull = (v: string | number): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Campos comunes de alta y edición (el código interno solo se fija al crear). */
export const approvalCategoryFormToPayload = (v: ApprovalCategoryFormData): ApprovalCategoryUpdate => ({
  name: v.name.trim(),
  description: v.description.trim() || null,
  active: v.active,
  color: v.color || null,
  flow_id: v.flow_id || null,
  field_schema: v.field_schema.map(f => ({
    ...f,
    key: f.key.trim(),
    label: f.label.trim(),
    options: f.type === 'select' ? (f.options ?? []).map(o => o.trim()).filter(Boolean) : undefined
  })),
  allow_lines: v.allow_lines,
  require_attachment: v.require_attachment,
  confidential: v.confidential,
  critical_fields: v.critical_fields,
  sla_days: toNumberOrNull(v.sla_days),
  auto_approve_max_amount: toNumberOrNull(v.auto_approve_max_amount)
})
</script>

<script setup lang="ts">
type Option = {
  value: string
  label: string
}

interface Props {
  readonly?: boolean
  codeReadonly?: boolean
  flowOptions?: Option[]
  /** Muestra flujo y reglas (funciones avanzadas de la empresa). */
  advanced?: boolean
  /** Categoría reservada para otro módulo (p. ej. permisos de RR. HH.). */
  sourceKind?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  codeReadonly: false,
  flowOptions: () => [],
  advanced: false,
  sourceKind: null
})

const formData = defineModel<ApprovalCategoryFormData>({ required: true })

const colorOptions = [
  { value: 'indigo', label: 'Índigo' }, { value: 'violet', label: 'Violeta' }, { value: 'fuchsia', label: 'Fucsia' },
  { value: 'emerald', label: 'Esmeralda' }, { value: 'amber', label: 'Ámbar' }, { value: 'sky', label: 'Cielo' },
  { value: 'rose', label: 'Rosa' }, { value: 'slate', label: 'Gris' }
]

const criticalOptions = computed(() => [
  { value: 'amount', label: 'Monto' },
  { value: 'currency', label: 'Moneda' },
  { value: 'category_id', label: 'Categoría' },
  { value: 'lines', label: 'Partidas' },
  { value: 'title', label: 'Asunto' },
  { value: 'due_date', label: 'Fecha requerida' },
  { value: 'priority', label: 'Prioridad' },
  ...formData.value.field_schema.filter(f => f.key).map(f => ({ value: `field.${f.key}`, label: f.label || f.key }))
])

const toggleCritical = (value: string, on: boolean): void => {
  const set = new Set(formData.value.critical_fields)
  if (on) set.add(value)
  else set.delete(value)
  formData.value.critical_fields = [...set]
}

const section = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40'
const heading = 'mb-4 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'
</script>

<template>
  <div class="space-y-6">
    <p v-if="sourceKind === 'hr_leave'" class="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
      Categoría reservada para los permisos de Recursos Humanos: sus solicitudes se crean desde RR. HH.
      Puedes asignarle un flujo (por ejemplo, jefe directo y luego RR. HH.). Si no tiene, aprueba el jefe directo y, sin jefe, los owners.
    </p>

    <section :class="section">
      <h3 :class="heading">General</h3>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormInput v-model="formData.name" label="Nombre de la categoría" placeholder="Ej. Viáticos" required :readonly="props.readonly" />
        <FormInput
          v-model="formData.internal_code"
          label="Código interno"
          placeholder="viaticos"
          required
          :readonly="props.readonly || props.codeReadonly"
          :maxlength="64"
        />
        <FormSelect v-model="formData.color" label="Color" :options="colorOptions" :disabled="props.readonly" />
        <label class="flex items-center gap-2 self-end pb-3 text-sm text-slate-700">
          <input v-model="formData.active" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" :disabled="props.readonly">
          Activa (disponible para solicitudes nuevas)
        </label>
        <div class="md:col-span-2">
          <FormTextArea v-model="formData.description" label="Descripción" placeholder="Visible al crear la solicitud" :rows="3" :readonly="props.readonly" />
        </div>
      </div>
    </section>

    <section :class="section">
      <h3 :class="heading">Cómo se aprueba</h3>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormSelect
          v-if="advanced"
          v-model="formData.flow_id"
          label="Flujo de aprobación"
          :options="flowOptions"
          placeholder="Modo simple: el solicitante elige al aprobador"
          clearable
          :disabled="props.readonly"
        />
        <FormInput
          v-model="formData.sla_days"
          label="Plazo por nivel (días hábiles)"
          type="number"
          min="1"
          placeholder="El de la empresa"
          :readonly="props.readonly"
        />
        <FormInput
          v-if="advanced"
          v-model="formData.auto_approve_max_amount"
          label="Aprobar automáticamente hasta (MXN)"
          type="number"
          min="0"
          step="0.01"
          placeholder="Nunca"
          hint="Las solicitudes con monto menor o igual se aprueban al enviarse"
          :readonly="props.readonly"
        />
      </div>
      <p v-if="!advanced" class="mt-3 text-xs text-slate-500">
        Activa las funciones avanzadas en Configuración de aprobaciones para usar flujos multinivel y aprobación automática.
      </p>
    </section>

    <section v-if="sourceKind !== 'hr_leave'" :class="section">
      <h3 :class="heading">Formulario de la solicitud</h3>
      <ApprovalCategoryFieldSchemaEditor v-model="formData.field_schema" :readonly="props.readonly" />
      <div class="mt-5 space-y-2">
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="formData.allow_lines" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" :disabled="props.readonly">
          Permitir partidas (concepto, cantidad y precio; el monto es la suma)
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="formData.require_attachment" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" :disabled="props.readonly">
          Exigir al menos un archivo adjunto para enviar
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="formData.confidential" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" :disabled="props.readonly">
          Confidencial (solo la ven el solicitante, los aprobadores involucrados y owner/admin)
        </label>
      </div>
    </section>

    <section v-if="sourceKind !== 'hr_leave'" :class="section">
      <h3 :class="heading">Cambios críticos</h3>
      <p class="mb-3 text-sm text-slate-500">Si se edita uno de estos datos con la solicitud en revisión, las aprobaciones se anulan y el flujo empieza de nuevo.</p>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="opt in criticalOptions"
          :key="opt.value"
          class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
          :class="formData.critical_fields.includes(opt.value) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'"
        >
          <input
            type="checkbox"
            class="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            :checked="formData.critical_fields.includes(opt.value)"
            :disabled="props.readonly"
            @change="toggleCritical(opt.value, ($event.target as HTMLInputElement).checked)"
          >
          {{ opt.label }}
        </label>
      </div>
    </section>
  </div>
</template>
