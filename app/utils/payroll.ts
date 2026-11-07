/**
 * Motor de cálculo de nómina para México.
 *
 * Funciones puras, sin acceso a la base: reciben los parámetros fiscales del
 * año (`PayrollFiscalParams`) y las incidencias del empleado
 * (`PayrollEmployeeInput`) y devuelven el recibo con sus líneas. El composable
 * `usePayroll` reúne los datos, llama a `calculatePayslip` y guarda el
 * resultado con el RPC `payroll_save_calculation`.
 *
 * Los valores precargados (UMA, salario mínimo, tablas ISR, cuotas IMSS) son
 * una referencia: cada empresa los revisa y ajusta en Nómina → Configuración
 * fiscal, porque cambian por año y por publicación en el DOF.
 *
 * Simplificaciones documentadas en docs/payroll.md:
 * - El ISR se calcula con la tabla mensual proporcional a los días del periodo
 *   (tarifa mensual ÷ 30.4 × días).
 * - Los topes exentos anuales (prima vacacional, aguinaldo) se aplican por recibo.
 * - Las ausencias reducen los días cotizados salvo en Enfermedad y Maternidad;
 *   las incapacidades los reducen en todos los ramos excepto Retiro.
 */

import { roundMoney } from './orderMath'

// ─── Parámetros fiscales ────────────────────────────────────────────────────

export interface IsrBracket {
  /** Límite inferior del rango, mensual. */
  lower: number
  /** Cuota fija, mensual. */
  fixed: number
  /** Porcentaje sobre el excedente del límite inferior. */
  rate: number
}

export interface CesantiaBracket {
  /**
   * Límite superior del rango en veces UMA. `null` es el último rango.
   * El primer rango (`upTo: 1`) aplica al salario mínimo.
   */
  upTo: number | null
  /** Porcentaje patronal de cesantía en edad avanzada y vejez. */
  rate: number
}

/** Porcentajes de cuotas IMSS (Ley del Seguro Social). */
export interface ImssRates {
  fixedFeeEmployer: number            // EyM cuota fija, % de la UMA
  surplusEmployer: number             // EyM excedente de 3 UMA
  surplusEmployee: number
  cashBenefitsEmployer: number        // EyM prestaciones en dinero
  cashBenefitsEmployee: number
  pensionersMedicalEmployer: number   // EyM gastos médicos de pensionados
  pensionersMedicalEmployee: number
  disabilityLifeEmployer: number      // Invalidez y vida
  disabilityLifeEmployee: number
  childcareEmployer: number           // Guarderías y prestaciones sociales
  retirementEmployer: number          // Retiro
  oldAgeEmployee: number              // Cesantía y vejez, obrero
}

export interface PayrollFiscalParams {
  fiscalYear: number
  umaDaily: number
  minimumWageDaily: number
  minimumWageBorderDaily: number
  useBorderZone: boolean
  isrMonthlyTable: IsrBracket[]
  /** Subsidio al empleo: % de la UMA mensual. */
  subsidyUmaRate: number
  /** Ingreso mensual máximo para recibir subsidio. */
  subsidyIncomeLimit: number
  imssRates: ImssRates
  cesantiaEmployerTable: CesantiaBracket[]
  /** Prima de riesgo de trabajo de la empresa, %. */
  riskPremiumRate: number
  /** Aportación patronal INFONAVIT, %. */
  infonavitEmployerRate: number
  /** Impuesto sobre nómina estatal, %. */
  isnRate: number
  /** Tope del SBC en veces UMA. */
  sbcCapUmas: number
  vacationPremiumRate: number
  sundayPremiumRate: number
  aguinaldoDays: number
  overtimeExemptUmasWeekly: number
  vacationPremiumExemptUmas: number
  aguinaldoExemptUmas: number
}

