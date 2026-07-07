<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StorefrontProductCard, StorefrontProductDetail } from '~/composables/useStorefront'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const storefrontStore = useStorefrontStore()
const { store, primaryColor } = storeToRefs(storefrontStore)
const { getProduct } = useStorefront()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const productSlug = computed(() => {
  const raw = route.params.product_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const product = ref<StorefrontProductDetail | null>(null)
const relatedProducts = ref<StorefrontProductCard[]>([])
const isLoading = ref(true)
const notFound = ref(false)
const quantity = ref(1)
const activeImageIndex = ref(0)

const basePath = computed(() => storefrontPath(companySlug.value))

/** Galería: imagen principal + imágenes adicionales (entradas string del JSONB) */
const gallery = computed<string[]>(() => {
  if (!product.value) return []
  const extra = (product.value.images ?? []).filter(
    (entry): entry is string => typeof entry === 'string' && !!entry
  )
  const urls = [product.value.image_url, ...extra].filter((url): url is string => !!url)
  return [...new Set(urls)]
})

const activeImage = computed(() => gallery.value[activeImageIndex.value] ?? null)

const hasDiscount = computed(
  () =>
    product.value?.list_price_final != null &&
    product.value.list_price_final > product.value.price_final
)

const maxQuantity = computed(() => {
  if (!product.value) return 1
  return product.value.stock_available ?? 99
})

/** Atributos del producto (color, talla, material…) como especificaciones */
const attributeEntries = computed(() => {
  if (!product.value?.attributes) return []
  return Object.entries(product.value.attributes).filter(
    ([, value]) => value !== null && value !== undefined && `${value}`.trim() !== ''
  )
})

const load = async () => {
  isLoading.value = true
  notFound.value = false
  try {
    const result = await getProduct(companySlug.value, productSlug.value)
    if (!result) {
      notFound.value = true
      product.value = null
      relatedProducts.value = []
      return
    }
    product.value = result.product
    relatedProducts.value = result.relatedProducts
    quantity.value = 1
    activeImageIndex.value = 0
  } finally {
    isLoading.value = false
  }
}

watch([companySlug, productSlug], () => void load(), { immediate: true })

const adjustQuantity = (delta: number) => {
  quantity.value = Math.max(1, Math.min(quantity.value + delta, maxQuantity.value))
}

const handleAddToCart = () => {
  if (!product.value || !product.value.in_stock) return
  storefrontStore.addItem(product.value, quantity.value)
  storefrontStore.notify(`«${product.value.name}» agregado al carrito`)
}

const isSharing = ref(false)

/** URL absoluta del producto para compartir. */
const shareUrl = computed(() => {
  if (typeof window !== 'undefined') return window.location.href
  const base = (useRuntimeConfig().public.siteUrl as string | undefined)?.replace(/\/$/, '') ?? ''
  return `${base}${basePath.value}/products/${productSlug.value}`
})

/** Texto con la información del producto para compartir/copiar. */
const shareText = computed(() => {
  const p = product.value
  if (!p) return ''
  const description = p.short_description || p.description || ''
  return [
    `🛍️ ${p.name}`,
    description ? description.trim().slice(0, 200) : '',
    `💵 Precio: ${formatStorefrontCurrency(p.price_final, p.currency)}`,
    store.value?.name ? `🏬 ${store.value.name}` : '',
    shareUrl.value
  ]
    .filter(Boolean)
    .join('\n')
})

const handleShare = async () => {
  if (!product.value || isSharing.value) return
  isSharing.value = true
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: product.value.name,
        text: shareText.value,
        url: shareUrl.value
      })
      return
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText.value)
      storefrontStore.notify('Información del producto copiada al portapapeles')
    }
  } catch (error) {
    // El usuario canceló el diálogo nativo de compartir: no es un error real.
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error('Error sharing product:', error)
    try {
      await navigator.clipboard.writeText(shareText.value)
      storefrontStore.notify('Información del producto copiada al portapapeles')
    } catch {
      storefrontStore.notify('No se pudo compartir el producto')
    }
  } finally {
    isSharing.value = false
  }
}

