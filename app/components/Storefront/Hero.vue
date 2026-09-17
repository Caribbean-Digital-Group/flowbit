<script setup lang="ts">
import { storeToRefs } from 'pinia'

/**
 * Hero de la portada. Una sola pieza con cinco composiciones, elegidas por la
 * plantilla activa o por el vendedor:
 *
 *  split      texto + collage de productos reales
 *  centered   texto centrado + tira de productos
 *  banner     imagen a sangre con el texto encima
 *  editorial  título grande y una sola imagen, mucho aire
 *  compact    franja delgada para ir directo al catálogo
 */
const storefrontStore = useStorefrontStore()
const { store, featuredProducts } = storeToRefs(storefrontStore)
const { heroLayout, decorated, heroCtaLabel } = useStorefrontTheme()

const props = defineProps<{ basePath: string }>()

const hasBanner = computed(() => Boolean(store.value?.banner_url))

/** `banner` sin imagen cargada no tiene nada que mostrar: cae a `centered`. */
const layout = computed(() => {
  if (heroLayout.value === 'banner' && !hasBanner.value) return 'centered'
  return heroLayout.value
})

const title = computed(() => store.value?.hero_title || store.value?.name || '')
const subtitle = computed(() => store.value?.hero_subtitle || store.value?.description || '')

/** Imágenes reales del catálogo: el escaparate muestra lo que se vende. */
const collage = computed(() =>
  featuredProducts.value.filter(p => p.image_url).slice(0, 5)
)

const productsPath = computed(() => `${props.basePath}/products`)
const aboutPath = computed(() => `${props.basePath}/about`)

/** Texto sobre la imagen del banner: siempre claro sobre el velo oscuro. */
const onMediaText = { color: '#ffffff' }
</script>

