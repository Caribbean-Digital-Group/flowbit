import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type Warehouse = Tables<'warehouse'>
type WarehouseInsert = TablesInsert<'warehouse'>
type WarehouseUpdate = TablesUpdate<'warehouse'>

export const useWarehouse = () => {
  const supabase = useSupabase()

  const getWarehouseById = async (id: string, companyId: string): Promise<Warehouse | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('warehouse')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching warehouse:', error)
      return null
    }

    return data
  }

  const getWarehousesByCompany = async (companyId: string): Promise<Warehouse[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('warehouse')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching warehouses:', error)
      return []
    }

    return data || []
  }

  const createWarehouse = async (
    companyId: string,
    payload: Omit<WarehouseInsert, 'company_id'>
  ): Promise<Warehouse | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('warehouse')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating warehouse:', error)
      return null
    }

    return data
  }

  const updateWarehouse = async (
    id: string,
    companyId: string,
    updates: WarehouseUpdate
  ): Promise<Warehouse | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('warehouse')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating warehouse:', error)
      return null
    }

    return data
  }

  const archiveWarehouse = async (id: string, companyId: string): Promise<boolean> => {
    if (!companyId) return false

    const { error } = await supabase
      .from('warehouse')
      .update({ active: false })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error archiving warehouse:', error)
      return false
    }

    return true
  }

  return {
    getWarehouseById,
    getWarehousesByCompany,
    createWarehouse,
    updateWarehouse,
    archiveWarehouse
  }
}
