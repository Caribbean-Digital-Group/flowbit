import { describe, expect, it } from 'vitest'
import type { SalesKpis } from '../../types/sales.types'
import type { DashboardSnapshot } from '../../app/utils/dashboardSnapshot'
import {
  ACCESSORIES,
  DEFAULT_AVATAR,
  HAIR_STYLES,
  SPRITE_SIZE,
  WALK_FRAMES,
  avatarPixels,
  bitPixels,
  normalizeAvatar,
  randomAvatar
} from '../../app/utils/valle/avatar'
import { MAP_HEIGHT, MAP_WIDTH, SPAWN_TILE, VALLE_LOCATIONS } from '../../app/utils/valle/locations'
import {
  buildWorldMap,
  cameraFor,
  canStandAt,
  findPath,
  isWalkableTile,
  locationAtTile,
  moveWithCollision,
  nearbyLocation,
  pixelScaleFor,
  tileCenter
} from '../../app/utils/valle/map'
import {
  buildLocationSummary,
  buildScoreboard,
  emptyWorldData,
  formatCompactMoney,
  overdueReceivables,
  pendingCount,
  totalOutflow,
  weightedPipeline
} from '../../app/utils/valle/summary'
import { TILE } from '../../app/utils/valle/types'
import type { Direction } from '../../app/utils/valle/types'

const map = buildWorldMap()

describe('mapa de Valle Bit', () => {
  it('tiene el tamaño declarado y un borde infranqueable', () => {
    expect(map.tiles).toHaveLength(MAP_HEIGHT)
    expect(map.tiles.every(row => row.length === MAP_WIDTH)).toBe(true)
    for (let x = 0; x < MAP_WIDTH; x++) {
      expect(isWalkableTile(map, x, 0)).toBe(false)
      expect(isWalkableTile(map, x, MAP_HEIGHT - 1)).toBe(false)
    }
    expect(isWalkableTile(map, -1, 5)).toBe(false)
    expect(isWalkableTile(map, 5, MAP_HEIGHT + 3)).toBe(false)
  })

  it('tiene doce ubicaciones con id único que no se enciman', () => {
    expect(VALLE_LOCATIONS).toHaveLength(12)
    expect(new Set(VALLE_LOCATIONS.map(l => l.id)).size).toBe(12)
    const seen = new Set<string>()
    for (const { rect } of VALLE_LOCATIONS) {
      for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++) {
          expect(seen.has(`${x},${y}`)).toBe(false)
          seen.add(`${x},${y}`)
          expect(isWalkableTile(map, x, y)).toBe(false)
        }
      }
    }
  })

  it('cada ubicación apunta a una ruta del panel o del POS', () => {
    for (const location of VALLE_LOCATIONS) {
      expect(location.adminRoute.startsWith('/admin')).toBe(true)
      expect(location.welcome.length).toBeGreaterThan(10)
      for (const link of location.links) expect(link.route).toMatch(/^\/(admin|pos)/)
    }
  })

  it('se puede llegar caminando desde el inicio a la entrada de cada ubicación', () => {
    expect(isWalkableTile(map, SPAWN_TILE.x, SPAWN_TILE.y)).toBe(true)
    for (const location of VALLE_LOCATIONS) {
      expect(isWalkableTile(map, location.entrance.x, location.entrance.y)).toBe(true)
      const path = findPath(map, SPAWN_TILE, location.entrance)
      expect(path.length).toBeGreaterThan(0)
      expect(path[path.length - 1]).toEqual(location.entrance)
      // Cada paso avanza un solo tile caminable.
      let previous = SPAWN_TILE
      for (const step of path) {
        expect(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y)).toBe(1)
        expect(isWalkableTile(map, step.x, step.y)).toBe(true)
        previous = step
      }
    }
  })

  it('no hay ruta hacia un tile sólido ni desde el mismo tile', () => {
    const banco = VALLE_LOCATIONS[0]!
    expect(findPath(map, SPAWN_TILE, { x: banco.rect.x, y: banco.rect.y })).toEqual([])
    expect(findPath(map, SPAWN_TILE, SPAWN_TILE)).toEqual([])
  })

  it('identifica la ubicación bajo un tile y la cercana al avatar', () => {
    const mercado = VALLE_LOCATIONS.find(l => l.id === 'mercado')!
    expect(locationAtTile({ x: mercado.rect.x + 1, y: mercado.rect.y + 1 })?.id).toBe('mercado')
    expect(locationAtTile(SPAWN_TILE)).toBeNull()
    expect(nearbyLocation(tileCenter(mercado.entrance))).toBe('mercado')
    expect(nearbyLocation(tileCenter({ x: 2, y: 9 }))).toBeNull()
  })
})

