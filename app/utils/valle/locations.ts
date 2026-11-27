// Catálogo de ubicaciones de Valle Bit: un lugar por módulo del ERP.
//
// Es la fuente única del mapa, del modo lista, de los paneles y de lo que dice
// Bit al llegar. Para sumar un módulo al valle, agrega su entrada aquí y un
// hueco libre en la cuadrícula (4 columnas × 3 filas).
import type { LocationId, LocationShape, ValleLocation } from './types'

export const MAP_WIDTH = 44
export const MAP_HEIGHT = 34

const SLOT_X = [4, 14, 24, 34]
const SLOT_Y = [3, 13, 23]
const SLOT_W = 6
const SLOT_H = 4

interface LocationSeed {
  id: LocationId
  col: number
  row: number
  name: string
  moduleLabel: string
  emoji: string
  shape?: LocationShape
  roofColor: string
  wallColor?: string
  adminRoute: string
  links?: { label: string; route: string }[]
  welcome: string
}

const SEEDS: LocationSeed[] = [
  {
    id: 'banco', col: 0, row: 0, name: 'Banco', moduleLabel: 'Finanzas y gastos', emoji: '🏦',
    roofColor: '#0f766e', adminRoute: '/admin/reports/profit-loss',
    links: [
      { label: 'Gastos', route: '/admin/expenses' },
      { label: 'Cuentas por cobrar', route: '/admin/reports/receivables' },
      { label: 'Cuentas por pagar', route: '/admin/reports/receivables?kind=purchase' }
    ],
    welcome: 'Este es el Banco. Aquí ves cuánto entró, cuánto salió y qué te deben o debes.'
  },
  {
    id: 'ayuntamiento', col: 1, row: 0, name: 'Ayuntamiento', moduleLabel: 'Aprobaciones', emoji: '🏛️',
    roofColor: '#7c3aed', adminRoute: '/admin/approval-requests',
    links: [
      { label: 'Tablero de aprobaciones', route: '/admin/approval-dashboard' },
      { label: 'Flujos', route: '/admin/approval-flows' }
    ],
    welcome: 'Este es el Ayuntamiento. Aquí se piden y se deciden las solicitudes de aprobación.'
  },
  {
    id: 'tesoreria', col: 2, row: 0, name: 'Tesorería', moduleLabel: 'Nómina', emoji: '💼',
    roofColor: '#b45309', adminRoute: '/admin/payroll',
    links: [
      { label: 'Mis recibos', route: '/admin/payroll/my-payslips' },
      { label: 'Salarios', route: '/admin/salaries' }
    ],
    welcome: 'Esta es la Tesorería. Aquí se calculan y pagan los periodos de nómina.'
  },
  {
    id: 'gremio', col: 3, row: 0, name: 'Gremio', moduleLabel: 'Recursos Humanos', emoji: '🧑‍🤝‍🧑',
    roofColor: '#be185d', adminRoute: '/admin/employees',
    links: [
      { label: 'Departamentos', route: '/admin/departments' },
      { label: 'Asistencias', route: '/admin/attendances' },
      { label: 'Vacaciones y permisos', route: '/admin/leaves' }
    ],
    welcome: 'Este es el Gremio. Aquí vive tu equipo, organizado por departamentos.'
  },
  {
    id: 'mercado', col: 0, row: 1, name: 'Mercado', moduleLabel: 'Ventas', emoji: '🏪',
    roofColor: '#dc2626', adminRoute: '/admin/orders',
    links: [
      { label: 'Por surtir', route: '/admin/orders?delivery=pending' },
      { label: 'Reporte de ventas', route: '/admin/reports/sales' }
    ],
    welcome: 'Este es el Mercado. Aquí se cotiza, se vende y se da seguimiento a cada orden.'
  },
  {
    id: 'plaza', col: 1, row: 1, name: 'Plaza', moduleLabel: 'Dashboard', emoji: '⛲', shape: 'fountain',
    roofColor: '#64748b', adminRoute: '/admin',
    links: [{ label: 'Agenda', route: '/admin/agenda' }],
    welcome: 'Esta es la Plaza, el centro del valle. Aquí ves de un vistazo lo que requiere tu atención.'
  },
  {
    id: 'tablon', col: 2, row: 1, name: 'Tablón de misiones', moduleLabel: 'Agenda', emoji: '📜', shape: 'board',
    roofColor: '#92400e', adminRoute: '/admin/agenda',
    links: [{ label: 'Tareas', route: '/admin/tasks' }],
    welcome: 'Este es el Tablón de misiones. Tus misiones son tu agenda: tareas, aprobaciones y seguimientos.'
  },
  {
    id: 'tienda', col: 3, row: 1, name: 'Tienda', moduleLabel: 'Tienda en línea y POS', emoji: '🛍️',
    roofColor: '#0284c7', adminRoute: '/admin/storefront',
    links: [
      { label: 'Terminal POS', route: '/pos' },
      { label: 'Sesiones de caja', route: '/admin/pos/sessions' },
      { label: 'Analítica de la tienda', route: '/admin/storefront/analytics' }
    ],
    welcome: 'Esta es la Tienda. Aquí están tus canales de venta directa: la tienda en línea y el punto de venta.'
  },
  {
    id: 'almacen', col: 0, row: 2, name: 'Almacén', moduleLabel: 'Inventario y compras', emoji: '📦',
    roofColor: '#ca8a04', adminRoute: '/admin/inventory',
    links: [
      { label: 'Por reabastecer', route: '/admin/inventory/restock' },
      { label: 'Productos', route: '/admin/products' },
      { label: 'Movimientos', route: '/admin/pickings' }
    ],
    welcome: 'Este es el Almacén. Aquí controlas existencias, entradas, salidas y lo que falta por reabastecer.'
  },
  {
    id: 'taller', col: 1, row: 2, name: 'Taller', moduleLabel: 'Proyectos', emoji: '🛠️',
    roofColor: '#ea580c', adminRoute: '/admin/projects',
    links: [{ label: 'Tareas', route: '/admin/tasks' }],
    welcome: 'Este es el Taller. Aquí avanzan los proyectos y sus tareas.'
  },
  {
    id: 'oficina', col: 2, row: 2, name: 'Oficina comercial', moduleLabel: 'CRM', emoji: '📈',
    roofColor: '#0369a1', adminRoute: '/admin/crm/kanban',
    links: [
      { label: 'Leads', route: '/admin/crm/leads' },
      { label: 'Pipeline', route: '/admin/crm/stages' }
    ],
    welcome: 'Esta es la Oficina comercial. Aquí se da seguimiento a los prospectos hasta cerrarlos.'
  },
  {
    id: 'casa', col: 3, row: 2, name: 'Tu casa', moduleLabel: 'Perfil y avatar', emoji: '🏠',
    roofColor: '#4f46e5', adminRoute: '/admin/profile',
    links: [{ label: 'Mis empresas', route: '/admin/companies' }],
    welcome: 'Esta es tu casa. Aquí personalizas tu avatar.'
  }
]

