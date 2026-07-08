<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const storefrontStore = useStorefrontStore()
const { store, categories, featuredProducts, primaryColor } = storeToRefs(storefrontStore)

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const basePath = computed(() => storefrontPath(companySlug.value))

const hasBanner = computed(() => !!store.value?.banner_url)

// Fondo minimalista con gradientes suaves derivados del color de la tienda
const softGradient = computed(() => ({
  background: [
    `radial-gradient(120% 120% at 85% 0%, ${primaryColor.value}22 0%, transparent 45%)`,
    `radial-gradient(90% 90% at 0% 100%, ${primaryColor.value}14 0%, transparent 50%)`,
    'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
  ].join(', ')
}))

// Impresión de la lista de destacados (una vez por visita a la portada)
const tracker = useStorefrontTracker()
const hasTrackedFeatured = ref(false)
watch(
  [featuredProducts, tracker.consent],
  () => {
    if (hasTrackedFeatured.value) return
    if (tracker.consent.value !== 'granted' || !featuredProducts.value.length) return
    hasTrackedFeatured.value = true
    tracker.trackEcommerce('view_item_list', {
      currency: store.value?.currency,
      items: featuredProducts.value.map((p) => analyticsItemFromProduct(p)),
      properties: { list: 'featured' }
    })
  },
  { immediate: true }
)

useHead(() => ({
  title: store.value ? `${store.value.name} — Tienda en línea` : 'Tienda en línea',
  meta: [
    {
      name: 'description',
      content:
        store.value?.hero_subtitle ??
        store.value?.description ??
        'Explora nuestro catálogo y compra en línea.'
    },
    { property: 'og:title', content: store.value?.name ?? 'Tienda en línea' },
    ...(store.value?.banner_url
      ? [{ property: 'og:image', content: store.value.banner_url }]
      : [])
  ]
}))
</script>

