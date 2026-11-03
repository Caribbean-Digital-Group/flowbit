import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OrderPaymentView,
  RegisterPaymentResult,
  SalesDatabase
} from '~/types/sales.types'

/**
 * Libro de pagos de las órdenes (cobros, abonos y reembolsos).
 *
 * El estado de pago de la orden lo calcula la base de datos a partir de este
 * libro: desde el cliente solo se registran, anulan o condonan pagos por RPC.
 */
export const useOrderPayment = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<SalesDatabase>
  const lastError = ref<string | null>(null)

  const getPaymentsByOrder = async (orderId: string, companyId: string): Promise<OrderPaymentView[]> => {
    if (!orderId || !companyId) return []

    const { data, error } = await supabase
      .from('v_order_payments')
      .select('*')
      .eq('company_id', companyId)
      .eq('order_id', orderId)
      .order('paid_at', { ascending: true })

    if (error) {
      console.error('Error fetching order payments:', error)
      return []
    }

    return (data ?? []) as OrderPaymentView[]
  }

  const registerPayment = async (params: {
    orderId: string
    amount: number
    paymentMethodId: string
    paidAt?: string | null
    reference?: string | null
    notes?: string | null
  }): Promise<RegisterPaymentResult | null> => {
    lastError.value = null

    const { data, error } = await supabase.rpc(
      'register_order_payment' as never,
      {
        p_order_id: params.orderId,
        p_amount: params.amount,
        p_payment_method_id: params.paymentMethodId,
        p_paid_at: params.paidAt || null,
        p_reference: params.reference || null,
        p_notes: params.notes || null
      } as never
    )

    if (error) {
      console.error('Error registering order payment:', error)
      lastError.value = error.message?.trim() || 'No se pudo registrar el pago.'
      return null
    }

    return data as unknown as RegisterPaymentResult
  }

  const voidPayment = async (paymentId: string, reason: string): Promise<boolean> => {
    lastError.value = null

    const { error } = await supabase.rpc(
      'void_order_payment' as never,
      { p_payment_id: paymentId, p_reason: reason } as never
    )

    if (error) {
      console.error('Error voiding order payment:', error)
      lastError.value = error.message?.trim() || 'No se pudo anular el pago.'
      return false
    }

    return true
  }

  const condoneBalance = async (orderId: string, reason: string): Promise<boolean> => {
    lastError.value = null

    const { error } = await supabase.rpc(
      'condone_order_balance' as never,
      { p_order_id: orderId, p_reason: reason } as never
    )

    if (error) {
      console.error('Error condoning order balance:', error)
      lastError.value = error.message?.trim() || 'No se pudo condonar el saldo.'
      return false
    }

    return true
  }

  return { lastError, getPaymentsByOrder, registerPayment, voidPayment, condoneBalance }
}
