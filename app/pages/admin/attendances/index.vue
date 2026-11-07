<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { HrAttendanceDayViewRow, HrAttendanceViewRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

type Tab = 'days' | 'punches'

const route = useRoute()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getDays, getAttendances, reviewOvertime, lastError } = useAttendance()
const { getAll: getEmployees } = useEmployee()
const { get: getSettings } = useHrSettings()

const today = todayIn()
const from = ref(firstDayOfMonth(today))
const to = ref(today)
const employeeId = ref(typeof route.query.employee === 'string' ? route.query.employee : '')
const tab = ref<Tab>('days')
const timezone = ref('America/Mexico_City')
const employeeOptions = ref<HrOption[]>([])
const days = ref<HrAttendanceDayViewRow[]>([])
const punches = ref<HrAttendanceViewRow[]>([])
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const dayColumns: Column[] = [
  { key: 'work_date', label: 'Fecha', type: 'date' },
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'first_in', label: 'Entrada', type: 'text' },
  { key: 'last_out', label: 'Salida', type: 'text' },
  { key: 'worked', label: 'Trabajado', type: 'text', align: 'right' },
  { key: 'late', label: 'Retardo', type: 'text', align: 'right' },
  { key: 'overtime', label: 'Horas extra', type: 'text', align: 'right' },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: { ok: 'Normal', open: 'En curso', missing: 'Sin salida', rest: 'Descanso laborado', holiday: 'Festivo laborado', ...OVERTIME_STATUS_LABELS },
      colors: {
        ok: 'bg-emerald-100 text-emerald-700',
        open: 'bg-sky-100 text-sky-700',
        missing: 'bg-red-100 text-red-700',
        rest: 'bg-violet-100 text-violet-700',
        holiday: 'bg-violet-100 text-violet-700',
        pending: 'bg-amber-100 text-amber-700',
        approved: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-slate-100 text-slate-600'
      }
    }
  }
]

const punchColumns: Column[] = [
  { key: 'work_date', label: 'Fecha', type: 'date' },
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'check_in', label: 'Entrada', type: 'text' },
  { key: 'check_out', label: 'Salida', type: 'text' },
  { key: 'worked', label: 'Duración', type: 'text', align: 'right' },
  {
    key: 'source',
    label: 'Origen',
    type: 'badge',
    badgeConfig: {
      labels: { kiosk: 'Kiosco', manual: 'Manual' },
      colors: { kiosk: 'bg-indigo-100 text-indigo-700', manual: 'bg-slate-100 text-slate-600' }
    }
  }
]

const dayStatus = (d: HrAttendanceDayViewRow): string => {
  if (d.missing_check_out) return 'missing'
  if (d.is_open) return 'open'
  if (d.overtime_status !== 'none') return d.overtime_status
  if (d.is_holiday) return 'holiday'
  if (d.is_rest_day) return 'rest'
  return 'ok'
}

const dayRows = computed(() => days.value.map(d => ({
  id: d.id,
  work_date: d.work_date,
  employee: d.employee_name ?? '—',
  first_in: formatClockTime(d.first_check_in, timezone.value),
  last_out: d.is_open ? '—' : formatClockTime(d.last_check_out, timezone.value),
  worked: formatMinutes(d.worked_minutes),
  late: d.late_minutes > 0 ? formatMinutes(d.late_minutes) : '—',
  overtime: d.overtime_minutes > 0
    ? `${formatMinutes(d.overtime_approved_minutes)} / ${formatMinutes(d.overtime_minutes)}`
    : '—',
  overtime_status: d.overtime_status,
  overtime_minutes: d.overtime_minutes,
  status: dayStatus(d)
})))

const punchRows = computed(() => punches.value.map(p => ({
  id: p.id,
  work_date: p.work_date,
  employee: p.employee_name ?? '—',
  check_in: formatClockTime(p.check_in, timezone.value),
  check_out: p.missing_check_out ? 'Sin salida' : formatClockTime(p.check_out, timezone.value),
  worked: p.check_out ? formatMinutes(p.worked_minutes) : 'En curso',
  source: p.source
})))

