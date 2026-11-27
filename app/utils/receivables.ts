/**
 * Cuentas por cobrar / por pagar: cubetas de antigüedad y estado de cuenta.
 *
 * Funciones puras (sin Vue ni Supabase) para poder probarlas en
 * `tests/utils/receivables.test.ts`. La agregación pesada ocurre en la base
 * (`get_aging_report`, `get_partner_statement`); aquí viven las mismas reglas
 * para presentar, ordenar y calcular el saldo acumulado del estado de cuenta.
 *
 * Reglas compartidas con la base (ver migración 20261116120000):
 *   · Vencimiento = payment_due_date, o la fecha de confirmación, o order_date.
 *   · Días de atraso = fecha de corte − vencimiento. ≤ 0 = al corriente.
 *   · Cubetas: al corriente, 1–30, 31–60, 61–90, +90 días.
 */

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus'

export const AGING_BUCKETS: readonly AgingBucket[] = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: 'Al corriente',
  d1_30: '1 a 30 días',
  d31_60: '31 a 60 días',
  d61_90: '61 a 90 días',
  d90_plus: 'Más de 90 días'
}

export type AgingAmounts = Record<AgingBucket, number>

export interface AgingPartnerRow extends AgingAmounts {
  partner_id: string
  partner_name: string
  partner_email: string | null
  partner_phone: string | null
  order_count: number
  total: number
  max_days_overdue: number
}

export interface AgingReport {
  as_of: string
  order_type: 'sale' | 'purchase'
  currency: string
  totals: AgingAmounts & { count: number; partners: number; total: number }
  partners: AgingPartnerRow[]
}

export type StatementEntryKind = 'order' | 'payment' | 'reimbursement' | 'refund'

export interface StatementEntry {
  date: string
  kind: StatementEntryKind
  order_id: string
  order_name: string | null
  reference: string | null
  charge: number
  credit: number
}

export interface StatementOpenOrder {
  order_id: string
  order_name: string | null
  order_date: string
  due_date: string
  days_overdue: number
  currency: string
  amount_total: number
  balance: number
}

export interface PartnerStatement {
  as_of: string
  from: string | null
  order_type: 'sale' | 'purchase'
  currency: string
  partner: { id: string; name: string; email: string | null; phone: string | null; vat: string | null } | null
  opening_balance: number
  entries: StatementEntry[]
  open_orders: StatementOpenOrder[]
}

export interface StatementLine extends StatementEntry {
  balance: number
}

export const STATEMENT_KIND_LABELS: Record<'sale' | 'purchase', Record<StatementEntryKind, string>> = {
  sale: {
    order: 'Venta',
    payment: 'Cobro',
    reimbursement: 'Reembolso entregado',
    refund: 'Devolución'
  },
  purchase: {
    order: 'Compra',
    payment: 'Pago',
    reimbursement: 'Reembolso recibido',
    refund: 'Devolución al proveedor'
  }
}

/** Redondeo monetario a centavos sin errores de coma flotante acumulados. */
export const roundCents = (value: number): number => Math.round((Number(value) || 0) * 100) / 100

const MS_PER_DAY = 86_400_000

/** Convierte `YYYY-MM-DD` (o un ISO con hora) a días desde la época, en UTC. */
const toEpochDay = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return null
  const [, y, m, d] = match
  return Math.floor(Date.UTC(Number(y), Number(m) - 1, Number(d)) / MS_PER_DAY)
}

/**
 * Fecha de vencimiento: la del plazo de pago, si no la de confirmación,
 * si no la de la orden. Devuelve `YYYY-MM-DD` o `null` si no hay ninguna.
 */
export const resolveDueDate = (order: {
  payment_due_date?: string | null
  confirmation_date?: string | null
  order_date?: string | null
}): string | null => {
  for (const candidate of [order.payment_due_date, order.confirmation_date, order.order_date]) {
    if (candidate && toEpochDay(candidate) !== null) return candidate.slice(0, 10)
  }
  return null
}

/** Días de atraso a la fecha de corte. Negativo o cero = aún no vence. */
export const daysOverdue = (dueDate: string, asOf: string): number => {
  const due = toEpochDay(dueDate)
  const cut = toEpochDay(asOf)
  if (due === null || cut === null) return 0
  return cut - due
}

/** Cubeta de antigüedad para unos días de atraso. */
export const agingBucket = (days: number): AgingBucket => {
  if (days <= 0) return 'current'
  if (days <= 30) return 'd1_30'
  if (days <= 60) return 'd31_60'
  if (days <= 90) return 'd61_90'
  return 'd90_plus'
}

export const emptyAging = (): AgingAmounts => ({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 })

/** Suma saldos en cubetas a partir de sus días de atraso. Ignora saldos ≤ 0.005. */
export const bucketBalances = (items: { balance: number; days_overdue: number }[]): AgingAmounts & { total: number } => {
  const acc = emptyAging()
  let total = 0
  for (const item of items) {
    const balance = Number(item.balance) || 0
    if (balance <= 0.005) continue
    const bucket = agingBucket(item.days_overdue)
    acc[bucket] = roundCents(acc[bucket] + balance)
    total = roundCents(total + balance)
  }
  return { ...acc, total }
}

/** Monto vencido (todo lo que no está al corriente). */
export const overdueAmount = (amounts: AgingAmounts): number =>
  roundCents(amounts.d1_30 + amounts.d31_60 + amounts.d61_90 + amounts.d90_plus)

