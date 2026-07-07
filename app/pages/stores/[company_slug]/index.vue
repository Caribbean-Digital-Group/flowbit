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
    <section class="relative overflow-hidden">
      <div
        class="absolute inset-0"
        :style="
          store.banner_url
            ? {}
            : { background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc, #0f172a)` }
        "
      >
        <img
          v-if="store.banner_url"
          :src="store.banner_url"
          alt=""
          class="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div v-if="store.banner_url" class="absolute inset-0 bg-slate-900/55" />
      </div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
        <h1 class="text-3xl sm:text-5xl font-bold text-white tracking-tight max-w-3xl mx-auto">
          {{ store.hero_title || store.name }}
        </h1>
        <p v-if="store.hero_subtitle || store.description" class="mt-4 text-base sm:text-lg text-white/85 max-w-2xl mx-auto">
          {{ store.hero_subtitle || store.description }}
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <NuxtLink
            :to="`${basePath}/products`"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-900 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Explorar productos
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </NuxtLink>
          <NuxtLink
            :to="`${basePath}/about`"
            class="inline-flex items-center px-6 py-3 rounded-xl border border-white/40 text-white text-sm font-semibold transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Conócenos
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Categorías -->
    <section v-if="categories.length" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Categorías</h2>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="{ path: `${basePath}/products`, query: { category: category.id } }"
          class="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-lg shadow-slate-200/50 hover:shadow-slate-300/60 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            :style="{ backgroundColor: category.color || primaryColor }"
            aria-hidden="true"
          />
          <span class="text-sm font-semibold text-slate-800 whitespace-nowrap">{{ category.name }}</span>
          <span class="text-xs text-slate-400">{{ category.product_count }}</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Productos destacados -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900">Destacados</h2>
        <NuxtLink
          :to="`${basePath}/products`"
          class="text-sm font-semibold transition-opacity hover:opacity-75"
          :style="{ color: primaryColor }"
        >
          Ver todo →
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

      <div v-else class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 py-16 text-center">
        <p class="text-slate-500">Aún no hay productos publicados en esta tienda.</p>
      </div>
    </section>

    <!-- Beneficios -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 flex items-start gap-4">
          <div class="p-2.5 rounded-xl" :style="{ backgroundColor: `${primaryColor}1a` }">
            <svg class="w-5 h-5" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.6a1 1 0 01.9.55L19.6 11H21a1 1 0 011 1v4a1 1 0 01-1 1h-1m-6 0a2 2 0 104 0m-4 0H9m10 0a2 2 0 11-4 0" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">Envíos a tu puerta</p>
            <p class="mt-1 text-xs text-slate-500">Elige el método de envío que más te convenga al pagar.</p>
          </div>
        </div>
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 flex items-start gap-4">
          <div class="p-2.5 rounded-xl" :style="{ backgroundColor: `${primaryColor}1a` }">
            <svg class="w-5 h-5" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.6-2.6A11.95 11.95 0 0112 2.9a11.95 11.95 0 01-8.6 3.5A12 12 0 0012 21.8a12 12 0 008.6-16.4z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">Compra segura</p>
            <p class="mt-1 text-xs text-slate-500">Tus datos se procesan de forma segura en todo momento.</p>
          </div>
        </div>
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 flex items-start gap-4">
          <div class="p-2.5 rounded-xl" :style="{ backgroundColor: `${primaryColor}1a` }">
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
