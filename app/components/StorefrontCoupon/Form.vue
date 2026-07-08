<script lang="ts">
export interface StorefrontCouponFormData {
  code: string
  description: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_purchase: number
  usage_limit: number | undefined
  starts_at: string
  expires_at: string
  active: boolean
}

export const createEmptyStorefrontCouponForm = (): StorefrontCouponFormData => ({
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  min_purchase: 0,
  usage_limit: undefined,
  starts_at: '',
  expires_at: '',
  active: true
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), { readonly: false })

const formData = defineModel<StorefrontCouponFormData>({ required: true })

const discountTypeOptions = [
  { value: 'percent', label: 'Porcentaje (%)' },
  { value: 'fixed', label: 'Monto fijo' }
]
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.code"
        label="Código"
        placeholder="Ej: BIENVENIDA10"
        hint="Se guarda en mayúsculas; es el código que escribe el cliente."
        :readonly="readonly"
        required
        size="md"
      />
      <FormSelect
        v-model="formData.discount_type"
        label="Tipo de descuento"
        :options="discountTypeOptions"
        :disabled="readonly"
        size="md"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model.number="formData.discount_value"
        :label="formData.discount_type === 'percent' ? 'Porcentaje de descuento' : 'Monto de descuento'"
        type="number"
        :min="0.01"
        :max="formData.discount_type === 'percent' ? 100 : undefined"
        :step="formData.discount_type === 'percent' ? 1 : 0.01"
        :readonly="readonly"
        required
        size="md"
      />
      <FormInput
        v-model.number="formData.min_purchase"
        label="Compra mínima (subtotal sin impuestos)"
        type="number"
        :min="0"
        :step="0.01"
        :readonly="readonly"
        size="md"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <FormInput
        v-model.number="formData.usage_limit"
        label="Límite de usos"
        type="number"
        :min="1"
        placeholder="Sin límite"
        hint="Vacío = ilimitado"
        :readonly="readonly"
        size="md"
      />
      <FormInput
        v-model="formData.starts_at"
        label="Vigente desde"
        type="date"
        :readonly="readonly"
        size="md"
      />
      <FormInput
        v-model="formData.expires_at"
        label="Vigente hasta"
        type="date"
        :readonly="readonly"
        size="md"
      />
    </div>

    <FormTextArea
      v-model="formData.description"
      label="Descripción interna"
      placeholder="Ej: Campaña de bienvenida para nuevos clientes..."
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
      <label class="text-sm text-slate-700 cursor-pointer select-none">Cupón activo</label>
    </div>
  </div>
</template>