const pendingOvertime = computed(() => days.value.filter(d => d.overtime_status === 'pending').length)

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const filters = { from: from.value, to: to.value, employeeId: employeeId.value || undefined }
    const [d, p, employees, settings] = await Promise.all([
      getDays(companyId, filters),
      getAttendances(companyId, filters),
      employeeOptions.value.length ? Promise.resolve(null) : getEmployees(companyId),
      isSelectedCompanyAdmin.value ? getSettings(companyId) : Promise.resolve(null)
    ])
    days.value = d
    punches.value = p
    if (employees) employeeOptions.value = employees.map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
    if (settings) timezone.value = settings.timezone
  } finally {
    isLoading.value = false
  }
}

const handleReview = async (row: Record<string, unknown>, approve: boolean) => {
  const saved = await reviewOvertime(row.id as string, approve)
  if (!saved) {
    errorMessage.value = lastError.value
    return
  }
  await load()
}

watch(selectedCompanyId, () => {
  employeeOptions.value = []
  void load()
}, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <template v-else>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2">
          <BtnApp :variant="tab === 'days' ? 'primary' : 'secondary'" size="sm" @click="tab = 'days'">
            Resumen por día
          </BtnApp>
          <BtnApp :variant="tab === 'punches' ? 'primary' : 'secondary'" size="sm" @click="tab = 'punches'">
            Marcas
          </BtnApp>
        </div>
        <div class="flex flex-wrap gap-2">
          <BtnApp variant="secondary" size="sm" @click="navigateTo('/admin/attendances/report')">
            Reporte de asistencias
          </BtnApp>
          <BtnApp v-if="isSelectedCompanyAdmin" variant="primary" size="sm" @click="navigateTo('/admin/attendances/create')">
            Registrar marca manual
          </BtnApp>
        </div>
      </div>

      <HrRangeFilter
        v-model:from="from"
        v-model:to="to"
        v-model:employee-id="employeeId"
        :employee-options="employeeOptions"
        :show-employee="isSelectedCompanyAdmin"
        @apply="load"
      />

      <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-4" />
      <HrNotice
        v-if="isSelectedCompanyAdmin && pendingOvertime > 0 && tab === 'days'"
        kind="info"
        :message="`Hay ${pendingOvertime} días con horas extra por aprobar. Solo las aprobadas se pagan en la nómina.`"
        class="mb-4"
      />

      <HrNotice v-if="isLoading" kind="loading" message="Cargando asistencia…" />
      <Datatable
        v-else-if="tab === 'days'"
        title="Asistencia por día"
        description="Retardos y horas extra según el horario de cada empleado"
        :data="dayRows"
        :columns="dayColumns"
        :search-keys="['employee']"
        export-filename="asistencia-diaria"
        empty-title="Sin asistencia"
        empty-message="No hay marcas en el rango seleccionado."
      >
        <template v-if="isSelectedCompanyAdmin" #actions="{ row }">
          <div v-if="row.overtime_minutes > 0" class="flex justify-center gap-1">
            <BtnApp
              v-if="row.overtime_status !== 'approved'"
              variant="ghost"
              size="sm"
              @click="handleReview(row, true)"
            >
              Aprobar
            </BtnApp>
            <BtnApp
              v-if="row.overtime_status !== 'rejected'"
              variant="ghost"
              size="sm"
              @click="handleReview(row, false)"
            >
              Rechazar
            </BtnApp>
          </div>
        </template>
      </Datatable>
      <Datatable
        v-else
        title="Marcas de entrada y salida"
        description="Cada par entrada/salida registrado en el kiosco o a mano"
        :data="punchRows"
        :columns="punchColumns"
        :search-keys="['employee']"
        export-filename="marcas"
        empty-title="Sin marcas"
        empty-message="No hay marcas en el rango seleccionado."
        @row-click="row => isSelectedCompanyAdmin && navigateTo(`/admin/attendances/${row.id}`)"
      />
    </template>
  </div>
</template>
