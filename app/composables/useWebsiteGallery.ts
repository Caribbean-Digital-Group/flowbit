import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WebsiteDatabase,
  WebsiteGalleryRow,
  WebsiteGalleryInsert,
  WebsiteGalleryUpdate,
  WebsiteGalleryItemRow,
  WebsiteGalleryItemInsert,
  WebsiteGalleryItemUpdate
} from '~/types/website.types'

/** Galerías de fotos (website_gallery / website_gallery_item). */
export const useWebsiteGallery = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getAllByCompany = async (companyId: string): Promise<WebsiteGalleryRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('website_gallery')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('display_order')
      .order('name')
    if (error) {
      console.error('Error fetching galleries:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<WebsiteGalleryRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('website_gallery')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching gallery:', error)
      return null
    }
    return data
  }

  const create = async (gallery: WebsiteGalleryInsert): Promise<WebsiteGalleryRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_gallery')
      .insert({ ...gallery, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating gallery:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear la galería.')
      return null
    }
    return data
  }

  const update = async (id: string, companyId: string, updates: WebsiteGalleryUpdate): Promise<WebsiteGalleryRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_gallery')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating gallery:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar la galería.')
      return null
    }
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_gallery')
      .update({ active: false, status: 'archived' })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error archiving gallery:', error)
      return false
    }
    return true
  }

  const getItems = async (galleryId: string, companyId: string): Promise<WebsiteGalleryItemRow[]> => {
    if (!galleryId || !companyId) return []
    const { data, error } = await supabase
      .from('website_gallery_item')
      .select('*')
      .eq('gallery_id', galleryId)
      .eq('company_id', companyId)
      .eq('active', true)
      .order('display_order')
      .order('created_at')
    if (error) {
      console.error('Error fetching gallery items:', error)
      return []
    }
    return data ?? []
  }

  const addItem = async (item: WebsiteGalleryItemInsert): Promise<WebsiteGalleryItemRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_gallery_item')
      .insert({ ...item, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error adding gallery item:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo agregar la imagen.')
      return null
    }
    return data
  }

  const updateItem = async (id: string, companyId: string, updates: WebsiteGalleryItemUpdate): Promise<boolean> => {
    if (!id || !companyId) return false
    const user = await useSupabaseUser()
    const { error } = await supabase
      .from('website_gallery_item')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error updating gallery item:', error)
      return false
    }
    return true
  }

  const removeItem = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_gallery_item')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error removing gallery item:', error)
      return false
    }
    return true
  }

  const reorderItems = async (companyId: string, ids: string[]): Promise<boolean> => {
    const results = await Promise.all(
      ids.map((id, index) =>
        supabase.from('website_gallery_item').update({ display_order: (index + 1) * 10 }).eq('id', id).eq('company_id', companyId)
      )
    )
    return !results.some(r => r.error)
  }

  return { getAllByCompany, getById, create, update, archive, getItems, addItem, updateItem, removeItem, reorderItems, lastError }
}
