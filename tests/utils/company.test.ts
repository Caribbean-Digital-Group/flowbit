import { describe, expect, it } from 'vitest'
import {
  MAX_OWNED_COMPANIES,
  canCreateCompany,
  companyRoleLabel,
  countOwnedCompanies,
  describeCreateCompanyError,
  sortCompanyEntries,
  validateCompanyName,
  type CompanyListEntry
} from '../../app/utils/company'

const entry = (id: string, name: string, role = 'owner', isDefault = false): CompanyListEntry => ({
  company: { id, name },
  role,
  isDefault
})

describe('validateCompanyName', () => {
  it('exige un nombre', () => {
    expect(validateCompanyName('   ')).toBe('El nombre de la empresa es obligatorio.')
  })

  it('rechaza nombres demasiado cortos o largos', () => {
    expect(validateCompanyName('A')).toContain('al menos 2')
    expect(validateCompanyName('x'.repeat(121))).toContain('120')
  })

  it('acepta un nombre válido con espacios alrededor', () => {
    expect(validateCompanyName('  Abarrotes La Esquina  ')).toBeNull()
    expect(validateCompanyName('x'.repeat(120))).toBeNull()
  })
})

describe('companyRoleLabel', () => {
  it('traduce los roles conocidos y cae a «Miembro»', () => {
    expect(companyRoleLabel('owner')).toBe('Propietario')
    expect(companyRoleLabel('admin')).toBe('Administrador')
    expect(companyRoleLabel('otro')).toBe('Miembro')
  })
})

describe('límite de empresas propias', () => {
  it('solo cuenta las empresas donde la persona es owner', () => {
    const entries = [entry('1', 'A'), entry('2', 'B', 'admin'), entry('3', 'C', 'member')]
    expect(countOwnedCompanies(entries)).toBe(1)
    expect(canCreateCompany(entries)).toBe(true)
  })

  it('bloquea al llegar al máximo', () => {
    const owned = Array.from({ length: MAX_OWNED_COMPANIES }, (_, i) => entry(String(i), `E${i}`))
    expect(canCreateCompany(owned)).toBe(false)
    expect(canCreateCompany([...owned.slice(1), entry('x', 'Invitada', 'admin')])).toBe(true)
  })
})

describe('sortCompanyEntries', () => {
  it('pone primero la empresa en uso, luego la predeterminada y el resto por nombre', () => {
    const entries = [
      entry('z', 'Zapatería'),
      entry('d', 'Dulcería', 'owner', true),
      entry('a', 'ábaco'),
      entry('s', 'Seleccionada', 'member')
    ]
    expect(sortCompanyEntries(entries, 's').map(e => e.company.id)).toEqual(['s', 'd', 'a', 'z'])
  })

  it('no modifica el arreglo original', () => {
    const entries = [entry('b', 'B'), entry('a', 'A')]
    sortCompanyEntries(entries, null)
    expect(entries.map(e => e.company.id)).toEqual(['b', 'a'])
  })
})

describe('describeCreateCompanyError', () => {
  it('explica el límite', () => {
    expect(describeCreateCompanyError({ code: 'P0001', hint: 'company_limit_reached' }))
      .toContain(`${MAX_OWNED_COMPANIES} empresas`)
  })

  it('avisa cuando falta la migración', () => {
    expect(describeCreateCompanyError({ code: 'PGRST202' })).toContain('migración')
  })

  it('muestra el mensaje de validación de la base', () => {
    expect(describeCreateCompanyError({ code: '22023', message: 'La moneda debe ser un código de 3 letras' }))
      .toBe('La moneda debe ser un código de 3 letras')
  })

  it('cae a un mensaje genérico', () => {
    expect(describeCreateCompanyError(null)).toContain('No se pudo crear')
    expect(describeCreateCompanyError({ code: 'XX000', message: 'detalle interno' })).not.toContain('detalle interno')
  })
})
