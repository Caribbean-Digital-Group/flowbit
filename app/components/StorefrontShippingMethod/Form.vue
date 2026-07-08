<script lang="ts">
export interface StorefrontShippingMethodFormData {
  name: string
  description: string
  price: number
  delivery_estimate: string
  display_order: number
  active: boolean
}

export const createEmptyStorefrontShippingMethodForm = (): StorefrontShippingMethodFormData => ({
  name: '',
  description: '',
  price: 0,
  delivery_estimate: '',
  display_order: 0,
  active: true
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), { readonly: false })

const formData = defineModel<StorefrontShippingMethodFormData>({ required: true })
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.name"
        label="Nombre"
        placeholder="Ej: Envío estándar"
        :readonly="readonly"
        required
        size="md"
      />
      <FormInput
        v-model.number="formData.price"
        label="Costo"
        type="number"
        :min="0"
        :step="0.01"
        hint="0 = envío gratis"
        :readonly="readonly"
        size="md"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.delivery_estimate"
        label="Tiempo estimado"
        placeholder="Ej: 2 a 5 días hábiles"
        :readonly="readonly"
        size="md"
      />
      <FormInput
        v-model.number="formData.display_order"
        label="Orden de aparición"
        type="number"
        :min="0"
        hint="Menor número aparece primero en el checkout"
        :readonly="readonly"
        size="md"
      />
    </div>

    <FormTextArea
      v-model="formData.description"
      label="Descripción"
      placeholder="Ej: Cobertura nacional, con número de guía..."
      :readonly="readonly"
      :rows="2"
    />

    <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <input
        v-model="formData.active"
        type="checkbox"
        :disabled="readonly"
        class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
      />
      <label class="text-sm text-slate-700 cursor-pointer select-none">
        Disponible en el checkout
      </label>
    </div>
  </div>
</template>
