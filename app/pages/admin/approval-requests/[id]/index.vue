<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { ActionDialogResult } from '~/components/ApprovalRequest/ActionDialog.vue'
import type {
  ApprovalCategoryRow,
  ApprovalInsights,
  ApprovalPlanStep,
  ApprovalRejectionReasonRow,
  ApprovalRequestAttachmentRow,
  ApprovalRequestCommentRow,
  ApprovalRequestEventRow,
  ApprovalRequestRow,
  ApprovalRequestViewRow
} from '~/types/approval.types'
import type { ApprovalStepWithApprovers } from '~/composables/useApprovalRequest'
import {
  approvalRequestToForm,
  createEmptyApprovalRequestForm,
  parseApprovalAmount,
  type ApprovalRequestFormData
} from '~/components/ApprovalRequest/Form.vue'
import {
  APPROVAL_PRIORITY_LABELS,
  approvalStatusLabel,
  approvalStatusVariant,
  formatDateTimeMx,
  formatMoneyMx,
  isApprovalResolved,
  missingRequiredFields
} from '~/utils/approvals'

definePageMeta({ layout: 'admin' })

type DialogKind =
  | 'approve' | 'reject' | 'return' | 'revoke' | 'add' | 'reassign-pick' | 'reassign'
  | 'force-approve' | 'force-reject' | 'cancel'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, partner, companies } = storeToRefs(authStore)

const requests = useApprovalRequest()
const { getCategoriesByCompany } = useApprovalCategory()
const { getRejectionReasons } = useApprovalSettings()
const people = useApprovalPeople()

const rid = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id))

const entity = ref<ApprovalRequestRow | null>(null)
const view = ref<ApprovalRequestViewRow | null>(null)
const categories = shallowRef<ApprovalCategoryRow[]>([])
const steps = ref<ApprovalStepWithApprovers[]>([])
const events = ref<ApprovalRequestEventRow[]>([])
const comments = ref<ApprovalRequestCommentRow[]>([])
const attachments = ref<ApprovalRequestAttachmentRow[]>([])
const reasons = ref<ApprovalRejectionReasonRow[]>([])
const insights = ref<ApprovalInsights | null>(null)
const preview = ref<ApprovalPlanStep[]>([])

const form = ref<ApprovalRequestFormData>(createEmptyApprovalRequestForm())
const initial = ref<ApprovalRequestFormData>(createEmptyApprovalRequestForm())

const isLoading = ref(false)
const isEditing = ref(false)
const errorMessage = ref<string | null>(typeof route.query.error === 'string' ? route.query.error : null)
const actionMessage = ref<string | null>(route.query.notice === 'attach' ? 'Borrador guardado. Adjunta el archivo requerido y envía la solicitud.' : null)
const dialog = ref<DialogKind | null>(null)
const dialogLoading = ref(false)
const dialogError = ref<string | null>(null)
const reassignRowId = ref<string | null>(null)
const uploading = ref(false)
const sendingComment = ref(false)

const me = computed(() => partner.value?.id ?? '')
const isWorkspaceAdmin = computed(() => {
  const r = companies.value.find(c => c.company.id === selectedCompanyId.value)?.role
  return r === 'owner' || r === 'admin'
})
const category = computed(() => categories.value.find(c => c.id === entity.value?.category_id))
const status = computed(() => entity.value?.status ?? null)
const isSource = computed(() => Boolean(entity.value?.source_type))
const isRequesterSide = computed(() => {
  const e = entity.value
  if (!e) return false
  return isWorkspaceAdmin.value || e.requesting_partner_id === me.value || e.captured_by_partner_id === me.value
})

const currentRoundSteps = computed(() => steps.value.filter(s => s.round === entity.value?.round))
const myPendingRows = computed(() =>
  currentRoundSteps.value
    .filter(s => s.status === 'active')
    .flatMap(s => s.approvers)
    .filter(a => a.partner_id === me.value && a.status === 'pending'))
