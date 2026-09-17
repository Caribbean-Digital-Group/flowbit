import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteAuthorRow, WebsiteAuthorInsert, WebsiteAuthorUpdate } from '~/types/website.types'

/** Autores del blog (website_author), vinculados opcionalmente a un partner del equipo. */
export const useWebsiteAuthor = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string): Promise<WebsiteAuthorRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('website_author')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('display_name')
    if (error) {
      console.error('Error fetching authors:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<WebsiteAuthorRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('website_author')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching author:', error)
      return null
    }
    return data
  }

  /** Autor del usuario actual (por partner_id); lo crea si no existe. */
  const ensureCurrentUserAuthor = async (companyId: string): Promise<WebsiteAuthorRow | null> => {
    if (!companyId) return null
    const { data: partnerId } = await supabase.rpc('current_user_partner_row_id' as never)
    if (!partnerId) return null

    const { data: existing } = await supabase
      .from('website_author')
      .select('*')
      .eq('company_id', companyId)
      .eq('partner_id', partnerId as string)
      .maybeSingle()
    if (existing) return existing

    const { data: partner } = await supabase
      .from('partner')
      .select('name, display_name, function')
      .eq('id', partnerId as string)
      .maybeSingle()

    return create({
      company_id: companyId,
      partner_id: partnerId as string,
      display_name: (partner?.display_name || partner?.name || 'Autor').trim(),
      role_title: partner?.function ?? null
    })
  }

  const create = async (author: WebsiteAuthorInsert): Promise<WebsiteAuthorRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_author')
      .insert({ ...author, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating author:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear el autor.')
      return null
    }
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsiteAuthorUpdate): Promise<WebsiteAuthorRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_author')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating author:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar el autor.')
      return null
    }
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_author')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error archiving author:', error)
      return false
    }
    return true
  }

  return { getAllByCompany, getById, ensureCurrentUserAuthor, create, update, archive, lastError }
}
