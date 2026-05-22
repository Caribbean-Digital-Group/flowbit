<script setup lang="ts">
import { createEmptyCompanyForm, type CompanyFormData } from '~/components/Company/Form.vue'
import type { TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

const { getCurrentCompany, updateCompany } = useCompany()

const formData = ref<CompanyFormData>(createEmptyCompanyForm())
const companyId = ref<string | null>(null)
const isEditing = ref(false)
const isLoading = ref(true)
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const mapCompanyToForm = (company: Record<string, unknown>): CompanyFormData => ({
  name: (company.name as string) || '',
  display_name: (company.display_name as string) || '',
  legal_name: (company.legal_name as string) || '',
  logo_url: (company.logo_url as string) || '',
  primary_color: (company.primary_color as string) || '#6366f1',
  email: (company.email as string) || '',
  phone: (company.phone as string) || '',
  website: (company.website as string) || '',
  street: (company.street as string) || '',
  street2: (company.street2 as string) || '',
  city: (company.city as string) || '',
  state: (company.state as string) || '',
  zip: (company.zip as string) || '',
  country_code: (company.country_code as string) || 'MX',
  vat: (company.vat as string) || '',
  fiscal_regime: (company.fiscal_regime as string) || '',
  legal_representative: (company.legal_representative as string) || '',
  industry: (company.industry as string) || '',
  company_size: (company.company_size as CompanyFormData['company_size']) || 'micro',
  founded_date: (company.founded_date as string) || '',
  description: (company.description as string) || '',
  lang: (company.lang as string) || 'es',
  tz: (company.tz as string) || 'America/Mexico_City',
  currency: (company.currency as string) || 'MXN'
})

const originalForm = ref<CompanyFormData>(createEmptyCompanyForm())

const loadCompany = async () => {
  isLoading.value = true
  errorMessage.value = ''

  const company = await getCurrentCompany()
  if (company) {
    companyId.value = company.id
    formData.value = mapCompanyToForm(company)
    originalForm.value = { ...formData.value }
  } else {
    errorMessage.value = 'No se pudo cargar la información de la empresa.'
  }

  isLoading.value = false
}

const handleEdit = () => {
  isEditing.value = true
  successMessage.value = ''
}

const handleCancel = () => {
  isEditing.value = false
  formData.value = { ...originalForm.value }
  errorMessage.value = ''
}

const handleSave = async () => {
  if (!companyId.value) return

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  const updates: TablesUpdate<'company'> = {
    name: formData.value.name,
    display_name: formData.value.display_name || null,
    legal_name: formData.value.legal_name || null,
    logo_url: formData.value.logo_url || null,
    primary_color: formData.value.primary_color,
    email: formData.value.email || null,
    phone: formData.value.phone || null,
    website: formData.value.website || null,
    street: formData.value.street || null,
    street2: formData.value.street2 || null,
    city: formData.value.city || null,
    state: formData.value.state || null,
    zip: formData.value.zip || null,
    country_code: formData.value.country_code,
    vat: formData.value.vat || null,
    fiscal_regime: formData.value.fiscal_regime || null,
    legal_representative: formData.value.legal_representative || null,
    industry: formData.value.industry || null,
    company_size: formData.value.company_size,
    founded_date: formData.value.founded_date || null,
    description: formData.value.description || null,
    lang: formData.value.lang,
    tz: formData.value.tz,
    currency: formData.value.currency
  }

  const result = await updateCompany(companyId.value, updates)

  if (result) {
    originalForm.value = { ...formData.value }
    isEditing.value = false
    successMessage.value = 'Configuración guardada correctamente.'
    setTimeout(() => { successMessage.value = '' }, 4000)
  } else {
    errorMessage.value = 'Error al guardar los cambios. Intenta de nuevo.'
  }

  isSaving.value = false
}

onMounted(() => {
  loadCompany()
})
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Configuración de Empresa</h1>
        <p class="mt-1 text-sm text-slate-500">
          Administra la información general, fiscal y preferencias de tu empresa.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="!isEditing">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 disabled:opacity-50"
            :disabled="isLoading"
            @click="handleEdit"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
            :disabled="isSaving"
            @click="handleCancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 disabled:opacity-50"
            :disabled="isSaving"
            @click="handleSave"
          >
            <svg v-if="isSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            {{ isSaving ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </template>
      </div>
    </div>

    <!-- Mensajes -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="successMessage"
        class="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm"
      >
        <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ successMessage }}
      </div>
    </Transition>

    <div
      v-if="errorMessage"
      class="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
    >
      <svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ errorMessage }}
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-12">
      <div class="flex flex-col items-center justify-center gap-4">
        <svg class="w-10 h-10 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="text-sm text-slate-500">Cargando configuración...</p>
      </div>
    </div>

    <!-- Formulario -->
    <div
      v-else
      class="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-6 sm:p-8"
    >
      <CompanyForm v-model="formData" :readonly="!isEditing" />
    </div>
  </div>
</template>
