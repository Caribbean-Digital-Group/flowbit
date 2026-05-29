import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type PaymentMethod = Tables<'payment_method'>

export const usePaymentMethod = () => {
  const supabase = useSupabase()
  const user = useSupabaseUser()

  const getAllByCompany = async (companyId: string): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase
      .from('payment_method')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) { console.error('Error fetching payment methods:', error); return [] }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<PaymentMethod | null> => {
    const { data, error } = await supabase
      .from('payment_method')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()
    if (error) { console.error('Error fetching payment method:', error); return null }
    return data
  }

  const create = async (
    companyId: string,
    payload: Omit<TablesInsert<'payment_method'>, 'company_id'>
  ): Promise<PaymentMethod | null> => {
    const { data, error } = await supabase
      .from('payment_method')
      .insert({ ...payload, company_id: companyId, created_by: user.value?.id, updated_by: user.value?.id })
      .select()
      .single()
    if (error) { console.error('Error creating payment method:', error); return null }
    return data
  }

  const update = async (
    id: string,
    companyId: string,
    updates: TablesUpdate<'payment_method'>
  ): Promise<PaymentMethod | null> => {
    const { data, error } = await supabase
      .from('payment_method')
      .update({ ...updates, updated_by: user.value?.id })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()
    if (error) { console.error('Error updating payment method:', error); return null }
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('payment_method')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) { console.error('Error archiving payment method:', error); return false }
    return true
  }

  return { getAllByCompany, getById, create, update, archive }
}