/** Días por año de antigüedad según el art. 76 de la LFT (reforma 2023). */
export const vacationDaysForYears = (yearsCompleted: number): number => {
  if (yearsCompleted < 1) return 0
  if (yearsCompleted <= 5) return 10 + yearsCompleted * 2
  return 22 + Math.floor((yearsCompleted - 6) / 5) * 2
}

/** Años completos entre la fecha de ingreso y `asOf` (ISO yyyy-mm-dd). */
export const completedYears = (hireDate: string, asOf: string): number => {
  const [hy, hm, hd] = hireDate.split('-').map(Number) as [number, number, number]
  const [ay, am, ad] = asOf.split('-').map(Number) as [number, number, number]
  let years = ay - hy
  if (am < hm || (am === hm && ad < hd)) years -= 1
  return Math.max(0, years)
}

/**
 * Factor de integración del SDI: 1 + (días de aguinaldo + días de vacaciones ×
 * prima vacacional) / 365. Con las prestaciones mínimas de ley el primer año
 * da 1.0493.
 */
export const integrationFactor = (
  yearsCompleted: number,
  aguinaldoDays: number,
  vacationPremiumRate: number
): number => {
  const vacation = vacationDaysForYears(Math.max(1, yearsCompleted + 1))
  return 1 + (aguinaldoDays + vacation * (vacationPremiumRate / 100)) / 365
}

export const suggestIntegratedDailyWage = (
  dailySalary: number,
  yearsCompleted: number,
  params: Pick<PayrollFiscalParams, 'aguinaldoDays' | 'vacationPremiumRate'>
): number => roundMoney(dailySalary * integrationFactor(yearsCompleted, params.aguinaldoDays, params.vacationPremiumRate))

/** Salario diario a partir de un sueldo mensual (base de 30 días). */
export const dailyFromMonthly = (monthly: number): number => roundMoney(monthly / 30)

// ─── Periodos ───────────────────────────────────────────────────────────────

export type PayrollFrequency = 'weekly' | 'biweekly' | 'monthly'

/** Días de sueldo que paga cada periodicidad, aunque el calendario varíe. */
export const STANDARD_PERIOD_DAYS: Record<PayrollFrequency, number> = {
  weekly: 7,
  biweekly: 15,
  monthly: 30
}

/** Días naturales entre dos fechas ISO, ambos incluidos. */
export const daysBetween = (start: string, end: string): number => {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)
  return Math.floor(ms / 86_400_000) + 1
}

export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Sugiere las fechas del periodo siguiente al que termina en `lastEnd`. */
export const nextPeriodRange = (frequency: PayrollFrequency, lastEnd: string): { start: string; end: string } => {
  const start = addDays(lastEnd, 1)
  if (frequency === 'weekly') return { start, end: addDays(start, 6) }
  const [y, m, d] = start.split('-').map(Number) as [number, number, number]
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (frequency === 'monthly') return { start, end: `${y}-${pad(m)}-${pad(lastDay)}` }
  return { start, end: d <= 15 ? `${y}-${pad(m)}-15` : `${y}-${pad(m)}-${pad(lastDay)}` }
}

// ─── Entrada por empleado ───────────────────────────────────────────────────

export type InfonavitDiscountType = 'none' | 'percentage' | 'fixed' | 'factor'

export interface PayrollAdjustmentInput {
  kind: 'perception' | 'deduction'
  /** `aguinaldo` aplica su exención; cualquier otro código usa `taxable`. */
  code: string
  name: string
  amount: number
  taxable: boolean
  satCode: string | null
}

export interface PayrollEmployeeInput {
  employeeId: string
  dailySalary: number
  /** SBC. Si es 0 se usa el salario diario × factor de integración. */
  contributionBase: number
  yearsCompleted: number
  frequency: PayrollFrequency
  /** Días naturales del periodo. */
  periodCalendarDays: number
  /** Días naturales del periodo en que la persona estuvo contratada. */
  activeCalendarDays: number
  unjustifiedAbsences: number
  unpaidLeaveDays: number
  sickDays: number
  vacationDays: number
  /** Horas extra aprobadas por semana del periodo. */
  overtimeHoursByWeek: number[]
  /** Horas de la jornada diaria, para el valor de la hora. */
  dailyHours: number
  sundaysWorked: number
  restDaysWorked: number
  /** Días de descanso obligatorio (art. 74 LFT) laborados. */
  holidaysWorked: number
  infonavitDiscountType: InfonavitDiscountType
  infonavitDiscountValue: number
  adjustments: PayrollAdjustmentInput[]
}

