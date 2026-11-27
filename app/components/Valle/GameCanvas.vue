<script setup lang="ts">
import type { AvatarConfig } from '~/utils/valle/avatar'
import type { AvatarSprites } from '~/utils/valle/render'
import { buildAvatarSprites, buildBitSprites, renderMapLayer } from '~/utils/valle/render'
import type { Direction, LocationId, Point } from '~/utils/valle/types'
import { TILE } from '~/utils/valle/types'
import { SPAWN_TILE, VALLE_LOCATIONS, getValleLocation } from '~/utils/valle/locations'
import {
  buildWorldMap,
  cameraFor,
  findPath,
  isWalkableTile,
  locationAtTile,
  moveWithCollision,
  nearbyLocation,
  pixelScaleFor,
  tileCenter,
  tileOfPixel
} from '~/utils/valle/map'

/**
 * Mundo recorrible de Valle Bit. Motor propio sobre Canvas 2D:
 * el mapa se dibuja una vez y cada cuadro copia la parte visible.
 */
interface Props {
  avatar: AvatarConfig
  /** Congela el movimiento mientras hay un panel abierto. */
  paused?: boolean
}

const props = withDefaults(defineProps<Props>(), { paused: false })

const emit = defineEmits<{
  near: [id: LocationId | null]
  enter: [id: LocationId]
}>()

/** Píxeles lógicos por segundo: unos 4.5 tiles. */
const SPEED = 72
const MAX_DPR = 3

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const map = buildWorldMap()
const spawn = tileCenter(SPAWN_TILE)

const player = { x: spawn.x, y: spawn.y, direction: 'down' as Direction, moving: false, walkTime: 0 }
const bit = { x: spawn.x - 14, y: spawn.y - 4 }
const keys = new Set<string>()
const joystick = { x: 0, y: 0 }

let mapLayer: HTMLCanvasElement | null = null
let avatarSprites: AvatarSprites | null = null
let bitSprites: HTMLCanvasElement[] = []
let path: Point[] = []
let enterOnArrival: LocationId | null = null
let nearId: LocationId | null = null
let frameId = 0
let lastTime = 0
let clock = 0
let viewW = 0
let viewH = 0
let dpr = 1
let scale = 3
let resizeObserver: ResizeObserver | null = null

const KEY_VECTORS: Record<string, Point> = {
  arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 }
}

const resize = () => {
  const container = containerRef.value
  const canvas = canvasRef.value
  if (!container || !canvas) return
  const rect = container.getBoundingClientRect()
  viewW = Math.max(1, rect.width)
  viewH = Math.max(1, rect.height)
  dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  scale = pixelScaleFor(viewW, viewH)
  canvas.width = Math.round(viewW * dpr)
  canvas.height = Math.round(viewH * dpr)
}

const inputVector = (): Point => {
  let x = joystick.x
  let y = joystick.y
  for (const key of keys) {
    const vector = KEY_VECTORS[key]
    if (vector) { x += vector.x; y += vector.y }
  }
  const length = Math.hypot(x, y)
  return length > 1 ? { x: x / length, y: y / length } : { x, y }
}

const setNear = (id: LocationId | null) => {
  if (id === nearId) return
  nearId = id
  emit('near', id)
}

