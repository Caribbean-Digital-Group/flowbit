import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WebsiteDatabase,
  WebsiteMenuRow,
  WebsiteMenuItemRow,
  WebsiteMenuItemInsert,
  WebsiteMenuItemUpdate
} from '~/types/website.types'

/**
 * Menús de navegación del sitio (website_menu / website_menu_item).
 * Los dos menús (main, footer) los crea initialize_website. Solo admins escriben.
 */
export const useWebsiteMenu = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<WebsiteDatabase>
  const lastError = ref<string | null>(null)

  const getMenus = async (companyId: string): Promise<WebsiteMenuRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('website_menu')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('code')
    if (error) {
      console.error('Error fetching menus:', error)
      return []
    }
    return data ?? []
  }

  const getItems = async (companyId: string, menuId?: string): Promise<WebsiteMenuItemRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('website_menu_item')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('display_order')
    if (menuId) query = query.eq('menu_id', menuId)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching menu items:', error)
      return []
    }
    return data ?? []
  }

  const createItem = async (item: WebsiteMenuItemInsert): Promise<WebsiteMenuItemRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_menu_item')
      .insert({ ...item, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) {
      console.error('Error creating menu item:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo crear el elemento del menú.')
      return null
    }
    return data
  }

  const updateItem = async (id: string, companyId: string, updates: WebsiteMenuItemUpdate): Promise<WebsiteMenuItemRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('website_menu_item')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error updating menu item:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo guardar el elemento del menú.')
      return null
    }
    return data
  }

  const removeItem = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false
    const { error } = await supabase
      .from('website_menu_item')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) {
      console.error('Error removing menu item:', error)
      lastError.value = websiteErrorMessage(error, 'No se pudo eliminar el elemento del menú.')
      return false
    }
    // Los hijos quedan al nivel raíz
    await supabase.from('website_menu_item').update({ parent_id: null }).eq('parent_id', id).eq('company_id', companyId)
    return true
  }

  /** Guarda el orden (y padre) de varios elementos en una sola pasada. */
  const reorder = async (
    companyId: string,
    positions: { id: string; display_order: number; parent_id: string | null }[]
  ): Promise<boolean> => {
    if (!companyId) return false
    const user = await useSupabaseUser()
    const results = await Promise.all(
      positions.map(p =>
        supabase
          .from('website_menu_item')
          .update({ display_order: p.display_order, parent_id: p.parent_id, updated_by: user?.id ?? null })
          .eq('id', p.id)
          .eq('company_id', companyId)
      )
    )
    const failed = results.find(r => r.error)
    if (failed?.error) {
      console.error('Error reordering menu items:', failed.error)
      lastError.value = websiteErrorMessage(failed.error, 'No se pudo reordenar el menú.')
      return false
    }
    return true
  }

  return { getMenus, getItems, createItem, updateItem, removeItem, reorder, lastError }
}
