<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { StatItem } from '~/components/StatGrid.vue'
import type { HrAttendanceSummaryRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getSummary } = useAttendance()

const today = todayIn()
const from = ref(firstDayOfMonth(today))
const to = ref(today)
const summary = ref<HrAttendanceSummaryRow[]>([])
const isLoading = ref(false)

const columns: Column[] = [
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'department', label: 'Departamento', type: 'text' },
  { key: 'days_worked', label: 'Días trabajados', type: 'text', align: 'right' },
  { key: 'worked_hours', label: 'Horas trabajadas', type: 'text', align: 'right' },
  { key: 'punctuality', label: 'Puntualidad', type: 'progress' },
  { key: 'late', label: 'Retardos', type: 'text', align: 'right' },
  { key: 'overtime', label: 'Horas extra aprobadas', type: 'text', align: 'right' },
  { key: 'pending', label: 'Extra por aprobar', type: 'text', align: 'right' },
  { key: 'absences', label: 'Faltas', type: 'text', align: 'right' },
  { key: 'justified', label: 'Justificadas', type: 'text', align: 'right' },
  { key: 'leave_days', label: 'Días de permiso', type: 'text', align: 'right' },
  { key: 'special', label: 'Descanso / festivo laborado', type: 'text', align: 'right' },
  { key: 'missing', label: 'Sin salida', type: 'text', align: 'right' }
]

const rows = computed(() => summary.value.map(s => ({
  id: s.employee_id,
  employee: s.employee_name ?? '—',
  department: s.department_name ?? '—',
  days_worked: s.days_worked,
  worked_hours: minutesToHours(s.worked_minutes).toLocaleString('es-MX'),
  punctuality: s.days_worked > 0 ? Math.round(((s.days_worked - s.late_count) / s.days_worked) * 100) : 0,
  late: s.late_count > 0 ? `${s.late_count} (${formatMinutes(s.late_minutes)})` : '0',
  overtime: minutesToHours(s.overtime_approved_minutes).toLocaleString('es-MX'),
  pending: minutesToHours(s.overtime_pending_minutes).toLocaleString('es-MX'),
  absences: s.absences_unjustified,
  justified: s.absences_justified,
  leave_days: s.leave_days,
  special: `${s.rest_days_worked} / ${s.holidays_worked}`,
  missing: s.missing_check_outs
})))

const stats = computed<StatItem[]>(() => {
  const sum = (key: keyof HrAttendanceSummaryRow) => summary.value.reduce((s, r) => s + Number(r[key] ?? 0), 0)
  const days = sum('days_worked')
  const late = sum('late_count')
  return [
    { label: 'Horas trabajadas', value: minutesToHours(sum('worked_minutes')).toLocaleString('es-MX') },
    { label: 'Puntualidad', value: days > 0 ? `${Math.round(((days - late) / days) * 100)}%` : '—' },
    { label: 'Horas extra aprobadas', value: minutesToHours(sum('overtime_approved_minutes')).toLocaleString('es-MX') },
    { label: 'Faltas injustificadas', value: sum('absences_unjustified') }
  ]
})

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    summary.value = await getSummary(companyId, from.value, to.value)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <template v-else>
      <HrRangeFilter v-model:from="from" v-model:to="to" :show-employee="false" @apply="load">
        <BtnApp v-if="isSelectedCompanyAdmin" variant="secondary" size="md" @click="navigateTo('/admin/absences')">
          Inasistencias
        </BtnApp>
      </HrRangeFilter>

      <HrNotice v-if="isLoading" kind="loading" message="Calculando reporte…" />
      <template v-else>
        <StatGrid :stats="stats" :columns="4" class="mb-6" />
        <Datatable
          title="Reporte de asistencias"
          :description="`Del ${formatHrDate(from)} al ${formatHrDate(to)}. Las faltas aparecen después de detectarlas en Inasistencias.`"
          :data="rows"
          :columns="columns"
          :search-keys="['employee', 'department']"
          export-filename="reporte-asistencias"
          empty-title="Sin datos"
          empty-message="No hay empleados activos en la empresa."
          @row-click="row => navigateTo(`/admin/attendances?employee=${row.id}`)"
        />
      </template>
    </template>
  </div>
</template>
