/**
 * Foto del tablero principal (TRY-33).
 *
 * La base la arma con el RPC `get_dashboard_snapshot` en una sola petición.
 * Si el RPC aún no existe (migraciones pendientes), `buildDashboardSnapshot`
 * arma exactamente la misma forma en el navegador a partir de los listados
 * completos, como hacía el tablero antes. Las dos rutas comparten este
 * contrato, así la página solo lee el snapshot y no sabe de dónde vino.
 *
 * Funciones puras: sin Supabase ni Vue, probadas en `tests/utils/dashboardSnapshot.test.ts`.
 */
import type { Database, Tables } from '~/types/database.types'
import type { ApprovalRequestViewRow } from '~/types/approval.types'
import type { DateRange } from './dashboard'
import { isInRange, toLocalDateKey } from './dashboard'

export type DashboardOrderRow = Database['public']['Views']['v_orders']['Row']
export type DashboardProjectRow = Database['public']['Views']['v_projects']['Row']
export type DashboardPickingRow = Database['public']['Views']['v_pickings']['Row']
export type DashboardTaskRow = Database['public']['Views']['v_project_tasks']['Row']
export type DashboardLeadRow = Database['public']['Views']['v_crm_leads']['Row']
export type DashboardPartnerRow = Tables<'partner'>
export type DashboardProductRow = Tables<'product'>
export type DashboardApprovalRow = ApprovalRequestViewRow

export interface DashboardDraftTotals {
  currency: string
  sale_amount: number
  sale_count: number
  purchase_amount: number
  purchase_count: number
}

/** Órdenes confirmadas de un día en una moneda. */
export interface DashboardPostedDay extends DashboardDraftTotals {
  day: string
}

export interface DashboardCrmCurrency {
  currency: string
  won_amount: number
  open_amount: number
  weighted_amount: number
}

export interface DashboardSnapshot {
  company_currency: string
  currencies: string[]
  counts: {
    active_partners: number
    active_products: number
    active_projects: number
    average_project_progress: number
  }
  drafts: DashboardDraftTotals[]
  posted_daily: DashboardPostedDay[]
  attention: {
    overdue_tasks: number
    oldest_overdue_task: string | null
    pending_approvals: number
    crm_overdue_activities: number
    crm_leads_with_overdue: number
    crm_rotting_leads: number
    open_pickings: number
  }
  crm: {
    created: number
    won: number
    lost: number
    open_count: number
    by_currency: DashboardCrmCurrency[]
  }
  recent: {
    orders: DashboardOrderRow[]
    pickings: DashboardPickingRow[]
    approvals: DashboardApprovalRow[]
    projects: DashboardProjectRow[]
    tasks: DashboardTaskRow[]
    leads: DashboardLeadRow[]
    partners: DashboardPartnerRow[]
  }
  public_projects: DashboardProjectRow[]
}

export interface DashboardSnapshotParams {
  range: DateRange
  comparison: DateRange | null
  /** `YYYY-MM-DD` de hoy en hora local. */
  today: string
  /** Moneda de la empresa; si falta se toma de las órdenes y, al final, MXN. */
  companyCurrency?: string | null
}

export interface DashboardSnapshotLists {
  partners: DashboardPartnerRow[]
  products: DashboardProductRow[]
  orders: DashboardOrderRow[]
  projects: DashboardProjectRow[]
  pickings: DashboardPickingRow[]
  approvals: DashboardApprovalRow[]
  tasks: DashboardTaskRow[]
  leads: DashboardLeadRow[]
}

export const RECENT_LIMITS = {
  orders: 6,
  pickings: 4,
  approvals: 4,
  projects: 4,
  tasks: 4,
  leads: 4,
  partners: 3
} as const

export const PUBLIC_PROJECTS_LIMIT = 4

/** Mayúsculas y sin espacios; vacío → moneda de respaldo. */
export const normalizeCurrencyCode = (value: string | null | undefined, fallback: string): string =>
  value?.trim().toUpperCase() || fallback

const num = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

type Dated = { id: string | null; created_at: string | null }

/** Más reciente primero; empate por id descendente, igual que el RPC. */
const byCreatedDesc = <T extends Dated>(a: T, b: T): number =>
  (b.created_at ?? '').localeCompare(a.created_at ?? '') || (b.id ?? '').localeCompare(a.id ?? '')

const takeRecent = <T extends Dated>(rows: T[], limit: number): T[] =>
  [...rows].sort(byCreatedDesc).slice(0, limit)

const emptyTotals = (currency: string): DashboardDraftTotals => ({
  currency,
  sale_amount: 0,
  sale_count: 0,
  purchase_amount: 0,
  purchase_count: 0
})

