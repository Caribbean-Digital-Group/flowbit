// Avatar de Valle Bit: opciones del editor y sprite pixel art generado por código.
// Funciones puras, probadas en `tests/utils/valle.test.ts`.
import type { Direction } from './types'

export type HairStyle = 'short' | 'long' | 'spiky' | 'bun' | 'bald'
export type Accessory = 'none' | 'glasses' | 'hat' | 'scarf'

export interface AvatarConfig {
  skin: string
  hairStyle: HairStyle
  hairColor: string
  outfit: string
  accessory: Accessory
}

export interface AvatarOption<T extends string> {
  value: T
  label: string
}

export const SKIN_TONES: AvatarOption<string>[] = [
  { value: '#fde0c8', label: 'Muy claro' },
  { value: '#f5c9a3', label: 'Claro' },
  { value: '#e0a878', label: 'Medio' },
  { value: '#b97a4f', label: 'Moreno' },
  { value: '#8a5632', label: 'Oscuro' },
  { value: '#5c3a21', label: 'Muy oscuro' }
]

export const HAIR_STYLES: AvatarOption<HairStyle>[] = [
  { value: 'short', label: 'Corto' },
  { value: 'long', label: 'Largo' },
  { value: 'spiky', label: 'En picos' },
  { value: 'bun', label: 'Chongo' },
  { value: 'bald', label: 'Sin cabello' }
]

export const HAIR_COLORS: AvatarOption<string>[] = [
  { value: '#1f2937', label: 'Negro' },
  { value: '#5b3a1e', label: 'Castaño' },
  { value: '#a16207', label: 'Castaño claro' },
  { value: '#eab308', label: 'Rubio' },
  { value: '#b91c1c', label: 'Pelirrojo' },
  { value: '#9ca3af', label: 'Canoso' },
  { value: '#7c3aed', label: 'Violeta' },
  { value: '#0d9488', label: 'Turquesa' }
]

export const OUTFIT_COLORS: AvatarOption<string>[] = [
  { value: '#4f46e5', label: 'Índigo' },
  { value: '#7c3aed', label: 'Violeta' },
  { value: '#c026d3', label: 'Fucsia' },
  { value: '#dc2626', label: 'Rojo' },
  { value: '#ea580c', label: 'Naranja' },
  { value: '#16a34a', label: 'Verde' },
  { value: '#0284c7', label: 'Azul' },
  { value: '#475569', label: 'Gris' }
]

export const ACCESSORIES: AvatarOption<Accessory>[] = [
  { value: 'none', label: 'Ninguno' },
  { value: 'glasses', label: 'Lentes' },
  { value: 'hat', label: 'Sombrero' },
  { value: 'scarf', label: 'Bufanda' }
]

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#e0a878',
  hairStyle: 'short',
  hairColor: '#5b3a1e',
  outfit: '#4f46e5',
  accessory: 'none'
}

const pick = <T extends string>(options: AvatarOption<T>[], value: unknown, fallback: T): T =>
  options.some(option => option.value === value) ? (value as T) : fallback

/**
 * Convierte cualquier valor guardado en un avatar válido.
 * Solo se aceptan valores del catálogo: lo guardado llega al canvas como color.
 */
export const normalizeAvatar = (value: unknown): AvatarConfig => {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    skin: pick(SKIN_TONES, raw.skin, DEFAULT_AVATAR.skin),
    hairStyle: pick(HAIR_STYLES, raw.hairStyle, DEFAULT_AVATAR.hairStyle),
    hairColor: pick(HAIR_COLORS, raw.hairColor, DEFAULT_AVATAR.hairColor),
    outfit: pick(OUTFIT_COLORS, raw.outfit, DEFAULT_AVATAR.outfit),
    accessory: pick(ACCESSORIES, raw.accessory, DEFAULT_AVATAR.accessory)
  }
}

const randomOf = <T extends string>(options: AvatarOption<T>[], random: () => number): T =>
  (options[Math.floor(random() * options.length)] ?? options[0] as AvatarOption<T>).value

export const randomAvatar = (random: () => number = Math.random): AvatarConfig => ({
  skin: randomOf(SKIN_TONES, random),
  hairStyle: randomOf(HAIR_STYLES, random),
  hairColor: randomOf(HAIR_COLORS, random),
  outfit: randomOf(OUTFIT_COLORS, random),
  accessory: randomOf(ACCESSORIES, random)
})

export const SPRITE_SIZE = 16
/** Cuadros de la animación al caminar; el 0 es la pose en reposo. */
export const WALK_FRAMES = 3

