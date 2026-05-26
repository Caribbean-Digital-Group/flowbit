import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type CrmLead = Tables<'crm_lead'>
type CrmLeadInsert = TablesInsert<'crm_lead'>
type CrmLeadUpdate = TablesUpdate<'crm_lead'>
type CrmLeadView = Database['public']['Views']['v_crm_leads']['Row']
type CrmLeadOrder = Tables<'crm_lead_order'>

export interface CrmLeadMetrics {
  total: number
  open: number
  won: number
  lost: number
  totalAmount: number
  wonAmount: number
}

export const useCrmLead = () => {
  const supabase = useSupabase()

  const getLeadsByCompany = async (
    companyId: string,
    options?: { active?: boolean; stageId?: string }
  ): Promise<CrmLeadView[]> => {
    if (!companyId) return []

    let query = supabase
      .from('v_crm_leads')
      .select('*')
      .eq('company_id', companyId)

    if (options?.active !== undefined) {
      query = query.eq('active', options.active)
    } else {
      query = query.eq('active', true)
    }

    if (options?.stageId) {
      query = query.eq('stage_id', options.stageId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching CRM leads:', error)
      return []
    }

    return data ?? []
  }

  const getLeadById = async (
    id: string,
    companyId: string
  ): Promise<CrmLead | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('crm_lead')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching CRM lead:', error)
      return null
    }

    return data
  }

  const getLeadViewById = async (
    id: string,
    companyId: string
  ): Promise<CrmLeadView | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('v_crm_leads')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching CRM lead view:', error)
      return null
    }

    return data
  }

  const createLead = async (
    companyId: string,
    payload: Omit<CrmLeadInsert, 'company_id'>
  ): Promise<CrmLead | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_lead')
      .insert({ ...payload, company_id: companyId, created_by: user?.id, updated_by: user?.id })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating CRM lead:', error)
      return null
    }

    return data
  }

  const updateLead = async (
    id: string,
    companyId: string,
    updates: CrmLeadUpdate
  ): Promise<CrmLead | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_lead')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating CRM lead:', error)
      return null
    }

    return data
  }

  const archiveLead = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('crm_lead')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('Error archiving CRM lead:', error)
      return false
    }

    return true
  }

  const getLinkedOrders = async (leadId: string): Promise<CrmLeadOrder[]> => {
    if (!leadId) return []

    const { data, error } = await supabase
      .from('crm_lead_order')
      .select('*')
      .eq('lead_id', leadId)

    if (error) {
      console.error('Error fetching linked orders:', error)
      return []
    }

    return data ?? []
  }

  const linkOrder = async (leadId: string, orderId: string): Promise<boolean> => {
    if (!leadId || !orderId) return false
    const user = await useSupabaseUser()

    const { error } = await supabase
      .from('crm_lead_order')
      .insert({ lead_id: leadId, order_id: orderId, created_by: user?.id })

    if (error) {
      console.error('Error linking order to lead:', error)
      return false
    }

    return true
  }

  const unlinkOrder = async (leadId: string, orderId: string): Promise<boolean> => {
    if (!leadId || !orderId) return false

    const { error } = await supabase
      .from('crm_lead_order')
      .delete()
      .eq('lead_id', leadId)
      .eq('order_id', orderId)

    if (error) {
      console.error('Error unlinking order from lead:', error)
      return false
    }

    return true
  }

  const computeMetrics = (leads: CrmLeadView[]): CrmLeadMetrics => {
    const metrics: CrmLeadMetrics = {
      total: leads.length,
      open: 0,
      won: 0,
      lost: 0,
      totalAmount: 0,
      wonAmount: 0
    }

    for (const lead of leads) {
      if (lead.is_won) {
        metrics.won += 1
        metrics.wonAmount += Number(lead.amount ?? 0)
      } else if (lead.is_lost) {
        metrics.lost += 1
      } else {
        metrics.open += 1
      }
      metrics.totalAmount += Number(lead.amount ?? 0)
    }

    return metrics
  }

  return {
    getLeadsByCompany,
    getLeadById,
    getLeadViewById,
    createLead,
    updateLead,
    archiveLead,
    getLinkedOrders,
    linkOrder,
    unlinkOrder,
    computeMetrics
  }
}