<template>
  <div v-if="store">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-white">
      <!-- Fondo con banner -->
      <template v-if="hasBanner">
        <div class="absolute inset-0">
          <img
            :src="store.banner_url!"
            alt=""
            class="w-full h-full object-cover"
            aria-hidden="true"
          />
          <div class="absolute inset-0 bg-gradient-to-br from-slate-950/75 via-slate-900/55 to-slate-950/75" />
        </div>
      </template>

      <!-- Fondo minimalista (sin banner) -->
      <template v-else>
        <div class="absolute inset-0" :style="softGradient" />
        <div class="absolute inset-0 sf-dot-grid" aria-hidden="true" />
        <div
          class="absolute -top-24 -right-16 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-25"
          :style="{ background: primaryColor }"
          aria-hidden="true"
        />
        <div
          class="absolute -bottom-32 -left-12 w-[24rem] h-[24rem] rounded-full blur-3xl opacity-[0.18]"
          :style="{ background: primaryColor }"
          aria-hidden="true"
        />
      </template>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20">
        <div
          class="grid gap-10 lg:gap-12 items-center"
          :class="hasBanner ? '' : 'lg:grid-cols-2'"
        >
          <!-- Columna de texto -->
          <div :class="hasBanner ? 'max-w-3xl mx-auto text-center' : 'text-center lg:text-left'">
            <span
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
              :class="hasBanner ? 'bg-white/15 text-white backdrop-blur-md ring-1 ring-white/20' : ''"
              :style="hasBanner ? {} : { backgroundColor: `${primaryColor}14`, color: primaryColor }"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :style="{ backgroundColor: hasBanner ? '#ffffff' : primaryColor }"
                aria-hidden="true"
              />
              Tienda en línea
            </span>

            <h1
              class="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]"
              :class="hasBanner ? 'text-white' : 'text-slate-900'"
            >
              {{ store.hero_title || store.name }}
            </h1>

            <p
              v-if="store.hero_subtitle || store.description"
              class="mt-5 text-base sm:text-lg leading-relaxed max-w-xl"
              :class="[
                hasBanner ? 'text-white/85 mx-auto' : 'text-slate-500',
                hasBanner ? '' : 'lg:mx-0 mx-auto'
              ]"
            >
              {{ store.hero_subtitle || store.description }}
            </p>

            <div
              class="mt-8 flex flex-wrap items-center gap-3"
              :class="hasBanner ? 'justify-center' : 'justify-center lg:justify-start'"
            >
              <NuxtLink
                :to="`${basePath}/products`"
                class="group inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                :class="hasBanner ? 'bg-white text-slate-900 focus-visible:ring-white focus-visible:ring-offset-transparent' : 'text-white'"
                :style="hasBanner ? {} : { backgroundColor: primaryColor, boxShadow: `0 14px 34px -12px ${primaryColor}` }"
              >
                Explorar productos
                <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </NuxtLink>
              <NuxtLink
                :to="`${basePath}/about`"
                class="inline-flex items-center px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                :class="hasBanner
                  ? 'border border-white/40 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-transparent'
                  : 'border border-slate-200 bg-white/70 backdrop-blur text-slate-700 hover:bg-white focus-visible:ring-slate-300'"
              >
                Conócenos
              </NuxtLink>
            </div>

            <!-- Fila de confianza -->
            <div
              class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium"
              :class="[
                hasBanner ? 'text-white/70 justify-center' : 'text-slate-400 justify-center lg:justify-start'
              ]"
            >
              <span class="inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Envío a domicilio
              </span>
              <span class="inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Compra segura
              </span>
              <span class="inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Atención directa
              </span>
            </div>
          </div>

          <!-- Gráfico abstracto minimalista (solo sin banner) -->
          <div v-if="!hasBanner" class="relative hidden lg:block" aria-hidden="true">
            <div class="relative aspect-square max-w-md ml-auto">
              <div
                class="absolute inset-10 rounded-full blur-3xl opacity-20"
                :style="{ background: primaryColor }"
              />

              <svg
                viewBox="0 0 400 400"
                class="relative w-full h-full sf-float"
                :style="{ color: primaryColor }"
                fill="none"
              >
                <defs>
                  <radialGradient id="sfGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="currentColor" stop-opacity="0.18" />
                    <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
                  </radialGradient>
                  <linearGradient id="sfNode" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="currentColor" stop-opacity="0.95" />
                    <stop offset="100%" stop-color="currentColor" stop-opacity="0.55" />
                  </linearGradient>
                </defs>

                <circle cx="200" cy="190" r="180" fill="url(#sfGlow)" />

                <!-- Anillos punteados -->
                <circle cx="200" cy="190" r="150" stroke="currentColor" stroke-opacity="0.1" stroke-width="1" stroke-dasharray="2 8" />
                <circle cx="200" cy="190" r="110" stroke="currentColor" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="3 7" />

                <!-- Líneas de conexión -->
                <g stroke="currentColor" stroke-opacity="0.22" stroke-width="1.2">
                  <line x1="200" y1="190" x2="82" y2="118" />
                  <line x1="200" y1="190" x2="200" y2="66" />
                  <line x1="200" y1="190" x2="320" y2="140" />
                  <line x1="200" y1="190" x2="138" y2="256" />
                  <line x1="200" y1="190" x2="288" y2="262" />
                  <line x1="200" y1="190" x2="206" y2="336" />
                  <line x1="82" y1="118" x2="200" y2="66" />
                  <line x1="200" y1="66" x2="320" y2="140" />
                  <line x1="320" y1="140" x2="288" y2="262" />
                  <line x1="288" y1="262" x2="206" y2="336" />
                  <line x1="206" y1="336" x2="138" y2="256" />
                  <line x1="138" y1="256" x2="82" y2="118" />
                </g>

                <!-- Formas geométricas -->
                <rect x="70" y="72" width="42" height="42" rx="12" transform="rotate(16 91 93)" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-opacity="0.2" />
                <path d="M312 232 l26 15 v30 l-26 15 -26 -15 v-30 z" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.18" />

                <!-- Nodos -->
                <g>
                  <circle cx="82" cy="118" r="6" fill="currentColor" fill-opacity="0.55" />
                  <circle cx="200" cy="66" r="9" fill="url(#sfNode)" />
                  <circle cx="320" cy="140" r="6" fill="currentColor" fill-opacity="0.5" />
                  <circle cx="138" cy="256" r="7" fill="currentColor" fill-opacity="0.6" />
                  <circle cx="288" cy="262" r="6" fill="currentColor" fill-opacity="0.5" />
                  <circle cx="206" cy="336" r="8" fill="url(#sfNode)" />
                  <circle cx="200" cy="190" r="16" fill="url(#sfNode)" />
                  <circle cx="200" cy="190" r="16" stroke="currentColor" stroke-opacity="0.3" />
                  <circle cx="200" cy="190" r="6" fill="#ffffff" fill-opacity="0.9" />
                </g>
              </svg>

              <!-- Tarjetas glass flotantes con atributos de la plataforma -->
              <div class="sf-glass sf-float-slow absolute top-0 -left-6 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
                <span
                  class="flex items-center justify-center w-8 h-8 rounded-xl text-white"
                  :style="{ backgroundColor: primaryColor }"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
                <div>
                  <p class="text-xs font-bold text-slate-900 leading-none">Envío exprés</p>
                  <p class="mt-1 text-[0.7rem] text-slate-500 leading-none">Entrega ágil</p>
                </div>
              </div>

              <div class="sf-glass sf-float absolute top-1/3 -right-8 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
                <span
                  class="flex items-center justify-center w-8 h-8 rounded-xl"
                  :style="{ backgroundColor: `${primaryColor}1f`, color: primaryColor }"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.6-2.6A11.95 11.95 0 0112 2.9a11.95 11.95 0 01-8.6 3.5A12 12 0 0012 21.8a12 12 0 008.6-16.4z" />
                  </svg>
                </span>
                <div>
                  <p class="text-xs font-bold text-slate-900 leading-none">Pago seguro</p>
                  <p class="mt-1 text-[0.7rem] text-slate-500 leading-none">Datos protegidos</p>
                </div>
              </div>

              <div class="sf-glass sf-float-delay absolute bottom-1/3 -left-8 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
                <span
                  class="flex items-center justify-center w-8 h-8 rounded-xl"
                  :style="{ backgroundColor: `${primaryColor}1f`, color: primaryColor }"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 010 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 010-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </span>
                <div>
                  <p class="text-xs font-bold text-slate-900 leading-none">Cupones</p>
                  <p class="mt-1 text-[0.7rem] text-slate-500 leading-none">Descuentos activos</p>
                </div>
              </div>

              <div class="sf-glass sf-float-slow absolute bottom-2 right-0 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
                <span
                  class="flex items-center justify-center w-8 h-8 rounded-xl text-white"
                  :style="{ backgroundColor: primaryColor }"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 10c0 3.9-3.6 7-8 7a9 9 0 01-2.6-.4L3 18l1.4-3.6A6.6 6.6 0 013 10c0-3.9 3.6-7 8-7s8 3.1 8 7z" />
                  </svg>
                </span>
                <div>
                  <p class="text-xs font-bold text-slate-900 leading-none">Soporte directo</p>
                  <p class="mt-1 text-[0.7rem] text-slate-500 leading-none">Te ayudamos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Divisor curvo sutil -->
      <div
        v-if="!hasBanner"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"
        aria-hidden="true"
      />
    </section>

    <!-- Categorías -->
    <section v-if="categories.length" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
      <div class="mb-6">
        <p class="text-xs font-semibold uppercase tracking-widest" :style="{ color: primaryColor }">Explora</p>
        <h2 class="mt-1 text-xl sm:text-2xl font-bold text-slate-900">Categorías</h2>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="{ path: `${basePath}/products`, query: { category: category.id } }"
          class="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :style="{ backgroundColor: category.color || primaryColor }"
            aria-hidden="true"
          />
          <span class="text-sm font-semibold text-slate-800 whitespace-nowrap">{{ category.name }}</span>
          <span class="text-xs text-slate-400 tabular-nums">{{ category.product_count }}</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Productos destacados -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
      <div class="flex items-end justify-between mb-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest" :style="{ color: primaryColor }">Selección</p>
          <h2 class="mt-1 text-xl sm:text-2xl font-bold text-slate-900">Destacados</h2>
        </div>
        <NuxtLink
          :to="`${basePath}/products`"
          class="group inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-75"
          :style="{ color: primaryColor }"
        >
          Ver todo
          <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </NuxtLink>
      </div>

      <div
        v-if="featuredProducts.length"
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
      >
        <StorefrontProductCard
          v-for="product in featuredProducts"
          :key="product.id"
          :product="product"
          :company-slug="companySlug"
        />
      </div>

      <div v-else class="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 py-16 text-center">
        <p class="text-slate-500">Aún no hay productos publicados en esta tienda.</p>
      </div>
    </section>

    <!-- Beneficios -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div class="group bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 p-6 flex items-start gap-4 transition-all hover:-translate-y-0.5 hover:shadow-slate-300/60">
          <div class="p-2.5 rounded-xl transition-transform group-hover:scale-105" :style="{ backgroundColor: `${primaryColor}1a` }">
            <svg class="w-5 h-5" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.6a1 1 0 01.9.55L19.6 11H21a1 1 0 011 1v4a1 1 0 01-1 1h-1m-6 0a2 2 0 104 0m-4 0H9m10 0a2 2 0 11-4 0" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">Envíos a tu puerta</p>
            <p class="mt-1 text-xs text-slate-500">Elige el método de envío que más te convenga al pagar.</p>
          </div>
        </div>
        <div class="group bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 p-6 flex items-start gap-4 transition-all hover:-translate-y-0.5 hover:shadow-slate-300/60">
          <div class="p-2.5 rounded-xl transition-transform group-hover:scale-105" :style="{ backgroundColor: `${primaryColor}1a` }">
            <svg class="w-5 h-5" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.6-2.6A11.95 11.95 0 0112 2.9a11.95 11.95 0 01-8.6 3.5A12 12 0 0012 21.8a12 12 0 008.6-16.4z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">Compra segura</p>
            <p class="mt-1 text-xs text-slate-500">Tus datos se procesan de forma segura en todo momento.</p>
          </div>
        </div>
        <div class="group bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 p-6 flex items-start gap-4 transition-all hover:-translate-y-0.5 hover:shadow-slate-300/60">
          <div class="p-2.5 rounded-xl transition-transform group-hover:scale-105" :style="{ backgroundColor: `${primaryColor}1a` }">
            <svg class="w-5 h-5" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">Atención directa</p>
            <p class="mt-1 text-xs text-slate-500">¿Dudas con tu pedido? Contáctanos y te ayudamos.</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sf-dot-grid {
  background-image: radial-gradient(circle, rgba(15, 23, 42, 0.08) 1px, transparent 1.4px);
  background-size: 24px 24px;
  -webkit-mask-image: radial-gradient(ellipse 80% 80% at 72% 18%, #000 35%, transparent 100%);
  mask-image: radial-gradient(ellipse 80% 80% at 72% 18%, #000 35%, transparent 100%);
}

.sf-glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 24px 50px -24px rgba(15, 23, 42, 0.35);
}

.sf-float {
  animation: sf-float 7s ease-in-out infinite;
}

.sf-float-slow {
  animation: sf-float 9s ease-in-out infinite;
}

.sf-float-delay {
  animation: sf-float 8s ease-in-out infinite 1s;
}

@keyframes sf-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-14px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sf-float,
  .sf-float-slow,
  .sf-float-delay {
    animation: none;
  }
}
</style>
