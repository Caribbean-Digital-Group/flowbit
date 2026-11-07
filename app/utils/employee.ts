/**
 * Catálogos, validaciones y mensajes del módulo de Empleados.
 *
 * Las claves de CFDI corresponden a los catálogos del SAT para el complemento
 * de nómina. El módulo solo las guarda: antes de usarlas para timbrar hay que
 * validarlas contra el catálogo vigente.
 */

export type EmployeeOption = {
  value: string
  label: string
}

export const EMPLOYEE_STATUS_OPTIONS: EmployeeOption[] = [
  { value: 'active', label: 'Activo' },
  { value: 'terminated', label: 'Baja' }
]

export const EMPLOYEE_TYPE_OPTIONS: EmployeeOption[] = [
  { value: 'employee', label: 'Empleado' },
  { value: 'contractor', label: 'Contratista' },
  { value: 'intern', label: 'Becario' },
  { value: 'temporary', label: 'Temporal' }
]

export const MARITAL_STATUS_OPTIONS: EmployeeOption[] = [
  { value: 'single', label: 'Soltero(a)' },
  { value: 'married', label: 'Casado(a)' },
  { value: 'free_union', label: 'Unión libre' },
  { value: 'divorced', label: 'Divorciado(a)' },
  { value: 'widowed', label: 'Viudo(a)' }
]

export const GENDER_OPTIONS: EmployeeOption[] = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Otro' }
]

export const EDUCATION_LEVEL_OPTIONS: EmployeeOption[] = [
  { value: 'none', label: 'Sin estudios' },
  { value: 'primary', label: 'Primaria' },
  { value: 'secondary', label: 'Secundaria' },
  { value: 'high_school', label: 'Preparatoria' },
  { value: 'technical', label: 'Carrera técnica' },
  { value: 'bachelor', label: 'Licenciatura' },
  { value: 'master', label: 'Maestría' },
  { value: 'doctorate', label: 'Doctorado' }
]

/** El receptor de un CFDI de nómina usa el régimen 605. */
export const CFDI_TAX_REGIME_OPTIONS: EmployeeOption[] = [
  { value: '605', label: '605 — Sueldos y salarios e ingresos asimilados a salarios' }
]

export const CFDI_CONTRACT_TYPE_OPTIONS: EmployeeOption[] = [
  { value: '01', label: '01 — Tiempo indeterminado' },
  { value: '02', label: '02 — Obra determinada' },
  { value: '03', label: '03 — Tiempo determinado' },
  { value: '04', label: '04 — Por temporada' },
  { value: '05', label: '05 — Sujeto a prueba' },
  { value: '06', label: '06 — Con capacitación inicial' },
  { value: '07', label: '07 — Pago de hora laborada' },
  { value: '08', label: '08 — Comisión laboral' },
  { value: '09', label: '09 — Sin relación de trabajo' },
  { value: '10', label: '10 — Jubilación, pensión o retiro' },
  { value: '99', label: '99 — Otro contrato' }
]

export const CFDI_WORKDAY_TYPE_OPTIONS: EmployeeOption[] = [
  { value: '01', label: '01 — Diurna' },
  { value: '02', label: '02 — Nocturna' },
  { value: '03', label: '03 — Mixta' },
  { value: '04', label: '04 — Por hora' },
  { value: '05', label: '05 — Reducida' },
  { value: '06', label: '06 — Continuada' },
  { value: '07', label: '07 — Partida' },
  { value: '08', label: '08 — Por turnos' },
  { value: '99', label: '99 — Otra jornada' }
]

export const CFDI_PAYROLL_REGIME_OPTIONS: EmployeeOption[] = [
  { value: '02', label: '02 — Sueldos' },
  { value: '03', label: '03 — Jubilados' },
  { value: '04', label: '04 — Pensionados' },
  { value: '05', label: '05 — Asimilados: cooperativas de producción' },
  { value: '06', label: '06 — Asimilados: sociedades y asociaciones civiles' },
  { value: '07', label: '07 — Asimilados: consejos' },
  { value: '08', label: '08 — Asimilados: comisionistas' },
  { value: '09', label: '09 — Asimilados: honorarios' },
  { value: '10', label: '10 — Asimilados: acciones' },
  { value: '11', label: '11 — Asimilados: otros' },
  { value: '12', label: '12 — Jubilados o pensionados' },
  { value: '13', label: '13 — Indemnización o separación' },
  { value: '99', label: '99 — Otro régimen' }
]

export const CFDI_PAYMENT_FREQUENCY_OPTIONS: EmployeeOption[] = [
  { value: '01', label: '01 — Diario' },
  { value: '02', label: '02 — Semanal' },
  { value: '03', label: '03 — Catorcenal' },
  { value: '04', label: '04 — Quincenal' },
  { value: '05', label: '05 — Mensual' },
  { value: '06', label: '06 — Bimestral' },
  { value: '07', label: '07 — Unidad de obra' },
  { value: '08', label: '08 — Comisión' },
  { value: '09', label: '09 — Precio alzado' },
  { value: '10', label: '10 — Decenal' },
  { value: '99', label: '99 — Otra periodicidad' }
]