describe('movimiento y cámara', () => {
  const start = tileCenter(SPAWN_TILE)

  it('avanza en terreno libre', () => {
    expect(canStandAt(map, start.x, start.y)).toBe(true)
    expect(moveWithCollision(map, start, 3, 0)).toEqual({ x: start.x + 3, y: start.y })
  })

  it('no atraviesa un edificio y se desliza por el otro eje', () => {
    const plaza = VALLE_LOCATIONS.find(l => l.id === 'plaza')!
    const door = tileCenter(plaza.entrance)
    // Empujar hacia arriba contra la fachada no mueve en Y, pero sí en X.
    let position = door
    for (let i = 0; i < 40; i++) position = moveWithCollision(map, position, 0, -2)
    expect(position.y).toBeGreaterThanOrEqual(plaza.entrance.y * TILE)
    const slid = moveWithCollision(map, position, 1, -2)
    expect(slid.x).toBe(position.x + 1)
    expect(slid.y).toBe(position.y)
  })

  it('la cámara sigue al objetivo sin salirse del mapa', () => {
    const worldW = MAP_WIDTH * TILE
    const worldH = MAP_HEIGHT * TILE
    expect(cameraFor({ x: 0, y: 0 }, 200, 150, map)).toEqual({ x: 0, y: 0 })
    expect(cameraFor({ x: worldW, y: worldH }, 200, 150, map)).toEqual({ x: worldW - 200, y: worldH - 150 })
    expect(cameraFor({ x: 300, y: 300 }, 200, 150, map)).toEqual({ x: 200, y: 225 })
    // Vista más grande que el mapa: lo centra.
    expect(cameraFor({ x: 10, y: 10 }, worldW + 100, worldH + 60, map)).toEqual({ x: -50, y: -30 })
  })

  it('la escala es entera y acotada', () => {
    expect(pixelScaleFor(360, 640)).toBe(2)
    expect(pixelScaleFor(1440, 800)).toBe(4)
    expect(pixelScaleFor(3840, 2160)).toBe(5)
    expect(pixelScaleFor(100, 100)).toBe(2)
  })
})

describe('avatar', () => {
  it('normaliza valores ajenos al catálogo', () => {
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR)
    expect(normalizeAvatar({ skin: 'url(javascript:1)', hairStyle: 'mohawk', outfit: '#dc2626' }))
      .toEqual({ ...DEFAULT_AVATAR, outfit: '#dc2626' })
  })

  it('el avatar al azar siempre es válido', () => {
    for (let i = 0; i < 20; i++) {
      const avatar = randomAvatar()
      expect(normalizeAvatar(avatar)).toEqual(avatar)
    }
  })

  it('genera un sprite de 16×16 en cada dirección, cuadro, peinado y accesorio', () => {
    const directions: Direction[] = ['down', 'up', 'left', 'right']
    for (const direction of directions) {
      for (let frame = 0; frame < WALK_FRAMES; frame++) {
        for (const hair of HAIR_STYLES) {
          for (const accessory of ACCESSORIES) {
            const sprite = avatarPixels({ ...DEFAULT_AVATAR, hairStyle: hair.value, accessory: accessory.value }, direction, frame)
            expect(sprite).toHaveLength(SPRITE_SIZE)
            expect(sprite.every(row => row.length === SPRITE_SIZE)).toBe(true)
            expect(sprite.flat().filter(Boolean).length).toBeGreaterThan(60)
          }
        }
      }
    }
  })

  it('refleja las opciones en el sprite', () => {
    const colors = (sprite: (string | null)[][]) => new Set(sprite.flat().filter(Boolean))
    const base = avatarPixels(DEFAULT_AVATAR, 'down')
    expect(colors(base).has(DEFAULT_AVATAR.outfit)).toBe(true)
    expect(colors(base).has(DEFAULT_AVATAR.hairColor)).toBe(true)
    expect(colors(avatarPixels({ ...DEFAULT_AVATAR, hairStyle: 'bald' }, 'down')).has(DEFAULT_AVATAR.hairColor)).toBe(false)
    // De espaldas no se ven los ojos; al caminar cambian las piernas.
    expect(avatarPixels(DEFAULT_AVATAR, 'up')).not.toEqual(base)
    expect(avatarPixels(DEFAULT_AVATAR, 'down', 1)).not.toEqual(base)
    expect(avatarPixels(DEFAULT_AVATAR, 'down', 1)).not.toEqual(avatarPixels(DEFAULT_AVATAR, 'down', 2))
  })

  it('Bit parpadea entre cuadros', () => {
    expect(bitPixels(0)).toHaveLength(12)
    expect(bitPixels(0)).not.toEqual(bitPixels(1))
  })
})

