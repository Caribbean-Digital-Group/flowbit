// Mapa de Valle Bit: construcción, colisiones, rutas y cámara.
// Funciones puras, probadas en `tests/utils/valle.test.ts`.
import type { LocationId, Point, TileKind, ValleLocation, WorldMap } from './types'
import { TILE } from './types'
import { MAP_HEIGHT, MAP_WIDTH, ROAD_COLS, ROAD_ROWS, VALLE_LOCATIONS } from './locations'

/** Ruido determinista por tile: el mapa se ve igual en cada visita. */
export const tileNoise = (x: number, y: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

export const buildWorldMap = (locations: ValleLocation[] = VALLE_LOCATIONS): WorldMap => {
  const tiles: TileKind[][] = []
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: TileKind[] = []
    for (let x = 0; x < MAP_WIDTH; x++) {
      const border = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1
      const noise = tileNoise(x, y)
      row.push(border ? 'tree' : noise > 0.93 ? 'tree' : noise > 0.86 ? 'flowers' : 'grass')
    }
    tiles.push(row)
  }

  const set = (x: number, y: number, kind: TileKind) => {
    const row = tiles[y]
    if (row && x >= 0 && x < MAP_WIDTH) row[x] = kind
  }

  // Estanque decorativo en la esquina inferior.
  for (let y = 30; y <= 31; y++) for (let x = 3; x <= 8; x++) set(x, y, 'water')

  for (const roadY of ROAD_ROWS) {
    for (let x = 2; x < MAP_WIDTH - 2; x++) { set(x, roadY, 'path'); set(x, roadY + 1, 'path') }
  }
  const firstRoad = ROAD_ROWS[0] ?? 0
  const lastRoad = (ROAD_ROWS[ROAD_ROWS.length - 1] ?? 0) + 1
  for (const roadX of ROAD_COLS) {
    for (let y = firstRoad; y <= lastRoad; y++) { set(roadX, y, 'path'); set(roadX + 1, y, 'path') }
  }

  for (const location of locations) {
    const { rect, entrance } = location
    // Despeja el hueco completo para que ningún árbol tape la fachada.
    for (let y = entrance.y - 4; y < entrance.y; y++) {
      for (let x = entrance.x - 3; x < entrance.x + 3; x++) set(x, y, 'grass')
    }
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) set(x, y, 'solid')
    }
    set(entrance.x - 1, entrance.y, 'path')
    set(entrance.x, entrance.y, 'path')
  }

  return { width: MAP_WIDTH, height: MAP_HEIGHT, tiles }
}

export const tileAt = (map: WorldMap, x: number, y: number): TileKind | null =>
  map.tiles[y]?.[x] ?? null

export const isWalkableTile = (map: WorldMap, x: number, y: number): boolean => {
  const kind = tileAt(map, x, y)
  return kind === 'grass' || kind === 'flowers' || kind === 'path'
}

export const tileOfPixel = (px: number, py: number): Point => ({
  x: Math.floor(px / TILE),
  y: Math.floor(py / TILE)
})

export const tileCenter = (tile: Point): Point => ({
  x: tile.x * TILE + TILE / 2,
  y: tile.y * TILE + TILE / 2
})

/** Mitad del ancho y del alto de la huella de colisión (los pies del avatar). */
export const FOOT_HALF_W = 4
export const FOOT_HALF_H = 3

/** ¿Cabe la huella del avatar centrada en (px, py)? */
export const canStandAt = (map: WorldMap, px: number, py: number): boolean => {
  const corners: Point[] = [
    { x: px - FOOT_HALF_W, y: py - FOOT_HALF_H },
    { x: px + FOOT_HALF_W, y: py - FOOT_HALF_H },
    { x: px - FOOT_HALF_W, y: py + FOOT_HALF_H },
    { x: px + FOOT_HALF_W, y: py + FOOT_HALF_H }
  ]
  return corners.every(corner => {
    const tile = tileOfPixel(corner.x, corner.y)
    return isWalkableTile(map, tile.x, tile.y)
  })
}

