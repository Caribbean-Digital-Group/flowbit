<script lang="ts">
export interface PosRegisterFormData {
  name: string
  code: string
  description: string
  warehouse_id: string | null
  default_partner_id: string | null
  max_discount_percent: number
  blind_close: boolean
  difference_tolerance: number
  active: boolean
}

export const createEmptyPosRegisterForm = (): PosRegisterFormData => ({
  name: '',
  code: '',
  description: '',
  warehouse_id: null,
  default_partner_id: null,
  max_discount_percent: 100,
  blind_close: false,
  difference_tolerance: 0,
  active: true
})
</script>

<script setup lang="ts">
interface SelectOption {
  value: string
  label: string
}

interface Props {
  readonly?: boolean
  warehouseOptions?: SelectOption[]
  partnerOptions?: SelectOption[]
}

withDefaults(defineProps<Props>(), {
  readonly: false,
  warehouseOptions: () => [],
  partnerOptions: () => []
})

const formData = defineModel<PosRegisterFormData>({ required: true })
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.name"
        label="Nombre"
        placeholder="Ej: Caja mostrador 1"
        :readonly="readonly"
        required
        size="md"
      />
      <FormInput
        v-model="formData.code"
        label="Código"
        placeholder="Ej: CAJA-01"
        :readonly="readonly"
        required
        size="md"
      />
    </div>

    <FormTextArea
      v-model="formData.description"
      label="Descripción"
      placeholder="Ubicación o detalles de la terminal..."
      :readonly="readonly"
      :rows="2"
      size="md"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormSelect
        v-model="formData.warehouse_id"
        :options="warehouseOptions"
        label="Almacén de salida"
        placeholder="Almacén por defecto de la empresa"
        :disabled="readonly"
        clearable
        size="md"
        hint="Las ventas de esta caja descuentan inventario de este almacén."
      />
      <FormSelect
        v-model="formData.default_partner_id"
        :options="partnerOptions"
        label="Cliente por defecto"
        placeholder="Sin cliente por defecto"
        :disabled="readonly"
        clearable
        size="md"
        hint="Cliente usado para ventas a público general."
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.max_discount_percent"
        type="number"
        label="Descuento máximo para cajeros (%)"
        :min="0"
        :max="100"
        step="0.01"
        :readonly="readonly"
        size="md"
        hint="Descuentos mayores requieren rol de administrador."
      />
      <FormInput
        v-model="formData.difference_tolerance"
        type="number"
        label="Tolerancia de diferencia en corte ($)"
        :min="0"
        step="0.01"
        :readonly="readonly"
        size="md"
        hint="Diferencias mayores exigen justificación al cerrar."
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <input
          v-model="formData.blind_close"
          type="checkbox"
          :disabled="readonly"
          class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
        />
        <label class="text-sm text-slate-700 cursor-pointer select-none">
          Corte ciego (el cajero no ve el monto esperado al cerrar)
        </label>
      </div>
      <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <input
          v-model="formData.active"
          type="checkbox"
          :disabled="readonly"
          class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
        />
        <label class="text-sm text-slate-700 cursor-pointer select-none">Activa</label>
      </div>
    </div>
  </div>
</template>
