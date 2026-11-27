import { afterAll, describe, expect, it } from 'vitest'
import {
  RECENT_LIMITS,
  buildDashboardSnapshot,
  normalizeCurrencyCode,
  normalizeDashboardSnapshot,
  sumPostedInRange,
  type DashboardSnapshot,
  type DashboardSnapshotLists
} from '../../app/utils/dashboardSnapshot'

// Zona fija (UTC−6, sin horario de verano) para que los timestamps sean
// deterministas. Se fija al cargar el módulo porque los snapshots se arman
// en el cuerpo de cada `describe`, antes de cualquier `beforeAll`.
const originalTz = process.env.TZ
process.env.TZ = 'America/Mexico_City'
afterAll(() => {
  process.env.TZ = originalTz
})

type Lists = DashboardSnapshotLists
// Las filas de prueba solo llevan los campos que lee el snapshot.
const rows = <K extends keyof Lists>(_key: K, items: Record<string, unknown>[]): Lists[K] =>
  items as unknown as Lists[K]

const emptyLists = (): Lists => ({
  partners: [],
  products: [],
  orders: [],
  projects: [],
  pickings: [],
  approvals: [],
  tasks: [],
  leads: []
})

const range = { from: '2026-11-01', to: '2026-11-30' }
const comparison = { from: '2026-10-01', to: '2026-10-31' }
const params = { range, comparison, today: '2026-11-20', companyCurrency: 'mxn' }

describe('normalizeCurrencyCode', () => {
  it('normaliza a mayúsculas y usa el respaldo si viene vacío', () => {
    expect(normalizeCurrencyCode(' usd ', 'MXN')).toBe('USD')
    expect(normalizeCurrencyCode('', 'MXN')).toBe('MXN')
    expect(normalizeCurrencyCode(null, 'EUR')).toBe('EUR')
  })
})

describe('buildDashboardSnapshot — órdenes', () => {
  const lists = emptyLists()
  lists.orders = rows('orders', [
    { id: 'o1', order_type: 'sale', order_state: 'posted', order_date: '2026-11-05', currency: 'MXN', amount_total: 100, created_at: '2026-11-05T10:00:00Z' },
    { id: 'o2', order_type: 'sale', order_state: 'posted', order_date: '2026-11-05', currency: 'mxn', amount_total: 50, created_at: '2026-11-05T11:00:00Z' },
    { id: 'o3', order_type: 'purchase', order_state: 'posted', order_date: '2026-10-10', currency: null, amount_total: 30, created_at: '2026-10-10T11:00:00Z' },
    { id: 'o4', order_type: 'sale', order_state: 'posted', order_date: '2026-09-10', currency: 'MXN', amount_total: 999, created_at: '2026-09-10T11:00:00Z' },
    { id: 'o5', order_type: 'sale', order_state: 'draft', order_date: '2026-11-06', currency: 'USD', amount_total: '20.5', created_at: '2026-11-06T11:00:00Z' },
    { id: 'o6', order_type: 'purchase', order_state: 'draft', order_date: '2026-11-06', currency: 'MXN', amount_total: 7, created_at: '2026-11-07T11:00:00Z' },
    { id: 'o7', order_type: 'sale', order_state: 'cancel', order_date: '2026-11-06', currency: 'EUR', amount_total: 1, created_at: '2026-11-08T11:00:00Z' }
  ])
  const snap = buildDashboardSnapshot(lists, params)

  it('lista todas las monedas usadas, normalizadas', () => {
    expect(snap.company_currency).toBe('MXN')
    expect(snap.currencies).toEqual(['EUR', 'MXN', 'USD'])
  })

  it('agrupa confirmadas por día y moneda solo dentro del periodo y la comparación', () => {
    expect(snap.posted_daily).toEqual([
      { day: '2026-10-10', currency: 'MXN', sale_amount: 0, sale_count: 0, purchase_amount: 30, purchase_count: 1 },
      { day: '2026-11-05', currency: 'MXN', sale_amount: 150, sale_count: 2, purchase_amount: 0, purchase_count: 0 }
    ])
  })

  it('suma borradores por moneda', () => {
    expect(snap.drafts).toEqual([
      { currency: 'MXN', sale_amount: 0, sale_count: 0, purchase_amount: 7, purchase_count: 1 },
      { currency: 'USD', sale_amount: 20.5, sale_count: 1, purchase_amount: 0, purchase_count: 0 }
    ])
  })

  it('sumPostedInRange separa periodo actual y de comparación', () => {
    expect(sumPostedInRange(snap.posted_daily, range, 'MXN')).toEqual({ income: 150, expense: 0, incomeCount: 2, expenseCount: 0 })
    expect(sumPostedInRange(snap.posted_daily, comparison, 'MXN')).toEqual({ income: 0, expense: 30, incomeCount: 0, expenseCount: 1 })
    expect(sumPostedInRange(snap.posted_daily, range, 'USD')).toEqual({ income: 0, expense: 0, incomeCount: 0, expenseCount: 0 })
  })

  it('actividad reciente: las órdenes más nuevas primero, con límite', () => {
    expect(snap.recent.orders.map((o) => o.id)).toEqual(['o7', 'o6', 'o5', 'o2', 'o1', 'o3'])
    expect(snap.recent.orders).toHaveLength(RECENT_LIMITS.orders)
  })

  it('toma la moneda de las órdenes cuando la empresa no la trae', () => {
    const withCompanyCurrency = emptyLists()
    withCompanyCurrency.orders = rows('orders', [{ id: 'x', order_state: 'draft', order_type: 'sale', currency: null, company_currency: 'usd', amount_total: 1 }])
    const s = buildDashboardSnapshot(withCompanyCurrency, { ...params, companyCurrency: null })
    expect(s.company_currency).toBe('USD')
    expect(s.drafts[0]?.currency).toBe('USD')
  })
})

