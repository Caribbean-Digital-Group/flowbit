<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type {
  StorefrontShippingOption,
  StorefrontPaymentOption,
  StorefrontStripeInfo
} from '~/composables/useStorefront'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const router = useRouter()
const storefrontStore = useStorefrontStore()
const authStore = useAuthStore()
const {
  store,
  items,
  coupon,
  subtotalFinal,
  couponDiscountFinal,
  currency,
  primaryColor
} = storeToRefs(storefrontStore)
const { getCheckoutInfo, placeOrder } = useStorefront()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const basePath = computed(() => storefrontPath(companySlug.value))

// ── Wizard ───────────────────────────────────────────────────────────────
const steps = [
  { id: 1, label: 'Contacto' },
  { id: 2, label: 'Envío' },
  { id: 3, label: 'Pago' },
  { id: 4, label: 'Revisión' }
]
const currentStep = ref(1)
const stepError = ref<string | null>(null)

// ── Datos del formulario ─────────────────────────────────────────────────
const customer = ref({
  name: '',
  email: '',
  phone: '',
  street: '',
  street2: '',
  city: '',
  state: '',
  zip: '',
  country_code: 'MX'
})
const notes = ref('')

const shippingMethods = ref<StorefrontShippingOption[]>([])
const paymentMethods = ref<StorefrontPaymentOption[]>([])
const stripeInfo = ref<StorefrontStripeInfo | null>(null)
const selectedShippingId = ref<string | null>(null)
const selectedPaymentId = ref<string | null>(null)
const isLoadingInfo = ref(true)
const isPlacing = ref(false)
const orderError = ref<string | null>(null)

/** Id sintético de la opción de pago con tarjeta vía Stripe. */
const STRIPE_PAYMENT_ID = 'stripe'

/** Opciones de pago: pasarela Stripe (si la tienda la habilitó) + catálogo. */
const paymentOptions = computed<StorefrontPaymentOption[]>(() => {
  const options: StorefrontPaymentOption[] = []
  if (stripeInfo.value?.enabled) {
    options.push({
      id: STRIPE_PAYMENT_ID,
      name: 'Tarjeta de crédito o débito',
      description: 'Pago seguro en línea procesado por Stripe. Te redirigiremos para completar el pago.'
    })
  }
  return [...options, ...paymentMethods.value]
})

const isPayingWithStripe = computed(() => selectedPaymentId.value === STRIPE_PAYMENT_ID)

const selectedShipping = computed(
  () => shippingMethods.value.find((method) => method.id === selectedShippingId.value) ?? null
)
const selectedPayment = computed(
  () => paymentOptions.value.find((method) => method.id === selectedPaymentId.value) ?? null
)

const estimatedTotal = computed(() =>
  Math.max(subtotalFinal.value - couponDiscountFinal.value, 0) + (selectedShipping.value?.price ?? 0)
)

const tracker = useStorefrontTracker()

onMounted(async () => {
  // begin_checkout con el mismo token de idempotencia que usará la orden:
  // así el evento purchase (server-side) se atribuye a esta sesión
  if (items.value.length) {
    tracker.trackEcommerce('begin_checkout', {
      value: subtotalFinal.value,
      currency: currency.value,
      items: items.value.map((item) => analyticsItemFromCartItem(item)),
      checkoutToken: storefrontStore.ensureCheckoutToken()
    })
  }

  // Prellenar con el usuario autenticado si existe sesión
  await authStore.loadSession()
  if (authStore.isAuthenticated) {
    customer.value.name = authStore.partnerDisplayName || customer.value.name
    customer.value.email = authStore.partnerEmail || customer.value.email
  }

  const info = await getCheckoutInfo(companySlug.value)
  shippingMethods.value = info?.shippingMethods ?? []
  paymentMethods.value = info?.paymentMethods ?? []
  stripeInfo.value = info?.stripe ?? null
  if (shippingMethods.value.length === 1) selectedShippingId.value = shippingMethods.value[0]?.id ?? null
  if (paymentOptions.value.length === 1) selectedPaymentId.value = paymentOptions.value[0]?.id ?? null
  isLoadingInfo.value = false
})