// ─── Resultado ──────────────────────────────────────────────────────────────

export type PayslipLineCategory = 'perception' | 'deduction' | 'employer'

export interface PayslipLine {
  category: PayslipLineCategory
  code: string
  satCode: string | null
  name: string
  quantity: number
  amount: number
  taxableAmount: number
  exemptAmount: number
}

export interface Payslip {
  employeeId: string
  dailySalary: number
  contributionBase: number
  periodDays: number
  paidDays: number
  absenceDays: number
  vacationDays: number
  overtimeDoubleHours: number
  overtimeTripleHours: number
  sundaysWorked: number
  restDaysWorked: number
  totalPerceptions: number
  totalTaxable: number
  totalExempt: number
  totalDeductions: number
  netPay: number
  isr: number
  subsidy: number
  imssEmployee: number
  imssEmployer: number
  infonavitEmployer: number
  isn: number
  employerCost: number
  lines: PayslipLine[]
}

// ─── Cálculos ───────────────────────────────────────────────────────────────

const AVG_MONTH_DAYS = 30.4

/** ISR de la tarifa mensual proporcional a `days`. */
export const computeIsr = (taxable: number, days: number, table: IsrBracket[]): number => {
  if (taxable <= 0 || days <= 0 || table.length === 0) return 0
  const factor = days / AVG_MONTH_DAYS
  const sorted = [...table].sort((a, b) => a.lower - b.lower)
  let bracket = sorted[0]!
  for (const row of sorted) {
    if (taxable >= row.lower * factor) bracket = row
  }
  const lower = bracket.lower * factor
  return roundMoney(bracket.fixed * factor + (taxable - lower) * (bracket.rate / 100))
}

/** Subsidio al empleo del periodo (decreto 2024: % de la UMA mensual). */
export const computeSubsidy = (
  taxable: number,
  days: number,
  params: Pick<PayrollFiscalParams, 'umaDaily' | 'subsidyUmaRate' | 'subsidyIncomeLimit'>
): number => {
  if (days <= 0 || params.subsidyUmaRate <= 0) return 0
  const monthlyEquivalent = (taxable / days) * AVG_MONTH_DAYS
  if (monthlyEquivalent > params.subsidyIncomeLimit) return 0
  return roundMoney(params.umaDaily * (params.subsidyUmaRate / 100) * days)
}

/** Tasa patronal de cesantía y vejez según el SBC. */
export const cesantiaEmployerRate = (
  sbc: number,
  params: Pick<PayrollFiscalParams, 'umaDaily' | 'cesantiaEmployerTable'> & { minimumWage: number }
): number => {
  const table = params.cesantiaEmployerTable
  if (table.length === 0) return 0
  if (sbc <= params.minimumWage) return table[0]!.rate
  const umas = sbc / params.umaDaily
  for (const row of table.slice(1)) {
    if (row.upTo === null || umas <= row.upTo) return row.rate
  }
  return table[table.length - 1]!.rate
}

export interface ImssBreakdown {
  employee: number
  employer: number
  infonavitEmployer: number
  lines: PayslipLine[]
}

/**
 * Cuotas obrero-patronales del IMSS e INFONAVIT del periodo.
 *
 * `eymDays` cuenta para Enfermedad y Maternidad (las faltas no lo reducen),
 * `days` para los demás ramos y `retirementDays` para Retiro.
 */
