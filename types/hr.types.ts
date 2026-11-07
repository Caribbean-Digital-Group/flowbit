import type { EmployeeDatabase } from './employee.types'

/**
 * Tipos temporales de Recursos Humanos y Nómina.
 *
 * `types/database.types.ts` aún no incluye las tablas de la migración
 * `20261107180000_create_hr_payroll_suite`. Este shim replica el shape que
 * generará Supabase para mantener TypeScript estricto sin `any`.
 *
 * Tras correr `npm run db:push && npm run db:types` pueden sustituirse por
 * `Tables<'hr_attendance'>`, etc., y este archivo puede eliminarse.
 *
 * Solo tipos: las constantes viven en `app/utils/hr.ts` y `app/utils/payroll.ts`.
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

type View<Row> = { Row: Row; Relationships: [] }

// ─── Ajustes ────────────────────────────────────────────────────────────────

export type HrSettingsRow = Audit & {
  id: string
  company_id: string
  timezone: string
  late_tolerance_minutes: number
  overtime_min_minutes: number
  overtime_requires_approval: boolean
  kiosk_pin_min_length: number
  payroll_frequency: 'weekly' | 'biweekly' | 'monthly'
  pin_salt: string
}

export type HrSettingsUpdate = Partial<Omit<HrSettingsRow, 'id' | 'company_id' | 'pin_salt'>>

// ─── Horarios y festivos ────────────────────────────────────────────────────

export type HrWorkScheduleRow = Audit & {
  id: string
  company_id: string
  name: string
  description: string | null
  late_tolerance_minutes: number | null
}

export type HrWorkScheduleLineRow = Audit & {
  id: string
  company_id: string
  schedule_id: string
  weekday: number
  start_time: string
  end_time: string
  break_minutes: number
}

export type HrWorkScheduleLineInput = Pick<HrWorkScheduleLineRow, 'weekday' | 'start_time' | 'end_time' | 'break_minutes'>

export type HrHolidayRow = Audit & {
  id: string
  company_id: string
  holiday_date: string
  name: string
  is_statutory: boolean
}

export type HrHolidayInsert = Partial<HrHolidayRow> & Pick<HrHolidayRow, 'company_id' | 'holiday_date' | 'name'>

// ─── Asistencia y kiosco ────────────────────────────────────────────────────

export type HrAttendanceRow = Audit & {
  id: string
  company_id: string
  employee_id: string
  work_date: string
  check_in: string
  check_out: string | null
  worked_minutes: number
  source: 'kiosk' | 'manual'
  kiosk_id: string | null
  missing_check_out: boolean
  notes: string | null
}

/** work_date y worked_minutes los calcula un trigger. */
export type HrAttendanceInsert = Partial<Omit<HrAttendanceRow, 'work_date' | 'worked_minutes'>>
  & Pick<HrAttendanceRow, 'company_id' | 'employee_id' | 'check_in'>
  & { work_date?: string }

export type HrAttendanceViewRow = HrAttendanceRow & {
  employee_name: string | null
  employee_number: string | null
  kiosk_name: string | null
}

export type OvertimeStatus = 'none' | 'pending' | 'approved' | 'rejected'

export type HrAttendanceDayRow = Audit & {
  id: string
  company_id: string
  employee_id: string
  work_date: string
  first_check_in: string | null
  last_check_out: string | null
  punches: number
  is_open: boolean
  scheduled_minutes: number
  worked_minutes: number
  late_minutes: number
  overtime_minutes: number
  overtime_status: OvertimeStatus
  overtime_approved_minutes: number
  is_rest_day: boolean
  is_holiday: boolean
  missing_check_out: boolean
}

export type HrAttendanceDayViewRow = HrAttendanceDayRow & {
  employee_name: string | null
  employee_number: string | null
  department_id: string | null
  department_name: string | null
}

