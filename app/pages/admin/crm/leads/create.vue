<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyCrmLeadForm,
  type CrmLeadFormData
} from '~/components/CrmLead/Form.vue'
import type { TablesInsert } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { createLead } = useCrmLead()
const { getStagesByCompany } = useCrmStage()
const { getPartnersByCompany } = usePartner()
const { getCompanyMembers } = useMembership()

const formData = ref<CrmLeadFormData>(createEmptyCrmLeadForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const stageOptions = ref<{ value: string; label: string }[]>([])
const partnerOptions = ref<{ value: string; label: string }[]>([])
const memberOptions = ref<{ value: string; label: string }[]>([])

const loadOptions = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return

  const [stages, partners, members] = await Promise.all([
    getStagesByCompany(companyId),
    getPartnersByCompany(companyId),
    getCompanyMembers(companyId, 'team')
  ])

  stageOptions.value = stages.map(s => ({ value: s.id, label: s.name }))
  partnerOptions.value = partners.map(p => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))
  memberOptions.value = members
    .filter(m => m.is_active && m.partner_user_id)
    .map(m => ({
      value: m.partner_id,
      label: (m.partner_display_name?.trim() || m.partner_name)?.trim() || m.partner_id
    }))

  if (stageOptions.value.length > 0 && !formData.value.stage_id) {
    formData.value.stage_id = stageOptions.value[0]?.value ?? ''
  }
}

watch(selectedCompanyId, () => { void loadOptions() }, { immediate: true })

const mapFormToInsert = (
  value: CrmLeadFormData
): Omit<TablesInsert<'crm_lead'>, 'company_id'> => ({
  name: value.name.trim(),
  stage_id: value.stage_id,
  partner_id: value.partner_id || null,
  contact_name: value.contact_name.trim() || null,
  contact_email: value.contact_email.trim() || null,
  contact_phone: value.contact_phone.trim() || null,
  contact_company: value.contact_company.trim() || null,
  origin: value.origin,
  responsible_partner_id: value.responsible_partner_id || null,
  expected_close_date: value.expected_close_date || null,
  amount: Number(value.amount) || null,
  currency: value.currency || 'MXN',
  probability: Number(value.probability) || 0,
  description: value.description.trim() || null,
  priority: value.priority,
  tags: value.tags ? value.tags.split(',').map(t => t.trim()).filter(Boolean) : []
})

const handleBack = () => router.push('/admin/crm/leads')

const handleSave = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value
  if (!companyId) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El título del lead es obligatorio.'; return }
  if (!formData.value.stage_id) { errorMessage.value = 'Selecciona una etapa del pipeline.'; return }

  isSaving.value = true
  try {
    const lead = await createLead(companyId, mapFormToInsert(formData.value))
    if (!lead) { errorMessage.value = 'No se pudo crear el lead. Verifica tus permisos.'; return }
    router.push(`/admin/crm/leads/${lead.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/crm/leads')
</script>

<template>
  <CardSheet
    title="Nuevo Lead / Oportunidad"
    subtitle="Registra un prospecto o cliente potencial en el pipeline de ventas"
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
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para registrar nuevos leads.</p>
    </div>

    <div
      v-if="stageOptions.length === 0 && selectedCompanyId && !isSaving"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin etapas configuradas</p>
      <p class="mt-1 text-sm text-amber-800/90">
        Debes configurar las etapas del pipeline antes de registrar leads.
        <NuxtLink to="/admin/crm/stages" class="underline font-medium">Ir a Etapas del Pipeline</NuxtLink>
      </p>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <CrmLeadForm
      v-model="formData"
      :stage-options="stageOptions"
      :partner-options="partnerOptions"
      :responsible-options="memberOptions"
    />
  </CardSheet>
</template>