export const computeImss = (input: {
  sbc: number
  eymDays: number
  days: number
  retirementDays: number
  minimumWageEarner: boolean
  params: PayrollFiscalParams
}): ImssBreakdown => {
  const { params } = input
  const r = params.imssRates
  const uma = params.umaDaily
  const sbc = Math.min(input.sbc, uma * params.sbcCapUmas)
  const surplus = Math.max(0, sbc - uma * 3)
  const minimumWage = params.useBorderZone ? params.minimumWageBorderDaily : params.minimumWageDaily
  const pct = (rate: number, base: number, days: number) => roundMoney(base * (rate / 100) * days)

  const employeeParts = [
    { code: 'imss_surplus', name: 'EyM excedente', amount: pct(r.surplusEmployee, surplus, input.eymDays) },
    { code: 'imss_cash', name: 'EyM prestaciones en dinero', amount: pct(r.cashBenefitsEmployee, sbc, input.eymDays) },
    { code: 'imss_pensioners', name: 'EyM gastos médicos pensionados', amount: pct(r.pensionersMedicalEmployee, sbc, input.eymDays) },
    { code: 'imss_disability', name: 'Invalidez y vida', amount: pct(r.disabilityLifeEmployee, sbc, input.days) },
    { code: 'imss_old_age', name: 'Cesantía y vejez', amount: pct(r.oldAgeEmployee, sbc, input.days) }
  ]
  const employeeTotal = roundMoney(employeeParts.reduce((s, p) => s + p.amount, 0))

  const cesantiaRate = cesantiaEmployerRate(sbc, { ...params, minimumWage })
  const employerParts = [
    { code: 'imss_er_fixed', name: 'EyM cuota fija', amount: pct(r.fixedFeeEmployer, uma, input.eymDays) },
    { code: 'imss_er_surplus', name: 'EyM excedente', amount: pct(r.surplusEmployer, surplus, input.eymDays) },
    { code: 'imss_er_cash', name: 'EyM prestaciones en dinero', amount: pct(r.cashBenefitsEmployer, sbc, input.eymDays) },
    { code: 'imss_er_pensioners', name: 'EyM gastos médicos pensionados', amount: pct(r.pensionersMedicalEmployer, sbc, input.eymDays) },
    { code: 'imss_er_risk', name: 'Riesgo de trabajo', amount: pct(params.riskPremiumRate, sbc, input.days) },
    { code: 'imss_er_disability', name: 'Invalidez y vida', amount: pct(r.disabilityLifeEmployer, sbc, input.days) },
    { code: 'imss_er_childcare', name: 'Guarderías y prestaciones sociales', amount: pct(r.childcareEmployer, sbc, input.days) },
    { code: 'imss_er_retirement', name: 'Retiro', amount: pct(r.retirementEmployer, sbc, input.retirementDays) },
    { code: 'imss_er_old_age', name: 'Cesantía y vejez', amount: pct(cesantiaRate, sbc, input.days) }
  ]
  // Art. 36 LSS: con salario mínimo el patrón cubre también la cuota obrera.
  if (input.minimumWageEarner && employeeTotal > 0) {
    employerParts.push({ code: 'imss_er_worker_share', name: 'Cuota obrera a cargo del patrón (salario mínimo)', amount: employeeTotal })
  }
  const infonavitEmployer = pct(params.infonavitEmployerRate, sbc, input.retirementDays)

  const employerLine = (p: { code: string; name: string; amount: number }): PayslipLine => ({
    category: 'employer', code: p.code, satCode: null, name: p.name, quantity: 1,
    amount: p.amount, taxableAmount: 0, exemptAmount: 0
  })

  return {
    employee: input.minimumWageEarner ? 0 : employeeTotal,
    employer: roundMoney(employerParts.reduce((s, p) => s + p.amount, 0)),
    infonavitEmployer,
    lines: [
      ...employerParts.filter(p => p.amount > 0).map(employerLine),
      ...(infonavitEmployer > 0 ? [employerLine({ code: 'infonavit_er', name: 'INFONAVIT 5%', amount: infonavitEmployer })] : [])
    ]
  }
}