const addOrder = (totals: DashboardDraftTotals, order: DashboardOrderRow): void => {
  const amount = num(order.amount_total)
  if (order.order_type === 'sale') {
    totals.sale_amount += amount
    totals.sale_count += 1
  } else if (order.order_type === 'purchase') {
    totals.purchase_amount += amount
    totals.purchase_count += 1
  }
}

const leadIsOpen = (lead: DashboardLeadRow): boolean => !lead.is_won && !lead.is_lost

const leadCloseDay = (lead: DashboardLeadRow): string | null =>
  toLocalDateKey(lead.actual_close_date ?? lead.stage_changed_at ?? lead.updated_at)

/**
 * Respaldo sin migración: arma el snapshot con los listados completos de la
 * empresa, con las mismas reglas que `get_dashboard_snapshot`.
 */
export const buildDashboardSnapshot = (
  lists: DashboardSnapshotLists,
  params: DashboardSnapshotParams
): DashboardSnapshot => {
  const companyCurrency = normalizeCurrencyCode(
    params.companyCurrency ?? lists.orders.find((o) => o.company_currency)?.company_currency,
    'MXN'
  )
  const norm = (value: string | null | undefined) => normalizeCurrencyCode(value, companyCurrency)
  const { range, comparison, today } = params

  // Órdenes: monedas, borradores y confirmadas por día.
  const currencies = new Set<string>()
  const drafts = new Map<string, DashboardDraftTotals>()
  const posted = new Map<string, DashboardPostedDay>()
  for (const order of lists.orders) {
    const currency = norm(order.currency)
    currencies.add(currency)
    if (order.order_state === 'draft') {
      const totals = drafts.get(currency) ?? emptyTotals(currency)
      drafts.set(currency, totals)
      addOrder(totals, order)
    } else if (order.order_state === 'posted') {
      if (order.order_type !== 'sale' && order.order_type !== 'purchase') continue
      const day = toLocalDateKey(order.order_date ?? order.created_at)
      if (!day) continue
      if (!isInRange(day, range) && !(comparison && isInRange(day, comparison))) continue
      const key = `${day}|${currency}`
      const totals = posted.get(key) ?? { day, ...emptyTotals(currency) }
      posted.set(key, totals)
      addOrder(totals, order)
    }
  }

  // Operación.
  let activeProjects = 0
  let progressSum = 0
  for (const project of lists.projects) {
    if (project.status !== 'in_progress') continue
    activeProjects += 1
    progressSum += project.progress ?? 0
  }
  // Bucle explícito: `.filter` sobre `Tables<'product'>` dispara TS2589.
  let activeProducts = 0
  for (const product of lists.products) {
    if (product.status === 'active') activeProducts += 1
  }

  // Requiere atención.
  const overdueTasks = lists.tasks
    .filter((task) => {
      const due = toLocalDateKey(task.due_date)
      return due !== null && due < today && (task.status === 'pending' || task.status === 'in_progress')
    })
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || byCreatedDesc(a, b))
  const oldest = overdueTasks[0]

  const openLeads = lists.leads.filter(leadIsOpen)

  // CRM del periodo y embudo abierto por moneda.
  let created = 0
  let won = 0
  let lost = 0
  const crmByCurrency = new Map<string, DashboardCrmCurrency>()
  const crmFor = (currency: string): DashboardCrmCurrency => {
    const row = crmByCurrency.get(currency) ?? { currency, won_amount: 0, open_amount: 0, weighted_amount: 0 }
    crmByCurrency.set(currency, row)
    return row
  }
  for (const lead of lists.leads) {
    const row = crmFor(norm(lead.currency))
    if (isInRange(toLocalDateKey(lead.created_at), range)) created += 1
    if (lead.is_won) {
      if (isInRange(leadCloseDay(lead), range)) {
        won += 1
        row.won_amount += num(lead.won_amount ?? lead.amount)
      }
    } else if (lead.is_lost) {
      if (isInRange(leadCloseDay(lead), range)) lost += 1
    } else {
      const amount = num(lead.amount)
      row.open_amount += amount
      row.weighted_amount += amount * ((lead.probability ?? lead.stage_probability ?? 0) / 100)
    }
  }

  const sortByCurrency = <T extends { currency: string }>(rows: Iterable<T>): T[] =>
    [...rows].sort((a, b) => a.currency.localeCompare(b.currency))

  return {
    company_currency: companyCurrency,
    currencies: [...currencies].sort(),
    counts: {
      active_partners: lists.partners.filter((p) => p.active !== false).length,
      active_products: activeProducts,
      active_projects: activeProjects,
      average_project_progress: activeProjects > 0 ? Math.round(progressSum / activeProjects) : 0
    },
    drafts: sortByCurrency(drafts.values()),
    posted_daily: [...posted.values()].sort((a, b) => a.day.localeCompare(b.day) || a.currency.localeCompare(b.currency)),
    attention: {
      overdue_tasks: overdueTasks.length,
      oldest_overdue_task: oldest ? (oldest.name?.trim() || oldest.code || 'Tarea') : null,
      pending_approvals: lists.approvals.filter((r) => r.status === 'published').length,
      crm_overdue_activities: openLeads.reduce((sum, l) => sum + (l.overdue_activity_count ?? 0), 0),
      crm_leads_with_overdue: openLeads.filter((l) => (l.overdue_activity_count ?? 0) > 0).length,
      crm_rotting_leads: openLeads.filter((l) => l.is_rotting).length,
      open_pickings: lists.pickings.filter((p) => p.status === 'borrador' || p.status === 'publicado').length
    },
    crm: {
      created,
      won,
      lost,
      open_count: openLeads.length,
      by_currency: sortByCurrency(crmByCurrency.values())
    },
    recent: {
      orders: takeRecent(lists.orders, RECENT_LIMITS.orders),
      pickings: takeRecent(lists.pickings, RECENT_LIMITS.pickings),
      approvals: takeRecent(lists.approvals, RECENT_LIMITS.approvals),
      projects: takeRecent(lists.projects, RECENT_LIMITS.projects),
      tasks: takeRecent(lists.tasks, RECENT_LIMITS.tasks),
      leads: takeRecent(lists.leads, RECENT_LIMITS.leads),
      partners: takeRecent(lists.partners, RECENT_LIMITS.partners)
    },
    public_projects: takeRecent(
      lists.projects.filter((p) => Boolean((p as DashboardProjectRow & { is_public?: boolean | null }).is_public)),
      PUBLIC_PROJECTS_LIMIT
    )
  }
}

