<script setup lang="ts">
import type { OnboardingProgress } from '~/utils/onboarding'
import { buildOnboardingProgress, onboardingDismissKey } from '~/utils/onboarding'

/**
 * Tarjeta «Primeros pasos» del dashboard (TRY-30). Se marca sola con los datos
 * reales de la empresa, desaparece al completarse y se puede ocultar; el
 * ocultamiento es una preferencia de esta persona en este navegador, por empresa.
 */

interface Props {
  companyId: string
}

const props = defineProps<Props>()

const { getSignals } = useOnboarding()

const progress = ref<OnboardingProgress | null>(null)
const isDismissed = ref(true)
const isExpanded = ref(true)

const readDismissed = (companyId: string): boolean => {
  try {
    return window.localStorage.getItem(onboardingDismissKey(companyId)) === '1'
  } catch {
    return false
  }
}

const dismiss = () => {
  isDismissed.value = true
  try {
    window.localStorage.setItem(onboardingDismissKey(props.companyId), '1')
  } catch {
    // Sin almacenamiento disponible: se oculta solo durante esta visita.
  }
}

let request = 0
const load = async () => {
  const companyId = props.companyId
  const requestId = ++request
  progress.value = null
  isDismissed.value = readDismissed(companyId)
  if (isDismissed.value) return
  const signals = await getSignals(companyId)
  if (requestId !== request || !signals) return
  progress.value = buildOnboardingProgress(signals)
}

onMounted(() => {
  watch(() => props.companyId, () => { void load() }, { immediate: true })
})

const isVisible = computed(() => !isDismissed.value && progress.value !== null && !progress.value.isComplete)
</script>

<template>
  <section
    v-if="isVisible && progress"
    class="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-6"
    aria-labelledby="onboarding-title"
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 id="onboarding-title" class="text-lg font-semibold text-slate-900">Primeros pasos</h2>
        <p class="mt-1 text-sm text-slate-500">
          {{ progress.completed }} de {{ progress.total }} completados. Cada paso se marca solo cuando lo terminas.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white"
          :aria-expanded="isExpanded"
          @click="isExpanded = !isExpanded"
        >
          {{ isExpanded ? 'Contraer' : 'Ver pasos' }}
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
          title="Ocultar esta tarjeta en este navegador"
          @click="dismiss"
        >
          Ocultar
        </button>
      </div>
    </div>

    <div
      class="mt-4 h-2 overflow-hidden rounded-full bg-white"
      role="progressbar"
      :aria-valuenow="progress.percent"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Avance de primeros pasos"
    >
      <div
        class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 transition-all"
        :style="{ width: `${progress.percent}%` }"
      />
    </div>

    <ol v-if="isExpanded" class="mt-5 space-y-2">
      <li
        v-for="step in progress.steps"
        :key="step.id"
        :class="[
          'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
          step.done
            ? 'border-emerald-100 bg-emerald-50/60'
            : step.id === progress.nextStepId
              ? 'border-indigo-200 bg-white shadow-sm'
              : 'border-slate-100 bg-white/70'
        ]"
      >
        <span
          :class="[
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            step.done ? 'bg-emerald-500 text-white' : 'border-2 border-slate-200 bg-white'
          ]"
          :aria-label="step.done ? 'Completado' : 'Pendiente'"
        >
          <svg v-if="step.done" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <p :class="['text-sm font-semibold', step.done ? 'text-emerald-800 line-through decoration-emerald-300' : 'text-slate-800']">
            {{ step.title }}
          </p>
          <p v-if="!step.done" class="text-xs text-slate-500">{{ step.description }}</p>
        </div>
        <div v-if="!step.done" class="flex items-center gap-2">
          <NuxtLink
            :to="step.manualHref"
            class="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Ver guía
          </NuxtLink>
          <NuxtLink
            :to="step.to"
            :class="[
              'rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
              step.id === progress.nextStepId
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
            ]"
          >
            {{ step.actionLabel }}
          </NuxtLink>
        </div>
      </li>
    </ol>
  </section>
</template>
