import type { HrSalaryInsert, HrSalaryRow, HrSalaryViewRow } from '~/types/hr.types'

/**
 * Historial de salarios (solo owner/admin). El salario vigente se copia por
 * trigger a `employee_private` (sueldo mensual, SBC y SDI).
 */
export const useSalary = () => {
  const { supabase, lastError, fail, userId } = useHrClient()

  const getAll = async (companyId: string, employeeId?: string): Promise<HrSalaryViewRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('v_hr_salaries')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('effective_date', { ascending: false })
    if (employeeId) query = query.eq('employee_id', employeeId)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching salaries:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<HrSalaryViewRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('v_hr_salaries')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching salary', error)
    return data
  }

  /**
   * Salario vigente de cada empleado a una fecha: la fila activa más reciente
   * con `effective_date` menor o igual.
   */
  const getCurrentByEmployee = async (companyId: string, asOf: string): Promise<Map<string, HrSalaryRow>> => {
    const result = new Map<string, HrSalaryRow>()
    if (!companyId) return result
    const { data, error } = await supabase
      .from('hr_salary')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .lte('effective_date', asOf)
      .order('effective_date', { ascending: false })
    if (error) {
      console.error('Error fetching current salaries:', error)
      return result
    }
    for (const row of data ?? []) {
      if (!result.has(row.employee_id)) result.set(row.employee_id, row)
    }
    return result
  }

  const create = async (salary: HrSalaryInsert): Promise<HrSalaryRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('hr_salary')
      .insert({ ...salary, created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating salary', error)
    return data
  }

  const update = async (id: string, updates: Partial<HrSalaryRow>): Promise<HrSalaryRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('hr_salary')
      .update({ ...updates, updated_by: await userId() })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating salary', error)
    return data
  }

  const archive = async (id: string): Promise<boolean> => (await update(id, { active: false })) !== null

  return { lastError, getAll, getById, getCurrentByEmployee, create, update, archive }
}
