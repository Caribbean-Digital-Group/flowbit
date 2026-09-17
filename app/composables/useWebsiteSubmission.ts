import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteContactSubmissionRow, WebsiteSubmissionStatus } from '~/types/website.types'

/** Mensajes del formulario de contacto (website_contact_submission). */
export const useWebsiteSubmission = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string, status?: WebsiteSubmissionStatus | 'all'): Promise<WebsiteContactSubmissionRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('website_contact_submission')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(300)
    if (status && status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching submissions:', error)
      return []
    }
    return data ?? []
  }

  const setStatus = async (id: string, companyId: string, status: WebsiteSubmissionStatus): Promise<boolean> => {
    if (!id || !companyId) return false
    const user = await useSupabaseUser()
    const { error } = await supabase
      .from('website_contact_submission')
      .update({ status, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error updating submission:', error)
      return false
    }
    return true
  }

  const convertToLead = async (id: string): Promise<{ status: string; lead_id?: string; code?: string } | null> => {
    if (!id) return null
    const { data, error } = await supabase.rpc('convert_website_submission_to_lead' as never, { p_submission_id: id } as never)
    if (error) {
      console.error('Error converting submission to lead:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear el lead.')
      return null
    }
    return data as { status: string; lead_id?: string; code?: string }
  }

  return { getAllByCompany, setStatus, convertToLead, lastError }
}
