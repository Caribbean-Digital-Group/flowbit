<script setup lang="ts">
import type { PublicQuoteResult } from '~/composables/useOrderQuote'
import type { QuoteDecision } from '~/utils/quote'
import {
  QUOTE_NAME_MAX,
  QUOTE_NOTE_MAX,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VARIANTS,
  canRespondToQuote,
  formatQuoteDate,
  formatQuoteMoney,
  validateQuoteResponse
} from '~/utils/quote'

definePageMeta({
  layout: 'public'
})

const route = useRoute()
const token = computed(() => {
  const raw = route.params.token
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const { getPublicQuote, respondToQuote, lastError } = useOrderQuote()

const isLoading = ref(true)
const result = ref<PublicQuoteResult | null>(null)

// Formulario de respuesta
const decision = ref<QuoteDecision | null>(null)
const responseName = ref('')
const responseNote = ref('')
const formError = ref<string | null>(null)
const isSubmitting = ref(false)

useHead({
  title: 'Cotización · Flowbit',
  meta: [
    // Una cotización es privada: nunca debe indexarse
    { name: 'robots', content: 'noindex,nofollow' },
    { name: 'referrer', content: 'no-referrer' },
    { name: 'description', content: 'Cotización compartida desde Flowbit.' }
  ]
})

const loadQuote = async () => {
  isLoading.value = true
  try {
    result.value = await getPublicQuote(token.value)
  } finally {
    isLoading.value = false
  }
}

watch(token, () => void loadQuote(), { immediate: true })

const quoteData = computed(() =>
  result.value && 'quote' in result.value ? result.value : null
)
const canRespond = computed(() => (quoteData.value ? canRespondToQuote(quoteData.value.status) : false))
const accentColor = computed(() => quoteData.value?.company.primary_color || '#6366f1')

const startResponse = (value: QuoteDecision) => {
  decision.value = value
  formError.value = null
}

const submitResponse = async () => {
  if (!decision.value) return
  formError.value = validateQuoteResponse(decision.value, responseName.value, responseNote.value)
  if (formError.value) return

  isSubmitting.value = true
  try {
    const status = await respondToQuote(token.value, decision.value, responseName.value, responseNote.value)
    if (!status) {
      formError.value = lastError.value ?? 'No se pudo registrar tu respuesta. Intenta de nuevo.'
      return
    }
    decision.value = null
    await loadQuote()
  } finally {
    isSubmitting.value = false
  }
}

const printQuote = () => {
  if (import.meta.client) window.print()
}

const statusMessage = computed(() => {
  const data = quoteData.value
  if (!data) return null
  switch (data.status) {
    case 'accepted':
      return `Aceptada por ${data.quote.response_name ?? 'el cliente'} el ${formatQuoteDate(data.quote.responded_at)}. ¡Gracias! La empresa ya recibió tu confirmación.`
    case 'rejected':
      return `Rechazada por ${data.quote.response_name ?? 'el cliente'} el ${formatQuoteDate(data.quote.responded_at)}. Gracias por avisarnos.`
    case 'expired':
      return `Esta cotización venció el ${formatQuoteDate(data.quote.valid_until)}. Pide a la empresa una cotización actualizada.`
    case 'revoked':
      return 'La empresa retiró esta cotización. Ponte en contacto con ella para recibir una nueva.'
    case 'closed':
      return 'La empresa ya confirmó esta orden.'
    case 'cancelled':
      return 'La empresa canceló esta cotización.'
    default:
      return null
  }
})
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <!-- Cargando -->
    <div v-if="isLoading" class="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-lg shadow-slate-200/50">
      Cargando cotización…
    </div>

    <!-- No existe o el enlace fue revocado -->
    <div
      v-else-if="!quoteData"
      class="rounded-2xl bg-white p-10 text-center shadow-lg shadow-slate-200/50"
    >
      <h1 class="text-xl font-semibold text-slate-800">
        {{ result?.status === 'error' ? 'No pudimos abrir la cotización' : 'Cotización no disponible' }}
      </h1>
      <p class="mt-2 text-slate-500">
        {{
          result?.status === 'error'
            ? 'Intenta de nuevo en unos minutos.'
            : 'El enlace no es válido o la empresa lo retiró. Pídele uno nuevo.'
        }}
      </p>
    </div>

    <template v-else>
      <!-- Aviso de estado -->
      <div
        v-if="statusMessage"
        class="mb-4 rounded-2xl border px-6 py-4 print:hidden"
        :class="quoteData.status === 'accepted'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : quoteData.status === 'rejected' || quoteData.status === 'cancelled'
            ? 'border-red-100 bg-red-50 text-red-700'
            : 'border-amber-200 bg-amber-50 text-amber-900'"
      >
        {{ statusMessage }}
      </div>

      <article class="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50 print:shadow-none">
        <div class="h-1.5" :style="{ backgroundColor: accentColor }" />

        <!-- Encabezado: empresa y folio -->
        <header class="flex flex-col gap-6 border-b border-slate-100 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div class="flex items-start gap-4">
            <img
              v-if="quoteData.company.logo_url"
              :src="quoteData.company.logo_url"
              :alt="quoteData.company.name ?? 'Logo'"
              class="h-14 w-14 rounded-xl object-contain"
            >
            <div>
              <p class="text-lg font-semibold text-slate-800">{{ quoteData.company.name }}</p>
              <p v-if="quoteData.company.legal_name" class="text-sm text-slate-500">{{ quoteData.company.legal_name }}</p>
              <p v-if="quoteData.company.vat" class="text-sm text-slate-500">RFC: {{ quoteData.company.vat }}</p>
              <p class="mt-1 text-sm text-slate-500">
                <span v-if="quoteData.company.email">{{ quoteData.company.email }}</span>
                <span v-if="quoteData.company.email && quoteData.company.phone"> · </span>
                <span v-if="quoteData.company.phone">{{ quoteData.company.phone }}</span>
              </p>
            </div>
          </div>

          <div class="sm:text-right">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Cotización</p>
            <p class="text-2xl font-bold text-slate-800">{{ quoteData.quote.name ?? '—' }}</p>
            <div class="mt-2">
              <BadgeApp
                :label="QUOTE_STATUS_LABELS[quoteData.status]"
                :variant="QUOTE_STATUS_VARIANTS[quoteData.status]"
              />
            </div>
          </div>
        </header>

        <!-- Datos generales -->
        <section class="grid gap-4 border-b border-slate-100 p-6 text-sm sm:grid-cols-3 sm:p-8">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Cliente</p>
            <p class="mt-1 text-slate-800">{{ quoteData.quote.customer_name ?? '—' }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</p>
            <p class="mt-1 text-slate-800">{{ formatQuoteDate(quoteData.quote.order_date) }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Vigente hasta</p>
            <p class="mt-1 text-slate-800">
              {{ quoteData.quote.valid_until ? formatQuoteDate(quoteData.quote.valid_until) : 'Sin fecha límite' }}
            </p>
          </div>
        </section>

        <!-- Líneas: tabla en escritorio, tarjetas en móvil -->
        <section class="p-6 sm:p-8">
          <table class="hidden w-full text-sm sm:table">
            <thead>
              <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th class="py-2 pr-4 font-semibold">Concepto</th>
                <th class="py-2 pr-4 text-right font-semibold">Cantidad</th>
                <th class="py-2 pr-4 text-right font-semibold">Precio</th>
                <th class="py-2 pr-4 text-right font-semibold">Desc.</th>
                <th class="py-2 text-right font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(line, index) in quoteData.lines" :key="index" class="border-b border-slate-100">
                <td class="py-3 pr-4 text-slate-800">{{ line.description ?? 'Artículo' }}</td>
                <td class="py-3 pr-4 text-right text-slate-600">{{ line.quantity }}</td>
                <td class="py-3 pr-4 text-right text-slate-600">{{ formatQuoteMoney(line.unit_price, quoteData.quote.currency) }}</td>
                <td class="py-3 pr-4 text-right text-slate-600">{{ line.discount_percent ? `${line.discount_percent}%` : '—' }}</td>
                <td class="py-3 text-right font-medium text-slate-800">{{ formatQuoteMoney(line.subtotal, quoteData.quote.currency) }}</td>
              </tr>
            </tbody>
          </table>

          <ul class="space-y-3 sm:hidden">
            <li v-for="(line, index) in quoteData.lines" :key="index" class="rounded-xl border border-slate-100 p-3 text-sm">
              <p class="font-medium text-slate-800">{{ line.description ?? 'Artículo' }}</p>
              <p class="mt-1 flex justify-between text-slate-500">
                <span>{{ line.quantity }} × {{ formatQuoteMoney(line.unit_price, quoteData.quote.currency) }}</span>
                <span class="font-medium text-slate-800">{{ formatQuoteMoney(line.subtotal, quoteData.quote.currency) }}</span>
              </p>
            </li>
          </ul>

          <!-- Totales -->
          <dl class="ml-auto mt-6 w-full max-w-xs space-y-1.5 text-sm">
            <div class="flex justify-between text-slate-500">
              <dt>Subtotal</dt>
              <dd>{{ formatQuoteMoney(quoteData.quote.amount_untaxed, quoteData.quote.currency) }}</dd>
            </div>
            <div v-if="quoteData.quote.amount_discount > 0" class="flex justify-between text-slate-500">
              <dt>Descuento</dt>
              <dd>−{{ formatQuoteMoney(quoteData.quote.amount_discount, quoteData.quote.currency) }}</dd>
            </div>
            <div class="flex justify-between text-slate-500">
              <dt>Impuestos</dt>
              <dd>{{ formatQuoteMoney(quoteData.quote.amount_tax, quoteData.quote.currency) }}</dd>
            </div>
            <div class="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-800">
              <dt>Total</dt>
              <dd>{{ formatQuoteMoney(quoteData.quote.amount_total, quoteData.quote.currency) }}</dd>
            </div>
          </dl>
        </section>

        <!-- Condiciones -->
        <section
          v-if="quoteData.quote.payment_term || quoteData.quote.notes"
          class="border-t border-slate-100 p-6 text-sm sm:p-8"
        >
          <p v-if="quoteData.quote.payment_term" class="text-slate-600">
            <span class="font-semibold text-slate-800">Condiciones de pago:</span> {{ quoteData.quote.payment_term }}
          </p>
          <p v-if="quoteData.quote.notes" class="mt-2 whitespace-pre-line text-slate-600">{{ quoteData.quote.notes }}</p>
        </section>
      </article>

      <!-- Acciones del cliente -->
      <section class="mt-6 rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/50 print:hidden sm:p-8">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-500">
            {{ canRespond ? '¿Todo en orden? Responde aquí mismo, no necesitas cuenta.' : 'Puedes imprimir o guardar esta cotización en PDF.' }}
          </p>
          <div class="flex flex-wrap gap-2">
            <BtnApp variant="ghost" label="Imprimir / PDF" @click="printQuote" />
            <template v-if="canRespond && !decision">
              <BtnApp variant="outline" label="Rechazar" @click="startResponse('reject')" />
              <BtnApp variant="success" label="Aceptar cotización" @click="startResponse('accept')" />
            </template>
          </div>
        </div>

        <form v-if="canRespond && decision" class="mt-6 space-y-4 border-t border-slate-100 pt-6" @submit.prevent="submitResponse">
          <p class="font-semibold text-slate-800">
            {{ decision === 'accept' ? 'Aceptar la cotización' : 'Rechazar la cotización' }}
          </p>
          <FormInput
            v-model="responseName"
            label="Tu nombre"
            placeholder="Nombre de quien responde"
            :maxlength="QUOTE_NAME_MAX"
            required
          />
          <FormTextArea
            v-model="responseNote"
            :label="decision === 'accept' ? 'Comentario (opcional)' : 'Motivo del rechazo'"
            :placeholder="decision === 'accept' ? 'Ej. Entregar en la sucursal centro' : 'Ej. El precio supera nuestro presupuesto'"
            :maxlength="QUOTE_NOTE_MAX"
            :required="decision === 'reject'"
            :rows="3"
            show-count
          />
          <p v-if="decision === 'accept'" class="text-xs text-slate-500">
            Al aceptar confirmas el pedido por {{ formatQuoteMoney(quoteData.quote.amount_total, quoteData.quote.currency) }}.
            La empresa recibirá tu confirmación al instante.
          </p>
          <p v-if="formError" class="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{{ formError }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <BtnApp variant="ghost" label="Volver" :disabled="isSubmitting" @click="decision = null" />
            <BtnApp
              type="submit"
              :variant="decision === 'accept' ? 'success' : 'danger'"
              :label="decision === 'accept' ? 'Confirmar aceptación' : 'Enviar rechazo'"
              :loading="isSubmitting"
            />
          </div>
        </form>
      </section>

      <p class="mt-6 text-center text-xs text-slate-400 print:hidden">
        Cotización generada con <NuxtLink to="/" class="font-medium text-indigo-600 hover:underline">Flowbit</NuxtLink>, el ERP open source.
      </p>
    </template>
  </div>
</template>
