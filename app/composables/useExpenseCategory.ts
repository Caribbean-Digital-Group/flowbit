import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExpenseCategoryInsert,
  ExpenseCategoryRow,
  ExpenseCategoryUpdate,
  ExpenseDatabase
} from '~/types/expense.types'

/**
 * CRUD del catálogo de categorías de gasto (expense_category).
 * El cast del cliente es temporal hasta regenerar database.types.ts.
 */
export const useExpenseCategory = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<ExpenseDatabase>

  const getByCompany = async (
    companyId: string,
    options: { includeArchived?: boolean } = {}
  ): Promise<ExpenseCategoryRow[]> => {
    if (!companyId) return []

    const { data, error } = await fetchAllRows((from, to) => {
      let query = supabase
        .from('expense_category')
        .select('*')
        .eq('company_id', companyId)
      if (!options.includeArchived) query = query.eq('active', true)
      return query
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    })

    if (error) { console.error('Error fetching expense categories:', error); return [] }
    return data
  }

  const getById = async (id: string, companyId: string): Promise<ExpenseCategoryRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('expense_category')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) { console.error('Error fetching expense category:', error); return null }
    return data
  }

  const create = async (
    companyId: string,
    payload: Omit<ExpenseCategoryInsert, 'company_id'>
  ): Promise<ExpenseCategoryRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('expense_category')
      .insert({ ...payload, company_id: companyId, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) { console.error('Error creating expense category:', error); return null }
    return data
  }

  const update = async (
    id: string,
    companyId: string,
    updates: ExpenseCategoryUpdate
  ): Promise<ExpenseCategoryRow | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('expense_category')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()
    if (error) { console.error('Error updating expense category:', error); return null }
    return data
  }

  const archive = async (id: string, companyId: string): Promise<boolean> => {
    const user = await useSupabaseUser()
    const { error } = await supabase
      .from('expense_category')
      .update({ active: false, updated_by: user?.id ?? null })
      .eq('id', id)
      .eq('company_id', companyId)
    if (error) { console.error('Error archiving expense category:', error); return false }
    return true
  }

  return { getByCompany, getById, create, update, archive }
}
