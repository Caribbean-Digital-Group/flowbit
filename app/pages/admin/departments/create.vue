<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyEmployeeDepartmentForm,
  type EmployeeDepartmentFormData
} from '~/components/EmployeeDepartment/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAll, create, lastError } = useEmployeeDepartment()
const { getAll: getEmployees } = useEmployee()

const formData = ref<EmployeeDepartmentFormData>(createEmptyEmployeeDepartmentForm())
const parentOptions = ref<EmployeeOption[]>([])
const managerOptions = ref<EmployeeOption[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const loadOptions = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const [departments, employees] = await Promise.all([getAll(companyId), getEmployees(companyId)])
  parentOptions.value = departments.map(d => ({ value: d.id, label: d.name }))
  managerOptions.value = employees.map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
}

watch(selectedCompanyId, loadOptions, { immediate: true })

const handleBack = () => {
  router.push('/admin/departments')
}

const handleSave = async () => {
  errorMessage.value = null

  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa antes de crear un departamento.'
    return
  }
  if (!formData.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }

  isSaving.value = true
  try {
    const department = await create({
      company_id: companyId,
      name: formData.value.name.trim(),
      parent_id: formData.value.parent_id || null,
      manager_id: formData.value.manager_id || null
    })
    if (department) {
      router.push(`/admin/departments/${department.id}`)
    } else {
      errorMessage.value = lastError.value
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nuevo Departamento"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleBack"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <EmployeeDepartmentForm
      v-model="formData"
      :parent-options="parentOptions"
      :manager-options="managerOptions"
    />
  </CardSheet>
</template>
