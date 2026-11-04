<script lang="ts">
export interface BarListItem {
  key: string
  label: string
  value: number
  /** Valor formateado que se muestra a la derecha. */
  display: string
  hint?: string
}
</script>

<script setup lang="ts">
interface Props {
  items: BarListItem[]
  /** Clase Tailwind de la barra (ej. `bg-indigo-500`). */
  barClass?: string
  emptyLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  barClass: 'bg-indigo-500',
  emptyLabel: 'Sin datos en el periodo.'
})

const maxValue = computed(() => Math.max(...props.items.map((i) => Math.abs(i.value)), 0))

const widthOf = (value: number): string => {
  if (maxValue.value <= 0) return '0%'
  return `${Math.max((Math.abs(value) / maxValue.value) * 100, value === 0 ? 0 : 2)}%`
}
</script>

<template>
  <div
    v-if="items.length === 0"
    class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
  >
    {{ emptyLabel }}
  </div>

  <ul v-else class="space-y-3">
    <li v-for="item in items" :key="item.key">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 truncate font-medium text-slate-700">{{ item.label }}</span>
        <span class="shrink-0 font-semibold tabular-nums text-slate-900">{{ item.display }}</span>
      </div>
      <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          :class="['h-full rounded-full transition-all duration-500', barClass]"
          :style="{ width: widthOf(item.value) }"
        />
      </div>
      <p v-if="item.hint" class="mt-1 text-[11px] text-slate-400">{{ item.hint }}</p>
    </li>
  </ul>
</template>
