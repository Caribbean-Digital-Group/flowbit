<script setup lang="ts">
import type { AvatarConfig } from '~/utils/valle/avatar'
import { SPRITE_SIZE, avatarPixels } from '~/utils/valle/avatar'
import type { Direction } from '~/utils/valle/types'

/** Retrato pixel art del avatar, dibujado con el mismo sprite que usa el mapa. */
interface Props {
  config: AvatarConfig
  /** Lado del retrato en píxeles CSS. */
  size?: number
  direction?: Direction
}

const props = withDefaults(defineProps<Props>(), { size: 64, direction: 'down' })

const canvasRef = ref<HTMLCanvasElement | null>(null)

const paint = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  avatarPixels(props.config, props.direction).forEach((row, y) => row.forEach((color, x) => {
    if (!color) return
    ctx.fillStyle = color
    ctx.fillRect(x, y, 1, 1)
  }))
}

onMounted(paint)
watch(() => [props.config, props.direction], paint, { deep: true })
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="SPRITE_SIZE"
    :height="SPRITE_SIZE"
    class="[image-rendering:pixelated]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>
