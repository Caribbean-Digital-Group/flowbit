import type {
  PayrollAdjustmentInsert,
  PayrollAdjustmentRow,
  PayrollFiscalConfigRow,
  PayrollPeriodInsert,
  PayrollPeriodRow,
  PayrollPeriodStatus,
  PayrollPeriodUpdate,
  PayrollSlipLineRow,
  PayrollSlipViewRow
} from '~/types/hr.types'
import type { EmployeePrivateRow } from '~/types/employee.types'
import {
  calculatePayslip,
  completedYears,
  daysBetween,
  defaultFiscalParams,
  type ImssRates,
  type PayrollEmployeeInput,
  type PayrollFiscalParams,
  type Payslip
} from '~/utils/payroll'

export interface PayrollCalculationResult {
  period: PayrollPeriodRow
  warnings: string[]
}

/** Convierte la fila de configuración fiscal a los parámetros del motor. */
export const configToParams = (row: PayrollFiscalConfigRow): PayrollFiscalParams => {
  const defaults = defaultFiscalParams(row.fiscal_year)
  return {
    fiscalYear: row.fiscal_year,
    umaDaily: Number(row.uma_daily),
    minimumWageDaily: Number(row.minimum_wage_daily),
    minimumWageBorderDaily: Number(row.minimum_wage_border_daily),
    useBorderZone: row.use_border_zone,
    isrMonthlyTable: row.isr_monthly_table.map(r => ({ lower: Number(r.lower), fixed: Number(r.fixed), rate: Number(r.rate) })),
    subsidyUmaRate: Number(row.subsidy_uma_rate),
    subsidyIncomeLimit: Number(row.subsidy_income_limit),
    imssRates: { ...defaults.imssRates, ...(row.imss_rates as Partial<ImssRates>) },
    cesantiaEmployerTable: row.cesantia_employer_table.map(r => ({ upTo: r.upTo === null ? null : Number(r.upTo), rate: Number(r.rate) })),
    riskPremiumRate: Number(row.risk_premium_rate),
    infonavitEmployerRate: Number(row.infonavit_employer_rate),
    isnRate: Number(row.isn_rate),
    sbcCapUmas: Number(row.sbc_cap_umas),
    vacationPremiumRate: Number(row.vacation_premium_rate),
    sundayPremiumRate: Number(row.sunday_premium_rate),
    aguinaldoDays: Number(row.aguinaldo_days),
    overtimeExemptUmasWeekly: Number(row.overtime_exempt_umas_weekly),
    vacationPremiumExemptUmas: Number(row.vacation_premium_exempt_umas),
    aguinaldoExemptUmas: Number(row.aguinaldo_exempt_umas)
  }
}

/** Parámetros del motor a columnas de `payroll_fiscal_config`. */
export const paramsToConfig = (params: PayrollFiscalParams) => ({
  fiscal_year: params.fiscalYear,
  uma_daily: params.umaDaily,
  minimum_wage_daily: params.minimumWageDaily,
  minimum_wage_border_daily: params.minimumWageBorderDaily,
  use_border_zone: params.useBorderZone,
  isr_monthly_table: params.isrMonthlyTable,
  subsidy_uma_rate: params.subsidyUmaRate,
  subsidy_income_limit: params.subsidyIncomeLimit,
  imss_rates: { ...params.imssRates } as Record<string, number>,
  cesantia_employer_table: params.cesantiaEmployerTable,
  risk_premium_rate: params.riskPremiumRate,
  infonavit_employer_rate: params.infonavitEmployerRate,
  isn_rate: params.isnRate,
  sbc_cap_umas: params.sbcCapUmas,
  vacation_premium_rate: params.vacationPremiumRate,
  sunday_premium_rate: params.sundayPremiumRate,
  aguinaldo_days: params.aguinaldoDays,
  overtime_exempt_umas_weekly: params.overtimeExemptUmasWeekly,
  vacation_premium_exempt_umas: params.vacationPremiumExemptUmas,
  aguinaldo_exempt_umas: params.aguinaldoExemptUmas
})

