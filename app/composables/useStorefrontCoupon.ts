import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  StorefrontDatabase,
  StorefrontCouponRow,
  StorefrontCouponInsert,
  StorefrontCouponUpdate
} from '~/types/storefront.types'

/**
 * CRUD de cupones del storefront (storefront_coupon).
 * El cast del cliente es temporal hasta regenerar database.types.ts.
 */
export const useStorefrontCoupon = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<StorefrontDatabase>

  const getAllByCompany = async (companyId: string): Promise<StorefrontCouponRow[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('storefront_coupon')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching coupons:', error)
      return []
    }

    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<StorefrontCouponRow | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('storefront_coupon')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching coupon:', error)
      return null
    }

    return data
  }

  const create = async (coupon: StorefrontCouponInsert): Promise<StorefrontCouponRow | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('storefront_coupon')
      .insert({ ...coupon, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()

    if (error) {
      console.error('Error creating coupon:', error)
      return null
    }

    return data
  }

  const update = async (
    id: string,
    companyId: string,
    updates: StorefrontCouponUpdate
  ): Promise<StorefrontCouponRow | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('storefront_coupon')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating coupon:', error)
      return null
    }

    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    if (!id || !companyId) return false

    const { error } = await supabase
      .from('storefront_coupon')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error archiving coupon:', error)
      return false
    }

    return true
  }

  return { getAllByCompany, getById, create, update, archive }
}
