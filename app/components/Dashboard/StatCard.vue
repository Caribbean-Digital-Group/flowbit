<script lang="ts">
export type DashboardStatAccent = 'emerald' | 'rose' | 'sky' | 'violet' | 'indigo' | 'amber'

export interface DashboardStatTrend {
  label: string
  direction: 'up' | 'down' | 'neutral'
  /** Si el cambio es favorable (un egreso que sube no lo es). */
  favorable: boolean | null
}

export interface DashboardStat {
  key: string
  label: string
  value: string
  sublabel: string
  iconPath: string
  accent: DashboardStatAccent
  to?: string
  trend?: DashboardStatTrend
}
</script>

<script setup lang="ts">
interface Props {
  stat?: DashboardStat | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  stat: null,
  loading: false
})

const accentStyles: Record<DashboardStatAccent, { icon: string; blob: string; ring: string }> = {
  emerald: { icon: 'bg-emerald-50 text-emerald-600', blob: 'bg-emerald-400', ring: 'group-hover:border-emerald-200' },
  rose: { icon: 'bg-rose-50 text-rose-600', blob: 'bg-rose-400', ring: 'group-hover:border-rose-200' },
  sky: { icon: 'bg-sky-50 text-sky-600', blob: 'bg-sky-400', ring: 'group-hover:border-sky-200' },
  violet: { icon: 'bg-violet-50 text-violet-600', blob: 'bg-violet-400', ring: 'group-hover:border-violet-200' },
  indigo: { icon: 'bg-indigo-50 text-indigo-600', blob: 'bg-indigo-400', ring: 'group-hover:border-indigo-200' },
  amber: { icon: 'bg-amber-50 text-amber-600', blob: 'bg-amber-400', ring: 'group-hover:border-amber-200' }
}

const trendClass = computed(() => {
  const favorable = props.stat?.trend?.favorable
  if (favorable === true) return 'bg-emerald-50 text-emerald-700'
  if (favorable === false) return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-600'
})
</script>

<template>
  <div
    v-if="loading || !stat"
    class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 space-y-3">
        <div class="h-3 w-24 rounded bg-slate-200" />
        <div class="h-7 w-32 rounded bg-slate-200" />
      </div>
      <div class="h-11 w-11 rounded-xl bg-slate-200" />
    </div>
    <div class="mt-4 h-3 w-28 rounded bg-slate-200" />
  </div>

  <component
    :is="stat.to ? 'NuxtLink' : 'div'"
    v-else
    :to="stat.to"
    :class="[
      'group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200',
      stat.to ? 'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60' : '',
      accentStyles[stat.accent].ring
    ]"
  >
    <div
      :class="[
        'pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]',
        accentStyles[stat.accent].blob
      ]"
    />

    <div class="relative flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-medium text-slate-500">{{ stat.label }}</p>
        <p class="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
          {{ stat.value }}
        </p>
      </div>
      <span
        :class="[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          accentStyles[stat.accent].icon
        ]"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :d="stat.iconPath" />
        </svg>
      </span>
    </div>

    <div class="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        v-if="stat.trend"
        :class="['inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', trendClass]"
      >
        <svg
          v-if="stat.trend.direction !== 'neutral'"
          class="h-3 w-3"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            :d="stat.trend.direction === 'up' ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'"
          />
        </svg>
        {{ stat.trend.label }}
      </span>
      <p class="text-xs text-slate-500">{{ stat.sublabel }}</p>
    </div>
  </component>
</template>
