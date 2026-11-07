<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

const columns: Column[] = [
  { key: 'name', label: 'Departamento', type: 'text' },
  { key: 'parent', label: 'Departamento padre', type: 'text' },
  { key: 'manager', label: 'Responsable', type: 'text' },
  { key: 'employees', label: 'Empleados', type: 'text' }
]

const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getAll } = useEmployeeDepartment()
const { getAll: getEmployees } = useEmployee()

const departments = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    departments.value = []
    return
  }
  isLoading.value = true
  try {
    const [rows, employees] = await Promise.all([getAll(companyId), getEmployees(companyId)])
    const names = new Map(rows.map(d => [d.id, d.name]))
    const managers = new Map(employees.map(e => [e.id, e.partner_name]))
    departments.value = rows.map(d => ({
      id: d.id,
      name: d.name,
      parent: (d.parent_id && names.get(d.parent_id)) || '—',
      manager: (d.manager_id && managers.get(d.manager_id)) || '—',
      employees: employees.filter(e => e.department_id === d.id && e.status === 'active').length
    }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const open = (row: Record<string, unknown>) => {
  navigateTo(`/admin/departments/${row.id as string}`)
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
        Elige una empresa en el selector del panel superior para ver sus departamentos.
      </p>
    </div>

    <div
      v-else-if="isLoading"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando departamentos…
    </div>

    <Datatable
      v-else
      title="Departamentos"
      description="Estructura organizacional de la empresa"
      :data="departments"
      :columns="columns"
      :search-keys="['name', 'parent', 'manager']"
      :creatable="isSelectedCompanyAdmin"
      create-label="Nuevo Departamento"
      empty-title="Sin departamentos"
      empty-message="Crea el primer departamento de la empresa."
      @create="navigateTo('/admin/departments/create')"
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
