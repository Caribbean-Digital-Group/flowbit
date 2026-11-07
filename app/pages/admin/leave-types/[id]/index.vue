<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyLeaveTypeForm,
  mapFormToLeaveType,
  mapLeaveTypeToForm,
  type LeaveTypeFormData
} from '~/components/LeaveType/Form.vue'
import type { HrLeaveTypeRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getType, updateType, archiveType, lastError } = useLeave()

const leaveType = ref<HrLeaveTypeRow | null>(null)
const formData = ref<LeaveTypeFormData>(createEmptyLeaveTypeForm())
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const typeId = computed(() => String(route.params.id ?? ''))

const menuOptions = computed<MenuOption[]>(() => [{
  id: 'archive',
  label: 'Archivar tipo',
  icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  action: () => void handleArchive(),
  variant: 'warning'
}])

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !typeId.value) return
  isLoading.value = true
  try {
    leaveType.value = await getType(typeId.value, companyId)
    if (leaveType.value) formData.value = mapLeaveTypeToForm(leaveType.value)
    else errorMessage.value = 'No se encontró el tipo de ausencia.'
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  if (!formData.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }
  isLoading.value = true
  try {
    const saved = await updateType(typeId.value, mapFormToLeaveType(formData.value))
    if (!saved) {
      errorMessage.value = lastError.value
      return
    }
    errorMessage.value = null
    isEditing.value = false
    await load()
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  if (await archiveType(typeId.value)) router.push('/admin/leave-types')
  else errorMessage.value = lastError.value
}

watch([typeId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <CardSheet
    :title="leaveType?.name || 'Tipo de ausencia'"
    :subtitle="leaveType ? LEAVE_KIND_LABELS[leaveType.kind] : ''"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-edit-button="isSelectedCompanyAdmin"
    :show-options-button="isSelectedCompanyAdmin"
    :created-by="leaveType?.created_by ?? '—'"
    :created-at="leaveType?.created_at ?? ''"
    :updated-by="leaveType?.updated_by ?? '—'"
    :updated-at="leaveType?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="router.push('/admin/leave-types')"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="() => { if (leaveType) formData = mapLeaveTypeToForm(leaveType); isEditing = false }"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <LeaveTypeForm v-if="leaveType" v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
