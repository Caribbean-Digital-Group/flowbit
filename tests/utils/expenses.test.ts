import { describe, expect, it } from 'vitest'
import {
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_OPTIONS,
  EXPENSE_UNCATEGORIZED_LABEL,
  buildProfitLoss,
  countsInProfitLoss,
  expenseTotal,
  isExpenseCategoryColor,
  isExpenseStatus,
  monthsInRange,
  type ProfitLossExpenseInput
} from '../../app/utils/expenses'

const expense = (overrides: Partial<ProfitLossExpenseInput>): ProfitLossExpenseInput => ({
  date: '2026-01-15',
  paidAt: null,
  amount: 100,
  category: 'Renta',
  status: 'paid',
  ...overrides
})

describe('catálogos de estado', () => {
  it('tiene etiqueta en español para cada estado', () => {
    expect(EXPENSE_STATUS_LABELS.paid).toBe('Pagado')
    expect(EXPENSE_STATUS_OPTIONS.map(o => o.value)).toEqual(['draft', 'approved', 'paid', 'cancelled'])
  })

  it('reconoce estados y colores válidos', () => {
    expect(isExpenseStatus('approved')).toBe(true)
    expect(isExpenseStatus('void')).toBe(false)
    expect(isExpenseCategoryColor('emerald')).toBe(true)
    expect(isExpenseCategoryColor('#ff0000')).toBe(false)
    expect(isExpenseCategoryColor(null)).toBe(false)
  })
})

describe('expenseTotal', () => {
  it('suma subtotal e impuestos redondeando a centavos', () => {
    expect(expenseTotal(100, 16)).toBe(116)
    expect(expenseTotal(0.1, 0.2)).toBe(0.3)
    expect(expenseTotal(null, undefined)).toBe(0)
  })
})

describe('countsInProfitLoss', () => {
  it('solo cuenta los gastos pagados', () => {
    expect(countsInProfitLoss('paid')).toBe(true)
    expect(countsInProfitLoss('approved')).toBe(false)
    expect(countsInProfitLoss('draft')).toBe(false)
    expect(countsInProfitLoss('cancelled')).toBe(false)
  })
})

describe('monthsInRange', () => {
  it('incluye ambos extremos y cruza de año', () => {
    expect(monthsInRange('2025-11-20', '2026-02-03')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('devuelve un solo mes cuando el rango cae dentro del mismo mes', () => {
    expect(monthsInRange('2026-05-01', '2026-05-31')).toEqual(['2026-05'])
  })

  it('devuelve vacío con fechas inválidas o invertidas', () => {
    expect(monthsInRange('', '2026-01-01')).toEqual([])
    expect(monthsInRange('2026-03-01', '2026-01-01')).toEqual([])
  })
})

describe('buildProfitLoss', () => {
  it('arma una fila por mes con ingresos, compras, gastos y resultado', () => {
    const result = buildProfitLoss({
      from: '2026-01-01',
      to: '2026-03-31',
      monthly: [
        { month: '2026-01', income: 1000, purchases: 300 },
        { month: '2026-02', income: 500, purchases: 0 }
      ],
      expenses: [
        expense({ date: '2026-01-05', amount: 200, category: 'Renta' }),
        expense({ date: '2026-01-20', amount: 50.5, category: 'Servicios' }),
        expense({ date: '2026-02-10', amount: 200, category: 'Renta' })
      ]
    })

    expect(result.rows.map(r => r.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(result.rows[0]).toEqual({
      month: '2026-01',
      income: 1000,
      purchases: 300,
      expenses: 250.5,
      expensesByCategory: { Renta: 200, Servicios: 50.5 },
      net: 449.5
    })
    expect(result.rows[2]).toMatchObject({ income: 0, purchases: 0, expenses: 0, net: 0 })
    expect(result.totals).toEqual({
      income: 1500,
      purchases: 300,
      expenses: 450.5,
      expensesByCategory: { Renta: 400, Servicios: 50.5 },
      net: 749.5
    })
    expect(result.categories).toEqual(['Renta', 'Servicios'])
  })

  it('ignora gastos que no están pagados', () => {
    const result = buildProfitLoss({
      from: '2026-01-01',
      to: '2026-01-31',
      monthly: [],
      expenses: [
        expense({ status: 'draft', amount: 10 }),
        expense({ status: 'approved', amount: 20 }),
        expense({ status: 'cancelled', amount: 30 }),
        expense({ status: 'paid', amount: 40 })
      ]
    })
    expect(result.totals.expenses).toBe(40)
  })

  it('usa la fecha de pago para ubicar el gasto en su mes', () => {
    const result = buildProfitLoss({
      from: '2026-01-01',
      to: '2026-02-28',
      monthly: [],
      expenses: [expense({ date: '2026-01-28', paidAt: '2026-02-03', amount: 99 })]
    })
    expect(result.rows[0]?.expenses).toBe(0)
    expect(result.rows[1]?.expenses).toBe(99)
  })

  it('excluye gastos pagados fuera del periodo aunque caigan en un mes incluido', () => {
    const result = buildProfitLoss({
      from: '2026-01-10',
      to: '2026-01-20',
      monthly: [],
      expenses: [
        expense({ date: '2026-01-05', amount: 1 }),
        expense({ date: '2026-01-15', amount: 2 }),
        expense({ date: '2026-01-25', amount: 4 })
      ]
    })
    expect(result.totals.expenses).toBe(2)
  })

  it('agrupa los gastos sin categoría', () => {
    const result = buildProfitLoss({
      from: '2026-01-01',
      to: '2026-01-31',
      monthly: [],
      expenses: [expense({ category: null, amount: 5 }), expense({ category: '  ', amount: 7 })]
    })
    expect(result.totals.expensesByCategory).toEqual({ [EXPENSE_UNCATEGORIZED_LABEL]: 12 })
  })

  it('ignora meses de ingresos fuera del periodo y permite resultado negativo', () => {
    const result = buildProfitLoss({
      from: '2026-04-01',
      to: '2026-04-30',
      monthly: [
        { month: '2026-03', income: 9999, purchases: 0 },
        { month: '2026-04', income: 100, purchases: 80 }
      ],
      expenses: [expense({ date: '2026-04-02', amount: 70 })]
    })
    expect(result.rows).toHaveLength(1)
    expect(result.totals.net).toBe(-50)
  })

  it('ordena las categorías de mayor a menor gasto', () => {
    const result = buildProfitLoss({
      from: '2026-01-01',
      to: '2026-01-31',
      monthly: [],
      expenses: [
        expense({ category: 'Publicidad', amount: 10 }),
        expense({ category: 'Renta', amount: 300 }),
        expense({ category: 'Luz', amount: 50 })
      ]
    })
    expect(result.categories).toEqual(['Renta', 'Luz', 'Publicidad'])
  })
})
