<script lang="ts">
import type { Database } from '~/types/database.types'

export type ProjectStatus = Database['public']['Enums']['project_status']
export type ProjectPriority = Database['public']['Enums']['project_priority']

export interface ProjectFormData {
  code: string
  name: string
  description: string
  project_type_id: string | null
  responsible_partner_id: string | null
  responsible_name: string
  status: ProjectStatus
  priority: ProjectPriority
  start_date: string
  end_date_estimated: string
  end_date_actual: string
  budget_estimated: number
  budget_actual: number
  progress: number
  color: string
  notes: string
}

export const createEmptyProjectForm = (): ProjectFormData => ({
  code: '',
  name: '',
  description: '',
  project_type_id: null,
  responsible_partner_id: null,
  responsible_name: '',
  status: 'pending',
  priority: 'medium',
  start_date: new Date().toISOString().split('T')[0] || '',
  end_date_estimated: '',
  end_date_actual: '',
  budget_estimated: 0,
  budget_actual: 0,
  progress: 0,
  color: '#6366F1',
  notes: ''
})

export const projectStatusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'pending', label: 'Por iniciar' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'paused', label: 'En pausa' },
  { value: 'completed', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado' }
]

export const projectPriorityOptions: Array<{ value: ProjectPriority; label: string }> = [
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
  typeOptions?: { value: string; label: string }[]
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  partnerOptions: () => [],
  typeOptions: () => []
})

const formData = defineModel<ProjectFormData>({ required: true })

const isEditing = computed(() => !props.readonly)

const responsibleSelectModel = computed({
  get: () => formData.value.responsible_partner_id ?? '',
  set: (v: string) => {
    formData.value.responsible_partner_id = v ? v : null
    const opt = props.partnerOptions.find(o => o.value === v)
    if (opt) formData.value.responsible_name = opt.label
  }
})

const typeSelectModel = computed({
  get: () => formData.value.project_type_id ?? '',
  set: (v: string) => {
    formData.value.project_type_id = v ? v : null
  }
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value || 0)
}
</script>

<template>
  <div class="space-y-0">
    <!-- HEADER: información principal del proyecto -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
      <div class="lg:col-span-2">
        <FormInput
          v-model="formData.name"
          label="Nombre del Proyecto"
          placeholder="Ej. Lanzamiento de campaña Q3"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-if="partnerOptions.length > 0 && isEditing"
          v-model="responsibleSelectModel"
          label="Responsable"
          :options="partnerOptions"
          :readonly="readonly"
          placeholder="Selecciona un responsable…"
          required
          size="md"
        />
        <FormInput
          v-else
          v-model="formData.responsible_name"
          label="Responsable"
          placeholder="Sin responsable asignado"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="typeSelectModel"
          label="Tipo de Proyecto"
          :options="typeOptions"
          :readonly="readonly"
          placeholder="Selecciona un tipo…"
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.code"
          label="Código"
          placeholder="Se genera automáticamente"
          readonly
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="formData.status"
          label="Estatus"
          :options="projectStatusOptions"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="formData.priority"
          label="Prioridad"
          :options="projectPriorityOptions"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.color"
          label="Color"
          placeholder="#6366F1"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <!-- FECHAS Y PRESUPUESTO -->
    <div class="border-t border-slate-200 pt-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Fechas y Plazos
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
            <FormInput
              v-model="formData.start_date"
              type="date"
              label="Fecha de Inicio"
              :readonly="readonly"
              size="md"
            />

            <FormInput
              v-model="formData.end_date_estimated"
              type="date"
              label="Fecha Estimada de Fin"
              :readonly="readonly"
              size="md"
            />

            <div class="sm:col-span-2">
              <FormInput
                v-model="formData.end_date_actual"
                type="date"
                label="Fecha Real de Fin"
                hint="Se llena automáticamente al marcar el proyecto como finalizado"
                :readonly="readonly"
                size="md"
              />
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Presupuesto y Avance
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
            <FormInput
              v-model="formData.budget_estimated"
              type="number"
              label="Presupuesto Estimado"
              placeholder="0.00"
              :readonly="readonly"
              size="md"
            />

            <FormInput
              v-model="formData.budget_actual"
              type="number"
              label="Costo Real"
              placeholder="0.00"
              hint="Se acumula desde el costo real de las tareas"
              readonly
              size="md"
            />

            <div class="sm:col-span-2">
              <label class="block text-base font-medium text-slate-700 mb-2">
                Avance del proyecto: {{ formData.progress }}%
              </label>
              <div class="relative h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 transition-all duration-500"
                  :style="{ width: `${Math.min(Math.max(formData.progress ?? 0, 0), 100)}%` }"
                />
              </div>
              <p class="mt-2 text-xs text-slate-500">
                Calculado automáticamente del avance promedio de las tareas activas no canceladas.
              </p>
            </div>

            <div class="sm:col-span-2 grid grid-cols-2 gap-3">
              <div class="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <p class="text-lg font-bold text-indigo-600">{{ formatCurrency(formData.budget_estimated) }}</p>
                <p class="text-xs text-slate-500">Estimado</p>
              </div>
              <div class="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <p class="text-lg font-bold" :class="(formData.budget_actual ?? 0) > (formData.budget_estimated ?? 0) ? 'text-red-600' : 'text-emerald-600'">
                  {{ formatCurrency(formData.budget_actual) }}
                </p>
                <p class="text-xs text-slate-500">Real</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- DESCRIPCIÓN Y NOTAS -->
    <div class="border-t border-slate-200 pt-6 mt-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descripción
          </h4>
          <FormTextArea
            v-model="formData.description"
            label=""
            placeholder="Describe el objetivo, alcance y entregables del proyecto…"
            :readonly="readonly"
            :rows="6"
            size="md"
          />
        </div>

        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Notas Internas
          </h4>
          <FormTextArea
            v-model="formData.notes"
            label=""
            placeholder="Notas internas, riesgos identificados, supuestos…"
            :readonly="readonly"
            :rows="6"
            size="md"
          />
        </div>
      </div>
    </div>
  </div>
</template>