// ── Validaciones por paso ────────────────────────────────────────────────
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const validateStep = (step: number): string | null => {
  if (step === 1) {
    if (!customer.value.name.trim()) return 'Escribe tu nombre completo.'
    if (!EMAIL_REGEX.test(customer.value.email.trim())) return 'Escribe un correo electrónico válido.'
  }
  if (step === 2) {
    if (!customer.value.street.trim()) return 'La calle y número son obligatorios.'
    if (!customer.value.city.trim()) return 'La ciudad es obligatoria.'
    if (!customer.value.state.trim()) return 'El estado es obligatorio.'
    if (!customer.value.zip.trim()) return 'El código postal es obligatorio.'
    if (!selectedShippingId.value) return 'Selecciona un método de envío.'
  }
  if (step === 3) {
    if (!selectedPaymentId.value) return 'Selecciona un método de pago.'
  }
  return null
}

const goNext = () => {
  const error = validateStep(currentStep.value)
  if (error) {
    stepError.value = error
    return
  }
  stepError.value = null

  if (currentStep.value === 2) {
    tracker.trackEcommerce('add_shipping_info', {
      value: estimatedTotal.value,
      currency: currency.value,
      checkoutToken: storefrontStore.ensureCheckoutToken(),
      properties: { shipping_method: selectedShipping.value?.name ?? null }
    })
  } else if (currentStep.value === 3) {
    tracker.trackEcommerce('add_payment_info', {
      value: estimatedTotal.value,
      currency: currency.value,
      checkoutToken: storefrontStore.ensureCheckoutToken(),
      properties: { payment_method: selectedPayment.value?.name ?? null }
    })
  }

  currentStep.value = Math.min(currentStep.value + 1, 4)
}

const goBack = () => {
  stepError.value = null
  currentStep.value = Math.max(currentStep.value - 1, 1)
}

// ── Confirmar compra ─────────────────────────────────────────────────────
const handlePlaceOrder = async () => {
  if (isPlacing.value) return
  for (const step of [1, 2, 3]) {
    const error = validateStep(step)
    if (error) {
      stepError.value = error
      currentStep.value = step
      return
    }
  }
  if (!selectedShippingId.value || !selectedPaymentId.value) return

  orderError.value = null
  isPlacing.value = true
  try {
    const result = await placeOrder({
      slug: companySlug.value,
      checkoutToken: storefrontStore.ensureCheckoutToken(),
      customer: {
        name: customer.value.name.trim(),
        email: customer.value.email.trim(),
        phone: customer.value.phone.trim() || undefined,
        street: customer.value.street.trim(),
        street2: customer.value.street2.trim() || undefined,
        city: customer.value.city.trim(),
        state: customer.value.state.trim(),
        zip: customer.value.zip.trim(),
        country_code: customer.value.country_code
      },
      items: items.value.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity
      })),
      shippingMethodId: selectedShippingId.value,
      paymentMethodId: isPayingWithStripe.value ? null : selectedPaymentId.value,
      paymentProvider: isPayingWithStripe.value ? 'stripe' : null,
      couponCode: coupon.value?.status === 'valid' ? coupon.value.code : null,
      notes: notes.value.trim() || null
    })

    if (result.status === 'ok' && result.order_ref) {
      const email = customer.value.email.trim()
      storefrontStore.setLastOrder(result.order_ref, email)
      storefrontStore.clearCart()

      // Con Stripe: crear la sesión de pago y redirigir al checkout hospedado.
      // Si algo falla, la confirmación ofrece reintentar el pago.
      if (isPayingWithStripe.value && result.payment_status !== 'paid') {
        const session = await $fetch<{ status: string; url?: string }>(
          '/api/storefront/stripe/session',
          {
            method: 'POST',
            body: { slug: companySlug.value, order_ref: result.order_ref, email }
          }
        ).catch(() => null)

        if (session?.status === 'ok' && session.url) {
          window.location.href = session.url
          return
        }
      }

      await router.push(`${basePath.value}/checkout/confirmation/${encodeURIComponent(result.order_ref)}`)
      return
    }

    orderError.value = result.message ?? 'No se pudo completar la compra. Intenta de nuevo.'
    // Si falló por stock, permitir corregir el carrito
    if (result.code === 'insufficient_stock') {
      orderError.value += ' Ajusta las cantidades en tu carrito.'
    }
  } finally {
    isPlacing.value = false
  }
}

