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

  /**
   * Crea una empresa nueva con la persona con sesión como owner (RPC
   * `create_company`, TRY-76). Devuelve el id o un mensaje de error para la UI.
   * El RPC se invoca sin tipos hasta regenerar `database.types.ts`.
   */
  const createCompany = async (
    input: { name: string; currency?: string; countryCode?: string }
  ): Promise<{ id: string | null; error: string | null }> => {
    const { data, error } = await supabase.rpc(
      'create_company' as never,
      {
        p_name: input.name.trim(),
        p_currency: input.currency || 'MXN',
        p_country_code: input.countryCode || 'MX'
      } as never
    ) as {
      data: string | null
      error: { code?: string; message?: string; hint?: string | null } | null
    }

    if (error || !data) {
      console.error('Error creating company:', error)
      return { id: null, error: describeCreateCompanyError(error) }
    }

    return { id: data, error: null }
  }

  /** Marca la empresa que se abre al iniciar sesión (RPC `set_default_company`). */
  const setDefaultCompany = async (companyId: string): Promise<boolean> => {
    const { error } = await supabase.rpc(
      'set_default_company' as never,
      { p_company_id: companyId } as never
    ) as { error: { message?: string } | null }

    if (error) {
      console.error('Error setting default company:', error)
      return false
    }

    return true
  }

  return {
    getCompanyById,
    updateCompany,
    createCompany,
    setDefaultCompany
  }
}