const myApprovedRow = computed(() =>
  currentRoundSteps.value.flatMap(s => s.approvers).find(a => a.partner_id === me.value && a.status === 'approved'))
const pendingRows = computed(() =>
  currentRoundSteps.value.filter(s => s.status === 'active').flatMap(s => s.approvers).filter(a => a.status === 'pending'))

const canEditContent = computed(() =>
  isRequesterSide.value && (status.value === 'draft' || status.value === 'returned'))
const canEditSubmitted = computed(() => isRequesterSide.value && status.value === 'published' && !isSource.value)

const mentionOptions = computed(() => people.memberOptions.value.filter(o => o.value !== me.value))
const managerOptions = computed(() => people.managerOptionsFor(entity.value?.category_id))

// ─── Carga ──────────────────────────────────────────────────────────────────

const loadDetail = async (): Promise<void> => {
  const id = rid.value
  const [s, ev, c, a, ins] = await Promise.all([
    requests.getSteps(id),
    requests.getEvents(id),
    requests.getComments(id),
    requests.getAttachments(id),
    requests.getInsights(id)
  ])
  steps.value = s
  events.value = ev
  comments.value = c
  attachments.value = a
  insights.value = ins
  if (entity.value && (entity.value.status === 'draft' || entity.value.status === 'returned')) {
    preview.value = await requests.previewRequest(id)
  } else {
    preview.value = []
  }
}

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !rid.value) return
  isLoading.value = true
  try {
    const [row, v, cats, lines, rs] = await Promise.all([
      requests.getRequestById(rid.value, cid),
      requests.getRequestViewById(rid.value, cid),
      getCategoriesByCompany(cid, { includeArchived: true }),
      requests.getLines(rid.value),
      getRejectionReasons(cid),
      people.loadBase(cid)
    ])
    if (!row) { entity.value = null; errorMessage.value = 'Solicitud no encontrada o sin acceso.'; return }
    entity.value = row
    view.value = v
    categories.value = cats
    reasons.value = rs
    people.rememberName(row.requesting_partner_id, v?.requesting_partner_display)
    people.rememberName(row.captured_by_partner_id, v?.captured_by_display)
    const mapped = approvalRequestToForm(row, lines.map(l => ({
      id: l.id, concept: l.concept, quantity: Number(l.quantity), unit_price: Number(l.unit_price), product_id: l.product_id
    })))
    form.value = mapped
    initial.value = JSON.parse(JSON.stringify(mapped))
    isEditing.value = false
    const schema = cats.find(c => c.id === row.category_id)?.field_schema ?? []
    if (schema.length) await people.loadLookups(cid, schema)
    await loadDetail()
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, rid], load, { immediate: true })

// ─── Edición ────────────────────────────────────────────────────────────────

const handleEdit = (): void => {
  if (!canEditContent.value && !canEditSubmitted.value) return
  errorMessage.value = null
  isEditing.value = true
}

const handleCancelEdit = (): void => {
  form.value = JSON.parse(JSON.stringify(initial.value))
  isEditing.value = false
}

