<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  approvalCategoryFormToPayload,
  createEmptyApprovalCategoryForm,
  type ApprovalCategoryFormData
} from '~/components/ApprovalCategory/Form.vue'
import type { ApprovalCategoryInsert } from '~/types/approval.types'
import { fieldSchemaIssues } from '~/utils/approvals'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, companies } = storeToRefs(authStore)

const { createCategory, lastError } = useApprovalCategory()
const { getFlows } = useApprovalFlow()
const { getSettings } = useApprovalSettings()
const flowOptions = ref<{ value: string; label: string }[]>([])
const advanced = ref(false)

watch(selectedCompanyId, async (cid) => {
  if (!cid) return
  const [flows, settings] = await Promise.all([getFlows(cid), getSettings(cid)])
  flowOptions.value = flows.map(f => ({ value: f.id, label: f.name }))
  advanced.value = settings.advanced_enabled
}, { immediate: true })

const form = ref<ApprovalCategoryFormData>(createEmptyApprovalCategoryForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const isWorkspaceAdmin = computed(() => {
  const id = selectedCompanyId.value
  const r = companies.value.find(c => c.company.id === id)?.role
  return r === 'owner' || r === 'admin'
})

const slugifyInternalCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')

const mapToInsert = (v: ApprovalCategoryFormData): Omit<ApprovalCategoryInsert, 'company_id'> => ({
  ...approvalCategoryFormToPayload(v),
  name: v.name.trim(),
  internal_code: slugifyInternalCode(v.internal_code),
  archived: false
})

const handleBack = () => router.push('/admin/approval-categories')

const handleSave = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa.'
    return
  }
  if (!isWorkspaceAdmin.value) {
    errorMessage.value = 'No tienes permisos para crear categorías.'
    return
  }
  if (!form.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }
  if (!form.value.internal_code.trim()) {
    errorMessage.value = 'El código interno es obligatorio.'
    return
  }

  const issues = fieldSchemaIssues(form.value.field_schema)
  if (issues.length) {
    errorMessage.value = issues[0] ?? null
    return
  }

  isSaving.value = true
  try {
    const row = await createCategory(companyId, mapToInsert(form.value))
    if (!row) {
      errorMessage.value = lastError.value ?? 'No se pudo crear la categoría. Verifica que el código interno sea único.'
      return
    }
    router.push(`/admin/approval-categories/${row.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
    </div>

    <div
      v-else-if="!isWorkspaceAdmin"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-700"
    >
      No tienes permisos para crear categorías.
    </div>

    <CardSheet
      v-else
      title="Nueva categoría"
      subtitle="Las categorías permiten clasificar cada solicitud de aprobación"
      :is-editing="true"
      :show-edit-button="false"
      :show-options-button="false"
      :show-footer="false"
      :is-loading="isSaving"
      @back="handleBack"
      @save="handleSave"
      @cancel="handleBack"
    >
      <div class="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-indigo-900 text-sm mb-6">
        El código interno debe ser estable: se usa para integraciones y filtros administrativos.
      </div>
      <p v-if="errorMessage" class="mb-4 text-sm font-medium text-red-600">
        {{ errorMessage }}
      </p>
      <ApprovalCategoryForm v-model="form" :flow-options="flowOptions" :advanced="advanced" />
    </CardSheet>
  </div>
</template>
