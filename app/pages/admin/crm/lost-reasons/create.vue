<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyCrmLostReasonForm,
  type CrmLostReasonFormData
} from '~/components/CrmLostReason/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { createLostReason } = useCrmLostReason()

const formData = ref<CrmLostReasonFormData>(createEmptyCrmLostReasonForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => router.push('/admin/crm/lost-reasons')

const handleSave = async () => {
  errorMessage.value = null

  const companyId = selectedCompanyId.value
  if (!companyId) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre del motivo es obligatorio.'; return }

  isSaving.value = true
  try {
    const created = await createLostReason(companyId, {
      name: formData.value.name.trim(),
      sequence: Number(formData.value.sequence) || 10,
      description: formData.value.description.trim() || null
    })
    if (!created) { errorMessage.value = 'No se pudo crear el motivo. Verifica que el nombre no esté duplicado.'; return }
    router.push('/admin/crm/lost-reasons')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nuevo motivo de pérdida"
    subtitle="Define una razón por la que una oportunidad puede cerrarse como perdida"
    :is-editing="true"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    :is-loading="isSaving"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleBack"
  >
    <div
      v-if="!selectedCompanyId"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para registrar motivos de pérdida.</p>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <CrmLostReasonForm v-model="formData" />
  </CardSheet>
</template>