/**
 * Normaliza la respuesta JSON del RPC: los `numeric` de Postgres pueden
 * llegar como texto y las monedas se comparan en mayúsculas.
 */
export const normalizeDashboardSnapshot = (raw: DashboardSnapshot): DashboardSnapshot => {
  const companyCurrency = normalizeCurrencyCode(raw.company_currency, 'MXN')
  const totals = <T extends DashboardDraftTotals>(row: T): T => ({
    ...row,
    currency: normalizeCurrencyCode(row.currency, companyCurrency),
    sale_amount: num(row.sale_amount),
    sale_count: num(row.sale_count),
    purchase_amount: num(row.purchase_amount),
    purchase_count: num(row.purchase_count)
  })
  return {
    ...raw,
    company_currency: companyCurrency,
    currencies: raw.currencies ?? [],
    counts: {
      active_partners: num(raw.counts?.active_partners),
      active_products: num(raw.counts?.active_products),
      active_projects: num(raw.counts?.active_projects),
      average_project_progress: num(raw.counts?.average_project_progress)
    },
    drafts: (raw.drafts ?? []).map(totals),
    posted_daily: (raw.posted_daily ?? []).map(totals),
    attention: {
      overdue_tasks: num(raw.attention?.overdue_tasks),
      oldest_overdue_task: raw.attention?.oldest_overdue_task ?? null,
      pending_approvals: num(raw.attention?.pending_approvals),
      crm_overdue_activities: num(raw.attention?.crm_overdue_activities),
      crm_leads_with_overdue: num(raw.attention?.crm_leads_with_overdue),
      crm_rotting_leads: num(raw.attention?.crm_rotting_leads),
      open_pickings: num(raw.attention?.open_pickings)
    },
    crm: {
      created: num(raw.crm?.created),
      won: num(raw.crm?.won),
      lost: num(raw.crm?.lost),
      open_count: num(raw.crm?.open_count),
      by_currency: (raw.crm?.by_currency ?? []).map((row) => ({
        currency: normalizeCurrencyCode(row.currency, companyCurrency),
        won_amount: num(row.won_amount),
        open_amount: num(row.open_amount),
        weighted_amount: num(row.weighted_amount)
      }))
    },
    recent: {
      orders: raw.recent?.orders ?? [],
      pickings: raw.recent?.pickings ?? [],
      approvals: raw.recent?.approvals ?? [],
      projects: raw.recent?.projects ?? [],
      tasks: raw.recent?.tasks ?? [],
      leads: raw.recent?.leads ?? [],
      partners: raw.recent?.partners ?? []
    },
    public_projects: raw.public_projects ?? []
  }
}

export interface PostedTotals {
  income: number
  expense: number
  incomeCount: number
  expenseCount: number
}

/** Ventas y compras confirmadas de un rango en una moneda. */
export const sumPostedInRange = (
  days: DashboardPostedDay[],
  range: DateRange,
  currency: string
): PostedTotals => {
  const totals: PostedTotals = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 }
  for (const row of days) {
    if (row.currency !== currency || !isInRange(row.day, range)) continue
    totals.income += row.sale_amount
    totals.incomeCount += row.sale_count
    totals.expense += row.purchase_amount
    totals.expenseCount += row.purchase_count
  }
  return totals
}
