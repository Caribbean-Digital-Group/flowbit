<script setup lang="ts">
/**
 * El manual dejó de vivir dentro del panel: ahora es una sección pública en /manual.
 * Esta ruta se conserva únicamente para no romper enlaces ya compartidos.
 */
definePageMeta({ layout: false })

const route = useRoute()

const target = computed(() => {
  const article = route.query.article as string | undefined
  const section = route.query.section as string | undefined
  if (!article) return '/manual'
  return section ? `/manual/${article}#${section}` : `/manual/${article}`
})

await navigateTo(target.value, { redirectCode: 301, replace: true })
</script>

<template>
  <div />
</template>
