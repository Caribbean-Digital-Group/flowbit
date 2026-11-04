<script lang="ts">
export interface AttentionItem {
  key: string
  label: string
  /** Valor destacado (conteo o importe ya formateado). */
  value: string
  detail?: string
  to: string
  tone: 'danger' | 'warning' | 'info'
}
</script>

<script setup lang="ts">
interface Props {
  items: AttentionItem[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const toneStyles: Record<AttentionItem['tone'], { dot: string; value: string }> = {
  danger: { dot: 'bg-rose-500', value: 'bg-rose-50 text-rose-700' },
  warning: { dot: 'bg-amber-500', value: 'bg-amber-50 text-amber-700' },
  info: { dot: 'bg-indigo-500', value: 'bg-indigo-50 text-indigo-700' }
}
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 4"
        :key="`attention-skeleton-${i}`"
        class="h-12 animate-pulse rounded-xl bg-slate-100"
      />
    </div>

    <div
      v-else-if="items.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-6 text-center"
    >
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </span>
      <p class="text-sm font-semibold text-emerald-800">Todo al día</p>
      <p class="text-xs text-emerald-700/80">No hay pendientes que requieran tu atención.</p>
    </div>

    <ul v-else class="space-y-2">
      <li v-for="item in items" :key="item.key">
        <NuxtLink
          :to="item.to"
          class="group flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
        >
          <span :class="['h-2 w-2 shrink-0 rounded-full', toneStyles[item.tone].dot]" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-slate-800">{{ item.label }}</span>
            <span v-if="item.detail" class="block truncate text-xs text-slate-500">{{ item.detail }}</span>
          </span>
          <span :class="['shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', toneStyles[item.tone].value]">
            {{ item.value }}
          </span>
          <svg class="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
