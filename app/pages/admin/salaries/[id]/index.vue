<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptySalaryForm,
  mapFormToSalary,
  mapSalaryToForm,
  validateSalaryForm,
  type SalaryFormData
} from '~/components/Salary/Form.vue'
import type { HrSalaryViewRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getById, update, archive, lastError } = useSalary()
const { getById: getEmployee } = useEmployee()

const salary = ref<HrSalaryViewRow | null>(null)
const hireDate = ref<string | null>(null)
const formData = ref<SalaryFormData>(createEmptySalaryForm())
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const salaryId = computed(() => String(route.params.id ?? ''))
const employeeOptions = computed<HrOption[]>(() =>
  salary.value ? [{ value: salary.value.employee_id, label: salary.value.employee_name ?? '—' }] : []
)

const menuOptions = computed<MenuOption[]>(() => [{
  id: 'archive',
  label: 'Anular registro',
  icon: 'M6 18L18 6M6 6l12 12',
  action: () => void handleArchive(),
  variant: 'danger'
}])

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !salaryId.value) return
  isLoading.value = true
  try {
    salary.value = await getById(salaryId.value, companyId)
    if (!salary.value) {
      errorMessage.value = 'No se encontró el registro.'
      return
    }
    formData.value = mapSalaryToForm(salary.value)
    hireDate.value = (await getEmployee(salary.value.employee_id, companyId))?.hire_date ?? null
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  errorMessage.value = validateSalaryForm(formData.value)
  if (errorMessage.value) return
  isLoading.value = true
  try {
    const saved = await update(salaryId.value, mapFormToSalary(formData.value))
    if (!saved) {
      errorMessage.value = lastError.value
      return
    }
    isEditing.value = false
    await load()
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  if (await archive(salaryId.value)) router.push('/admin/salaries')
  else errorMessage.value = lastError.value
}

watch([salaryId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <div v-if="!isSelectedCompanyAdmin" class="w-full py-4">
    <HrNotice kind="admin-only" />
  </div>
  <CardSheet
    v-else
    :title="salary?.employee_name || 'Salario'"
    :subtitle="salary ? `Vigente desde ${formatHrDate(salary.effective_date)}` : ''"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :created-by="salary?.created_by ?? '—'"
    :created-at="salary?.created_at ?? ''"
    :updated-by="salary?.updated_by ?? '—'"
    :updated-at="salary?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="router.push('/admin/salaries')"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="() => { if (salary) formData = mapSalaryToForm(salary); isEditing = false }"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <SalaryForm
      v-if="salary"
      v-model="formData"
      :readonly="!isEditing"
      :lock-employee="true"
      :employee-options="employeeOptions"
      :hire-date="hireDate"
    />
  </CardSheet>
</template>
