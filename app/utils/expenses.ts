/**
 * Módulo de Gastos: catálogos de estado y armado del estado de resultados.
 *
 * Funciones puras (sin Vue ni Supabase) para poder probarlas con Vitest
 * (`tests/utils/expenses.test.ts`).
 *
 * Regla del estado de resultados (base de caja, igual que el reporte de ventas):
 * - Ingresos = cobrado neto del mes (cobros − reembolsos, con IVA), de `get_sales_kpis`.
 * - Compras  = pagos a proveedores del mes (órdenes de compra), de `get_sales_kpis`.
 * - Gastos   = gastos en estado `paid`, por su total (subtotal + impuestos),
 *              en el mes de su fecha de pago (`paid_at`, o `expense_date` si falta).
 *   Los gastos en borrador, aprobados (aún sin pagar) o cancelados no cuentan.
 * - Resultado = ingresos − compras − gastos.
 */
import type { ExpenseStatus } from '../../types/expense.types'
import { roundMoney } from './orderMath'

export type ExpenseBadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning'

export const EXPENSE_STATUSES: ExpenseStatus[] = ['draft', 'approved', 'paid', 'cancelled']

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  paid: 'Pagado',
  cancelled: 'Cancelado'
}

export const EXPENSE_STATUS_VARIANTS: Record<ExpenseStatus, ExpenseBadgeVariant> = {
  draft: 'secondary',
  approved: 'warning',
  paid: 'success',
  cancelled: 'danger'
}

/** Clases de Tailwind por estado, para la columna `badge` del Datatable. */
export const EXPENSE_STATUS_BADGE_CLASSES: Record<ExpenseStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700'
}

export const EXPENSE_STATUS_OPTIONS: { value: ExpenseStatus; label: string }[] =
  EXPENSE_STATUSES.map(value => ({ value, label: EXPENSE_STATUS_LABELS[value] }))

/** Nombre con que se agrupan los gastos sin categoría. */
export const EXPENSE_UNCATEGORIZED_LABEL = 'Sin categoría'

/** Colores sugeridos para las categorías (tokens de la paleta del panel). */
export const EXPENSE_CATEGORY_COLORS = [
  'slate', 'sky', 'indigo', 'violet', 'fuchsia', 'rose', 'amber', 'emerald', 'teal'
] as const

export type ExpenseCategoryColor = typeof EXPENSE_CATEGORY_COLORS[number]

export const EXPENSE_CATEGORY_COLOR_LABELS: Record<ExpenseCategoryColor, string> = {
  slate: 'Gris',
  sky: 'Celeste',
  indigo: 'Índigo',
  violet: 'Violeta',
  fuchsia: 'Fucsia',
  rose: 'Rosa',
  amber: 'Ámbar',
  emerald: 'Esmeralda',
  teal: 'Verde azulado'
}

/** Clases literales (para que Tailwind v4 las detecte) del punto de color de una categoría. */
export const EXPENSE_CATEGORY_DOT_CLASSES: Record<ExpenseCategoryColor, string> = {
  slate: 'bg-slate-400',
  sky: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500'
}

export const isExpenseCategoryColor = (value: string | null | undefined): value is ExpenseCategoryColor =>
  !!value && (EXPENSE_CATEGORY_COLORS as readonly string[]).includes(value)

export const isExpenseStatus = (value: string | null | undefined): value is ExpenseStatus =>
  !!value && (EXPENSE_STATUSES as string[]).includes(value)

/** Total del gasto: subtotal + impuestos, redondeado a centavos. */
export const expenseTotal = (amount: number | null | undefined, taxAmount: number | null | undefined): number =>
  roundMoney((Number(amount) || 0) + (Number(taxAmount) || 0))

/** Solo los gastos pagados cuentan en el estado de resultados (base de caja). */
export const countsInProfitLoss = (status: ExpenseStatus): boolean => status === 'paid'

