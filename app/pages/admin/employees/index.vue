<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { EmployeeViewRow } from '~/types/employee.types'

definePageMeta({ layout: 'admin' })

const columns: Column[] = [
  { key: 'name', label: 'Empleado', type: 'avatar', subtitleKey: 'email', avatarKey: 'avatar_url' },
  { key: 'employee_number', label: 'Número', type: 'text' },
  { key: 'job_title', label: 'Puesto', type: 'text' },
  { key: 'department', label: 'Departamento', type: 'text' },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge',
    badgeConfig: { labels: { active: 'Activo', terminated: 'Baja' } }
  },
  { key: 'hire_date', label: 'Ingreso', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getAll } = useEmployee()

const employees = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const mapRow = (raw: EmployeeViewRow): Record<string, unknown> => ({
  id: raw.id,
  name: raw.partner_name ?? '—',
  email: raw.work_email ?? raw.partner_email ?? '',
  avatar_url: raw.partner_avatar_url ?? '',
  employee_number: raw.employee_number ?? '—',
  job_title: raw.job_title ?? '—',
  department: raw.department_name ?? '—',
  status: raw.status,
  hire_date: raw.hire_date ?? ''
})

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    employees.value = []
    return
  }
  isLoading.value = true
  try {
    employees.value = (await getAll(companyId)).map(mapRow)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const open = (row: Record<string, unknown>) => {
  navigateTo(`/admin/employees/${row.id as string}`)
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el selector del panel superior para ver sus empleados.
      </p>
    </div>

    <div
      v-else-if="isLoading"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando empleados…
    </div>

    <Datatable
      v-else
      title="Empleados"
      description="Contactos marcados como empleados de la empresa seleccionada"
      :data="employees"
      :columns="columns"
      :search-keys="['name', 'email', 'employee_number', 'job_title', 'department']"
      :exportable="true"
      :creatable="isSelectedCompanyAdmin"
      create-label="Nuevo Empleado"
      export-filename="empleados"
      empty-title="Sin empleados"
      empty-message="Marca un contacto como empleado o crea uno nuevo."
      @create="navigateTo('/admin/employees/create')"
    >
      <template #actions="{ row }">
        <div class="flex items-center justify-center">
          <BtnApp variant="ghost" size="sm" @click="open(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </template>
          </BtnApp>
        </div>
      </template>
    </Datatable>
  </div>
</template>
