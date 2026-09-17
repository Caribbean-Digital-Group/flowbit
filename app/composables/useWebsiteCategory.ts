import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteCategoryRow, WebsiteCategoryInsert, WebsiteCategoryUpdate } from '~/types/website.types'

/** Categorías del blog (website_category), jerárquicas por parent_id. */
export const useWebsiteCategory = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string): Promise<WebsiteCategoryRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('website_category')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('display_order')
      .order('name')
    if (error) {
      console.error('Error fetching categories:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<WebsiteCategoryRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('website_category')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching category:', error)
      return null
    }
    return data
  }

  const create = async (category: WebsiteCategoryInsert): Promise<WebsiteCategoryRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_category')
      .insert({ ...category, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating category:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear la categoría.')
      return null
    }
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsiteCategoryUpdate): Promise<WebsiteCategoryRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_category')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating category:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar la categoría.')
      return null
    }
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_category')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error archiving category:', error)
      return false
    }
    return true
  }

  return { getAllByCompany, getById, create, update, archive, lastError }
}
