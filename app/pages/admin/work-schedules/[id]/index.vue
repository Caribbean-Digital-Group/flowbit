<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyWorkScheduleForm,
  mapFormToSchedule,
  mapFormToScheduleLines,
  mapWorkScheduleToForm,
  validateWorkScheduleForm,
  type WorkScheduleFormData
} from '~/components/WorkSchedule/Form.vue'
import type { WorkScheduleWithLines } from '~/composables/useWorkSchedule'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getById, save, archive, lastError } = useWorkSchedule()

const schedule = ref<WorkScheduleWithLines | null>(null)
const formData = ref<WorkScheduleFormData>(createEmptyWorkScheduleForm())
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const scheduleId = computed(() => String(route.params.id ?? ''))

const menuOptions = computed<MenuOption[]>(() => [{
  id: 'archive',
  label: 'Archivar horario',
  icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  action: () => void handleArchive(),
  variant: 'warning'
}])

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !scheduleId.value) return
  isLoading.value = true
  try {
    schedule.value = await getById(scheduleId.value, companyId)
    if (schedule.value) formData.value = mapWorkScheduleToForm(schedule.value)
    else errorMessage.value = 'No se encontró el horario.'
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  errorMessage.value = validateWorkScheduleForm(formData.value)
  if (errorMessage.value || !companyId) return
  isLoading.value = true
  try {
    const saved = await save(companyId, scheduleId.value, mapFormToSchedule(formData.value), mapFormToScheduleLines(formData.value))
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

const handleCancel = () => {
  if (schedule.value) formData.value = mapWorkScheduleToForm(schedule.value)
  isEditing.value = false
  errorMessage.value = null
}

const handleArchive = async () => {
  if (await archive(scheduleId.value)) router.push('/admin/work-schedules')
  else errorMessage.value = lastError.value
}

watch([scheduleId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <CardSheet
    :title="schedule?.name || 'Horario'"
    :subtitle="schedule?.description ?? ''"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-edit-button="isSelectedCompanyAdmin"
    :show-options-button="isSelectedCompanyAdmin"
    :created-by="schedule?.created_by ?? '—'"
    :created-at="schedule?.created_at ?? ''"
    :updated-by="schedule?.updated_by ?? '—'"
    :updated-at="schedule?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="router.push('/admin/work-schedules')"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <WorkScheduleForm v-if="schedule" v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
