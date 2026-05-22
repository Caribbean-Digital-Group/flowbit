import type { Tables, TablesUpdate } from '~/types/database.types'

type Company = Tables<'company'>
type CompanyUpdate = TablesUpdate<'company'>

export const useCompany = () => {
  const supabase = useSupabase()

  const getCompanyById = async (id: string): Promise<Company | null> => {
    const { data, error } = await supabase
      .from('company')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching company:', error)
      return null
    }

    return data
  }

  /**
   * Get the current user's default company via rel_partner_company
   */
  const getCurrentCompany = async (): Promise<Company | null> => {
    const user = await useSupabaseUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('v_partner_companies')
      .select('company_id')
      .eq('partner_email', user.email)
      .eq('is_default', true)
      .single()

    if (error || !data?.company_id) {
      console.error('Error fetching current company:', error)
      return null
    }

    return getCompanyById(data.company_id)
  }

  const updateCompany = async (id: string, updates: CompanyUpdate): Promise<Company | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('company')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating company:', error)
      return null
    }

    return data
  }

  return {
    getCompanyById,
    getCurrentCompany,
    updateCompany
  }
}
