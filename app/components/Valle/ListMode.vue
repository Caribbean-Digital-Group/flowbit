<script setup lang="ts">
import type { LocationSummary } from '~/utils/valle/summary'
import type { LocationId, ValleLocation } from '~/utils/valle/types'

/**
 * Modo lista: las mismas ubicaciones del mapa como tarjetas, sin canvas.
 * Para lector de pantalla, movimiento reducido o equipos lentos.
 */
interface Props {
  locations: ValleLocation[]
  summaries: Record<LocationId, LocationSummary>
}

defineProps<Props>()

const emit = defineEmits<{ open: [id: LocationId] }>()
</script>

<template>
  <div class="absolute inset-0 overflow-y-auto bg-gradient-to-b from-emerald-700 to-emerald-900 px-3 pb-10 pt-32 sm:px-6">
    <h2 class="sr-only">Lugares de Valle Bit</h2>
    <ul class="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="location in locations" :key="location.id">
        <button
          type="button"
          class="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-lg transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          @click="emit('open', location.id)"
        >
          <span class="flex items-center gap-3 px-4 py-3 text-white" :style="{ backgroundColor: location.roofColor }">
            <span class="text-2xl leading-none" aria-hidden="true">{{ location.emoji }}</span>
            <span class="min-w-0">
              <span class="block truncate font-bold">{{ location.name }}</span>
              <span class="block truncate text-xs text-white/85">{{ location.moduleLabel }}</span>
            </span>
          </span>
          <span class="flex-1 px-4 py-3 text-sm text-slate-600">{{ summaries[location.id].liveLine }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