const kpis = (overrides: Partial<SalesKpis['totals']> = {}, receivables: Partial<SalesKpis['receivables']> = {}): SalesKpis => ({
  from: '2026-11-01',
  to: '2026-11-27',
  totals: {
    collected: 0, reimbursed: 0, net_collected: 0, net_revenue: 0, tax_collected: 0, cogs: 0,
    purchases_paid: 0, paying_orders: 0, units_sold: 0, gross_margin: 0, margin_percent: 0,
    net_cash_flow: 0, average_ticket: 0, currency: 'MXN', ...overrides
  },
  by_channel: [
    { channel: 'storefront', net_collected: 500, net_revenue: 430, cogs: 0, orders: 2 },
    { channel: 'pos', net_collected: 300, net_revenue: 260, cogs: 0, orders: 3 }
  ],
  monthly: [],
  by_payment_method: [],
  top_products: [],
  by_campaign: [],
  receivables: { total: 0, count: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, ...receivables },
  payables: { total: 0, count: 0 },
  pending_deliveries: { orders: 0, units: 0, value: 0 },
  refunds: { count: 0, total: 0, reimbursed: 0 },
  orders_confirmed: { count: 4, total: 9000, untaxed: 7758 }
})

const snapshot = (attention: Partial<DashboardSnapshot['attention']> = {}): DashboardSnapshot => ({
  company_currency: 'MXN',
  currencies: ['MXN'],
  counts: { active_partners: 10, active_products: 20, active_projects: 2, average_project_progress: 40 },
  drafts: [],
  posted_daily: [],
  attention: {
    overdue_tasks: 0, oldest_overdue_task: null, pending_approvals: 0, crm_overdue_activities: 0,
    crm_leads_with_overdue: 0, crm_rotting_leads: 0, open_pickings: 0, ...attention
  },
  crm: {
    created: 3, won: 1, lost: 0, open_count: 5,
    by_currency: [
      { currency: 'MXN', won_amount: 1000, open_amount: 8000, weighted_amount: 2500 },
      { currency: 'USD', won_amount: 0, open_amount: 900, weighted_amount: 450 }
    ]
  },
  recent: { orders: [], pickings: [], approvals: [], projects: [], tasks: [], leads: [], partners: [] },
  public_projects: []
})

