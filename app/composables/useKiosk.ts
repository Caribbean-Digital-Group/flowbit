import type { HrKioskRow, KioskInfo, KioskPunchResult } from '~/types/hr.types'

/**
 * Kioscos de marcaje y NIP de los empleados.
 *
 * El token de un kiosco solo se conoce al crearlo o regenerarlo: la base
 * guarda su hash. Los NIP tampoco se pueden leer; solo se sabe quién tiene uno.
 */
export const useKiosk = () => {
  const { supabase, lastError, fail, rpc, userId } = useHrClient()
  const siteUrl = useRuntimeConfig().public.siteUrl as string | undefined

  const getAll = async (companyId: string): Promise<HrKioskRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('hr_kiosk')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')
    if (error) {
      console.error('Error fetching kiosks:', error)
      return []
    }
    return data ?? []
  }

  /** Crea el kiosco y devuelve el token en claro, que no se vuelve a mostrar. */
  const create = async (companyId: string, name: string, location: string | null) =>
    rpc<{ id: string; token: string }>('hr_create_kiosk', {
      p_company_id: companyId,
      p_name: name,
      p_location: location
    }, 'creating kiosk')

  const regenerateToken = async (kioskId: string) =>
    rpc<{ id: string; token: string }>('hr_regenerate_kiosk_token', { p_kiosk_id: kioskId }, 'regenerating kiosk token')

  const archive = async (id: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase
      .from('hr_kiosk')
      .update({ active: false, updated_by: await userId() })
      .eq('id', id)
    if (error) {
      fail('archiving kiosk', error)
      return false
    }
    return true
  }

  /** Asigna o cambia el NIP. Una cadena vacía lo elimina. */
  const setPin = async (employeeId: string, pin: string): Promise<boolean> =>
    (await rpc<boolean>('hr_set_kiosk_pin', { p_employee_id: employeeId, p_pin: pin || null }, 'setting kiosk PIN')) === true

  const getEmployeesWithPin = async (companyId: string): Promise<Set<string>> => {
    const rows = await rpc<string[]>('hr_kiosk_pin_employees', { p_company_id: companyId }, 'fetching kiosk PINs')
    return new Set(rows ?? [])
  }

  /** URL pública del kiosco. */
  const kioskUrl = (token: string): string => {
    const origin = siteUrl || (import.meta.client ? window.location.origin : '')
    return `${origin.replace(/\/$/, '')}/kiosk/${token}`
  }

  return { lastError, getAll, create, regenerateToken, archive, setPin, getEmployeesWithPin, kioskUrl }
}

/** Llamadas del kiosco público (sin sesión). */
export const useKioskPublic = () => {
  const { rpc } = useHrClient()

  const info = async (token: string): Promise<KioskInfo | null> =>
    rpc<KioskInfo>('kiosk_info', { p_token: token }, 'fetching kiosk info')

  const punch = async (token: string, pin: string): Promise<KioskPunchResult | null> =>
    rpc<KioskPunchResult>('kiosk_punch', { p_token: token, p_pin: pin }, 'punching attendance')

  return { info, punch }
}
