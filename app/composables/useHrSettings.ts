import type { HrHolidayInsert, HrHolidayRow, HrSettingsRow, HrSettingsUpdate } from '~/types/hr.types'

/**
 * Ajustes de RR. HH. de la empresa y días festivos.
 * Los ajustes existen siempre: `ensureDefaults` crea la fila y los tipos de
 * ausencia básicos la primera vez.
 */
export const useHrSettings = () => {
  const { supabase, lastError, fail, rpc, userId } = useHrClient()

  const ensureDefaults = async (companyId: string): Promise<boolean> => {
    await rpc<null>('hr_ensure_defaults', { p_company_id: companyId }, 'ensuring HR defaults')
    return lastError.value === null
  }

  const get = async (companyId: string): Promise<HrSettingsRow | null> => {
    if (!companyId) return null
    const { data, error } = await supabase
      .from('hr_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching HR settings', error)
    return data
  }

  const update = async (companyId: string, updates: HrSettingsUpdate): Promise<HrSettingsRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('hr_settings')
      .update({ ...updates, updated_by: await userId() })
      .eq('company_id', companyId)
      .select()
      .single()
    if (error) return fail('updating HR settings', error)
    return data
  }

  const getHolidays = async (companyId: string, year?: number): Promise<HrHolidayRow[]> => {
    if (!companyId) return []
    let query = supabase
      .from('hr_holiday')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('holiday_date')
    if (year) query = query.gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`)
    const { data, error } = await query
    if (error) {
      console.error('Error fetching holidays:', error)
      return []
    }
    return data ?? []
  }

  const createHoliday = async (holiday: HrHolidayInsert): Promise<HrHolidayRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('hr_holiday')
      .insert({ ...holiday, created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating holiday', error)
    return data
  }

  const archiveHoliday = async (id: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase
      .from('hr_holiday')
      .update({ active: false, updated_by: await userId() })
      .eq('id', id)
    if (error) {
      fail('archiving holiday', error)
      return false
    }
    return true
  }

  /** Agrega los festivos de ley del año que aún no existan. Devuelve cuántos agregó. */
  const loadStatutoryHolidays = async (companyId: string, year: number): Promise<number> => {
    const existing = new Set((await getHolidays(companyId, year)).map(h => h.holiday_date))
    const missing = mexicoStatutoryHolidays(year).filter(h => !existing.has(h.date))
    if (missing.length === 0) return 0
    const uid = await userId()
    const { error } = await supabase.from('hr_holiday').insert(missing.map(h => ({
      company_id: companyId,
      holiday_date: h.date,
      name: h.name,
      is_statutory: true,
      created_by: uid,
      updated_by: uid
    })))
    if (error) {
      fail('loading statutory holidays', error)
      return 0
    }
    return missing.length
  }

  return { lastError, ensureDefaults, get, update, getHolidays, createHoliday, archiveHoliday, loadStatutoryHolidays }
}
