<script setup lang="ts">
import type { OrderQuoteEvent, OrderQuoteState } from '~/composables/useOrderQuote'
import {
  QUOTE_EVENT_LABELS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VARIANTS,
  buildQuoteUrl,
  buildQuoteWhatsappUrl,
  defaultQuoteValidUntil,
  effectiveQuoteStatus,
  formatQuoteDate
} from '~/utils/quote'

/**
 * Panel «Compartir cotización» de una orden de venta (TRY-29).
 * Genera el enlace público /q/{token}, muestra la respuesta del cliente
 * y la bitácora. El estado solo cambia por RPC (ver useOrderQuote).
 */
interface Props {
  orderId: string
  companyId: string
  orderState: 'draft' | 'posted' | 'cancel'
  orderName?: string | null
  companyName?: string | null
  hasLines?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  orderName: null,
  companyName: null,
  hasLines: false
})

const emit = defineEmits<{
  /** La orden cambió (p. ej. el cliente la aceptó): recargar la página. */
  changed: []
}>()

const {
  lastError,
  getQuoteState,
  getQuoteEvents,
  shareQuote,
  revokeQuote,
  markQuoteResponseSeen
} = useOrderQuote()
const { copy } = useManualShare()

const state = ref<OrderQuoteState | null>(null)
const events = ref<OrderQuoteEvent[]>([])
const isLoading = ref(false)
const isBusy = ref(false)
const error = ref<string | null>(null)
const copied = ref(false)
const validUntil = ref(defaultQuoteValidUntil())
const showHistory = ref(false)

const requestOrigin = useRequestURL().origin

const status = computed(() =>
  effectiveQuoteStatus(state.value?.status, props.orderState, state.value?.validUntil)
)
const quoteUrl = computed(() => (state.value?.token ? buildQuoteUrl(requestOrigin, state.value.token) : null))
const whatsappUrl = computed(() =>
  quoteUrl.value ? buildQuoteWhatsappUrl(quoteUrl.value, props.orderName, props.companyName) : null
)
const canShare = computed(() => props.orderState === 'draft' && props.hasLines)
/** El panel solo aparece en borradores o si la orden ya tuvo cotización. */
const isVisible = computed(() => props.orderState === 'draft' || Boolean(state.value?.status))

const load = async () => {
  if (!props.orderId || !props.companyId) return
  isLoading.value = true
  try {
    const [quoteState, quoteEvents] = await Promise.all([
      getQuoteState(props.orderId, props.companyId),
      getQuoteEvents(props.orderId, props.companyId)
    ])
    state.value = quoteState
    events.value = quoteEvents
    if (quoteState?.validUntil) validUntil.value = quoteState.validUntil

    // Abrir la orden apaga el aviso de la campana
    if (quoteState?.respondedAt && !quoteState.responseSeenAt) {
      await markQuoteResponseSeen(props.orderId)
    }
  } finally {
    isLoading.value = false
  }
}

watch(() => [props.orderId, props.companyId, props.orderState], () => void load(), { immediate: true })

const handleShare = async () => {
  error.value = null
  isBusy.value = true
  try {
    const token = await shareQuote(props.orderId, validUntil.value || null)
    if (!token) {
      error.value = lastError.value ?? 'No se pudo generar el enlace.'
      return
    }
    await load()
    if (quoteUrl.value) await handleCopy()
  } finally {
    isBusy.value = false
  }
}

const handleRevoke = async () => {
  if (import.meta.client && !window.confirm('El enlace actual dejará de funcionar. ¿Revocarlo?')) return
  error.value = null
  isBusy.value = true
  try {
    const ok = await revokeQuote(props.orderId)
    if (!ok) {
      error.value = lastError.value ?? 'No se pudo revocar el enlace.'
      return
    }
    await load()
  } finally {
    isBusy.value = false
  }
}

const handleCopy = async () => {
  if (!quoteUrl.value) return
  const ok = await copy(quoteUrl.value)
  if (!ok) return
  copied.value = true
  setTimeout(() => { copied.value = false }, 1800)
}

const formatDateTime = (value: string | null): string => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

const handleRefresh = async () => {
  await load()
  emit('changed')
}
</script>

