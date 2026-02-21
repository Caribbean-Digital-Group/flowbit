import type { Partner, PartnerInsert, PartnerUpdate, PartnerCategory } from '~/types/database.types'

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
   * Create a new partner
   */
  const createPartner = async (partner: PartnerInsert): Promise<Partner | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('partner')
      .insert({
        ...partner,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .single()

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
