<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { WorkScheduleWithLines } from '~/composables/useWorkSchedule'

definePageMeta({ layout: 'admin' })

const columns: Column[] = [
  { key: 'name', label: 'Horario', type: 'text' },
  { key: 'days', label: 'Días laborables', type: 'text' },
  { key: 'hours', label: 'Horas por semana', type: 'text', align: 'right' },
  { key: 'tolerance', label: 'Tolerancia', type: 'text', align: 'right' },
  { key: 'employees', label: 'Empleados', type: 'text', align: 'right' }
]

const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getAll } = useWorkSchedule()
const { getAll: getEmployees } = useEmployee()

const rows = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const mapRow = (s: WorkScheduleWithLines, employeeCount: number): Record<string, unknown> => ({
  id: s.id,
  name: s.name,
  days: WEEKDAY_ORDER.filter(d => s.lines.some(l => l.weekday === d)).map(d => WEEKDAY_SHORT[d]).join(', ') || '—',
  hours: formatMinutes(s.lines.reduce((sum, l) => sum + scheduledMinutes(l.start_time, l.end_time, l.break_minutes), 0)),
  tolerance: s.late_tolerance_minutes === null ? 'De la empresa' : `${s.late_tolerance_minutes} min`,
  employees: employeeCount
})

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    const [schedules, employees] = await Promise.all([getAll(companyId), getEmployees(companyId)])
    rows.value = schedules.map(s => mapRow(s, employees.filter(e => e.work_schedule_id === s.id).length))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <HrNotice v-else-if="isLoading" kind="loading" message="Cargando horarios…" />
    <Datatable
      v-else
      title="Horarios de trabajo"
      description="Jornadas que se asignan a los empleados para calcular retardos, horas extra e inasistencias"
      :data="rows"
      :columns="columns"
      :search-keys="['name']"
      :creatable="isSelectedCompanyAdmin"
      create-label="Nuevo horario"
      export-filename="horarios"
      empty-title="Sin horarios"
      empty-message="Crea un horario y asígnalo a tus empleados desde su expediente."
      @create="navigateTo('/admin/work-schedules/create')"
      @row-click="row => navigateTo(`/admin/work-schedules/${row.id}`)"
    />
  </div>
</template>
