<script setup lang="ts">
interface Props {
  page: number
  total: number
  pageSize: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ change: [page: number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(props.pageSize, 1))))
const pages = computed(() => {
  const result: number[] = []
  const start = Math.max(1, props.page - 2)
  const end = Math.min(totalPages.value, props.page + 2)
  for (let i = start; i <= end; i++) result.push(i)
  return result
})
</script>

<template>
  <nav v-if="totalPages > 1" class="flex items-center justify-center gap-1.5" aria-label="Paginación">
    <button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" :disabled="page <= 1" @click="emit('change', page - 1)">Anterior</button>
    <button
      v-for="p in pages"
      :key="p"
      type="button"
      :class="['sf-btn sf-btn--sm', p === page ? 'sf-btn--primary' : 'sf-btn--ghost']"
      :aria-current="p === page ? 'page' : undefined"
      @click="emit('change', p)"
    >
      {{ p }}
    </button>
    <button type="button" class="sf-btn sf-btn--ghost sf-btn--sm" :disabled="page >= totalPages" @click="emit('change', page + 1)">Siguiente</button>
  </nav>
</template>
