<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { create, lastError } = useAttendance()
const { getAll: getEmployees } = useEmployee()

const form = ref({ employee_id: '', check_in: '', check_out: '', notes: '' })
const employeeOptions = ref<HrOption[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

watch(selectedCompanyId, async (companyId) => {
  if (!companyId) return
  employeeOptions.value = (await getEmployees(companyId))
    .filter(e => e.status === 'active')
    .map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
}, { immediate: true })

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  errorMessage.value = null
  if (!companyId) return
  if (!form.value.employee_id || !form.value.check_in) {
    errorMessage.value = 'Elige al empleado y la hora de entrada.'
    return
  }
  const checkIn = localDateTimeToIso(form.value.check_in)
  const checkOut = localDateTimeToIso(form.value.check_out)
  if (!checkIn) {
    errorMessage.value = 'La hora de entrada no es válida.'
    return
  }
  isSaving.value = true
  try {
    const saved = await create({
      company_id: companyId,
      employee_id: form.value.employee_id,
      check_in: checkIn,
      check_out: checkOut,
      notes: trimToNull(form.value.notes)
    })
    if (saved) router.push('/admin/attendances')
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
    title="Registrar marca manual"
    subtitle="Para correcciones o cuando el kiosco no estuvo disponible"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/attendances')"
    @save="handleSave"
    @cancel="router.push('/admin/attendances')"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <FormSelect
          v-model="form.employee_id"
          label="Empleado"
          :options="employeeOptions"
          placeholder="Selecciona un empleado"
          searchable
          required
          size="md"
        />
      </div>
      <FormInput v-model="form.check_in" type="datetime-local" label="Entrada" required size="md" />
      <FormInput v-model="form.check_out" type="datetime-local" label="Salida" hint="Déjala vacía si la persona sigue trabajando." size="md" />
      <div class="sm:col-span-2">
        <FormTextArea v-model="form.notes" label="Motivo" placeholder="Ej: El kiosco estuvo sin conexión" :rows="2" size="md" />
      </div>
    </div>
  </CardSheet>
</template>
