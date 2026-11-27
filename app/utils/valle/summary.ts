// Marcadores de Valle Bit y resumen de cada ubicación.
//
// Todo sale de lo que ya consulta el panel (`get_sales_kpis`,
// `get_dashboard_snapshot`, gastos pagados, stock bajo): el juego no calcula
// cifras propias. Funciones puras, probadas en `tests/utils/valle.test.ts`.
import type { SalesKpis } from '~/types/sales.types'
import type { DashboardSnapshot } from '../dashboardSnapshot'
import type { LocationId } from './types'

export interface ValleAgendaItem {
  id: string
  kind: 'task' | 'approval' | 'activity'
  title: string
  subtitle: string
  route: string
  overdue: boolean
}

export interface ValleDepartment {
  name: string
  members: string[]
}

export interface VallePayrollPeriod {
  id: string
  name: string
  statusLabel: string
  totalNet: number
}

export interface ValleWorldData {
  currency: string
  /** Mes en curso y el mismo tramo del mes anterior. `null` = no se pudo leer. */
  kpis: SalesKpis | null
  previousKpis: SalesKpis | null
  /** Gastos de operación en estado `paid` del periodo. */
  expensesPaid: number | null
  previousExpensesPaid: number | null
  snapshot: DashboardSnapshot | null
  lowStock: number | null
  /** Datos que se piden al entrar a su edificio. `null` = aún sin cargar o sin acceso. */
  departments: ValleDepartment[] | null
  payrollPeriods: VallePayrollPeriod[] | null
  agenda: ValleAgendaItem[] | null
}

export const emptyWorldData = (currency = 'MXN'): ValleWorldData => ({
  currency,
  kpis: null,
  previousKpis: null,
  expensesPaid: null,
  previousExpensesPaid: null,
  snapshot: null,
  lowStock: null,
  departments: null,
  payrollPeriods: null,
  agenda: null
})

export type MarkerKey = 'collected' | 'expenses' | 'profit' | 'forecast' | 'receivable' | 'lowStock' | 'pending'

export interface ScoreMarker {
  key: MarkerKey
  label: string
  emoji: string
  kind: 'money' | 'count'
  /** `null` = sin dato (aún cargando o sin acceso). */
  value: number | null
  /** Cambio contra el mismo tramo del mes anterior. */
  trend: 'up' | 'down' | 'flat' | null
  /** ¿El cambio es bueno para la empresa? */
  trendIsGood: boolean | null
  hint: string
  /** Ubicación del mapa donde se explica el marcador. */
  location: LocationId
}

const trendOf = (current: number | null, previous: number | null): ScoreMarker['trend'] => {
  if (current === null || previous === null) return null
  if (Math.abs(current - previous) < 0.005) return 'flat'
  return current > previous ? 'up' : 'down'
}

const goodWhen = (trend: ScoreMarker['trend'], upIsGood: boolean): boolean | null =>
  trend === null || trend === 'flat' ? null : (trend === 'up') === upIsGood

/** Egresos del periodo: compras pagadas + gastos de operación pagados (base de caja). */
export const totalOutflow = (kpis: SalesKpis | null, expensesPaid: number | null): number | null =>
  kpis === null ? null : kpis.totals.purchases_paid + (expensesPaid ?? 0)

/** Cartera con al menos un día de atraso. */
export const overdueReceivables = (kpis: SalesKpis | null): number | null => {
  if (!kpis) return null
  const r = kpis.receivables
  return r.d1_30 + r.d31_60 + r.d61_90 + r.d90_plus
}

/** Embudo de CRM ponderado por probabilidad, en la moneda de la empresa. */
export const weightedPipeline = (snapshot: DashboardSnapshot | null, currency: string): number | null => {
  if (!snapshot) return null
  const row = snapshot.crm.by_currency.find(entry => entry.currency.toUpperCase() === currency.toUpperCase())
  return row?.weighted_amount ?? 0
}

