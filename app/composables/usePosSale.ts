export interface PosSaleLine {
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_percent: number
  tax_rate: number
}

export interface PosSalePayment {
  payment_method_id: string
  amount: number
  tendered?: number | null
  change_amount?: number
}

export interface PosSaleResult {
  order_id: string
  order_name: string
  amount_total: number
}

export interface PosRefundLine {
  order_line_id: string
  quantity: number
}

export interface PosRefundResult {
  refund_total: number
  picking_id: string
  order_id: string
  order_name: string
}

const parseSaleResult = (raw: unknown): PosSaleResult | null => {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  return {
    order_id: String(data.order_id ?? ''),
    order_name: String(data.order_name ?? ''),
    amount_total: Number(data.amount_total ?? 0)
  }
}

const parseRefundResult = (raw: unknown): PosRefundResult | null => {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  return {
    refund_total: Number(data.refund_total ?? 0),
    picking_id: String(data.picking_id ?? ''),
    order_id: String(data.order_id ?? ''),
    order_name: String(data.order_name ?? '')
  }
}

export const usePosSale = () => {
  const supabase = useSupabase()

  const registerSale = async (params: {
    sessionId: string
    partnerId: string
    lines: PosSaleLine[]
    payments: PosSalePayment[]
    notes?: string | null
  }): Promise<{ result: PosSaleResult | null; errorMessage: string | null }> => {
    const { data, error } = await supabase.rpc('register_pos_sale', {
      p_session_id: params.sessionId,
      p_partner_id: params.partnerId,
      p_lines: params.lines,
      p_payments: params.payments,
      p_notes: params.notes ?? undefined
    })

    if (error) {
      console.error('Error registering POS sale:', error)
      return {
        result: null,
        errorMessage: error.message?.trim() || 'No se pudo registrar la venta.'
      }
    }

    return { result: parseSaleResult(data), errorMessage: null }
  }

  const registerRefund = async (params: {
    sessionId: string
    orderId: string
    lines: PosRefundLine[]
    paymentMethodId: string
    reason: string
  }): Promise<{ result: PosRefundResult | null; errorMessage: string | null }> => {
    const { data, error } = await supabase.rpc('register_pos_refund', {
      p_session_id: params.sessionId,
      p_order_id: params.orderId,
      p_lines: params.lines,
      p_payment_method_id: params.paymentMethodId,
      p_reason: params.reason
    })

    if (error) {
      console.error('Error registering POS refund:', error)
      return {
        result: null,
        errorMessage: error.message?.trim() || 'No se pudo registrar la devolución.'
      }
    }

    return { result: parseRefundResult(data), errorMessage: null }
  }

  return { registerSale, registerRefund }
}
