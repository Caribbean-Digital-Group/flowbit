import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type CrmActivity = Tables<'crm_activity'>
type CrmActivityInsert = TablesInsert<'crm_activity'>
type CrmActivityUpdate = TablesUpdate<'crm_activity'>
type CrmActivityView = Database['public']['Views']['v_crm_activities']['Row']
type CrmHistoryView = Database['public']['Views']['v_crm_history']['Row']

export const useCrmActivity = () => {
  const supabase = useSupabase()

  const getActivitiesByLead = async (leadId: string): Promise<CrmActivityView[]> => {
    if (!leadId) return []

    const { data, error } = await supabase
      .from('v_crm_activities')
      .select('*')
      .eq('lead_id', leadId)
      .eq('active', true)
      .order('scheduled_at', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching CRM activities:', error)
      return []
    }

    return data ?? []
  }

  const getActivitiesByCompany = async (companyId: string): Promise<CrmActivityView[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('v_crm_activities')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('scheduled_at', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching CRM activities by company:', error)
      return []
    }

    return data ?? []
  }

  const createActivity = async (
    companyId: string,
    payload: Omit<CrmActivityInsert, 'company_id'>
  ): Promise<CrmActivity | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_activity')
      .insert({ ...payload, company_id: companyId, created_by: user?.id, updated_by: user?.id })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating CRM activity:', error)
      return null
    }

    return data
  }

  const updateActivity = async (
    id: string,
    updates: CrmActivityUpdate
  ): Promise<CrmActivity | null> => {
    if (!id) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_activity')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating CRM activity:', error)
      return null
    }

    return data
  }

  const markAsDone = async (id: string): Promise<boolean> => {
    if (!id) return false
    const user = await useSupabaseUser()

    const { error } = await supabase
      .from('crm_activity')
      .update({ status: 'done', done_at: new Date().toISOString(), updated_by: user?.id })
      .eq('id', id)

    if (error) {
      console.error('Error marking CRM activity as done:', error)
      return false
    }

    return true
  }

  const archiveActivity = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('crm_activity')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('Error archiving CRM activity:', error)
      return false
    }

    return true
  }

  const getHistoryByLead = async (leadId: string): Promise<CrmHistoryView[]> => {
    if (!leadId) return []

    const { data, error } = await supabase
      .from('v_crm_history')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching CRM history:', error)
      return []
    }

    return data ?? []
  }

  return {
    getActivitiesByLead,
    getActivitiesByCompany,
    createActivity,
    updateActivity,
    markAsDone,
    archiveActivity,
    getHistoryByLead
  }
}
