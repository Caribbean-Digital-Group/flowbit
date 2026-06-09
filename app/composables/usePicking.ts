import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type Picking = Tables<'picking'>
type PickingInsert = TablesInsert<'picking'>
type PickingUpdate = TablesUpdate<'picking'>
type PickingView = Database['public']['Views']['v_pickings']['Row']
type PickingStatus = Database['public']['Enums']['picking_status']

export const usePicking = () => {
  const supabase = useSupabase()

  const getPickingById = async (id: string, companyId: string): Promise<Picking | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('picking')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching picking:', error)
      return null
    }

    return data
  }

  const getPickingViewById = async (id: string, companyId: string): Promise<PickingView | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('v_pickings')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching picking view:', error)
      return null
    }

    return data
  }

  const getPickingsByCompany = async (companyId: string): Promise<PickingView[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('v_pickings')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pickings:', error)
      return []
    }

    return data || []
  }

  const createPicking = async (
    companyId: string,
    payload: Omit<PickingInsert, 'company_id' | 'warehouse_id'> & { warehouse_id?: string }
  ): Promise<Picking | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('picking')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating picking:', error)
      return null
    }

    return data
  }

  const updatePicking = async (
    id: string,
    companyId: string,
    updates: PickingUpdate
  ): Promise<Picking | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('picking')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating picking:', error)
      return null
    }

    return data
  }

  const setPickingStatus = async (pickingId: string, status: PickingStatus): Promise<boolean> => {
    const { data, error } = await supabase.rpc('set_picking_status', {
      p_picking_id: pickingId,
      p_new_status: status
    })

    if (error) {
      console.error('Error setting picking status:', error)
      return false
    }

    return Boolean(data)
  }

  const syncOrderToDraftPicking = async (
    orderId: string,
    isReturn = false
  ): Promise<string | null> => {
    const { data, error } = await supabase.rpc('sync_order_to_draft_picking', {
      p_order_id: orderId,
      p_is_return: isReturn
    })

    if (error) {
      console.error('Error syncing order to picking:', error)
      return null
    }

    return data
  }

  const getPickingsByWarehouse = async (warehouseId: string, companyId: string): Promise<PickingView[]> => {
    if (!companyId || !warehouseId) return []

    const { data, error } = await supabase
      .from('v_pickings')
      .select('*')
      .eq('company_id', companyId)
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pickings by warehouse:', error)
      return []
    }

    return data || []
  }

  return {
    getPickingById,
    getPickingViewById,
    getPickingsByCompany,
    getPickingsByWarehouse,
    createPicking,
    updatePicking,
    setPickingStatus,
    syncOrderToDraftPicking
  }
}
