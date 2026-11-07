<script lang="ts">
import type { EmployeeRegistration, EmployeeRow, EmployeeStatus, EmployeeUpdate } from '~/types/employee.types'

export interface EmployeeFormData {
  employee_number: string
  job_title: string
  department_id: string
  manager_id: string
  work_email: string
  work_phone: string
  work_location: string
  hire_date: string
  status: EmployeeStatus
  termination_date: string
  work_schedule_id: string
}

export const createEmptyEmployeeForm = (): EmployeeFormData => ({
  employee_number: '',
  job_title: '',
  department_id: '',
  manager_id: '',
  work_email: '',
  work_phone: '',
  work_location: '',
  hire_date: '',
  status: 'active',
  termination_date: '',
  work_schedule_id: ''
})

export const mapEmployeeToForm = (employee: EmployeeRow): EmployeeFormData => ({
  employee_number: employee.employee_number ?? '',
  job_title: employee.job_title ?? '',
  department_id: employee.department_id ?? '',
  manager_id: employee.manager_id ?? '',
  work_email: employee.work_email ?? '',
  work_phone: employee.work_phone ?? '',
  work_location: employee.work_location ?? '',
  hire_date: employee.hire_date ?? '',
  status: employee.status,
  termination_date: employee.termination_date ?? '',
  work_schedule_id: employee.work_schedule_id ?? ''
})

export const mapFormToEmployeeRegistration = (form: EmployeeFormData): EmployeeRegistration => ({
  employee_number: trimToNull(form.employee_number),
  job_title: trimToNull(form.job_title),
  department_id: form.department_id || null,
  manager_id: form.manager_id || null,
  work_email: trimToNull(form.work_email),
  work_phone: trimToNull(form.work_phone),
  work_location: trimToNull(form.work_location),
  hire_date: form.hire_date || null
})

export const mapFormToEmployeeUpdate = (form: EmployeeFormData): EmployeeUpdate => ({
  ...mapFormToEmployeeRegistration(form),
  status: form.status,
  termination_date: form.status === 'terminated' ? form.termination_date || null : null,
  work_schedule_id: form.work_schedule_id || null
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  showStatus?: boolean
  departmentOptions?: EmployeeOption[]
  managerOptions?: EmployeeOption[]
  /** Horarios de trabajo. Sin opciones no se muestra el campo (alta). */
  scheduleOptions?: EmployeeOption[]
}

withDefaults(defineProps<Props>(), {
  readonly: false,
  showStatus: false,
  departmentOptions: () => [],
  managerOptions: () => [],
  scheduleOptions: () => []
})

const formData = defineModel<EmployeeFormData>({ required: true })
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <FormInput
      v-model="formData.job_title"
      label="Puesto"
      placeholder="Ej: Ejecutivo de ventas"
      :readonly="readonly"
      size="md"
    />
    <FormInput
      v-model="formData.employee_number"
      label="Número de empleado"
      placeholder="Ej: E-0001"
      :readonly="readonly"
      size="md"
    />
    <FormSelect
      v-model="formData.department_id"
      label="Departamento"
      :options="departmentOptions"
      :disabled="readonly"
      placeholder="Selecciona un departamento"
      no-results-text="Sin departamentos"
      clearable
      size="md"
    />
    <FormSelect
      v-model="formData.manager_id"
      label="Jefe directo"
      :options="managerOptions"
      :disabled="readonly"
      placeholder="Selecciona un empleado"
      no-results-text="Sin empleados"
      clearable
      size="md"
    />
    <FormInput
      v-model="formData.work_email"
      type="email"
      label="Correo de trabajo"
      placeholder="nombre@empresa.com"
      :readonly="readonly"
      size="md"
    />
    <FormInput
      v-model="formData.work_phone"
      type="tel"
      label="Teléfono de trabajo"
      placeholder="+52 55 1234 5678"
      :readonly="readonly"
      size="md"
    />
    <FormInput
      v-model="formData.work_location"
      label="Lugar de trabajo"
      placeholder="Ej: Oficina Monterrey"
      :readonly="readonly"
      size="md"
    />
    <FormInput
      v-model="formData.hire_date"
      type="date"
      label="Fecha de ingreso"
      :readonly="readonly"
      size="md"
    />
    <FormSelect
      v-if="showStatus"
      v-model="formData.work_schedule_id"
      label="Horario de trabajo"
      :options="scheduleOptions"
      :disabled="readonly"
      placeholder="Sin horario"
      no-results-text="Crea horarios en Recursos Humanos → Horarios"
      hint="Define retardos, horas extra e inasistencias."
      clearable
      size="md"
    />
    <template v-if="showStatus">
      <FormSelect
        v-model="formData.status"
        label="Estado"
        :options="EMPLOYEE_STATUS_OPTIONS"
        :disabled="readonly"
        :searchable="false"
        required
        size="md"
      />
      <FormInput
        v-if="formData.status === 'terminated'"
        v-model="formData.termination_date"
        type="date"
        label="Fecha de baja"
        :readonly="readonly"
        required
        size="md"
      />
    </template>
  </div>
</template>
