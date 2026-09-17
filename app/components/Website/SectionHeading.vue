<script setup lang="ts">
interface Props {
  eyebrow?: string | null
  title?: string | null
  text?: string | null
  align?: 'left' | 'center'
  size?: 'md' | 'lg'
}

withDefaults(defineProps<Props>(), { eyebrow: '', title: '', text: '', align: 'left', size: 'md' })
</script>

<template>
  <div v-if="eyebrow || title || text" :class="['mb-10', align === 'center' ? 'text-center mx-auto max-w-3xl' : 'max-w-3xl']">
    <p v-if="eyebrow" class="sf-eyebrow mb-2">{{ eyebrow }}</p>
    <h2 v-if="title" :class="['sf-heading font-bold', size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl']">{{ title }}</h2>
    <p v-if="text" class="sf-muted mt-4 text-base sm:text-lg leading-relaxed whitespace-pre-line">{{ text }}</p>
  </div>
</template>
