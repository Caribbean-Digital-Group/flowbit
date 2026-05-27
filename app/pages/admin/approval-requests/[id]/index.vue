<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { Tables, TablesUpdate } from '~/types/database.types'
import type { ApprovalRequestStatus } from '~/components/ApprovalRequest/Form.vue'
import {
  approvalRequestAmountToTrimmedString,
  approvalRequestStatusLabels,
  createEmptyApprovalRequestForm,
  type ApprovalRequestFormData
} from '~/components/ApprovalRequest/Form.vue'
import type { ApprovalManagerWithRelations } from '~/composables/useApprovalManager'

definePageMeta({
  layout: 'admin'
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, partner, companies } = storeToRefs(authStore)

const approvalRequestComposable = useApprovalRequest()
const {
  getRequestById,
  updateDraftRequest,
  updateRequestAsAdmin,
  publishRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  resetRequestToDraft
} = approvalRequestComposable

const { getSelectableCategoriesForRequests } = useApprovalCategory()

const approvalManagerComposable = useApprovalManager()
const { getManagersByCompany, getActiveManagerForPartner } = approvalManagerComposable
const rid = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isWorkspaceAdmin = computed(() => {
  const id = selectedCompanyId.value
  const r = companies.value.find((c) => c.company.id === id)?.role
  return r === 'owner' || r === 'admin'
})

const entity = ref<Tables<'approval_request'> | null>(null)
const form = ref<ApprovalRequestFormData>(createEmptyApprovalRequestForm())
const initial = ref<ApprovalRequestFormData>(createEmptyApprovalRequestForm())

const managersAll = ref<ApprovalManagerWithRelations[]>([])
const categoryOptionsRef = ref<{ value: string; label: string }[]>([])

const isLoading = ref(false)
const isEditing = ref(false)
const errorMessage = ref<string | null>(null)
const actionMessage = ref<string | null>(null)

const mapEntityToForm = (r: Tables<'approval_request'>): ApprovalRequestFormData => ({
  title: r.title ?? '',
  category_id: r.category_id,
  request_date: (r.request_date ?? '').slice(0, 10),
  description: r.description ?? '',
  amount: r.amount != null ? String(r.amount) : '',
  currency: (r.currency ?? 'MXN').trim(),
  reference: r.reference ?? '',
  assigned_approval_manager_id: r.assigned_approval_manager_id ?? ''
})

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

const myManagerRecord = ref<ApprovalManagerWithRelations | null>(null)

const isRequestOwner = computed(() => {
  const pid = partner.value?.id
  if (!pid || !entity.value) return false
  return entity.value.requesting_partner_id === pid
})

const isAssignedApprover = computed(() => {
  if (!entity.value?.assigned_approval_manager_id || !myManagerRecord.value) return false
  return entity.value.assigned_approval_manager_id === myManagerRecord.value.id
})

const canEditDraftFields = computed(() => {
  if (!entity.value || entity.value.status !== 'draft') return false
  return isWorkspaceAdmin.value || isRequestOwner.value
})

const canPublishOrCancelDraft = computed(
  () => isRequestOwner.value || isWorkspaceAdmin.value
)

/** Acciones de flujo (órdenes de trabajo), mismo patrón que órdenes: menú del CardSheet */
const workflowMenuOptions = computed<MenuOption[]>(() => {
  const e = entity.value
  if (!e) return []

  if (e.status === 'draft' && canPublishOrCancelDraft.value) {
    return [
      {
        id: 'publish-request',
        label: 'Publicar solicitud',
        icon:
          'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        action: () => void runTransition(publishRequest),
        variant: 'success'
      },
      {
        id: 'cancel-draft',
        label: 'Cancelar solicitud',
        icon:
          'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
        action: () => void runTransition(cancelRequest),
        variant: 'warning'
      }
    ]
  }

  if (e.status === 'published') {
    const items: MenuOption[] = []

    if (isAssignedApprover.value) {
      items.push(
        {
          id: 'approve-request',
          label: 'Aprobar solicitud',
          icon:
            'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
          action: () => void runTransition(approveRequest),
          variant: 'success'
        },
        {
          id: 'reject-request',
          label: 'Rechazar solicitud',
          icon:
            'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
          action: () => void runTransition(rejectRequest),
          variant: 'danger'
        }
      )
    }

    if (isRequestOwner.value || isWorkspaceAdmin.value) {
      items.push({
        id: 'cancel-published',
        label: 'Cancelar solicitud',
        icon:
          'M6 18L18 6M6 6l12 12',
        action: () => void runTransition(cancelRequest),
        variant: 'warning',
        divider: items.length > 0
      })
    }

    return items
  }

  if (
    (e.status === 'rejected' || e.status === 'cancelled')
    && (isRequestOwner.value || isWorkspaceAdmin.value)
  ) {
    return [
      {
        id: 'reset-to-draft',
        label: 'Volver a borrador',
        icon:
          'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
        action: () => void runTransition(resetRequestToDraft),
        variant: 'default'
      }
    ]
  }

  return []
})

const formatAuditDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  const id = rid.value
  const myPid = partner.value?.id

  if (!cid || !id) return

  isLoading.value = true
  errorMessage.value = null
  actionMessage.value = null

  try {
    const [row, cats, mgrs] = await Promise.all([
      getRequestById(id, cid),
      getSelectableCategoriesForRequests(cid),
      getManagersByCompany(cid)
    ])

    if (myPid) {
      myManagerRecord.value = await getActiveManagerForPartner(cid, myPid)
    } else {
      myManagerRecord.value = null
    }

    if (!row) {
      errorMessage.value = 'Solicitud no encontrada o sin acceso.'
      entity.value = null
      return
    }

    entity.value = row
    categoryOptionsRef.value = cats.map((c) => ({
      value: c.id,
      label: c.name ?? c.internal_code ?? c.id
    }))
    managersAll.value = mgrs

    const mapped = mapEntityToForm(row)
    form.value = mapped
    initial.value = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, rid, partner], load, { immediate: true })

