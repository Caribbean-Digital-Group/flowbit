import type { Database } from './database.types'

/**
 * Tipos temporales del módulo de Empleados.
 *
 * `types/database.types.ts` aún no incluye las tablas de la migración
 * `20261107120000_create_employee_module`. Este shim replica el shape que
 * generará Supabase para mantener TypeScript estricto sin `any`.
 *
 * Tras correr `npm run db:push && npm run db:types` pueden sustituirse por
 * `Tables<'employee'>`, etc., y este archivo puede eliminarse.
 */

type Audit = {
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type EmployeeStatus = 'active' | 'terminated'

export type EmployeeDepartmentRow = Audit & {
  id: string
  company_id: string
  name: string
  parent_id: string | null
  manager_id: string | null
}

export type EmployeeDepartmentInsert = Partial<EmployeeDepartmentRow> & {
  company_id: string
  name: string
}

export type EmployeeDepartmentUpdate = Partial<EmployeeDepartmentRow>

export type EmployeeRow = Audit & {
  id: string
  company_id: string
  partner_id: string
  employee_number: string | null
  job_title: string | null
  department_id: string | null
  manager_id: string | null
  work_email: string | null
  work_phone: string | null
  work_location: string | null
  hire_date: string | null
  termination_date: string | null
  status: EmployeeStatus
  /** Agregado en 20261107180000_create_hr_payroll_suite. */
  work_schedule_id: string | null
}

export type EmployeeUpdate = Partial<Omit<EmployeeRow, 'id' | 'company_id' | 'partner_id'>>

export type EmployeeViewRow = EmployeeRow & {
  partner_name: string | null
  partner_email: string | null
  partner_phone: string | null
  partner_mobile: string | null
  partner_avatar_url: string | null
  department_name: string | null
  manager_name: string | null
  work_schedule_name: string | null
}

export type EmployeePrivateRow = Audit & {
  id: string
  company_id: string
  employee_id: string
  birth_date: string | null
  curp: string | null
  nss: string | null
  marital_status: string | null
  gender: string | null
  nationality: string | null
  birth_place: string | null
  dependents_count: number
  education_level: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  bank_name: string | null
  bank_clabe: string | null
  bank_account: string | null
  employee_type: string
  monthly_salary: number | null
  salary_currency: string
  weekly_hours: number | null
  vacation_days: number | null
  termination_reason: string | null
  hr_notes: string | null
  cfdi_tax_regime: string | null
  cfdi_tax_zip: string | null
  cfdi_contract_type: string | null
  cfdi_workday_type: string | null
  cfdi_payroll_regime: string | null
  cfdi_payment_frequency: string | null
  cfdi_job_risk: string | null
  cfdi_unionized: boolean
  cfdi_employer_registration: string | null
  cfdi_contribution_base: number | null
  cfdi_integrated_daily_wage: number | null
  cfdi_state: string | null
  /** Crédito INFONAVIT (20261107180000_create_hr_payroll_suite). */
  infonavit_credit_number: string | null
  infonavit_discount_type: 'none' | 'percentage' | 'fixed' | 'factor'
  infonavit_discount_value: number
}

export type EmployeePrivateUpdate = Partial<Omit<EmployeePrivateRow, 'id' | 'company_id' | 'employee_id'>>

/** Datos del alta que acepta el RPC `register_employee`. */
export type EmployeeRegistration = Pick<
  EmployeeUpdate,
  | 'employee_number'
  | 'job_title'
  | 'department_id'
  | 'manager_id'
  | 'work_email'
  | 'work_phone'
  | 'work_location'
  | 'hire_date'
>

/** Datos del contacto que se crea junto con el empleado. */
export type EmployeeNewContact = {
  name: string
  email: string
  phone: string
  vat: string
}

/**
 * Esquema para castear el cliente de Supabase mientras `database.types.ts`
 * no incluye las tablas de empleados (mismo patrón que WebsiteDatabase).
 */
export type EmployeeDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Views'> & {
    Tables: Database['public']['Tables'] & {
      employee_department: Table<EmployeeDepartmentRow, EmployeeDepartmentInsert, EmployeeDepartmentUpdate>
      employee: Table<EmployeeRow, never, EmployeeUpdate>
      employee_private: Table<EmployeePrivateRow, never, EmployeePrivateUpdate>
    }
    Views: Database['public']['Views'] & {
      v_employees: { Row: EmployeeViewRow; Relationships: [] }
    }
  }
}