export type HrAttendanceSummaryRow = {
  employee_id: string
  employee_name: string | null
  employee_number: string | null
  department_name: string | null
  days_worked: number
  worked_minutes: number
  scheduled_minutes: number
  late_count: number
  late_minutes: number
  overtime_minutes: number
  overtime_approved_minutes: number
  overtime_pending_minutes: number
  rest_days_worked: number
  sundays_worked: number
  holidays_worked: number
  missing_check_outs: number
  absences_unjustified: number
  absences_justified: number
  leave_days: number
}

export type HrKioskRow = Audit & {
  id: string
  company_id: string
  name: string
  location: string | null
  token_hash: string
  last_used_at: string | null
}

export type KioskInfo = {
  kiosk_name: string
  location: string | null
  company_name: string
  company_logo: string | null
  timezone: string
  pin_min_length: number
}

export type KioskPunchResult =
  | {
      ok: true
      action: 'check_in' | 'check_out'
      employee_name: string
      employee_avatar: string | null
      at: string
      worked_minutes_today: number
    }
  | {
      ok: false
      error: 'invalid_kiosk' | 'locked' | 'invalid_pin' | 'duplicate'
      employee_name?: string
    }

// ─── Vacaciones y permisos ──────────────────────────────────────────────────

export type LeaveKind = 'vacation' | 'paid_leave' | 'unpaid_leave' | 'sick'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type HrLeaveTypeRow = Audit & {
  id: string
  company_id: string
  name: string
  kind: LeaveKind
  deducts_balance: boolean
  color: string
  description: string | null
}

export type HrLeaveTypeInsert = Partial<HrLeaveTypeRow> & Pick<HrLeaveTypeRow, 'company_id' | 'name' | 'kind'>

export type HrLeaveAllocationRow = Audit & {
  id: string
  company_id: string
  employee_id: string
  leave_type_id: string
  days: number
  service_year: number | null
  valid_from: string | null
  valid_to: string | null
  notes: string | null
}

export type HrLeaveAllocationInsert = Partial<HrLeaveAllocationRow>
  & Pick<HrLeaveAllocationRow, 'company_id' | 'employee_id' | 'leave_type_id' | 'days'>

export type HrLeaveAllocationViewRow = HrLeaveAllocationRow & {
  employee_name: string | null
  leave_type_name: string | null
}

export type HrLeaveRequestRow = Audit & {
  id: string
  company_id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  half_day: boolean
  days: number
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
}

/** `days` lo calcula un trigger. */
export type HrLeaveRequestInsert = Partial<Omit<HrLeaveRequestRow, 'days'>>
  & Pick<HrLeaveRequestRow, 'company_id' | 'employee_id' | 'leave_type_id' | 'start_date' | 'end_date'>

export type HrLeaveRequestViewRow = HrLeaveRequestRow & {
  employee_name: string | null
  leave_type_name: string | null
  leave_kind: LeaveKind | null
  leave_color: string | null
}

export type HrLeaveBalanceRow = {
  company_id: string
  employee_id: string
  employee_name: string | null
  hire_date: string | null
  leave_type_id: string
  leave_type_name: string
  allocated_days: number
  taken_days: number
  pending_days: number
  remaining_days: number
}

// ─── Inasistencias ──────────────────────────────────────────────────────────

export type HrAbsenceRow = Audit & {
  id: string
  company_id: string
  employee_id: string
  absence_date: string
  kind: 'unjustified' | 'justified'
  deduct_from_pay: boolean
  leave_request_id: string | null
  reason: string | null
}

export type HrAbsenceInsert = Partial<HrAbsenceRow> & Pick<HrAbsenceRow, 'company_id' | 'employee_id' | 'absence_date'>

export type HrAbsenceViewRow = HrAbsenceRow & {
  employee_name: string | null
  employee_number: string | null
  department_name: string | null
}

// ─── Salarios ───────────────────────────────────────────────────────────────

export type SalaryReason = 'hire' | 'raise' | 'promotion' | 'adjustment' | 'minimum_wage' | 'other'

export type HrSalaryRow = Audit & {
  id: string
  company_id: string
  employee_id: string
  effective_date: string
  salary_type: 'monthly' | 'daily'
  amount: number
  daily_salary: number
  monthly_salary: number
  integrated_daily_wage: number | null
  contribution_base: number | null
  currency: string
  reason: SalaryReason
  notes: string | null
}

