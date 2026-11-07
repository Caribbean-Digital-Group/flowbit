<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyEmployeeDepartmentForm,
  mapEmployeeDepartmentToForm,
  type EmployeeDepartmentFormData
} from '~/components/EmployeeDepartment/Form.vue'
import type { EmployeeDepartmentRow } from '~/types/employee.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getAll, getById, update, archive, lastError } = useEmployeeDepartment()
const { getAll: getEmployees } = useEmployee()

const department = ref<EmployeeDepartmentRow | null>(null)
const formData = ref<EmployeeDepartmentFormData>(createEmptyEmployeeDepartmentForm())
const parentOptions = ref<EmployeeOption[]>([])
const managerOptions = ref<EmployeeOption[]>([])
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const departmentId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'warning'
  }
])

const load = async () => {
  const id = departmentId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const [row, departments, employees] = await Promise.all([
      getById(id, companyId),
      getAll(companyId),
      getEmployees(companyId)
    ])
    if (!row) {
      errorMessage.value = 'No se encontró el departamento solicitado o no tienes acceso.'
      return
    }
    department.value = row
    formData.value = mapEmployeeDepartmentToForm(row)
    parentOptions.value = departments
      .filter(d => d.id !== id)
      .map(d => ({ value: d.id, label: d.name }))
    managerOptions.value = employees.map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
  } finally {
    isLoading.value = false
  }
}

const handleBack = () => {
  router.push('/admin/departments')
}

const handleCancel = () => {
  if (department.value) formData.value = mapEmployeeDepartmentToForm(department.value)
  isEditing.value = false
  errorMessage.value = null
}

const handleSave = async () => {
  const id = departmentId.value
  if (!id) return

  if (!formData.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }

  isLoading.value = true
  errorMessage.value = null
  try {
    const saved = await update(id, {
      name: formData.value.name.trim(),
      parent_id: formData.value.parent_id || null,
      manager_id: formData.value.manager_id || null
    })
    if (!saved) {
      errorMessage.value = lastError.value
      return
    }
    department.value = saved
    formData.value = mapEmployeeDepartmentToForm(saved)
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = departmentId.value
  if (!id) return

  isLoading.value = true
  errorMessage.value = null
  try {
    if (await archive(id)) {
      router.push('/admin/departments')
    } else {
      errorMessage.value = lastError.value
    }
  } finally {
    isLoading.value = false
  }
}

watch([departmentId, selectedCompanyId], () => {
  isEditing.value = false
  void load()
}, { immediate: true })
</script>

<template>
  <CardSheet
    :title="department?.name || 'Departamento'"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-edit-button="isSelectedCompanyAdmin"
    :show-options-button="isSelectedCompanyAdmin"
    :created-by="department?.created_by ?? '—'"
    :created-at="department?.created_at ?? ''"
    :updated-by="department?.updated_by ?? '—'"
    :updated-at="department?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="handleBack"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <EmployeeDepartmentForm
      v-model="formData"
      :readonly="!isEditing"
      :parent-options="parentOptions"
      :manager-options="managerOptions"
    />
  </CardSheet>
</template>
