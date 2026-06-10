import type { Database, Tables } from '~/types/database.types'

type PosSession = Tables<'pos_session'>
type PosSessionView = Database['public']['Views']['v_pos_sessions']['Row']
type PosCashMovement = Tables<'pos_cash_movement'>
type PosSessionCount = Tables<'pos_session_count'>
type PosPaymentView = Database['public']['Views']['v_pos_payments']['Row']
type PosMovementType = Database['public']['Enums']['pos_movement_type']

export interface PosSessionMethodSummary {
  payment_method_id: string
  name: string
  is_cash: boolean
  sales_amount: number
  refunds_amount: number
  expected: number
}

export interface PosSessionSummary {
  session_id: string
  session_name: string
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
  opening_balance: number
  sales_count: number
  sales_total: number
  discounts_total: number
  cancelled_count: number
  refunds_count: number
  refunds_total: number
  avg_ticket: number
  cash_in: number
  cash_out: number
  expected_cash: number
  methods: PosSessionMethodSummary[]
}

export interface PosSessionCloseCount {
  payment_method_id: string
  counted: number
  justification?: string | null
}

const parseSummary = (raw: unknown): PosSessionSummary | null => {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>

  return {
    session_id: String(data.session_id ?? ''),
    session_name: String(data.session_name ?? ''),
    status: (data.status === 'closed' ? 'closed' : 'open'),
    opened_at: String(data.opened_at ?? ''),
    closed_at: data.closed_at ? String(data.closed_at) : null,
    opening_balance: Number(data.opening_balance ?? 0),
    sales_count: Number(data.sales_count ?? 0),
    sales_total: Number(data.sales_total ?? 0),
    discounts_total: Number(data.discounts_total ?? 0),
    cancelled_count: Number(data.cancelled_count ?? 0),
    refunds_count: Number(data.refunds_count ?? 0),
    refunds_total: Number(data.refunds_total ?? 0),
    avg_ticket: Number(data.avg_ticket ?? 0),
    cash_in: Number(data.cash_in ?? 0),
    cash_out: Number(data.cash_out ?? 0),
    expected_cash: Number(data.expected_cash ?? 0),
    methods: Array.isArray(data.methods)
      ? (data.methods as Record<string, unknown>[]).map((m) => ({
          payment_method_id: String(m.payment_method_id ?? ''),
          name: String(m.name ?? ''),
          is_cash: Boolean(m.is_cash),
          sales_amount: Number(m.sales_amount ?? 0),
          refunds_amount: Number(m.refunds_amount ?? 0),
          expected: Number(m.expected ?? 0)
        }))
      : []
  }
}

export const usePosSession = () => {
  const supabase = useSupabase()

  const getSessionsByCompany = async (companyId: string): Promise<PosSessionView[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('v_pos_sessions')
      .select('*')
      .eq('company_id', companyId)
      .order('opened_at', { ascending: false })

    if (error) {
      console.error('Error fetching POS sessions:', error)
      return []
    }

    return data ?? []
  }

  const getSessionViewById = async (
    id: string,
    companyId: string
  ): Promise<PosSessionView | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('v_pos_sessions')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching POS session view:', error)
      return null
    }

    return data
  }

  const getOpenSessionByRegister = async (registerId: string): Promise<PosSession | null> => {
    if (!registerId) return null

    const { data, error } = await supabase
      .from('pos_session')
      .select('*')
      .eq('register_id', registerId)
      .eq('status', 'open')
      .maybeSingle()

    if (error) {
      console.error('Error fetching open POS session:', error)
      return null
    }

    return data
  }

  const getOpenSessionsByCompany = async (companyId: string): Promise<PosSession[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('pos_session')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'open')

    if (error) {
      console.error('Error fetching open POS sessions:', error)
      return []
    }

    return data ?? []
  }

  const openSession = async (params: {
    registerId: string
    openingBalance: number
    notes?: string | null
  }): Promise<{ sessionId: string | null; errorMessage: string | null }> => {
    const { data, error } = await supabase.rpc('open_pos_session', {
      p_register_id: params.registerId,
      p_opening_balance: params.openingBalance,
      p_notes: params.notes ?? undefined
    })

    if (error) {
      console.error('Error opening POS session:', error)
      return {
        sessionId: null,
        errorMessage: error.message?.trim() || 'No se pudo abrir la sesión de caja.'
      }
    }

    return { sessionId: data, errorMessage: null }
  }

  const closeSession = async (params: {
    sessionId: string
    counts: PosSessionCloseCount[]
    notes?: string | null
  }): Promise<{ summary: PosSessionSummary | null; errorMessage: string | null }> => {
    const { data, error } = await supabase.rpc('close_pos_session', {
      p_session_id: params.sessionId,
      p_counts: params.counts,
      p_notes: params.notes ?? undefined
    })

    if (error) {
      console.error('Error closing POS session:', error)
      return {
        summary: null,
        errorMessage: error.message?.trim() || 'No se pudo cerrar la sesión de caja.'
      }
    }

    return { summary: parseSummary(data), errorMessage: null }
  }

  const getSessionSummary = async (sessionId: string): Promise<PosSessionSummary | null> => {
    const { data, error } = await supabase.rpc('get_pos_session_summary', {
      p_session_id: sessionId
    })

    if (error) {
      console.error('Error fetching POS session summary:', error)
      return null
    }

    return parseSummary(data)
  }

  const addCashMovement = async (params: {
    sessionId: string
    movementType: PosMovementType
    amount: number
    reason: string
  }): Promise<{ movementId: string | null; errorMessage: string | null }> => {
    const { data, error } = await supabase.rpc('add_pos_cash_movement', {
      p_session_id: params.sessionId,
      p_movement_type: params.movementType,
      p_amount: params.amount,
      p_reason: params.reason
    })

    if (error) {
      console.error('Error adding POS cash movement:', error)
      return {
        movementId: null,
        errorMessage: error.message?.trim() || 'No se pudo registrar el movimiento.'
      }
    }

    return { movementId: data, errorMessage: null }
  }

  const getCashMovements = async (sessionId: string): Promise<PosCashMovement[]> => {
    if (!sessionId) return []

    const { data, error } = await supabase
      .from('pos_cash_movement')
      .select('*')
      .eq('session_id', sessionId)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching POS cash movements:', error)
      return []
    }

    return data ?? []
  }

  const getSessionCounts = async (sessionId: string): Promise<PosSessionCount[]> => {
    if (!sessionId) return []

    const { data, error } = await supabase
      .from('pos_session_count')
      .select('*')
      .eq('session_id', sessionId)
      .eq('active', true)

    if (error) {
      console.error('Error fetching POS session counts:', error)
      return []
    }

    return data ?? []
  }

  const getSessionPayments = async (sessionId: string): Promise<PosPaymentView[]> => {
    if (!sessionId) return []

    const { data, error } = await supabase
      .from('v_pos_payments')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching POS payments:', error)
      return []
    }

    return data ?? []
  }

  return {
    getSessionsByCompany,
    getSessionViewById,
    getOpenSessionByRegister,
    getOpenSessionsByCompany,
    openSession,
    closeSession,
    getSessionSummary,
    addCashMovement,
    getCashMovements,
    getSessionCounts,
    getSessionPayments
  }
}
