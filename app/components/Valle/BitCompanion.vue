<script setup lang="ts">
import type { LocationId, ValleLocation } from '~/utils/valle/types'
import { VALLE_LOCATIONS } from '~/utils/valle/locations'

/**
 * Bit, el guía del valle. Acompaña en todo el mapa:
 * - al llegar a un lugar explica qué es y qué pasa hoy ahí (globo);
 * - su panel abre la ayuda del manual con el contexto de ese lugar;
 * - en la primera visita ofrece un recorrido corto.
 *
 * El contenido de ayuda sale del manual (`useManual().getContextForRoute`),
 * igual que el asistente del panel: aquí el contexto es la ubicación.
 */
interface Props {
  /** Ubicación donde está el avatar (cerca o dentro), si la hay. */
  location: ValleLocation | null
  /** Dato vivo de esa ubicación. */
  liveLine: string | null
  /** Lo más urgente del día, para cuando el avatar está en el camino. */
  urgentLine: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  go: [id: LocationId]
  'open-location': [id: LocationId]
  'busy-change': [busy: boolean]
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const STORAGE_KEY = 'flowbit:valle-bit'
const BUBBLE_MS = 9000

interface BitPrefs {
  muted: boolean
  tourDone: boolean
}

const TOUR_STEPS: { title: string; text: string }[] = [
  {
    title: '¡Bienvenido a Valle Bit!',
    text: 'Soy Bit. Este valle es tu empresa: cada lugar es un módulo de Flowbit y todo lo que ves son tus datos reales.'
  },
  {
    title: 'Cómo moverte',
    text: 'Camina con las flechas o WASD, o toca el punto del mapa al que quieras ir. En el celular también tienes un joystick. Para entrar a un lugar, acércate a su puerta y pulsa «Entrar» o la tecla E.'
  },
  {
    title: 'Los marcadores',
    text: 'Arriba siempre ves lo más importante del mes: cobrado, gastos, utilidad, ingresos previstos, por cobrar, stock bajo y pendientes. Toca uno y te llevo al lugar donde se explica.'
  },
  {
    title: 'Los lugares',
    text: 'En el Mercado están tus ventas, en el Banco tus finanzas, en el Almacén tu inventario… Dentro de cada uno ves su resumen y puedes abrirlo en el panel.'
  },
  {
    title: 'Estoy contigo',
    text: 'Te sigo por todo el valle. Al llegar a un lugar te cuento qué es y qué pasa hoy ahí. Tócame (o pulsa B) cuando tengas dudas.'
  }
]

const { getContextForRoute } = useManual()

const prefs = ref<BitPrefs>({ muted: false, tourDone: true })
const tourStep = ref<number | null>(null)
const bubbleLocation = ref<ValleLocation | null>(null)
/** Lugares ya presentados en esta visita: el globo sale una vez por lugar. */
const greeted = new Set<LocationId>()
let bubbleTimer: ReturnType<typeof setTimeout> | null = null

const persist = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs.value))
  } catch {
    // modo privado: las preferencias duran lo que dure la visita
  }
}

const article = computed(() =>
  props.location ? getContextForRoute(props.location.adminRoute.split('?')[0] ?? '') : undefined)

const tour = computed(() => (tourStep.value === null ? null : TOUR_STEPS[tourStep.value] ?? null))

const hideBubble = () => {
  if (bubbleTimer) clearTimeout(bubbleTimer)
  bubbleTimer = null
  bubbleLocation.value = null
}

const startTour = () => {
  isOpen.value = false
  hideBubble()
  tourStep.value = 0
}

/** Presenta el lugar actual si aún no se ha presentado en esta visita. */
const greet = () => {
  const place = props.location
  if (!place || prefs.value.muted || greeted.has(place.id) || tourStep.value !== null || isOpen.value) return
  greeted.add(place.id)
  bubbleLocation.value = place
  bubbleTimer = setTimeout(hideBubble, BUBBLE_MS)
}