export type SpritePixels = (string | null)[][]

const INK = '#1e293b'
const PANTS = '#334155'
const SHOES = '#0f172a'
const SCARF = '#ef4444'
const HAT = '#92400e'

const emptySprite = (): SpritePixels =>
  Array.from({ length: SPRITE_SIZE }, () => Array<string | null>(SPRITE_SIZE).fill(null))

/** Sprite de 16×16 del avatar para una dirección y un cuadro de caminata. */
export const avatarPixels = (config: AvatarConfig, direction: Direction, frame = 0): SpritePixels => {
  const grid = emptySprite()
  const put = (x: number, y: number, color: string) => {
    const row = grid[y]
    if (row && x >= 0 && x < SPRITE_SIZE) row[x] = color
  }
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, color)
  }
  const { skin, hairStyle, hairColor, outfit, accessory } = config
  const side = direction === 'left' || direction === 'right'

  // Piernas: los cuadros 1 y 2 levantan un pie cada uno.
  const leftLeg = frame === 1 ? 2 : 3
  const rightLeg = frame === 2 ? 2 : 3
  rect(5, 13, 2, leftLeg, PANTS)
  rect(9, 13, 2, rightLeg, PANTS)
  rect(5, 12 + leftLeg, 2, 1, SHOES)
  rect(9, 12 + rightLeg, 2, 1, SHOES)

  // Torso y brazos.
  rect(4, 8, 8, 5, outfit)
  if (side) {
    rect(7, 9, 2, 3, outfit)
    put(7, 12, skin); put(8, 12, skin)
  } else {
    rect(3, 8, 1, 4, outfit)
    rect(12, 8, 1, 4, outfit)
    put(3, 12, skin); put(12, 12, skin)
  }

  // Cabeza.
  rect(5, 2, 6, 6, skin)

  if (hairStyle !== 'bald') {
    rect(5, 1, 6, 2, hairColor)
    rect(4, 2, 1, 3, hairColor)
    rect(11, 2, 1, 3, hairColor)
    if (hairStyle === 'long') { rect(4, 2, 1, 7, hairColor); rect(11, 2, 1, 7, hairColor) }
    if (hairStyle === 'spiky') { put(5, 0, hairColor); put(7, 0, hairColor); put(9, 0, hairColor); put(10, 0, hairColor) }
    if (hairStyle === 'bun') rect(7, 0, 2, 1, hairColor)
    if (direction === 'up') rect(5, 2, 6, hairStyle === 'long' ? 6 : 4, hairColor)
    if (direction === 'left') rect(8, 2, 3, 4, hairColor)
    if (direction === 'right') rect(5, 2, 3, 4, hairColor)
  }

  // Cara: de espaldas no se ve.
  if (direction === 'down') { put(6, 5, INK); put(9, 5, INK) }
  if (direction === 'left') put(6, 5, INK)
  if (direction === 'right') put(9, 5, INK)

  if (accessory === 'glasses' && direction !== 'up') {
    if (direction === 'down') rect(5, 5, 6, 1, INK)
    if (direction === 'left') rect(5, 5, 3, 1, INK)
    if (direction === 'right') rect(8, 5, 3, 1, INK)
  }
  if (accessory === 'hat') {
    rect(5, 0, 6, 2, HAT)
    rect(3, 2, 10, 1, HAT)
  }
  if (accessory === 'scarf') rect(4, 8, 8, 1, SCARF)

  return grid
}

/** Sprite de 12×12 de Bit, el robot guía. El cuadro alterna el parpadeo de la antena. */
export const bitPixels = (frame = 0): SpritePixels => {
  const size = 12
  const grid: SpritePixels = Array.from({ length: size }, () => Array<string | null>(size).fill(null))
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let j = y; j < y + h; j++) {
      const row = grid[j]
      if (!row) continue
      for (let i = x; i < x + w; i++) if (i >= 0 && i < size) row[i] = color
    }
  }
  rect(5, 0, 2, 1, frame % 2 === 0 ? '#f0abfc' : '#fde047')
  rect(5, 1, 2, 2, '#6d28d9')
  rect(2, 3, 8, 6, '#7c3aed')
  rect(1, 4, 1, 4, '#6d28d9')
  rect(10, 4, 1, 4, '#6d28d9')
  rect(3, 4, 6, 3, '#1e1b4b')
  rect(4, 5, 1, 1, '#67e8f9')
  rect(7, 5, 1, 1, '#67e8f9')
  rect(3, 9, 2, 2, '#4c1d95')
  rect(7, 9, 2, 2, '#4c1d95')
  return grid
}
