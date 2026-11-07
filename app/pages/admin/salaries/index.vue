<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getAll } = useSalary()

const employeeFilter = computed(() => typeof route.query.employee === 'string' ? route.query.employee : undefined)
const rows = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const columns: Column[] = [
  { key: 'employee', label: 'Empleado', type: 'text' },
  { key: 'job_title', label: 'Puesto', type: 'text' },
  { key: 'effective_date', label: 'Vigente desde', type: 'date' },
  { key: 'monthly', label: 'Mensual', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'daily', label: 'Diario', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'sbc', label: 'SBC', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'reason', label: 'Motivo', type: 'badge', badgeConfig: { labels: SALARY_REASON_LABELS } },
  {
    key: 'state',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: { current: 'Vigente', past: 'Anterior', future: 'Programado' },
      colors: { current: 'bg-emerald-100 text-emerald-700', past: 'bg-slate-100 text-slate-600', future: 'bg-sky-100 text-sky-700' }
    }
  }
]

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !isSelectedCompanyAdmin.value) return
  isLoading.value = true
  try {
    const salaries = await getAll(companyId, employeeFilter.value)
    const today = todayIn()
    const currentIds = new Set<string>()
    const seen = new Set<string>()
    for (const s of salaries) {
      if (s.effective_date <= today && !seen.has(s.employee_id)) {
        seen.add(s.employee_id)
        currentIds.add(s.id)
      }
    }
    rows.value = salaries.map(s => ({
      id: s.id,
      employee: s.employee_name ?? '—',
      job_title: s.job_title ?? '—',
      effective_date: s.effective_date,
      monthly: Number(s.monthly_salary),
      daily: Number(s.daily_salary),
      sbc: s.contribution_base === null ? 0 : Number(s.contribution_base),
      reason: s.reason,
      state: currentIds.has(s.id) ? 'current' : s.effective_date > today ? 'future' : 'past'
    }))
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, employeeFilter], load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <HrNotice v-else-if="!isSelectedCompanyAdmin" kind="admin-only" />
    <HrNotice v-else-if="isLoading" kind="loading" message="Cargando salarios…" />
    <Datatable
      v-else
      title="Salarios"
      description="Historial de sueldos. El vigente se copia al expediente del empleado y es el que usa la nómina."
      :data="rows"
      :columns="columns"
      :search-keys="['employee', 'job_title']"
      :creatable="true"
      create-label="Registrar salario"
      export-filename="salarios"
      empty-title="Sin salarios"
      empty-message="Registra el sueldo de cada empleado para poder calcular su nómina."
      @create="navigateTo(employeeFilter ? `/admin/salaries/create?employee=${employeeFilter}` : '/admin/salaries/create')"
      @row-click="row => navigateTo(`/admin/salaries/${row.id}`)"
    />
  </div>
</template>
