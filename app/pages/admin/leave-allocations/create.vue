<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getTypes, createAllocation, lastError } = useLeave()
const { getAll: getEmployees } = useEmployee()

const form = ref({ employee_id: '', leave_type_id: '', days: '' as string | number, valid_from: '', valid_to: '', notes: '' })
const employeeOptions = ref<HrOption[]>([])
const typeOptions = ref<HrOption[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

watch(selectedCompanyId, async (companyId) => {
  if (!companyId) return
  const [employees, types] = await Promise.all([getEmployees(companyId), getTypes(companyId)])
  employeeOptions.value = employees.filter(e => e.status === 'active').map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
  typeOptions.value = types.filter(t => t.deducts_balance).map(t => ({ value: t.id, label: t.name }))
}, { immediate: true })

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  const days = toNumberOrNull(form.value.days)
  errorMessage.value = !companyId
    ? 'Selecciona una empresa.'
    : !form.value.employee_id || !form.value.leave_type_id
      ? 'Elige al empleado y el tipo de ausencia.'
      : !days
        ? 'Indica los días (negativos para restar).'
        : null
  if (errorMessage.value || !companyId || !days) return
  isSaving.value = true
  try {
    const created = await createAllocation({
      company_id: companyId,
      employee_id: form.value.employee_id,
      leave_type_id: form.value.leave_type_id,
      days,
      valid_from: form.value.valid_from || null,
      valid_to: form.value.valid_to || null,
      notes: trimToNull(form.value.notes)
    })
    if (created) router.push('/admin/leave-allocations')
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
    title="Asignación manual"
    subtitle="Días adicionales, saldos iniciales o ajustes"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/leave-allocations')"
    @save="handleSave"
    @cancel="router.push('/admin/leave-allocations')"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormSelect v-model="form.employee_id" label="Empleado" :options="employeeOptions" searchable required size="md" />
      <FormSelect
        v-model="form.leave_type_id"
        label="Tipo de ausencia"
        :options="typeOptions"
        no-results-text="No hay tipos que descuenten saldo"
        required
        size="md"
      />
      <FormInput v-model="form.days" type="number" step="0.5" label="Días" hint="Usa un número negativo para restar." required size="md" />
      <div />
      <FormInput v-model="form.valid_from" type="date" label="Vigente desde" size="md" />
      <FormInput v-model="form.valid_to" type="date" label="Vence" size="md" />
      <div class="sm:col-span-2">
        <FormTextArea v-model="form.notes" label="Notas" placeholder="Ej: Saldo inicial al migrar a Flowbit" :rows="2" size="md" />
      </div>
    </div>
  </CardSheet>
</template>
