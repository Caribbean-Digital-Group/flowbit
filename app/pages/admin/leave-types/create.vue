<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyLeaveTypeForm, mapFormToLeaveType, type LeaveTypeFormData } from '~/components/LeaveType/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const { selectedCompanyId } = storeToRefs(useAuthStore())
const { createType, lastError } = useLeave()

const formData = ref<LeaveTypeFormData>(createEmptyLeaveTypeForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  errorMessage.value = !companyId ? 'Selecciona una empresa.' : !formData.value.name.trim() ? 'El nombre es obligatorio.' : null
  if (errorMessage.value || !companyId) return
  isSaving.value = true
  try {
    const created = await createType({ company_id: companyId, ...mapFormToLeaveType(formData.value) })
    if (created) router.push(`/admin/leave-types/${created.id}`)
    else errorMessage.value = lastError.value
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nuevo tipo de ausencia"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/leave-types')"
    @save="handleSave"
    @cancel="router.push('/admin/leave-types')"
  >
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <LeaveTypeForm v-model="formData" />
  </CardSheet>
</template>