useHead(() => ({
  title: store.value ? `Checkout — ${store.value.name}` : 'Checkout'
}))
</script>

<template>
  <div v-if="store" class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <!-- Carrito vacío -->
    <div v-if="!items.length" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 py-20 text-center">
      <p class="text-slate-600 font-medium">No hay productos para pagar</p>
      <p class="text-sm text-slate-400 mt-1">Tu carrito está vacío.</p>
      <NuxtLink
        :to="`${basePath}/products`"
        class="mt-6 inline-flex px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        :style="{ backgroundColor: primaryColor }"
      >
        Ir al catálogo
      </NuxtLink>
    </div>

    <template v-else>
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">Finalizar compra</h1>

      <!-- Indicador de pasos -->
      <ol class="flex items-center gap-1 sm:gap-2 mb-8" aria-label="Progreso del checkout">
        <li v-for="(step, index) in steps" :key="step.id" class="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            class="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors"
            :class="currentStep === step.id ? 'text-white' : currentStep > step.id ? 'text-slate-700 bg-slate-100 hover:bg-slate-200' : 'text-slate-400 bg-slate-100/60 cursor-default'"
            :style="currentStep === step.id ? { backgroundColor: primaryColor } : {}"
            :disabled="currentStep <= step.id"
            :aria-current="currentStep === step.id ? 'step' : undefined"
            @click="currentStep > step.id && (currentStep = step.id)"
          >
            <span
              v-if="currentStep > step.id"
              class="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center"
              aria-hidden="true"
            >
              <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span v-else aria-hidden="true">{{ step.id }}.</span>
            {{ step.label }}
          </button>
          <span v-if="index < steps.length - 1" class="w-3 sm:w-6 h-px bg-slate-200" aria-hidden="true" />
        </li>
      </ol>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Formulario -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 sm:p-8">
            <!-- Paso 1: Contacto -->
            <section v-if="currentStep === 1">
              <h2 class="text-lg font-bold text-slate-900 mb-1">Datos de contacto</h2>
              <p class="text-sm text-slate-500 mb-6">
                Puedes comprar como invitado; solo necesitamos tu correo para enviarte la confirmación.
              </p>

              <div class="space-y-4">
                <FormInput
                  v-model="customer.name"
                  label="Nombre completo"
                  placeholder="Ej: María Pérez"
                  required
                  size="md"
                />
                <FormInput
                  v-model="customer.email"
                  label="Correo electrónico"
                  type="email"
                  placeholder="tucorreo@ejemplo.com"
                  required
                  size="md"
                />
                <FormInput
                  v-model="customer.phone"
                  label="Teléfono (opcional)"
                  type="tel"
                  placeholder="Ej: 55 1234 5678"
                  size="md"
                />
              </div>

              <p v-if="!authStore.isAuthenticated" class="mt-5 text-xs text-slate-400">
                ¿Ya tienes cuenta?
                <NuxtLink :to="`${basePath}/account`" class="font-semibold" :style="{ color: primaryColor }">
                  Inicia sesión
                </NuxtLink>
                para ver tu historial de pedidos.
              </p>
            </section>

            <!-- Paso 2: Envío -->
            <section v-else-if="currentStep === 2">
              <h2 class="text-lg font-bold text-slate-900 mb-6">Dirección y método de envío</h2>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <FormInput
                    v-model="customer.street"
                    label="Calle y número"
                    placeholder="Ej: Av. Reforma 123"
                    required
                    size="md"
                  />
                </div>
                <div class="sm:col-span-2">
                  <FormInput
                    v-model="customer.street2"
                    label="Colonia / Interior (opcional)"
                    placeholder="Ej: Col. Centro, Int. 4B"
                    size="md"
                  />
                </div>
                <FormInput v-model="customer.city" label="Ciudad" required size="md" />
                <FormInput v-model="customer.state" label="Estado" required size="md" />
                <FormInput v-model="customer.zip" label="Código postal" required size="md" />
              </div>

              <h3 class="text-sm font-semibold text-slate-900 mt-8 mb-3">Método de envío</h3>
              <div v-if="isLoadingInfo" class="text-sm text-slate-400">Cargando métodos de envío…</div>
              <p v-else-if="!shippingMethods.length" class="text-sm text-amber-600">
                Esta tienda aún no tiene métodos de envío configurados. Contacta al vendedor.
              </p>
              <div v-else class="space-y-2">
                <label
                  v-for="method in shippingMethods"
                  :key="method.id"
                  class="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors"
                  :class="selectedShippingId === method.id ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
                >
                  <input
                    v-model="selectedShippingId"
                    type="radio"
                    name="shipping"
                    :value="method.id"
                    class="mt-1 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="flex-1 min-w-0">
                    <span class="flex items-center justify-between gap-2">
                      <span class="text-sm font-semibold text-slate-800">{{ method.name }}</span>
                      <span class="text-sm font-bold text-slate-900">
                        {{ method.price > 0 ? formatStorefrontCurrency(method.price, currency) : 'Gratis' }}
                      </span>
                    </span>
                    <span v-if="method.delivery_estimate" class="block text-xs text-slate-500 mt-0.5">
                      {{ method.delivery_estimate }}
                    </span>
                    <span v-if="method.description" class="block text-xs text-slate-400 mt-0.5">
                      {{ method.description }}
                    </span>
                  </span>
                </label>
              </div>
            </section>

            <!-- Paso 3: Pago -->
            <section v-else-if="currentStep === 3">
              <h2 class="text-lg font-bold text-slate-900 mb-1">Método de pago</h2>
              <p class="text-sm text-slate-500 mb-6">
                Selecciona cómo pagarás tu pedido. El vendedor confirmará el pago al procesarlo;
                nunca capturamos ni almacenamos datos de tarjetas.
              </p>

              <div v-if="isLoadingInfo" class="text-sm text-slate-400">Cargando métodos de pago…</div>
              <p v-else-if="!paymentOptions.length" class="text-sm text-amber-600">
                Esta tienda aún no tiene métodos de pago configurados. Contacta al vendedor.
              </p>
              <div v-else class="space-y-2">
                <label
                  v-for="method in paymentOptions"
                  :key="method.id"
                  class="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors"
                  :class="selectedPaymentId === method.id ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'"
                >
                  <input
                    v-model="selectedPaymentId"
                    type="radio"
                    name="payment"
                    :value="method.id"
                    class="mt-1 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="flex-1 min-w-0">
                    <span class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-slate-800">{{ method.name }}</span>
                      <svg
                        v-if="method.id === STRIPE_PAYMENT_ID"
                        class="w-4 h-4 text-indigo-500 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h2m4 0h4M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                      </svg>
                    </span>
                    <span v-if="method.description" class="block text-xs text-slate-500 mt-0.5">
                      {{ method.description }}
                    </span>
                  </span>
                </label>
              </div>

              <div class="mt-6">
                <FormTextArea
                  v-model="notes"
                  label="Notas para el vendedor (opcional)"
                  placeholder="Instrucciones de entrega, referencias..."
                  :rows="3"
                  size="md"
                />
              </div>
            </section>

            <!-- Paso 4: Revisión -->
            <section v-else>
              <h2 class="text-lg font-bold text-slate-900 mb-6">Revisa tu pedido</h2>

              <div class="space-y-5">
                <div class="rounded-xl border border-slate-100 p-4">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contacto</p>
                    <button type="button" class="text-xs font-semibold" :style="{ color: primaryColor }" @click="currentStep = 1">
                      Editar
                    </button>
                  </div>
                  <p class="text-sm text-slate-800">{{ customer.name }}</p>
                  <p class="text-sm text-slate-500">{{ customer.email }}<template v-if="customer.phone"> · {{ customer.phone }}</template></p>
                </div>

                <div class="rounded-xl border border-slate-100 p-4">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Envío</p>
                    <button type="button" class="text-xs font-semibold" :style="{ color: primaryColor }" @click="currentStep = 2">
                      Editar
                    </button>
                  </div>
                  <p class="text-sm text-slate-800">
                    {{ customer.street }}<template v-if="customer.street2">, {{ customer.street2 }}</template>
                  </p>
                  <p class="text-sm text-slate-500">
                    {{ customer.city }}, {{ customer.state }}, C.P. {{ customer.zip }}
                  </p>
                  <p v-if="selectedShipping" class="text-sm text-slate-500 mt-1.5">
                    {{ selectedShipping.name }}
                    ({{ selectedShipping.price > 0 ? formatStorefrontCurrency(selectedShipping.price, currency) : 'Gratis' }})
                    <template v-if="selectedShipping.delivery_estimate"> — {{ selectedShipping.delivery_estimate }}</template>
                  </p>
                </div>

                <div class="rounded-xl border border-slate-100 p-4">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago</p>
                    <button type="button" class="text-xs font-semibold" :style="{ color: primaryColor }" @click="currentStep = 3">
                      Editar
                    </button>
                  </div>
                  <p class="text-sm text-slate-800">{{ selectedPayment?.name }}</p>
                </div>

                <div class="rounded-xl border border-slate-100 p-4">
                  <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Productos ({{ items.length }})
                  </p>
                  <ul class="space-y-2">
                    <li v-for="item in items" :key="item.productId" class="flex justify-between text-sm">
                      <span class="text-slate-600 truncate pr-4">{{ item.quantity }} × {{ item.name }}</span>
                      <span class="font-medium text-slate-900 flex-shrink-0">
                        {{ formatStorefrontCurrency(item.priceFinal * item.quantity, currency) }}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div
                v-if="orderError"
                class="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {{ orderError }}
              </div>
            </section>

            <!-- Error de validación -->
            <p v-if="stepError" class="mt-5 text-sm text-rose-500" role="alert">{{ stepError }}</p>

            <!-- Navegación -->
            <div class="mt-8 flex items-center justify-between">
              <button
                v-if="currentStep > 1"
                type="button"
                class="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                @click="goBack"
              >
                ← Regresar
              </button>
              <NuxtLink
                v-else
                :to="`${basePath}/cart`"
                class="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                ← Volver al carrito
              </NuxtLink>

              <button
                v-if="currentStep < 4"
                type="button"
                class="px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                :style="{ backgroundColor: primaryColor }"
                @click="goNext"
              >
                Continuar
              </button>
              <button
                v-else
                type="button"
                class="px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 disabled:cursor-wait"
                :style="{ backgroundColor: primaryColor }"
                :disabled="isPlacing"
                @click="handlePlaceOrder"
              >
                {{ isPlacing ? 'Procesando…' : isPayingWithStripe ? 'Pagar con tarjeta' : 'Confirmar compra' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Resumen lateral -->
        <aside class="lg:col-span-1 order-first lg:order-none">
          <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 lg:sticky lg:top-24">
            <h2 class="text-base font-bold text-slate-900 mb-4">Tu pedido</h2>
            <ul class="space-y-3 max-h-56 overflow-y-auto pr-1">
              <li v-for="item in items" :key="item.productId" class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                  <img v-if="item.imageUrl" :src="item.imageUrl" :alt="''" class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-slate-800 truncate">{{ item.name }}</p>
                  <p class="text-xs text-slate-400">× {{ item.quantity }}</p>
                </div>
                <p class="text-xs font-semibold text-slate-900 flex-shrink-0">
                  {{ formatStorefrontCurrency(item.priceFinal * item.quantity, currency) }}
                </p>
              </li>
            </ul>

            <dl class="mt-5 pt-4 border-t border-slate-100 space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-slate-500">Subtotal</dt>
                <dd class="font-medium text-slate-900">{{ formatStorefrontCurrency(subtotalFinal, currency) }}</dd>
              </div>
              <div v-if="couponDiscountFinal > 0" class="flex justify-between text-emerald-600">
                <dt>Cupón {{ coupon?.code }}</dt>
                <dd>−{{ formatStorefrontCurrency(couponDiscountFinal, currency) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-500">Envío</dt>
                <dd class="font-medium text-slate-900">
                  <template v-if="selectedShipping">
                    {{ selectedShipping.price > 0 ? formatStorefrontCurrency(selectedShipping.price, currency) : 'Gratis' }}
                  </template>
                  <span v-else class="text-xs text-slate-400">Por seleccionar</span>
                </dd>
              </div>
              <div class="flex justify-between pt-2 border-t border-slate-100 text-base">
                <dt class="font-bold text-slate-900">Total estimado</dt>
                <dd class="font-bold text-slate-900">{{ formatStorefrontCurrency(estimatedTotal, currency) }}</dd>
              </div>
            </dl>
            <p class="mt-3 text-[0.7rem] text-slate-400 leading-relaxed">
              El total definitivo (con impuestos) se calcula y valida en el servidor al confirmar.
            </p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
