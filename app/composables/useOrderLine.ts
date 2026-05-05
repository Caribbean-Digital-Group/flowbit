import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type OrderLineRow = Tables<'order_line'>
type OrderLineInsert = TablesInsert<'order_line'>
type OrderLineUpdate = TablesUpdate<'order_line'>

export const useOrderLine = () => {
  const supabase = useSupabase()

  const getOrderLineById = async (id: string): Promise<OrderLineRow | null> => {
    const { data, error } = await supabase
      .from('order_line')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching order line:', error)
      return null
    }

    return data
  }

  const getOrderLinesByOrderId = async (orderId: string): Promise<OrderLineRow[]> => {
    const { data, error } = await supabase
      .from('order_line')
      .select('*')
      .eq('order_id', orderId)
      .order('sequence')

    if (error) {
      console.error('Error fetching order lines:', error)
      return []
    }

    return data || []
  }

  const getOrderLines = async (options?: {
    orderId?: string
    productId?: string
    limit?: number
    offset?: number
  }): Promise<OrderLineRow[]> => {
    let query = supabase.from('order_line').select('*')

    if (options?.orderId) {
      query = query.eq('order_id', options.orderId)
    }
    if (options?.productId) {
      query = query.eq('product_id', options.productId)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching order lines:', error)
      return []
    }

    return data || []
  }

  const createOrderLine = async (line: OrderLineInsert): Promise<OrderLineRow | null> => {
    const { data, error } = await supabase
      .from('order_line')
      .insert(line)
      .select()
      .single()

    if (error) {
      console.error('Error creating order line:', error)
      return null
    }

    return data
  }

  const updateOrderLine = async (id: string, updates: OrderLineUpdate): Promise<OrderLineRow | null> => {
    const { data, error } = await supabase
      .from('order_line')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating order line:', error)
      return null
    }

    return data
  }

  const deleteOrderLine = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('order_line')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting order line:', error)
      return false
    }

    return true
  }

  const deleteOrderLinesByOrderId = async (orderId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('order_line')
      .delete()
      .eq('order_id', orderId)

    if (error) {
      console.error('Error deleting order lines:', error)
      return false
    }

    return true
  }

  return {
    getOrderLineById,
    getOrderLinesByOrderId,
    getOrderLines,
    createOrderLine,
    updateOrderLine,
    deleteOrderLine,
    deleteOrderLinesByOrderId
  }
}
