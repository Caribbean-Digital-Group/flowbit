import type {
  ApprovalBulkResult,
  ApprovalFieldValues,
  ApprovalInsights,
  ApprovalMyPendingRow,
  ApprovalPlanStep,
  ApprovalPriority,
  ApprovalRequestApproverRow,
  ApprovalRequestAttachmentRow,
  ApprovalRequestCommentRow,
  ApprovalRequestEventRow,
  ApprovalRequestInsert,
  ApprovalRequestLineRow,
  ApprovalRequestRow,
  ApprovalRequestStepRow,
  ApprovalRequestTemplateRow,
  ApprovalRequestUpdate,
  ApprovalRequestViewRow,
  ApprovalTemplatePayload
} from '~/types/approval.types'

export interface ApprovalLineDraft {
  id?: string
  concept: string
  quantity: number
  unit_price: number
  product_id?: string | null
}

export interface ApprovalStepWithApprovers extends ApprovalRequestStepRow {
  approvers: ApprovalRequestApproverRow[]
}

type RpcResult<T> = { data: T | null; errorMessage: string | null }

const ATTACHMENT_BUCKET = 'approval-attachments'

/**
 * Solicitudes de aprobación: lectura (RLS decide qué ve cada quien) y acciones
 * del motor. El estado nunca se escribe a mano: siempre por RPC.
 */
