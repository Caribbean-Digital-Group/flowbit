import type { ApprovalActivityRow } from '~/types/approval.types'

/**
 * Avisos del motor de aprobaciones (no hay correo): los lee la campana del
 * panel y la agenda. Cada persona solo ve los suyos (RLS).
 */
export const useApprovalActivity = () => {
  const { supabase, lastError, fail, rpc } = useApprovalClient()

  /** Avisos abiertos: los de acción hasta decidir y los informativos hasta leerse. */
  const getOpenActivities = async (companyId: string, partnerId: string, limit = 50): Promise<ApprovalActivityRow[]> => {
    if (!companyId || !partnerId) return []
    const { data, error } = await supabase
      .from('approval_activity')
      .select('*')
      .eq('company_id', companyId)
      .eq('partner_id', partnerId)
      .is('done_at', null)
      .order('actionable', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(limit)
    if (error) { fail('fetching approval activities', error); return [] }
    return data ?? []
  }

  const markRead = async (activityIds: string[] | null, companyId?: string): Promise<number> =>
    await rpc<number>('approval_mark_activities_read', {
      p_activity_ids: activityIds,
      p_company_id: companyId ?? null
    }, 'marking approval activities as read') ?? 0

  return { lastError, getOpenActivities, markRead }
}
