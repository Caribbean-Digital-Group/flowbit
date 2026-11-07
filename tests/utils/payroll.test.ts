import { describe, expect, it } from 'vitest'
import {
  calculatePayslip,
  cesantiaEmployerRate,
  completedYears,
  computeAguinaldo,
  computeImss,
  computeInfonavitDiscount,
  computeIsr,
  computeSubsidy,
  daysBetween,
  defaultFiscalParams,
  integrationFactor,
  nextPeriodRange,
  splitOvertime,
  vacationDaysForYears,
  type PayrollEmployeeInput
} from '../../app/utils/payroll'

const params = defaultFiscalParams(2026)

const baseInput = (overrides: Partial<PayrollEmployeeInput> = {}): PayrollEmployeeInput => ({
  employeeId: 'e1',
  dailySalary: 500,
  contributionBase: 524.66,
  yearsCompleted: 0,
  frequency: 'biweekly',
  periodCalendarDays: 15,
  activeCalendarDays: 15,
  unjustifiedAbsences: 0,
  unpaidLeaveDays: 0,
  sickDays: 0,
  vacationDays: 0,
  overtimeHoursByWeek: [],
  dailyHours: 8,
  sundaysWorked: 0,
  restDaysWorked: 0,
  holidaysWorked: 0,
  infonavitDiscountType: 'none',
  infonavitDiscountValue: 0,
  adjustments: [],
  ...overrides
})

describe('vacaciones LFT 2023', () => {
  it('asigna los días por antigüedad', () => {
    expect([0, 1, 2, 3, 4, 5].map(vacationDaysForYears)).toEqual([0, 12, 14, 16, 18, 20])
    expect([6, 10, 11, 15, 16, 21, 26, 31].map(vacationDaysForYears)).toEqual([22, 22, 24, 24, 26, 28, 30, 32])
  })

  it('cuenta años completos respetando el aniversario', () => {
    expect(completedYears('2020-03-15', '2026-03-14')).toBe(5)
    expect(completedYears('2020-03-15', '2026-03-15')).toBe(6)
    expect(completedYears('2026-01-01', '2025-12-31')).toBe(0)
  })

  it('factor de integración mínimo de ley el primer año', () => {
    expect(integrationFactor(0, 15, 25)).toBeCloseTo(1.0493, 4)
  })
})

describe('ISR y subsidio', () => {
  it('aplica la tarifa mensual completa con 30.4 días', () => {
    // 10,000 mensuales: rango 6,332.06 → 371.83 + (10,000 − 6,332.06) × 10.88%
    expect(computeIsr(10000, 30.4, params.isrMonthlyTable)).toBeCloseTo(770.9, 1)
  })

  it('proporciona la tarifa a los días del periodo', () => {
    const monthly = computeIsr(10000, 30.4, params.isrMonthlyTable)
    expect(computeIsr(5000, 15.2, params.isrMonthlyTable)).toBeCloseTo(monthly / 2, 1)
  })

  it('no causa ISR sin ingreso gravado', () => {
    expect(computeIsr(0, 15, params.isrMonthlyTable)).toBe(0)
  })

  it('da subsidio solo bajo el límite mensual', () => {
    expect(computeSubsidy(4000, 15, params)).toBeCloseTo(117.31 * 0.138 * 15, 2)
    expect(computeSubsidy(8000, 15, params)).toBe(0)
  })
})

describe('IMSS', () => {
  it('elige la tasa de cesantía por veces UMA', () => {
    const p = { ...params, minimumWage: params.minimumWageDaily }
    expect(cesantiaEmployerRate(315.04, p)).toBe(3.15)
    // En 2026 el salario mínimo ya equivale a ~2.68 UMA: por debajo se usa el primer rango.
    expect(cesantiaEmployerRate(117.31 * 1.4, p)).toBe(3.15)
    expect(cesantiaEmployerRate(117.31 * 2.9, p)).toBe(6.025)
    expect(cesantiaEmployerRate(117.31 * 3.2, p)).toBe(6.344)
    expect(cesantiaEmployerRate(117.31 * 10, p)).toBe(7.513)
  })

  it('calcula la cuota obrera sobre SBC y excedente de 3 UMA', () => {
    const r = computeImss({ sbc: 524.66, eymDays: 15, days: 15, retirementDays: 15, minimumWageEarner: false, params })
    const surplus = (524.66 - 117.31 * 3) * 0.004 * 15
    const rest = 524.66 * (0.0025 + 0.00375 + 0.00625 + 0.01125) * 15
    expect(r.employee).toBeCloseTo(surplus + rest, 1)
    expect(r.infonavitEmployer).toBeCloseTo(524.66 * 0.05 * 15, 2)
  })

  it('topa el SBC en 25 UMA', () => {
    const capped = computeImss({ sbc: 117.31 * 25, eymDays: 15, days: 15, retirementDays: 15, minimumWageEarner: false, params })
    const over = computeImss({ sbc: 117.31 * 40, eymDays: 15, days: 15, retirementDays: 15, minimumWageEarner: false, params })
    expect(over.employee).toBe(capped.employee)
  })

  it('el patrón absorbe la cuota obrera con salario mínimo', () => {
    const r = computeImss({ sbc: 330.57, eymDays: 15, days: 15, retirementDays: 15, minimumWageEarner: true, params })
    expect(r.employee).toBe(0)
    expect(r.lines.some(l => l.code === 'imss_er_worker_share')).toBe(true)
  })
})

