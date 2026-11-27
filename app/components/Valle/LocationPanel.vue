<script setup lang="ts">
import type { LocationSummary } from '~/utils/valle/summary'
import type { ValleLocation } from '~/utils/valle/types'

/**
 * Interior de una ubicación: datos del módulo en solo lectura y accesos al panel.
 * En mobile es una hoja inferior; en desktop, un panel lateral.
 */
interface Props {
  location: ValleLocation
  summary: LocationSummary
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
  help: []
}>()

const TONE_CLASSES: Record<'good' | 'warn' | 'bad', string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-rose-600'
}

const panelRef = ref<HTMLElement | null>(null)

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  panelRef.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-end justify-center sm:items-stretch sm:justify-end">
    <div class="absolute inset-0 bg-slate-900/40" aria-hidden="true" @click="emit('close')" />

    <section
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      :aria-label="`${location.name}: ${location.moduleLabel}`"
      tabindex="-1"
      class="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl focus:outline-none sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-3xl"
    >
      <header class="flex items-start gap-3 px-5 py-4 text-white" :style="{ backgroundColor: location.roofColor }">
        <span class="text-3xl leading-none" aria-hidden="true">{{ location.emoji }}</span>
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-lg font-bold">{{ location.name }}</h2>
          <p class="truncate text-sm text-white/85">{{ location.moduleLabel }}</p>
        </div>
        <button
          type="button"
          class="rounded-xl bg-white/15 p-2 transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Salir del lugar"
          @click="emit('close')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <!-- Bit: qué pasa hoy en este lugar -->
        <button
          type="button"
          class="flex w-full items-start gap-3 rounded-2xl bg-violet-50 px-4 py-3 text-left transition-colors hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          @click="emit('help')"
        >
          <span class="text-xl leading-none" aria-hidden="true">🤖</span>
          <span class="text-sm text-violet-900">
            <span class="font-semibold">Bit:</span> {{ summary.liveLine }}
            <span class="mt-1 block text-xs font-semibold text-violet-700">¿Cómo funciona este lugar? →</span>
          </span>
        </button>

        <slot />

        <dl v-if="summary.stats.length" class="grid grid-cols-2 gap-3">
          <div v-for="stat in summary.stats" :key="stat.label" class="rounded-2xl bg-slate-50 px-3 py-2.5">
            <dt class="text-xs text-slate-500">{{ stat.label }}</dt>
            <dd class="mt-0.5 text-base font-bold tabular-nums" :class="stat.tone ? TONE_CLASSES[stat.tone] : 'text-slate-800'">
              {{ stat.value }}
            </dd>
          </div>
        </dl>

        <p v-if="summary.emptyNote" class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {{ summary.emptyNote }}
        </p>

        <div v-if="summary.items.length">
          <h3 class="mb-2 text-sm font-semibold text-slate-800">{{ summary.itemsTitle }}</h3>
          <ul class="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            <li v-for="item in summary.items" :key="item.id">
              <NuxtLink
                :to="item.route"
                class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-slate-800">{{ item.title }}</span>
                  <span class="block truncate text-xs text-slate-500">{{ item.subtitle }}</span>
                </span>
                <span v-if="item.flag" class="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {{ item.flag }}
                </span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div v-if="location.links.length">
          <h3 class="mb-2 text-sm font-semibold text-slate-800">También en este lugar</h3>
          <div class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="link in location.links"
              :key="link.route"
              :to="link.route"
              class="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {{ link.label }}
            </NuxtLink>
          </div>
        </div>
      </div>

      <footer class="border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <NuxtLink
          :to="location.adminRoute"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Abrir {{ location.moduleLabel }} en el panel
          <span aria-hidden="true">→</span>
        </NuxtLink>
      </footer>
    </section>
  </div>
</template>
