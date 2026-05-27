<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyCrmStageForm,
  type CrmStageFormData
} from '~/components/CrmStage/Form.vue'
import type { Tables, TablesUpdate } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

type CrmLeadStage = Tables<'crm_lead_stage'>

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getStageById, updateStage, archiveStage } = useCrmStage()

const stageId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const stageData = ref<CrmLeadStage | null>(null)
const formData = ref<CrmStageFormData>(createEmptyCrmStageForm())
const initialForm = ref<CrmStageFormData>(createEmptyCrmStageForm())

const stageTypeLabel = computed(() => {
  if (!stageData.value) return 'Normal'
  if (stageData.value.is_won) return 'Cierre ganado'
  if (stageData.value.is_lost) return 'Cierre cancelado'
  return 'Normal'
})

const stageTypeVariant = computed(() => {
  if (stageData.value?.is_won) return 'success' as const
  if (stageData.value?.is_lost) return 'danger' as const
  return 'secondary' as const
})

const mapToForm = (s: CrmLeadStage): CrmStageFormData => ({
  name: s.name,
  sequence: s.sequence,
  description: s.description ?? '',
  is_won: s.is_won,
  is_lost: s.is_lost
})

const mapFormToUpdate = (value: CrmStageFormData): TablesUpdate<'crm_lead_stage'> => ({
  name: value.name.trim(),
  sequence: Number(value.sequence) || 10,
  description: value.description.trim() || null,
  is_won: value.is_won,
  is_lost: value.is_lost
})

const loadStage = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !stageId.value) return

  isLoading.value = true
  try {
    const stage = await getStageById(stageId.value, companyId)
    if (!stage) { router.push('/admin/crm/stages'); return }
    stageData.value = stage
    formData.value = mapToForm(stage)
    initialForm.value = mapToForm(stage)
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, stageId], () => { void loadStage() }, { immediate: true })

const handleEdit = () => { isEditing.value = true }
const handleCancel = () => { formData.value = { ...initialForm.value }; isEditing.value = false }
const handleBack = () => router.push('/admin/crm/stages')

const handleSave = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value
  if (!companyId || !stageId.value) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }

  isLoading.value = true
  try {
    const updated = await updateStage(stageId.value, companyId, mapFormToUpdate(formData.value))
    if (!updated) { errorMessage.value = 'No se pudo guardar la etapa.'; return }
    stageData.value = updated
    formData.value = mapToForm(updated)
    initialForm.value = mapToForm(updated)
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const menuOptions = computed<MenuOption[]>(() => [
  {
    label: 'Archivar etapa',
    variant: 'danger',
    iconPath: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    action: async () => {
      if (!stageId.value) return
      await archiveStage(stageId.value)
      router.push('/admin/crm/stages')
    }
  }
])
</script>

<template>
  <CardSheet
    :title="stageData?.name ?? 'Etapa'"
    subtitle="Etapa del pipeline de ventas"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-footer="false"
    :menu-options="menuOptions"
    @back="handleBack"
    @edit="handleEdit"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <template #status>
      <BadgeApp :variant="stageTypeVariant" :label="stageTypeLabel" />
    </template>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <CrmStageForm v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
