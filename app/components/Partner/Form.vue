<script lang="ts">
export interface PartnerFormData {
  name: string
  display_name: string
  email: string
  phone: string
  mobile: string
  website: string
  street: string
  street2: string
  city: string
  state: string
  zip: string
  country_code: string
  vat: string
  function: string
  credit_limit: number
  comment: string
}

export const createEmptyPartnerForm = (): PartnerFormData => ({
  name: '',
  display_name: '',
  email: '',
  phone: '',
  mobile: '',
  website: '',
  street: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country_code: '',
  vat: '',
  function: '',
  credit_limit: 0,
  comment: ''
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<PartnerFormData>({ required: true })
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- INFORMACIÓN BÁSICA -->
    <div class="space-y-6">
      <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Información Básica
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <FormInput
            v-model="formData.name"
            label="Nombre"
            placeholder="Nombre del partner"
            :readonly="readonly"
            required
            size="md"
          />
        </div>

        <div class="sm:col-span-2">
          <FormInput
            v-model="formData.display_name"
            label="Nombre para mostrar"
            placeholder="Nombre comercial o alias"
            :readonly="readonly"
            size="md"
          />
        </div>

        <FormInput
          v-model="formData.email"
          type="email"
          label="Email"
          placeholder="correo@ejemplo.com"
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
          v-model="formData.mobile"
          type="tel"
          label="Móvil"
          placeholder="+52 55 8765 4321"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.website"
          type="url"
          label="Sitio Web"
          placeholder="https://www.ejemplo.com"
          :readonly="readonly"
          size="md"
        />

        <div class="sm:col-span-2">
          <FormTextArea
            v-model="formData.comment"
            label="Comentarios"
            placeholder="Notas adicionales sobre el partner"
            :readonly="readonly"
            :rows="8"
            size="md"
          />
        </div>
      </div>
    </div>

    <!-- INFORMACIÓN ADICIONAL -->
    <div class="space-y-6">
      <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Información Adicional
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
          v-model="formData.function"
          label="Cargo / Función"
          placeholder="Ej: Proveedor, Cliente"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.credit_limit"
          type="number"
          label="Límite de Crédito"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />


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
          label="País"
          placeholder="MX"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>
  </div>
</template>
