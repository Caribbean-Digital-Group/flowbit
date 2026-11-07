<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { HrLeaveAllocationViewRow, HrLeaveBalanceRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

type Tab = 'balances' | 'allocations'

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getBalances, getAllocations, generateVacationAllocations, archiveAllocation, lastError } = useLeave()
const { ensureDefaults } = useHrSettings()

const tab = ref<Tab>('balances')
const balances = ref<HrLeaveBalanceRow[]>([])
const allocations = ref<HrLeaveAllocationViewRow[]>([])
const isLoading = ref(false)
const message = ref<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null)

const balanceColumns: Column[] = [
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'type', label: 'Tipo', type: 'text' },
  { key: 'seniority', label: 'Antigüedad', type: 'text' },
  { key: 'allocated', label: 'Asignados', type: 'text', align: 'right' },
  { key: 'taken', label: 'Tomados', type: 'text', align: 'right' },
  { key: 'pending', label: 'Por aprobar', type: 'text', align: 'right' },
  { key: 'remaining', label: 'Disponibles', type: 'text', align: 'right' }
]

const allocationColumns: Column[] = [
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'type', label: 'Tipo', type: 'text' },
  { key: 'days', label: 'Días', type: 'text', align: 'right' },
  { key: 'service_year', label: 'Año de servicio', type: 'text', align: 'right' },
  { key: 'valid_from', label: 'Desde', type: 'date' },
  { key: 'valid_to', label: 'Vence', type: 'date' },
  { key: 'notes', label: 'Notas', type: 'text' }
]

const today = todayIn()

const balanceRows = computed(() => balances.value.map(b => {
  const years = b.hire_date ? completedYears(b.hire_date, today) : null
  return {
    id: `${b.employee_id}-${b.leave_type_id}`,
    employee: b.employee_name ?? '—',
    type: b.leave_type_name,
    seniority: years === null ? 'Sin fecha de ingreso' : `${years} ${years === 1 ? 'año' : 'años'}`,
    allocated: b.allocated_days,
    taken: b.taken_days,
    pending: b.pending_days,
    remaining: b.remaining_days
  }
}))

const allocationRows = computed(() => allocations.value.map(a => ({
  id: a.id,
  employee: a.employee_name ?? '—',
  type: a.leave_type_name ?? '—',
  days: Number(a.days),
  service_year: a.service_year ?? '—',
  valid_from: a.valid_from ?? '',
  valid_to: a.valid_to ?? '',
  notes: a.notes ?? '—'
})))

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    ;[balances.value, allocations.value] = await Promise.all([getBalances(companyId), getAllocations(companyId)])
  } finally {
    isLoading.value = false
  }
}

const handleGenerate = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  await ensureDefaults(companyId)
  const created = await generateVacationAllocations(companyId, today)
  message.value = created === null
    ? { kind: 'error', text: lastError.value ?? 'No se pudieron asignar las vacaciones.' }
    : {
        kind: created > 0 ? 'success' : 'info',
        text: created > 0
          ? `Se asignaron vacaciones a ${created} ${created === 1 ? 'empleado' : 'empleados'} según su antigüedad.`
          : 'Todos los empleados elegibles ya tienen las vacaciones de su año de servicio. Solo cuentan quienes tienen fecha de ingreso y al menos un año cumplido.'
      }
  await load()
}

const handleArchive = async (row: Record<string, unknown>) => {
  if (await archiveAllocation(row.id as string)) await load()
  else message.value = { kind: 'error', text: lastError.value ?? 'No se pudo anular.' }
}

watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <template v-else>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2">
          <BtnApp :variant="tab === 'balances' ? 'primary' : 'secondary'" size="sm" @click="tab = 'balances'">
            Saldos
          </BtnApp>
          <BtnApp :variant="tab === 'allocations' ? 'primary' : 'secondary'" size="sm" @click="tab = 'allocations'">
            Asignaciones
          </BtnApp>
        </div>
        <div v-if="isSelectedCompanyAdmin" class="flex flex-wrap gap-2">
          <BtnApp variant="secondary" size="sm" @click="handleGenerate">
            Asignar vacaciones por antigüedad
          </BtnApp>
          <BtnApp variant="primary" size="sm" @click="navigateTo('/admin/leave-allocations/create')">
            Asignación manual
          </BtnApp>
        </div>
      </div>

      <HrNotice v-if="message" :kind="message.kind" :message="message.text" class="mb-4" />

      <HrNotice v-if="isLoading" kind="loading" message="Cargando saldos…" />
      <Datatable
        v-else-if="tab === 'balances'"
        title="Saldos de vacaciones"
        description="Días asignados menos los aprobados. LFT 2023: 12 días el primer año, +2 por año hasta 20 en el quinto y +2 cada cinco años después."
        :data="balanceRows"
        :columns="balanceColumns"
        :search-keys="['employee', 'type']"
        export-filename="saldos-vacaciones"
        empty-title="Sin saldos"
        empty-message="Asigna vacaciones por antigüedad para ver los saldos."
      />
      <Datatable
        v-else
        title="Asignaciones"
        description="Cada asignación suma días al saldo. Una asignación negativa lo ajusta."
        :data="allocationRows"
        :columns="allocationColumns"
        :search-keys="['employee', 'type', 'notes']"
        export-filename="asignaciones-vacaciones"
        empty-title="Sin asignaciones"
      >
        <template v-if="isSelectedCompanyAdmin" #actions="{ row }">
          <div class="flex justify-center">
            <BtnApp variant="ghost" size="sm" @click="handleArchive(row)">
              Anular
            </BtnApp>
          </div>
        </template>
      </Datatable>
    </template>
  </div>
</template>