describe('marcadores', () => {
  it('sin datos muestra todos los marcadores vacíos', () => {
    const markers = buildScoreboard(emptyWorldData())
    expect(markers.map(m => m.key)).toEqual(['collected', 'expenses', 'profit', 'forecast', 'receivable', 'lowStock', 'pending'])
    expect(markers.every(m => m.value === null && m.trend === null)).toBe(true)
  })

  it('calcula cobrado, gastos, utilidad, previsto y pendientes', () => {
    const data = {
      ...emptyWorldData('MXN'),
      kpis: kpis({ net_collected: 10_000, purchases_paid: 3_000 }, { total: 4_000, d1_30: 500, d90_plus: 250 }),
      previousKpis: kpis({ net_collected: 8_000, purchases_paid: 1_000 }),
      expensesPaid: 2_000,
      previousExpensesPaid: 1_500,
      snapshot: snapshot({ overdue_tasks: 2, pending_approvals: 1, crm_overdue_activities: 3, open_pickings: 9 }),
      lowStock: 5
    }
    const by = Object.fromEntries(buildScoreboard(data).map(m => [m.key, m]))

    expect(by.collected).toMatchObject({ value: 10_000, trend: 'up', trendIsGood: true })
    // Gastos = compras pagadas + gastos de operación; que suban es malo.
    expect(by.expenses).toMatchObject({ value: 5_000, trend: 'up', trendIsGood: false })
    // 10 000 − 5 000 = 5 000 contra 8 000 − 2 500 = 5 500.
    expect(by.profit).toMatchObject({ value: 5_000, trend: 'down', trendIsGood: false })
    // Por cobrar 4 000 + embudo ponderado en MXN 2 500 (el de USD no se mezcla).
    expect(by.forecast?.value).toBe(6_500)
    expect(by.receivable?.value).toBe(4_000)
    expect(by.lowStock?.value).toBe(5)
    // Los movimientos abiertos no cuentan como pendientes.
    expect(by.pending?.value).toBe(6)

    expect(totalOutflow(data.kpis, null)).toBe(3_000)
    expect(overdueReceivables(data.kpis)).toBe(750)
    expect(weightedPipeline(data.snapshot, 'usd')).toBe(450)
    expect(weightedPipeline(data.snapshot, 'EUR')).toBe(0)
    expect(pendingCount(null)).toBeNull()
  })

  it('una cifra igual a la anterior no marca tendencia buena ni mala', () => {
    const data = { ...emptyWorldData(), kpis: kpis({ net_collected: 100 }), previousKpis: kpis({ net_collected: 100 }), expensesPaid: 0, previousExpensesPaid: 0 }
    expect(buildScoreboard(data)[0]).toMatchObject({ trend: 'flat', trendIsGood: null })
  })

  it('abrevia montos grandes', () => {
    expect(formatCompactMoney(45_300, 'MXN')).toBe('$45.3 k')
    expect(formatCompactMoney(1_250_000, 'MXN')).toBe('$1.3 M')
    expect(formatCompactMoney(-250_000, 'MXN')).toBe('-$250 k')
    expect(formatCompactMoney(980, 'MXN')).toContain('980')
  })
})

describe('resumen por ubicación', () => {
  it('toda ubicación devuelve un mensaje de Bit aun sin datos', () => {
    for (const location of VALLE_LOCATIONS) {
      const summary = buildLocationSummary(location.id, emptyWorldData())
      expect(summary.liveLine.length).toBeGreaterThan(5)
      expect(summary.stats).toEqual([])
    }
  })

  it('el Banco avisa de pérdida y cartera vencida', () => {
    const data = {
      ...emptyWorldData('MXN'),
      kpis: kpis({ net_collected: 1_000, purchases_paid: 3_000 }, { total: 900, d31_60: 400 }),
      expensesPaid: 500
    }
    const summary = buildLocationSummary('banco', data)
    expect(summary.liveLine).toContain('más de lo que entró')
    expect(summary.liveLine).toContain('cartera vencida')
    expect(summary.stats.find(s => s.label === 'Utilidad del mes')?.tone).toBe('bad')
  })

  it('la Tienda suma los canales en línea y POS', () => {
    const summary = buildLocationSummary('tienda', { ...emptyWorldData(), kpis: kpis() })
    expect(summary.liveLine).toContain('5 ventas')
  })

  it('el Tablón cuenta misiones y atrasos', () => {
    const data = {
      ...emptyWorldData(),
      agenda: [
        { id: '1', kind: 'task' as const, title: 'Cotizar', subtitle: 'Proyecto A', route: '/admin/tasks/1', overdue: true },
        { id: '2', kind: 'approval' as const, title: 'Viáticos', subtitle: 'Aprobación por decidir', route: '/admin/approval-requests/2', overdue: false }
      ]
    }
    const summary = buildLocationSummary('tablon', data)
    expect(summary.liveLine).toContain('2 misiones')
    expect(summary.liveLine).toContain('1 está atrasada')
    expect(summary.items).toHaveLength(2)
    expect(buildLocationSummary('tablon', { ...emptyWorldData(), agenda: [] }).liveLine).toContain('Todo al día')
  })

  it('el Gremio agrupa por departamento', () => {
    const summary = buildLocationSummary('gremio', {
      ...emptyWorldData(),
      departments: [{ name: 'Ventas', members: ['Ana', 'Luis'] }, { name: 'Sin departamento', members: ['Eva'] }]
    })
    expect(summary.liveLine).toContain('3 personas')
    expect(summary.items[0]).toMatchObject({ title: 'Ventas', subtitle: 'Ana, Luis', flag: '2 personas' })
  })
})
