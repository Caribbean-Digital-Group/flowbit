import type { HrWorkScheduleLineInput, HrWorkScheduleLineRow, HrWorkScheduleRow } from '~/types/hr.types'

export type WorkScheduleWithLines = HrWorkScheduleRow & { lines: HrWorkScheduleLineRow[] }

/**
 * Horarios de trabajo. El horario y sus líneas se guardan juntos con el RPC
 * `hr_save_work_schedule` para no dejar un horario a medias.
 */
export const useWorkSchedule = () => {
  const { supabase, lastError, fail, rpc, userId } = useHrClient()

  const getAll = async (companyId: string): Promise<WorkScheduleWithLines[]> => {
    if (!companyId) return []
    const [schedules, lines] = await Promise.all([
      supabase.from('hr_work_schedule').select('*').eq('company_id', companyId).eq('active', true).order('name'),
      supabase.from('hr_work_schedule_line').select('*').eq('company_id', companyId).eq('active', true).order('weekday')
    ])
    if (schedules.error || lines.error) {
      console.error('Error fetching schedules:', schedules.error ?? lines.error)
      return []
    }
    return (schedules.data ?? []).map(s => ({
      ...s,
      lines: (lines.data ?? []).filter(l => l.schedule_id === s.id)
    }))
  }

  const getById = async (id: string, companyId: string): Promise<WorkScheduleWithLines | null> => {
    if (!id || !companyId) return null
    const [schedule, lines] = await Promise.all([
      supabase.from('hr_work_schedule').select('*').eq('id', id).eq('company_id', companyId).maybeSingle(),
      supabase.from('hr_work_schedule_line').select('*').eq('schedule_id', id).eq('active', true).order('weekday')
    ])
    if (schedule.error || lines.error) {
      console.error('Error fetching schedule:', schedule.error ?? lines.error)
      return null
    }
    return schedule.data ? { ...schedule.data, lines: lines.data ?? [] } : null
  }

  const save = async (
    companyId: string,
    scheduleId: string | null,
    schedule: { name: string; description: string | null; late_tolerance_minutes: number | null },
    lines: HrWorkScheduleLineInput[]
  ): Promise<HrWorkScheduleRow | null> =>
    rpc<HrWorkScheduleRow>('hr_save_work_schedule', {
      p_company_id: companyId,
      p_schedule_id: scheduleId,
      p_schedule: schedule,
      p_lines: lines
    }, 'saving schedule')

  const archive = async (id: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase
      .from('hr_work_schedule')
      .update({ active: false, updated_by: await userId() })
      .eq('id', id)
    if (error) {
      fail('archiving schedule', error)
      return false
    }
    return true
  }

  return { lastError, getAll, getById, save, archive }
}
