<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StorefrontOrderSummary, StorefrontOrderLine } from '~/composables/useStorefront'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const storefrontStore = useStorefrontStore()
const { store, lastOrder, primaryColor } = storeToRefs(storefrontStore)
const { getOrder } = useStorefront()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const orderRef = computed(() => {
  const raw = route.params.order_ref
  return decodeURIComponent((Array.isArray(raw) ? raw[0] : raw) ?? '')
})

const basePath = computed(() => storefrontPath(companySlug.value))

const order = ref<StorefrontOrderSummary | null>(null)
const lines = ref<StorefrontOrderLine[]>([])
const isLoading = ref(false)
const notFound = ref(false)

/** Email para consultar la orden: viene del checkout o lo escribe el cliente */
const emailInput = ref('')
const askEmail = ref(false)

// ── Pago con Stripe ──────────────────────────────────────────────────────
const isVerifyingPayment = ref(false)
const isStartingPayment = ref(false)
const paymentError = ref<string | null>(null)

const paymentCancelled = computed(
  () => route.query.stripe === 'cancelled' && order.value?.payment_status !== 'paid'
)
const canPayWithStripe = computed(
  () =>
    !!order.value &&
    order.value.payment_provider === 'stripe' &&
    order.value.payment_status !== 'paid'
)

/**
 * Al volver de Stripe (?stripe=success) el webhook puede no haber llegado
 * aún: pedir al backend que verifique la sesión y marque la orden pagada.
 */
const verifyStripePayment = async (email: string) => {
  if (!order.value || order.value.payment_provider !== 'stripe') return
  if (order.value.payment_status === 'paid') return
  if (route.query.stripe !== 'success' && !route.query.session_id) return

  isVerifyingPayment.value = true
  try {
    const result = await $fetch<{ status: string; payment_status?: string }>(
      '/api/storefront/stripe/status',
      {
        method: 'POST',
        body: { slug: companySlug.value, order_ref: orderRef.value, email }
      }
    ).catch(() => null)

    if (result?.status === 'ok' && result.payment_status && order.value) {
      order.value = { ...order.value, payment_status: result.payment_status }
    }
  } finally {
    isVerifyingPayment.value = false
  }
}

/** Inicia (o reintenta) el pago con tarjeta redirigiendo a Stripe Checkout. */
const payWithStripe = async () => {
  if (isStartingPayment.value) return
  const email = emailInput.value.trim() || lastOrder.value?.email || ''
  if (!email) return

  paymentError.value = null
  isStartingPayment.value = true
  try {
    const session = await $fetch<{ status: string; url?: string }>(
      '/api/storefront/stripe/session',
      {
        method: 'POST',
        body: { slug: companySlug.value, order_ref: orderRef.value, email }
      }
    ).catch(() => null)

    if (session?.status === 'ok' && session.url) {
      window.location.href = session.url
      return
    }
    if (session?.status === 'already_paid') {
      await load(email)
      return
    }
    paymentError.value = 'No se pudo iniciar el pago con tarjeta. Intenta de nuevo en unos minutos.'
  } finally {
    isStartingPayment.value = false
  }
}

const load = async (email: string) => {
  isLoading.value = true
  notFound.value = false
  try {
    const result = await getOrder(companySlug.value, orderRef.value, email)
    if (!result) {
      notFound.value = true
      askEmail.value = true
      return
    }
    order.value = result.order
    lines.value = result.lines
    askEmail.value = false
    await verifyStripePayment(email)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  const known = lastOrder.value
  if (known && known.orderRef === orderRef.value) {
    emailInput.value = known.email
    void load(known.email)
  } else {
    askEmail.value = true
  }
})

const handleLookup = () => {
  const email = emailInput.value.trim()
  if (!email) return
  void load(email)
}