useHead(() => ({
  title: product.value
    ? `${product.value.meta_title || product.value.name} — ${store.value?.name ?? ''}`
    : store.value?.name ?? 'Producto',
  meta: [
    {
      name: 'description',
      content:
        product.value?.meta_description ??
        product.value?.short_description ??
        product.value?.description?.slice(0, 160) ??
        ''
    },
    ...(product.value
      ? [
          { property: 'og:title', content: product.value.name },
          ...(product.value.image_url
            ? [{ property: 'og:image', content: product.value.image_url }]
            : [])
        ]
      : [])
  ],
  script: product.value
    ? [
        {
          type: 'application/ld+json',
          textContent: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.value.name,
            description: product.value.short_description ?? product.value.description ?? undefined,
            image: gallery.value,
            sku: product.value.sku ?? undefined,
            offers: {
              '@type': 'Offer',
              price: product.value.price_final,
              priceCurrency: product.value.currency,
              availability: product.value.in_stock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock'
            }
          })
        }
      ]
    : []
}))
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <!-- Skeleton -->
    <div v-if="isLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-pulse">
      <div class="aspect-square bg-slate-100 rounded-2xl" />
      <div class="space-y-4 pt-4">
        <div class="h-8 bg-slate-100 rounded w-3/4" />
        <div class="h-5 bg-slate-100 rounded w-1/3" />
        <div class="h-24 bg-slate-100 rounded" />
      </div>
    </div>

    <!-- No encontrado -->
    <div v-else-if="notFound" class="py-24 text-center">
      <h1 class="text-2xl font-bold text-slate-900 mb-2">Producto no disponible</h1>
      <p class="text-slate-500 mb-6">Este producto no existe o ya no está publicado.</p>
      <NuxtLink
        :to="`${basePath}/products`"
        class="inline-flex px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        :style="{ backgroundColor: primaryColor }"
      >
        Ver catálogo
      </NuxtLink>
    </div>

    <template v-else-if="product">
      <!-- Breadcrumb -->
      <nav class="mb-6 text-sm text-slate-500 flex items-center gap-2 flex-wrap" aria-label="Migas de pan">
        <NuxtLink :to="basePath" class="hover:text-slate-800 transition-colors">Inicio</NuxtLink>
        <span aria-hidden="true">/</span>
        <NuxtLink :to="`${basePath}/products`" class="hover:text-slate-800 transition-colors">Productos</NuxtLink>
        <template v-if="product.category_name">
          <span aria-hidden="true">/</span>
          <NuxtLink
            :to="{ path: `${basePath}/products`, query: { category: product.category_id } }"
            class="hover:text-slate-800 transition-colors"
          >
            {{ product.category_name }}
          </NuxtLink>
        </template>
        <span aria-hidden="true">/</span>
        <span class="text-slate-800 font-medium truncate max-w-[12rem]">{{ product.name }}</span>
      </nav>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <!-- Galería -->
        <div>
          <div class="aspect-square bg-white rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden">
            <img
              v-if="activeImage"
              :src="activeImage"
              :alt="product.name"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-slate-100">
              <svg class="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <div v-if="gallery.length > 1" class="mt-4 flex gap-3 overflow-x-auto pb-1">
            <button
              v-for="(image, index) in gallery"
              :key="image"
              type="button"
              class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              :class="index === activeImageIndex ? 'border-slate-800' : 'border-transparent opacity-70 hover:opacity-100'"
              :aria-label="`Ver imagen ${index + 1} de ${product.name}`"
              @click="activeImageIndex = index"
            >
              <img :src="image" :alt="''" class="w-full h-full object-cover" />
            </button>
          </div>
        </div>

        <!-- Info -->
        <div>
          <div v-if="product.category_name" class="mb-3">
            <span class="inline-flex px-3 py-1 rounded-full text-xs font-semibold" :style="{ backgroundColor: `${primaryColor}1a`, color: primaryColor }">
              {{ product.category_name }}
            </span>
          </div>

          <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">{{ product.name }}</h1>
          <p v-if="product.sku" class="mt-1 text-xs text-slate-400">SKU: {{ product.sku }}</p>

          <div class="mt-5 flex items-end gap-3">
            <p class="text-3xl font-bold text-slate-900">
              {{ formatStorefrontCurrency(product.price_final, product.currency) }}
            </p>
            <p v-if="hasDiscount" class="text-lg text-slate-400 line-through pb-0.5">
              {{ formatStorefrontCurrency(product.list_price_final, product.currency) }}
            </p>
          </div>
          <p class="mt-1 text-xs text-slate-400">Impuestos incluidos.</p>

          <!-- Disponibilidad -->
          <div class="mt-4">
            <span
              v-if="product.in_stock"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600"
            >
              <span class="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Disponible
              <template v-if="product.stock_available !== null && product.stock_available <= 10">
                — ¡solo quedan {{ product.stock_available }}!
              </template>
            </span>
            <span v-else class="inline-flex items-center gap-1.5 text-sm font-medium text-rose-500">
              <span class="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true" />
              Agotado
            </span>
          </div>

          <p v-if="product.short_description" class="mt-5 text-slate-600 leading-relaxed">
            {{ product.short_description }}
          </p>

          <!-- Atributos -->
          <div v-if="attributeEntries.length" class="mt-6">
            <p class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Características</p>
            <dl class="grid grid-cols-2 gap-x-6 gap-y-2">
              <div v-for="[key, value] in attributeEntries" :key="key" class="flex items-baseline gap-2 text-sm">
                <dt class="text-slate-400 capitalize">{{ key }}:</dt>
                <dd class="text-slate-700 font-medium">{{ value }}</dd>
              </div>
            </dl>
          </div>

          <!-- Cantidad + agregar -->
          <div class="mt-8 flex flex-col sm:flex-row gap-3">
            <div class="flex items-center rounded-xl border border-slate-200 bg-white w-fit">
              <button
                type="button"
                class="px-4 py-3 text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors"
                :disabled="quantity <= 1"
                aria-label="Disminuir cantidad"
                @click="adjustQuantity(-1)"
              >
                −
              </button>
              <span class="w-10 text-center text-sm font-semibold text-slate-900" aria-live="polite">
                {{ quantity }}
              </span>
              <button
                type="button"
                class="px-4 py-3 text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors"
                :disabled="quantity >= maxQuantity"
                aria-label="Aumentar cantidad"
                @click="adjustQuantity(1)"
              >
                +
              </button>
            </div>

            <button
              type="button"
              class="flex-1 sm:flex-none sm:min-w-[14rem] px-8 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
              :style="{ backgroundColor: primaryColor }"
              :disabled="!product.in_stock"
              @click="handleAddToCart"
            >
              {{ product.in_stock ? 'Agregar al carrito' : 'Agotado' }}
            </button>

            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
              :disabled="isSharing"
              aria-label="Compartir producto"
              @click="handleShare"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Compartir
            </button>
          </div>

          <!-- Descripción -->
          <div v-if="product.description" class="mt-10 pt-8 border-t border-slate-200">
            <h2 class="text-lg font-bold text-slate-900 mb-3">Descripción</h2>
            <p class="text-slate-600 leading-relaxed whitespace-pre-line">{{ product.description }}</p>
          </div>

          <!-- Tags -->
          <div v-if="product.tags.length" class="mt-6 flex flex-wrap gap-2">
            <span
              v-for="tag in product.tags"
              :key="tag"
              class="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-500"
            >
              #{{ tag }}
            </span>
          </div>
        </div>
      </div>

      <!-- Relacionados -->
      <section v-if="relatedProducts.length" class="mt-16">
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 mb-6">También te puede interesar</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          <StorefrontProductCard
            v-for="related in relatedProducts"
            :key="related.id"
            :product="related"
            :company-slug="companySlug"
          />
        </div>
      </section>
    </template>
  </div>
</template>