export const CFDI_JOB_RISK_OPTIONS: EmployeeOption[] = [
  { value: '1', label: 'Clase I' },
  { value: '2', label: 'Clase II' },
  { value: '3', label: 'Clase III' },
  { value: '4', label: 'Clase IV' },
  { value: '5', label: 'Clase V' },
  { value: '99', label: '99 — No aplica' }
]

export const CFDI_STATE_OPTIONS: EmployeeOption[] = [
  { value: 'AGU', label: 'Aguascalientes' },
  { value: 'BCN', label: 'Baja California' },
  { value: 'BCS', label: 'Baja California Sur' },
  { value: 'CAM', label: 'Campeche' },
  { value: 'CHP', label: 'Chiapas' },
  { value: 'CHH', label: 'Chihuahua' },
  { value: 'CMX', label: 'Ciudad de México' },
  { value: 'COA', label: 'Coahuila' },
  { value: 'COL', label: 'Colima' },
  { value: 'DUR', label: 'Durango' },
  { value: 'GUA', label: 'Guanajuato' },
  { value: 'GRO', label: 'Guerrero' },
  { value: 'HID', label: 'Hidalgo' },
  { value: 'JAL', label: 'Jalisco' },
  { value: 'MEX', label: 'Estado de México' },
  { value: 'MIC', label: 'Michoacán' },
  { value: 'MOR', label: 'Morelos' },
  { value: 'NAY', label: 'Nayarit' },
  { value: 'NLE', label: 'Nuevo León' },
  { value: 'OAX', label: 'Oaxaca' },
  { value: 'PUE', label: 'Puebla' },
  { value: 'QUE', label: 'Querétaro' },
  { value: 'ROO', label: 'Quintana Roo' },
  { value: 'SLP', label: 'San Luis Potosí' },
  { value: 'SIN', label: 'Sinaloa' },
  { value: 'SON', label: 'Sonora' },
  { value: 'TAB', label: 'Tabasco' },
  { value: 'TAM', label: 'Tamaulipas' },
  { value: 'TLA', label: 'Tlaxcala' },
  { value: 'VER', label: 'Veracruz' },
  { value: 'YUC', label: 'Yucatán' },
  { value: 'ZAC', label: 'Zacatecas' }
]

const CURP_PATTERN = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/

export const trimToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const toNumberOrNull = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export interface EmployeeWorkValidationInput {
  status: string
  hire_date: string
  termination_date: string
}

/** Devuelve el mensaje de error, o `null` si los datos laborales son válidos. */
export const validateEmployeeWork = (input: EmployeeWorkValidationInput): string | null => {
  if (input.status === 'terminated' && !input.termination_date) {
    return 'Indica la fecha de baja.'
  }
  if (input.hire_date && input.termination_date && input.termination_date < input.hire_date) {
    return 'La fecha de baja no puede ser anterior a la de ingreso.'
  }
  return null
}

export interface EmployeePrivateValidationInput {
  curp: string
  nss: string
  bank_clabe: string
  cfdi_tax_zip: string
}

/** Devuelve el mensaje de error, o `null` si los datos privados son válidos. */
export const validateEmployeePrivate = (input: EmployeePrivateValidationInput): string | null => {
  const curp = input.curp.trim().toUpperCase()
  if (curp && !CURP_PATTERN.test(curp)) return 'La CURP no tiene un formato válido.'
  if (input.nss.trim() && !/^\d{11}$/.test(input.nss.trim())) return 'El NSS debe tener 11 dígitos.'
  if (input.bank_clabe.trim() && !/^\d{18}$/.test(input.bank_clabe.trim())) return 'La CLABE debe tener 18 dígitos.'
  if (input.cfdi_tax_zip.trim() && !/^\d{5}$/.test(input.cfdi_tax_zip.trim())) return 'El código postal fiscal debe tener 5 dígitos.'
  return null
}

/** Traduce los errores de la base de datos que el usuario puede corregir. */
export const employeeErrorMessage = (error: { message: string; code?: string }): string => {
  if (error.code === '42501') return 'Solo los propietarios y administradores pueden gestionar empleados.'
  if (error.message.includes('uq_employee_number')) return 'Ya existe un empleado con ese número.'
  if (error.message.includes('uq_employee_department_name')) return 'Ya existe un departamento con ese nombre.'
  if (error.message.includes('already an employee')) return 'Este contacto ya es empleado de la empresa.'
  if (error.message.includes('does not belong')) return 'El contacto no pertenece a esta empresa.'
  if (error.message.includes('Only people')) return 'Solo una persona puede ser empleado; este contacto es una empresa.'
  return 'No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.'
}