<template>
  <section v-if="store" class="relative overflow-hidden">
    <!-- ══ Banner a sangre ══════════════════════════════════════════════ -->
    <template v-if="layout === 'banner'">
      <div class="absolute inset-0">
        <img :src="store.banner_url!" alt="" class="w-full h-full object-cover" aria-hidden="true" />
        <div class="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/55 to-slate-950/80" />
      </div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-white/75">Tienda en línea</p>
        <h1 class="sf-heading mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold" :style="onMediaText">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto text-white/85">
          {{ subtitle }}
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <NuxtLink :to="productsPath" class="sf-btn sf-btn--on-media">
            {{ heroCtaLabel }}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </NuxtLink>
          <NuxtLink :to="aboutPath" class="sf-btn sf-btn--outline-on-media">Conócenos</NuxtLink>
        </div>
      </div>
    </template>

    <!-- ══ Editorial ════════════════════════════════════════════════════ -->
    <template v-else-if="layout === 'editorial'">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div class="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
          <div>
            <p class="sf-eyebrow">Colección</p>
            <h1 class="sf-heading mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold">
              {{ title }}
            </h1>
            <p v-if="subtitle" class="sf-muted mt-6 text-base sm:text-lg leading-relaxed max-w-lg">
              {{ subtitle }}
            </p>
            <div class="mt-9 flex flex-wrap items-center gap-3">
              <NuxtLink :to="productsPath" class="sf-btn sf-btn--primary">{{ heroCtaLabel }}</NuxtLink>
              <NuxtLink :to="aboutPath" class="sf-link text-sm">Nuestra historia →</NuxtLink>
            </div>
          </div>

          <div class="relative">
            <div
              v-if="store.banner_url || collage[0]"
              class="overflow-hidden"
              :style="{ borderRadius: 'var(--sf-radius-lg)' }"
            >
              <img
                :src="store.banner_url || collage[0]!.image_url!"
                :alt="store.name"
                class="w-full aspect-[4/5] object-cover"
              />
            </div>
            <div
              v-else
              class="sf-surface-muted w-full aspect-[4/5]"
              :style="{ borderRadius: 'var(--sf-radius-lg)' }"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ══ Compacta ═════════════════════════════════════════════════════ -->
    <template v-else-if="layout === 'compact'">
      <div class="sf-border-b" :style="{ backgroundColor: 'var(--sf-surface)' }">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div class="min-w-0">
              <h1 class="sf-heading text-2xl sm:text-3xl font-bold">{{ title }}</h1>
              <p v-if="subtitle" class="sf-muted mt-1.5 text-sm leading-relaxed max-w-2xl">
                {{ subtitle }}
              </p>
            </div>
            <NuxtLink :to="productsPath" class="sf-btn sf-btn--primary flex-shrink-0">
              {{ heroCtaLabel }}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ Centrada ═════════════════════════════════════════════════════ -->
    <template v-else-if="layout === 'centered'">
      <div v-if="decorated" class="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="sf-hero-glow -top-40 left-1/4 w-[32rem] h-[32rem]" />
        <div class="sf-hero-glow sf-hero-glow--secondary -bottom-48 right-1/4 w-[28rem] h-[28rem]" />
        <div class="absolute inset-0 sf-hero-dots" />
      </div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-20 text-center">
        <span class="sf-badge sf-badge--soft">Tienda en línea</span>
        <h1 class="sf-heading mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold max-w-3xl mx-auto">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="sf-muted mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
          {{ subtitle }}
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <NuxtLink :to="productsPath" class="sf-btn sf-btn--primary">
            {{ heroCtaLabel }}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </NuxtLink>
          <NuxtLink :to="aboutPath" class="sf-btn sf-btn--outline">Conócenos</NuxtLink>
        </div>

        <!-- Tira de productos reales -->
        <div v-if="collage.length >= 3" class="mt-12 flex items-end justify-center gap-3 sm:gap-4">
          <NuxtLink
            v-for="(product, i) in collage.slice(0, 5)"
            :key="product.id"
            :to="`${basePath}/products/${product.slug}`"
            class="overflow-hidden shadow-lg transition-transform hover:-translate-y-1"
            :class="i === 2 ? 'w-28 sm:w-40' : 'w-20 sm:w-28 hidden sm:block'"
            :style="{ borderRadius: 'var(--sf-radius-lg)' }"
          >
            <img :src="product.image_url!" :alt="product.name" class="w-full aspect-square object-cover" loading="lazy" />
          </NuxtLink>
        </div>
      </div>
    </template>

    <!-- ══ Dividida (por defecto) ═══════════════════════════════════════ -->
    <template v-else>
      <div v-if="decorated" class="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="sf-hero-glow -top-32 -right-24 w-[30rem] h-[30rem]" />
        <div class="sf-hero-glow sf-hero-glow--secondary -bottom-40 -left-20 w-[26rem] h-[26rem]" />
        <div class="absolute inset-0 sf-hero-dots" />
      </div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20">
        <div class="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div class="text-center lg:text-left">
            <span class="sf-badge sf-badge--soft">Tienda en línea</span>
            <h1 class="sf-heading mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold">
              {{ title }}
            </h1>
            <p v-if="subtitle" class="sf-muted mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
              {{ subtitle }}
            </p>

            <div class="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <NuxtLink :to="productsPath" class="sf-btn sf-btn--primary">
                {{ heroCtaLabel }}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </NuxtLink>
              <NuxtLink :to="aboutPath" class="sf-btn sf-btn--outline">Conócenos</NuxtLink>
            </div>
          </div>

          <!-- Collage con productos reales del catálogo -->
          <div v-if="collage.length" class="relative hidden lg:block">
            <div class="grid grid-cols-2 gap-4">
              <NuxtLink
                v-for="(product, i) in collage.slice(0, 4)"
                :key="product.id"
                :to="`${basePath}/products/${product.slug}`"
                class="group relative overflow-hidden shadow-lg transition-transform hover:-translate-y-1"
                :class="i === 0 ? 'row-span-2 aspect-[3/4]' : 'aspect-square'"
                :style="{ borderRadius: 'var(--sf-radius-lg)' }"
              >
                <img
                  :src="product.image_url!"
                  :alt="product.name"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-3">
                  <p class="text-xs font-semibold text-white line-clamp-1">{{ product.name }}</p>
                  <p class="text-[0.7rem] text-white/80">
                    {{ formatStorefrontCurrency(product.price_final, product.currency) }}
                  </p>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Sin imágenes de producto: banner o degradado de marca -->
          <div v-else class="relative hidden lg:block">
            <div
              class="w-full aspect-[4/3] overflow-hidden"
              :style="{
                borderRadius: 'var(--sf-radius-xl)',
                background: 'linear-gradient(135deg, var(--sf-primary) 0%, var(--sf-secondary) 100%)'
              }"
            >
              <img
                v-if="store.banner_url"
                :src="store.banner_url"
                :alt="store.name"
                class="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
