import type { HrAbsenceInsert, HrAbsenceRow, HrAbsenceViewRow } from '~/types/hr.types'

/**
 * Inasistencias. `detect` crea una falta injustificada por cada día laborable
 * sin marcas, festivo ni permiso aprobado; es idempotente y una falta
 * descartada no se vuelve a crear.
 */
export const useAbsence = () => {
  const { supabase, lastError, fail, rpc, userId } = useHrClient()

  const getAll = async (
    companyId: string,
    filters: { from: string; to: string; employeeId?: string; kind?: HrAbsenceRow['kind'] }
  ): Promise<HrAbsenceViewRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('v_hr_absences')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .gte('absence_date', filters.from)
      .lte('absence_date', filters.to)
      .order('absence_date', { ascending: false })
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters.kind) query = query.eq('kind', filters.kind)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching absences:', error)
      return []
    }
    return data ?? []
  }

  const detect = async (companyId: string, from: string, to: string): Promise<number | null> =>
    rpc<number>('hr_detect_absences', { p_company_id: companyId, p_from: from, p_to: to }, 'detecting absences')

  const create = async (absence: HrAbsenceInsert): Promise<HrAbsenceRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('hr_absence')
      .insert({ ...absence, created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating absence', error)
    return data
  }

  const update = async (
    id: string,
    updates: Partial<Pick<HrAbsenceRow, 'kind' | 'deduct_from_pay' | 'reason' | 'active'>>
  ): Promise<HrAbsenceRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('hr_absence')
      .update({ ...updates, updated_by: await userId() })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating absence', error)
    return data
  }

  const justify = (id: string, reason: string, deductFromPay = false) =>
    update(id, { kind: 'justified', deduct_from_pay: deductFromPay, reason: reason || null })

  /** Descarta la falta. No se vuelve a crear al detectar de nuevo. */
  const dismiss = async (id: string): Promise<boolean> => (await update(id, { active: false })) !== null

  return { lastError, getAll, detect, create, update, justify, dismiss }
}