/** Reparte horas extra por semana: las primeras 9 dobles, el resto triples (art. 67-68 LFT). */
export const splitOvertime = (hoursByWeek: number[]): { double: number; triple: number; doubleByWeek: number[] } => {
  const doubleByWeek = hoursByWeek.map(h => Math.min(Math.max(0, h), 9))
  const triple = hoursByWeek.reduce((s, h) => s + Math.max(0, h - 9), 0)
  return { double: doubleByWeek.reduce((s, h) => s + h, 0), triple, doubleByWeek }
}

const perception = (
  code: string,
  satCode: string,
  name: string,
  quantity: number,
  amount: number,
  exempt = 0
): PayslipLine => {
  const total = roundMoney(amount)
  const exemptAmount = roundMoney(Math.min(total, Math.max(0, exempt)))
  return {
    category: 'perception', code, satCode, name, quantity: roundMoney(quantity),
    amount: total, taxableAmount: roundMoney(total - exemptAmount), exemptAmount
  }
}

const deduction = (code: string, satCode: string | null, name: string, amount: number, quantity = 1): PayslipLine => ({
  category: 'deduction', code, satCode, name, quantity: roundMoney(quantity),
  amount: roundMoney(amount), taxableAmount: 0, exemptAmount: 0
})

/** Calcula el recibo de un empleado para un periodo. */
export const calculatePayslip = (input: PayrollEmployeeInput, params: PayrollFiscalParams): Payslip => {
  const uma = params.umaDaily
  const minimumWage = params.useBorderZone ? params.minimumWageBorderDaily : params.minimumWageDaily
  const daily = Math.max(0, input.dailySalary)
  const minimumWageEarner = daily > 0 && daily <= minimumWage
  const sbc = input.contributionBase > 0
    ? input.contributionBase
    : suggestIntegratedDailyWage(daily, input.yearsCompleted, params)

  // Días: el sueldo usa los días estándar de la periodicidad, prorrateados si la
  // persona entró o salió a mitad del periodo.
  const calendarDays = Math.max(1, input.periodCalendarDays)
  const activeDays = Math.min(calendarDays, Math.max(0, input.activeCalendarDays))
  const standardDays = roundMoney(STANDARD_PERIOD_DAYS[input.frequency] * activeDays / calendarDays)
  const absenceDays = input.unjustifiedAbsences + input.unpaidLeaveDays + input.sickDays
  const paidDays = Math.max(0, roundMoney(standardDays - absenceDays))
  const vacationDays = Math.min(paidDays, Math.max(0, input.vacationDays))

  const lines: PayslipLine[] = []

  const salaryDays = roundMoney(paidDays - vacationDays)
  if (salaryDays > 0) lines.push(perception('salary', '001', 'Sueldo', salaryDays, daily * salaryDays))
  if (vacationDays > 0) {
    lines.push(perception('vacation', '001', 'Vacaciones', vacationDays, daily * vacationDays))
    const premium = daily * vacationDays * (params.vacationPremiumRate / 100)
    lines.push(perception('vacation_premium', '021', 'Prima vacacional', vacationDays, premium, uma * params.vacationPremiumExemptUmas))
  }

  // Horas extra: las dobles exentan 50% (100% con salario mínimo) hasta 5 UMA por semana.
  const hourly = input.dailyHours > 0 ? daily / input.dailyHours : 0
  const overtime = splitOvertime(input.overtimeHoursByWeek)
  if (overtime.double > 0) {
    const amount = roundMoney(hourly * 2 * overtime.double)
    const weeklyCap = uma * params.overtimeExemptUmasWeekly
    const exempt = overtime.doubleByWeek.reduce((s, h) => {
      const weekAmount = hourly * 2 * h
      return s + (minimumWageEarner ? weekAmount : Math.min(weekAmount / 2, weeklyCap))
    }, 0)
    lines.push(perception('overtime_double', '019', 'Horas extra dobles', overtime.double, amount, exempt))
  }
  if (overtime.triple > 0) {
    lines.push(perception('overtime_triple', '019', 'Horas extra triples', overtime.triple, hourly * 3 * overtime.triple))
  }
  if (input.sundaysWorked > 0) {
    const amount = daily * (params.sundayPremiumRate / 100) * input.sundaysWorked
    lines.push(perception('sunday_premium', '020', 'Prima dominical', input.sundaysWorked, amount, uma * input.sundaysWorked))
  }
  if (input.restDaysWorked > 0) {
    // Art. 73 LFT: el día de descanso laborado se paga doble, además del sueldo.
    lines.push(perception('rest_day_worked', '038', 'Día de descanso laborado', input.restDaysWorked, daily * 2 * input.restDaysWorked))
  }
  if (input.holidaysWorked > 0) {
    // Art. 75 LFT: el día festivo laborado se paga doble, además del sueldo.
    lines.push(perception('holiday_worked', '038', 'Día festivo laborado', input.holidaysWorked, daily * 2 * input.holidaysWorked))
  }

  for (const adj of input.adjustments.filter(a => a.kind === 'perception' && a.amount > 0)) {
    const exempt = adj.code === 'aguinaldo' ? uma * params.aguinaldoExemptUmas : adj.taxable ? 0 : adj.amount
    lines.push(perception(adj.code, adj.satCode ?? '038', adj.name, 1, adj.amount, exempt))
  }

  const perceptions = lines.filter(l => l.category === 'perception')
  const totalPerceptions = roundMoney(perceptions.reduce((s, l) => s + l.amount, 0))
  const totalTaxable = roundMoney(perceptions.reduce((s, l) => s + l.taxableAmount, 0))
  const totalExempt = roundMoney(totalPerceptions - totalTaxable)

  // ISR y subsidio sobre los días pagados del periodo.
  const isrDays = Math.max(paidDays, 1)
  const isrGross = computeIsr(totalTaxable, isrDays, params.isrMonthlyTable)
  const subsidy = Math.min(isrGross, computeSubsidy(totalTaxable, isrDays, params))
  const isr = roundMoney(Math.max(0, isrGross - subsidy))

  // IMSS: las faltas e incapacidades reducen los días cotizados.
  const activeImssDays = activeDays
  const imss = computeImss({
    sbc,
    eymDays: Math.max(0, activeImssDays - input.sickDays),
    days: Math.max(0, activeImssDays - input.sickDays - input.unjustifiedAbsences),
    retirementDays: Math.max(0, activeImssDays - input.unjustifiedAbsences),
    minimumWageEarner,
    params
  })

  if (isr > 0) lines.push(deduction('isr', '002', 'ISR', isr))
  if (imss.employee > 0) lines.push(deduction('imss', '001', 'Seguridad social (IMSS)', imss.employee))

  const infonavit = computeInfonavitDiscount(input, sbc, paidDays, params)
  if (infonavit > 0) lines.push(deduction('infonavit', '010', 'Crédito INFONAVIT', infonavit))

  for (const adj of input.adjustments.filter(a => a.kind === 'deduction' && a.amount > 0)) {
    lines.push(deduction(adj.code, adj.satCode ?? '004', adj.name, adj.amount))
  }

  const totalDeductions = roundMoney(lines.filter(l => l.category === 'deduction').reduce((s, l) => s + l.amount, 0))
  const isn = roundMoney(totalPerceptions * (params.isnRate / 100))
  if (isn > 0) {
    lines.push({ category: 'employer', code: 'isn', satCode: null, name: 'Impuesto sobre nómina', quantity: 1, amount: isn, taxableAmount: 0, exemptAmount: 0 })
  }
  lines.push(...imss.lines)

  return {
    employeeId: input.employeeId,
    dailySalary: roundMoney(daily),
    contributionBase: roundMoney(Math.min(sbc, uma * params.sbcCapUmas)),
    periodDays: calendarDays,
    paidDays,
    absenceDays: roundMoney(absenceDays),
    vacationDays,
    overtimeDoubleHours: roundMoney(overtime.double),
    overtimeTripleHours: roundMoney(overtime.triple),
    sundaysWorked: input.sundaysWorked,
    restDaysWorked: input.restDaysWorked,
    totalPerceptions,
    totalTaxable,
    totalExempt,
    totalDeductions,
    netPay: roundMoney(totalPerceptions - totalDeductions),
    isr,
    subsidy: roundMoney(subsidy),
    imssEmployee: imss.employee,
    imssEmployer: imss.employer,
    infonavitEmployer: imss.infonavitEmployer,
    isn,
    employerCost: roundMoney(totalPerceptions + imss.employer + imss.infonavitEmployer + isn),
    lines
  }
}