/** Meses `YYYY-MM` entre dos fechas `YYYY-MM-DD` (ambas incluidas). */
export const monthsInRange = (from: string, to: string): string[] => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  if (!fy || !fm || !ty || !tm) return []

  const months: string[] = []
  let year = fy
  let month = fm
  while (year < ty || (year === ty && month <= tm)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) { month = 1; year += 1 }
    if (months.length > 1200) break
  }
  return months
}

/** «2026-03» → «mar 2026». */
export const formatExpenseMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
  return label.replace(/\./g, '')
}

// ─── Estado de resultados ───────────────────────────────────────────────────

export interface ProfitLossMonthInput {
  /** `YYYY-MM` */
  month: string
  /** Cobrado neto del mes (con IVA). */
  income: number
  /** Pagado a proveedores en el mes. */
  purchases: number
}

export interface ProfitLossExpenseInput {
  /** `expense_date` (`YYYY-MM-DD`). */
  date: string
  /** `paid_at` (`YYYY-MM-DD`); si falta se usa `date`. */
  paidAt?: string | null
  /** Total del gasto (subtotal + impuestos). */
  amount: number
  category: string | null
  status: ExpenseStatus
}

export interface ProfitLossRow {
  month: string
  income: number
  purchases: number
  expenses: number
  expensesByCategory: Record<string, number>
  net: number
}

export interface ProfitLossTotals {
  income: number
  purchases: number
  expenses: number
  expensesByCategory: Record<string, number>
  net: number
}

export interface ProfitLoss {
  rows: ProfitLossRow[]
  totals: ProfitLossTotals
  /** Categorías con gasto en el periodo, de mayor a menor importe. */
  categories: string[]
}

export interface BuildProfitLossInput {
  /** Inicio del periodo (`YYYY-MM-DD`). */
  from: string
  /** Fin del periodo (`YYYY-MM-DD`). */
  to: string
  monthly: ProfitLossMonthInput[]
  expenses: ProfitLossExpenseInput[]
}

const addTo = (bucket: Record<string, number>, key: string, value: number): void => {
  bucket[key] = roundMoney((bucket[key] ?? 0) + value)
}

/**
 * Arma el estado de resultados mensual del periodo [from, to].
 * Todos los meses del periodo aparecen, aunque no tengan movimientos.
 * Los gastos fuera del periodo o que no están pagados se ignoran.
 */
export const buildProfitLoss = ({ from, to, monthly, expenses }: BuildProfitLossInput): ProfitLoss => {
  const months = monthsInRange(from, to)
  const rows = new Map<string, ProfitLossRow>(
    months.map(month => [month, { month, income: 0, purchases: 0, expenses: 0, expensesByCategory: {}, net: 0 }])
  )

  for (const m of monthly) {
    const row = rows.get(m.month.slice(0, 7))
    if (!row) continue
    row.income = roundMoney(row.income + (Number(m.income) || 0))
    row.purchases = roundMoney(row.purchases + (Number(m.purchases) || 0))
  }

  for (const e of expenses) {
    if (!countsInProfitLoss(e.status)) continue
    const day = e.paidAt || e.date
    if (!day || day < from || day > to) continue
    const row = rows.get(day.slice(0, 7))
    if (!row) continue
    const value = Number(e.amount) || 0
    row.expenses = roundMoney(row.expenses + value)
    addTo(row.expensesByCategory, e.category?.trim() || EXPENSE_UNCATEGORIZED_LABEL, value)
  }

  const totals: ProfitLossTotals = { income: 0, purchases: 0, expenses: 0, expensesByCategory: {}, net: 0 }
  const list = [...rows.values()]
  for (const row of list) {
    row.net = roundMoney(row.income - row.purchases - row.expenses)
    totals.income = roundMoney(totals.income + row.income)
    totals.purchases = roundMoney(totals.purchases + row.purchases)
    totals.expenses = roundMoney(totals.expenses + row.expenses)
    for (const [category, value] of Object.entries(row.expensesByCategory)) {
      addTo(totals.expensesByCategory, category, value)
    }
  }
  totals.net = roundMoney(totals.income - totals.purchases - totals.expenses)

  const categories = Object.entries(totals.expensesByCategory)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([category]) => category)

  return { rows: list, totals, categories }
}
