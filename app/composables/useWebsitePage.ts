import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WebsiteDatabase,
  WebsitePageRow,
  WebsitePageInsert,
  WebsitePageUpdate,
  WebsitePageRevisionRow
} from '~/types/website.types'

/**
 * CRUD de páginas del sitio (website_page) y su historial de versiones.
 * El contenido (secciones) se sanea en servidor antes de guardarse
 * (useWebsiteContent.sanitizeSections). El cast es temporal.
 */
export const useWebsitePage = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string, includeArchived = false): Promise<WebsitePageRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('website_page')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('is_home', { ascending: false })
      .order('display_order')
      .order('title')
    if (!includeArchived) query = query.neq('status', 'archived')
    const { data, error } = await query
    if (error) {
      console.error('Error fetching pages:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<WebsitePageRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('website_page')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching page:', error)
      return null
    }
    return data
  }

  const create = async (page: WebsitePageInsert): Promise<WebsitePageRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_page')
      .insert({ ...page, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating page:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear la página.')
      return null
    }
    lastError.value = null
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsitePageUpdate): Promise<WebsitePageRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_page')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating page:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar la página.')
      return null
    }
    lastError.value = null
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_page')
      .update({ status: 'archived', is_home: false, active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error archiving page:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo archivar la página.')
      return false
    }
    return true
  }

  const getRevisions = async (pageId: string, companyId: string): Promise<WebsitePageRevisionRow[]> => {
    if (!pageId || !companyId) return []
    const { data, error } = await supabase
      .from('website_page_revision')
      .select('*')
      .eq('page_id', pageId)
      .eq('company_id', companyId)
      .order('revision_no', { ascending: false })
      .limit(20)
    if (error) {
      console.error('Error fetching page revisions:', error)
      return []
    }
    return data ?? []
  }

  return { getAllByCompany, getById, create, update, archive, getRevisions, lastError }
}
