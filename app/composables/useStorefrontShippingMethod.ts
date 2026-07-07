import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  StorefrontDatabase,
  StorefrontShippingMethodRow,
  StorefrontShippingMethodInsert,
  StorefrontShippingMethodUpdate
} from '~/types/storefront.types'

/**
 * CRUD de métodos de envío del storefront (storefront_shipping_method).
 * El cast del cliente es temporal hasta regenerar database.types.ts.
 */
export const useStorefrontShippingMethod = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<StorefrontDatabase>

  const getAllByCompany = async (companyId: string): Promise<StorefrontShippingMethodRow[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('storefront_shipping_method')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('display_order')
      .order('name')

    if (error) {
      console.error('Error fetching shipping methods:', error)
      return []
    }

    return data ?? []
  }

  const getById = async (
    id: string,
    companyId: string
  ): Promise<StorefrontShippingMethodRow | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('storefront_shipping_method')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching shipping method:', error)
      return null
    }

    return data
  }

  const create = async (
    method: StorefrontShippingMethodInsert
  ): Promise<StorefrontShippingMethodRow | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('storefront_shipping_method')
      .insert({ ...method, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()

    if (error) {
      console.error('Error creating shipping method:', error)
      return null
    }

    return data
  }

  const update = async (
    id: string,
    companyId: string,
    updates: StorefrontShippingMethodUpdate
  ): Promise<StorefrontShippingMethodRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('storefront_shipping_method')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating shipping method:', error)
      return null
    }

    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false

    const { error } = await supabase
      .from('storefront_shipping_method')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error archiving shipping method:', error)
      return false
    }

    return true
  }

  return { getAllByCompany, getById, create, update, archive }
}
