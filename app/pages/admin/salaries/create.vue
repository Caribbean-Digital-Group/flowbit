<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptySalaryForm,
  mapFormToSalary,
  validateSalaryForm,
  type SalaryFormData
} from '~/components/Salary/Form.vue'
import type { EmployeeViewRow } from '~/types/employee.types'
import type { PayrollFiscalConfigRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { create, lastError } = useSalary()
const { getAll: getEmployees } = useEmployee()
const { getConfig } = usePayroll()

const formData = ref<SalaryFormData>(createEmptySalaryForm(typeof route.query.employee === 'string' ? route.query.employee : ''))
const employees = ref<EmployeeViewRow[]>([])
const config = ref<PayrollFiscalConfigRow | null>(null)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const employeeOptions = computed(() => employees.value.map(e => ({ value: e.id, label: e.partner_name ?? '—' })))
const hireDate = computed(() => employees.value.find(e => e.id === formData.value.employee_id)?.hire_date ?? null)

watch(selectedCompanyId, async (companyId) => {
  if (!companyId) return
  const [e, c] = await Promise.all([getEmployees(companyId), getConfig(companyId, new Date().getFullYear())])
  employees.value = e.filter(x => x.status === 'active')
  config.value = c
}, { immediate: true })

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  errorMessage.value = companyId ? validateSalaryForm(formData.value) : 'Selecciona una empresa.'
  if (errorMessage.value || !companyId) return
  isSaving.value = true
  try {
    const created = await create({ company_id: companyId, employee_id: formData.value.employee_id, ...mapFormToSalary(formData.value) })
    if (created) router.push(`/admin/salaries?employee=${created.employee_id}`)
    else errorMessage.value = lastError.value
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="!isSelectedCompanyAdmin" class="w-full py-4">
    <HrNotice kind="admin-only" />
  </div>
  <CardSheet
    v-else
    title="Registrar salario"
    subtitle="Contratación, aumento o ajuste"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/salaries')"
    @save="handleSave"
    @cancel="router.push('/admin/salaries')"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <SalaryForm
      v-model="formData"
      :employee-options="employeeOptions"
      :hire-date="hireDate"
      :minimum-wage="config ? Number(config.use_border_zone ? config.minimum_wage_border_daily : config.minimum_wage_daily) : 315.04"
      :aguinaldo-days="config?.aguinaldo_days ?? 15"
      :vacation-premium-rate="config ? Number(config.vacation_premium_rate) : 25"
    />
  </CardSheet>
</template>
