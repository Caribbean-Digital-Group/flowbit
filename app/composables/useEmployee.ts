import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables } from '~/types/database.types'
import type {
  EmployeeDatabase,
  EmployeeNewContact,
  EmployeePrivateRow,
  EmployeePrivateUpdate,
  EmployeeRegistration,
  EmployeeRow,
  EmployeeUpdate,
  EmployeeViewRow
} from '~/types/employee.types'

/**
 * Expediente de empleados. El empleado es un `partner` marcado por empresa:
 * los datos del contacto se editan en Contactos y aquí solo los datos laborales.
 *
 * `employee_private` solo la leen owner y admin. Para el resto del equipo
 * `getPrivate` devuelve `null`, igual que si la fila no existiera.
 */
export const useEmployee = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<EmployeeDatabase>
  const { getPartnersByCompany } = usePartner()
  const lastError = ref<string | null>(null)

  const fail = (context: string, error: { message: string; code?: string }): null => {
    console.error(`Error ${context}:`, error)
    lastError.value = employeeErrorMessage(error)
    return null
  }

  const getAll = async (companyId: string): Promise<EmployeeViewRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('v_employees')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('partner_name')
    if (error) {
      console.error('Error fetching employees:', error)
      return []
    }
    return data ?? []
  }

  const getById = async (id: string, companyId: string): Promise<EmployeeViewRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('v_employees')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching employee:', error)
      return null
    }
    return data
  }

  const getByPartner = async (partnerId: string, companyId: string): Promise<EmployeeViewRow | null> => {
    if (!partnerId || !companyId) return null
    const { data, error } = await supabase
      .from('v_employees')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('company_id', companyId)
      .eq('active', true)
      .maybeSingle()
    if (error) {
      console.error('Error fetching employee by partner:', error)
      return null
    }
    return data
  }

  const getPrivate = async (employeeId: string, companyId: string): Promise<EmployeePrivateRow | null> => {
    if (!employeeId || !companyId) return null
    const { data, error } = await supabase
      .from('employee_private')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching employee private data:', error)
      return null
    }
    return data
  }

  /**
   * Personas de la empresa que aún no son empleados: contactos de negocio y
   * miembros del equipo, que viven en relaciones distintas.
   */
  const getEligiblePartners = async (companyId: string): Promise<Tables<'partner'>[]> => {
    if (!companyId) return []
    const options = { active: true, companyType: 'person' } as const
    const [contacts, team, employees] = await Promise.all([
      getPartnersByCompany(companyId, options),
      getPartnersByCompany(companyId, { ...options, relationshipType: 'team' }),
      getAll(companyId)
    ])
    const employeeIds = new Set(employees.map(e => e.partner_id))
    const unique = new Map([...contacts, ...team].map(p => [p.id, p]))
    return [...unique.values()]
      .filter(p => !employeeIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))
  }

  /**
   * Da de alta a un empleado sobre un contacto existente o, con `newContact`,
   * crea el contacto en la misma transacción. Si la persona tuvo un expediente
   * archivado, lo reactiva con sus datos anteriores.
   */
  const register = async (
    companyId: string,
    source: { partnerId: string } | { newContact: EmployeeNewContact },
    employee: EmployeeRegistration = {}
  ): Promise<EmployeeRow | null> => {
    lastError.value = null
    const { data, error } = await supabase.rpc(
      'register_employee' as never,
      {
        p_company_id: companyId,
        p_partner_id: 'partnerId' in source ? source.partnerId : null,
        p_partner: 'newContact' in source ? source.newContact : null,
        p_employee: employee
      } as never
    ) as unknown as {
      data: EmployeeRow | null
      error: { message: string; code?: string } | null
    }
    if (error) return fail('registering employee', error)
    return data
  }

  const update = async (id: string, updates: EmployeeUpdate): Promise<EmployeeRow | null> => {
    lastError.value = null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('employee')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating employee', error)
    return data
  }

  const updatePrivate = async (
    employeeId: string,
    updates: EmployeePrivateUpdate
  ): Promise<EmployeePrivateRow | null> => {
    lastError.value = null
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('employee_private')
      .update({ ...updates, updated_by: user?.id ?? null })
      .eq('employee_id', employeeId)
      .select()
      .single()
    if (error) return fail('updating employee private data', error)
    return data
  }

  /** Quita la marca de empleado. El contacto sigue activo en Contactos. */
  const archive = async (id: string): Promise<boolean> => {
    return (await update(id, { active: false })) !== null
  }

  return {
    lastError,
    getAll,
    getById,
    getByPartner,
    getPrivate,
    getEligiblePartners,
    register,
    update,
    updatePrivate,
    archive
  }
}
