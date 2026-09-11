<script setup lang="ts">
import type { DocArticle, DocWizard } from '~/composables/useManual'

interface Props {
  wizard: DocWizard
  /** Artículo dueño de la guía; habilita los botones de compartir por paso. */
  article?: DocArticle
  /** Variante reducida para el panel del asistente Bit. */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  article: undefined,
  compact: false
})

const emit = defineEmits<{ navigate: [route: string] }>()

const authStore = useAuthStore()
const { isStepDone, toggleStep, markStepDone, resetWizard, wizardProgress, hydrate } = useManualProgress()

const openStepId = ref<string | null>(null)
/**
 * Las acciones llevan a vistas del panel: sin sesión no se ofrecen.
 * Reactivo porque la sesión se resuelve después del montaje.
 */
const canOpenPanel = computed(() => authStore.isAuthenticated)

onMounted(() => {
  hydrate()
  // Abre el primer paso pendiente para que la guía continúe donde se quedó.
  openStepId.value = props.wizard.steps.find(s => !isStepDone(props.wizard.id, s.id))?.id
    ?? props.wizard.steps[0]?.id
    ?? null
})

const progress = computed(() => wizardProgress(props.wizard.id, props.wizard.steps.length))
const doneCount = computed(() => props.wizard.steps.filter(s => isStepDone(props.wizard.id, s.id)).length)
const isComplete = computed(() => doneCount.value === props.wizard.steps.length && props.wizard.steps.length > 0)

function toggleOpen(stepId: string) {
  openStepId.value = openStepId.value === stepId ? null : stepId
}

/** Marca el paso e inmediatamente abre el siguiente pendiente. */
function completeAndAdvance(stepId: string) {
  markStepDone(props.wizard.id, stepId)
  const next = props.wizard.steps.find(s => !isStepDone(props.wizard.id, s.id))
  openStepId.value = next?.id ?? null
}

function checklistKey(stepId: string, index: number): string {
  return `${stepId}::${index}`
}

function handleNavigate(route: string) {
  emit('navigate', route)
  navigateTo(route)
}

function stepShareText(stepIndex: number): string {
  const step = props.wizard.steps[stepIndex]
  if (!step) return ''
  const lines = [`${props.wizard.title} — paso ${stepIndex + 1}: ${step.title}`, '', step.description]
  if (step.checklist?.length) lines.push('', ...step.checklist.map(c => `• ${c}`))
  if (step.tip) lines.push('', `Consejo: ${step.tip}`)
  return lines.join('\n')
}
</script>

