<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyCrmStageForm,
  type CrmStageFormData
} from '~/components/CrmStage/Form.vue'
import type { TablesInsert } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { createStage } = useCrmStage()

const formData = ref<CrmStageFormData>(createEmptyCrmStageForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const mapFormToInsert = (
  value: CrmStageFormData
): Omit<TablesInsert<'crm_lead_stage'>, 'company_id'> => ({
  name: value.name.trim(),
  sequence: Number(value.sequence) || 10,
  description: value.description.trim() || null,
  is_won: value.is_won,
  is_lost: value.is_lost
})

const handleBack = () => router.push('/admin/crm/stages')

const handleSave = async () => {
  errorMessage.value = null

  const companyId = selectedCompanyId.value
  if (!companyId) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre de la etapa es obligatorio.'; return }

  isSaving.value = true
  try {
    const stage = await createStage(companyId, mapFormToInsert(formData.value))
    if (!stage) { errorMessage.value = 'No se pudo crear la etapa. Verifica que el nombre no esté duplicado.'; return }
    router.push(`/admin/crm/stages/${stage.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/crm/stages')
</script>

<template>
  <CardSheet
    title="Nueva Etapa del Pipeline"
    subtitle="Define una fase del proceso de ventas para clasificar leads"
    :is-editing="true"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    :is-loading="isSaving"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="!selectedCompanyId"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para registrar etapas del pipeline.</p>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <CrmStageForm v-model="formData" />
  </CardSheet>
</template>