const toLocation = (seed: LocationSeed): ValleLocation => {
  const x = SLOT_X[seed.col] ?? 0
  const y = SLOT_Y[seed.row] ?? 0
  const shape = seed.shape ?? 'building'
  // La fuente y el tablón ocupan menos que un edificio y van centrados en su hueco.
  const rect = shape === 'building'
    ? { x, y, w: SLOT_W, h: SLOT_H }
    : shape === 'fountain'
      ? { x: x + 1, y: y + 1, w: 4, h: 3 }
      : { x: x + 1, y: y + 2, w: 4, h: 2 }

  return {
    id: seed.id,
    name: seed.name,
    moduleLabel: seed.moduleLabel,
    emoji: seed.emoji,
    shape,
    rect,
    entrance: { x: x + 3, y: y + SLOT_H },
    roofColor: seed.roofColor,
    wallColor: seed.wallColor ?? '#fef3c7',
    adminRoute: seed.adminRoute,
    links: seed.links ?? [],
    welcome: seed.welcome
  }
}

export const VALLE_LOCATIONS: ValleLocation[] = SEEDS.map(toLocation)

export const getValleLocation = (id: LocationId): ValleLocation | undefined =>
  VALLE_LOCATIONS.find(location => location.id === id)

/** Filas de calles horizontales (dos tiles de alto) bajo cada fila de edificios. */
export const ROAD_ROWS = SLOT_Y.map(y => y + SLOT_H + 1)
/** Columnas de calles verticales entre edificios. */
export const ROAD_COLS = [11, 21, 31]

/** Tile donde aparece el avatar: sobre la calle, frente a la Plaza. */
export const SPAWN_TILE = { x: 17, y: 18 }