const handleSave = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !entity.value) return
  if (!form.value.title.trim()) { errorMessage.value = 'El asunto es obligatorio.'; return }
  isLoading.value = true
  errorMessage.value = null
  try {
    if (status.value === 'published') {
      // Enviada: el motor registra el cambio y reinicia el flujo si es crítico
      const { errorMessage: err } = await requests.updateSubmitted(entity.value.id, {
        title: form.value.title.trim(),
        description: form.value.description.trim() || null,
        amount: parseApprovalAmount(form.value.amount),
        currency: form.value.currency,
        due_date: form.value.due_date || null,
        priority: form.value.priority,
        reference: form.value.reference.trim() || null,
        field_values: form.value.field_values
      })
      if (err) { errorMessage.value = err; return }
      actionMessage.value = 'Cambios guardados. Si cambiaste un dato crítico, el flujo se reinició desde el nivel 1.'
    } else {
      const saved = await requests.updateDraftRequest(entity.value.id, cid, {
        title: form.value.title.trim(),
        category_id: form.value.category_id,
        request_date: form.value.request_date || undefined,
        description: form.value.description.trim() || null,
        amount: parseApprovalAmount(form.value.amount),
        currency: (form.value.currency || 'MXN').slice(0, 3).toUpperCase(),
        reference: form.value.reference.trim() || null,
        assigned_approval_manager_id: category.value?.flow_id ? null : (form.value.assigned_approval_manager_id || null),
        priority: form.value.priority,
        due_date: form.value.due_date || null,
        field_values: form.value.field_values
      })
      if (!saved) { errorMessage.value = requests.lastError.value ?? 'No se pudo guardar.'; return }
      if (category.value?.allow_lines) {
        const ok = await requests.saveLines(cid, entity.value.id, form.value.lines)
        if (!ok) { errorMessage.value = requests.lastError.value; return }
      }
      actionMessage.value = 'Borrador guardado.'
    }
    await load()
  } finally {
    isLoading.value = false
  }
}

// ─── Acciones ───────────────────────────────────────────────────────────────

const afterAction = async (
  run: () => Promise<{ data: ApprovalRequestRow | null; errorMessage: string | null }>,
  okMessage: string
): Promise<boolean> => {
  dialogLoading.value = true
  dialogError.value = null
  try {
    const { errorMessage: err } = await run()
    if (err) { dialogError.value = err; errorMessage.value = dialog.value ? null : err; return false }
    actionMessage.value = okMessage
    errorMessage.value = null
    dialog.value = null
    await load()
    return true
  } finally {
    dialogLoading.value = false
  }
}

const submit = async (): Promise<void> => {
  if (!entity.value) return
  const missing = missingRequiredFields(category.value?.field_schema ?? [], entity.value.field_values ?? {})
  if (missing.length) { errorMessage.value = `Faltan campos obligatorios: ${missing.join(', ')}. Edita la solicitud.`; return }
  await afterAction(() => requests.submitRequest(entity.value!.id), status.value === 'returned' ? 'Solicitud reenviada.' : 'Solicitud enviada a aprobación.')
}

const resetToDraft = () => afterAction(() => requests.resetRequestToDraft(entity.value!.id), 'La solicitud volvió a borrador.')

const onDialogConfirm = async (result: ActionDialogResult): Promise<void> => {
  const id = entity.value?.id
  if (!id || !dialog.value) return
  switch (dialog.value) {
    case 'approve':
      await afterAction(() => requests.approveRequest(id, result.text || null), 'Aprobaste la solicitud.')
      break
    case 'reject':
      await afterAction(() => requests.rejectRequest(id, result.text || null, result.option || null), 'Rechazaste la solicitud.')
      break
    case 'return':
      await afterAction(() => requests.returnRequest(id, result.text), 'Devolviste la solicitud al solicitante.')
      break
    case 'revoke':
      await afterAction(() => requests.revokeDecision(id, result.text), 'Revocaste tu aprobación.')
      break
    case 'add':
      await afterAction(() => requests.addApprover(id, result.option, result.text, result.checked), 'Se agregó al aprobador.')
      break
    case 'reassign-pick':
      reassignRowId.value = result.option
      dialog.value = 'reassign'
      break
    case 'reassign': {
      const rowId = reassignRowId.value ?? myPendingRows.value[0]?.id
      if (rowId) await afterAction(() => requests.reassign(rowId, result.option, result.text), 'Se reasignó la aprobación.')
      break
    }
    case 'force-approve':
      await afterAction(() => requests.forceResolve(id, 'approve', result.text), 'Resolución forzada: aprobada.')
      break
    case 'force-reject':
      await afterAction(() => requests.forceResolve(id, 'reject', result.text), 'Resolución forzada: rechazada.')
      break
    case 'cancel':
      await afterAction(() => requests.cancelRequest(id, result.text || null), 'Solicitud cancelada.')
      break
  }
}

