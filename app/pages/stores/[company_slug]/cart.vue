<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const storefrontStore = useStorefrontStore()
const {
  store,
  items,
  coupon,
  subtotalBase,
  subtotalFinal,
  couponDiscountFinal,
  currency,
  primaryColor
} = storeToRefs(storefrontStore)
const { validateCoupon } = useStorefront()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const basePath = computed(() => storefrontPath(companySlug.value))

const couponCode = ref('')
const couponError = ref<string | null>(null)
const isValidatingCoupon = ref(false)

const estimatedTotal = computed(() => Math.max(subtotalFinal.value - couponDiscountFinal.value, 0))

const handleApplyCoupon = async () => {
  const code = couponCode.value.trim()
  if (!code) return
  couponError.value = null
  isValidatingCoupon.value = true
  try {
    const result = await validateCoupon(companySlug.value, code, subtotalBase.value)
    if (result.status === 'valid') {
      storefrontStore.setCoupon(result)
      storefrontStore.notify(`Cupón ${result.code} aplicado`)
      couponCode.value = ''
    } else {
      storefrontStore.setCoupon(null)
      couponError.value = result.reason ?? 'El cupón no es válido.'
    }
  } finally {
    isValidatingCoupon.value = false
  }
}

const handleRemoveCoupon = () => {
  storefrontStore.setCoupon(null)
}

const tracker = useStorefrontTracker()
onMounted(() => {
  if (items.value.length) {
    tracker.trackEcommerce('view_cart', {
      value: subtotalFinal.value,
      currency: currency.value,
      items: items.value.map((item) => analyticsItemFromCartItem(item))
    })
  }
})

useHead(() => ({
  title: store.value ? `Carrito — ${store.value.name}` : 'Carrito'
}))
</script>

<template>
  <div v-if="store" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">Tu carrito</h1>

    <!-- Carrito vacío -->
    <div v-if="!items.length" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 py-20 text-center">
      <svg class="w-14 h-14 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6a1 1 0 00.9 1.4h12M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
      <p class="text-slate-600 font-medium">Tu carrito está vacío</p>
      <p class="text-sm text-slate-400 mt-1">Agrega productos del catálogo para comenzar tu compra.</p>
      <NuxtLink
        :to="`${basePath}/products`"
        class="mt-6 inline-flex px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        :style="{ backgroundColor: primaryColor }"
      >
        Explorar productos
      </NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Ítems -->
      <div class="lg:col-span-2 space-y-4">
        <div
          v-for="item in items"
          :key="item.productId"
          class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-4 flex gap-4"
        >
          <NuxtLink
            :to="`${basePath}/products/${item.slug}`"
            class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0"
          >
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.name"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </NuxtLink>

          <div class="flex-1 min-w-0 flex flex-col">
            <div class="flex items-start justify-between gap-2">
              <NuxtLink
                :to="`${basePath}/products/${item.slug}`"
                class="text-sm font-semibold text-slate-800 hover:text-slate-950 line-clamp-2 transition-colors"
              >
                {{ item.name }}
              </NuxtLink>
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
                :aria-label="`Eliminar ${item.name} del carrito`"
                @click="storefrontStore.removeItem(item.productId)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <p class="text-xs text-slate-400 mt-0.5">
              {{ formatStorefrontCurrency(item.priceFinal, item.currency) }} c/u
            </p>

            <div class="mt-auto pt-3 flex items-center justify-between">
              <div class="flex items-center rounded-lg border border-slate-200">
                <button
                  type="button"
                  class="px-3 py-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors text-sm"
                  :disabled="item.quantity <= 1"
                  :aria-label="`Disminuir cantidad de ${item.name}`"
                  @click="storefrontStore.updateQuantity(item.productId, item.quantity - 1)"
                >
                  −
                </button>
                <span class="w-8 text-center text-sm font-semibold text-slate-900">{{ item.quantity }}</span>
                <button
                  type="button"
                  class="px-3 py-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors text-sm"
                  :disabled="item.stockAvailable !== null && item.quantity >= item.stockAvailable"
                  :aria-label="`Aumentar cantidad de ${item.name}`"
                  @click="storefrontStore.updateQuantity(item.productId, item.quantity + 1)"
                >
                  +
                </button>
              </div>
              <p class="text-sm font-bold text-slate-900">
                {{ formatStorefrontCurrency(item.priceFinal * item.quantity, item.currency) }}
              </p>
            </div>

            <p
              v-if="item.stockAvailable !== null && item.quantity >= item.stockAvailable"
              class="mt-2 text-xs text-amber-600"
            >
              Alcanzaste el máximo disponible ({{ item.stockAvailable }}).
            </p>
          </div>
        </div>

        <NuxtLink
          :to="`${basePath}/products`"
          class="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-75"
          :style="{ color: primaryColor }"
        >
          ← Seguir comprando
        </NuxtLink>
      </div>

      <!-- Resumen -->
      <aside class="lg:col-span-1">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 sticky top-24">
          <h2 class="text-lg font-bold text-slate-900 mb-4">Resumen</h2>

          <!-- Cupón -->
          <div class="mb-5">
            <div v-if="coupon?.status === 'valid'" class="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <div class="text-sm">
                <span class="font-semibold text-emerald-700">{{ coupon.code }}</span>
                <span class="text-emerald-600 ml-1">
                  ({{ coupon.discount_type === 'percent' ? `-${coupon.discount_value}%` : formatStorefrontCurrency(-(coupon.discount_amount ?? 0), currency) }})
                </span>
              </div>
              <button
                type="button"
                class="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
                @click="handleRemoveCoupon"
              >
                Quitar
              </button>
            </div>

            <form v-else class="flex gap-2" @submit.prevent="handleApplyCoupon">
              <input
                v-model="couponCode"
                type="text"
                placeholder="Código de descuento"
                class="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                aria-label="Código de descuento"
              />
              <button
                type="submit"
                class="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                :disabled="isValidatingCoupon || !couponCode.trim()"
              >
                {{ isValidatingCoupon ? '...' : 'Aplicar' }}
              </button>
            </form>
            <p v-if="couponError" class="mt-2 text-xs text-rose-500">{{ couponError }}</p>
          </div>

          <dl class="space-y-2.5 text-sm">
            <div class="flex justify-between">
              <dt class="text-slate-500">Subtotal (imp. incluidos)</dt>
              <dd class="font-medium text-slate-900">{{ formatStorefrontCurrency(subtotalFinal, currency) }}</dd>
            </div>
            <div v-if="couponDiscountFinal > 0" class="flex justify-between text-emerald-600">
              <dt>Descuento</dt>
              <dd class="font-medium">−{{ formatStorefrontCurrency(couponDiscountFinal, currency) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-500">Envío</dt>
              <dd class="text-slate-400 text-xs pt-0.5">Se calcula al pagar</dd>
            </div>
            <div class="flex justify-between pt-3 border-t border-slate-100 text-base">
              <dt class="font-bold text-slate-900">Total estimado</dt>
              <dd class="font-bold text-slate-900">{{ formatStorefrontCurrency(estimatedTotal, currency) }}</dd>
            </div>
          </dl>

          <NuxtLink
            :to="`${basePath}/checkout`"
            class="mt-6 w-full inline-flex justify-center px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            :style="{ backgroundColor: primaryColor }"
          >
            Proceder al pago
          </NuxtLink>
          <p class="mt-3 text-[0.7rem] text-slate-400 text-center leading-relaxed">
            Los importes finales (impuestos y envío) se confirman en el checkout.
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>