/** Pendientes que piden atención: tareas vencidas, aprobaciones en revisión y seguimientos de CRM vencidos. */
export const pendingCount = (snapshot: DashboardSnapshot | null): number | null => {
  if (!snapshot) return null
  const a = snapshot.attention
  return a.overdue_tasks + a.pending_approvals + a.crm_overdue_activities
}

export const buildScoreboard = (data: ValleWorldData): ScoreMarker[] => {
  const collected = data.kpis?.totals.net_collected ?? null
  const previousCollected = data.previousKpis?.totals.net_collected ?? null
  const outflow = totalOutflow(data.kpis, data.expensesPaid)
  const previousOutflow = totalOutflow(data.previousKpis, data.previousExpensesPaid)
  const profit = collected === null || outflow === null ? null : collected - outflow
  const previousProfit = previousCollected === null || previousOutflow === null ? null : previousCollected - previousOutflow
  const receivable = data.kpis?.receivables.total ?? null
  const pipeline = weightedPipeline(data.snapshot, data.currency)
  // Si falta una de las dos partes se muestra la que haya; sin ninguna, sin dato.
  const forecast = receivable === null && pipeline === null ? null : (receivable ?? 0) + (pipeline ?? 0)

  const collectedTrend = trendOf(collected, previousCollected)
  const outflowTrend = trendOf(outflow, previousOutflow)
  const profitTrend = trendOf(profit, previousProfit)

  return [
    {
      key: 'collected', label: 'Cobrado', emoji: '💰', kind: 'money', value: collected,
      trend: collectedTrend, trendIsGood: goodWhen(collectedTrend, true),
      hint: 'Ingresos cobrados este mes, menos reembolsos.', location: 'banco'
    },
    {
      key: 'expenses', label: 'Gastos', emoji: '🧾', kind: 'money', value: outflow,
      trend: outflowTrend, trendIsGood: goodWhen(outflowTrend, false),
      hint: 'Compras pagadas más gastos de operación pagados este mes.', location: 'banco'
    },
    {
      key: 'profit', label: 'Utilidad', emoji: '📊', kind: 'money', value: profit,
      trend: profitTrend, trendIsGood: goodWhen(profitTrend, true),
      hint: 'Cobrado menos gastos del mes (base de caja).', location: 'banco'
    },
    {
      key: 'forecast', label: 'Previsto', emoji: '🔮', kind: 'money', value: forecast,
      trend: null, trendIsGood: null,
      hint: 'Ingresos previstos: lo que falta por cobrar más el embudo de CRM ponderado.', location: 'oficina'
    },
    {
      key: 'receivable', label: 'Por cobrar', emoji: '📬', kind: 'money', value: receivable,
      trend: null, trendIsGood: null,
      hint: 'Saldo pendiente de cobro de tus ventas confirmadas.', location: 'banco'
    },
    {
      key: 'lowStock', label: 'Stock bajo', emoji: '📦', kind: 'count', value: data.lowStock,
      trend: null, trendIsGood: null,
      hint: 'Productos por debajo de su mínimo.', location: 'almacen'
    },
    {
      key: 'pending', label: 'Pendientes', emoji: '❗', kind: 'count', value: pendingCount(data.snapshot),
      trend: null, trendIsGood: null,
      hint: 'Tareas vencidas, aprobaciones en revisión y seguimientos de CRM vencidos.', location: 'plaza'
    }
  ]
}

export const formatValleMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(amount)
  }
}