/**
 * Descuento del crédito INFONAVIT del trabajador:
 * - `percentage`: % del SBC por los días pagados.
 * - `fixed`: cuota fija mensual, proporcional a los días pagados.
 * - `factor`: veces UMA mensual (antes VSM), proporcional a los días pagados.
 */
export const computeInfonavitDiscount = (
  input: Pick<PayrollEmployeeInput, 'infonavitDiscountType' | 'infonavitDiscountValue'>,
  sbc: number,
  paidDays: number,
  params: Pick<PayrollFiscalParams, 'umaDaily'>
): number => {
  const value = Math.max(0, input.infonavitDiscountValue)
  if (value === 0 || paidDays <= 0) return 0
  switch (input.infonavitDiscountType) {
    case 'percentage': return roundMoney(sbc * (value / 100) * paidDays)
    case 'fixed': return roundMoney(value / 30 * paidDays)
    case 'factor': return roundMoney(value * params.umaDaily * paidDays)
    default: return 0
  }
}

// ─── Valores de referencia ──────────────────────────────────────────────────

/**
 * Tarifa mensual del art. 96 LISR (Anexo 8 RMF, vigente 2023–2025).
 * Verifica la publicación del año en curso antes de calcular.
 */
export const ISR_MONTHLY_TABLE_REFERENCE: IsrBracket[] = [
  { lower: 0.01, fixed: 0, rate: 1.92 },
  { lower: 746.05, fixed: 14.32, rate: 6.4 },
  { lower: 6332.06, fixed: 371.83, rate: 10.88 },
  { lower: 11128.02, fixed: 893.63, rate: 16 },
  { lower: 12935.83, fixed: 1182.88, rate: 17.92 },
  { lower: 15487.72, fixed: 1640.18, rate: 21.36 },
  { lower: 31236.5, fixed: 5004.12, rate: 23.52 },
  { lower: 49233.01, fixed: 9236.89, rate: 30 },
  { lower: 93993.91, fixed: 22665.17, rate: 32 },
  { lower: 125325.21, fixed: 32691.18, rate: 34 },
  { lower: 375975.62, fixed: 117912.32, rate: 35 }
]

