import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteDatabase, WebsiteTagRow, WebsiteTagUpdate } from '~/types/website.types'

/** Etiquetas del blog (website_tag). Se crean también al vuelo desde el editor de posts. */
export const useWebsiteTag = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string): Promise<WebsiteTagRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('website_tag')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) {
      console.error('Error fetching tags:', error)
      return []
    }
    return data ?? []
  }

  const create = async (companyId: string, name: string): Promise<WebsiteTagRow | null> => {
    if (!companyId || !name.trim()) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_tag')
      .insert({ company_id: companyId, name: name.trim().slice(0, 60), created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating tag:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear la etiqueta.')
      return null
    }
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsiteTagUpdate): Promise<WebsiteTagRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_tag')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating tag:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar la etiqueta.')
      return null
    }
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_tag')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error archiving tag:', error)
      return false
    }
    return true
  }

  /** Conteo de posts por etiqueta (para el listado del panel). */
  const getUsage = async (companyId: string): Promise<Record<string, number>> => {
    if (!companyId) return {}
    const { data, error } = await supabase
      .from('website_post_tag')
      .select('tag_id')
      .eq('company_id', companyId)
    if (error) return {}
    const usage: Record<string, number> = {}
    for (const row of data ?? []) usage[row.tag_id] = (usage[row.tag_id] ?? 0) + 1
    return usage
  }

  return { getAllByCompany, create, update, archive, getUsage, lastError }
}
