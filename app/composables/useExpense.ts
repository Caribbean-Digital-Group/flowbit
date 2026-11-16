import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExpenseDatabase,
  ExpenseInsert,
  ExpenseRow,
  ExpenseStatus,
  ExpenseUpdate
} from '~/types/expense.types'

export interface ExpenseFilters {
  /** Fecha del gasto desde (`YYYY-MM-DD`, incluida). */
  from?: string
  /** Fecha del gasto hasta (`YYYY-MM-DD`, incluida). */
  to?: string
  status?: ExpenseStatus
  categoryId?: string
}

/**
 * Gastos operativos (expense). El cast del cliente es temporal hasta
 * regenerar database.types.ts. Ver docs/expenses.md.
 */
export const useExpense = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<ExpenseDatabase>
  const lastError = ref<string | null>(null)

  const fail = (context: string, error: { message: string; code?: string }): null => {
    console.error(`Error ${context}:`, error)
    lastError.value = error.code === '42P01'
      ? 'La base de datos aún no tiene el módulo de gastos. Aplica las migraciones pendientes con «npm run db:push».'
      : (error.message?.trim() || 'No se pudo completar la operación.')
    return null
  }

  /** Todos los gastos activos de la empresa (por bloques, sin el corte de 1000 filas). */
  const getByCompany = async (companyId: string, filters: ExpenseFilters = {}): Promise<ExpenseRow[]> => {
    if (!companyId) return []
    lastError.value = null

    const { data, error } = await fetchAllRows((from, to) => {
      let query = supabase
        .from('expense')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
      if (filters.from) query = query.gte('expense_date', filters.from)
      if (filters.to) query = query.lte('expense_date', filters.to)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
      return query
        .order('expense_date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
    })

    if (error) { fail('fetching expenses', error); return [] }
    return data
  }

  /**
   * Gastos pagados cuyo pago cae en el periodo, para el estado de resultados.
   * Filtra por `paid_at`; el trigger lo llena siempre al marcar un gasto como pagado.
   */
  const getPaidInRange = async (companyId: string, from: string, to: string): Promise<ExpenseRow[]> => {
    if (!companyId) return []
    lastError.value = null

    const { data, error } = await fetchAllRows((rangeFrom, rangeTo) => supabase
      .from('expense')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .eq('status', 'paid')
      .gte('paid_at', from)
      .lte('paid_at', to)
      .order('paid_at', { ascending: true })
      .order('id', { ascending: true })
      .range(rangeFrom, rangeTo))

    if (error) { fail('fetching paid expenses', error); return [] }
    return data
  }

  const getById = async (id: string, companyId: string): Promise<ExpenseRow | null> => {
    if (!id || !companyId) return null
    lastError.value = null
    const { data, error } = await supabase
      .from('expense')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching expense', error)
    return data
  }

  const create = async (companyId: string, payload: Omit<ExpenseInsert, 'company_id'>): Promise<ExpenseRow | null> => {
    lastError.value = null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('expense')
      .insert({ ...payload, company_id: companyId, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) return fail('creating expense', error)
    return data
  }

  const update = async (id: string, companyId: string, updates: ExpenseUpdate): Promise<ExpenseRow | null> => {
    lastError.value = null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('expense')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()
    if (error) return fail('updating expense', error)
    return data
  }

  /** Cambia solo el estado (aprobar, pagar, cancelar). El trigger ajusta `paid_at`. */
  const setStatus = async (id: string, companyId: string, status: ExpenseStatus): Promise<ExpenseRow | null> =>
    update(id, companyId, { status })

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    lastError.value = null
    const user = await useSupabaseUser()
    const { error } = await supabase
      .from('expense')
      .update({ active: false, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) { fail('archiving expense', error); return false }
    return true
  }

  return { lastError, getByCompany, getPaidInRange, getById, create, update, setStatus, archive }
}
