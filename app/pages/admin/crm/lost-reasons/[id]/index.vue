<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyCrmLostReasonForm,
  type CrmLostReasonFormData
} from '~/components/CrmLostReason/Form.vue'
import type { CrmLostReasonRow } from '~/types/crm.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getLostReasonById, updateLostReason, archiveLostReason, getLostReasonUsage } = useCrmLostReason()

const reasonId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const usageCount = ref(0)

const reason = ref<CrmLostReasonRow | null>(null)
const formData = ref<CrmLostReasonFormData>(createEmptyCrmLostReasonForm())
const initialForm = ref<CrmLostReasonFormData>(createEmptyCrmLostReasonForm())

const mapToForm = (r: CrmLostReasonRow): CrmLostReasonFormData => ({
  name: r.name,
  sequence: r.sequence,
  description: r.description ?? ''
})

const loadReason = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !reasonId.value) return

  isLoading.value = true
  try {
    const [row, usage] = await Promise.all([
      getLostReasonById(reasonId.value, companyId),
      getLostReasonUsage(companyId)
    ])
    if (!row) { router.push('/admin/crm/lost-reasons'); return }
    reason.value = row
    usageCount.value = usage[row.id] ?? 0
    formData.value = mapToForm(row)
    initialForm.value = mapToForm(row)
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, reasonId], () => { void loadReason() }, { immediate: true })

const handleEdit = () => { isEditing.value = true }
const handleCancel = () => { formData.value = { ...initialForm.value }; isEditing.value = false; errorMessage.value = null }
const handleBack = () => router.push('/admin/crm/lost-reasons')

const handleSave = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value
  if (!companyId || !reasonId.value) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }

  isLoading.value = true
  try {
    const updated = await updateLostReason(reasonId.value, companyId, {
      name: formData.value.name.trim(),
      sequence: Number(formData.value.sequence) || 10,
      description: formData.value.description.trim() || null
    })
    if (!updated) { errorMessage.value = 'No se pudo guardar el motivo. Verifica que el nombre no esté duplicado.'; return }
    reason.value = updated
    formData.value = mapToForm(updated)
    initialForm.value = mapToForm(updated)
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'archive',
    label: 'Archivar motivo',
    variant: 'danger',
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    action: async () => {
      const companyId = selectedCompanyId.value
      if (!reasonId.value || !companyId) return
      const ok = await archiveLostReason(reasonId.value, companyId)
      if (ok) router.push('/admin/crm/lost-reasons')
      else errorMessage.value = 'No se pudo archivar el motivo.'
    }
  }
])
</script>

<template>
  <CardSheet
    :title="reason?.name ?? 'Motivo de pérdida'"
    subtitle="Motivo de pérdida de oportunidades"
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
      <BadgeApp :variant="usageCount > 0 ? 'danger' : 'secondary'" :label="`${usageCount} lead(s) perdidos`" />
    </template>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <p
      v-if="!isEditing && usageCount > 0"
      class="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
    >
      Archivar el motivo no altera los leads que ya lo usan; solo deja de ofrecerse al cerrar nuevas oportunidades.
    </p>

    <CrmLostReasonForm v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
