<script lang="ts">
export interface PaymentMethodFormData {
  name: string
  code: string
  description: string
  is_cash: boolean
  active: boolean
}

export const createEmptyPaymentMethodForm = (): PaymentMethodFormData => ({
  name: '',
  code: '',
  description: '',
  is_cash: false,
  active: true
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), { readonly: false })

const formData = defineModel<PaymentMethodFormData>({ required: true })
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.name"
        label="Nombre"
        placeholder="Ej: Transferencia bancaria"
        :readonly="readonly"
        required
        size="md"
      />
      <FormInput
        v-model="formData.code"
        label="Código"
        placeholder="Ej: TRANSFER"
        :readonly="readonly"
        size="md"
      />
    </div>

    <FormTextArea
      v-model="formData.description"
      label="Descripción"
      placeholder="Descripción del método de pago..."
      :readonly="readonly"
      :rows="3"
      size="md"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <input
          v-model="formData.is_cash"
          type="checkbox"
          :disabled="readonly"
          class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
        />
        <label class="text-sm text-slate-700 cursor-pointer select-none">
          Es efectivo (participa en fondo, movimientos y cambio del POS)
        </label>
      </div>
      <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <input
          v-model="formData.active"
          type="checkbox"
          :disabled="readonly"
          class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
        />
        <label class="text-sm text-slate-700 cursor-pointer select-none">Activo</label>
      </div>
    </div>
  </div>
</template>
