<script setup lang="ts">
interface Props {
  /** Ruta base de la tienda (para enlazar la política de privacidad) */
  basePath: string
  primaryColor: string
}

const props = defineProps<Props>()

const { consent, setConsent } = useStorefrontTracker()

/** Solo se muestra tras montar en cliente y si aún no hay decisión */
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

const isVisible = computed(() => isMounted.value && consent.value === 'unknown')

const accept = () => setConsent('granted')
const decline = () => setConsent('denied')
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-6"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-6"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-4 inset-x-4 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-md z-50"
      role="dialog"
      aria-label="Aviso de cookies"
    >
      <div class="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-300/40 p-5">
        <div class="flex items-start gap-3">
          <div
            class="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white"
            :style="{ backgroundColor: props.primaryColor }"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 3a9 9 0 109 9 3 3 0 01-4-3 3 3 0 01-3-3 3 3 0 01-2-3zM8.5 10.5h.01M10.5 15.5h.01M15 13h.01"
              />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800">Cookies y analítica</p>
            <p class="mt-1 text-xs text-slate-500 leading-relaxed">
              Usamos cookies propias para medir visitas y mejorar la tienda.
              No compartimos tus datos con terceros.
              <NuxtLink
                :to="`${props.basePath}/about#politicas`"
                class="underline hover:text-slate-700"
              >
                Más información
              </NuxtLink>
            </p>
          </div>
        </div>

        <div class="mt-4 flex gap-2">
          <button
            type="button"
            class="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            :style="{ backgroundColor: props.primaryColor }"
            @click="accept"
          >
            Aceptar
          </button>
          <button
            type="button"
            class="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            @click="decline"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