describe('horas extra', () => {
  it('paga 9 horas dobles por semana y el resto triples', () => {
    expect(splitOvertime([12, 4])).toEqual({ double: 13, triple: 3, doubleByWeek: [9, 4] })
  })
})

describe('INFONAVIT', () => {
  it('descuenta según el tipo de crédito', () => {
    expect(computeInfonavitDiscount({ infonavitDiscountType: 'percentage', infonavitDiscountValue: 20 }, 500, 15, params)).toBe(1500)
    expect(computeInfonavitDiscount({ infonavitDiscountType: 'fixed', infonavitDiscountValue: 3000 }, 500, 15, params)).toBe(1500)
    expect(computeInfonavitDiscount({ infonavitDiscountType: 'none', infonavitDiscountValue: 20 }, 500, 15, params)).toBe(0)
  })
})

describe('calculatePayslip', () => {
  it('calcula una quincena sin incidencias', () => {
    const slip = calculatePayslip(baseInput(), params)
    expect(slip.paidDays).toBe(15)
    expect(slip.totalPerceptions).toBe(7500)
    expect(slip.isr).toBeGreaterThan(0)
    expect(slip.netPay).toBeCloseTo(slip.totalPerceptions - slip.isr - slip.imssEmployee, 2)
    expect(slip.employerCost).toBeGreaterThan(slip.totalPerceptions)
  })

  it('descuenta faltas de los días pagados', () => {
    const slip = calculatePayslip(baseInput({ unjustifiedAbsences: 2 }), params)
    expect(slip.paidDays).toBe(13)
    expect(slip.totalPerceptions).toBe(6500)
  })

  it('separa vacaciones y prima vacacional exenta hasta 15 UMA', () => {
    const slip = calculatePayslip(baseInput({ vacationDays: 5 }), params)
    const premium = slip.lines.find(l => l.code === 'vacation_premium')
    expect(slip.lines.find(l => l.code === 'vacation')?.amount).toBe(2500)
    expect(premium?.amount).toBe(625)
    expect(premium?.exemptAmount).toBe(625)
    expect(slip.totalPerceptions).toBe(7500 + 625)
  })

  it('exenta 50% de las horas dobles hasta 5 UMA por semana', () => {
    const slip = calculatePayslip(baseInput({ overtimeHoursByWeek: [6, 0] }), params)
    const line = slip.lines.find(l => l.code === 'overtime_double')
    expect(line?.amount).toBe(750) // 62.5 × 2 × 6
    expect(line?.exemptAmount).toBe(375)
  })

  it('prorratea a quien entró a mitad del periodo', () => {
    const slip = calculatePayslip(baseInput({ activeCalendarDays: 5 }), params)
    expect(slip.paidDays).toBe(5)
  })

  it('aplica el aguinaldo exento hasta 30 UMA', () => {
    const slip = calculatePayslip(baseInput({
      adjustments: [{ kind: 'perception', code: 'aguinaldo', name: 'Aguinaldo', amount: 7500, taxable: true, satCode: '002' }]
    }), params)
    const line = slip.lines.find(l => l.code === 'aguinaldo')
    expect(line?.exemptAmount).toBeCloseTo(117.31 * 30, 2)
  })

  it('paga doble el festivo y el descanso laborados', () => {
    const slip = calculatePayslip(baseInput({ holidaysWorked: 1, restDaysWorked: 1, sundaysWorked: 1 }), params)
    expect(slip.lines.find(l => l.code === 'holiday_worked')?.amount).toBe(1000)
    expect(slip.lines.find(l => l.code === 'rest_day_worked')?.amount).toBe(1000)
    const sunday = slip.lines.find(l => l.code === 'sunday_premium')
    expect(sunday?.amount).toBe(125)
    expect(sunday?.exemptAmount).toBe(117.31)
  })

  it('suma deducciones manuales', () => {
    const slip = calculatePayslip(baseInput({
      adjustments: [{ kind: 'deduction', code: 'loan', name: 'Préstamo', amount: 300, taxable: false, satCode: '004' }]
    }), params)
    expect(slip.lines.find(l => l.code === 'loan')?.amount).toBe(300)
  })
})

describe('periodos', () => {
  it('cuenta días naturales incluidos', () => {
    expect(daysBetween('2026-01-01', '2026-01-15')).toBe(15)
  })

  it('paga 15 días en la quincena del 1 al 15 de noviembre', () => {
    const days = daysBetween('2026-11-01', '2026-11-15')
    expect(days).toBe(15)
    const slip = calculatePayslip(baseInput({ periodCalendarDays: days, activeCalendarDays: days }), params)
    expect(slip.paidDays).toBe(15)
    expect(slip.periodDays).toBe(15)
  })

  it('sugiere la quincena siguiente', () => {
    expect(nextPeriodRange('biweekly', '2026-01-15')).toEqual({ start: '2026-01-16', end: '2026-01-31' })
    expect(nextPeriodRange('biweekly', '2026-02-28')).toEqual({ start: '2026-03-01', end: '2026-03-15' })
    expect(nextPeriodRange('weekly', '2026-01-04')).toEqual({ start: '2026-01-05', end: '2026-01-11' })
  })

  it('calcula aguinaldo proporcional', () => {
    expect(computeAguinaldo(365, 15, 365)).toBe(5475)
    expect(computeAguinaldo(365, 15, 73)).toBe(1095)
  })
})
