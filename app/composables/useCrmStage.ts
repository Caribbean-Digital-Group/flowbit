import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type CrmLeadStage = Tables<'crm_lead_stage'>
type CrmLeadStageInsert = TablesInsert<'crm_lead_stage'>
type CrmLeadStageUpdate = TablesUpdate<'crm_lead_stage'>

export const useCrmStage = () => {
  const supabase = useSupabase()

  const getStagesByCompany = async (companyId: string): Promise<CrmLeadStage[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('crm_lead_stage')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('sequence', { ascending: true })

    if (error) {
      console.error('Error fetching CRM stages:', error)
      return []
    }

    return data ?? []
  }

  const getStageById = async (
    id: string,
    companyId: string
  ): Promise<CrmLeadStage | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('crm_lead_stage')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching CRM stage:', error)
      return null
    }

    return data
  }

  const createStage = async (
    companyId: string,
    payload: Omit<CrmLeadStageInsert, 'company_id'>
  ): Promise<CrmLeadStage | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_lead_stage')
      .insert({ ...payload, company_id: companyId, created_by: user?.id, updated_by: user?.id })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating CRM stage:', error)
      return null
    }

    return data
  }

  const updateStage = async (
    id: string,
    companyId: string,
    updates: CrmLeadStageUpdate
  ): Promise<CrmLeadStage | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_lead_stage')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating CRM stage:', error)
      return null
    }

    return data
  }

  const archiveStage = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('crm_lead_stage')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('Error archiving CRM stage:', error)
      return false
    }

    return true
  }

  const seedDefaultStages = async (companyId: string): Promise<boolean> => {
    const { error } = await supabase.rpc('seed_crm_stages', { p_company_id: companyId })

    if (error) {
      console.error('Error seeding CRM stages:', error)
      return false
    }

    return true
  }

  return {
    getStagesByCompany,
    getStageById,
    createStage,
    updateStage,
    archiveStage,
    seedDefaultStages
  }
}
