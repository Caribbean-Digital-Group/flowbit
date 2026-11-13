import type {
  ApprovalDashboard,
  ApprovalDelegationRow,
  ApprovalImportReport,
  ApprovalRejectionReasonRow,
  ApprovalSettingsRow
} from '~/types/approval.types'

/** Valores por defecto cuando la empresa aún no tiene fila de ajustes. */
export const defaultApprovalSettings = (companyId: string): ApprovalSettingsRow => ({
  company_id: companyId,
  advanced_enabled: false,
  restart_from_first: true,
  prevent_self_approval: true,
  self_approval_fallback: 'next_level',
  dedupe_consecutive: true,
  require_reject_reason: true,
  notify_requester_each_level: false,
  default_sla_days: null,
  reminder_every_hours: 24,
  escalation_action: 'remind',
  expire_after_days: null,
  created_at: '',
  updated_at: '',
  created_by: null,
  updated_by: null
})

/**
 * Ajustes del motor, motivos de rechazo, delegaciones, tablero y
 * herramientas de administración (exportar/importar, ejemplos, plazos).
 */
export const useApprovalSettings = () => {
  const { supabase, lastError, fail, rpc, userId } = useApprovalClient()

  const getSettings = async (companyId: string): Promise<ApprovalSettingsRow> => {
    const { data, error } = await supabase
      .from('approval_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) fail('fetching approval settings', error)
    return data ?? defaultApprovalSettings(companyId)
  }

  const saveSettings = async (companyId: string, updates: Partial<ApprovalSettingsRow>): Promise<ApprovalSettingsRow | null> => {
    const uid = await userId()
    const { company_id: _c, created_at: _a, updated_at: _u, created_by: _cb, ...rest } = updates
    const { data, error } = await supabase
      .from('approval_settings')
      .upsert({ ...rest, company_id: companyId, updated_by: uid }, { onConflict: 'company_id' })
      .select()
      .maybeSingle()
    if (error) return fail('saving approval settings', error)
    return data
  }

  // ─── Motivos de rechazo ───────────────────────────────────────────────────

  const getRejectionReasons = async (companyId: string): Promise<ApprovalRejectionReasonRow[]> => {
    const { data, error } = await supabase
      .from('approval_rejection_reason')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) { fail('fetching rejection reasons', error); return [] }
    return data ?? []
  }

  const addRejectionReason = async (companyId: string, name: string): Promise<ApprovalRejectionReasonRow | null> => {
    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_rejection_reason')
      .insert({ company_id: companyId, name: name.trim(), created_by: uid, updated_by: uid })
      .select()
      .maybeSingle()
    if (error) return fail('adding rejection reason', error)
    return data
  }

  const archiveRejectionReason = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('approval_rejection_reason').update({ active: false }).eq('id', id)
    if (error) { fail('archiving rejection reason', error); return false }
    return true
  }

  // ─── Delegaciones ─────────────────────────────────────────────────────────

  const getDelegations = async (companyId: string): Promise<ApprovalDelegationRow[]> => {
    const { data, error } = await supabase
      .from('approval_delegation')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (error) { fail('fetching delegations', error); return [] }
    return data ?? []
  }

  const createDelegation = async (input: {
    companyId: string
    fromPartnerId: string
    toPartnerId: string
    categoryId: string | null
    startsOn: string | null
    endsOn: string | null
    reason: string | null
  }): Promise<ApprovalDelegationRow | null> => {
    const uid = await userId()
    const { data, error } = await supabase
      .from('approval_delegation')
      .insert({
        company_id: input.companyId,
        from_partner_id: input.fromPartnerId,
        to_partner_id: input.toPartnerId,
        category_id: input.categoryId,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        reason: input.reason,
        created_by: uid,
        updated_by: uid
      })
      .select()
      .maybeSingle()
    if (error) return fail('creating delegation', error)
    return data
  }

  const endDelegation = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('approval_delegation').update({ active: false }).eq('id', id)
    if (error) { fail('ending delegation', error); return false }
    return true
  }

  // ─── Tablero y administración ─────────────────────────────────────────────

  const getDashboard = async (companyId: string, from: string, to: string): Promise<ApprovalDashboard | null> =>
    rpc<ApprovalDashboard>('approval_dashboard', { p_company_id: companyId, p_from: from, p_to: to }, 'fetching approval dashboard')

  const exportConfig = async (companyId: string): Promise<Record<string, unknown> | null> =>
    rpc<Record<string, unknown>>('approval_export_config', { p_company_id: companyId }, 'exporting approval config')

  const importConfig = async (companyId: string, config: unknown): Promise<ApprovalImportReport | null> =>
    rpc<ApprovalImportReport>('approval_import_config', { p_company_id: companyId, p_config: config }, 'importing approval config')

  const loadDemo = async (companyId: string): Promise<ApprovalImportReport | null> =>
    rpc<ApprovalImportReport>('approval_load_demo', { p_company_id: companyId }, 'loading approval demo')

  const runSlaNow = async (companyId: string): Promise<Record<string, number> | null> =>
    rpc<Record<string, number>>('approval_run_sla_now', { p_company_id: companyId }, 'running approval SLA')

  return {
    lastError,
    getSettings,
    saveSettings,
    getRejectionReasons,
    addRejectionReason,
    archiveRejectionReason,
    getDelegations,
    createDelegation,
    endDelegation,
    getDashboard,
    exportConfig,
    importConfig,
    loadDemo,
    runSlaNow
  }
}
