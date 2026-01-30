<template>
  <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold" :class="getBadgeClasses(variant)">
    {{ getBadgeLabel(label) }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  variant: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
}>()

const getBadgeClasses = (variant: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info') => {
  const colors = {
    primary: 'bg-indigo-100 text-indigo-700',
    secondary: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-sky-100 text-sky-700'
  }
  return colors[variant as keyof typeof colors]
}

const getBadgeLabel = (label: string) => {
  return label.charAt(0).toUpperCase() + label.slice(1)
}
</script>