/** Cuota patronal de cesantía y vejez para 2026 (transitorio de la reforma LSS 2020). */
export const CESANTIA_EMPLOYER_TABLE_2026: CesantiaBracket[] = [
  { upTo: 1, rate: 3.15 },
  { upTo: 1.5, rate: 3.676 },
  { upTo: 2, rate: 4.851 },
  { upTo: 2.5, rate: 5.556 },
  { upTo: 3, rate: 6.025 },
  { upTo: 3.5, rate: 6.344 },
  { upTo: 4, rate: 6.577 },
  { upTo: null, rate: 7.513 }
]

export const IMSS_RATES_REFERENCE: ImssRates = {
  fixedFeeEmployer: 20.4,
  surplusEmployer: 1.1,
  surplusEmployee: 0.4,
  cashBenefitsEmployer: 0.7,
  cashBenefitsEmployee: 0.25,
  pensionersMedicalEmployer: 1.05,
  pensionersMedicalEmployee: 0.375,
  disabilityLifeEmployer: 1.75,
  disabilityLifeEmployee: 0.625,
  childcareEmployer: 1,
  retirementEmployer: 2,
  oldAgeEmployee: 1.125
}

/** Parámetros sugeridos para un año. La empresa debe revisarlos antes de calcular. */
export const defaultFiscalParams = (fiscalYear: number): PayrollFiscalParams => ({
  fiscalYear,
  umaDaily: 117.31,
  minimumWageDaily: 315.04,
  minimumWageBorderDaily: 440.87,
  useBorderZone: false,
  isrMonthlyTable: ISR_MONTHLY_TABLE_REFERENCE.map(r => ({ ...r })),
  subsidyUmaRate: 13.8,
  subsidyIncomeLimit: 10171,
  imssRates: { ...IMSS_RATES_REFERENCE },
  cesantiaEmployerTable: CESANTIA_EMPLOYER_TABLE_2026.map(r => ({ ...r })),
  riskPremiumRate: 0.54355,
  infonavitEmployerRate: 5,
  isnRate: 3,
  sbcCapUmas: 25,
  vacationPremiumRate: 25,
  sundayPremiumRate: 25,
  aguinaldoDays: 15,
  overtimeExemptUmasWeekly: 5,
  vacationPremiumExemptUmas: 15,
  aguinaldoExemptUmas: 30
})

