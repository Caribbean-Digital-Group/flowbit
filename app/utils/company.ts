// Reglas puras de multiempresa (TRY-76): validación del alta, etiquetas de rol
// y orden del listado «Mis empresas». Sin dependencias de Vue ni de Supabase.

/** Debe coincidir con `max_owned_companies()` en la base. */
export const MAX_OWNED_COMPANIES = 10

export const COMPANY_NAME_MIN_LENGTH = 2
export const COMPANY_NAME_MAX_LENGTH = 120

export interface CompanyListEntry {
  company: { id: string; name: string }
  role: string
  isDefault: boolean
}

/** Devuelve el mensaje de error del nombre, o `null` si es válido. */
export const validateCompanyName = (name: string): string | null => {
  const trimmed = name.trim()
  if (!trimmed) return 'El nombre de la empresa es obligatorio.'
  if (trimmed.length < COMPANY_NAME_MIN_LENGTH) {
    return `El nombre debe tener al menos ${COMPANY_NAME_MIN_LENGTH} caracteres.`
  }
  if (trimmed.length > COMPANY_NAME_MAX_LENGTH) {
    return `El nombre no puede pasar de ${COMPANY_NAME_MAX_LENGTH} caracteres.`
  }
  return null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Solo lectura',
  guest: 'Invitado'
}

export const companyRoleLabel = (role: string): string => ROLE_LABELS[role] ?? 'Miembro'

export const countOwnedCompanies = (entries: readonly CompanyListEntry[]): number =>
  entries.filter(entry => entry.role === 'owner').length

export const canCreateCompany = (entries: readonly CompanyListEntry[]): boolean =>
  countOwnedCompanies(entries) < MAX_OWNED_COMPANIES

/**
 * Orden del listado: primero la empresa en uso, luego la predeterminada y el
 * resto por nombre. No modifica el arreglo original.
 */
export const sortCompanyEntries = <T extends CompanyListEntry>(
  entries: readonly T[],
  selectedCompanyId: string | null
): T[] => {
  const rank = (entry: T): number => {
    if (entry.company.id === selectedCompanyId) return 0
    if (entry.isDefault) return 1
    return 2
  }
  return [...entries].sort((a, b) =>
    rank(a) - rank(b) || a.company.name.localeCompare(b.company.name, 'es-MX', { sensitivity: 'base' })
  )
}

interface RpcErrorLike {
  code?: string
  message?: string
  hint?: string | null
}

/** Traduce el error del RPC `create_company` a un mensaje para la persona. */
export const describeCreateCompanyError = (error: RpcErrorLike | null | undefined): string => {
  if (!error) return 'No se pudo crear la empresa. Intenta de nuevo.'
  if (error.hint === 'company_limit_reached') {
    return `Llegaste al límite de ${MAX_OWNED_COMPANIES} empresas propias. Si necesitas más, contáctanos.`
  }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return 'La creación de empresas aún no está disponible en esta base de datos (falta aplicar la migración).'
  }
  if (error.code === '22023' && error.message) return error.message
  if (error.code === '42501') return 'Inicia sesión de nuevo para crear una empresa.'
  return 'No se pudo crear la empresa. Intenta de nuevo.'
}
