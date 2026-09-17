import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CrmDatabase,
  CrmLostReasonInsert,
  CrmLostReasonRow,
  CrmLostReasonUpdate
} from '~/types/crm.types'

/**
 * CRUD del catálogo de motivos de pérdida (crm_lost_reason).
 * El cast del cliente es temporal hasta regenerar database.types.ts.
 */
export const useCrmLostReason = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<CrmDatabase>

  const getLostReasonsByCompany = async (companyId: string): Promise<CrmLostReasonRow[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('crm_lost_reason')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('sequence', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching CRM lost reasons:', error)
      return []
    }

    return data ?? []
  }

  const getLostReasonById = async (id: string, companyId: string): Promise<CrmLostReasonRow | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('crm_lost_reason')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching CRM lost reason:', error)
      return null
    }

    return data
  }

  const createLostReason = async (
    companyId: string,
    payload: Omit<CrmLostReasonInsert, 'company_id'>
  ): Promise<CrmLostReasonRow | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_lost_reason')
      .insert({ ...payload, company_id: companyId, created_by: user?.id, updated_by: user?.id })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating CRM lost reason:', error)
      return null
    }

    return data
  }

  const updateLostReason = async (
    id: string,
    companyId: string,
    updates: CrmLostReasonUpdate
  ): Promise<CrmLostReasonRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('crm_lost_reason')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating CRM lost reason:', error)
      return null
    }

    return data
  }

  const archiveLostReason = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const user = await useSupabaseUser()

    const { error } = await supabase
      .from('crm_lost_reason')
      .update({ active: false, updated_by: user?.id })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error archiving CRM lost reason:', error)
      return false
    }

    return true
  }

  /** Estadística de uso: cuántos leads perdidos usan cada motivo. */
  const getLostReasonUsage = async (companyId: string): Promise<Record<string, number>> => {
    if (!companyId) return {}

    const { data, error } = await supabase
      .from('crm_lead')
      .select('lost_reason_id')
      .eq('company_id', companyId)
      .eq('active', true)
      .not('lost_reason_id', 'is', null)

    if (error) {
      console.error('Error fetching CRM lost reason usage:', error)
      return {}
    }

    const usage: Record<string, number> = {}
    for (const row of data ?? []) {
      if (row.lost_reason_id) usage[row.lost_reason_id] = (usage[row.lost_reason_id] ?? 0) + 1
    }
    return usage
  }

  const seedDefaultLostReasons = async (companyId: string): Promise<boolean> => {
    if (!companyId) return false

    const { error } = await supabase.rpc('seed_crm_lost_reasons' as never, { p_company_id: companyId } as never)

    if (error) {
      console.error('Error seeding CRM lost reasons:', error)
      return false
    }

    return true
  }

  return {
    getLostReasonsByCompany,
    getLostReasonById,
    createLostReason,
    updateLostReason,
    archiveLostReason,
    getLostReasonUsage,
    seedDefaultLostReasons
  }
}
