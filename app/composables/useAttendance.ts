import type {
  HrAttendanceDayRow,
  HrAttendanceDayViewRow,
  HrAttendanceInsert,
  HrAttendanceRow,
  HrAttendanceSummaryRow,
  HrAttendanceViewRow
} from '~/types/hr.types'

export interface AttendanceFilters {
  from: string
  to: string
  employeeId?: string
}

/**
 * Asistencia: marcas (`hr_attendance`), resumen diario (`hr_attendance_day`,
 * lo mantiene la base) y el reporte por empleado (`hr_attendance_summary`).
 *
 * Owner y admin ven a todo el equipo; el resto solo sus propias marcas.
 */
export const useAttendance = () => {
  const { supabase, lastError, fail, rpc, userId } = useHrClient()

  const getAttendances = async (companyId: string, filters: AttendanceFilters): Promise<HrAttendanceViewRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('v_hr_attendances')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .gte('work_date', filters.from)
      .lte('work_date', filters.to)
      .order('check_in', { ascending: false })
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching attendances:', error)
      return []
    }
    return data ?? []
  }

  const getAttendance = async (id: string, companyId: string): Promise<HrAttendanceViewRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('v_hr_attendances')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching attendance', error)
    return data
  }

  const getDays = async (companyId: string, filters: AttendanceFilters): Promise<HrAttendanceDayViewRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('v_hr_attendance_days')
      .select('*')
      .eq('company_id', companyId)
      .gte('work_date', filters.from)
      .lte('work_date', filters.to)
      .order('work_date', { ascending: false })
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching attendance days:', error)
      return []
    }
    return data ?? []
  }

  const getSummary = async (companyId: string, from: string, to: string): Promise<HrAttendanceSummaryRow[]> => {
    if (!companyId) return []
    const rows = await rpc<HrAttendanceSummaryRow[]>('hr_attendance_summary', {
      p_company_id: companyId,
      p_from: from,
      p_to: to
    }, 'fetching attendance summary')
    // Los BIGINT llegan como número o texto según el driver: se normalizan.
    return (rows ?? []).map(r => ({
      ...r,
      worked_minutes: Number(r.worked_minutes),
      scheduled_minutes: Number(r.scheduled_minutes),
      late_minutes: Number(r.late_minutes),
      overtime_minutes: Number(r.overtime_minutes),
      overtime_approved_minutes: Number(r.overtime_approved_minutes),
      overtime_pending_minutes: Number(r.overtime_pending_minutes),
      leave_days: Number(r.leave_days)
    }))
  }

  const create = async (attendance: HrAttendanceInsert): Promise<HrAttendanceRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('hr_attendance')
      .insert({ ...attendance, source: 'manual', created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating attendance', error)
    return data
  }

  const update = async (
    id: string,
    updates: Partial<Pick<HrAttendanceRow, 'check_in' | 'check_out' | 'notes' | 'missing_check_out'>>
  ): Promise<HrAttendanceRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('hr_attendance')
      .update({ ...updates, updated_by: await userId() })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating attendance', error)
    return data
  }

  const archive = async (id: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase
      .from('hr_attendance')
      .update({ active: false, updated_by: await userId() })
      .eq('id', id)
    if (error) {
      fail('archiving attendance', error)
      return false
    }
    return true
  }

  /** Aprueba (todas o `minutes`) o rechaza las horas extra de un día. */
  const reviewOvertime = async (dayId: string, approve: boolean, minutes?: number): Promise<HrAttendanceDayRow | null> =>
    rpc<HrAttendanceDayRow>('hr_review_overtime', {
      p_day_id: dayId,
      p_approve: approve,
      p_minutes: minutes ?? null
    }, 'reviewing overtime')

  return { lastError, getAttendances, getAttendance, getDays, getSummary, create, update, archive, reviewOvertime }
}
