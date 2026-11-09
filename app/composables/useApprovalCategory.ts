import type { ApprovalCategoryInsert, ApprovalCategoryRow, ApprovalCategoryUpdate } from '~/types/approval.types'

type ApprovalCategory = ApprovalCategoryRow

export const useApprovalCategory = () => {
  const { supabase, lastError } = useApprovalClient()

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

  /**
   * Categorías disponibles al crear/editar solicitudes (activas y no archivadas).
   * Las reservadas para otro módulo (p. ej. permisos de RR. HH.) se crean desde su módulo.
   */
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
      .is('source_kind', null)
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
    payload: Omit<ApprovalCategoryInsert, 'company_id'>
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
      lastError.value = approvalErrorMessage(error)
      return null
    }

    return data
  }

  const updateCategory = async (
    id: string,
    updates: ApprovalCategoryUpdate
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
      lastError.value = approvalErrorMessage(error)
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
    lastError,
    getCategoriesByCompany,
    getSelectableCategoriesForRequests,
    getCategoryById,
    createCategory,
    updateCategory,
    archiveCategory,
    restoreCategory
  }
}