/** Porcentaje de una cubeta respecto al total (0–100, un decimal). */
export const bucketShare = (amount: number, total: number): number =>
  total > 0 ? Math.round((amount / total) * 1000) / 10 : 0

/**
 * Estado de cuenta con saldo acumulado. Parte del saldo inicial y aplica
 * cargo − abono en el orden recibido (la base ya los entrega cronológicos).
 */
export const buildStatement = (openingBalance: number, entries: StatementEntry[]): StatementLine[] => {
  let running = roundCents(openingBalance)
  return entries.map((entry) => {
    running = roundCents(running + (Number(entry.charge) || 0) - (Number(entry.credit) || 0))
    return { ...entry, balance: running }
  })
}

/** Totales del estado de cuenta: cargos, abonos y saldo final. */
export const statementTotals = (openingBalance: number, entries: StatementEntry[]) => {
  let charges = 0
  let credits = 0
  for (const entry of entries) {
    charges = roundCents(charges + (Number(entry.charge) || 0))
    credits = roundCents(credits + (Number(entry.credit) || 0))
  }
  return {
    opening: roundCents(openingBalance),
    charges,
    credits,
    closing: roundCents(openingBalance + charges - credits)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Crédito del cliente: saldo vencido y aviso de límite de crédito (TRY-44)
// ────────────────────────────────────────────────────────────────────────────

/** Saldo abierto y vencido de un contacto, sumado de `open_orders` del RPC. */
export interface PartnerCreditSummary {
  openBalance: number
  overdue: number
  openOrderCount: number
  overdueOrderCount: number
  maxDaysOverdue: number
}

/**
 * Resume las órdenes abiertas que entrega `get_partner_statement`. Solo suma
 * los saldos que ya calculó la base (en moneda de la empresa); no recalcula
 * pagos. `excludeOrderId` quita la orden que se está editando, para que no
 * cuente dos veces cuando después se suma su total como «esta orden».
 */
export const summarizeOpenOrders = (
  orders: Pick<StatementOpenOrder, 'order_id' | 'balance' | 'days_overdue'>[],
  excludeOrderId?: string | null
): PartnerCreditSummary => {
  const relevant = orders.filter(o => o.order_id !== excludeOrderId && (Number(o.balance) || 0) > 0.005)
  const buckets = bucketBalances(relevant)
  const overdueOrders = relevant.filter(o => o.days_overdue > 0)
  return {
    openBalance: buckets.total,
    overdue: overdueAmount(buckets),
    openOrderCount: relevant.length,
    overdueOrderCount: overdueOrders.length,
    maxDaysOverdue: overdueOrders.reduce((max, o) => Math.max(max, o.days_overdue), 0)
  }
}

/**
 * Convierte el total de una orden a la moneda de la empresa con su tipo de
 * cambio (misma regla que la base: si la moneda difiere se multiplica por
 * `exchange_rate`, y un tipo de cambio vacío o cero vale 1).
 */
export const toCompanyCurrency = (
  amount: number,
  orderCurrency: string | null | undefined,
  companyCurrency: string | null | undefined,
  exchangeRate: number | null | undefined
): number => {
  const value = Number(amount) || 0
  const from = orderCurrency?.trim().toUpperCase() || ''
  const to = companyCurrency?.trim().toUpperCase() || ''
  if (!from || !to || from === to) return roundCents(value)
  return roundCents(value * (Number(exchangeRate) || 1))
}

export interface CreditStatusInput {
  openBalance: number
  overdue: number
  /** Total de la orden en captura (moneda de la empresa). 0 si no aplica. */
  orderTotal?: number
  /** `partner.credit_limit`; 0 o vacío = sin límite. */
  creditLimit?: number | null
}

export interface CreditStatus {
  hasLimit: boolean
  hasOverdue: boolean
  /** Saldo abierto + esta orden. */
  projectedBalance: number
  /** Crédito disponible antes de esta orden (puede ser negativo). Null sin límite. */
  available: number | null
  /** El saldo proyectado supera el límite. Solo es un aviso: nunca bloquea. */
  exceedsLimit: boolean
  /** Cuánto se pasa del límite (0 si no lo supera). */
  excess: number
}

/** Decide si mostrar el aviso de límite de crédito. Pura: no bloquea nada. */
export const evaluateCreditStatus = ({ openBalance, overdue, orderTotal = 0, creditLimit }: CreditStatusInput): CreditStatus => {
  const limit = Math.max(Number(creditLimit) || 0, 0)
  const open = roundCents(Math.max(Number(openBalance) || 0, 0))
  const projectedBalance = roundCents(open + Math.max(Number(orderTotal) || 0, 0))
  const hasLimit = limit > 0
  const exceedsLimit = hasLimit && projectedBalance - limit > 0.005
  return {
    hasLimit,
    hasOverdue: (Number(overdue) || 0) > 0.005,
    projectedBalance,
    available: hasLimit ? roundCents(limit - open) : null,
    exceedsLimit,
    excess: exceedsLimit ? roundCents(projectedBalance - limit) : 0
  }
}

/** Filtra contactos por nombre, correo o teléfono (sin acentos ni mayúsculas). */
export const filterAgingPartners = (rows: AgingPartnerRow[], term: string): AgingPartnerRow[] => {
  const normalize = (s: string | null | undefined) =>
    (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = normalize(term.trim())
  if (!q) return rows
  return rows.filter(r =>
    normalize(r.partner_name).includes(q) ||
    normalize(r.partner_email).includes(q) ||
    normalize(r.partner_phone).includes(q)
  )
}
