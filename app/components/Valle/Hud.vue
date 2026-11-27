<script setup lang="ts">
import type { ScoreMarker } from '~/utils/valle/summary'
import { formatMarkerValue } from '~/utils/valle/summary'
import type { LocationId } from '~/utils/valle/types'

/** Marcadores de la empresa, siempre visibles sobre el mapa. */
interface Props {
  markers: ScoreMarker[]
  currency: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), { loading: false })

const emit = defineEmits<{ select: [location: LocationId] }>()

const TREND_ARROWS: Record<'up' | 'down' | 'flat', string> = { up: '▲', down: '▼', flat: '■' }
const TREND_LABELS: Record<'up' | 'down' | 'flat', string> = {
  up: 'sube contra el mes anterior',
  down: 'baja contra el mes anterior',
  flat: 'igual que el mes anterior'
}

const trendClass = (marker: ScoreMarker): string =>
  marker.trendIsGood === null ? 'text-slate-400' : marker.trendIsGood ? 'text-emerald-400' : 'text-rose-400'

const valueOf = (marker: ScoreMarker): string =>
  props.loading && marker.value === null ? '…' : formatMarkerValue(marker, props.currency)

const describe = (marker: ScoreMarker): string =>
  `${marker.label}: ${valueOf(marker)}${marker.trend ? `, ${TREND_LABELS[marker.trend]}` : ''}. ${marker.hint}`
</script>

<template>
  <ul
    class="flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    aria-label="Marcadores de la empresa, mes en curso"
  >
    <li v-for="marker in markers" :key="marker.key" class="flex-shrink-0">
      <button
        type="button"
        class="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/85 px-3 py-1.5 text-left shadow-lg backdrop-blur transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        :title="marker.hint"
        :aria-label="describe(marker)"
        @click="emit('select', marker.location)"
      >
        <span class="text-base leading-none" aria-hidden="true">{{ marker.emoji }}</span>
        <span class="flex flex-col leading-tight">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{{ marker.label }}</span>
          <span class="flex items-center gap-1 text-sm font-bold tabular-nums text-white">
            {{ valueOf(marker) }}
            <span v-if="marker.trend" class="text-[9px]" :class="trendClass(marker)" aria-hidden="true">
              {{ TREND_ARROWS[marker.trend] }}
            </span>
          </span>
        </span>
      </button>
    </li>
  </ul>
</template>