/** daily_salary y monthly_salary los calcula un trigger. */
export type HrSalaryInsert = Partial<Omit<HrSalaryRow, 'daily_salary' | 'monthly_salary'>>
  & Pick<HrSalaryRow, 'company_id' | 'employee_id' | 'effective_date' | 'amount'>

export type HrSalaryViewRow = HrSalaryRow & {
  employee_name: string | null
  employee_number: string | null
  job_title: string | null
}

// ─── Nómina ─────────────────────────────────────────────────────────────────

export type PayrollPeriodStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'cancelled'

export type PayrollFiscalConfigRow = Audit & {
  id: string
  company_id: string
  fiscal_year: number
  uma_daily: number
  minimum_wage_daily: number
  minimum_wage_border_daily: number
  use_border_zone: boolean
  isr_monthly_table: { lower: number; fixed: number; rate: number }[]
  subsidy_uma_rate: number
  subsidy_income_limit: number
  imss_rates: Record<string, number>
  cesantia_employer_table: { upTo: number | null; rate: number }[]
  risk_premium_rate: number
  infonavit_employer_rate: number
  isn_rate: number
  sbc_cap_umas: number
  vacation_premium_rate: number
  sunday_premium_rate: number
  aguinaldo_days: number
  overtime_exempt_umas_weekly: number
  vacation_premium_exempt_umas: number
  aguinaldo_exempt_umas: number
  employer_registration: string | null
  employer_state: string | null
  notes: string | null
}

export type PayrollFiscalConfigInsert = Partial<PayrollFiscalConfigRow>
  & Pick<PayrollFiscalConfigRow, 'company_id' | 'fiscal_year' | 'uma_daily' | 'minimum_wage_daily'
    | 'minimum_wage_border_daily' | 'isr_monthly_table' | 'imss_rates' | 'cesantia_employer_table'>

export type PayrollPeriodRow = Audit & {
  id: string
  company_id: string
  name: string
  frequency: 'weekly' | 'biweekly' | 'monthly'
  start_date: string
  end_date: string
  payment_date: string | null
  fiscal_year: number
  status: PayrollPeriodStatus
  employee_count: number
  total_perceptions: number
  total_deductions: number
  total_net: number
  total_employer_cost: number
  calculated_at: string | null
  approved_at: string | null
  approved_by: string | null
  paid_at: string | null
  notes: string | null
}

export type PayrollPeriodInsert = Pick<PayrollPeriodRow, 'company_id' | 'name' | 'frequency' | 'start_date' | 'end_date' | 'fiscal_year'>
  & Partial<Pick<PayrollPeriodRow, 'payment_date' | 'notes' | 'created_by' | 'updated_by'>>

export type PayrollPeriodUpdate = Partial<Pick<PayrollPeriodRow,
  'name' | 'frequency' | 'start_date' | 'end_date' | 'payment_date' | 'fiscal_year' | 'notes' | 'active' | 'updated_by'>>

export type PayrollAdjustmentRow = Audit & {
  id: string
  company_id: string
  period_id: string
  employee_id: string
  kind: 'perception' | 'deduction'
  code: string
  name: string
  amount: number
  is_taxable: boolean
  sat_code: string | null
  notes: string | null
}

export type PayrollAdjustmentInsert = Partial<PayrollAdjustmentRow>
  & Pick<PayrollAdjustmentRow, 'company_id' | 'period_id' | 'employee_id' | 'kind' | 'code' | 'name' | 'amount'>

export type PayrollSlipRow = Audit & {
  id: string
  company_id: string
  period_id: string
  employee_id: string
  daily_salary: number
  contribution_base: number
  period_days: number
  paid_days: number
  absence_days: number
  vacation_days: number
  overtime_double_hours: number
  overtime_triple_hours: number
  sundays_worked: number
  rest_days_worked: number
  total_perceptions: number
  total_taxable: number
  total_exempt: number
  total_deductions: number
  net_pay: number
  isr: number
  subsidy: number
  imss_employee: number
  imss_employer: number
  infonavit_employer: number
  isn: number
  employer_cost: number
}

