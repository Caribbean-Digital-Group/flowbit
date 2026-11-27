// Dibujo de Valle Bit sobre Canvas 2D. Solo corre en el navegador.
// Todo el arte se genera aquí con rectángulos: no hay imágenes externas.
import type { AvatarConfig, SpritePixels } from './avatar'
import { WALK_FRAMES, avatarPixels, bitPixels } from './avatar'
import type { Direction, ValleLocation, WorldMap } from './types'
import { TILE } from './types'
import { tileNoise } from './map'

type Ctx = CanvasRenderingContext2D

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/** Convierte una matriz de píxeles en un canvas reutilizable. */
export const spriteToCanvas = (pixels: SpritePixels): HTMLCanvasElement => {
  const height = pixels.length
  const width = pixels[0]?.length ?? 0
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  pixels.forEach((row, y) => row.forEach((color, x) => {
    if (!color) return
    ctx.fillStyle = color
    ctx.fillRect(x, y, 1, 1)
  }))
  return canvas
}

export type AvatarSprites = Record<Direction, HTMLCanvasElement[]>

const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right']

/** Todos los cuadros del avatar, listos para `drawImage`. Se regenera al cambiar el avatar. */
export const buildAvatarSprites = (config: AvatarConfig): AvatarSprites => {
  const sprites = {} as AvatarSprites
  for (const direction of DIRECTIONS) {
    sprites[direction] = Array.from({ length: WALK_FRAMES }, (_, frame) =>
      spriteToCanvas(avatarPixels(config, direction, frame)))
  }
  return sprites
}

export const buildBitSprites = (): HTMLCanvasElement[] => [spriteToCanvas(bitPixels(0)), spriteToCanvas(bitPixels(1))]

const drawGrass = (ctx: Ctx, px: number, py: number, x: number, y: number) => {
  ctx.fillStyle = (x + y) % 2 === 0 ? '#86c96a' : '#80c264'
  ctx.fillRect(px, py, TILE, TILE)
  ctx.fillStyle = '#6fb155'
  const n = tileNoise(x + 50, y + 50)
  ctx.fillRect(px + Math.floor(n * 12) + 1, py + Math.floor(tileNoise(y, x) * 12) + 1, 2, 1)
  ctx.fillRect(px + Math.floor(tileNoise(x, y + 9) * 12) + 1, py + Math.floor(n * 11) + 2, 1, 2)
}

const drawTile = (ctx: Ctx, map: WorldMap, x: number, y: number) => {
  const kind = map.tiles[y]?.[x]
  const px = x * TILE
  const py = y * TILE

  if (kind === 'path') {
    ctx.fillStyle = '#e7d3a1'
    ctx.fillRect(px, py, TILE, TILE)
    ctx.fillStyle = '#d6bf87'
    ctx.fillRect(px + Math.floor(tileNoise(x, y) * 13), py + Math.floor(tileNoise(y, x) * 13), 2, 2)
    return
  }
  if (kind === 'water') {
    ctx.fillStyle = '#4aa8e0'
    ctx.fillRect(px, py, TILE, TILE)
    ctx.fillStyle = '#8fd0f5'
    ctx.fillRect(px + 2, py + 4 + Math.floor(tileNoise(x, y) * 6), 5, 1)
    ctx.fillRect(px + 9, py + 2 + Math.floor(tileNoise(y, x) * 9), 4, 1)
    return
  }

  drawGrass(ctx, px, py, x, y)

  if (kind === 'flowers') {
    const colors = ['#f472b6', '#facc15', '#ffffff', '#c084fc']
    for (let i = 0; i < 3; i++) {
      const fx = px + 2 + Math.floor(tileNoise(x + i * 7, y) * 11)
      const fy = py + 2 + Math.floor(tileNoise(x, y + i * 5) * 11)
      ctx.fillStyle = colors[(x + y + i) % colors.length] as string
      ctx.fillRect(fx, fy, 2, 2)
    }
  }
  if (kind === 'tree') {
    ctx.fillStyle = '#7c4a1e'
    ctx.fillRect(px + 6, py + 10, 4, 6)
    ctx.fillStyle = '#2f7d3a'
    ctx.fillRect(px + 2, py + 2, 12, 9)
    ctx.fillRect(px + 4, py, 8, 13)
    ctx.fillStyle = '#3f9b4b'
    ctx.fillRect(px + 4, py + 2, 5, 4)
  }
}

