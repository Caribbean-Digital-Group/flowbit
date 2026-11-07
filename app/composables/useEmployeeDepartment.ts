import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EmployeeDatabase,
  EmployeeDepartmentInsert,
  EmployeeDepartmentRow,
  EmployeeDepartmentUpdate
} from '~/types/employee.types'

/** Catálogo de departamentos (employee_department), jerárquico por parent_id. */
export const useEmployeeDepartment = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<EmployeeDatabase>
  const lastError = ref<string | null>(null)

  const fail = (context: string, error: { message: string; code?: string }): null => {
    console.error(`Error ${context}:`, error)
    lastError.value = employeeErrorMessage(error)
    return null
  }

  const getAll = async (companyId: string): Promise<EmployeeDepartmentRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('employee_department')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) {
      console.error('Error fetching departments:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<EmployeeDepartmentRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('employee_department')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching department:', error)
      return null
    }
    return data
  }

  const create = async (department: EmployeeDepartmentInsert): Promise<EmployeeDepartmentRow | null> => {
    lastError.value = null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('employee_department')
      .insert({ ...department, created_by: user?.id ?? null, updated_by: user?.id ?? null })
      .select()
      .single()
    if (error) return fail('creating department', error)
    return data
  }

  const update = async (id: string, updates: EmployeeDepartmentUpdate): Promise<EmployeeDepartmentRow | null> => {
    lastError.value = null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('employee_department')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating department', error)
    return data
  }

  const archive = async (id: string): Promise<boolean> => {
    return (await update(id, { active: false })) !== null
  }

  return { lastError, getAll, getById, create, update, archive }
}
