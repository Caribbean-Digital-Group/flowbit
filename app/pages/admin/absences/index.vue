<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { HrAbsenceViewRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getAll, detect, create, justify, update, dismiss, lastError } = useAbsence()
const { getAll: getEmployees } = useEmployee()

const today = todayIn()
const from = ref(firstDayOfMonth(today))
const to = ref(today)
const employeeId = ref('')
const employeeOptions = ref<HrOption[]>([])
const absences = ref<HrAbsenceViewRow[]>([])
const isLoading = ref(false)
const message = ref<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null)

// Diálogo para justificar o registrar.
const editing = ref<{ id: string | null; employee_id: string; absence_date: string; reason: string; deduct: boolean } | null>(null)

const columns: Column[] = [
  { key: 'absence_date', label: 'Fecha', type: 'date' },
  { key: 'weekday', label: 'Día', type: 'text' },
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'department', label: 'Departamento', type: 'text' },
  {
    key: 'kind',
    label: 'Tipo',
    type: 'badge',
    badgeConfig: {
      labels: ABSENCE_KIND_LABELS,
      colors: { unjustified: 'bg-red-100 text-red-700', justified: 'bg-emerald-100 text-emerald-700' }
    }
  },
  {
    key: 'deduct',
    label: 'Nómina',
    type: 'badge',
    badgeConfig: {
      labels: { yes: 'Se descuenta', no: 'No se descuenta' },
      colors: { yes: 'bg-amber-100 text-amber-700', no: 'bg-slate-100 text-slate-600' }
    }
  },
  { key: 'reason', label: 'Motivo', type: 'text' }
]

const rows = computed(() => absences.value.map(a => ({
  id: a.id,
  absence_date: a.absence_date,
  weekday: WEEKDAY_LABELS[new Date(`${a.absence_date}T00:00:00Z`).getUTCDay()],
  employee: a.employee_name ?? '—',
  department: a.department_name ?? '—',
  kind: a.kind,
  deduct: a.deduct_from_pay ? 'yes' : 'no',
  reason: a.reason ?? (a.leave_request_id ? 'Permiso aprobado' : '—'),
  raw: a
})))

const counts = computed(() => ({
  unjustified: absences.value.filter(a => a.kind === 'unjustified').length,
  justified: absences.value.filter(a => a.kind === 'justified').length
}))

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    const [list, employees] = await Promise.all([
      getAll(companyId, { from: from.value, to: to.value, employeeId: employeeId.value || undefined }),
      employeeOptions.value.length ? Promise.resolve(null) : getEmployees(companyId)
    ])
    absences.value = list
    if (employees) employeeOptions.value = employees.map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
  } finally {
    isLoading.value = false
  }
}

const handleDetect = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const created = await detect(companyId, from.value, to.value)
  message.value = created === null
    ? { kind: 'error', text: lastError.value ?? 'No se pudieron detectar las inasistencias.' }
    : {
        kind: created > 0 ? 'info' : 'success',
        text: created > 0
          ? `Se registraron ${created} faltas nuevas. Revísalas y justifica las que correspondan.`
          : 'No se encontraron faltas nuevas en el rango. Solo se revisan días cerrados de empleados con horario asignado.'
      }
  await load()
}

const openJustify = (row: Record<string, unknown>) => {
  const a = row.raw as HrAbsenceViewRow
  editing.value = { id: a.id, employee_id: a.employee_id, absence_date: a.absence_date, reason: a.reason ?? '', deduct: false }
}

const openCreate = () => {
  editing.value = { id: null, employee_id: employeeId.value, absence_date: to.value, reason: '', deduct: true }
}

const handleSaveDialog = async () => {
  const companyId = selectedCompanyId.value
  const data = editing.value
  if (!companyId || !data) return
  if (!data.employee_id || !data.absence_date) {
    message.value = { kind: 'error', text: 'Elige al empleado y la fecha.' }
    return
  }
  const saved = data.id
    ? await justify(data.id, data.reason.trim(), data.deduct)
    : await create({
        company_id: companyId,
        employee_id: data.employee_id,
        absence_date: data.absence_date,
        kind: 'unjustified',
        deduct_from_pay: data.deduct,
        reason: trimToNull(data.reason)
      })
  if (!saved) {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo guardar.' }
    return
  }
  message.value = null
  editing.value = null
  await load()
}

const handleUnjustify = async (row: Record<string, unknown>) => {
  if (await update(row.id as string, { kind: 'unjustified', deduct_from_pay: true })) await load()
  else message.value = { kind: 'error', text: lastError.value ?? 'No se pudo actualizar.' }
}

const handleDismiss = async (row: Record<string, unknown>) => {
  if (await dismiss(row.id as string)) await load()
  else message.value = { kind: 'error', text: lastError.value ?? 'No se pudo descartar.' }
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
      <HrRangeFilter
        v-model:from="from"
        v-model:to="to"
        v-model:employee-id="employeeId"
        :employee-options="employeeOptions"
        :show-employee="isSelectedCompanyAdmin"
        @apply="load"
      >
        <BtnApp v-if="isSelectedCompanyAdmin" variant="secondary" size="md" @click="handleDetect">
          Detectar faltas
        </BtnApp>
      </HrRangeFilter>

      <HrNotice v-if="message" :kind="message.kind" :message="message.text" class="mb-4" />

      <div
        v-if="editing"
        class="mb-6 rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-slate-200/50"
      >
        <h3 class="mb-4 font-semibold text-slate-800">
          {{ editing.id ? 'Justificar inasistencia' : 'Registrar inasistencia' }}
        </h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormSelect
            v-if="!editing.id"
            v-model="editing.employee_id"
            label="Empleado"
            :options="employeeOptions"
            searchable
            size="md"
          />
          <FormInput v-if="!editing.id" v-model="editing.absence_date" type="date" label="Fecha" size="md" />
          <div class="sm:col-span-2">
            <FormTextArea v-model="editing.reason" label="Motivo" :rows="2" size="md" />
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="editing.deduct" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600">
            Descontar el día en la nómina
          </label>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <BtnApp variant="ghost" size="sm" @click="editing = null">
            Cancelar
          </BtnApp>
          <BtnApp variant="primary" size="sm" @click="handleSaveDialog">
            Guardar
          </BtnApp>
        </div>
      </div>

      <HrNotice v-if="isLoading" kind="loading" message="Cargando inasistencias…" />
      <Datatable
        v-else
        title="Inasistencias"
        :description="`${counts.unjustified} injustificadas y ${counts.justified} justificadas en el rango`"
        :data="rows"
        :columns="columns"
        :search-keys="['employee', 'department', 'reason']"
        :creatable="isSelectedCompanyAdmin"
        create-label="Registrar falta"
        export-filename="inasistencias"
        empty-title="Sin inasistencias"
        empty-message="Usa «Detectar faltas» para revisar los días laborables sin marcas."
        @create="openCreate"
      >
        <template v-if="isSelectedCompanyAdmin" #actions="{ row }">
          <div class="flex justify-center gap-1">
            <BtnApp v-if="row.kind === 'unjustified'" variant="ghost" size="sm" @click="openJustify(row)">
              Justificar
            </BtnApp>
            <BtnApp v-else variant="ghost" size="sm" @click="handleUnjustify(row)">
              Marcar injustificada
            </BtnApp>
            <BtnApp variant="ghost" size="sm" @click="handleDismiss(row)">
              Descartar
            </BtnApp>
          </div>
        </template>
      </Datatable>
    </template>
  </div>
</template>
