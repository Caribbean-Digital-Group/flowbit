<script lang="ts">
import type { Database } from '~/types/database.types'

export type CrmLeadPriority = Database['public']['Enums']['crm_lead_priority']
export type CrmLeadOrigin = Database['public']['Enums']['crm_lead_origin']

export interface CrmLeadFormData {
  name: string
  stage_id: string
  partner_id: string | null
  contact_name: string
  contact_email: string
  contact_phone: string
  contact_company: string
  origin: CrmLeadOrigin
  responsible_partner_id: string | null
  expected_close_date: string
  amount: number
  currency: string
  probability: number
  description: string
  priority: CrmLeadPriority
  tags: string
}

export const createEmptyCrmLeadForm = (): CrmLeadFormData => ({
  name: '',
  stage_id: '',
  partner_id: null,
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  contact_company: '',
  origin: 'other',
  responsible_partner_id: null,
  expected_close_date: '',
  amount: 0,
  currency: 'MXN',
  probability: 0,
  description: '',
  priority: 'medium',
  tags: ''
})

export const crmLeadPriorityOptions: Array<{ value: CrmLeadPriority; label: string }> = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' }
]

export const crmLeadOriginOptions: Array<{ value: CrmLeadOrigin; label: string }> = [
  { value: 'web', label: 'Sitio web' },
  { value: 'referral', label: 'Referido' },
  { value: 'campaign', label: 'Campaña' },
  { value: 'call', label: 'Llamada entrante' },
  { value: 'email', label: 'Correo electrónico' },
  { value: 'event', label: 'Evento' },
  { value: 'other', label: 'Otro' }
]

export const currencyOptions = [
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'EUR', label: 'EUR — Euro' }
]
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  stageOptions?: { value: string; label: string }[]
  partnerOptions?: { value: string; label: string }[]
  responsibleOptions?: { value: string; label: string }[]
  isCreatingPartner?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  stageOptions: () => [],
  partnerOptions: () => [],
  responsibleOptions: () => [],
  isCreatingPartner: false
})

const emit = defineEmits<{ 'create-partner': [] }>()

const formData = defineModel<CrmLeadFormData>({ required: true })

const stageSelectModel = computed({
  get: () => formData.value.stage_id ?? '',
  set: (v: string) => { formData.value.stage_id = v }
})

const partnerSelectModel = computed({
  get: () => formData.value.partner_id ?? '',
  set: (v: string) => { formData.value.partner_id = v || null }
})

const responsibleSelectModel = computed({
  get: () => formData.value.responsible_partner_id ?? '',
  set: (v: string) => { formData.value.responsible_partner_id = v || null }
})

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: formData.value.currency || 'MXN',
    maximumFractionDigits: 2
  }).format(value || 0)
</script>

<template>
  <div class="space-y-0">
    <!-- DATOS PRINCIPALES -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
      <div class="lg:col-span-2">
        <FormInput
          v-model="formData.name"
          label="Título del lead / oportunidad"
          placeholder="Ej. Implementación de ERP para Grupo XYZ"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="stageSelectModel"
          label="Etapa del pipeline"
          :options="stageOptions"
          :readonly="readonly"
          placeholder="Selecciona una etapa…"
          required
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="formData.priority"
          label="Prioridad"
          :options="crmLeadPriorityOptions"
          :readonly="readonly"
          required
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-model="formData.origin"
          label="Origen del lead"
          :options="crmLeadOriginOptions"
          :readonly="readonly"
          size="md"
        />
      </div>

      <div>
        <FormSelect
          v-if="responsibleOptions.length > 0 || !readonly"
          v-model="responsibleSelectModel"
          label="Responsable de seguimiento"
          :options="responsibleOptions"
          :readonly="readonly"
          placeholder="Selecciona un responsable…"
          size="md"
        />
      </div>

      <div>
        <FormInput
          v-model="formData.expected_close_date"
          type="date"
          label="Fecha de cierre esperada"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <!-- CONTACTO -->
    <div class="border-t border-slate-200 pt-6">
      <div class="space-y-4">
        <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Contacto / Prospecto
        </h4>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4">
          <div class="lg:col-span-2">
            <FormSelect
              v-model="partnerSelectModel"
              label="Partner vinculado (si existe)"
              :options="partnerOptions"
              :readonly="readonly"
              placeholder="Buscar partner existente…"
              size="md"
            />
            <div v-if="!formData.partner_id && !readonly" class="mt-2">
              <button
                type="button"
                :disabled="isCreatingPartner"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                @click="emit('create-partner')"
              >
                <svg v-if="!isCreatingPartner" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ isCreatingPartner ? 'Creando contacto…' : 'Crear nuevo contacto' }}
              </button>
            </div>
          </div>

          <div>
            <FormInput
              v-model="formData.contact_name"
              label="Nombre del contacto"
              placeholder="Juan Pérez"
              :readonly="readonly"
              size="md"
            />
          </div>

          <div>
            <FormInput
              v-model="formData.contact_company"
              label="Empresa / organización"
              placeholder="Grupo XYZ S.A."
              :readonly="readonly"
              size="md"
            />
          </div>

          <div>
            <FormInput
              v-model="formData.contact_email"
              label="Correo electrónico"
              placeholder="juan@empresa.com"
              :readonly="readonly"
              size="md"
            />
          </div>

          <div>
            <FormInput
              v-model="formData.contact_phone"
              label="Teléfono"
              placeholder="+52 55 1234 5678"
              :readonly="readonly"
              size="md"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- VALOR DE LA OPORTUNIDAD -->
    <div class="border-t border-slate-200 pt-6 mt-6">
      <div class="space-y-4">
        <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Valor de la oportunidad
        </h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4">
          <div>
            <FormInput
              v-model="formData.amount"
              type="number"
              label="Importe estimado"
              placeholder="0.00"
              :readonly="readonly"
              size="md"
            />
          </div>

          <div>
            <FormSelect
              v-model="formData.currency"
              label="Moneda"
              :options="currencyOptions"
              :readonly="readonly"
              size="md"
            />
          </div>

          <div>
            <label class="block text-base font-medium text-slate-700 mb-2">
              Probabilidad de cierre: {{ formData.probability }}%
            </label>
            <div class="pt-1">
              <input
                v-model="formData.probability"
                type="range"
                min="0"
                max="100"
                step="5"
                class="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                :disabled="readonly"
              >
              <div class="flex justify-between text-xs text-slate-400 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div v-if="!readonly" class="flex items-end pb-1">
            <div class="w-full rounded-xl border border-indigo-100 bg-white p-3 text-center">
              <p class="text-lg font-bold text-indigo-600">
                {{ formatCurrency(formData.amount) }}
              </p>
              <p class="text-xs text-slate-500">Valor estimado</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ETIQUETAS -->
    <div class="border-t border-slate-200 pt-6 mt-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Etiquetas
          </h4>
          <FormInput
            v-model="formData.tags"
            label=""
            placeholder="Ej. enterprise, software, q3 (separadas por comas)"
            :readonly="readonly"
            size="md"
          />
          <p class="text-xs text-slate-500">
            Separa las etiquetas con comas para clasificar libremente el lead.
          </p>
        </div>

        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descripción / notas del lead
          </h4>
          <FormTextArea
            v-model="formData.description"
            label=""
            placeholder="Contexto, necesidades detectadas, próximos pasos…"
            :readonly="readonly"
            :rows="5"
            size="md"
          />
        </div>
      </div>
    </div>
  </div>
</template>
