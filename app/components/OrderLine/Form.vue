<script lang="ts">
export interface OrderLineFormData {
  product_id: string
  product_name: string
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_percent: number
  tax_rate: number
}

export const createEmptyOrderLineForm = (taxRate = 16.00): OrderLineFormData => ({
  product_id: '',
  product_name: '',
  description: '',
  quantity: 1,
  unit_price: 0,
  unit_cost: 0,
  discount_percent: 0,
  tax_rate: taxRate
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  currency?: string
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  currency: 'MXN'
})

const formData = defineModel<OrderLineFormData>({ required: true })

const isEditing = computed(() => !props.readonly)

const discountAmount = computed(() => {
  return Math.round(formData.value.quantity * formData.value.unit_price * formData.value.discount_percent / 100 * 100) / 100
})

const subtotal = computed(() => {
  const base = formData.value.quantity * formData.value.unit_price
  return Math.round((base - discountAmount.value) * 100) / 100
})

const taxAmount = computed(() => {
  return Math.round(subtotal.value * formData.value.tax_rate / 100 * 100) / 100
})

const total = computed(() => {
  return Math.round((subtotal.value + taxAmount.value) * 100) / 100
})

const margin = computed(() => {
  return Math.round((subtotal.value - (formData.value.quantity * formData.value.unit_cost)) * 100) / 100
})

const marginPercent = computed(() => {
  if (subtotal.value > 0) {
    return Math.round((margin.value / subtotal.value) * 100 * 100) / 100
  }
  return 0
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: props.currency
  }).format(value)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Producto -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        Producto
      </h4>

      <div class="space-y-4 bg-slate-50 rounded-lg p-4">
        <FormInput
          v-model="formData.product_name"
          label="Nombre del Producto"
          placeholder="Ej: Laptop HP Pavilion 15"
          :readonly="readonly"
          required
          size="md"
        />

        <div class="w-full">
          <label class="block text-base font-medium text-slate-700 mb-2">
            Descripción
          </label>
          <textarea
            v-model="formData.description"
            :readonly="readonly"
            rows="3"
            class="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
            :class="{ 'bg-slate-100 cursor-default': readonly }"
            placeholder="Descripción detallada del producto o servicio..."
          />
        </div>
      </div>
    </div>

    <!-- Cantidades y Precios -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Cantidades y Precios
      </h4>

      <div class="bg-slate-50 rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            v-model="formData.quantity"
            type="number"
            label="Cantidad"
            placeholder="1"
            :readonly="readonly"
            required
            :min="0.001"
            :step="1"
            size="md"
          />

          <FormInput
            v-model="formData.unit_price"
            type="number"
            label="Precio Unitario"
            placeholder="0.00"
            :readonly="readonly"
            required
            :min="0"
            :step="0.01"
            size="md"
          />

          <FormInput
            v-model="formData.unit_cost"
            type="number"
            label="Costo Unitario"
            placeholder="0.00"
            :readonly="readonly"
            :min="0"
            :step="0.01"
            size="md"
          />
        </div>
      </div>
    </div>

    <!-- Descuento e Impuesto -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
        Descuento e Impuesto
      </h4>

      <div class="bg-slate-50 rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            v-model="formData.discount_percent"
            type="number"
            label="Descuento (%)"
            placeholder="0.00"
            :readonly="readonly"
            :min="0"
            :max="100"
            :step="0.01"
            size="md"
          />

          <FormInput
            v-model="formData.tax_rate"
            type="number"
            label="Tasa de Impuesto (%)"
            placeholder="16.00"
            :readonly="readonly"
            :min="0"
            :step="0.01"
            size="md"
          />
        </div>
      </div>
    </div>

    <!-- Resumen Calculado -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Resumen
      </h4>

      <div class="bg-gradient-to-br from-slate-50 to-indigo-50/50 rounded-lg p-4 space-y-3">
        <div v-if="discountAmount > 0" class="flex justify-between text-sm">
          <span class="text-slate-600">Descuento:</span>
          <span class="font-medium text-red-600">-{{ formatCurrency(discountAmount) }}</span>
        </div>

        <div class="flex justify-between text-sm">
          <span class="text-slate-600">Subtotal:</span>
          <span class="font-medium text-slate-800">{{ formatCurrency(subtotal) }}</span>
        </div>

        <div class="flex justify-between text-sm">
          <span class="text-slate-600">Impuesto ({{ formData.tax_rate }}%):</span>
          <span class="font-medium text-slate-800">{{ formatCurrency(taxAmount) }}</span>
        </div>

        <div class="border-t border-slate-200 pt-2 flex justify-between">
          <span class="text-base font-semibold text-slate-800">Total:</span>
          <span class="text-base font-bold text-indigo-600">{{ formatCurrency(total) }}</span>
        </div>

        <div class="border-t border-slate-200 pt-2 grid grid-cols-2 gap-3">
          <div class="bg-white rounded-lg p-3 text-center">
            <p class="text-sm font-bold" :class="margin >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ formatCurrency(margin) }}
            </p>
            <p class="text-xs text-slate-500">Margen</p>
          </div>
          <div class="bg-white rounded-lg p-3 text-center">
            <p class="text-sm font-bold" :class="marginPercent >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ marginPercent.toFixed(2) }}%
            </p>
            <p class="text-xs text-slate-500">% Margen</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
