<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyWorkScheduleForm,
  mapFormToSchedule,
  mapFormToScheduleLines,
  validateWorkScheduleForm,
  type WorkScheduleFormData
} from '~/components/WorkSchedule/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const { selectedCompanyId } = storeToRefs(useAuthStore())
const { save, lastError } = useWorkSchedule()

const formData = ref<WorkScheduleFormData>(createEmptyWorkScheduleForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  errorMessage.value = companyId ? validateWorkScheduleForm(formData.value) : 'Selecciona una empresa.'
  if (errorMessage.value || !companyId) return

  isSaving.value = true
  try {
    const schedule = await save(companyId, null, mapFormToSchedule(formData.value), mapFormToScheduleLines(formData.value))
    if (schedule) router.push(`/admin/work-schedules/${schedule.id}`)
    else errorMessage.value = lastError.value
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nuevo horario"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/work-schedules')"
    @save="handleSave"
    @cancel="router.push('/admin/work-schedules')"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <WorkScheduleForm v-model="formData" />
  </CardSheet>
</template>
