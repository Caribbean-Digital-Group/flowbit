import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type ApprovalCategory = Tables<'approval_category'>

export const useApprovalCategory = () => {
  const supabase = useSupabase()

  const getCategoriesByCompany = async (
    companyId: string,
    options?: { includeArchived?: boolean }
  ): Promise<ApprovalCategory[]> => {
    if (!companyId) return []

    let q = supabase
      .from('approval_category')
      .select('*')
      .eq('company_id', companyId)

    if (!options?.includeArchived) {
      q = q.eq('archived', false)
    }

    const { data, error } = await q.order('name', { ascending: true })

    if (error) {
      console.error('Error fetching approval categories:', error)
      return []
    }

    return data ?? []
  }

  /** Categorías disponibles al crear/editar solicitudes (activas y no archivadas). */
  const getSelectableCategoriesForRequests = async (
    companyId: string
  ): Promise<ApprovalCategory[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('approval_category')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .eq('archived', false)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching selectable approval categories:', error)
      return []
    }

    return data ?? []
  }

  const getCategoryById = async (
    id: string,
    companyId: string
  ): Promise<ApprovalCategory | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('approval_category')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching approval category:', error)
      return null
    }

    return data
  }

  const createCategory = async (
    companyId: string,
    payload: Omit<TablesInsert<'approval_category'>, 'company_id'>
  ): Promise<ApprovalCategory | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('approval_category')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating approval category:', error)
      return null
    }

    return data
  }

  const updateCategory = async (
    id: string,
    updates: TablesUpdate<'approval_category'>
  ): Promise<ApprovalCategory | null> => {
    if (!id) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('approval_category')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating approval category:', error)
      return null
    }

    return data
  }

  const archiveCategory = async (id: string): Promise<ApprovalCategory | null> => {
    return updateCategory(id, { archived: true, active: false })
  }

  const restoreCategory = async (id: string): Promise<ApprovalCategory | null> => {
    return updateCategory(id, { archived: false, active: true })
  }

  return {
    getCategoriesByCompany,
    getSelectableCategoriesForRequests,
    getCategoryById,
    createCategory,
    updateCategory,
    archiveCategory,
    restoreCategory
  }
}
