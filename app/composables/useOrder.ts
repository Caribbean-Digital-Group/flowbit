import type { Database, Tables, TablesUpdate } from '~/types/database.types'

type Order = Tables<'order'>
type OrderRowView = Database['public']['Views']['v_orders']['Row']
type OrderUpdate = TablesUpdate<'order'>
type OrderType = Database['public']['Enums']['order_type']

export const useOrder = () => {
  const supabase = useSupabase()

  const getOrdersByCompany = async (companyId: string): Promise<OrderRowView[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('v_orders')
      .select('*')
      .eq('company_id', companyId)
      .order('order_date', { ascending: false })

    if (error) {
      console.error('Error fetching orders by company:', error)
      return []
    }

    return data || []
  }

  const getOrderById = async (id: string, companyId: string): Promise<Order | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('order')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching order:', error)
      return null
    }

    return data
  }

  const getOrderViewById = async (id: string, companyId: string): Promise<OrderRowView | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('v_orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching order view:', error)
      return null
    }

    return data
  }

  const getOrdersByProject = async (
    projectId: string,
    companyId: string
  ): Promise<OrderRowView[]> => {
    if (!projectId || !companyId) return []

    const { data, error } = await supabase
      .from('v_orders')
      .select('*')
      .eq('company_id', companyId)
      .eq('project_id', projectId)
      .order('order_date', { ascending: false })

    if (error) {
      console.error('Error fetching orders by project:', error)
      return []
    }

    return data || []
  }

  const updateOrder = async (
    id: string,
    companyId: string,
    updates: OrderUpdate
  ): Promise<Order | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('order')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating order:', error)
      return null
    }

    return data
  }

  const createDraftOrder = async (params: {
    companyId: string
    orderType: OrderType
    partnerId: string
    currency?: string
    taxRate?: number
  }): Promise<string | null> => {
    const { data, error } = await supabase.rpc('create_order', {
      p_company_id: params.companyId,
      p_order_type: params.orderType,
      p_partner_id: params.partnerId,
      p_currency: params.currency ?? 'MXN',
      p_tax_rate: params.taxRate ?? 16
    })

    if (error) {
      console.error('Error creating order:', error)
      return null
    }

    return data
  }

  const previewOrderStockShortages = async (
    orderId: string
  ): Promise<
    { product_id: string; product_name: string; requested: number; available: number }[]
  > => {
    const { data, error } = await supabase.rpc('preview_order_stock_shortages', {
      p_order_id: orderId
    })

    if (error) {
      console.error('Error previewing order stock:', error)
      return []
    }

    if (!data?.length) return []

    return data.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      requested: Number(row.requested),
      available: Number(row.available)
    }))
  }

  const postOrderById = async (
    orderId: string
  ): Promise<{ success: boolean; errorMessage: string | null }> => {
    const { data, error } = await supabase.rpc('post_order', { p_order_id: orderId })

    if (error) {
      console.error('Error posting order:', error)
      return {
        success: false,
        errorMessage: error.message?.trim() || 'No se pudo confirmar la orden.'
      }
    }

    return { success: Boolean(data), errorMessage: null }
  }

  const cancelOrderById = async (orderId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('cancel_order', { p_order_id: orderId })

    if (error) {
      console.error('Error cancelling order:', error)
      return false
    }

    return Boolean(data)
  }

  const addOrderLineRpc = async (params: {
    orderId: string
    productId?: string | null
    description?: string | null
    quantity?: number
    unitPrice?: number
    unitCost?: number
    discountPercent?: number
    taxRate?: number | null
  }): Promise<string | null> => {
    const { data, error } = await supabase.rpc('add_order_line', {
      p_order_id: params.orderId,
      p_product_id: params.productId ?? undefined,
      p_description: params.description ?? undefined,
      p_quantity: params.quantity ?? 1,
      p_unit_price: params.unitPrice ?? 0,
      p_unit_cost: params.unitCost ?? 0,
      p_discount_percent: params.discountPercent ?? 0,
      p_tax_rate: params.taxRate ?? undefined
    })

    if (error) {
      console.error('Error adding order line:', error)
      return null
    }

    return data
  }

  return {
    getOrdersByCompany,
    getOrderById,
    getOrderViewById,
    getOrdersByProject,
    updateOrder,
    createDraftOrder,
    previewOrderStockShortages,
    postOrderById,
    cancelOrderById,
    addOrderLineRpc
  }
}
