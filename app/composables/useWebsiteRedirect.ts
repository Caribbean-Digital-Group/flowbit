import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteRedirectRow, WebsiteRedirectInsert, WebsiteRedirectUpdate } from '~/types/website.types'

/** Redirecciones del sitio (website_redirect). Las automáticas las crea el trigger al cambiar un slug. */
export const useWebsiteRedirect = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string): Promise<WebsiteRedirectRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('website_redirect')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error fetching redirects:', error)
      return []
    }
    return data ?? []
  }

  const create = async (redirect: WebsiteRedirectInsert): Promise<WebsiteRedirectRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_redirect')
      .insert({ ...redirect, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating redirect:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear la redirección.')
      return null
    }
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsiteRedirectUpdate): Promise<WebsiteRedirectRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_redirect')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating redirect:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar la redirección.')
      return null
    }
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_redirect')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error archiving redirect:', error)
      return false
    }
    return true
  }

  return { getAllByCompany, create, update, archive, lastError }
}
