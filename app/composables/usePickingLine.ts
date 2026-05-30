import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type PickingLine = Tables<'picking_line'>
type PickingLineInsert = TablesInsert<'picking_line'>
type PickingLineUpdate = TablesUpdate<'picking_line'>
type PickingLineView = Database['public']['Views']['v_picking_lines']['Row']

export const usePickingLine = () => {
  const supabase = useSupabase()

  const getPickingLinesByPickingId = async (
    pickingId: string,
    companyId: string
  ): Promise<PickingLine[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('picking_line')
      .select('*')
      .eq('picking_id', pickingId)
      .eq('company_id', companyId)
      .eq('active', true)
      .order('sequence', { ascending: true })

    if (error) {
      console.error('Error fetching picking lines:', error)
      return []
    }

    return data || []
  }

  const getPickingLineViewsByCompany = async (companyId: string): Promise<PickingLineView[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('v_picking_lines')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching picking line views:', error)
      return []
    }

    return data || []
  }

  const createPickingLine = async (payload: PickingLineInsert): Promise<PickingLine | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('picking_line')
      .insert({
        ...payload,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating picking line:', error)
      return null
    }

    return data
  }

  const updatePickingLine = async (
    id: string,
    updates: PickingLineUpdate
  ): Promise<PickingLine | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('picking_line')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating picking line:', error)
      return null
    }

    return data
  }

  const deletePickingLine = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('picking_line')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting picking line:', error)
      return false
    }

    return true
  }

  const updateScanProgress = async (
    id: string,
    doneQuantity: number,
    scanNotes: string | null
  ): Promise<PickingLine | null> => {
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('picking_line')
      .update({
        done_quantity: doneQuantity,
        scan_notes: scanNotes,
        scanned_at: new Date().toISOString(),
        updated_by: user?.id
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating scan progress:', error)
      return null
    }

    return data
  }

  return {
    getPickingLinesByPickingId,
    getPickingLineViewsByCompany,
    createPickingLine,
    updatePickingLine,
    deletePickingLine,
    updateScanProgress
  }
}
