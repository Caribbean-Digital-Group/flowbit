// Tipos del mundo de Valle Bit. Sin Vue ni Supabase.

/** Lado de un tile en píxeles lógicos. */
export const TILE = 16

export type TileKind = 'grass' | 'flowers' | 'path' | 'tree' | 'water' | 'solid'

export type Direction = 'down' | 'up' | 'left' | 'right'

export interface Point {
  x: number
  y: number
}

/** Rectángulo en tiles. */
export interface TileRect {
  x: number
  y: number
  w: number
  h: number
}

export type LocationId =
  | 'plaza'
  | 'mercado'
  | 'banco'
  | 'almacen'
  | 'oficina'
  | 'taller'
  | 'ayuntamiento'
  | 'gremio'
  | 'tesoreria'
  | 'tienda'
  | 'tablon'
  | 'casa'

/** Cómo se dibuja la ubicación en el mapa. */
export type LocationShape = 'building' | 'fountain' | 'board'

export interface ValleLocation {
  id: LocationId
  /** Nombre del lugar en el valle. */
  name: string
  /** Módulo del ERP que representa. */
  moduleLabel: string
  emoji: string
  shape: LocationShape
  /** Huella sólida en el mapa. */
  rect: TileRect
  /** Tile caminable frente a la entrada. */
  entrance: Point
  roofColor: string
  wallColor: string
  /** Ruta del módulo en el panel: destino de «Abrir en el panel» y contexto de Bit. */
  adminRoute: string
  /** Accesos secundarios dentro del panel. */
  links: { label: string; route: string }[]
  /** Lo que dice Bit al llegar: qué es este lugar. */
  welcome: string
}

export interface WorldMap {
  width: number
  height: number
  /** Fila por fila: `tiles[y][x]`. */
  tiles: TileKind[][]
}
