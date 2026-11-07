<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyLeaveRequestForm,
  validateLeaveRequestForm,
  type LeaveRequestFormData
} from '~/components/LeaveRequest/Form.vue'
import type { HrLeaveBalanceRow, HrLeaveTypeRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin, partner } = storeToRefs(authStore)
const { getTypes, getBalances, createRequest, lastError } = useLeave()
const { getAll: getEmployees, getByPartner } = useEmployee()

const formData = ref<LeaveRequestFormData>(createEmptyLeaveRequestForm())
const employeeOptions = ref<HrOption[]>([])
const types = ref<HrLeaveTypeRow[]>([])
const balances = ref<HrLeaveBalanceRow[]>([])
const isSaving = ref(false)
const noEmployeeRecord = ref(false)
const errorMessage = ref<string | null>(null)

const typeOptions = computed(() => types.value.map(t => ({ value: t.id, label: t.name })))

const balance = computed(() => {
  const type = types.value.find(t => t.id === formData.value.leave_type_id)
  if (!type?.deducts_balance) return null
  const row = balances.value.find(b => b.employee_id === formData.value.employee_id && b.leave_type_id === type.id)
  return row ? row.remaining_days : 0
})

watch(selectedCompanyId, async (companyId) => {
  if (!companyId) return
  types.value = await getTypes(companyId)
  if (isSelectedCompanyAdmin.value) {
    const employees = await getEmployees(companyId)
    employeeOptions.value = employees.filter(e => e.status === 'active').map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
  } else {
    const own = partner.value ? await getByPartner(partner.value.id, companyId) : null
    noEmployeeRecord.value = !own
    if (own) {
      employeeOptions.value = [{ value: own.id, label: own.partner_name ?? '—' }]
      formData.value.employee_id = own.id
    }
  }
  balances.value = await getBalances(companyId)
}, { immediate: true })

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  errorMessage.value = companyId ? validateLeaveRequestForm(formData.value) : 'Selecciona una empresa.'
  if (errorMessage.value || !companyId) return
  isSaving.value = true
  try {
    const created = await createRequest({
      company_id: companyId,
      employee_id: formData.value.employee_id,
      leave_type_id: formData.value.leave_type_id,
      start_date: formData.value.start_date,
      end_date: formData.value.end_date,
      half_day: formData.value.half_day,
      reason: trimToNull(formData.value.reason)
    })
    if (created) router.push(`/admin/leaves/${created.id}`)
    else errorMessage.value = lastError.value
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="noEmployeeRecord" class="w-full py-4">
    <HrNotice kind="info" message="Tu usuario no está registrado como empleado de esta empresa. Pide a un administrador que te dé de alta en Empleados para solicitar vacaciones o permisos." />
  </div>
  <CardSheet
    v-else
    title="Nueva solicitud"
    subtitle="Vacaciones o permiso"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/leaves')"
    @save="handleSave"
    @cancel="router.push('/admin/leaves')"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <LeaveRequestForm
      v-model="formData"
      :employee-options="employeeOptions"
      :type-options="typeOptions"
      :lock-employee="!isSelectedCompanyAdmin"
      :balance="balance"
    />
  </CardSheet>
</template>