const update = (dt: number) => {
  clock += dt
  let vector = props.paused ? { x: 0, y: 0 } : inputVector()
  const manual = Math.hypot(vector.x, vector.y) > 0.15
  // Al llegar justo al centro de un tile no hay vector ese cuadro, pero el avatar sigue caminando.
  let snapped = false

  if (manual) {
    path = []
    enterOnArrival = null
  } else if (!props.paused && path.length) {
    const target = tileCenter(path[0] as Point)
    const dx = target.x - player.x
    const dy = target.y - player.y
    const distance = Math.hypot(dx, dy)
    if (distance <= SPEED * dt) {
      player.x = target.x
      player.y = target.y
      path.shift()
      if (!path.length && enterOnArrival) {
        const id = enterOnArrival
        enterOnArrival = null
        emit('enter', id)
      }
      vector = { x: 0, y: 0 }
      snapped = path.length > 0
    } else {
      vector = { x: dx / distance, y: dy / distance }
    }
  } else {
    vector = { x: 0, y: 0 }
  }

  const magnitude = Math.hypot(vector.x, vector.y)
  if (magnitude > 0.15) {
    const next = moveWithCollision(map, player, vector.x * SPEED * dt, vector.y * SPEED * dt)
    const moved = next.x !== player.x || next.y !== player.y
    player.x = next.x
    player.y = next.y
    player.direction = Math.abs(vector.x) > Math.abs(vector.y)
      ? (vector.x > 0 ? 'right' : 'left')
      : (vector.y > 0 ? 'down' : 'up')
    player.moving = moved
    if (moved) player.walkTime += dt
    // Un obstáculo en la ruta la cancela en lugar de dejar al avatar empujando.
    else if (!manual) { path = []; enterOnArrival = null }
  } else if (snapped) {
    player.walkTime += dt
  } else {
    player.moving = false
    player.walkTime = 0
  }

  // Bit sigue al avatar un paso atrás.
  const behind: Record<Direction, Point> = {
    down: { x: -13, y: -6 }, up: { x: 13, y: 6 }, left: { x: 13, y: -4 }, right: { x: -13, y: -4 }
  }
  const offset = behind[player.direction]
  const ease = Math.min(1, dt * 5)
  bit.x += (player.x + offset.x - bit.x) * ease
  bit.y += (player.y + offset.y - bit.y) * ease

  setNear(nearbyLocation(player))
}

const draw = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || !mapLayer || !avatarSprites) return

  const unit = scale * dpr
  const camera = cameraFor(player, viewW / scale, viewH / scale, map)
  const camX = Math.round(camera.x * unit)
  const camY = Math.round(camera.y * unit)
  const sx = (worldX: number) => Math.round(worldX * unit) - camX
  const sy = (worldY: number) => Math.round(worldY * unit) - camY

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#2f7d3a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(mapLayer, -camX, -camY, mapLayer.width * unit, mapLayer.height * unit)

  const drawShadow = (x: number, y: number, width: number) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)'
    ctx.beginPath()
    ctx.ellipse(sx(x), sy(y), width * unit, 2 * unit, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawBit = () => {
    const sprite = bitSprites[Math.floor(clock * 2) % 2]
    if (!sprite) return
    const bob = Math.sin(clock * 4) * 1.5
    drawShadow(bit.x, bit.y + 3, 4)
    ctx.drawImage(sprite, sx(bit.x - 6), sy(bit.y - 12 + bob), 12 * unit, 12 * unit)
  }

  const drawPlayer = () => {
    const frames = avatarSprites?.[player.direction] ?? []
    const frame = player.moving ? 1 + (Math.floor(player.walkTime * 8) % 2) : 0
    const sprite = frames[frame] ?? frames[0]
    if (!sprite) return
    drawShadow(player.x, player.y + 3, 5)
    ctx.drawImage(sprite, sx(player.x - 8), sy(player.y - 13), 16 * unit, 16 * unit)
  }

  // Quien está más abajo en pantalla se dibuja encima.
  if (bit.y <= player.y) { drawBit(); drawPlayer() } else { drawPlayer(); drawBit() }

  // Letreros de cada ubicación.
  const fontSize = Math.round(Math.max(11, 4.2 * scale) * dpr)
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const location of VALLE_LOCATIONS) {
    const label = `${location.emoji} ${location.name}`
    const centerX = sx((location.rect.x + location.rect.w / 2) * TILE)
    const centerY = sy(location.rect.y * TILE) - fontSize * 0.9
    const width = ctx.measureText(label).width + fontSize * 1.2
    const height = fontSize * 1.7
    if (centerX + width / 2 < 0 || centerX - width / 2 > canvas.width || centerY + height < 0 || centerY - height > canvas.height) continue
    ctx.fillStyle = location.id === nearId ? 'rgba(79, 70, 229, 0.95)' : 'rgba(15, 23, 42, 0.78)'
    ctx.beginPath()
    ctx.roundRect(centerX - width / 2, centerY - height / 2, width, height, height / 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, centerX, centerY + dpr)
  }
}

