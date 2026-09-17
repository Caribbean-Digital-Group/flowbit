import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteSettingsRow, WebsiteSettingsUpdate } from '~/types/website.types'

export interface WebsiteAdminStats {
  pages_published: number
  pages_draft: number
  posts_published: number
  posts_scheduled: number
  posts_draft: number
  views_30d: number
  claps_total: number
  comments_pending: number
  submissions_new: number
  media_count: number
  media_bytes: number
  top_posts: { id: string; title: string; slug: string; view_count: number; clap_count: number }[]
}

/**
 * Configuración del sitio web (website_settings): una fila por empresa.
 * Se crea con el RPC initialize_website (settings + menús + páginas de ejemplo).
 * El cast del cliente es temporal hasta regenerar database.types.ts.
 */
export const useWebsiteSettings = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getByCompany = async (companyId: string): Promise<WebsiteSettingsRow | null> => {
    if (!companyId) return null
    const { data, error } = await supabase
      .from('website_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching website settings:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo cargar la configuración del sitio.')
      return null
    }
    return data
  }

  const initialize = async (companyId: string): Promise<{ status: string } | null> => {
    if (!companyId) return null
    const { data, error } = await supabase.rpc('initialize_website' as never, { p_company_id: companyId } as never)
    if (error) {
      console.error('Error initializing website:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear el sitio.')
      return null
    }
    return data as { status: string }
  }

  const update = async (companyId: string, updates: WebsiteSettingsUpdate): Promise<WebsiteSettingsRow | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_settings')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error saving website settings:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar la configuración.')
      return null
    }
    lastError.value = null
    return data
  }

  const getStats = async (companyId: string): Promise<WebsiteAdminStats | null> => {
    if (!companyId) return null
    const { data, error } = await supabase.rpc('get_website_admin_stats' as never, { p_company_id: companyId } as never)
    if (error) {
      console.error('Error fetching website stats:', error)
      return null
    }
    const result = data as ({ status: string } & WebsiteAdminStats) | null
    return result && result.status === 'ok' ? result : null
  }

  return { getByCompany, initialize, update, getStats, lastError }
}
