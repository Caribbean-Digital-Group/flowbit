<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyApprovalRequestForm,
  approvalRequestAmountToTrimmedString,
  type ApprovalRequestFormData
} from '~/components/ApprovalRequest/Form.vue'
import type { ApprovalManagerWithRelations } from '~/composables/useApprovalManager'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, partner } = storeToRefs(authStore)

const { createRequest } = useApprovalRequest()
const { getSelectableCategoriesForRequests } = useApprovalCategory()
const { getManagersByCompany } = useApprovalManager()

const form = ref<ApprovalRequestFormData>(createEmptyApprovalRequestForm())
const managersAll = ref<ApprovalManagerWithRelations[]>([])
const categoryOptionsRef = ref<{ value: string; label: string }[]>([])
const errorMessage = ref<string | null>(null)
const isSaving = ref(false)

const labelsForManagers = (m: ApprovalManagerWithRelations): string =>
  (
    (m.partner?.display_name ?? '').trim() ||
    (m.partner?.name ?? '').trim() ||
    m.partner?.email ||
    `Registro ${m.id.slice(0, 8)}`
  ).trim()

const managerOptions = computed(() => {
  const cat = form.value.category_id
  return managersAll.value
    .filter((m) => {
      if (!m.active) return false
      if (!m.partner?.user_id) return false
      const links = m.approval_manager_category ?? []
      if (!links.length) return true
      return links.some((l) => l.approval_category_id === cat)
    })
    .map((m) => ({
      value: m.id,
      label: labelsForManagers(m)
    }))
})

const loadCats = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const cats = await getSelectableCategoriesForRequests(cid)
  categoryOptionsRef.value = cats.map((c) => ({
    value: c.id,
    label: c.name ?? c.internal_code ?? c.id
  }))
}

const loadManagers = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  managersAll.value = await getManagersByCompany(cid)
}

watch(selectedCompanyId, async () => {
  await Promise.all([loadCats(), loadManagers()])
}, { immediate: true })

watch(
  () => form.value.category_id,
  () => {
    const ids = managerOptions.value.map((o) => o.value)
    if (
      form.value.assigned_approval_manager_id
      && !ids.includes(form.value.assigned_approval_manager_id)
    ) {
      form.value.assigned_approval_manager_id = ''
    }
  }
)

const handleBack = () => router.push('/admin/approval-requests')

const handleSave = async (): Promise<void> => {
  errorMessage.value = null
  const cid = selectedCompanyId.value
  const requesterPid = partner.value?.id ?? null

  if (!cid) {
    errorMessage.value = 'Selecciona empresa.'
    return
  }
  if (!requesterPid) {
    errorMessage.value = 'No se encontró el partner de tu cuenta.'
    return
  }
  if (!form.value.title.trim()) {
    errorMessage.value = 'El asunto es obligatorio.'
    return
  }
  if (!form.value.category_id) {
    errorMessage.value = 'Selecciona una categoría disponible.'
    return
  }

  const amt = approvalRequestAmountToTrimmedString(form.value.amount)
  let amountParsed: number | null = null
  if (amt !== '') {
    const n = Number(amt.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      errorMessage.value = 'Importe no válido.'
      return
    }
    amountParsed = n
  }

  const dateStr = form.value.request_date || new Date().toISOString().split('T')[0] || ''

  isSaving.value = true
  try {
    const row = await createRequest(cid, requesterPid, {
      title: form.value.title.trim(),
      category_id: form.value.category_id,
      request_date: dateStr,
      description: form.value.description.trim() || null,
      amount: amountParsed,
      currency: (form.value.currency || 'MXN').trim().slice(0, 3).toUpperCase(),
      reference: form.value.reference.trim() || null,
      assigned_approval_manager_id: form.value.assigned_approval_manager_id.trim()
        ? form.value.assigned_approval_manager_id
        : null
    })

    if (!row) {
      errorMessage.value = 'No se pudo crear la solicitud.'
      return
    }

    router.push(`/admin/approval-requests/${row.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId || !partner"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Debes iniciar sesión y seleccionar una empresa para iniciar solicitudes.
    </div>

    <CardSheet
      v-else
      title="Nueva solicitud"
      subtitle="Las solicitudes se crean como borrador; en el detalle usa el menú de opciones para publicar cuando esté lista."
      :is-editing="true"
      :show-edit-button="false"
      :show-options-button="false"
      :show-footer="false"
      variant="elevated"
      padding="lg"
      :is-loading="isSaving"
      @back="handleBack"
      @save="handleSave"
      @cancel="handleBack"
    >
      <p v-if="errorMessage" class="mb-4 text-sm font-medium text-red-600">
        {{ errorMessage }}
      </p>

      <ApprovalRequestForm
        v-model="form"
        :category-options="categoryOptionsRef"
        :manager-options="managerOptions"
      />
    </CardSheet>
  </div>
</template>