export type PayrollSlipViewRow = PayrollSlipRow & {
  employee_name: string | null
  employee_rfc: string | null
  employee_number: string | null
  job_title: string | null
  department_name: string | null
  period_name: string
  period_start: string
  period_end: string
  payment_date: string | null
  period_status: PayrollPeriodStatus
}

export type PayrollSlipLineRow = Audit & {
  id: string
  company_id: string
  slip_id: string
  category: 'perception' | 'deduction' | 'employer'
  code: string
  sat_code: string | null
  name: string
  quantity: number
  amount: number
  taxable_amount: number
  exempt_amount: number
  sequence: number
}

/**
 * Esquema para castear el cliente de Supabase mientras `database.types.ts`
 * no incluye estas tablas (mismo patrón que EmployeeDatabase).
 */
type HrTables = {
  hr_settings: Table<HrSettingsRow, Partial<HrSettingsRow> & { company_id: string }, HrSettingsUpdate>
  hr_work_schedule: Table<HrWorkScheduleRow, never, Partial<HrWorkScheduleRow>>
  hr_work_schedule_line: Table<HrWorkScheduleLineRow, never, never>
  hr_holiday: Table<HrHolidayRow, HrHolidayInsert, Partial<HrHolidayRow>>
  hr_kiosk: Table<HrKioskRow, never, Partial<Pick<HrKioskRow, 'name' | 'location' | 'active' | 'updated_by'>>>
  hr_attendance: Table<HrAttendanceRow, HrAttendanceInsert, Partial<HrAttendanceRow>>
  hr_attendance_day: Table<HrAttendanceDayRow, never, never>
  hr_leave_type: Table<HrLeaveTypeRow, HrLeaveTypeInsert, Partial<HrLeaveTypeRow>>
  hr_leave_allocation: Table<HrLeaveAllocationRow, HrLeaveAllocationInsert, Partial<HrLeaveAllocationRow>>
  hr_leave_request: Table<HrLeaveRequestRow, HrLeaveRequestInsert, Partial<HrLeaveRequestRow>>
  hr_absence: Table<HrAbsenceRow, HrAbsenceInsert, Partial<HrAbsenceRow>>
  hr_salary: Table<HrSalaryRow, HrSalaryInsert, Partial<HrSalaryRow>>
  payroll_fiscal_config: Table<PayrollFiscalConfigRow, PayrollFiscalConfigInsert, Partial<PayrollFiscalConfigRow>>
  payroll_period: Table<PayrollPeriodRow, PayrollPeriodInsert, PayrollPeriodUpdate>
  payroll_adjustment: Table<PayrollAdjustmentRow, PayrollAdjustmentInsert, Partial<PayrollAdjustmentRow>>
  payroll_slip: Table<PayrollSlipRow, never, never>
  payroll_slip_line: Table<PayrollSlipLineRow, never, never>
}

type HrViews = {
  v_hr_attendances: View<HrAttendanceViewRow>
  v_hr_attendance_days: View<HrAttendanceDayViewRow>
  v_hr_leave_requests: View<HrLeaveRequestViewRow>
  v_hr_leave_allocations: View<HrLeaveAllocationViewRow>
  v_hr_leave_balances: View<HrLeaveBalanceRow>
  v_hr_absences: View<HrAbsenceViewRow>
  v_hr_salaries: View<HrSalaryViewRow>
  v_payroll_slips: View<PayrollSlipViewRow>
}

/**
 * Las definiciones del shim reemplazan a las generadas (Omit) en lugar de
 * intersectarse con ellas: tras `db:types`, `Json & TablaTipada` no admite valores.
 */
export type HrDatabase = Omit<EmployeeDatabase, 'public'> & {
  public: Omit<EmployeeDatabase['public'], 'Tables' | 'Views'> & {
    Tables: Omit<EmployeeDatabase['public']['Tables'], keyof HrTables> & HrTables
    Views: Omit<EmployeeDatabase['public']['Views'], keyof HrViews> & HrViews
  }
}