const loop = (time: number) => {
  // Tras volver de otra pestaña el salto de tiempo se recorta para no teletransportar al avatar.
  const dt = Math.min(0.05, (time - lastTime) / 1000 || 0)
  lastTime = time
  update(dt)
  draw()
  frameId = requestAnimationFrame(loop)
}

const start = () => {
  if (frameId) return
  lastTime = performance.now()
  frameId = requestAnimationFrame(loop)
}

const stop = () => {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
}

/** Camina hasta la entrada de una ubicación y la abre al llegar. */
const walkTo = (id: LocationId) => {
  const location = getValleLocation(id)
  if (!location) return
  const from = tileOfPixel(player.x, player.y)
  const route = findPath(map, from, location.entrance)
  if (!route.length) {
    emit('enter', id)
    return
  }
  path = route
  enterOnArrival = id
}

/** Entra a la ubicación junto a la que está el avatar. */
const interact = () => {
  if (nearId && !props.paused) emit('enter', nearId)
}

const setJoystick = (x: number, y: number) => {
  joystick.x = x
  joystick.y = y
}

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  if (!element?.tagName) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
}

const onKeyDown = (event: KeyboardEvent) => {
  if (props.paused || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
  const key = event.key.toLowerCase()
  if (KEY_VECTORS[key]) {
    keys.add(key)
    event.preventDefault()
    return
  }
  if (key === 'e' || key === 'enter' || key === ' ') {
    if (nearId) event.preventDefault()
    interact()
  }
}

const onKeyUp = (event: KeyboardEvent) => {
  keys.delete(event.key.toLowerCase())
}

const clearInput = () => {
  keys.clear()
  joystick.x = 0
  joystick.y = 0
}

const onPointerDown = (event: PointerEvent) => {
  const canvas = canvasRef.value
  if (!canvas || props.paused) return
  const rect = canvas.getBoundingClientRect()
  const camera = cameraFor(player, viewW / scale, viewH / scale, map)
  const tile = tileOfPixel(
    camera.x + (event.clientX - rect.left) / scale,
    camera.y + (event.clientY - rect.top) / scale
  )
  const location = locationAtTile(tile)
  if (location) {
    walkTo(location.id)
    return
  }
  if (!isWalkableTile(map, tile.x, tile.y)) return
  path = findPath(map, tileOfPixel(player.x, player.y), tile)
  enterOnArrival = null
}

const onVisibility = () => {
  if (document.hidden) { stop(); clearInput() } else start()
}

watch(() => props.avatar, config => {
  if (import.meta.client) avatarSprites = buildAvatarSprites(config)
}, { deep: true })

watch(() => props.paused, paused => {
  if (paused) { clearInput(); path = []; enterOnArrival = null }
})

onMounted(() => {
  mapLayer = renderMapLayer(map, VALLE_LOCATIONS)
  avatarSprites = buildAvatarSprites(props.avatar)
  bitSprites = buildBitSprites()
  resize()
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(containerRef.value)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', onVisibility)
  start()
})

onBeforeUnmount(() => {
  stop()
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', clearInput)
  document.removeEventListener('visibilitychange', onVisibility)
})

defineExpose({ walkTo, interact, setJoystick })
</script>

<template>
  <div ref="containerRef" class="absolute inset-0 overflow-hidden bg-emerald-800">
    <canvas
      ref="canvasRef"
      class="block h-full w-full touch-none select-none"
      role="img"
      aria-label="Mapa de Valle Bit. Usa las flechas o WASD para caminar y E para entrar a un lugar. El modo lista ofrece las mismas ubicaciones sin mapa."
      @pointerdown="onPointerDown"
    />
  </div>
</template>
