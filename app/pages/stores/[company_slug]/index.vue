<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const storefrontStore = useStorefrontStore()
const { store, categories, featuredProducts } = storeToRefs(storefrontStore)
const { sections, benefits, uppercaseHeadings } = useStorefrontTheme()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const basePath = computed(() => storefrontPath(companySlug.value))

/** Iconos disponibles para los beneficios editables de la portada. */
const BENEFIT_ICONS: Record<string, string> = {
  truck: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.6a1 1 0 01.9.55L19.6 11H21a1 1 0 011 1v4a1 1 0 01-1 1h-1m-6 0a2 2 0 104 0m-4 0H9m10 0a2 2 0 11-4 0',
  shield: 'M9 12l2 2 4-4m5.6-2.6A11.95 11.95 0 0112 2.9a11.95 11.95 0 01-8.6 3.5A12 12 0 0012 21.8a12 12 0 008.6-16.4z',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.4-4 8-9 8a9.9 9.9 0 01-4-.8L3 21l1.8-4A7.9 7.9 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z',
  tag: 'M7 7h.01M7 3h5c.5 0 1 .2 1.4.6l7 7a2 2 0 010 2.8l-7 7a2 2 0 01-2.8 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
  gift: 'M12 8v13m0-13V6a2 2 0 114 0v2m-4 0H8m4 0h4m4 0v13H4V8h16zM4 12h16',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  star: 'M11.05 3.9c.3-.92 1.6-.92 1.9 0l1.52 4.67a1 1 0 00.95.69h4.91c.97 0 1.38 1.24.6 1.81l-3.98 2.89a1 1 0 00-.36 1.12l1.51 4.67c.3.92-.75 1.69-1.53 1.12l-3.98-2.89a1 1 0 00-1.18 0l-3.97 2.89c-.79.57-1.84-.2-1.54-1.12l1.52-4.67a1 1 0 00-.36-1.12L3.07 11.07c-.78-.57-.38-1.81.59-1.81h4.91a1 1 0 00.95-.69l1.53-4.67z',
  credit: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
}

const benefitIcon = (icon: string): string => BENEFIT_ICONS[icon] ?? BENEFIT_ICONS.shield!

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
    <StorefrontHero :base-path="basePath" />

    <!-- ══ Categorías ═══════════════════════════════════════════════════ -->
    <section
      v-if="sections.categories && categories.length"
      class="sf-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div class="flex items-end justify-between gap-4 mb-6">
        <div>
          <p class="sf-eyebrow">Explora</p>
          <h2 class="sf-heading mt-1.5 text-xl sm:text-2xl font-bold">Categorías</h2>
        </div>
        <NuxtLink :to="`${basePath}/products`" class="sf-link text-sm hidden sm:inline-flex items-center gap-1">
          Ver todo
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </NuxtLink>
      </div>

      <div class="sf-scroll-x pb-2 -mx-1 px-1">
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="{ path: `${basePath}/products`, query: { category: category.id } }"
          class="sf-card sf-card--bordered group w-40 sm:w-48 overflow-hidden"
        >
          <!-- Con imagen la categoría se ve como escaparate; sin ella, color sólido -->
          <div class="sf-card__media" :class="category.image_url ? '' : 'flex items-center justify-center'">
            <img
              v-if="category.image_url"
              :src="category.image_url"
              :alt="category.name"
              loading="lazy"
              class="sf-card__image"
            />
            <span
              v-else
              class="w-12 h-12 rounded-full"
              :style="{ backgroundColor: category.color || 'var(--sf-primary)', opacity: 0.85 }"
              aria-hidden="true"
            />
          </div>
          <div class="p-3">
            <p class="text-sm font-semibold line-clamp-1" :style="{ color: 'var(--sf-text)' }">
              {{ category.name }}
            </p>
            <p class="sf-subtle text-xs tabular-nums mt-0.5">
              {{ category.product_count }} {{ category.product_count === 1 ? 'producto' : 'productos' }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- ══ Destacados ═══════════════════════════════════════════════════ -->
    <section v-if="sections.featured" class="sf-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-end justify-between gap-4 mb-6">
        <div>
          <p class="sf-eyebrow">Selección</p>
          <h2 class="sf-heading mt-1.5 text-xl sm:text-2xl font-bold">Destacados</h2>
        </div>
        <NuxtLink :to="`${basePath}/products`" class="sf-link text-sm inline-flex items-center gap-1">
          Ver todo
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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

      <div v-else class="sf-surface sf-border py-16 text-center">
        <p class="sf-muted">Aún no hay productos publicados en esta tienda.</p>
      </div>
    </section>

    <!-- ══ Nuestra historia ═════════════════════════════════════════════ -->
    <section
      v-if="sections.story && store.about_text"
      class="sf-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div
        class="sf-surface sf-border overflow-hidden grid md:grid-cols-2 gap-0 items-stretch"
      >
        <div class="p-8 sm:p-10 flex flex-col justify-center">
          <p class="sf-eyebrow">Quiénes somos</p>
          <h2 class="sf-heading mt-2 text-2xl font-bold">{{ store.name }}</h2>
          <p class="sf-muted mt-4 text-sm leading-relaxed whitespace-pre-line line-clamp-[10]">
            {{ store.about_text }}
          </p>
          <NuxtLink :to="`${basePath}/about`" class="sf-link text-sm mt-5 inline-flex items-center gap-1">
            Leer más
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </NuxtLink>
        </div>
        <div
          class="min-h-[16rem] hidden md:block"
          :style="{ background: 'linear-gradient(135deg, var(--sf-primary) 0%, var(--sf-secondary) 100%)' }"
        >
          <img
            v-if="store.banner_url"
            :src="store.banner_url"
            :alt="store.name"
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </section>

    <!-- ══ Beneficios ═══════════════════════════════════════════════════ -->
    <section v-if="sections.benefits" class="sf-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div
          v-for="benefit in benefits"
          :key="benefit.title"
          class="sf-card sf-card--bordered p-6 flex items-start gap-4"
        >
          <div
            class="p-2.5 flex-shrink-0"
            :style="{ backgroundColor: 'var(--sf-primary-soft)', borderRadius: 'var(--sf-radius-md)' }"
          >
            <svg
              class="w-5 h-5"
              :style="{ color: 'var(--sf-primary-readable)' }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="benefitIcon(benefit.icon)" />
            </svg>
          </div>
          <div>
            <p
              class="text-sm font-semibold"
              :style="{ color: 'var(--sf-text)', textTransform: uppercaseHeadings ? 'uppercase' : 'none' }"
            >
              {{ benefit.title }}
            </p>
            <p class="sf-muted mt-1 text-xs leading-relaxed">{{ benefit.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="h-4" />
  </div>
</template>