const endTour = () => {
  tourStep.value = null
  prefs.value = { ...prefs.value, tourDone: true }
  persist()
  // El avatar aparece junto a la Plaza: al terminar el recorrido, Bit la presenta.
  greet()
}

const nextTourStep = () => {
  if (tourStep.value === null) return
  if (tourStep.value >= TOUR_STEPS.length - 1) endTour()
  else tourStep.value += 1
}

const toggleMuted = () => {
  prefs.value = { ...prefs.value, muted: !prefs.value.muted }
  persist()
  if (prefs.value.muted) hideBubble()
}

const goTo = (id: LocationId) => {
  isOpen.value = false
  emit('go', id)
}

watch(() => props.location?.id, () => {
  hideBubble()
  greet()
})

watch(isOpen, open => { if (open) hideBubble() })

watch(() => isOpen.value || tourStep.value !== null, busy => emit('busy-change', busy))

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) isOpen.value = false
}

onMounted(() => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const saved = raw ? JSON.parse(raw) as Partial<BitPrefs> : {}
    prefs.value = { muted: saved.muted === true, tourDone: saved.tourDone === true }
  } catch {
    prefs.value = { muted: false, tourDone: false }
  }
  if (!prefs.value.tourDone) tourStep.value = 0
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  hideBubble()
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <!-- Globo al llegar a un lugar -->
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-150"
    leave-to-class="opacity-0"
  >
    <div
      v-if="bubbleLocation"
      class="absolute inset-x-3 bottom-40 z-20 mx-auto max-w-md rounded-2xl bg-white px-4 py-3 shadow-xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:mx-0"
      role="status"
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl leading-none" aria-hidden="true">🤖</span>
        <div class="min-w-0 flex-1 text-sm text-slate-700">
          <p>{{ bubbleLocation.welcome }}</p>
          <p v-if="liveLine" class="mt-1 font-semibold text-slate-900">{{ liveLine }}</p>
          <button
            type="button"
            class="mt-2 text-xs font-semibold text-violet-700 hover:underline focus:outline-none focus-visible:underline"
            @click="isOpen = true"
          >
            Cuéntame más
          </button>
        </div>
        <button
          type="button"
          class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label="Cerrar mensaje de Bit"
          @click="hideBubble"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>

  <!-- Botón de Bit, siempre a la mano -->
  <button
    type="button"
    class="absolute bottom-24 right-3 z-20 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-2xl shadow-lg shadow-violet-900/40 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:bottom-6 sm:right-6"
    aria-label="Abrir la ayuda de Bit"
    :aria-expanded="isOpen"
    @click="isOpen = !isOpen"
  >
    <span aria-hidden="true">🤖</span>
  </button>

  <!-- Panel de ayuda -->
  <div v-if="isOpen" class="absolute inset-0 z-40 flex items-end justify-center sm:items-end sm:justify-end sm:p-6">
    <div class="absolute inset-0 bg-slate-900/40" aria-hidden="true" @click="isOpen = false" />
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Ayuda de Bit"
      class="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:w-[24rem] sm:rounded-3xl"
    >
      <header class="flex items-center gap-3 bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-5 py-4 text-white">
        <span class="text-2xl leading-none" aria-hidden="true">🤖</span>
        <div class="min-w-0 flex-1">
          <h2 class="font-bold">Bit, tu guía</h2>
          <p class="truncate text-sm text-white/85">
            {{ location ? `Estás en: ${location.name}` : 'Estás en el camino' }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl bg-white/15 p-2 hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Cerrar la ayuda de Bit"
          @click="isOpen = false"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm text-slate-700">
        <template v-if="location">
          <p>{{ location.welcome }}</p>
          <p v-if="liveLine" class="rounded-2xl bg-violet-50 px-4 py-3 font-semibold text-violet-900">{{ liveLine }}</p>

          <template v-if="article">
            <div>
              <h3 class="mb-1 font-semibold text-slate-800">{{ article.moduleEmoji }} {{ article.title }}</h3>
              <p class="text-slate-600">{{ article.summary ?? article.description }}</p>
            </div>
            <div v-if="article.tips.length">
              <h3 class="mb-1 font-semibold text-slate-800">Consejos</h3>
              <ul class="list-disc space-y-1 pl-5 text-slate-600">
                <li v-for="tip in article.tips.slice(0, 4)" :key="tip">{{ tip }}</li>
              </ul>
            </div>
            <div v-if="article.faqs?.length">
              <h3 class="mb-1 font-semibold text-slate-800">Preguntas frecuentes</h3>
              <details
                v-for="faq in article.faqs.slice(0, 4)"
                :key="faq.question"
                class="border-b border-slate-100 py-2 last:border-0"
              >
                <summary class="cursor-pointer font-medium text-slate-700">{{ faq.question }}</summary>
                <p class="mt-1 text-slate-600">{{ faq.answer }}</p>
              </details>
            </div>
          </template>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              @click="isOpen = false; emit('open-location', location.id)"
            >
              Ver datos de {{ location.name }}
            </button>
            <NuxtLink
              v-if="article"
              :to="`/manual/${article.id}`"
              class="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Leer la guía completa
            </NuxtLink>
            <NuxtLink
              :to="location.adminRoute"
              class="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Abrir en el panel
            </NuxtLink>
          </div>
        </template>

        <template v-else>
          <p class="rounded-2xl bg-violet-50 px-4 py-3 font-semibold text-violet-900">{{ urgentLine }}</p>
          <p>
            Camina con las flechas o WASD, o toca el mapa. Acércate a una puerta y pulsa «Entrar» o la tecla E.
            Dime a dónde quieres ir y te llevo:
          </p>
        </template>

        <div>
          <h3 class="mb-2 font-semibold text-slate-800">{{ location ? 'Ir a otro lugar' : 'Lugares del valle' }}</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="place in VALLE_LOCATIONS"
              :key="place.id"
              type="button"
              class="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              @click="goTo(place.id)"
            >
              <span aria-hidden="true">{{ place.emoji }}</span> {{ place.name }}
            </button>
          </div>
        </div>
      </div>

      <footer class="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs">
        <button
          type="button"
          class="font-semibold text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:underline"
          :aria-pressed="prefs.muted"
          @click="toggleMuted"
        >
          {{ prefs.muted ? '🔔 Activar avisos de Bit' : '🔕 Bit en modo discreto' }}
        </button>
        <button
          type="button"
          class="font-semibold text-violet-700 hover:underline focus:outline-none focus-visible:underline"
          @click="startTour"
        >
          Repetir el recorrido
        </button>
      </footer>
    </section>
  </div>

  <!-- Recorrido inicial -->
  <div v-if="tour" class="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
    <section
      role="dialog"
      aria-modal="true"
      :aria-label="tour.title"
      class="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
    >
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-3xl" aria-hidden="true">
        🤖
      </div>
      <h2 class="mt-4 text-lg font-bold text-slate-800">{{ tour.title }}</h2>
      <p class="mt-2 text-sm text-slate-600">{{ tour.text }}</p>
      <p class="mt-4 text-xs text-slate-400" aria-live="polite">
        Paso {{ (tourStep ?? 0) + 1 }} de {{ TOUR_STEPS.length }}
      </p>
      <div class="mt-4 flex gap-2">
        <BtnApp variant="ghost" class="flex-1" @click="endTour">Saltar</BtnApp>
        <BtnApp variant="primary" class="flex-1" @click="nextTourStep">
          {{ (tourStep ?? 0) >= TOUR_STEPS.length - 1 ? '¡A explorar!' : 'Siguiente' }}
        </BtnApp>
      </div>
    </section>
  </div>
</template>
