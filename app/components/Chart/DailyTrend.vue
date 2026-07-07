<script setup lang="ts">
export interface DailyTrendPoint {
  /** Etiqueta corta del eje X (ej. "12 jun") */
  label: string
  /** Etiqueta completa para el tooltip (ej. "12 de junio de 2026") */
  fullLabel?: string
  value: number
}

interface Props {
  data: DailyTrendPoint[]
  /** Nombre de la serie mostrado en el tooltip (ej. "Sesiones") */
  seriesLabel: string
  /** Formato del valor */
  format?: 'number' | 'currency'
  currency?: string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  format: 'number',
  currency: 'MXN',
  color: '#6366f1'
})

const CHART_H = 200
const CHART_W = 680
const PAD_LEFT = 68
const PAD_TOP = 16
const PAD_BOTTOM = 44
const PAD_RIGHT = 16
const VB_W = PAD_LEFT + CHART_W + PAD_RIGHT
const VB_H = PAD_TOP + CHART_H + PAD_BOTTOM

const formatCompact = (v: number): string => {
  if (v === 0) return '0'
  if (v >= 1_000_000) {
    const m = v / 1_000_000
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (v >= 1_000) {
    const k = v / 1_000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)
}

const formatFull = (v: number): string =>
  props.format === 'currency'
    ? new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: props.currency || 'MXN',
        minimumFractionDigits: 2
      }).format(v)
    : new Intl.NumberFormat('es-MX').format(v)

function niceStep(maxVal: number, steps = 4): number {
  if (maxVal <= 0) return 25
  const raw = maxVal / steps
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

const maxValue = computed(() =>
  props.data.length ? Math.max(...props.data.map((d) => d.value), 0) : 0
)

const yMax = computed(() => {
  if (maxValue.value <= 0) return 100
  const step = niceStep(maxValue.value)
  return Math.ceil(maxValue.value / step) * step
})

const yGridLines = computed(() => {
  const maxV = maxValue.value <= 0 ? 100 : maxValue.value
  const step = niceStep(maxV)
  const lines: number[] = []
  for (let v = 0; v <= yMax.value; v += step) lines.push(v)
  return lines
})

const toY = (v: number) => PAD_TOP + CHART_H - (v / yMax.value) * CHART_H

/** Mostrar como máximo ~10 etiquetas en X para no saturar */
const labelEvery = computed(() => Math.max(1, Math.ceil(props.data.length / 10)))

const bars = computed(() => {
  const n = props.data.length
  if (n === 0) return []
  const groupW = CHART_W / n
  const barW = Math.max(2, Math.min(Math.floor(groupW * 0.62), 28))
  const pad = (groupW - barW) / 2

  return props.data.map((d, i) => ({
    data: d,
    index: i,
    groupX: PAD_LEFT + i * groupW,
    groupW,
    centerX: PAD_LEFT + i * groupW + groupW / 2,
    x: PAD_LEFT + i * groupW + pad,
    y: toY(d.value),
    w: barW,
    h: yMax.value > 0 ? (d.value / yMax.value) * CHART_H : 0,
    showLabel: i % labelEvery.value === 0
  }))
})

// ── Tooltip ───────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement | null>(null)
const activeIndex = ref<number | null>(null)

interface TooltipState {
  x: number
  y: number
  point: DailyTrendPoint
}

const tooltip = ref<TooltipState | null>(null)

const showTooltip = (event: MouseEvent, bar: (typeof bars.value)[0]) => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  activeIndex.value = bar.index
  tooltip.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    point: bar.data
  }
}

