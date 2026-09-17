import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteCommentRow, WebsiteCommentStatus } from '~/types/website.types'

/** Moderación de comentarios del blog (website_comment). La inserción pública es vía RPC. */
export const useWebsiteComment = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>

  const getAllByCompany = async (companyId: string, status?: WebsiteCommentStatus | 'all'): Promise<WebsiteCommentRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('website_comment')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(300)
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching comments:', error)
      return []
    }
    return data ?? []
  }

  const setStatus = async (id: string, companyId: string, status: WebsiteCommentStatus): Promise<boolean> => {
    if (!id || !companyId) return false
    const user = await useSupabaseUser()
    const { error } = await supabase
      .from('website_comment')
      .update({ status, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error moderating comment:', error)
      return false
    }
    return true
  }

  const remove = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_comment')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error removing comment:', error)
      return false
    }
    return true
  }

  return { getAllByCompany, setStatus, remove }
}
