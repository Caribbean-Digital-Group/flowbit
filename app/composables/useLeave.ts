import type {
  HrLeaveAllocationInsert,
  HrLeaveAllocationRow,
  HrLeaveAllocationViewRow,
  HrLeaveBalanceRow,
  HrLeaveRequestInsert,
  HrLeaveRequestRow,
  HrLeaveRequestViewRow,
  HrLeaveTypeInsert,
  HrLeaveTypeRow,
  LeaveStatus
} from '~/types/hr.types'

/**
 * Vacaciones y permisos: tipos de ausencia, asignaciones (saldo), solicitudes
 * y saldos.
 *
 * Reglas que aplica la base:
 * - Aprobar pasa por `hr_review_leave_request`, que valida el saldo y
 *   justifica las faltas detectadas en el rango.
 * - Un miembro solo crea solicitudes propias pendientes y solo puede
 *   cancelarlas mientras sigan pendientes.
 * - `days` cuenta los días laborables del horario del empleado, sin festivos.
 */
export const useLeave = () => {
  const { supabase, lastError, fail, rpc, userId } = useHrClient()

  // ─── Tipos ────────────────────────────────────────────────────────────────

  const getTypes = async (companyId: string): Promise<HrLeaveTypeRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('hr_leave_type')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) {
      console.error('Error fetching leave types:', error)
      return []
    }
    return data ?? []
  }

  const getType = async (id: string, companyId: string): Promise<HrLeaveTypeRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('hr_leave_type')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching leave type', error)
    return data
  }

  const createType = async (type: HrLeaveTypeInsert): Promise<HrLeaveTypeRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('hr_leave_type')
      .insert({ ...type, created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating leave type', error)
    return data
  }

  const updateType = async (id: string, updates: Partial<HrLeaveTypeRow>): Promise<HrLeaveTypeRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('hr_leave_type')
      .update({ ...updates, updated_by: await userId() })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating leave type', error)
    return data
  }

  const archiveType = async (id: string): Promise<boolean> =>
    (await updateType(id, { active: false })) !== null

  // ─── Solicitudes ──────────────────────────────────────────────────────────

  const getRequests = async (
    companyId: string,
    filters: { status?: LeaveStatus; employeeId?: string; from?: string; to?: string } = {}
  ): Promise<HrLeaveRequestViewRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('v_hr_leave_requests')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('start_date', { ascending: false })
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters.from) query = query.gte('end_date', filters.from)
    if (filters.to) query = query.lte('start_date', filters.to)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching leave requests:', error)
      return []
    }
    return data ?? []
  }

  const getRequest = async (id: string, companyId: string): Promise<HrLeaveRequestViewRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('v_hr_leave_requests')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching leave request', error)
    return data
  }

  const createRequest = async (request: HrLeaveRequestInsert): Promise<HrLeaveRequestRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('hr_leave_request')
      .insert({ ...request, status: 'pending', created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating leave request', error)
    return data
  }

  const updateRequest = async (
    id: string,
    updates: Partial<Pick<HrLeaveRequestRow, 'leave_type_id' | 'start_date' | 'end_date' | 'half_day' | 'reason'>>
  ): Promise<HrLeaveRequestRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('hr_leave_request')
      .update({ ...updates, updated_by: await userId() })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating leave request', error)
    return data
  }

  const reviewRequest = async (id: string, approve: boolean, notes: string | null): Promise<HrLeaveRequestRow | null> =>
    rpc<HrLeaveRequestRow>('hr_review_leave_request', {
      p_request_id: id,
      p_approve: approve,
      p_notes: notes
    }, 'reviewing leave request')

  const cancelRequest = async (id: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase
      .from('hr_leave_request')
      .update({ status: 'cancelled', updated_by: await userId() })
      .eq('id', id)
    if (error) {
      fail('cancelling leave request', error)
      return false
    }
    return true
  }

  /** Días laborables que contaría una solicitud, para mostrarlos antes de guardar. */
  const countDays = async (employeeId: string, start: string, end: string, halfDay: boolean): Promise<number | null> => {
    if (!employeeId || !start || !end || end < start) return null
    const days = await rpc<number>('hr_count_leave_days', {
      p_employee_id: employeeId,
      p_start: start,
      p_end: end,
      p_half_day: halfDay
    }, 'counting leave days')
    return days === null ? null : Number(days)
  }

  // ─── Asignaciones y saldos ────────────────────────────────────────────────

  const getAllocations = async (companyId: string, employeeId?: string): Promise<HrLeaveAllocationViewRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('v_hr_leave_allocations')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (employeeId) query = query.eq('employee_id', employeeId)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching leave allocations:', error)
      return []
    }
    return data ?? []
  }

  const createAllocation = async (allocation: HrLeaveAllocationInsert): Promise<HrLeaveAllocationRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('hr_leave_allocation')
      .insert({ ...allocation, created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating leave allocation', error)
    return data
  }

  const archiveAllocation = async (id: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase
      .from('hr_leave_allocation')
      .update({ active: false, updated_by: await userId() })
      .eq('id', id)
    if (error) {
      fail('archiving leave allocation', error)
      return false
    }
    return true
  }

  /** Asigna las vacaciones por antigüedad del año de servicio en curso. */
  const generateVacationAllocations = async (companyId: string, asOf: string): Promise<number | null> =>
    rpc<number>('hr_generate_vacation_allocations', { p_company_id: companyId, p_as_of: asOf }, 'generating vacation allocations')

  const getBalances = async (companyId: string, employeeId?: string): Promise<HrLeaveBalanceRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('v_hr_leave_balances')
      .select('*')
      .eq('company_id', companyId)
      .order('employee_name')
    if (employeeId) query = query.eq('employee_id', employeeId)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching leave balances:', error)
      return []
    }
    return (data ?? []).map(b => ({
      ...b,
      allocated_days: Number(b.allocated_days),
      taken_days: Number(b.taken_days),
      pending_days: Number(b.pending_days),
      remaining_days: Number(b.remaining_days)
    }))
  }

  return {
    lastError,
    getTypes,
    getType,
    createType,
    updateType,
    archiveType,
    getRequests,
    getRequest,
    createRequest,
    updateRequest,
    reviewRequest,
    cancelRequest,
    countDays,
    getAllocations,
    createAllocation,
    archiveAllocation,
    generateVacationAllocations,
    getBalances
  }
}
