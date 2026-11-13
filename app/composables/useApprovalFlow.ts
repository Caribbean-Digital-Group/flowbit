import type {
  ApprovalApproverKind,
  ApprovalCondition,
  ApprovalFieldValues,
  ApprovalFlowRow,
  ApprovalFlowStepApproverRow,
  ApprovalFlowStepRow,
  ApprovalPlanStep,
  ApprovalPriority,
  ApprovalStepMode
} from '~/types/approval.types'

export interface FlowStepWithApprovers extends ApprovalFlowStepRow {
  approvers: ApprovalFlowStepApproverRow[]
}

export interface FlowStepInput {
  id?: string
  sequence: number
  name: string
  mode: ApprovalStepMode
  quorum: number | null
  informative: boolean
  condition: ApprovalCondition | null
  sla_days: number | null
  approvers: Array<{ kind: ApprovalApproverKind; approval_manager_id: string | null }>
}

/**
 * Flujos multinivel. Editar un flujo no afecta solicitudes en curso: el motor
 * copia los niveles en cada solicitud al enviarla (y la versión sube sola).
 */
export const useApprovalFlow = () => {
  const { supabase, lastError, fail, rpc, userId } = useApprovalClient()

  const getFlows = async (companyId: string): Promise<ApprovalFlowRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('approval_flow')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) { fail('fetching approval flows', error); return [] }
    return data ?? []
  }

  const getFlowById = async (id: string, companyId: string): Promise<ApprovalFlowRow | null> => {
    const { data, error } = await supabase
      .from('approval_flow')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching approval flow', error)
    return data
  }

  const getSteps = async (flowId: string): Promise<FlowStepWithApprovers[]> => {
    const { data: steps, error } = await supabase
      .from('approval_flow_step')
      .select('*')
      .eq('flow_id', flowId)
      .eq('active', true)
      .order('sequence')
      .order('created_at')
    if (error) { fail('fetching flow steps', error); return [] }
    const ids = (steps ?? []).map(s => s.id)
    if (!ids.length) return []
    const { data: approvers, error: aError } = await supabase
      .from('approval_flow_step_approver')
      .select('*')
      .in('step_id', ids)
      .eq('active', true)
      .order('created_at')
    if (aError) { fail('fetching flow step approvers', aError); return [] }
    return (steps ?? []).map(step => ({ ...step, approvers: (approvers ?? []).filter(a => a.step_id === step.id) }))
  }

  const createFlow = async (companyId: string, input: { name: string; description: string | null; restart_from_first: boolean | null }): Promise<ApprovalFlowRow | null> => {
    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_flow')
      .insert({ company_id: companyId, ...input, created_by: uid, updated_by: uid })
      .select()
      .maybeSingle()
    if (error) return fail('creating approval flow', error)
    return data
  }

  const updateFlow = async (id: string, input: Partial<Pick<ApprovalFlowRow, 'name' | 'description' | 'restart_from_first'>>): Promise<ApprovalFlowRow | null> => {
    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_flow')
      .update({ ...input, updated_by: uid })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) return fail('updating approval flow', error)
    return data
  }

  const archiveFlow = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('approval_flow').update({ active: false }).eq('id', id)
    if (error) { fail('archiving approval flow', error); return false }
    return true
  }

  /**
   * Guarda los niveles del flujo. Los niveles y aprobadores anteriores se dan de
   * baja (soft-delete) y se crean los nuevos: cada guardado es una versión.
   */
  const saveSteps = async (companyId: string, flowId: string, steps: FlowStepInput[]): Promise<boolean> => {
    const uid = await userId()
    const { error: offError } = await supabase
      .from('approval_flow_step')
      .update({ active: false, updated_by: uid })
      .eq('flow_id', flowId)
      .eq('active', true)
    if (offError) { fail('archiving previous flow steps', offError); return false }

    for (const step of steps) {
      const { data: created, error } = await supabase
        .from('approval_flow_step')
        .insert({
          company_id: companyId,
          flow_id: flowId,
          sequence: step.sequence,
          name: step.name.trim(),
          mode: step.mode,
          quorum: step.mode === 'quorum' ? step.quorum : null,
          informative: step.informative,
          condition: step.condition,
          sla_days: step.sla_days,
          created_by: uid,
          updated_by: uid
        })
        .select('id')
        .maybeSingle()
      if (error || !created) { fail('creating flow step', error ?? { message: 'Sin respuesta' }); return false }

      const approverRows = step.approvers
        .filter(a => a.kind !== 'manager' || a.approval_manager_id)
        .map(a => ({
          company_id: companyId,
          step_id: created.id,
          kind: a.kind,
          approval_manager_id: a.kind === 'manager' ? a.approval_manager_id : null,
          created_by: uid,
          updated_by: uid
        }))
      if (approverRows.length) {
        const { error: aError } = await supabase.from('approval_flow_step_approver').insert(approverRows)
        if (aError) { fail('creating flow step approvers', aError); return false }
      }
    }
    return true
  }

  const simulate = async (input: {
    companyId: string
    categoryId: string
    requesterPartnerId: string
    amount: number | null
    fieldValues: ApprovalFieldValues
    priority: ApprovalPriority
    assignedManagerId?: string | null
  }): Promise<ApprovalPlanStep[] | null> =>
    rpc<ApprovalPlanStep[]>('approval_simulate', {
      p_company_id: input.companyId,
      p_category_id: input.categoryId,
      p_requester_partner_id: input.requesterPartnerId,
      p_amount: input.amount,
      p_field_values: input.fieldValues,
      p_priority: input.priority,
      p_assigned_manager_id: input.assignedManagerId ?? null
    }, 'simulating approval flow')

  return { lastError, getFlows, getFlowById, getSteps, createFlow, updateFlow, archiveFlow, saveSteps, simulate }
}
