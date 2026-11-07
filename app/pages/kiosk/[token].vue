<script setup lang="ts">
import type { KioskInfo, KioskPunchResult } from '~/types/hr.types'

/**
 * Kiosco público de asistencia. No requiere sesión: el token de la URL
 * identifica al kiosco y cada persona marca con su NIP.
 */
definePageMeta({ layout: false })

useHead({
  title: 'Kiosco de asistencia · Flowbit',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' }
  ]
})

const route = useRoute()
const { info: fetchInfo, punch } = useKioskPublic()

const token = computed(() => String(route.params.token ?? ''))
const info = ref<KioskInfo | null>(null)
const isLoading = ref(true)
const pin = ref('')
const isSubmitting = ref(false)
const result = ref<KioskPunchResult | null>(null)
const now = ref(new Date())

let clock: ReturnType<typeof setInterval> | null = null
let resetTimer: ReturnType<typeof setTimeout> | null = null

const timezone = computed(() => info.value?.timezone ?? 'America/Mexico_City')
const minLength = computed(() => info.value?.pin_min_length ?? 4)

const timeText = computed(() => new Intl.DateTimeFormat('es-MX', {
  timeZone: timezone.value, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(now.value))

const dateText = computed(() => new Intl.DateTimeFormat('es-MX', {
  timeZone: timezone.value, weekday: 'long', day: 'numeric', month: 'long'
}).format(now.value))

const scheduleReset = () => {
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    result.value = null
    pin.value = ''
  }, 5000)
}

const press = (digit: string) => {
  if (isSubmitting.value) return
  if (result.value) result.value = null
  if (pin.value.length < 8) pin.value += digit
}

const backspace = () => {
  pin.value = pin.value.slice(0, -1)
}

const submit = async () => {
  if (pin.value.length < minLength.value || isSubmitting.value) return
  isSubmitting.value = true
  try {
    result.value = await punch(token.value, pin.value)
      ?? { ok: false, error: 'invalid_kiosk' }
  } finally {
    pin.value = ''
    isSubmitting.value = false
    scheduleReset()
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (/^\d$/.test(event.key)) press(event.key)
  else if (event.key === 'Backspace') backspace()
  else if (event.key === 'Enter') void submit()
}

onMounted(async () => {
  clock = setInterval(() => { now.value = new Date() }, 1000)
  window.addEventListener('keydown', onKeydown)
  try {
    info.value = await fetchInfo(token.value)
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  if (resetTimer) clearTimeout(resetTimer)
  window.removeEventListener('keydown', onKeydown)
})

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 px-4 py-6 text-white sm:py-10">
    <div class="mx-auto flex max-w-md flex-col items-center">
      <div v-if="isLoading" class="mt-24 text-white/80">
        Cargando kiosco…
      </div>

      <div v-else-if="!info" class="mt-24 rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
        <p class="text-xl font-semibold">
          Kiosco no disponible
        </p>
        <p class="mt-2 text-white/80">
          Esta dirección ya no está activa. Pide a un administrador la nueva dirección del kiosco.
        </p>
      </div>

      <template v-else>
        <div class="mb-6 flex items-center gap-3">
          <img v-if="info.company_logo" :src="info.company_logo" alt="" class="h-10 w-10 rounded-xl bg-white object-contain p-1">
          <div>
            <p class="text-lg font-semibold leading-tight">
              {{ info.company_name }}
            </p>
            <p class="text-sm text-white/75">
              {{ info.kiosk_name }}<template v-if="info.location">
                · {{ info.location }}
              </template>
            </p>
          </div>
        </div>

        <p class="text-6xl font-bold tabular-nums tracking-tight sm:text-7xl">
          {{ timeText }}
        </p>
        <p class="mt-1 mb-8 capitalize text-white/80">
          {{ dateText }}
        </p>

        <div class="w-full rounded-2xl bg-white p-6 text-slate-800 shadow-2xl">
          <div
            v-if="result"
            :class="[
              'mb-5 rounded-xl px-4 py-4 text-center',
              result.ok ? (result.action === 'check_in' ? 'bg-emerald-50 text-emerald-800' : 'bg-indigo-50 text-indigo-800') : 'bg-red-50 text-red-700'
            ]"
            role="status"
            aria-live="polite"
          >
            <template v-if="result.ok">
              <p class="text-lg font-semibold">
                {{ result.action === 'check_in' ? '¡Bienvenido(a)' : '¡Hasta luego' }}, {{ result.employee_name }}!
              </p>
              <p class="text-sm">
                {{ result.action === 'check_in' ? 'Entrada' : 'Salida' }} registrada a las {{ formatClockTime(result.at, timezone) }}
                <template v-if="result.action === 'check_out'">
                  · hoy: {{ formatMinutes(result.worked_minutes_today) }}
                </template>
              </p>
            </template>
            <p v-else class="font-medium">
              {{ KIOSK_ERROR_MESSAGES[result.error] ?? 'No se pudo registrar la marca.' }}
            </p>
          </div>

          <p class="mb-3 text-center text-sm text-slate-500">
            Ingresa tu NIP para marcar entrada o salida
          </p>
          <div class="mb-5 flex h-12 items-center justify-center gap-3" aria-label="NIP">
            <span
              v-for="i in Math.max(minLength, pin.length)"
              :key="i"
              :class="['h-4 w-4 rounded-full', i <= pin.length ? 'bg-indigo-600' : 'bg-slate-200']"
            />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="k in keys"
              :key="k"
              type="button"
              class="h-16 rounded-xl bg-slate-100 text-2xl font-semibold text-slate-800 transition active:scale-95 hover:bg-slate-200"
              @click="press(k)"
            >
              {{ k }}
            </button>
            <button
              type="button"
              class="h-16 rounded-xl bg-slate-100 text-slate-600 transition active:scale-95 hover:bg-slate-200"
              aria-label="Borrar"
              @click="backspace"
            >
              <svg class="mx-auto h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
            <button
              type="button"
              class="h-16 rounded-xl bg-slate-100 text-2xl font-semibold text-slate-800 transition active:scale-95 hover:bg-slate-200"
              @click="press('0')"
            >
              0
            </button>
            <button
              type="button"
              :disabled="pin.length < minLength || isSubmitting"
              class="h-16 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-600 text-lg font-semibold text-white transition active:scale-95 disabled:opacity-40"
              @click="submit"
            >
              {{ isSubmitting ? '…' : 'Marcar' }}
            </button>
          </div>
        </div>

        <p class="mt-6 text-center text-xs text-white/60">
          Flowbit · Kiosco de asistencia
        </p>
      </template>
    </div>
  </div>
</template>
