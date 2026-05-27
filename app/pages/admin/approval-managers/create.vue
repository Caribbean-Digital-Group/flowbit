<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyApprovalManagerForm,
  type ApprovalManagerFormData
} from '~/components/ApprovalManager/Form.vue'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, companies } = storeToRefs(authStore)

const { createManager, getCandidatePartnerOptions } = useApprovalManager()
const { getSelectableCategoriesForRequests } = useApprovalCategory()

const form = ref<ApprovalManagerFormData>(createEmptyApprovalManagerForm())
const partnerOptions = ref<{ value: string; label: string; hasUser: boolean }[]>([])
const categoryOptions = ref<{ id: string; label: string }[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const isWorkspaceAdmin = computed(() => {
  const id = selectedCompanyId.value
  const r = companies.value.find(c => c.company.id === id)?.role
  return r === 'owner' || r === 'admin'
})

const roleLabels: Record<string, string> = {
  owner: 'Dueño',
  member: 'Miembro'
}

const formatCandidateLabel = (c: {
  display_name: string | null
  name: string
  email: string | null
  partner_id: string
  role: string
}): string => {
  const name = (
    (c.display_name ?? '').trim()
    || (c.name ?? '').trim()
    || c.email
    || c.partner_id
  ).trim()
  const roleLabel = roleLabels[c.role] ?? c.role
  return `${name} · ${roleLabel}`
}

const loadOptions = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !isWorkspaceAdmin.value) return

  const [candidates, cats] = await Promise.all([
    getCandidatePartnerOptions(companyId),
    getSelectableCategoriesForRequests(companyId)
  ])

  partnerOptions.value = candidates.map((p) => ({
    value: p.partner_id,
    label: formatCandidateLabel(p),
    hasUser: Boolean(p.user_id)
  }))

  categoryOptions.value = cats.map((c) => ({
    id: c.id,
    label: c.name
  }))
}

watch(selectedCompanyId, loadOptions, { immediate: true })
watch(isWorkspaceAdmin, (v) => {
  if (v) void loadOptions()
})

const handleBack = () => router.push('/admin/approval-managers')

const handleSave = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value

  if (!companyId || !isWorkspaceAdmin.value) {
    errorMessage.value = 'Sin permiso o empresa no seleccionada.'
    return
  }
  if (!form.value.partner_id) {
    errorMessage.value = 'Selecciona un miembro del equipo.'
    return
  }

  isSaving.value = true
  try {
    const row = await createManager(
      companyId,
      {
        partner_id: form.value.partner_id,
        notes: form.value.notes.trim() || null,
        active: form.value.active
      },
      [...form.value.category_ids]
    )
    if (!row) {
      errorMessage.value = 'No se pudo crear el registro. ¿Ya existe ese partner como aprobador?'
      return
    }
    router.push(`/admin/approval-managers/${row.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId || !isWorkspaceAdmin"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-4"
    >
      No disponible para tu perfil o sin empresa seleccionada.
    </div>

    <CardSheet
      v-else
      title="Nuevo aprobador"
      subtitle="Registra a un miembro activo del equipo como aprobador formal"
      :is-editing="true"
      :show-edit-button="false"
      :show-options-button="false"
      :show-footer="false"
      :is-loading="isSaving"
      @back="handleBack"
      @save="handleSave"
      @cancel="handleBack"
    >
      <p v-if="errorMessage" class="mb-4 text-sm font-medium text-red-600">
        {{ errorMessage }}
      </p>
      <ApprovalManagerForm v-model="form" :partner-options="partnerOptions" :category-options="categoryOptions" />
    </CardSheet>
  </div>
</template>