/** Lunes (yyyy-mm-dd) de la semana de una fecha, para agrupar horas extra. */
const weekKey = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`)
  const offset = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

const slipToJson = (slip: Payslip) => ({
  employee_id: slip.employeeId,
  daily_salary: slip.dailySalary,
  contribution_base: slip.contributionBase,
  period_days: slip.periodDays,
  paid_days: slip.paidDays,
  absence_days: slip.absenceDays,
  vacation_days: slip.vacationDays,
  overtime_double_hours: slip.overtimeDoubleHours,
  overtime_triple_hours: slip.overtimeTripleHours,
  sundays_worked: slip.sundaysWorked,
  rest_days_worked: slip.restDaysWorked,
  total_perceptions: slip.totalPerceptions,
  total_taxable: slip.totalTaxable,
  total_exempt: slip.totalExempt,
  total_deductions: slip.totalDeductions,
  net_pay: slip.netPay,
  isr: slip.isr,
  subsidy: slip.subsidy,
  imss_employee: slip.imssEmployee,
  imss_employer: slip.imssEmployer,
  infonavit_employer: slip.infonavitEmployer,
  isn: slip.isn,
  employer_cost: slip.employerCost,
  lines: slip.lines.map(l => ({
    category: l.category,
    code: l.code,
    sat_code: l.satCode,
    name: l.name,
    quantity: l.quantity,
    amount: l.amount,
    taxable_amount: l.taxableAmount,
    exempt_amount: l.exemptAmount
  }))
})

/**
 * Nómina: configuración fiscal por año, periodos, ajustes manuales y recibos.
 *
 * El cálculo corre en la app con `calculatePayslip` (app/utils/payroll.ts) y
 * se guarda con `payroll_save_calculation`, que reemplaza los recibos del
 * periodo. Una nómina aprobada o pagada ya no se recalcula.
 */
export const usePayroll = () => {
  const { supabase, lastError, fail, rpc, userId } = useHrClient()
  const { getAll: getEmployees } = useEmployee()
  const { getCurrentByEmployee } = useSalary()
  const { getAll: getSchedules } = useWorkSchedule()
  const { getDays } = useAttendance()
  const { getAll: getAbsences } = useAbsence()
  const { getRequests, countDays } = useLeave()

  // ─── Configuración fiscal ─────────────────────────────────────────────────

  const getConfigs = async (companyId: string): Promise<PayrollFiscalConfigRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('payroll_fiscal_config')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('fiscal_year', { ascending: false })
    if (error) {
      console.error('Error fetching fiscal configs:', error)
      return []
    }
    return data ?? []
  }

  const getConfig = async (companyId: string, fiscalYear: number): Promise<PayrollFiscalConfigRow | null> => {
    if (!companyId) return null
    const { data, error } = await supabase
      .from('payroll_fiscal_config')
      .select('*')
      .eq('company_id', companyId)
      .eq('fiscal_year', fiscalYear)
      .eq('active', true)
      .maybeSingle()
    if (error) return fail('fetching fiscal config', error)
    return data
  }

  /**
   * Crea la configuración del año con los valores de referencia, o copiando
   * la del año anterior si existe (la prima de riesgo y el ISN son de la empresa).
   */
  const createConfig = async (companyId: string, fiscalYear: number): Promise<PayrollFiscalConfigRow | null> => {
    lastError.value = null
    const previous = await getConfig(companyId, fiscalYear - 1)
    const reference = defaultFiscalParams(fiscalYear)
    const params: PayrollFiscalParams = previous
      ? { ...reference, riskPremiumRate: Number(previous.risk_premium_rate), isnRate: Number(previous.isn_rate), useBorderZone: previous.use_border_zone }
      : reference
    const uid = await userId()
    const { data, error } = await supabase
      .from('payroll_fiscal_config')
      .insert({
        company_id: companyId,
        ...paramsToConfig(params),
        employer_registration: previous?.employer_registration ?? null,
        employer_state: previous?.employer_state ?? null,
        created_by: uid,
        updated_by: uid
      })
      .select()
      .single()
    if (error) return fail('creating fiscal config', error)
    return data
  }

  const updateConfig = async (id: string, updates: Partial<PayrollFiscalConfigRow>): Promise<PayrollFiscalConfigRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('payroll_fiscal_config')
      .update({ ...updates, updated_by: await userId() })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating fiscal config', error)
    return data
  }

  // ─── Periodos ─────────────────────────────────────────────────────────────

  const getPeriods = async (companyId: string): Promise<PayrollPeriodRow[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('payroll_period')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('start_date', { ascending: false })
    if (error) {
      console.error('Error fetching payroll periods:', error)
      return []
    }
    return data ?? []
  }

  const getPeriod = async (id: string, companyId: string): Promise<PayrollPeriodRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('payroll_period')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching payroll period', error)
    return data
  }

  const createPeriod = async (period: PayrollPeriodInsert): Promise<PayrollPeriodRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('payroll_period')
      .insert({ ...period, created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating payroll period', error)
    return data
  }

  const updatePeriod = async (id: string, updates: PayrollPeriodUpdate): Promise<PayrollPeriodRow | null> => {
    lastError.value = null
    const { data, error } = await supabase
      .from('payroll_period')
      .update({ ...updates, updated_by: await userId() })
      .eq('id', id)
      .select()
      .single()
    if (error) return fail('updating payroll period', error)
    return data
  }

  const setStatus = async (id: string, status: PayrollPeriodStatus): Promise<PayrollPeriodRow | null> =>
    rpc<PayrollPeriodRow>('payroll_set_period_status', { p_period_id: id, p_status: status }, 'changing payroll status')

  // ─── Ajustes ──────────────────────────────────────────────────────────────

  const getAdjustments = async (periodId: string): Promise<PayrollAdjustmentRow[]> => {
    if (!periodId) return []
    const { data, error } = await supabase
      .from('payroll_adjustment')
      .select('*')
      .eq('period_id', periodId)
      .eq('active', true)
      .order('created_at')
    if (error) {
      console.error('Error fetching payroll adjustments:', error)
      return []
    }
    return data ?? []
  }

  const createAdjustment = async (adjustment: PayrollAdjustmentInsert): Promise<PayrollAdjustmentRow | null> => {
    lastError.value = null
    const uid = await userId()
    const { data, error } = await supabase
      .from('payroll_adjustment')
      .insert({ ...adjustment, created_by: uid, updated_by: uid })
      .select()
      .single()
    if (error) return fail('creating payroll adjustment', error)
    return data
  }

  const archiveAdjustment = async (id: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase
      .from('payroll_adjustment')
      .update({ active: false, updated_by: await userId() })
      .eq('id', id)
    if (error) {
      fail('archiving payroll adjustment', error)
      return false
    }
    return true
  }

  // ─── Recibos ──────────────────────────────────────────────────────────────

  const getSlips = async (periodId: string): Promise<PayrollSlipViewRow[]> => {
    if (!periodId) return []
    const { data, error } = await supabase
      .from('v_payroll_slips')
      .select('*')
      .eq('period_id', periodId)
      .order('employee_name')
    if (error) {
      console.error('Error fetching payroll slips:', error)
      return []
    }
    return data ?? []
  }

  /** Recibos propios (nóminas aprobadas o pagadas) o todos para owner/admin. */
  const getSlipsByEmployee = async (companyId: string, employeeId: string): Promise<PayrollSlipViewRow[]> => {
    if (!companyId || !employeeId) return []
    const { data, error } = await supabase
      .from('v_payroll_slips')
      .select('*')
      .eq('company_id', companyId)
      .eq('employee_id', employeeId)
      .order('period_start', { ascending: false })
    if (error) {
      console.error('Error fetching employee slips:', error)
      return []
    }
    return data ?? []
  }

  const getSlip = async (id: string, companyId: string): Promise<PayrollSlipViewRow | null> => {
    if (!id || !companyId) return null
    const { data, error } = await supabase
      .from('v_payroll_slips')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching payroll slip', error)
    return data
  }

  const getSlipLines = async (slipId: string): Promise<PayrollSlipLineRow[]> => {
    if (!slipId) return []
    const { data, error } = await supabase
      .from('payroll_slip_line')
      .select('*')
      .eq('slip_id', slipId)
      .order('sequence')
    if (error) {
      console.error('Error fetching payroll slip lines:', error)
      return []
    }
    return data ?? []
  }

  // ─── Cálculo ──────────────────────────────────────────────────────────────

  /**
   * Reúne las incidencias del periodo, calcula los recibos y los guarda.
   * Devuelve avisos para los empleados que no se pudieron calcular.
   */
  const calculate = async (periodId: string, companyId: string): Promise<PayrollCalculationResult | null> => {
    lastError.value = null
    const period = await getPeriod(periodId, companyId)
    if (!period) {
      lastError.value = 'No se encontró el periodo de nómina.'
      return null
    }

    const config = await getConfig(companyId, period.fiscal_year)
    if (!config) {
      lastError.value = `Configura los parámetros fiscales de ${period.fiscal_year} antes de calcular.`
      return null
    }
    const params = configToParams(config)
    const range = { from: period.start_date, to: period.end_date }

    const [employees, privateRows, salaries, schedules, days, absences, leaves, adjustments] = await Promise.all([
      getEmployees(companyId),
      supabase.from('employee_private').select('*').eq('company_id', companyId),
      getCurrentByEmployee(companyId, period.end_date),
      getSchedules(companyId),
      getDays(companyId, range),
      getAbsences(companyId, range),
      getRequests(companyId, { status: 'approved', ...range }),
      getAdjustments(periodId)
    ])

    if (privateRows.error) {
      fail('fetching employee private data', privateRows.error)
      return null
    }
    const privateByEmployee = new Map<string, EmployeePrivateRow>(
      (privateRows.data ?? []).map(p => [p.employee_id, p])
    )
    const scheduleById = new Map(schedules.map(s => [s.id, s]))

    // Días de cada solicitud aprobada dentro del periodo, según el horario.
    const leaveDays = new Map<string, { vacation: number; unpaid: number; sick: number }>()
    for (const leave of leaves) {
      const start = leave.start_date < period.start_date ? period.start_date : leave.start_date
      const end = leave.end_date > period.end_date ? period.end_date : leave.end_date
      const count = await countDays(leave.employee_id, start, end, leave.half_day) ?? 0
      const entry = leaveDays.get(leave.employee_id) ?? { vacation: 0, unpaid: 0, sick: 0 }
      if (leave.leave_kind === 'vacation') entry.vacation += count
      if (leave.leave_kind === 'unpaid_leave') entry.unpaid += count
      if (leave.leave_kind === 'sick') entry.sick += count
      leaveDays.set(leave.employee_id, entry)
    }

    const calendarDays = daysBetween(period.start_date, period.end_date)
    const warnings: string[] = []
    const slips: Payslip[] = []

    for (const employee of employees) {
      const name = employee.partner_name ?? 'Empleado'
      const hire = employee.hire_date
      const termination = employee.termination_date
      if (employee.status === 'terminated' && (!termination || termination < period.start_date)) continue
      if (hire && hire > period.end_date) continue

      const activeStart = hire && hire > period.start_date ? hire : period.start_date
      const activeEnd = termination && termination < period.end_date ? termination : period.end_date
      const activeCalendarDays = Math.max(0, daysBetween(activeStart, activeEnd))

      const salary = salaries.get(employee.id)
      const priv = privateByEmployee.get(employee.id)
      const dailySalary = salary
        ? Number(salary.daily_salary)
        : priv?.monthly_salary ? Number(priv.monthly_salary) / 30 : 0
      if (dailySalary <= 0) {
        warnings.push(`${name}: sin salario registrado; no se calculó.`)
        continue
      }
      if (!hire) warnings.push(`${name}: sin fecha de ingreso; se tomó como antigüedad menor a un año.`)

      const contributionBase = Number(salary?.contribution_base ?? priv?.cfdi_contribution_base ?? 0)

      // Valor de la hora: jornada promedio del horario, o 8 horas.
      const schedule = employee.work_schedule_id ? scheduleById.get(employee.work_schedule_id) : undefined
      const dailyMinutes = schedule && schedule.lines.length > 0
        ? schedule.lines.reduce((s, l) => s + scheduledMinutes(l.start_time, l.end_time, l.break_minutes), 0) / schedule.lines.length
        : 480

      const employeeDays = days.filter(d => d.employee_id === employee.id)
      const overtimeByWeek = new Map<string, number>()
      for (const d of employeeDays) {
        if (d.overtime_approved_minutes > 0) {
          const key = weekKey(d.work_date)
          overtimeByWeek.set(key, (overtimeByWeek.get(key) ?? 0) + d.overtime_approved_minutes / 60)
        }
      }
      const worked = employeeDays.filter(d => d.worked_minutes > 0)
      const sundaysWorked = worked.filter(d => new Date(`${d.work_date}T00:00:00Z`).getUTCDay() === 0).length
      const restDaysWorked = worked.filter(d => d.is_rest_day).length
      const holidaysWorked = worked.filter(d => d.is_holiday).length

      const unjustified = absences.filter(a =>
        a.employee_id === employee.id && a.deduct_from_pay && !a.leave_request_id
      ).length
      const leave = leaveDays.get(employee.id) ?? { vacation: 0, unpaid: 0, sick: 0 }

      const input: PayrollEmployeeInput = {
        employeeId: employee.id,
        dailySalary,
        contributionBase,
        yearsCompleted: hire ? completedYears(hire, period.end_date) : 0,
        frequency: period.frequency,
        periodCalendarDays: calendarDays,
        activeCalendarDays,
        unjustifiedAbsences: unjustified,
        unpaidLeaveDays: leave.unpaid,
        sickDays: leave.sick,
        vacationDays: leave.vacation,
        overtimeHoursByWeek: [...overtimeByWeek.values()],
        dailyHours: dailyMinutes / 60,
        sundaysWorked,
        restDaysWorked,
        holidaysWorked,
        infonavitDiscountType: priv?.infonavit_discount_type ?? 'none',
        infonavitDiscountValue: Number(priv?.infonavit_discount_value ?? 0),
        adjustments: adjustments
          .filter(a => a.employee_id === employee.id)
          .map(a => ({
            kind: a.kind,
            code: a.code,
            name: a.name,
            amount: Number(a.amount),
            taxable: a.is_taxable,
            satCode: a.sat_code
          }))
      }
      slips.push(calculatePayslip(input, params))
    }

    const saved = await rpc<PayrollPeriodRow>('payroll_save_calculation', {
      p_period_id: periodId,
      p_slips: slips.map(slipToJson)
    }, 'saving payroll calculation')
    if (!saved) return null
    return { period: saved, warnings }
  }

  return {
    lastError,
    getConfigs,
    getConfig,
    createConfig,
    updateConfig,
    getPeriods,
    getPeriod,
    createPeriod,
    updatePeriod,
    setStatus,
    getAdjustments,
    createAdjustment,
    archiveAdjustment,
    getSlips,
    getSlipsByEmployee,
    getSlip,
    getSlipLines,
    calculate
  }
}
