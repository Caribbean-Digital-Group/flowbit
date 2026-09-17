<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteSection } from '~/utils/website/sections'
import type { StorefrontProductCard } from '~/composables/useStorefront'

const props = defineProps<{ section: WebsiteSection }>()
const websiteStore = useWebsiteStore()
const { slug, site } = storeToRefs(websiteStore)
const { getProducts } = useStorefront()

const products = ref<StorefrontProductCard[]>([])
const limit = computed(() => Math.min(Math.max(Number(props.section.props.limit ?? 4), 2), 12))
const storeBase = computed(() => (slug.value ? storefrontPath(slug.value) : '/'))

const load = async () => {
  if (!slug.value || !site.value?.storefront_url) {
    products.value = []
    return
  }
  const result = await getProducts(slug.value, { pageSize: limit.value, sort: 'best_sellers' })
  products.value = result?.products ?? []
}

watch([slug, limit, () => site.value?.storefront_url], load, { immediate: true })
</script>

<template>
  <div v-if="site?.storefront_url" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <WebsiteSectionHeading :eyebrow="String(section.props.eyebrow ?? '')" :title="String(section.props.title ?? '')" :align="section.style.align" />
    <div v-if="products.length" class="grid grid-cols-2 lg:grid-cols-4 gap-5 text-left">
      <a
        v-for="product in products"
        :key="product.id"
        :href="`${storeBase}/products/${product.slug}`"
        class="ws-card ws-card--hover overflow-hidden group"
      >
        <div class="ws-aspect-4-3 overflow-hidden" :style="{ backgroundColor: 'var(--sf-surface-muted)' }">
          <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="ws-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        </div>
        <div class="p-4">
          <p class="font-semibold text-sm ws-line-clamp-2">{{ product.name }}</p>
          <p class="mt-1.5 font-bold" :style="{ color: 'var(--sf-primary-readable)' }">{{ formatStorefrontCurrency(product.price_final, product.currency) }}</p>
        </div>
      </a>
    </div>
    <p v-else class="sf-muted text-sm">La tienda aún no tiene productos publicados.</p>
    <div v-if="section.props.show_button !== false" class="mt-8" :class="section.style.align === 'center' ? 'text-center' : ''">
      <a :href="site.storefront_url" class="sf-btn sf-btn--primary">Ir a la tienda</a>
    </div>
  </div>
</template>
