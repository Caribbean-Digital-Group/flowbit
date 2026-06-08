<script setup lang="ts">
interface MonthBar {
  label: string
  income: number
  expense: number
  incomeCount: number
  expenseCount: number
}

interface Props {
  data: MonthBar[]
  currency: string
}

const props = defineProps<Props>()

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
  return v.toFixed(0)
}

const formatFull = (v: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: props.currency || 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(v)

function niceStep(maxVal: number, steps = 4): number {
  if (maxVal <= 0) return 25
  const raw = maxVal / steps
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

const maxValue = computed(() => {
  if (props.data.length === 0) return 0
  return Math.max(...props.data.flatMap((d) => [d.income, d.expense]), 0)
})

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

const bars = computed(() => {
  const n = props.data.length
  if (n === 0) return []
  const groupW = CHART_W / n
  const barW = Math.min(Math.floor(groupW * 0.38), 28)
  const gap = Math.max(Math.floor(barW * 0.18), 2)
  const groupPad = (groupW - 2 * barW - gap) / 2

  return props.data.map((d, i) => {
    const gx = PAD_LEFT + i * groupW + groupPad
    const incH = yMax.value > 0 ? (d.income / yMax.value) * CHART_H : 0
    const expH = yMax.value > 0 ? (d.expense / yMax.value) * CHART_H : 0
    return {
      data: d,
      label: d.label,
      index: i,
      groupX: PAD_LEFT + i * groupW,
      groupW,
      centerX: PAD_LEFT + i * groupW + groupW / 2,
      inc: { x: gx, y: toY(d.income), w: barW, h: incH },
      exp: { x: gx + barW + gap, y: toY(d.expense), w: barW, h: expH }
    }
  })
})

// ── Tooltip ───────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null)
const activeBarIndex = ref<number | null>(null)

interface TooltipState {
  x: number
  y: number
  bar: MonthBar & { label: string }
}

const tooltip = ref<TooltipState | null>(null)

const showTooltip = (event: MouseEvent, bar: (typeof bars.value)[0]) => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  activeBarIndex.value = bar.index
  tooltip.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    bar: { ...bar.data, label: bar.label }
  }
}

