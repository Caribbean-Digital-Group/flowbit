<script setup lang="ts">
/** Joystick virtual para pantallas táctiles. Emite un vector normalizado (-1 a 1 por eje). */
const emit = defineEmits<{ move: [x: number, y: number] }>()

const RADIUS = 44

const baseRef = ref<HTMLDivElement | null>(null)
const knob = ref({ x: 0, y: 0 })
let pointerId: number | null = null

const track = (event: PointerEvent) => {
  const base = baseRef.value
  if (!base) return
  const rect = base.getBoundingClientRect()
  let dx = event.clientX - (rect.left + rect.width / 2)
  let dy = event.clientY - (rect.top + rect.height / 2)
  const distance = Math.hypot(dx, dy)
  if (distance > RADIUS) {
    dx = (dx / distance) * RADIUS
    dy = (dy / distance) * RADIUS
  }
  knob.value = { x: dx, y: dy }
  emit('move', dx / RADIUS, dy / RADIUS)
}

const onDown = (event: PointerEvent) => {
  pointerId = event.pointerId
  baseRef.value?.setPointerCapture(event.pointerId)
  track(event)
}

const onMove = (event: PointerEvent) => {
  if (event.pointerId === pointerId) track(event)
}

const release = (event: PointerEvent) => {
  if (event.pointerId !== pointerId) return
  pointerId = null
  knob.value = { x: 0, y: 0 }
  emit('move', 0, 0)
}

onBeforeUnmount(() => emit('move', 0, 0))
</script>

<template>
  <div
    ref="baseRef"
    class="relative h-28 w-28 touch-none select-none rounded-full border-2 border-white/40 bg-slate-900/35 backdrop-blur-sm"
    aria-hidden="true"
    @pointerdown.prevent="onDown"
    @pointermove.prevent="onMove"
    @pointerup="release"
    @pointercancel="release"
  >
    <div
      class="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/85 shadow-lg"
      :style="{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }"
    />
  </div>
</template>
