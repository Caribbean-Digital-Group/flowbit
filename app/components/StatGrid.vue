<script setup lang="ts">
export interface StatItem {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: string
}

interface Props {
  stats: StatItem[]
  columns?: 1 | 2 | 3 | 4
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  columns: 4,
  loading: false
})

const gridColsClass = computed(() => {
  const colsMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  }
  return colsMap[props.columns]
})

const getTrendClasses = (trend?: 'up' | 'down' | 'neutral') => {
  const trendMap: Record<string, string> = {
    up: 'bg-emerald-100 text-emerald-700',
    down: 'bg-red-100 text-red-700',
    neutral: 'bg-slate-100 text-slate-700'
  }
  return trendMap[trend || 'neutral']
}
</script>

<template>
  <div :class="['grid gap-4', gridColsClass]">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div
        v-for="i in columns"
        :key="i"
        class="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse"
      >
        <div class="flex items-center justify-between">
          <div class="h-4 bg-slate-200 rounded w-20"></div>
          <div class="h-6 bg-slate-200 rounded w-12"></div>
        </div>
        <div class="mt-2 h-9 bg-slate-200 rounded w-24"></div>
      </div>
    </template>

    <!-- Stats cards -->
    <template v-else>
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-lg hover:shadow-slate-200/50 transition-shadow"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-500">{{ stat.label }}</p>
          <span
            v-if="stat.change"
            :class="[
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              getTrendClasses(stat.trend)
            ]"
          >
            {{ stat.change }}
          </span>
        </div>
        <p class="mt-2 text-3xl font-bold text-slate-900">{{ stat.value }}</p>
        
        <!-- Slot para contenido adicional en cada card -->
        <slot name="card-footer" :stat="stat"></slot>
      </div>
    </template>
  </div>
</template>