const openReassign = (): void => {
  dialogError.value = null
  if (myPendingRows.value.length) {
    reassignRowId.value = myPendingRows.value[0]!.id
    dialog.value = 'reassign'
  } else {
    dialog.value = 'reassign-pick'
  }
}

interface DialogProps {
  title: string
  description?: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  textLabel?: string
  textRequired?: boolean
  optionLabel?: string
  options?: Array<{ value: string; label: string }>
  optionRequired?: boolean
  checkboxLabel?: string
}

const dialogConfig = computed<DialogProps>(() => {
  const eligible = people.approverOptions.value.filter(o => o.value !== me.value)
  const reasonOptions = reasons.value.map(r => ({ value: r.id, label: r.name }))
  const configs: Record<DialogKind, DialogProps> = {
    approve: { title: 'Aprobar solicitud', confirmLabel: 'Aprobar', confirmVariant: 'success', textLabel: 'Observaciones (opcional)', description: 'Las observaciones las ven el solicitante y los siguientes niveles.' },
    reject: { title: 'Rechazar solicitud', confirmLabel: 'Rechazar', confirmVariant: 'danger', textLabel: 'Motivo del rechazo', textRequired: reasonOptions.length === 0, optionLabel: reasonOptions.length ? 'Motivo predefinido' : '', options: reasonOptions },
    return: { title: 'Devolver para corrección', confirmLabel: 'Devolver', textLabel: 'Qué debe corregirse', textRequired: true, description: 'El solicitante corrige y la reenvía; el flujo vuelve a empezar.' },
    revoke: { title: 'Revocar mi aprobación', confirmLabel: 'Revocar', confirmVariant: 'danger', textLabel: 'Motivo', textRequired: true, description: 'Los niveles posteriores vuelven a esperar tu nueva decisión.' },
    add: { title: 'Agregar aprobador', confirmLabel: 'Agregar', optionLabel: 'Persona', options: eligible, optionRequired: true, textLabel: 'Por qué debe revisarla', textRequired: true, checkboxLabel: 'En paralelo a este nivel (si no, en un nivel nuevo después del actual)' },
    'reassign-pick': { title: 'Reasignar aprobación', confirmLabel: 'Continuar', optionLabel: 'Aprobación pendiente', options: pendingRows.value.map(a => ({ value: a.id, label: people.nameOf(a.partner_id) })), optionRequired: true },
    reassign: { title: 'Reasignar a otra persona', confirmLabel: 'Reasignar', optionLabel: 'Nueva persona', options: eligible, optionRequired: true, textLabel: 'Motivo', textRequired: true },
    'force-approve': { title: 'Forzar aprobación', confirmLabel: 'Forzar aprobación', confirmVariant: 'success', textLabel: 'Motivo (queda en el reporte de cumplimiento)', textRequired: true },
    'force-reject': { title: 'Forzar rechazo', confirmLabel: 'Forzar rechazo', confirmVariant: 'danger', textLabel: 'Motivo (queda en el reporte de cumplimiento)', textRequired: true },
    cancel: { title: 'Cancelar solicitud', confirmLabel: 'Cancelar solicitud', confirmVariant: 'danger', textLabel: 'Motivo (opcional)' }
  }
  return dialog.value ? configs[dialog.value] : { title: '' }
})

const ICON = {
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  x: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  back: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  user: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  swap: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  send: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  print: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
  undo: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
}

const open = (kind: DialogKind) => () => { dialogError.value = null; dialog.value = kind }