describe('buildDashboardSnapshot — atención y operación', () => {
  const lists = emptyLists()
  lists.tasks = rows('tasks', [
    { id: 't1', name: '  ', code: 'T-1', status: 'pending', due_date: '2026-11-01', created_at: '2026-10-01T00:00:00Z' },
    { id: 't2', name: 'Reciente', status: 'in_progress', due_date: '2026-11-19', created_at: '2026-10-02T00:00:00Z' },
    { id: 't3', name: 'Hoy', status: 'pending', due_date: '2026-11-20', created_at: '2026-10-03T00:00:00Z' },
    { id: 't4', name: 'Terminada', status: 'completed', due_date: '2026-10-01', created_at: '2026-10-04T00:00:00Z' }
  ])
  lists.approvals = rows('approvals', [{ id: 'a1', status: 'published' }, { id: 'a2', status: 'approved' }])
  lists.pickings = rows('pickings', [{ id: 'p1', status: 'borrador' }, { id: 'p2', status: 'publicado' }, { id: 'p3', status: 'confirmado' }])
  lists.leads = rows('leads', [
    { id: 'l1', is_won: false, is_lost: false, overdue_activity_count: 2, is_rotting: true },
    { id: 'l2', is_won: null, is_lost: null, overdue_activity_count: 1, is_rotting: false },
    { id: 'l3', is_won: true, is_lost: false, overdue_activity_count: 5, is_rotting: true }
  ])
  lists.projects = rows('projects', [
    { id: 'pr1', status: 'in_progress', progress: 40, is_public: true, created_at: '2026-11-01T00:00:00Z' },
    { id: 'pr2', status: 'in_progress', progress: 75, is_public: false, created_at: '2026-11-02T00:00:00Z' },
    { id: 'pr3', status: 'completed', progress: 100, is_public: true, created_at: '2026-11-03T00:00:00Z' }
  ])
  lists.partners = rows('partners', [{ id: 'c1', active: true }, { id: 'c2', active: null }, { id: 'c3', active: false }])
  lists.products = rows('products', [{ id: 'x1', status: 'active' }, { id: 'x2', status: 'archived' }])
  const snap = buildDashboardSnapshot(lists, params)

  it('cuenta tareas vencidas antes de hoy y nombra la más antigua (código si no hay nombre)', () => {
    expect(snap.attention.overdue_tasks).toBe(2)
    expect(snap.attention.oldest_overdue_task).toBe('T-1')
  })

  it('cuenta aprobaciones en revisión y movimientos abiertos', () => {
    expect(snap.attention.pending_approvals).toBe(1)
    expect(snap.attention.open_pickings).toBe(2)
  })

  it('CRM: solo leads abiertos cuentan para actividades vencidas y estancados', () => {
    expect(snap.attention.crm_overdue_activities).toBe(3)
    expect(snap.attention.crm_leads_with_overdue).toBe(2)
    expect(snap.attention.crm_rotting_leads).toBe(1)
    expect(snap.crm.open_count).toBe(2)
  })

  it('operación: activos y avance promedio redondeado', () => {
    expect(snap.counts).toEqual({ active_partners: 2, active_products: 1, active_projects: 2, average_project_progress: 58 })
    expect(snap.public_projects.map((p) => p.id)).toEqual(['pr3', 'pr1'])
  })
})

