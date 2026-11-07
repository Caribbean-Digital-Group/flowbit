<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { HrLeaveRequestViewRow, LeaveStatus } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getRequests } = useLeave()

const statusFilter = ref<LeaveStatus | ''>('pending')
const requests = ref<HrLeaveRequestViewRow[]>([])
const isLoading = ref(false)

const filters: { value: LeaveStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: '', label: 'Todas' }
]

const columns: Column[] = [
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'type', label: 'Tipo', type: 'text' },
  { key: 'start_date', label: 'Desde', type: 'date' },
  { key: 'end_date', label: 'Hasta', type: 'date' },
  { key: 'days', label: 'Días', type: 'text', align: 'right' },
  { key: 'status', label: 'Estado', type: 'badge', badgeConfig: { labels: LEAVE_STATUS_LABELS, colors: LEAVE_STATUS_COLORS } }
]

const rows = computed(() => requests.value.map(r => ({
  id: r.id,
  employee: r.employee_name ?? '—',
  type: r.leave_type_name ?? '—',
  start_date: r.start_date,
  end_date: r.end_date,
  days: Number(r.days),
  status: r.status
})))

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    requests.value = await getRequests(companyId, { status: statusFilter.value || undefined })
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, statusFilter], load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <template v-else>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2">
          <BtnApp
            v-for="f in filters"
            :key="f.value"
            :variant="statusFilter === f.value ? 'primary' : 'secondary'"
            size="sm"
            @click="statusFilter = f.value"
          >
            {{ f.label }}
          </BtnApp>
        </div>
        <div class="flex flex-wrap gap-2">
          <BtnApp variant="secondary" size="sm" @click="navigateTo('/admin/leave-allocations')">
            Saldos de vacaciones
          </BtnApp>
          <BtnApp v-if="isSelectedCompanyAdmin" variant="secondary" size="sm" @click="navigateTo('/admin/leave-types')">
            Tipos de ausencia
          </BtnApp>
        </div>
      </div>

      <HrNotice v-if="isLoading" kind="loading" message="Cargando solicitudes…" />
      <Datatable
        v-else
        title="Vacaciones y permisos"
        :description="isSelectedCompanyAdmin ? 'Solicitudes del equipo. Al aprobar se valida el saldo y se justifican las faltas del periodo.' : 'Tus solicitudes de vacaciones y permisos.'"
        :data="rows"
        :columns="columns"
        :search-keys="['employee', 'type']"
        :creatable="true"
        create-label="Nueva solicitud"
        export-filename="vacaciones-permisos"
        empty-title="Sin solicitudes"
        empty-message="No hay solicitudes con este estado."
        @create="navigateTo('/admin/leaves/create')"
        @row-click="row => navigateTo(`/admin/leaves/${row.id}`)"
      />
    </template>
  </div>
</template>
