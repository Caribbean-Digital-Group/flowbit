<script setup lang="ts">
import { approvalStatusLabel } from '~/utils/approvals'
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyLeaveRequestForm,
  mapLeaveRequestToForm,
  validateLeaveRequestForm,
  type LeaveRequestFormData
} from '~/components/LeaveRequest/Form.vue'
import type { HrLeaveRequestViewRow, HrLeaveTypeRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getRequest, getTypes, updateRequest, reviewRequest, cancelRequest, getBalances, lastError } = useLeave()

const request = ref<HrLeaveRequestViewRow | null>(null)
const formData = ref<LeaveRequestFormData>(createEmptyLeaveRequestForm())
const types = ref<HrLeaveTypeRow[]>([])
const balance = ref<number | null>(null)
const reviewNotes = ref('')
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const requestId = computed(() => String(route.params.id ?? ''))
const typeOptions = computed(() => types.value.map(t => ({ value: t.id, label: t.name })))
const employeeOptions = computed<HrOption[]>(() =>
  request.value ? [{ value: request.value.employee_id, label: request.value.employee_name ?? '—' }] : []
)
const isPending = computed(() => request.value?.status === 'pending')

const statusVariant = computed(() => {
  switch (request.value?.status) {
    case 'approved': return 'success'
    case 'rejected': return 'danger'
    case 'pending': return 'warning'
    default: return 'secondary'
  }
})

const menuOptions = computed<MenuOption[]>(() => {
  const status = request.value?.status
  if (!status || !['pending', 'approved'].includes(status)) return []
  if (status === 'approved' && !isSelectedCompanyAdmin.value) return []
  return [{
    id: 'cancel',
    label: 'Cancelar solicitud',
    icon: 'M6 18L18 6M6 6l12 12',
    action: () => void handleCancelRequest(),
    variant: 'danger'
  }]
})

// Solicitud del motor de aprobaciones vinculada a este permiso (TRY-18)
const approvalLink = ref<{ id: string; status: string; pending: string | null } | null>(null)
const { supabase: approvalDb } = useApprovalClient()

const loadApprovalLink = async (leaveId: string): Promise<void> => {
  const { data } = await approvalDb
    .from('v_approval_requests')
    .select('id, status, pending_approvers_display')
    .eq('source_type', 'hr_leave')
    .eq('source_id', leaveId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  approvalLink.value = data?.id ? { id: data.id, status: data.status ?? '', pending: data.pending_approvers_display } : null
}

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !requestId.value) return
  isLoading.value = true
  try {
    const [row, typeRows] = await Promise.all([getRequest(requestId.value, companyId), getTypes(companyId), loadApprovalLink(requestId.value)])
    request.value = row
    types.value = typeRows
    if (!row) {
      errorMessage.value = 'No se encontró la solicitud o no tienes acceso.'
      return
    }
    formData.value = mapLeaveRequestToForm(row)
    const type = typeRows.find(t => t.id === row.leave_type_id)
    if (type?.deducts_balance) {
      const [b] = await getBalances(companyId, row.employee_id)
      balance.value = b ? b.remaining_days : 0
    } else {
      balance.value = null
    }
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  errorMessage.value = validateLeaveRequestForm(formData.value)
  if (errorMessage.value) return
  isLoading.value = true
  try {
    const saved = await updateRequest(requestId.value, {
      leave_type_id: formData.value.leave_type_id,
      start_date: formData.value.start_date,
      end_date: formData.value.end_date,
      half_day: formData.value.half_day,
      reason: trimToNull(formData.value.reason)
    })
    if (!saved) {
      errorMessage.value = lastError.value
      return
    }
    isEditing.value = false
    await load()
  } finally {
    isLoading.value = false
  }
}

const handleReview = async (approve: boolean) => {
  if (!approve && !reviewNotes.value.trim()) {
    errorMessage.value = 'Indica el motivo del rechazo.'
    return
  }
  isLoading.value = true
  try {
    const saved = await reviewRequest(requestId.value, approve, trimToNull(reviewNotes.value))
    if (!saved) {
      errorMessage.value = lastError.value
      return
    }
    errorMessage.value = null
    reviewNotes.value = ''
    await load()
  } finally {
    isLoading.value = false
  }
}

const handleCancelRequest = async () => {
  if (await cancelRequest(requestId.value)) await load()
  else errorMessage.value = lastError.value
}

watch([requestId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <CardSheet
    :title="request?.employee_name || 'Solicitud'"
    :subtitle="request?.leave_type_name ?? ''"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-edit-button="isSelectedCompanyAdmin && isPending"
    :show-options-button="menuOptions.length > 0"
    :created-by="request?.created_by ?? '—'"
    :created-at="request?.created_at ?? ''"
    :updated-by="request?.updated_by ?? '—'"
    :updated-at="request?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="router.push('/admin/leaves')"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="() => { if (request) formData = mapLeaveRequestToForm(request); isEditing = false }"
  >
    <template v-if="request" #status>
      <BadgeApp :label="LEAVE_STATUS_LABELS[request.status] ?? request.status" :variant="statusVariant" />
    </template>

    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />

    <template v-if="request">
      <LeaveRequestForm
        v-model="formData"
        :readonly="!isEditing"
        :employee-options="employeeOptions"
        :type-options="typeOptions"
        :lock-employee="true"
        :balance="balance"
      />

      <div
        v-if="request.review_notes || request.reviewed_at"
        class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-700"
      >
        <p class="font-semibold text-slate-800">
          Revisión
        </p>
        <p v-if="request.reviewed_at" class="text-slate-500">
          {{ formatHrDate(request.reviewed_at) }}
        </p>
        <p v-if="request.review_notes" class="mt-1">
          {{ request.review_notes }}
        </p>
      </div>

      <div
        v-if="approvalLink"
        class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50 px-6 py-4 text-sm text-violet-900"
      >
        <p>
          La aprobación de este permiso pasa por el módulo de Aprobaciones:
          <strong>{{ approvalStatusLabel(approvalLink.status) }}</strong>
          <template v-if="approvalLink.pending"> · con {{ approvalLink.pending }}</template>
        </p>
        <NuxtLink :to="`/admin/approval-requests/${approvalLink.id}`" class="font-semibold underline">Ver solicitud de aprobación</NuxtLink>
      </div>

      <div
        v-if="isSelectedCompanyAdmin && isPending && !isEditing"
        class="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6"
      >
        <h3 class="mb-1 font-semibold text-slate-800">
          Revisar solicitud
        </h3>
        <p v-if="approvalLink" class="mb-3 text-xs text-slate-500">
          Como administrador puedes decidir aquí; quedará como resolución forzada en la bitácora de la aprobación.
        </p>
        <FormTextArea v-model="reviewNotes" label="Comentarios" placeholder="Obligatorio para rechazar" :rows="2" size="md" />
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <BtnApp variant="danger" size="md" @click="handleReview(false)">
            Rechazar
          </BtnApp>
          <BtnApp variant="success" size="md" @click="handleReview(true)">
            Aprobar
          </BtnApp>
        </div>
      </div>
    </template>
  </CardSheet>
</template>