const updateTooltipPos = (event: MouseEvent) => {
  if (!tooltip.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  tooltip.value = {
    ...tooltip.value,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

const hideTooltip = () => {
  tooltip.value = null
  activeBarIndex.value = null
}

const TOOLTIP_W = 232
const TOOLTIP_H = 152

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

const tooltipBalance = computed(() => {
  if (!tooltip.value) return { amount: 0, positive: true, str: '' }
  const diff = tooltip.value.bar.income - tooltip.value.bar.expense
  return {
    amount: diff,
    positive: diff >= 0,
    str: (diff >= 0 ? '+' : '') + formatFull(diff)
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative select-none"
    @mouseleave="hideTooltip"
  >
    <svg
      :viewBox="`0 0 ${VB_W} ${VB_H}`"
      class="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Gráfica de ingresos y egresos por mes"
      @mousemove="updateTooltipPos"
    >
      <!-- Currency label top-left -->
      <text
        :x="PAD_LEFT - 6"
        :y="PAD_TOP - 4"
        text-anchor="end"
        font-size="9"
        font-weight="600"
        fill="#94a3b8"
      >{{ currency }}</text>

      <!-- Y grid lines + labels -->
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

      <!-- Baseline -->
      <line
        :x1="PAD_LEFT"
        :y1="PAD_TOP + CHART_H"
        :x2="PAD_LEFT + CHART_W"
        :y2="PAD_TOP + CHART_H"
        stroke="#cbd5e1"
        stroke-width="1.5"
      />

      <!-- Left axis line -->
      <line
        :x1="PAD_LEFT"
        :y1="PAD_TOP"
        :x2="PAD_LEFT"
        :y2="PAD_TOP + CHART_H"
        stroke="#e2e8f0"
        stroke-width="1"
      />

      <!-- Bars, labels, hover zones -->
      <g v-for="bar in bars" :key="bar.label">
        <!-- Column highlight on hover -->
        <rect
          v-if="activeBarIndex === bar.index"
          :x="bar.groupX + 1"
          :y="PAD_TOP"
          :width="bar.groupW - 2"
          :height="CHART_H"
          fill="#6366f1"
          opacity="0.05"
          rx="3"
        />

        <!-- Income bar -->
        <rect
          v-if="bar.inc.h > 0"
          :x="bar.inc.x"
          :y="bar.inc.y"
          :width="bar.inc.w"
          :height="bar.inc.h"
          rx="2"
          :fill="activeBarIndex === bar.index ? '#059669' : '#10b981'"
        />
        <line
          v-else
          :x1="bar.inc.x"
          :y1="PAD_TOP + CHART_H - 1"
          :x2="bar.inc.x + bar.inc.w"
          :y2="PAD_TOP + CHART_H - 1"
          stroke="#10b981"
          stroke-width="2"
          opacity="0.35"
        />

        <!-- Expense bar -->
        <rect
          v-if="bar.exp.h > 0"
          :x="bar.exp.x"
          :y="bar.exp.y"
          :width="bar.exp.w"
          :height="bar.exp.h"
          rx="2"
          :fill="activeBarIndex === bar.index ? '#e11d48' : '#f43f5e'"
        />
        <line
          v-else
          :x1="bar.exp.x"
          :y1="PAD_TOP + CHART_H - 1"
          :x2="bar.exp.x + bar.exp.w"
          :y2="PAD_TOP + CHART_H - 1"
          stroke="#f43f5e"
          stroke-width="2"
          opacity="0.35"
        />

        <!-- Month label -->
        <text
          :x="bar.centerX"
          :y="PAD_TOP + CHART_H + 18"
          text-anchor="middle"
          font-size="10"
          :fill="activeBarIndex === bar.index ? '#4f46e5' : '#64748b'"
          :font-weight="activeBarIndex === bar.index ? '700' : '400'"
        >{{ bar.label }}</text>

        <!-- Transparent hover capture zone -->
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

    <!-- Custom tooltip -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tooltip"
        class="pointer-events-none absolute z-20 w-58 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl shadow-slate-300/40"
        :style="tooltipStyle"
      >
        <!-- Month header -->
        <p class="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {{ tooltip.bar.label }}
        </p>

        <div class="space-y-2">
          <!-- Income -->
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="mt-px inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-500" />
              <span class="text-xs text-slate-500">Ingresos</span>
            </div>
            <div class="text-right">
              <p class="text-xs font-semibold text-slate-900 tabular-nums">
                {{ formatFull(tooltip.bar.income) }}
              </p>
              <p class="text-[10px] tabular-nums text-slate-400">
                {{ tooltip.bar.incomeCount }}
                {{ tooltip.bar.incomeCount === 1 ? 'orden' : 'órdenes' }}
              </p>
            </div>
          </div>

          <!-- Expense -->
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="mt-px inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-rose-500" />
              <span class="text-xs text-slate-500">Egresos</span>
            </div>
            <div class="text-right">
              <p class="text-xs font-semibold text-slate-900 tabular-nums">
                {{ formatFull(tooltip.bar.expense) }}
              </p>
              <p class="text-[10px] tabular-nums text-slate-400">
                {{ tooltip.bar.expenseCount }}
                {{ tooltip.bar.expenseCount === 1 ? 'orden' : 'órdenes' }}
              </p>
            </div>
          </div>

          <!-- Balance -->
          <div class="flex items-center justify-between gap-4 border-t border-slate-100 pt-2">
            <span class="text-xs font-medium text-slate-500">Balance</span>
            <span
              :class="[
                'text-xs font-bold tabular-nums',
                tooltipBalance.positive ? 'text-emerald-700' : 'text-rose-700'
              ]"
            >{{ tooltipBalance.str }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
