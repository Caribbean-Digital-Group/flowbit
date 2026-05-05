import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type Partner = Tables<'partner'>
type PartnerInsert = TablesInsert<'partner'>
type PartnerUpdate = TablesUpdate<'partner'>
type PartnerCategory = Tables<'partner_category'>
type PartnerCompanyRole = Database['public']['Enums']['partner_company_role']

export const usePartner = () => {
  const supabase = useSupabase()

  /**
   * Get the current user's partner profile
   */
  const getCurrentPartner = async (): Promise<Partner | null> => {
    const user = await useSupabaseUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('partner')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching current partner:', error)
      return null
    }

    return data
  }

  /**
   * Get a partner by ID
   */
  const getPartnerById = async (id: string): Promise<Partner | null> => {
    const { data, error } = await supabase
      .from('partner')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching partner:', error)
      return null
    }

    return data
  }

  /**
   * Get all partners with optional filters
   */
  const getPartners = async (options?: {
    companyType?: 'person' | 'company'
    active?: boolean
    parentId?: string
    limit?: number
    offset?: number
  }): Promise<Partner[]> => {
    let query = supabase.from('partner').select('*')

    if (options?.companyType) {
      query = query.eq('company_type', options.companyType)
    }
    if (options?.active !== undefined) {
      query = query.eq('active', options.active)
    }
    if (options?.parentId) {
      query = query.eq('parent_id', options.parentId)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query.order('name')

    if (error) {
      console.error('Error fetching partners:', error)
      return []
    }

    return data || []
  }

  /**
   * Obtiene los partners asociados a una company a través de rel_partner_company.
   *
   * Implementación en dos pasos (en lugar de un inner join embebido) para evitar
   * que un row de la relación oculto por RLS excluya silenciosamente al partner
   * del resultado:
   *   1. Recupera los partner_id vinculados a la company (con sus filtros).
   *   2. Recupera los partners por id.
   */
  const getPartnersByCompany = async (
    companyId: string,
    options?: {
      active?: boolean
      relationActive?: boolean
      role?: PartnerCompanyRole
      companyType?: 'person' | 'company'
      limit?: number
      offset?: number
    }
  ): Promise<Partner[]> => {
    let relQuery = supabase
      .from('rel_partner_company')
      .select('partner_id, is_active, role')
      .eq('company_id', companyId)

    relQuery = relQuery.eq('is_active', options?.relationActive ?? true)

    if (options?.role) {
      relQuery = relQuery.eq('role', options.role)
    }

    const { data: rels, error: relError } = await relQuery

    if (relError) {
      console.error('Error fetching partner relations by company:', relError)
      return []
    }

    const partnerIds = Array.from(new Set((rels ?? []).map(r => r.partner_id)))
    if (partnerIds.length === 0) return []

    let query = supabase
      .from('partner')
      .select('*')
      .in('id', partnerIds)

    if (options?.active !== undefined) {
      query = query.eq('active', options.active)
    }
    if (options?.companyType) {
      query = query.eq('company_type', options.companyType)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query.order('name')

    if (error) {
      console.error('Error fetching partners by company:', error)
      return []
    }

    return data ?? []
  }

  /**
   * Get all companies
   */
  const getCompanies = async (): Promise<Partner[]> => {
    return getPartners({ companyType: 'company', active: true })
  }

  /**
   * Get employees/contacts of a company
   */
  const getCompanyContacts = async (companyId: string): Promise<Partner[]> => {
    return getPartners({ parentId: companyId, active: true })
  }

  /**
   * Crea un partner asociado a una company y devuelve el registro creado.
   *
   * Internamente invoca el RPC `create_partner_for_company` que:
   *  - valida que el usuario actual sea owner/admin de la company,
   *  - inserta la fila en `partner`,
   *  - crea la relación en `rel_partner_company`,
   * todo dentro de una misma transacción (SECURITY DEFINER en Postgres).
   */
  const createPartner = async (
    companyId: string,
    partner: PartnerInsert
  ): Promise<Partner | null> => {
    if (!companyId) {
      console.error('createPartner: companyId is required')
      return null
    }

    const { data, error } = await supabase.rpc(
      'create_partner_for_company' as never,
      {
        p_company_id: companyId,
        p_partner: partner
      } as never
    ) as {
      data: Partner | null
      error: { message: string; code?: string } | null
    }

    if (error) {
      console.error('Error creating partner:', error)
      return null
    }

    return data
  }

  /**
   * Update a partner
   */
  const updatePartner = async (id: string, updates: PartnerUpdate): Promise<Partner | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('partner')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating partner:', error)
      return null
    }

    return data
  }

  /**
   * Update current user's partner profile
   */
  const updateCurrentPartner = async (updates: PartnerUpdate): Promise<Partner | null> => {
    const user = await useSupabaseUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('partner')
      .update({
        ...updates,
        updated_by: user.id
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating current partner:', error)
      return null
    }

    return data
  }

  /**
   * Soft delete a partner (set active = false)
   */
  const archivePartner = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('partner')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      console.error('Error archiving partner:', error)
      return false
    }

    return true
  }

  /**
   * Search partners by name
   */
  const searchPartners = async (searchTerm: string, limit = 10): Promise<Partner[]> => {
    const { data, error } = await supabase
      .from('partner')
      .select('*')
      .ilike('name', `%${searchTerm}%`)
      .eq('active', true)
      .limit(limit)
      .order('name')

    if (error) {
      console.error('Error searching partners:', error)
      return []
    }

    return data || []
  }

  /**
   * Get partner categories
   */
  const getCategories = async (): Promise<PartnerCategory[]> => {
    const { data, error } = await supabase
      .from('partner_category')
      .select('*')
      .eq('active', true)
      .order('name')

    if (error) {
      console.error('Error fetching categories:', error)
      return []
    }

    return data || []
  }

  /**
   * Get partner with their categories
   */
  const getPartnerWithCategories = async (partnerId: string) => {
    const { data, error } = await supabase
      .from('partner')
      .select(`
        *,
        partner_category_rel (
          partner_category (*)
        )
      `)
      .eq('id', partnerId)
      .single()

    if (error) {
      console.error('Error fetching partner with categories:', error)
      return null
    }

    return data
  }

  /**
   * Add category to partner
   */
  const addCategoryToPartner = async (partnerId: string, categoryId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('partner_category_rel')
      .insert({ partner_id: partnerId, category_id: categoryId })

    if (error) {
      console.error('Error adding category to partner:', error)
      return false
    }

    return true
  }

  /**
   * Remove category from partner
   */
  const removeCategoryFromPartner = async (partnerId: string, categoryId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('partner_category_rel')
      .delete()
      .eq('partner_id', partnerId)
      .eq('category_id', categoryId)

    if (error) {
      console.error('Error removing category from partner:', error)
      return false
    }

    return true
  }

  return {
    // Partner CRUD
    getCurrentPartner,
    getPartnerById,
    getPartners,
    getPartnersByCompany,
    getCompanies,
    getCompanyContacts,
    createPartner,
    updatePartner,
    updateCurrentPartner,
    archivePartner,
    searchPartners,
    // Categories
    getCategories,
    getPartnerWithCategories,
    addCategoryToPartner,
    removeCategoryFromPartner
  }
}
