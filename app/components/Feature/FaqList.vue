<script setup lang="ts">
import type { FeatureFaq } from '~/utils/features'

interface Props {
  faqs: FeatureFaq[]
  /** Fondo oscuro (landing) o claro (resto de páginas). */
  dark?: boolean
}

withDefaults(defineProps<Props>(), {
  dark: false
})
</script>

<template>
  <!-- <details> deja las respuestas en el HTML: los buscadores las leen aunque estén plegadas -->
  <div class="space-y-3">
    <details
      v-for="faq in faqs"
      :key="faq.question"
      :class="[
        'group rounded-2xl border px-5 py-4 transition-colors',
        dark
          ? 'bg-white/5 border-white/10 open:bg-white/[0.07]'
          : 'bg-white border-slate-200 shadow-sm open:shadow-lg open:shadow-slate-200/50'
      ]"
    >
      <summary :class="['flex items-center justify-between gap-4 cursor-pointer list-none font-semibold', dark ? 'text-white' : 'text-slate-800']">
        <h3 class="text-base">{{ faq.question }}</h3>
        <svg
          :class="['w-5 h-5 flex-shrink-0 transition-transform group-open:rotate-45', dark ? 'text-fuchsia-300' : 'text-indigo-500']"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </summary>
      <p :class="['mt-3 text-sm leading-relaxed', dark ? 'text-slate-300' : 'text-slate-500']">{{ faq.answer }}</p>
    </details>
  </div>
</template>

<style scoped>
summary::-webkit-details-marker {
  display: none;
}
</style>
