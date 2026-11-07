<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getPeriods } = usePayroll()

const rows = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const columns: Column[] = [
  { key: 'name', label: 'Periodo', type: 'text' },
  { key: 'frequency', label: 'Periodicidad', type: 'badge', badgeConfig: { labels: Object.fromEntries(PAYROLL_FREQUENCY_OPTIONS.map(o => [o.value, o.label])) } },
  { key: 'start_date', label: 'Desde', type: 'date' },
  { key: 'end_date', label: 'Hasta', type: 'date' },
  { key: 'employees', label: 'Empleados', type: 'text', align: 'right' },
  { key: 'net', label: 'Neto a pagar', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'cost', label: 'Costo total', type: 'currency', currency: 'MXN', align: 'right' },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: PAYROLL_STATUS_LABELS,
      colors: {
        draft: 'bg-slate-100 text-slate-600',
        calculated: 'bg-sky-100 text-sky-700',
        approved: 'bg-indigo-100 text-indigo-700',
        paid: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-red-100 text-red-700'
      }
    }
  }
]

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !isSelectedCompanyAdmin.value) return
  isLoading.value = true
  try {
    rows.value = (await getPeriods(companyId)).map(p => ({
      id: p.id,
      name: p.name,
      frequency: p.frequency,
      start_date: p.start_date,
      end_date: p.end_date,
      employees: p.employee_count,
      net: Number(p.total_net),
      cost: Number(p.total_employer_cost),
      status: p.status
    }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <HrNotice v-else-if="!isSelectedCompanyAdmin" kind="admin-only" />
    <template v-else>
      <div class="mb-4 flex justify-end">
        <BtnApp variant="secondary" size="sm" @click="navigateTo('/admin/payroll/settings')">
          Configuración fiscal
        </BtnApp>
      </div>
      <HrNotice v-if="isLoading" kind="loading" message="Cargando nóminas…" />
      <Datatable
        v-else
        title="Nómina"
        description="Periodos de pago. Cada cálculo toma salarios, asistencia, horas extra, vacaciones, faltas y ajustes del periodo."
        :data="rows"
        :columns="columns"
        :search-keys="['name']"
        :creatable="true"
        create-label="Nuevo periodo"
        export-filename="nominas"
        empty-title="Sin nóminas"
        empty-message="Revisa la configuración fiscal y crea tu primer periodo de nómina."
        @create="navigateTo('/admin/payroll/create')"
        @row-click="row => navigateTo(`/admin/payroll/${row.id}`)"
      >
        <template #actions="{ row }">
          <BtnApp variant="ghost" size="sm" title="Ver detalle" @click="navigateTo(`/admin/payroll/${row.id}`)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </template>
          </BtnApp>
        </template>
      </Datatable>
    </template>
  </div>
</template>
