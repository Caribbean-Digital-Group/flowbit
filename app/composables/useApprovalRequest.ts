import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type ApprovalRequestView = Database['public']['Views']['v_approval_requests']['Row']
type ApprovalRequest = Tables<'approval_request'>

export const useApprovalRequest = () => {
  const supabase = useSupabase()

  const getRequestsByCompany = async (companyId: string): Promise<ApprovalRequestView[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('v_approval_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching approval requests:', error)
      return []
    }

    return (data ?? []) as ApprovalRequestView[]
  }

  const getRequestById = async (
    id: string,
    companyId: string
  ): Promise<ApprovalRequest | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('approval_request')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching approval request:', error)
      return null
    }

    return data
  }

  const getRequestViewById = async (
    id: string,
    companyId: string
  ): Promise<ApprovalRequestView | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('v_approval_requests')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching approval request view:', error)
      return null
    }

    return data as ApprovalRequestView | null
  }

  const createRequest = async (
    companyId: string,
    requestingPartnerId: string,
    payload: Omit<
      TablesInsert<'approval_request'>,
      'company_id' | 'requesting_partner_id' | 'status' | 'request_number'
    >
  ): Promise<ApprovalRequest | null> => {
    if (!companyId || !requestingPartnerId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('approval_request')
      .insert({
        ...payload,
        company_id: companyId,
        requesting_partner_id: requestingPartnerId,
        status: 'draft',
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating approval request:', error)
      return null
    }

    return data
  }

  const updateDraftRequest = async (
    id: string,
    companyId: string,
    updates: TablesUpdate<'approval_request'>
  ): Promise<ApprovalRequest | null> => {
    if (!id || !companyId) return null

    const current = await getRequestById(id, companyId)
    if (!current || current.status !== 'draft') {
      return null
    }

    const user = await useSupabaseUser()
    const { status: _omit, request_number: _rn, ...safe } = updates

    const { data, error } = await supabase
      .from('approval_request')
      .update({
        ...safe,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('status', 'draft')
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating approval request:', error)
      return null
    }

    return data
  }

  const updateRequestAsAdmin = async (
    id: string,
    companyId: string,
    updates: TablesUpdate<'approval_request'>
  ): Promise<ApprovalRequest | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('approval_request')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating approval request as admin:', error)
      return null
    }

    return data
  }

  const callApprovalRpc = async (
    name:
      | 'approval_publish_request'
      | 'approval_approve_request'
      | 'approval_reject_request'
      | 'approval_cancel_request'
      | 'approval_reset_request_to_draft',
    requestId: string
  ): Promise<{ data: ApprovalRequest | null; errorMessage: string | null }> => {
    const { data, error } = await supabase.rpc(name as never, {
      p_request_id: requestId
    } as never)

    if (error) {
      console.error(`Error RPC ${name}:`, error.message)
      return { data: null, errorMessage: error.message }
    }

    return { data: data as ApprovalRequest, errorMessage: null }
  }

  const publishRequest = async (
    requestId: string
  ): Promise<{ data: ApprovalRequest | null; errorMessage: string | null }> =>
    callApprovalRpc('approval_publish_request', requestId)

  const approveRequest = async (
    requestId: string
  ): Promise<{ data: ApprovalRequest | null; errorMessage: string | null }> =>
    callApprovalRpc('approval_approve_request', requestId)

  const rejectRequest = async (
    requestId: string
  ): Promise<{ data: ApprovalRequest | null; errorMessage: string | null }> =>
    callApprovalRpc('approval_reject_request', requestId)

  const cancelRequest = async (
    requestId: string
  ): Promise<{ data: ApprovalRequest | null; errorMessage: string | null }> =>
    callApprovalRpc('approval_cancel_request', requestId)

  const resetRequestToDraft = async (
    requestId: string
  ): Promise<{ data: ApprovalRequest | null; errorMessage: string | null }> =>
    callApprovalRpc('approval_reset_request_to_draft', requestId)

  return {
    getRequestsByCompany,
    getRequestById,
    getRequestViewById,
    createRequest,
    updateDraftRequest,
    updateRequestAsAdmin,
    publishRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    resetRequestToDraft
  }
}