watch(
  () => form.value.category_id,
  () => {
    if (!entity.value || entity.value.status !== 'draft' || !isEditing.value) return
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

const handleEdit = () => {
  if (!canEditDraftFields.value) return
  errorMessage.value = null
  isEditing.value = true
}

const handleCancel = () => {
  form.value = { ...initial.value }
  isEditing.value = false
  errorMessage.value = null
}

const buildUpdatePayload = (): TablesUpdate<'approval_request'> => {
  const amt = approvalRequestAmountToTrimmedString(form.value.amount)
  let amountParsed: number | null = null
  if (amt !== '') {
    const n = Number(amt.replace(',', '.'))
    amountParsed = Number.isFinite(n) ? n : null
  }

  return {
    title: form.value.title.trim(),
    category_id: form.value.category_id,
    request_date: form.value.request_date || null,
    description: form.value.description.trim() || null,
    amount: amountParsed,
    currency: (form.value.currency || 'MXN').trim().slice(0, 3).toUpperCase(),
    reference: form.value.reference.trim() || null,
    assigned_approval_manager_id: form.value.assigned_approval_manager_id || null
  }
}

const handleSave = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  const id = rid.value
  if (!cid || !id || !entity.value) return

  if (entity.value.status !== 'draft') {
    errorMessage.value = 'Solo puedes guardar desde el modo edición cuando la solicitud sigue en borrador.'
    return
  }

  if (!form.value.title.trim()) {
    errorMessage.value = 'El asunto es obligatorio.'
    return
  }
  if (!form.value.category_id) {
    errorMessage.value = 'Selecciona una categoría.'
    return
  }

  isLoading.value = true
  errorMessage.value = null
  try {
    const payload = buildUpdatePayload()
    const saved = isWorkspaceAdmin.value
      ? await updateRequestAsAdmin(id, cid, payload)
      : await updateDraftRequest(id, cid, payload)

    if (!saved) {
      errorMessage.value = 'No se pudo guardar el borrador.'
      return
    }

    entity.value = saved
    const mapped = mapEntityToForm(saved)
    form.value = mapped
    initial.value = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const runTransition = async (
  fn: (id: string) => Promise<{ data: Tables<'approval_request'> | null; errorMessage: string | null }>
): Promise<void> => {
  const id = rid.value
  if (!id) return
  isLoading.value = true
  actionMessage.value = null
  errorMessage.value = null
  try {
    const { data, errorMessage: err } = await fn(id)
    if (err) {
      errorMessage.value = err
      return
    }
    if (data) {
      entity.value = data
      const mapped = mapEntityToForm(data)
      form.value = mapped
      initial.value = { ...mapped }
      isEditing.value = false
      actionMessage.value = 'Cambio aplicado correctamente.'
    }
  } finally {
    isLoading.value = false
  }
}

const status = computed<ApprovalRequestStatus | null>(
  () => (entity.value?.status as ApprovalRequestStatus | undefined) ?? null
)

const statusBadgeMeta = computed(() => {
  if (!status.value) return { label: '—', variant: 'secondary' as const }
  const label = approvalRequestStatusLabels[status.value] ?? status.value
  const variant =
    status.value === 'approved'
      ? ('success' as const)
      : status.value === 'rejected'
        ? ('danger' as const)
        : status.value === 'cancelled'
          ? ('warning' as const)
          : ('primary' as const)
  return { label, variant }
})
</script>

<template>
  <div class="w-full py-4 space-y-6">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Selecciona una empresa.
    </div>

    <template v-else>
      <div
        v-if="errorMessage && !entity"
        class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-800"
      >
        {{ errorMessage }}
      </div>

      <CardSheet
        v-else-if="entity"
        :title="form.title || 'Solicitud'"
        :subtitle="`Folio interno #${entity.request_number}`"
        :show-back-button="true"
        :show-options-button="workflowMenuOptions.length > 0"
        :show-edit-button="canEditDraftFields"
        :show-footer="true"
        :is-editing="isEditing"
        :is-loading="isLoading"
        :created-by="entity.created_by ?? '—'"
        :created-at="formatAuditDate(entity.created_at)"
        :updated-by="entity.updated_by ?? '—'"
        :updated-at="formatAuditDate(entity.updated_at)"
        :menu-options="workflowMenuOptions"
        variant="elevated"
        padding="lg"
        @back="handleBack"
        @edit="handleEdit"
        @save="handleSave"
        @cancel="handleCancel"
      >
        <template #status>
          <BadgeApp
            v-if="status"
            :label="statusBadgeMeta.label"
            :variant="statusBadgeMeta.variant"
          />
        </template>

        <p v-if="actionMessage" class="mb-4 text-sm font-medium text-emerald-700">
          {{ actionMessage }}
        </p>
        <p v-if="errorMessage" class="mb-4 text-sm font-medium text-red-600">
          {{ errorMessage }}
        </p>

        <ApprovalRequestForm
          v-model="form"
          :readonly="!isEditing"
          :readonly-status="status"
          :request-number-display="String(entity.request_number)"
          :preview-approved-at="entity.approved_at"
          :preview-rejected-at="entity.rejected_at"
          :category-options="categoryOptionsRef"
          :manager-options="managerOptions"
        />
      </CardSheet>
    </template>
  </div>
</template>
