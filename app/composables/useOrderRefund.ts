import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OrderRefundView,
  RefundLineInput,
  RegisterRefundResult,
  SalesDatabase
} from '~/types/sales.types'

/**
 * Devoluciones de venta: documento, reintegro al almacén (al costo con que
 * salió) y reembolso opcional, para cualquier canal.
 */
export const useOrderRefund = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<SalesDatabase>
  const lastError = ref<string | null>(null)

  const getRefundsByOrder = async (orderId: string, companyId: string): Promise<OrderRefundView[]> => {
    if (!orderId || !companyId) return []

    const { data, error } = await supabase
      .from('v_order_refunds')
      .select('*')
      .eq('company_id', companyId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching order refunds:', error)
      return []
    }

    return (data ?? []) as OrderRefundView[]
  }

  const registerRefund = async (params: {
    orderId: string
    lines: RefundLineInput[]
    reason: string
    refundMethodId?: string | null
    refundAmount?: number | null
    restock?: boolean
  }): Promise<RegisterRefundResult | null> => {
    lastError.value = null

    const { data, error } = await supabase.rpc(
      'register_order_refund' as never,
      {
        p_order_id: params.orderId,
        p_lines: params.lines,
        p_reason: params.reason,
        p_refund_method_id: params.refundMethodId || null,
        p_refund_amount: params.refundAmount ?? null,
        p_pos_session_id: null,
        p_restock: params.restock ?? true
      } as never
    )

    if (error) {
      console.error('Error registering order refund:', error)
      lastError.value = error.message?.trim() || 'No se pudo registrar la devolución.'
      return null
    }

    return data as unknown as RegisterRefundResult
  }

  return { lastError, getRefundsByOrder, registerRefund }
}
