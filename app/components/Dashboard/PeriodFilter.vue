<script setup lang="ts">
import type { DashboardPreset } from '~/utils/dashboard'
import { DASHBOARD_PRESETS } from '~/utils/dashboard'

interface Props {
  /** Monedas con movimientos; el selector solo aparece si hay más de una. */
  currencies?: string[]
  /** Texto del periodo actual (ej. «1 – 4 nov 2026»). */
  rangeLabel?: string
  /** Texto del periodo de comparación. */
  comparisonLabel?: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  currencies: () => [],
  rangeLabel: '',
  comparisonLabel: '',
  loading: false
})

const preset = defineModel<DashboardPreset>('preset', { required: true })
const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })
const currency = defineModel<string>('currency', { default: '' })
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div
        class="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1"
        role="radiogroup"
        aria-label="Periodo"
      >
        <button
          v-for="p in DASHBOARD_PRESETS"
          :key="p.value"
          type="button"
          role="radio"
          :aria-checked="preset === p.value"
          :class="[
            'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            preset === p.value
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          ]"
          @click="preset = p.value"
        >
          {{ p.label }}
        </button>
      </div>

      <div
        v-if="currencies.length > 1"
        class="flex items-center gap-1.5"
      >
        <span class="text-xs font-medium text-slate-500">Moneda:</span>
        <button
          v-for="c in currencies"
          :key="c"
          type="button"
          :class="[
            'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
            currency === c
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          ]"
          @click="currency = c"
        >
          {{ c }}
        </button>
      </div>
    </div>

    <div
      v-if="preset === 'custom'"
      class="mt-3 flex flex-wrap gap-3"
    >
      <FormInput
        v-model="from"
        type="date"
        label="Desde"
        :max="to"
        size="sm"
      />
      <FormInput
        v-model="to"
        type="date"
        label="Hasta"
        :min="from"
        size="sm"
      />
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <span class="inline-flex items-center gap-1.5 font-semibold text-slate-700">
        <svg class="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        {{ rangeLabel }}
      </span>
      <span v-if="comparisonLabel">Comparado con {{ comparisonLabel }}</span>
      <span
        v-if="loading"
        class="inline-flex items-center gap-1.5 text-indigo-600"
      >
        <span class="h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        Actualizando…
      </span>
    </div>
  </div>
</template>
