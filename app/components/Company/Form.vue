<script lang="ts">
import type { CompanySize } from '~/types/database.types'

export interface CompanyFormData {
  name: string
  display_name: string
  legal_name: string
  logo_url: string
  primary_color: string
  email: string
  phone: string
  website: string
  street: string
  street2: string
  city: string
  state: string
  zip: string
  country_code: string
  vat: string
  fiscal_regime: string
  legal_representative: string
  industry: string
  company_size: CompanySize
  founded_date: string
  description: string
  lang: string
  tz: string
  currency: string
}

export const createEmptyCompanyForm = (): CompanyFormData => ({
  name: '',
  display_name: '',
  legal_name: '',
  logo_url: '',
  primary_color: '#6366f1',
  email: '',
  phone: '',
  website: '',
  street: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country_code: 'MX',
  vat: '',
  fiscal_regime: '',
  legal_representative: '',
  industry: '',
  company_size: 'micro',
  founded_date: '',
  description: '',
  lang: 'es',
  tz: 'America/Mexico_City',
  currency: 'MXN'
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<CompanyFormData>({ required: true })

const companySizeOptions = [
  { value: 'micro', label: 'Micro (1-10)' },
  { value: 'small', label: 'Pequeña (11-50)' },
  { value: 'medium', label: 'Mediana (51-250)' },
  { value: 'large', label: 'Grande (251-1000)' },
  { value: 'enterprise', label: 'Corporativo (1000+)' }
]

const currencyOptions = [
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'USD', label: 'USD - Dólar Estadounidense' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'COP', label: 'COP - Peso Colombiano' },
  { value: 'ARS', label: 'ARS - Peso Argentino' },
  { value: 'CLP', label: 'CLP - Peso Chileno' },
  { value: 'PEN', label: 'PEN - Sol Peruano' },
  { value: 'BRL', label: 'BRL - Real Brasileño' }
]

const langOptions = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' }
]

const tzOptions = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Monterrey', label: 'Monterrey (GMT-6)' },
  { value: 'America/Cancun', label: 'Cancún (GMT-5)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT-8)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-4)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' }
]
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- INFORMACIÓN GENERAL -->
    <div class="space-y-6">
      <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Información General
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <FormInput
            v-model="formData.name"
            label="Nombre de la Empresa"
            placeholder="Ej: Acme Corp"
            :readonly="readonly"
            required
            size="md"
          />
        </div>

        <FormInput
          v-model="formData.display_name"
          label="Nombre Comercial"
          placeholder="Nombre para mostrar"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.legal_name"
          label="Razón Social"
          placeholder="Razón social completa"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.email"
          type="email"
          label="Email"
          placeholder="contacto@empresa.com"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.phone"
          type="tel"
          label="Teléfono"
          placeholder="+52 55 1234 5678"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.website"
          type="url"
          label="Sitio Web"
          placeholder="https://www.empresa.com"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.industry"
          label="Industria"
          placeholder="Ej: Tecnología, Retail"
          :readonly="readonly"
          size="md"
        />

        <FormSelect
          v-model="formData.company_size"
          label="Tamaño de Empresa"
          :options="companySizeOptions"
          :disabled="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.founded_date"
          type="date"
          label="Fecha de Fundación"
          :readonly="readonly"
          size="md"
        />

        <div class="sm:col-span-2">
          <FormInput
            v-model="formData.description"
            label="Descripción"
            placeholder="Breve descripción de la empresa"
            :readonly="readonly"
            size="md"
          />
        </div>
      </div>

      <!-- Marca -->
      <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
        Identidad Visual
      </h4>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          v-model="formData.logo_url"
          type="url"
          label="URL del Logo"
          placeholder="https://..."
          :readonly="readonly"
          size="md"
        />

        <div class="w-full">
          <label class="block text-base font-medium text-slate-700 mb-2">
            Color Principal
          </label>
          <div class="flex items-center gap-3">
            <input
              v-model="formData.primary_color"
              type="color"
              :disabled="readonly"
              class="w-12 h-12 rounded-xl border border-slate-300 cursor-pointer disabled:cursor-default disabled:opacity-50"
            />
            <FormInput
              v-model="formData.primary_color"
              placeholder="#6366f1"
              :readonly="readonly"
              size="md"
              maxlength="7"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- INFORMACIÓN FISCAL Y DIRECCIÓN -->
    <div class="space-y-6">
      <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Información Fiscal
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          v-model="formData.vat"
          label="RFC / NIT / RUT"
          placeholder="Identificación fiscal"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.fiscal_regime"
          label="Régimen Fiscal"
          placeholder="Ej: Régimen General"
          :readonly="readonly"
          size="md"
        />

        <div class="sm:col-span-2">
          <FormInput
            v-model="formData.legal_representative"
            label="Representante Legal"
            placeholder="Nombre completo del representante"
            :readonly="readonly"
            size="md"
          />
        </div>
      </div>

      <!-- Dirección -->
      <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
        Dirección
      </h4>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <FormInput
            v-model="formData.street"
            label="Calle"
            placeholder="Av. Principal 123"
            :readonly="readonly"
            size="md"
          />
        </div>

        <div class="sm:col-span-2">
          <FormInput
            v-model="formData.street2"
            label="Calle 2"
            placeholder="Piso, oficina, interior"
            :readonly="readonly"
            size="md"
          />
        </div>

        <FormInput
          v-model="formData.city"
          label="Ciudad"
          placeholder="Ciudad"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.state"
          label="Estado / Provincia"
          placeholder="Estado"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.zip"
          label="Código Postal"
          placeholder="12345"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.country_code"
          label="Código de País"
          placeholder="MX"
          :readonly="readonly"
          size="md"
          maxlength="2"
        />
      </div>

      <!-- Preferencias -->
      <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
        Preferencias Regionales
      </h4>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormSelect
          v-model="formData.lang"
          label="Idioma"
          :options="langOptions"
          :disabled="readonly"
          size="md"
        />

        <FormSelect
          v-model="formData.currency"
          label="Moneda"
          :options="currencyOptions"
          :disabled="readonly"
          size="md"
        />

        <div class="sm:col-span-2">
          <FormSelect
            v-model="formData.tz"
            label="Zona Horaria"
            :options="tzOptions"
            :disabled="readonly"
            size="md"
          />
        </div>
      </div>
    </div>
  </div>
</template>