/**
 * Mueve la posición por ejes separados: si un eje choca, el otro sigue,
 * así el avatar se desliza por las paredes en lugar de atorarse.
 */
export const moveWithCollision = (map: WorldMap, from: Point, dx: number, dy: number): Point => {
  let { x, y } = from
  if (dx !== 0 && canStandAt(map, x + dx, y)) x += dx
  if (dy !== 0 && canStandAt(map, x, y + dy)) y += dy
  return { x, y }
}

const NEIGHBORS: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]

/**
 * Ruta más corta entre dos tiles (BFS en 4 direcciones; el mapa es pequeño).
 * Devuelve los tiles a recorrer sin incluir el de inicio, o `[]` si no hay camino.
 */
export const findPath = (map: WorldMap, from: Point, to: Point): Point[] => {
  if (!isWalkableTile(map, to.x, to.y) || !isWalkableTile(map, from.x, from.y)) return []
  if (from.x === to.x && from.y === to.y) return []

  const key = (p: Point) => p.y * map.width + p.x
  const previous = new Map<number, number>()
  const start = key(from)
  const goal = key(to)
  const queue: number[] = [start]
  previous.set(start, -1)

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i] as number
    if (current === goal) break
    const cx = current % map.width
    const cy = Math.floor(current / map.width)
    for (const step of NEIGHBORS) {
      const nx = cx + step.x
      const ny = cy + step.y
      if (!isWalkableTile(map, nx, ny)) continue
      const next = ny * map.width + nx
      if (previous.has(next)) continue
      previous.set(next, current)
      queue.push(next)
    }
  }

  if (!previous.has(goal)) return []
  const path: Point[] = []
  for (let node = goal; node !== start; node = previous.get(node) as number) {
    path.push({ x: node % map.width, y: Math.floor(node / map.width) })
  }
  return path.reverse()
}

/** Ubicación cuya huella contiene el tile, si la hay. */
export const locationAtTile = (tile: Point, locations: ValleLocation[] = VALLE_LOCATIONS): ValleLocation | null =>
  locations.find(({ rect }) =>
    tile.x >= rect.x && tile.x < rect.x + rect.w && tile.y >= rect.y && tile.y < rect.y + rect.h
  ) ?? null

/** Distancia (en tiles) a la que una entrada cuenta como «estás aquí». */
export const NEAR_RADIUS = 1.6

/** Ubicación más cercana cuya entrada está al alcance del avatar. */
export const nearbyLocation = (
  position: Point,
  locations: ValleLocation[] = VALLE_LOCATIONS
): LocationId | null => {
  let best: LocationId | null = null
  let bestDistance = NEAR_RADIUS * TILE
  for (const location of locations) {
    const center = tileCenter(location.entrance)
    // La entrada mide dos tiles de ancho: se mide desde su borde compartido.
    const distance = Math.hypot(position.x - (center.x - TILE / 2), position.y - center.y)
    if (distance <= bestDistance) {
      best = location.id
      bestDistance = distance
    }
  }
  return best
}

/**
 * Esquina superior izquierda de la cámara (en píxeles lógicos), centrada en el
 * objetivo y sin salirse del mapa. Si la vista es más grande que el mapa, lo centra.
 */
export const cameraFor = (target: Point, viewW: number, viewH: number, map: WorldMap): Point => {
  const worldW = map.width * TILE
  const worldH = map.height * TILE
  const clampAxis = (center: number, view: number, world: number): number =>
    view >= world ? (world - view) / 2 : Math.min(Math.max(center - view / 2, 0), world - view)
  return { x: clampAxis(target.x, viewW, worldW), y: clampAxis(target.y, viewH, worldH) }
}

/** Escala entera para que el pixel art se vea nítido en cualquier pantalla. */
export const pixelScaleFor = (viewW: number, viewH: number): number =>
  Math.min(5, Math.max(2, Math.floor(Math.min(viewW, viewH) / (TILE * 11))))
