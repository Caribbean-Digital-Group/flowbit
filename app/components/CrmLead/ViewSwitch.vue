<script setup lang="ts">
interface Props {
  current: 'list' | 'kanban'
}

withDefaults(defineProps<Props>(), {})

const views = [
  {
    key: 'kanban',
    label: 'Tablero',
    to: '/admin/crm/kanban',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2'
  },
  {
    key: 'list',
    label: 'Lista',
    to: '/admin/crm/leads',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16'
  }
] as const
</script>

<template>
  <nav aria-label="Vista de leads" class="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
    <NuxtLink
      v-for="view in views"
      :key="view.key"
      :to="view.to"
      :aria-current="current === view.key ? 'page' : undefined"
      :class="[
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
        current === view.key
          ? 'bg-white text-indigo-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-800'
      ]"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="view.icon" />
      </svg>
      {{ view.label }}
    </NuxtLink>
  </nav>
</template>
