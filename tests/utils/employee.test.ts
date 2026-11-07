import { describe, expect, it } from 'vitest'
import {
  employeeErrorMessage,
  toNumberOrNull,
  validateEmployeePrivate,
  validateEmployeeWork
} from '../../app/utils/employee'

const validPrivate = {
  curp: 'GOMA900101HDFRRN09',
  nss: '12345678901',
  bank_clabe: '012345678901234567',
  cfdi_tax_zip: '06600'
}

describe('validateEmployeePrivate', () => {
  it('acepta datos válidos y campos vacíos', () => {
    expect(validateEmployeePrivate(validPrivate)).toBeNull()
    expect(validateEmployeePrivate({ curp: '', nss: '', bank_clabe: '', cfdi_tax_zip: '' })).toBeNull()
  })

  it('acepta una CURP en minúsculas porque se guarda en mayúsculas', () => {
    expect(validateEmployeePrivate({ ...validPrivate, curp: 'goma900101hdfrrn09' })).toBeNull()
  })

  it('rechaza cada campo con formato inválido', () => {
    expect(validateEmployeePrivate({ ...validPrivate, curp: 'ABC' })).toContain('CURP')
    expect(validateEmployeePrivate({ ...validPrivate, nss: '123' })).toContain('NSS')
    expect(validateEmployeePrivate({ ...validPrivate, bank_clabe: '123' })).toContain('CLABE')
    expect(validateEmployeePrivate({ ...validPrivate, cfdi_tax_zip: '1234' })).toContain('código postal')
  })
})

describe('validateEmployeeWork', () => {
  it('exige fecha de baja cuando el empleado está dado de baja', () => {
    expect(validateEmployeeWork({ status: 'terminated', hire_date: '', termination_date: '' })).toContain('fecha de baja')
  })

  it('rechaza una baja anterior al ingreso', () => {
    expect(validateEmployeeWork({ status: 'terminated', hire_date: '2026-02-01', termination_date: '2026-01-01' })).toContain('anterior')
  })

  it('acepta un empleado activo sin fechas', () => {
    expect(validateEmployeeWork({ status: 'active', hire_date: '', termination_date: '' })).toBeNull()
  })
})

describe('toNumberOrNull', () => {
  it('convierte el valor del input y respeta el cero', () => {
    expect(toNumberOrNull('1500.50')).toBe(1500.5)
    expect(toNumberOrNull(0)).toBe(0)
    expect(toNumberOrNull('')).toBeNull()
    expect(toNumberOrNull('abc')).toBeNull()
  })
})

describe('employeeErrorMessage', () => {
  it('traduce los errores conocidos', () => {
    expect(employeeErrorMessage({ message: 'x', code: '42501' })).toContain('administradores')
    expect(employeeErrorMessage({ message: 'duplicate key "uq_employee_number"' })).toContain('número')
    expect(employeeErrorMessage({ message: 'This contact is already an employee of the company' })).toContain('ya es empleado')
  })

  it('no expone el mensaje técnico de un error desconocido', () => {
    expect(employeeErrorMessage({ message: 'relation does not exist' })).not.toContain('relation')
  })
})