/** Monto abreviado para los marcadores: $1.2 M, $45 k. */
export const formatCompactMoney = (amount: number, currency: string): string => {
  const abs = Math.abs(amount)
  if (abs < 10_000) return formatValleMoney(amount, currency)
  const [divisor, suffix] = abs >= 1_000_000 ? [1_000_000, 'M'] : [1_000, 'k']
  const scaled = amount / divisor
  const digits = Math.abs(scaled) >= 100 ? 0 : 1
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(scaled).toFixed(digits).replace(/\.0$/, '')} ${suffix}`
}

export const formatMarkerValue = (marker: ScoreMarker, currency: string): string => {
  if (marker.value === null) return '—'
  return marker.kind === 'money'
    ? formatCompactMoney(marker.value, currency)
    : new Intl.NumberFormat('es-MX').format(marker.value)
}

export interface LocationStat {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
}

export interface LocationItem {
  id: string
  title: string
  subtitle: string
  route: string
  flag?: string
}

export interface LocationSummary {
  /** Lo que dice Bit sobre el estado de hoy. */
  liveLine: string
  stats: LocationStat[]
  itemsTitle: string
  items: LocationItem[]
  /** Mensaje cuando no hay datos que mostrar (sin acceso o aún sin registros). */
  emptyNote: string | null
}

const count = (value: number): string => new Intl.NumberFormat('es-MX').format(value)
const plural = (n: number, one: string, many: string): string => `${count(n)} ${n === 1 ? one : many}`
const NO_DATA = 'No pude leer estos datos. Puede que tu rol no tenga acceso o que haya un problema de conexión.'

const blank = (liveLine: string, emptyNote: string | null = NO_DATA): LocationSummary =>
  ({ liveLine, stats: [], itemsTitle: '', items: [], emptyNote })

export const buildLocationSummary = (id: LocationId, data: ValleWorldData): LocationSummary => {
  const money = (amount: number) => formatValleMoney(amount, data.currency)
  const { kpis, snapshot } = data

  switch (id) {
    case 'plaza': {
      if (!snapshot) return blank('Todavía no tengo el resumen de hoy.')
      const a = snapshot.attention
      const pending = pendingCount(snapshot) ?? 0
      return {
        liveLine: pending === 0
          ? 'Hoy no hay pendientes atrasados. ¡Buen momento para adelantar trabajo!'
          : `Hay ${plural(pending, 'pendiente que pide', 'pendientes que piden')} atención hoy.`,
        stats: [
          { label: 'Tareas vencidas', value: count(a.overdue_tasks), tone: a.overdue_tasks ? 'bad' : 'good' },
          { label: 'Aprobaciones en revisión', value: count(a.pending_approvals), tone: a.pending_approvals ? 'warn' : 'good' },
          { label: 'Seguimientos CRM vencidos', value: count(a.crm_overdue_activities), tone: a.crm_overdue_activities ? 'bad' : 'good' },
          { label: 'Movimientos abiertos', value: count(a.open_pickings) },
          { label: 'Contactos activos', value: count(snapshot.counts.active_partners) },
          { label: 'Productos activos', value: count(snapshot.counts.active_products) }
        ],
        itemsTitle: '',
        items: [],
        emptyNote: null
      }
    }

    case 'mercado': {
      if (!kpis) return blank('No pude leer las ventas del mes.')
      const drafts = snapshot?.drafts.reduce((sum, d) => sum + d.sale_count, 0) ?? 0
      const pending = kpis.pending_deliveries.orders
      return {
        liveLine: pending > 0
          ? `Tienes ${plural(pending, 'orden por surtir', 'órdenes por surtir')} y ${plural(kpis.orders_confirmed.count, 'venta confirmada', 'ventas confirmadas')} este mes.`
          : `Este mes van ${plural(kpis.orders_confirmed.count, 'venta confirmada', 'ventas confirmadas')}. No hay entregas pendientes.`,
        stats: [
          { label: 'Ventas confirmadas', value: count(kpis.orders_confirmed.count) },
          { label: 'Importe confirmado', value: money(kpis.orders_confirmed.total) },
          { label: 'Ticket promedio', value: money(kpis.totals.average_ticket) },
          { label: 'Unidades vendidas', value: count(kpis.totals.units_sold) },
          { label: 'Cotizaciones en borrador', value: count(drafts) },
          { label: 'Por surtir', value: count(pending), tone: pending ? 'warn' : 'good' }
        ],
        itemsTitle: 'Órdenes recientes',
        items: (snapshot?.recent.orders ?? []).filter(o => o.id && o.order_type !== 'purchase').slice(0, 5).map(o => ({
          id: o.id as string,
          title: o.name ?? 'Orden',
          subtitle: `${o.partner_name ?? o.customer_name ?? 'Sin cliente'} · ${money(o.amount_total ?? 0)}`,
          route: `/admin/orders/${o.id}`
        })),
        emptyNote: null
      }
    }

    case 'banco': {
      if (!kpis) return blank('No pude leer las finanzas del mes.')
      const outflow = totalOutflow(kpis, data.expensesPaid) ?? 0
      const profit = kpis.totals.net_collected - outflow
      const overdue = overdueReceivables(kpis) ?? 0
      return {
        liveLine: profit >= 0
          ? `Este mes la utilidad va en ${money(profit)}.${overdue > 0 ? ` Ojo: hay ${money(overdue)} de cartera vencida.` : ''}`
          : `Este mes han salido ${money(-profit)} más de lo que entró.${overdue > 0 ? ` Además hay ${money(overdue)} de cartera vencida.` : ''}`,
        stats: [
          { label: 'Cobrado', value: money(kpis.totals.net_collected), tone: 'good' },
          { label: 'Compras pagadas', value: money(kpis.totals.purchases_paid) },
          { label: 'Gastos de operación', value: data.expensesPaid === null ? '—' : money(data.expensesPaid) },
          { label: 'Utilidad del mes', value: money(profit), tone: profit >= 0 ? 'good' : 'bad' },
          { label: 'Por cobrar', value: money(kpis.receivables.total) },
          { label: 'Cartera vencida', value: money(overdue), tone: overdue > 0 ? 'bad' : 'good' },
          { label: 'Por pagar', value: money(kpis.payables.total) }
        ],
        itemsTitle: '',
        items: [],
        emptyNote: null
      }
    }

    case 'almacen': {
      if (!snapshot && data.lowStock === null) return blank('No pude leer el inventario.')
      const low = data.lowStock ?? 0
      const open = snapshot?.attention.open_pickings ?? 0
      return {
        liveLine: low > 0
          ? `Hay ${plural(low, 'producto por debajo de su mínimo', 'productos por debajo de su mínimo')}. Conviene reabastecer.`
          : 'Ningún producto está por debajo de su mínimo.',
        stats: [
          { label: 'Stock bajo', value: data.lowStock === null ? '—' : count(low), tone: low ? 'warn' : 'good' },
          { label: 'Movimientos abiertos', value: count(open), tone: open ? 'warn' : 'good' },
          { label: 'Productos activos', value: count(snapshot?.counts.active_products ?? 0) }
        ],
        itemsTitle: 'Movimientos recientes',
        items: (snapshot?.recent.pickings ?? []).filter(p => p.id).slice(0, 5).map(p => ({
          id: p.id as string,
          title: p.name ?? 'Movimiento',
          subtitle: `${p.warehouse_name ?? 'Almacén'}${p.order_name ? ` · ${p.order_name}` : ''}`,
          route: `/admin/pickings/${p.id}`
        })),
        emptyNote: null
      }
    }

    case 'oficina': {
      if (!snapshot) return blank('No pude leer el embudo de ventas.')
      const { crm, attention } = snapshot
      const weighted = weightedPipeline(snapshot, data.currency) ?? 0
      return {
        liveLine: attention.crm_overdue_activities > 0
          ? `Hay ${plural(attention.crm_overdue_activities, 'seguimiento vencido', 'seguimientos vencidos')} en ${plural(attention.crm_leads_with_overdue, 'lead', 'leads')}.`
          : `Tienes ${plural(crm.open_count, 'lead abierto', 'leads abiertos')} y los seguimientos van al día.`,
        stats: [
          { label: 'Leads abiertos', value: count(crm.open_count) },
          { label: 'Embudo ponderado', value: money(weighted) },
          { label: 'Creados este mes', value: count(crm.created) },
          { label: 'Ganados este mes', value: count(crm.won), tone: 'good' },
          { label: 'Perdidos este mes', value: count(crm.lost) },
          { label: 'Leads estancados', value: count(attention.crm_rotting_leads), tone: attention.crm_rotting_leads ? 'warn' : 'good' }
        ],
        itemsTitle: 'Leads recientes',
        items: snapshot.recent.leads.filter(l => l.id).slice(0, 5).map(l => ({
          id: l.id as string,
          title: l.name ?? 'Lead',
          subtitle: `${l.stage_name ?? 'Sin etapa'} · ${money(l.amount ?? 0)}`,
          route: `/admin/crm/leads/${l.id}`,
          flag: l.is_rotting ? 'Estancado' : undefined
        })),
        emptyNote: null
      }
    }

    case 'taller': {
      if (!snapshot) return blank('No pude leer los proyectos.')
      const overdue = snapshot.attention.overdue_tasks
      return {
        liveLine: overdue > 0
          ? `Hay ${plural(overdue, 'tarea vencida', 'tareas vencidas')} en los proyectos.`
          : `Hay ${plural(snapshot.counts.active_projects, 'proyecto en curso', 'proyectos en curso')} y ninguna tarea vencida.`,
        stats: [
          { label: 'Proyectos en curso', value: count(snapshot.counts.active_projects) },
          { label: 'Avance promedio', value: `${Math.round(snapshot.counts.average_project_progress)} %` },
          { label: 'Tareas vencidas', value: count(overdue), tone: overdue ? 'bad' : 'good' }
        ],
        itemsTitle: 'Tareas recientes',
        items: snapshot.recent.tasks.filter(t => t.id).slice(0, 5).map(t => ({
          id: t.id as string,
          title: t.name ?? 'Tarea',
          subtitle: `${t.project_name ?? 'Proyecto'}${t.responsible_display_name ? ` · ${t.responsible_display_name}` : ''}`,
          route: `/admin/tasks/${t.id}`,
          flag: t.is_overdue ? 'Vencida' : undefined
        })),
        emptyNote: null
      }
    }

    case 'ayuntamiento': {
      if (!snapshot) return blank('No pude leer las aprobaciones.')
      const pending = snapshot.attention.pending_approvals
      return {
        liveLine: pending > 0
          ? `Hay ${plural(pending, 'solicitud en revisión', 'solicitudes en revisión')}.`
          : 'No hay solicitudes en revisión.',
        stats: [
          { label: 'En revisión', value: count(pending), tone: pending ? 'warn' : 'good' }
        ],
        itemsTitle: 'Solicitudes recientes',
        items: snapshot.recent.approvals.filter(r => r.id).slice(0, 5).map(r => ({
          id: r.id as string,
          title: r.title ?? 'Solicitud',
          subtitle: r.category_name ?? 'Sin categoría',
          route: `/admin/approval-requests/${r.id}`
        })),
        emptyNote: null
      }
    }

    case 'gremio': {
      if (data.departments === null) return blank('Estoy reuniendo al equipo…', null)
      const people = data.departments.reduce((sum, d) => sum + d.members.length, 0)
      if (people === 0) return blank('Aún no hay empleados registrados en esta empresa.', 'Registra a tu equipo en Empleados para verlo aquí.')
      return {
        liveLine: `El equipo tiene ${plural(people, 'persona', 'personas')} en ${plural(data.departments.length, 'departamento', 'departamentos')}.`,
        stats: [
          { label: 'Personas', value: count(people) },
          { label: 'Departamentos', value: count(data.departments.length) }
        ],
        itemsTitle: 'Departamentos',
        items: data.departments.map(d => ({
          id: d.name,
          title: d.name,
          subtitle: d.members.slice(0, 6).join(', ') + (d.members.length > 6 ? ` y ${d.members.length - 6} más` : ''),
          route: '/admin/employees',
          flag: plural(d.members.length, 'persona', 'personas')
        })),
        emptyNote: null
      }
    }

    case 'tesoreria': {
      if (data.payrollPeriods === null) return blank('Estoy revisando la nómina…', null)
      if (data.payrollPeriods.length === 0) {
        return blank('No veo periodos de nómina. Tus recibos están en «Mis recibos».', 'Los periodos de nómina solo los ven owner y admin. Tus recibos están en «Mis recibos».')
      }
      const latest = data.payrollPeriods[0] as VallePayrollPeriod
      return {
        liveLine: `El periodo más reciente es «${latest.name}» y está en estado ${latest.statusLabel.toLowerCase()}.`,
        stats: [
          { label: 'Periodos', value: count(data.payrollPeriods.length) },
          { label: 'Neto del último periodo', value: money(latest.totalNet) }
        ],
        itemsTitle: 'Periodos recientes',
        items: data.payrollPeriods.slice(0, 5).map(p => ({
          id: p.id,
          title: p.name,
          subtitle: money(p.totalNet),
          route: `/admin/payroll/${p.id}`,
          flag: p.statusLabel
        })),
        emptyNote: null
      }
    }

    case 'tienda': {
      if (!kpis) return blank('No pude leer las ventas por canal.')
      const channel = (name: string) => kpis.by_channel.find(c => c.channel === name)
      const store = channel('storefront')
      const pos = channel('pos')
      const total = (store?.orders ?? 0) + (pos?.orders ?? 0)
      return {
        liveLine: total > 0
          ? `Este mes van ${plural(total, 'venta', 'ventas')} entre la tienda en línea y el punto de venta.`
          : 'Este mes aún no hay ventas en la tienda en línea ni en el punto de venta.',
        stats: [
          { label: 'Pedidos en línea', value: count(store?.orders ?? 0) },
          { label: 'Cobrado en línea', value: money(store?.net_collected ?? 0) },
          { label: 'Tickets de POS', value: count(pos?.orders ?? 0) },
          { label: 'Cobrado en POS', value: money(pos?.net_collected ?? 0) }
        ],
        itemsTitle: '',
        items: [],
        emptyNote: null
      }
    }

    case 'tablon': {
      if (data.agenda === null) return blank('Estoy leyendo tu agenda…', null)
      if (data.agenda.length === 0) return blank('No tienes misiones pendientes. ¡Todo al día!', 'Cuando te asignen tareas, aprobaciones o seguimientos, aparecerán aquí.')
      const overdue = data.agenda.filter(item => item.overdue).length
      const of = (kind: ValleAgendaItem['kind']) => data.agenda?.filter(item => item.kind === kind).length ?? 0
      return {
        liveLine: overdue > 0
          ? `Tienes ${plural(data.agenda.length, 'misión', 'misiones')}; ${plural(overdue, 'está atrasada', 'están atrasadas')}.`
          : `Tienes ${plural(data.agenda.length, 'misión pendiente', 'misiones pendientes')}, todas en tiempo.`,
        stats: [
          { label: 'Tareas', value: count(of('task')) },
          { label: 'Aprobaciones', value: count(of('approval')) },
          { label: 'Seguimientos CRM', value: count(of('activity')) },
          { label: 'Atrasadas', value: count(overdue), tone: overdue ? 'bad' : 'good' }
        ],
        itemsTitle: 'Tus misiones',
        items: data.agenda.slice(0, 8).map(item => ({
          id: `${item.kind}-${item.id}`,
          title: item.title,
          subtitle: item.subtitle,
          route: item.route,
          flag: item.overdue ? 'Atrasada' : undefined
        })),
        emptyNote: null
      }
    }

    case 'casa':
      return blank('Aquí puedes cambiar cómo te ves en el valle.', null)
  }
}