<template>
  <div
    :class="[
      'rounded-2xl border bg-white overflow-hidden',
      compact ? 'border-slate-200' : 'border-indigo-200 shadow-lg shadow-indigo-100/50'
    ]"
  >
    <!-- Cabecera con progreso -->
    <div
      :class="[
        'bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white',
        compact ? 'px-3 py-2.5' : 'px-5 py-4'
      ]"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Guía paso a paso
          </p>
          <h3 :class="['font-bold leading-tight mt-1', compact ? 'text-sm' : 'text-lg']">
            {{ wizard.title }}
          </h3>
          <p v-if="!compact" class="text-xs text-white/80 mt-1 leading-relaxed">{{ wizard.description }}</p>
        </div>
        <span class="flex-shrink-0 text-[10px] font-semibold bg-white/20 rounded-full px-2 py-1 backdrop-blur-sm whitespace-nowrap">
          ~{{ wizard.estimatedMinutes }} min
        </span>
      </div>

      <!-- Barra de progreso -->
      <div class="mt-3">
        <div class="flex items-center justify-between text-[11px] font-semibold text-white/85 mb-1.5">
          <span>{{ doneCount }} de {{ wizard.steps.length }} pasos</span>
          <span>{{ progress }}%</span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-white/25 overflow-hidden">
          <div
            class="h-full rounded-full bg-white transition-all duration-500 ease-out"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Mensaje de guía completada -->
    <div v-if="isComplete" class="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border-b border-emerald-100">
      <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p class="text-xs font-semibold text-emerald-800 flex-1">¡Guía completada! Ya dominas este flujo.</p>
      <button
        type="button"
        class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
        @click="resetWizard(wizard.id)"
      >
        Reiniciar
      </button>
    </div>

    <!-- Pasos -->
    <ol class="divide-y divide-slate-100">
      <li
        v-for="(step, index) in wizard.steps"
        :key="step.id"
        :class="[isStepDone(wizard.id, step.id) ? 'bg-emerald-50/30' : 'bg-white']"
      >
        <!-- Encabezado del paso -->
        <div :class="['flex items-start gap-3', compact ? 'px-3 py-2.5' : 'px-4 py-3']">
          <!-- Marcador -->
          <button
            type="button"
            :class="[
              'flex-shrink-0 rounded-full flex items-center justify-center font-bold transition-all mt-0.5',
              compact ? 'w-6 h-6 text-[11px]' : 'w-7 h-7 text-xs',
              isStepDone(wizard.id, step.id)
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
            ]"
            :title="isStepDone(wizard.id, step.id) ? 'Marcar como pendiente' : 'Marcar como completado'"
            :aria-label="`Paso ${index + 1}: ${step.title}`"
            @click="toggleStep(wizard.id, step.id)"
          >
            <svg v-if="isStepDone(wizard.id, step.id)" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </button>

          <!-- Título clicable -->
          <button
            type="button"
            class="flex-1 min-w-0 text-left group"
            @click="toggleOpen(step.id)"
          >
            <p
              :class="[
                'font-semibold leading-snug transition-colors',
                compact ? 'text-xs' : 'text-sm',
                isStepDone(wizard.id, step.id) ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800 group-hover:text-indigo-700'
              ]"
            >
              {{ step.title }}
            </p>
            <p
              v-if="openStepId !== step.id"
              :class="['text-slate-500 line-clamp-1 mt-0.5', compact ? 'text-[11px]' : 'text-xs']"
            >
              {{ step.description }}
            </p>
          </button>

          <svg
            :class="[
              'flex-shrink-0 text-slate-300 transition-transform duration-200 mt-1',
              compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
              openStepId === step.id ? 'rotate-90' : ''
            ]"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <!-- Detalle del paso -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="openStepId === step.id"
            :class="['space-y-3', compact ? 'px-3 pb-3 pl-12' : 'px-4 pb-4 pl-14']"
          >
            <p :class="['text-slate-600 leading-relaxed', compact ? 'text-[11px]' : 'text-sm']">
              {{ step.description }}
            </p>

            <!-- Sub-tareas -->
            <ul v-if="step.checklist?.length" class="space-y-1.5">
              <li
                v-for="(item, itemIndex) in step.checklist"
                :key="item"
                class="flex items-start gap-2"
              >
                <button
                  type="button"
                  :class="[
                    'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 transition-colors',
                    isStepDone(wizard.id, checklistKey(step.id, itemIndex))
                      ? 'bg-indigo-500 border-indigo-500 text-white'
                      : 'border-slate-300 hover:border-indigo-400'
                  ]"
                  :aria-label="item"
                  @click="toggleStep(wizard.id, checklistKey(step.id, itemIndex))"
                >
                  <svg
                    v-if="isStepDone(wizard.id, checklistKey(step.id, itemIndex))"
                    class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <span
                  :class="[
                    'leading-relaxed',
                    compact ? 'text-[11px]' : 'text-xs',
                    isStepDone(wizard.id, checklistKey(step.id, itemIndex)) ? 'text-slate-400 line-through' : 'text-slate-600'
                  ]"
                >
                  {{ item }}
                </span>
              </li>
            </ul>

            <!-- Consejo -->
            <div v-if="step.tip" class="flex items-start gap-2 rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2">
              <svg class="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <p :class="['text-indigo-700 leading-relaxed', compact ? 'text-[11px]' : 'text-xs']">{{ step.tip }}</p>
            </div>

            <!-- Advertencia -->
            <div v-if="step.warning" class="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
              <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <p :class="['text-amber-800 leading-relaxed', compact ? 'text-[11px]' : 'text-xs']">{{ step.warning }}</p>
            </div>

            <!-- Acciones del paso -->
            <div class="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                v-if="step.action && canOpenPanel"
                type="button"
                :class="[
                  'inline-flex items-center gap-1.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-sm shadow-indigo-200 transition-all',
                  compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
                ]"
                @click="handleNavigate(step.action.route)"
              >
                {{ step.action.label }}
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>

              <button
                v-if="!isStepDone(wizard.id, step.id)"
                type="button"
                :class="[
                  'inline-flex items-center gap-1.5 rounded-xl font-semibold border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors',
                  compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
                ]"
                @click="completeAndAdvance(step.id)"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
                Listo, siguiente
              </button>

              <ManualCopyButton
                v-if="!compact"
                :text="stepShareText(index)"
                label="Copiar paso"
                size="xs"
              />
              <ManualShareMenu
                v-if="article && !compact"
                :article="article"
                :section-id="`guia-${step.id}`"
                :section-text="stepShareText(index)"
                compact
                align="left"
              />
            </div>
          </div>
        </Transition>
      </li>
    </ol>
  </div>
</template>
