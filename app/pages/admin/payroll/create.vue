<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { PayrollFrequency } from '~/utils/payroll'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getPeriods, createPeriod, lastError } = usePayroll()
const { get: getSettings } = useHrSettings()

const form = ref({
  name: '',
  frequency: 'biweekly' as PayrollFrequency,
  start_date: '',
  end_date: '',
  payment_date: '',
  notes: ''
})
const nameTouched = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const frequencyLabel = (f: PayrollFrequency) => PAYROLL_FREQUENCY_OPTIONS.find(o => o.value === f)?.label ?? ''

const suggestedName = computed(() => {
  if (!form.value.start_date || !form.value.end_date) return ''
  return `Nómina ${frequencyLabel(form.value.frequency).toLowerCase()} ${formatHrDate(form.value.start_date)} – ${formatHrDate(form.value.end_date)}`
})

watch(suggestedName, (name) => {
  if (!nameTouched.value) form.value.name = name
})

/** Propone el periodo siguiente al último de la misma periodicidad, o el actual. */
const suggestRange = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const last = (await getPeriods(companyId)).find(p => p.frequency === form.value.frequency && p.status !== 'cancelled')
  if (last) {
    const range = nextPeriodRange(form.value.frequency, last.end_date)
    form.value.start_date = range.start
    form.value.end_date = range.end
  } else {
    const today = todayIn()
    const start = form.value.frequency === 'weekly'
      ? addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
      : form.value.frequency === 'biweekly' && Number(today.slice(8)) > 15 ? `${today.slice(0, 8)}16` : firstDayOfMonth(today)
    const range = nextPeriodRange(form.value.frequency, addDays(start, -1))
    form.value.start_date = range.start
    form.value.end_date = range.end
  }
  form.value.payment_date = form.value.end_date
}

watch(selectedCompanyId, async (companyId) => {
  if (!companyId) return
  const settings = await getSettings(companyId)
  if (settings) form.value.frequency = settings.payroll_frequency
  await suggestRange()
}, { immediate: true })

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  errorMessage.value = !companyId
    ? 'Selecciona una empresa.'
    : !form.value.start_date || !form.value.end_date
      ? 'Indica las fechas del periodo.'
      : form.value.end_date < form.value.start_date
        ? 'La fecha final no puede ser anterior a la inicial.'
        : !form.value.name.trim() ? 'Indica el nombre del periodo.' : null
  if (errorMessage.value || !companyId) return
  isSaving.value = true
  try {
    const created = await createPeriod({
      company_id: companyId,
      name: form.value.name.trim(),
      frequency: form.value.frequency,
      start_date: form.value.start_date,
      end_date: form.value.end_date,
      payment_date: form.value.payment_date || null,
      fiscal_year: Number(form.value.end_date.slice(0, 4)),
      notes: trimToNull(form.value.notes)
    })
    if (created) router.push(`/admin/payroll/${created.id}`)
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
    title="Nuevo periodo de nómina"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/payroll')"
    @save="handleSave"
    @cancel="router.push('/admin/payroll')"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormSelect
        v-model="form.frequency"
        label="Periodicidad"
        :options="PAYROLL_FREQUENCY_OPTIONS"
        size="md"
        @change="suggestRange"
      />
      <FormInput v-model="form.payment_date" type="date" label="Fecha de pago" size="md" />
      <FormInput v-model="form.start_date" type="date" label="Desde" required size="md" />
      <FormInput v-model="form.end_date" type="date" label="Hasta" required size="md" />
      <div class="sm:col-span-2">
        <FormInput
          v-model="form.name"
          label="Nombre"
          required
          size="md"
          @update:model-value="nameTouched = true"
        />
      </div>
      <div class="sm:col-span-2">
        <FormTextArea v-model="form.notes" label="Notas" :rows="2" size="md" />
      </div>
    </div>
  </CardSheet>
</template>
