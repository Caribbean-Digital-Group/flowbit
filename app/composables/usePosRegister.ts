import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type PosRegister = Tables<'pos_register'>
type PosRegisterInsert = TablesInsert<'pos_register'>
type PosRegisterUpdate = TablesUpdate<'pos_register'>

export const usePosRegister = () => {
  const supabase = useSupabase()

  const getAllByCompany = async (
    companyId: string,
    options?: { activeOnly?: boolean }
  ): Promise<PosRegister[]> => {
    if (!companyId) return []

    let query = supabase
      .from('pos_register')
      .select('*')
      .eq('company_id', companyId)
      .order('name')

    if (options?.activeOnly !== false) {
      query = query.eq('active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching POS registers:', error)
      return []
    }

    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<PosRegister | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('pos_register')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching POS register:', error)
      return null
    }

    return data
  }

  const create = async (
    companyId: string,
    payload: Omit<PosRegisterInsert, 'company_id'>
  ): Promise<PosRegister | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('pos_register')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating POS register:', error)
      return null
    }

    return data
  }

  const update = async (
    id: string,
    companyId: string,
    updates: PosRegisterUpdate
  ): Promise<PosRegister | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('pos_register')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating POS register:', error)
      return null
    }

    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!companyId) return false

    const { error } = await supabase
      .from('pos_register')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error archiving POS register:', error)
      return false
    }

    return true
  }

  return { getAllByCompany, getById, create, update, archive }
}