const menuOptions = computed<MenuOption[]>(() => {
  const e = entity.value
  if (!e) return []
  const items: MenuOption[] = []
  if ((e.status === 'draft' || e.status === 'returned') && isRequesterSide.value) {
    items.push({ id: 'submit', label: e.status === 'returned' ? 'Reenviar a aprobación' : 'Enviar a aprobación', icon: ICON.send, action: () => void submit(), variant: 'success' })
  }
  if (e.status === 'published' && myPendingRows.value.length) {
    items.push(
      { id: 'approve', label: 'Aprobar', icon: ICON.check, action: open('approve'), variant: 'success' },
      { id: 'reject', label: 'Rechazar', icon: ICON.x, action: open('reject'), variant: 'danger' }
    )
    if (!isSource.value) items.push({ id: 'return', label: 'Devolver para corrección', icon: ICON.back, action: open('return'), variant: 'warning' })
    items.push(
      { id: 'add', label: 'Agregar aprobador', icon: ICON.user, action: open('add') },
      { id: 'reassign', label: 'Reasignar', icon: ICON.swap, action: openReassign }
    )
  }
  if (e.status === 'published' && myApprovedRow.value && !myPendingRows.value.length) {
    items.push({ id: 'revoke', label: 'Revocar mi aprobación', icon: ICON.undo, action: open('revoke'), variant: 'warning' })
  }
  if (isWorkspaceAdmin.value && (e.status === 'published' || e.status === 'returned')) {
    if (e.status === 'published' && !myPendingRows.value.length && pendingRows.value.length) {
      items.push({ id: 'admin-reassign', label: 'Reasignar (administrador)', icon: ICON.swap, action: openReassign, divider: items.length > 0 })
      items.push({ id: 'admin-add', label: 'Agregar aprobador (administrador)', icon: ICON.user, action: open('add') })
    }
    items.push(
      { id: 'force-approve', label: 'Forzar aprobación', icon: ICON.bolt, action: open('force-approve'), divider: true },
      { id: 'force-reject', label: 'Forzar rechazo', icon: ICON.bolt, action: open('force-reject'), variant: 'danger' }
    )
  }
  if (['draft', 'published', 'returned'].includes(e.status) && isRequesterSide.value) {
    items.push({ id: 'cancel', label: 'Cancelar solicitud', icon: ICON.x, action: open('cancel'), variant: 'warning', divider: true })
  }
  if (['rejected', 'cancelled', 'expired'].includes(e.status) && isRequesterSide.value && !isSource.value) {
    items.push({ id: 'reset', label: 'Volver a borrador', icon: ICON.undo, action: () => void resetToDraft() })
  }
  if (!isSource.value) {
    items.push({ id: 'duplicate', label: 'Duplicar', icon: ICON.copy, action: () => void router.push({ path: '/admin/approval-requests/create', query: { from: e.id } }), divider: true })
  }
  items.push({ id: 'print', label: 'Evidencia imprimible (PDF)', icon: ICON.print, action: () => void window.open(`/admin/approval-requests/${e.id}/print`, '_blank') })
  return items
})

// ─── Adjuntos y comentarios ─────────────────────────────────────────────────

const canUpload = computed(() =>
  !!entity.value && !isApprovalResolved(entity.value.status)
  && (isRequesterSide.value || myPendingRows.value.length > 0))

const onUpload = async (files: File[]): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !entity.value || !me.value) return
  uploading.value = true
  errorMessage.value = null
  try {
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { errorMessage.value = `«${file.name}» pesa más de 15 MB.`; continue }
      const row = await requests.uploadAttachment(cid, entity.value.id, me.value, file)
      if (!row) errorMessage.value = requests.lastError.value
    }
    attachments.value = await requests.getAttachments(entity.value.id)
    events.value = await requests.getEvents(entity.value.id)
  } finally {
    uploading.value = false
  }
}

const openAttachment = async (row: ApprovalRequestAttachmentRow): Promise<void> => {
  const url = await requests.getAttachmentUrl(row.storage_path)
  if (url) window.open(url, '_blank', 'noopener')
  else errorMessage.value = requests.lastError.value
}

