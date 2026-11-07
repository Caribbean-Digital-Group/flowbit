<script lang="ts">
import type { EmployeeDepartmentRow } from '~/types/employee.types'

export interface EmployeeDepartmentFormData {
  name: string
  parent_id: string
  manager_id: string
}

export const createEmptyEmployeeDepartmentForm = (): EmployeeDepartmentFormData => ({
  name: '',
  parent_id: '',
  manager_id: ''
})

export const mapEmployeeDepartmentToForm = (row: EmployeeDepartmentRow): EmployeeDepartmentFormData => ({
  name: row.name,
  parent_id: row.parent_id ?? '',
  manager_id: row.manager_id ?? ''
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  parentOptions?: EmployeeOption[]
  managerOptions?: EmployeeOption[]
}

withDefaults(defineProps<Props>(), {
  readonly: false,
  parentOptions: () => [],
  managerOptions: () => []
})

const formData = defineModel<EmployeeDepartmentFormData>({ required: true })
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div class="sm:col-span-2">
      <FormInput
        v-model="formData.name"
        label="Nombre"
        placeholder="Ej: Ventas"
        :readonly="readonly"
        required
        size="md"
      />
    </div>
    <FormSelect
      v-model="formData.parent_id"
      label="Departamento padre"
      :options="parentOptions"
      :disabled="readonly"
      placeholder="Ninguno"
      no-results-text="Sin departamentos"
      clearable
      size="md"
    />
    <FormSelect
      v-model="formData.manager_id"
      label="Responsable"
      :options="managerOptions"
      :disabled="readonly"
      placeholder="Selecciona un empleado"
      no-results-text="Sin empleados"
      clearable
      size="md"
    />
  </div>
</template>