/** Enlace de WhatsApp con el detalle del pedido para enviar a la tienda. */
const whatsappOrderLink = computed(() => {
  const o = order.value
  if (!o || !store.value?.whatsapp_phone) return null

  const itemsText = lines.value
    .map((line) => `• ${line.quantity} × ${line.description} — ${formatStorefrontCurrency(line.total, o.currency)}`)
    .join('\n')

  const message = [
    `Hola${store.value?.name ? ` ${store.value.name}` : ''}, quiero dar seguimiento a mi pedido *${o.order_ref}*.`,
    '',
    itemsText,
    '',
    `Total: ${formatStorefrontCurrency(o.amount_total, o.currency)}`,
    o.customer_name ? `Nombre: ${o.customer_name}` : '',
    o.customer_email ? `Correo: ${o.customer_email}` : ''
  ]
    .filter(Boolean)
    .join('\n')

  return buildWhatsappLink(store.value.whatsapp_phone, message)
})

useHead(() => ({
  title: store.value ? `Pedido ${orderRef.value} — ${store.value.name}` : 'Confirmación de pedido',
  meta: [{ name: 'robots', content: 'noindex' }]
}))
</script>

<template>
  <div v-if="store" class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <!-- Buscar orden por email -->
    <div v-if="askEmail && !order" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-8 text-center">
      <h1 class="text-xl font-bold text-slate-900 mb-2">Consulta tu pedido</h1>
      <p class="text-sm text-slate-500 mb-6">
        Escribe el correo con el que realizaste la compra
        <span class="font-semibold text-slate-700">{{ orderRef }}</span> para ver el detalle.
      </p>
      <form class="flex gap-2 max-w-md mx-auto" @submit.prevent="handleLookup">
        <input
          v-model="emailInput"
          type="email"
          required
          placeholder="tucorreo@ejemplo.com"
          class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          aria-label="Correo electrónico de la compra"
        />
        <button
          type="submit"
          class="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          :style="{ backgroundColor: primaryColor }"
          :disabled="isLoading"
        >
          {{ isLoading ? '...' : 'Consultar' }}
        </button>
      </form>
      <p v-if="notFound && !isLoading" class="mt-4 text-sm text-rose-500">
        No encontramos un pedido con esa referencia y correo.
      </p>
    </div>

    <!-- Cargando -->
    <div v-else-if="isLoading" class="py-24 flex justify-center">
      <div
        class="w-10 h-10 rounded-full border-4 border-slate-200 animate-spin"
        :style="{ borderTopColor: primaryColor }"
        role="status"
        aria-label="Cargando pedido"
      />
    </div>

    <!-- Confirmación -->
    <template v-else-if="order">
      <div class="text-center mb-10">
        <div class="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">¡Gracias por tu compra!</h1>
        <p class="mt-2 text-slate-500">
          Tu pedido <span class="font-semibold text-slate-800">{{ order.order_ref }}</span> fue registrado correctamente.
        </p>
        <p class="text-sm text-slate-400 mt-1">
          Enviamos la confirmación a {{ order.customer_email }}.
        </p>
      </div>

      <!-- Avisos del pago con tarjeta (Stripe) -->
      <div
        v-if="isVerifyingPayment"
        class="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-4 text-sm text-indigo-700"
        role="status"
      >
        Confirmando tu pago con la pasarela…
      </div>
      <div
        v-else-if="paymentCancelled && canPayWithStripe"
        class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-700"
        role="alert"
      >
        El pago con tarjeta no se completó. Tu pedido quedó registrado; puedes intentar pagarlo de nuevo abajo.
      </div>
      <div
        v-if="paymentError"
        class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700"
        role="alert"
      >
        {{ paymentError }}
      </div>

      <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden">
        <!-- Estado -->
        <div class="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span class="text-slate-400">Fecha:</span>
            <span class="font-medium text-slate-800 ml-1">
              {{ new Date(order.order_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }}
            </span>
          </div>
          <div>
            <span class="text-slate-400">Pago:</span>
            <span class="font-medium ml-1" :class="order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'">
              {{ order.payment_status === 'paid' ? 'Pagado' : 'Pendiente de pago' }}
            </span>
          </div>
          <div>
            <span class="text-slate-400">Entrega:</span>
            <span class="font-medium ml-1" :class="order.is_delivered ? 'text-emerald-600' : 'text-slate-700'">
              {{ order.is_delivered ? 'Entregado' : 'En preparación' }}
            </span>
          </div>
        </div>

        <!-- Líneas -->
        <ul class="divide-y divide-slate-100">
          <li v-for="(line, index) in lines" :key="index" class="px-6 sm:px-8 py-4 flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
              <img v-if="line.image_url" :src="line.image_url" :alt="''" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">{{ line.description }}</p>
              <p class="text-xs text-slate-400">
                {{ line.quantity }} × {{ formatStorefrontCurrency(line.unit_price, order.currency) }}
                <template v-if="line.discount_percent > 0"> (−{{ line.discount_percent }}%)</template>
              </p>
            </div>
            <p class="text-sm font-semibold text-slate-900 flex-shrink-0">
              {{ formatStorefrontCurrency(line.total, order.currency) }}
            </p>
          </li>
        </ul>

        <!-- Totales -->
        <dl class="px-6 sm:px-8 py-5 border-t border-slate-100 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Subtotal (sin impuestos)</dt>
            <dd class="font-medium text-slate-900">{{ formatStorefrontCurrency(order.amount_untaxed, order.currency) }}</dd>
          </div>
          <div v-if="order.amount_discount > 0" class="flex justify-between text-emerald-600">
            <dt>Descuentos<template v-if="order.coupon_code"> ({{ order.coupon_code }})</template></dt>
            <dd>−{{ formatStorefrontCurrency(order.amount_discount, order.currency) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Impuestos</dt>
            <dd class="font-medium text-slate-900">{{ formatStorefrontCurrency(order.amount_tax, order.currency) }}</dd>
          </div>
          <div class="flex justify-between pt-3 border-t border-slate-100 text-base">
            <dt class="font-bold text-slate-900">Total</dt>
            <dd class="font-bold text-slate-900">{{ formatStorefrontCurrency(order.amount_total, order.currency) }}</dd>
          </div>
        </dl>

        <!-- Envío -->
        <div class="px-6 sm:px-8 py-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dirección de envío</p>
            <p class="text-slate-800">{{ order.customer_name }}</p>
            <p class="text-slate-500">
              {{ order.shipping_street }}<template v-if="order.shipping_street2">, {{ order.shipping_street2 }}</template>
            </p>
            <p class="text-slate-500">
              {{ order.shipping_city }}, {{ order.shipping_state }} C.P. {{ order.shipping_zip }}
            </p>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Método de envío</p>
            <p class="text-slate-800">{{ order.shipping_method_name ?? '—' }}</p>
          </div>
        </div>
      </div>

      <!-- Siguientes pasos -->
      <div class="mt-8 text-center">
        <p class="text-sm text-slate-500 max-w-lg mx-auto">
          <template v-if="order.payment_status === 'paid'">
            Tu pago fue confirmado. El vendedor preparará tu pedido y te contactará para coordinar la entrega.
          </template>
          <template v-else-if="canPayWithStripe">
            Tu pedido está reservado en espera del pago con tarjeta.
          </template>
          <template v-else>
            El vendedor preparará tu pedido y te contactará para coordinar el pago y la entrega.
          </template>
          Guarda tu número de pedido <span class="font-semibold text-slate-700">{{ order.order_ref }}</span> para cualquier aclaración.
        </p>

        <button
          v-if="canPayWithStripe"
          type="button"
          class="mt-6 inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 disabled:cursor-wait"
          :style="{ backgroundColor: primaryColor }"
          :disabled="isStartingPayment || isVerifyingPayment"
          @click="payWithStripe"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h2m4 0h4M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
          </svg>
          {{ isStartingPayment ? 'Redirigiendo a Stripe…' : 'Pagar ahora con tarjeta' }}
        </button>
        <a
          v-if="whatsappOrderLink"
          :href="whatsappOrderLink"
          target="_blank"
          rel="noopener"
          class="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-[#25D366] shadow-lg shadow-[#25D366]/30 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          Enviar pedido por WhatsApp
        </a>

        <div class="mt-6 flex items-center justify-center gap-3">
          <NuxtLink
            :to="`${basePath}/products`"
            class="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            :style="{ backgroundColor: primaryColor }"
          >
            Seguir comprando
          </NuxtLink>
          <NuxtLink
            :to="`${basePath}/account`"
            class="px-6 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-white transition-colors"
          >
            Ver mis pedidos
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>
