<script setup lang="ts">
/** Filtro de rango de fechas y empleado para las vistas de asistencia e inasistencias. */
interface Props {
  employeeOptions?: HrOption[]
  showEmployee?: boolean
}

withDefaults(defineProps<Props>(), {
  employeeOptions: () => [],
  showEmployee: true
})

const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })
const employeeId = defineModel<string>('employeeId', { default: '' })

const emit = defineEmits<{ apply: [] }>()
</script>

<template>
  <div class="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
    <FormInput v-model="from" type="date" label="Desde" size="md" />
    <FormInput v-model="to" type="date" label="Hasta" size="md" />
    <FormSelect
      v-if="showEmployee"
      v-model="employeeId"
      label="Empleado"
      :options="employeeOptions"
      placeholder="Todos"
      searchable
      clearable
      size="md"
    />
    <div class="flex gap-2">
      <BtnApp variant="primary" size="md" @click="emit('apply')">
        Aplicar
      </BtnApp>
      <slot />
    </div>
  </div>
</template>