/** Aguinaldo proporcional: días de aguinaldo × días trabajados en el año / 365. */
export const computeAguinaldo = (dailySalary: number, aguinaldoDays: number, daysWorkedInYear: number): number =>
  roundMoney(dailySalary * aguinaldoDays * Math.min(365, Math.max(0, daysWorkedInYear)) / 365)

// ─── Etiquetas ──────────────────────────────────────────────────────────────

export const PAYROLL_FREQUENCY_OPTIONS: { value: PayrollFrequency; label: string }[] = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' }
]

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  calculated: 'Calculada',
  approved: 'Aprobada',
  paid: 'Pagada',
  cancelled: 'Cancelada'
}

export const INFONAVIT_DISCOUNT_OPTIONS: { value: InfonavitDiscountType; label: string }[] = [
  { value: 'none', label: 'Sin crédito' },
  { value: 'percentage', label: 'Porcentaje del SBC' },
  { value: 'fixed', label: 'Cuota fija mensual' },
  { value: 'factor', label: 'Factor de descuento (veces UMA)' }
]

/** Conceptos frecuentes para ajustes manuales del periodo, con su clave SAT. */
export const PAYROLL_ADJUSTMENT_PRESETS: { code: string; name: string; kind: 'perception' | 'deduction'; satCode: string; taxable: boolean }[] = [
  { code: 'aguinaldo', name: 'Aguinaldo', kind: 'perception', satCode: '002', taxable: true },
  { code: 'bonus', name: 'Bono', kind: 'perception', satCode: '038', taxable: true },
  { code: 'commission', name: 'Comisiones', kind: 'perception', satCode: '028', taxable: true },
  { code: 'punctuality', name: 'Premio de puntualidad', kind: 'perception', satCode: '010', taxable: true },
  { code: 'attendance', name: 'Premio de asistencia', kind: 'perception', satCode: '049', taxable: true },
  { code: 'ptu', name: 'PTU', kind: 'perception', satCode: '003', taxable: true },
  { code: 'loan', name: 'Préstamo', kind: 'deduction', satCode: '004', taxable: false },
  { code: 'fonacot', name: 'Crédito FONACOT', kind: 'deduction', satCode: '011', taxable: false },
  { code: 'alimony', name: 'Pensión alimenticia', kind: 'deduction', satCode: '007', taxable: false },
  { code: 'other_deduction', name: 'Otra deducción', kind: 'deduction', satCode: '004', taxable: false }
]