<template>
  <section
    v-if="isVisible"
    class="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 sm:p-6"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-2 font-semibold text-slate-800">
          <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Cotización en línea
        </h3>
        <p class="mt-1 text-sm text-slate-500">
          Envía un enlace para que el cliente revise, acepte o rechace sin crear cuenta.
        </p>
      </div>
      <BadgeApp
        v-if="status"
        :label="QUOTE_STATUS_LABELS[status]"
        :variant="QUOTE_STATUS_VARIANTS[status]"
      />
    </div>

    <p v-if="isLoading && !state" class="mt-4 text-sm text-slate-500">Cargando…</p>

    <!-- Respuesta del cliente -->
    <div
      v-if="state?.respondedAt"
      class="mt-4 rounded-xl px-4 py-3 text-sm"
      :class="state.status === 'accepted' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'"
    >
      <p class="font-semibold">
        {{ state.status === 'accepted' ? 'Aceptada' : 'Rechazada' }} por {{ state.responseName ?? 'el cliente' }}
        · {{ formatDateTime(state.respondedAt) }}
      </p>
      <p v-if="state.responseNote" class="mt-1 whitespace-pre-line">«{{ state.responseNote }}»</p>
      <p v-if="state.status === 'accepted'" class="mt-1 text-xs opacity-80">
        La orden se confirmó sola. Prepara la entrega desde el menú de la orden.
      </p>
    </div>

    <!-- Enlace activo -->
    <div v-if="quoteUrl" class="mt-4 space-y-3">
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          :value="quoteUrl"
          readonly
          class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          aria-label="Enlace de la cotización"
          @focus="($event.target as HTMLInputElement).select()"
        >
        <div class="flex gap-2">
          <BtnApp size="sm" :label="copied ? '¡Copiado!' : 'Copiar enlace'" @click="handleCopy" />
          <a
            v-if="whatsappUrl"
            :href="whatsappUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            WhatsApp
          </a>
        </div>
      </div>
      <p class="text-xs text-slate-500">
        <span v-if="state?.validUntil">Vigente hasta el {{ formatQuoteDate(state.validUntil) }}.</span>
        <span v-else>Sin fecha de vigencia.</span>
        <span v-if="state?.viewedAt"> El cliente la abrió el {{ formatDateTime(state.viewedAt) }}.</span>
        <span v-else-if="status === 'shared'"> El cliente aún no la abre.</span>
      </p>
    </div>

    <!-- Compartir / renovar -->
    <div v-if="canShare" class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="sm:w-56">
        <FormInput
          v-model="validUntil"
          type="date"
          label="Vigente hasta"
          hint="Déjalo vacío si no vence"
          size="sm"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <BtnApp
          size="sm"
          :label="state?.token ? 'Actualizar vigencia' : 'Compartir cotización'"
          :loading="isBusy"
          @click="handleShare"
        />
        <BtnApp
          v-if="state?.token"
          size="sm"
          variant="ghost"
          label="Revocar enlace"
          :disabled="isBusy"
          @click="handleRevoke"
        />
        <BtnApp
          v-if="state?.token"
          size="sm"
          variant="ghost"
          label="Actualizar estado"
          :disabled="isBusy"
          @click="handleRefresh"
        />
      </div>
    </div>
    <p v-else-if="orderState === 'draft' && !hasLines" class="mt-4 text-sm text-slate-500">
      Agrega al menos una línea para compartir la cotización.
    </p>

    <p v-if="error" class="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{{ error }}</p>

    <!-- Bitácora -->
    <div v-if="events.length" class="mt-4">
      <button
        type="button"
        class="text-sm font-medium text-indigo-600 hover:underline"
        @click="showHistory = !showHistory"
      >
        {{ showHistory ? 'Ocultar historial' : `Ver historial (${events.length})` }}
      </button>
      <ol v-if="showHistory" class="mt-3 space-y-2 border-l-2 border-indigo-100 pl-4 text-sm">
        <li v-for="event in events" :key="event.id">
          <p class="text-slate-700">
            <span class="font-medium">{{ QUOTE_EVENT_LABELS[event.event_type] ?? event.event_type }}</span>
            <span v-if="event.actor_name" class="text-slate-500"> · {{ event.actor_name }}</span>
          </p>
          <p class="text-xs text-slate-400">
            {{ formatDateTime(event.created_at) }}
            <span v-if="event.event_type === 'shared' && event.valid_until"> · vigente hasta {{ formatQuoteDate(event.valid_until) }}</span>
          </p>
          <p v-if="event.note" class="mt-0.5 text-xs text-slate-500">«{{ event.note }}»</p>
        </li>
      </ol>
    </div>
  </section>
</template>