export const useApprovalRequest = () => {
  const { supabase, lastError, fail, rpc, userId } = useApprovalClient()

  // ─── Lectura ──────────────────────────────────────────────────────────────

  const getRequestsByCompany = async (companyId: string): Promise<ApprovalRequestViewRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('v_approval_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (error) { fail('fetching approval requests', error); return [] }
    return data ?? []
  }

  /** Bandeja «Pendientes de mi aprobación». */
  const getMyPending = async (companyId: string): Promise<ApprovalMyPendingRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('v_approval_my_pending')
      .select('*')
      .eq('company_id', companyId)
      .order('due_at', { ascending: true, nullsFirst: false })
    if (error) { fail('fetching my pending approvals', error); return [] }
    return data ?? []
  }

  /** Compatibilidad: solicitudes en revisión donde tengo una aprobación pendiente. */
  const getPublishedRequestsForMyManager = async (companyId: string): Promise<ApprovalRequestViewRow[]> => {
    const pending = await getMyPending(companyId)
    if (!pending.length) return []
    const ids = [...new Set(pending.map(p => p.request_id))]
    const { data, error } = await supabase
      .from('v_approval_requests')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false })
    if (error) { fail('fetching pending approval requests', error); return [] }
    return data ?? []
  }

  const getRequestById = async (id: string, companyId: string): Promise<ApprovalRequestRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('approval_request')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching approval request', error)
    return data
  }

  const getRequestViewById = async (id: string, companyId: string): Promise<ApprovalRequestViewRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('v_approval_requests')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching approval request view', error)
    return data
  }

  /** Niveles de todas las rondas con sus aprobadores (línea de tiempo). */
  const getSteps = async (requestId: string): Promise<ApprovalStepWithApprovers[]> => {
    const [steps, approvers] = await Promise.all([
      supabase.from('approval_request_step').select('*').eq('request_id', requestId)
        .order('round', { ascending: true }).order('sequence', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('approval_request_approver').select('*').eq('request_id', requestId).order('created_at', { ascending: true })
    ])
    if (steps.error) { fail('fetching approval steps', steps.error); return [] }
    if (approvers.error) { fail('fetching approval approvers', approvers.error); return [] }
    return (steps.data ?? []).map(step => ({
      ...step,
      approvers: (approvers.data ?? []).filter(a => a.step_id === step.id)
    }))
  }

  const getEvents = async (requestId: string): Promise<ApprovalRequestEventRow[]> => {
    const { data, error } = await supabase
      .from('approval_request_event')
      .select('*')
      .eq('request_id', requestId)
      .order('seq', { ascending: true })
    if (error) { fail('fetching approval events', error); return [] }
    return data ?? []
  }

  const getComments = async (requestId: string): Promise<ApprovalRequestCommentRow[]> => {
    const { data, error } = await supabase
      .from('approval_request_comment')
      .select('*')
      .eq('request_id', requestId)
      .eq('active', true)
      .order('created_at', { ascending: true })
    if (error) { fail('fetching approval comments', error); return [] }
    return data ?? []
  }

  const getLines = async (requestId: string): Promise<ApprovalRequestLineRow[]> => {
    const { data, error } = await supabase
      .from('approval_request_line')
      .select('*')
      .eq('request_id', requestId)
      .eq('active', true)
      .order('sequence', { ascending: true })
    if (error) { fail('fetching approval lines', error); return [] }
    return data ?? []
  }

  const getAttachments = async (requestId: string): Promise<ApprovalRequestAttachmentRow[]> => {
    const { data, error } = await supabase
      .from('approval_request_attachment')
      .select('*')
      .eq('request_id', requestId)
      .eq('active', true)
      .order('created_at', { ascending: true })
    if (error) { fail('fetching approval attachments', error); return [] }
    return data ?? []
  }

  // ─── Borradores ───────────────────────────────────────────────────────────

  const createRequest = async (
    companyId: string,
    requestingPartnerId: string,
    payload: Omit<ApprovalRequestInsert, 'company_id' | 'requesting_partner_id' | 'status' | 'request_number'>
  ): Promise<ApprovalRequestRow | null> => {
    if (!companyId || !requestingPartnerId) return null
    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_request')
      .insert({
        ...payload,
        company_id: companyId,
        requesting_partner_id: requestingPartnerId,
        status: 'draft',
        created_by: uid,
        updated_by: uid
      })
      .select()
      .maybeSingle()
    if (error) return fail('creating approval request', error)
    return data
  }

  /** Edita el contenido mientras está en borrador o devuelta (RLS lo exige). */
  const updateDraftRequest = async (
    id: string,
    companyId: string,
    updates: ApprovalRequestUpdate
  ): Promise<ApprovalRequestRow | null> => {
    if (!id || !companyId) return null
    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_request')
      .update({ ...updates, updated_by: uid })
      .eq('id', id)
      .eq('company_id', companyId)
      .in('status', ['draft', 'returned'])
      .select()
      .maybeSingle()
    if (error) return fail('updating approval request', error)
    if (!data) lastError.value = 'Solo se edita una solicitud en borrador o devuelta.'
    return data
  }

  /** Reemplaza las partidas de un borrador. */
  const saveLines = async (companyId: string, requestId: string, lines: ApprovalLineDraft[]): Promise<boolean> => {
    const uid = await userId()
    // Baja lógica de las partidas anteriores (el monto se recalcula con las activas)
    const { error: delError } = await supabase
      .from('approval_request_line')
      .update({ active: false, updated_by: uid })
      .eq('request_id', requestId)
      .eq('active', true)
    if (delError) { fail('clearing approval lines', delError); return false }
    const rows = lines
      .filter(l => l.concept.trim() && Number(l.quantity) > 0)
      .map((l, index) => ({
        company_id: companyId,
        request_id: requestId,
        sequence: index + 1,
        concept: l.concept.trim(),
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price) || 0,
        product_id: l.product_id || null,
        created_by: uid,
        updated_by: uid
      }))
    if (!rows.length) return true
    const { error } = await supabase.from('approval_request_line').insert(rows)
    if (error) { fail('saving approval lines', error); return false }
    return true
  }

  // ─── Adjuntos ─────────────────────────────────────────────────────────────

  const uploadAttachment = async (
    companyId: string,
    requestId: string,
    partnerId: string,
    file: File
  ): Promise<ApprovalRequestAttachmentRow | null> => {
    const safeName = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-120)
    const path = `${companyId}/${requestId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false
    })
    if (uploadError) return fail('uploading attachment', uploadError)

    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_request_attachment')
      .insert({
        company_id: companyId,
        request_id: requestId,
        storage_path: path,
        file_name: file.name.slice(0, 255),
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by_partner_id: partnerId,
        created_by: uid,
        updated_by: uid
      })
      .select()
      .maybeSingle()
    if (error) return fail('registering attachment', error)
    return data
  }

  /** Baja lógica: el archivo se conserva para la bitácora. */
  const removeAttachment = async (attachmentId: string): Promise<boolean> => {
    const { error } = await supabase.from('approval_request_attachment').update({ active: false }).eq('id', attachmentId)
    if (error) { fail('removing attachment', error); return false }
    return true
  }

  const getAttachmentUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, 300)
    if (error) return fail('signing attachment url', error)
    return data?.signedUrl ?? null
  }

  // ─── Acciones del motor ───────────────────────────────────────────────────

  const action = async (fn: string, args: Record<string, unknown>, context: string): Promise<RpcResult<ApprovalRequestRow>> => {
    const data = await rpc<ApprovalRequestRow>(fn, args, context)
    return { data, errorMessage: data ? null : lastError.value }
  }

  const submitRequest = (requestId: string) =>
    action('approval_submit_request', { p_request_id: requestId }, 'submitting approval request')

  /** Compatibilidad con la firma anterior. */
  const publishRequest = submitRequest

  const decide = (requestId: string, decision: 'approve' | 'reject', comment?: string | null, reasonId?: string | null) =>
    action('approval_decide', {
      p_request_id: requestId,
      p_decision: decision,
      p_comment: comment ?? null,
      p_reason_id: reasonId ?? null
    }, `${decision} approval request`)

  const approveRequest = (requestId: string, comment?: string | null) => decide(requestId, 'approve', comment)
  const rejectRequest = (requestId: string, comment?: string | null, reasonId?: string | null) =>
    decide(requestId, 'reject', comment, reasonId)

  const returnRequest = (requestId: string, comment: string) =>
    action('approval_return_request', { p_request_id: requestId, p_comment: comment }, 'returning approval request')

  const revokeDecision = (requestId: string, reason: string) =>
    action('approval_revoke_decision', { p_request_id: requestId, p_reason: reason }, 'revoking approval')

  const addApprover = (requestId: string, partnerId: string, reason: string, parallel = false) =>
    action('approval_add_approver', {
      p_request_id: requestId, p_partner_id: partnerId, p_reason: reason, p_parallel: parallel
    }, 'adding approver')

  const reassign = (approverId: string, toPartnerId: string, reason: string) =>
    action('approval_reassign', { p_approver_id: approverId, p_to_partner_id: toPartnerId, p_reason: reason }, 'reassigning approval')

  const forceResolve = (requestId: string, decision: 'approve' | 'reject', reason: string) =>
    action('approval_force_resolve', { p_request_id: requestId, p_decision: decision, p_reason: reason }, 'forcing approval resolution')

  const updateSubmitted = (requestId: string, changes: Partial<{
    title: string
    description: string | null
    amount: number | null
    currency: string
    due_date: string | null
    priority: ApprovalPriority
    reference: string | null
    field_values: ApprovalFieldValues
  }>) => action('approval_update_submitted', { p_request_id: requestId, p_changes: changes }, 'editing submitted request')

  const cancelRequest = (requestId: string, reason?: string | null) =>
    action('approval_cancel_with_reason', { p_request_id: requestId, p_reason: reason ?? null }, 'cancelling approval request')

  const resetRequestToDraft = (requestId: string) =>
    action('approval_reset_request_to_draft', { p_request_id: requestId }, 'resetting approval request')

  const bulkDecide = async (
    requestIds: string[],
    decision: 'approve' | 'reject',
    comment?: string | null,
    reasonId?: string | null
  ): Promise<ApprovalBulkResult[]> =>
    await rpc<ApprovalBulkResult[]>('approval_bulk_decide', {
      p_request_ids: requestIds,
      p_decision: decision,
      p_comment: comment ?? null,
      p_reason_id: reasonId ?? null
    }, 'bulk deciding approvals') ?? []

  const addComment = async (requestId: string, body: string, mentions: string[] = []): Promise<ApprovalRequestCommentRow | null> =>
    rpc<ApprovalRequestCommentRow>('approval_add_comment', {
      p_request_id: requestId, p_body: body, p_mentions: mentions
    }, 'adding approval comment')

  const previewRequest = async (requestId: string): Promise<ApprovalPlanStep[]> =>
    await rpc<ApprovalPlanStep[]>('approval_preview_request', { p_request_id: requestId }, 'previewing approval flow') ?? []

  const getInsights = async (requestId: string): Promise<ApprovalInsights | null> =>
    rpc<ApprovalInsights>('approval_request_insights', { p_request_id: requestId }, 'fetching approval insights')

  // ─── Plantillas ───────────────────────────────────────────────────────────

  const getTemplates = async (companyId: string): Promise<ApprovalRequestTemplateRow[]> => {
    const { data, error } = await supabase
      .from('approval_request_template')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) { fail('fetching approval templates', error); return [] }
    return data ?? []
  }

  const saveTemplate = async (input: {
    companyId: string
    ownerPartnerId: string | null
    name: string
    categoryId: string
    payload: ApprovalTemplatePayload
    recurrence?: 'weekly' | 'monthly' | null
    nextRunOn?: string | null
  }): Promise<ApprovalRequestTemplateRow | null> => {
    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_request_template')
      .insert({
        company_id: input.companyId,
        owner_partner_id: input.ownerPartnerId,
        name: input.name.trim(),
        category_id: input.categoryId,
        payload: input.payload,
        recurrence: input.recurrence ?? null,
        next_run_on: input.recurrence ? (input.nextRunOn ?? null) : null,
        created_by: uid,
        updated_by: uid
      })
      .select()
      .maybeSingle()
    if (error) return fail('saving approval template', error)
    return data
  }

  const archiveTemplate = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('approval_request_template').update({ active: false }).eq('id', id)
    if (error) { fail('archiving approval template', error); return false }
    return true
  }

  return {
    lastError,
    getRequestsByCompany,
    getMyPending,
    getPublishedRequestsForMyManager,
    getRequestById,
    getRequestViewById,
    getSteps,
    getEvents,
    getComments,
    getLines,
    getAttachments,
    createRequest,
    updateDraftRequest,
    saveLines,
    uploadAttachment,
    removeAttachment,
    getAttachmentUrl,
    submitRequest,
    publishRequest,
    decide,
    approveRequest,
    rejectRequest,
    returnRequest,
    revokeDecision,
    addApprover,
    reassign,
    forceResolve,
    updateSubmitted,
    cancelRequest,
    resetRequestToDraft,
    bulkDecide,
    addComment,
    previewRequest,
    getInsights,
    getTemplates,
    saveTemplate,
    archiveTemplate
  }
}