const removeAttachment = async (row: ApprovalRequestAttachmentRow): Promise<void> => {
  if (!await requests.removeAttachment(row.id)) { errorMessage.value = requests.lastError.value; return }
  attachments.value = attachments.value.filter(a => a.id !== row.id)
}

const canRemoveAttachment = (row: ApprovalRequestAttachmentRow): boolean =>
  !isApprovalResolved(entity.value?.status) && (row.uploaded_by_partner_id === me.value || isWorkspaceAdmin.value)

const sendComment = async (payload: { body: string; mentions: string[] }): Promise<void> => {
  if (!entity.value) return
  sendingComment.value = true
  try {
    const row = await requests.addComment(entity.value.id, payload.body, payload.mentions)
    if (!row) { errorMessage.value = requests.lastError.value; return }
    comments.value = [...comments.value, row]
  } finally {
    sendingComment.value = false
  }
}

const sourceLink = computed(() => entity.value?.source_type === 'hr_leave' ? '/admin/leaves' : null)
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <div v-if="!selectedCompanyId" class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900">
      Selecciona una empresa.
    </div>

    <div v-else-if="errorMessage && !entity" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-800">
      {{ errorMessage }}
    </div>

    <CardSheet
      v-else-if="entity"
      :title="entity.title || 'Solicitud'"
      :subtitle="`#${entity.request_number} · ${category?.name ?? ''}`"
      :show-back-button="true"
      :show-options-button="menuOptions.length > 0"
      :show-edit-button="canEditContent || canEditSubmitted"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="view?.captured_by_display ? `${view.captured_by_display} (capturó)` : (view?.requesting_partner_display ?? '—')"
      :created-at="formatDateTimeMx(entity.created_at)"
      :updated-by="view?.resolved_by_display ?? '—'"
      :updated-at="formatDateTimeMx(entity.updated_at)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      @back="router.push('/admin/approval-requests')"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancelEdit"
    >
      <template #status>
        <BadgeApp :label="approvalStatusLabel(status)" :variant="approvalStatusVariant(status)" />
      </template>

      <p v-if="actionMessage" class="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{{ actionMessage }}</p>
      <p v-if="errorMessage" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{{ errorMessage }}</p>

      <!-- Resumen -->
      <div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Solicitante</p>
          <p class="mt-0.5 text-sm font-semibold text-slate-800">{{ view?.requesting_partner_display ?? '—' }}</p>
          <p v-if="view?.captured_by_display" class="text-xs text-slate-500">Capturó: {{ view.captured_by_display }}</p>
        </div>
        <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Importe</p>
          <p class="mt-0.5 text-sm font-semibold text-slate-800">{{ formatMoneyMx(entity.amount, entity.currency) }}</p>
        </div>
        <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prioridad</p>
          <p class="mt-0.5 text-sm font-semibold text-slate-800">{{ APPROVAL_PRIORITY_LABELS[entity.priority] }}</p>
        </div>
        <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {{ status === 'published' ? 'Ahora con' : 'Resolución' }}
          </p>
          <p class="mt-0.5 text-sm font-semibold text-slate-800">
            {{ status === 'published' ? (view?.pending_approvers_display ?? '—') : (entity.resolution_note || approvalStatusLabel(status)) }}
          </p>
          <p v-if="entity.forced" class="text-xs font-semibold text-amber-700">Resolución forzada</p>
          <p v-if="entity.auto_approved" class="text-xs font-semibold text-sky-700">Aprobada automáticamente</p>
        </div>
      </div>

      <div v-if="sourceLink" class="mb-6 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
        Esta solicitud viene de Recursos Humanos. Al resolverse se aplica en el permiso.
        <NuxtLink :to="sourceLink" class="font-semibold underline">Ver permisos</NuxtLink>
      </div>

      <div v-if="status === 'published' && myPendingRows.length && !isEditing" class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
        <p class="flex-1 text-sm font-semibold text-indigo-900">Esta solicitud espera tu decisión.</p>
        <BtnApp variant="success" label="Aprobar" @click="open('approve')()" />
        <BtnApp variant="danger" label="Rechazar" @click="open('reject')()" />
        <BtnApp v-if="!isSource" variant="ghost" label="Devolver" @click="open('return')()" />
      </div>

      <div v-if="(status === 'draft' || status === 'returned') && isRequesterSide && !isEditing" class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <p class="flex-1 text-sm text-emerald-900">
          <template v-if="status === 'returned'">Te la devolvieron: <strong>{{ entity.resolution_note }}</strong>. Corrige y reenvía.</template>
          <template v-else>Borrador. Revisa la vista previa del flujo y envíala cuando esté lista.</template>
        </p>
        <BtnApp variant="success" :label="status === 'returned' ? 'Reenviar' : 'Enviar a aprobación'" :loading="dialogLoading" @click="submit" />
      </div>

      <div v-if="insights?.flags.length" class="mb-6 space-y-2">
        <p v-for="flag in insights.flags" :key="flag.code + flag.message" class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          ⚠️ {{ flag.message }}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_24rem]">
        <div class="space-y-6">
          <p v-if="isEditing && status === 'published'" class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Editar una solicitud en revisión queda en la bitácora. Si cambias
            {{ (category?.critical_fields ?? []).join(', ') || 'un dato crítico' }}, las aprobaciones se anulan y el flujo empieza de nuevo.
          </p>
          <ApprovalRequestForm
            v-model="form"
            :readonly="!isEditing"
            :categories="categories"
            :manager-options="managerOptions"
            :lookups="people.lookups.value"
            :lock-category="status === 'published'"
          />
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
            <ApprovalRequestAttachments
              :attachments="attachments"
              :name-of="people.nameOf"
              :can-upload="canUpload"
              :can-remove="canRemoveAttachment"
              :uploading="uploading"
              :required="category?.require_attachment"
              @upload="onUpload"
              @open="openAttachment"
              @remove="removeAttachment"
            />
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
            <ApprovalRequestComments
              :comments="comments"
              :name-of="people.nameOf"
              :mention-options="mentionOptions"
              :sending="sendingComment"
              @send="sendComment"
            />
          </div>
        </div>

        <aside class="space-y-6">
          <ApprovalRequestFlowPreview v-if="preview.length" :steps="preview" title="Así se aprobará" />
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
            <ApprovalRequestTimeline :steps="steps" :current-round="entity.round" :name-of="people.nameOf" />
          </div>
          <div v-if="insights?.previous.length" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Solicitudes anteriores en esta categoría</h3>
            <p v-if="insights.requester_average" class="mb-3 text-xs text-slate-500">
              Promedio aprobado: {{ formatMoneyMx(insights.requester_average, entity.currency) }} ({{ insights.requester_approved_count }} solicitudes)
            </p>
            <ul class="space-y-2">
              <li v-for="p in insights.previous" :key="p.id">
                <NuxtLink :to="`/admin/approval-requests/${p.id}`" class="flex justify-between gap-2 text-sm hover:text-indigo-700">
                  <span class="truncate">#{{ p.request_number }} {{ p.title }}</span>
                  <span class="whitespace-nowrap text-xs text-slate-500">{{ approvalStatusLabel(p.status) }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
            <ApprovalRequestEventLog :events="events" :name-of="people.nameOf" :chain-ok="insights?.chain.ok ?? null" />
          </div>
        </aside>
      </div>
    </CardSheet>

    <ApprovalRequestActionDialog
      :open="dialog !== null"
      v-bind="dialogConfig"
      :loading="dialogLoading"
      :error="dialogError"
      @close="dialog = null"
      @confirm="onDialogConfirm"
    />
  </div>
</template>