const updateTooltipPos = (event: MouseEvent) => {
  if (!tooltip.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  tooltip.value = { ...tooltip.value, x: event.clientX - rect.left, y: event.clientY - rect.top }
}

const hideTooltip = () => {
  tooltip.value = null
  activeIndex.value = null
}

const TOOLTIP_W = 190
const TOOLTIP_H = 74

const tooltipStyle = computed(() => {
  if (!tooltip.value || !containerRef.value) return {}
  const { x, y } = tooltip.value
  const containerW = containerRef.value.offsetWidth
  const OFFSET = 14

  let left = x + OFFSET
  let top = y - TOOLTIP_H - OFFSET
  if (left + TOOLTIP_W > containerW) left = x - TOOLTIP_W - OFFSET
  if (top < 0) top = y + OFFSET

  return { left: `${left}px`, top: `${top}px` }
})
</script>

<template>
  <div ref="containerRef" class="relative select-none" @mouseleave="hideTooltip">
    <svg
      :viewBox="`0 0 ${VB_W} ${VB_H}`"
      class="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`Gráfica diaria de ${seriesLabel}`"
      @mousemove="updateTooltipPos"
    >
      <!-- Y grid + labels -->
      <g v-for="gv in yGridLines" :key="gv">
        <line
          :x1="PAD_LEFT"
          :y1="toY(gv)"
          :x2="PAD_LEFT + CHART_W"
          :y2="toY(gv)"
          stroke="#e2e8f0"
          stroke-width="1"
        />
        <text
          :x="PAD_LEFT - 6"
          :y="toY(gv) + 4"
          text-anchor="end"
          font-size="10"
          fill="#94a3b8"
        >{{ formatCompact(gv) }}</text>
      </g>

      <!-- Baseline + eje Y -->
      <line
        :x1="PAD_LEFT"
        :y1="PAD_TOP + CHART_H"
        :x2="PAD_LEFT + CHART_W"
        :y2="PAD_TOP + CHART_H"
        stroke="#cbd5e1"
        stroke-width="1.5"
      />
      <line
        :x1="PAD_LEFT"
        :y1="PAD_TOP"
        :x2="PAD_LEFT"
        :y2="PAD_TOP + CHART_H"
        stroke="#e2e8f0"
        stroke-width="1"
      />

      <g v-for="bar in bars" :key="bar.index">
        <rect
          v-if="activeIndex === bar.index"
          :x="bar.groupX + 0.5"
          :y="PAD_TOP"
          :width="bar.groupW - 1"
          :height="CHART_H"
          :fill="color"
          opacity="0.06"
          rx="3"
        />

        <rect
          v-if="bar.h > 0"
          :x="bar.x"
          :y="bar.y"
          :width="bar.w"
          :height="bar.h"
          rx="2"
          :fill="color"
          :opacity="activeIndex === null || activeIndex === bar.index ? 1 : 0.55"
        />
        <line
          v-else
          :x1="bar.x"
          :y1="PAD_TOP + CHART_H - 1"
          :x2="bar.x + bar.w"
          :y2="PAD_TOP + CHART_H - 1"
          :stroke="color"
          stroke-width="2"
          opacity="0.3"
        />

        <text
          v-if="bar.showLabel"
          :x="bar.centerX"
          :y="PAD_TOP + CHART_H + 18"
          text-anchor="middle"
          font-size="10"
          :fill="activeIndex === bar.index ? '#4f46e5' : '#64748b'"
          :font-weight="activeIndex === bar.index ? '700' : '400'"
        >{{ bar.data.label }}</text>

        <rect
          :x="bar.groupX"
          :y="PAD_TOP"
          :width="bar.groupW"
          :height="CHART_H + PAD_BOTTOM"
          fill="transparent"
          style="cursor: crosshair"
          @mouseenter="(e) => showTooltip(e, bar)"
        />
      </g>
    </svg>

    <!-- Tooltip -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tooltip"
        class="pointer-events-none absolute z-20 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xl shadow-slate-300/40"
        :style="{ ...tooltipStyle, width: `${TOOLTIP_W}px` }"
      >
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {{ tooltip.point.fullLabel ?? tooltip.point.label }}
        </p>
        <div class="mt-1.5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-1.5">
            <span
              class="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              :style="{ backgroundColor: color }"
            />
            <span class="text-xs text-slate-500">{{ seriesLabel }}</span>
          </div>
          <span class="text-xs font-semibold text-slate-900 tabular-nums">
            {{ formatFull(tooltip.point.value) }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>