const shade = (hex: string, amount: number): string => {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.min(255, Math.max(0, ((value >> shift) & 255) + amount))
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

const drawBuilding = (ctx: Ctx, location: ValleLocation) => {
  const x = location.rect.x * TILE
  const y = location.rect.y * TILE
  const w = location.rect.w * TILE
  const h = location.rect.h * TILE
  const roofH = Math.floor(h * 0.45)

  // Muros.
  ctx.fillStyle = location.wallColor
  ctx.fillRect(x + 2, y + roofH, w - 4, h - roofH)
  ctx.fillStyle = shade(location.wallColor, -28)
  ctx.fillRect(x + 2, y + h - 3, w - 4, 3)

  // Techo con tejas.
  ctx.fillStyle = location.roofColor
  ctx.fillRect(x, y + 4, w, roofH)
  ctx.fillRect(x + 4, y, w - 8, 4)
  ctx.fillStyle = shade(location.roofColor, -30)
  for (let ty = y + 8; ty < y + roofH + 2; ty += 6) ctx.fillRect(x, ty, w, 1)
  ctx.fillRect(x, y + roofH + 3, w, 2)
  ctx.fillStyle = shade(location.roofColor, 40)
  ctx.fillRect(x + 4, y, w - 8, 1)

  // Puerta (dos tiles de ancho, centrada).
  const doorW = 14
  const doorX = x + w / 2 - doorW / 2
  ctx.fillStyle = '#7c4a1e'
  ctx.fillRect(doorX, y + h - 18, doorW, 18)
  ctx.fillStyle = '#5b3413'
  ctx.fillRect(doorX + doorW / 2 - 0.5, y + h - 18, 1, 18)
  ctx.fillStyle = '#facc15'
  ctx.fillRect(doorX + doorW - 4, y + h - 9, 2, 2)

  // Ventanas.
  for (const wx of [x + 10, x + w - 22]) {
    ctx.fillStyle = '#475569'
    ctx.fillRect(wx - 1, y + roofH + 8, 14, 12)
    ctx.fillStyle = '#bae6fd'
    ctx.fillRect(wx, y + roofH + 9, 12, 10)
    ctx.fillStyle = '#475569'
    ctx.fillRect(wx + 5.5, y + roofH + 9, 1, 10)
  }
}

const drawFountain = (ctx: Ctx, location: ValleLocation) => {
  const x = location.rect.x * TILE
  const y = location.rect.y * TILE
  const w = location.rect.w * TILE
  const h = location.rect.h * TILE
  ctx.fillStyle = '#94a3b8'
  ctx.fillRect(x + 2, y + 6, w - 4, h - 8)
  ctx.fillRect(x + 6, y + 2, w - 12, h)
  ctx.fillStyle = '#4aa8e0'
  ctx.fillRect(x + 6, y + 9, w - 12, h - 15)
  ctx.fillStyle = '#cbd5e1'
  ctx.fillRect(x + w / 2 - 3, y + 6, 6, h - 16)
  ctx.fillStyle = '#8fd0f5'
  ctx.fillRect(x + w / 2 - 6, y + 4, 12, 3)
  ctx.fillRect(x + 10, y + 14, 6, 1)
  ctx.fillRect(x + w - 18, y + h - 14, 6, 1)
}

const drawBoard = (ctx: Ctx, location: ValleLocation) => {
  const x = location.rect.x * TILE
  const y = location.rect.y * TILE
  const w = location.rect.w * TILE
  const h = location.rect.h * TILE
  ctx.fillStyle = '#7c4a1e'
  ctx.fillRect(x + 6, y + 6, 4, h - 6)
  ctx.fillRect(x + w - 10, y + 6, 4, h - 6)
  ctx.fillStyle = '#92400e'
  ctx.fillRect(x + 2, y, w - 4, h - 10)
  ctx.fillStyle = '#b45309'
  ctx.fillRect(x + 4, y + 2, w - 8, h - 14)
  const notes = ['#fef9c3', '#ffffff', '#fbcfe8', '#bae6fd']
  notes.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(x + 8 + i * 13, y + 4 + (i % 2) * 3, 9, 9)
    ctx.fillStyle = '#dc2626'
    ctx.fillRect(x + 12 + i * 13, y + 4 + (i % 2) * 3, 1, 1)
  })
}

/** Dibuja el mapa completo una sola vez; cada cuadro solo copia la parte visible. */
export const renderMapLayer = (map: WorldMap, locations: ValleLocation[]): HTMLCanvasElement => {
  const canvas = createCanvas(map.width * TILE, map.height * TILE)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) drawTile(ctx, map, x, y)
  }
  for (const location of locations) {
    // La huella es sólida; debajo va pasto para que las esquinas no queden vacías.
    for (let y = location.rect.y; y < location.rect.y + location.rect.h; y++) {
      for (let x = location.rect.x; x < location.rect.x + location.rect.w; x++) {
        drawGrass(ctx, x * TILE, y * TILE, x, y)
      }
    }
    if (location.shape === 'fountain') drawFountain(ctx, location)
    else if (location.shape === 'board') drawBoard(ctx, location)
    else drawBuilding(ctx, location)
  }
  return canvas
}