describe('buildDashboardSnapshot — CRM del periodo', () => {
  const lists = emptyLists()
  lists.leads = rows('leads', [
    // Creado en el periodo, abierto, 50 % de probabilidad.
    { id: 'l1', created_at: '2026-11-03T12:00:00Z', is_won: false, is_lost: false, amount: 1000, currency: 'MXN', probability: 50 },
    // Abierto, sin probabilidad propia: usa la de la etapa.
    { id: 'l2', created_at: '2026-09-03T12:00:00Z', is_won: false, is_lost: false, amount: 200, currency: 'mxn', probability: null, stage_probability: 10 },
    // Ganado en el periodo con monto ganado.
    { id: 'l3', created_at: '2026-09-03T12:00:00Z', is_won: true, is_lost: false, amount: 900, won_amount: 800, currency: 'MXN', actual_close_date: '2026-11-10' },
    // Ganado fuera del periodo.
    { id: 'l4', created_at: '2026-09-03T12:00:00Z', is_won: true, is_lost: false, amount: 900, currency: 'MXN', actual_close_date: '2026-10-10' },
    // Perdido en el periodo (fecha de cierre desde stage_changed_at, hora local).
    { id: 'l5', created_at: '2026-09-03T12:00:00Z', is_won: false, is_lost: true, amount: 50, currency: 'USD', stage_changed_at: '2026-11-01T07:00:00Z' },
    // Perdido el 31 de octubre en hora local (UTC−6, 22:00) aunque en UTC ya sea 1 de noviembre.
    { id: 'l6', created_at: '2026-09-03T12:00:00Z', is_won: false, is_lost: true, amount: 50, currency: 'USD', stage_changed_at: '2026-11-01T04:00:00Z' }
  ])
  const snap = buildDashboardSnapshot(lists, params)

  it('cuenta creados, ganados y perdidos por fecha local', () => {
    expect(snap.crm.created).toBe(1)
    expect(snap.crm.won).toBe(1)
    expect(snap.crm.lost).toBe(1)
  })

  it('montos por moneda: ganado, embudo abierto y ponderado', () => {
    expect(snap.crm.by_currency).toEqual([
      { currency: 'MXN', won_amount: 800, open_amount: 1200, weighted_amount: 520 },
      { currency: 'USD', won_amount: 0, open_amount: 0, weighted_amount: 0 }
    ])
  })
})

describe('normalizeDashboardSnapshot', () => {
  it('convierte numeric en texto a número y rellena faltantes', () => {
    const raw = {
      company_currency: 'mxn',
      currencies: ['MXN'],
      counts: { active_partners: '3', active_products: 1, active_projects: 0, average_project_progress: '38' },
      drafts: [{ currency: 'usd', sale_amount: '10.50', sale_count: 1, purchase_amount: '0', purchase_count: 0 }],
      posted_daily: [],
      attention: { overdue_tasks: 1, oldest_overdue_task: null, pending_approvals: 0, crm_overdue_activities: '4', crm_leads_with_overdue: 1, crm_rotting_leads: 0, open_pickings: 0 },
      crm: { created: 0, won: 0, lost: 0, open_count: 0, by_currency: [{ currency: '', won_amount: '1', open_amount: 0, weighted_amount: '0.5' }] }
    } as unknown as DashboardSnapshot
    const snap = normalizeDashboardSnapshot(raw)
    expect(snap.company_currency).toBe('MXN')
    expect(snap.counts.active_partners).toBe(3)
    expect(snap.counts.average_project_progress).toBe(38)
    expect(snap.drafts[0]).toEqual({ currency: 'USD', sale_amount: 10.5, sale_count: 1, purchase_amount: 0, purchase_count: 0 })
    expect(snap.attention.crm_overdue_activities).toBe(4)
    expect(snap.crm.by_currency[0]).toEqual({ currency: 'MXN', won_amount: 1, open_amount: 0, weighted_amount: 0.5 })
    expect(snap.recent.orders).toEqual([])
    expect(snap.public_projects).toEqual([])
  })
})
