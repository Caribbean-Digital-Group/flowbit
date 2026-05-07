<script lang="ts">
export interface WarehouseFormData {
  name: string
  code: string
  description: string
  is_default: boolean
  active: boolean
}

export const createEmptyWarehouseForm = (): WarehouseFormData => ({
  name: '',
  code: '',
  description: '',
  is_default: false,
  active: true
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<WarehouseFormData>({ required: true })
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.name"
        label="Nombre del almacén"
        placeholder="Almacén principal"
        :readonly="readonly"
        required
      />

      <FormInput
        v-model="formData.code"
        label="Código"
        placeholder="MAIN"
        :readonly="readonly"
        required
      />
    </div>

    <FormTextArea
      v-model="formData.description"
      label="Descripción"
      placeholder="Descripción del almacén"
      :readonly="readonly"
      :rows="4"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          v-model="formData.is_default"
          type="checkbox"
          :disabled="readonly"
          class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
        >
        <span class="text-sm text-slate-700">Almacén predeterminado</span>
      </label>

      <label class="flex items-center gap-2 cursor-pointer">
        <input
          v-model="formData.active"
          type="checkbox"
          :disabled="readonly"
          class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
        >
        <span class="text-sm text-slate-700">Activo</span>
      </label>
    </div>
  </div>
</template>
