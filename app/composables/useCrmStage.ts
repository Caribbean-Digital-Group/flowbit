import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CrmDatabase,
  CrmLeadStageRow as CrmLeadStage,
  CrmLeadStageInsert,
  CrmLeadStageUpdate
} from '~/types/crm.types'

export const useCrmStage = () => {
  // Cast temporal hasta regenerar database.types.ts (ver types/crm.types.ts)
  const supabase = useSupabase() as unknown as SupabaseClient<CrmDatabase>

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

  const archiveStage = async (id: string, companyId?: string): Promise<boolean> => {
    if (!id) return false
    const user = await useSupabaseUser()

    let query = supabase
      .from('crm_lead_stage')
      .update({ active: false, updated_by: user?.id })
      .eq('id', id)

    if (companyId) query = query.eq('company_id', companyId)

    const { error } = await query

    if (error) {
      console.error('Error archiving CRM stage:', error)
      return false
    }

    return true
  }

  /** Leads activos en la etapa; una etapa con leads no debe archivarse. */
  const countActiveLeadsInStage = async (stageId: string, companyId: string): Promise<number> => {
    if (!stageId || !companyId) return 0

    const { count, error } = await supabase
      .from('crm_lead')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('stage_id', stageId)
      .eq('active', true)

    if (error) {
      console.error('Error counting leads in CRM stage:', error)
      return 0
    }

    return count ?? 0
  }

  /** Reordena etapas asignando `sequence` de 10 en 10 según el arreglo recibido. */
  const reorderStages = async (companyId: string, orderedIds: string[]): Promise<boolean> => {
    if (!companyId || orderedIds.length === 0) return false
    const user = await useSupabaseUser()

    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from('crm_lead_stage')
          .update({ sequence: (index + 1) * 10, updated_by: user?.id })
          .eq('id', id)
          .eq('company_id', companyId)
      )
    )

    const failed = results.find(r => r.error)
    if (failed?.error) {
      console.error('Error reordering CRM stages:', failed.error)
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
    countActiveLeadsInStage,
    reorderStages,
    seedDefaultStages
  }
}
