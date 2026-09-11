<script setup lang="ts">
import type { StorefrontProductCard } from '~/composables/useStorefront'
import type { ProductCardStyle } from '~/utils/storefrontTheme'

interface Props {
  product: StorefrontProductCard
  companySlug: string
  /** Fuerza un estilo concreto; por defecto usa el de la plantilla activa. */
  variant?: ProductCardStyle | null
}

const props = withDefaults(defineProps<Props>(), { variant: null })

const storefrontStore = useStorefrontStore()
const { cardStyle } = useStorefrontTheme()

const style = computed<ProductCardStyle>(() => props.variant ?? cardStyle.value)

const productPath = computed(() =>
  storefrontPath(props.companySlug, `/products/${props.product.slug}`)
)

const hasDiscount = computed(
  () =>
    props.product.list_price_final !== null &&
    props.product.list_price_final > props.product.price_final
)

/** Porcentaje de ahorro, para comunicar el descuento con un número concreto. */
const discountPercent = computed(() => {
  if (!hasDiscount.value || !props.product.list_price_final) return null
  const off = 1 - props.product.price_final / props.product.list_price_final
  const rounded = Math.round(off * 100)
  return rounded > 0 ? rounded : null
})

const isAdding = ref(false)

const handleQuickAdd = () => {
  if (!props.product.in_stock || isAdding.value) return
  isAdding.value = true
  storefrontStore.addItem(props.product, 1)
  storefrontStore.notify(`«${props.product.name}» agregado al carrito`)
  setTimeout(() => { isAdding.value = false }, 700)
}

const tracker = useStorefrontTracker()

const handleSelect = () => {
  tracker.trackEcommerce('select_item', {
    currency: props.product.currency,
    items: [analyticsItemFromProduct(props.product)],
    properties: { product_id: props.product.id, product_name: props.product.name }
  })
}
</script>

<template>
  <article :class="['sf-card group', `sf-card--${style}`]">
    <NuxtLink
      :to="productPath"
      class="block focus:outline-none focus-visible:ring-2 rounded-[inherit]"
      :style="{ '--tw-ring-color': 'var(--sf-primary-ring)' }"
      @click="handleSelect"
    >
      <div class="sf-card__media">
        <img
          v-if="product.image_url"
          :src="product.image_url"
          :alt="product.name"
          loading="lazy"
          class="sf-card__image"
        />
        <div v-else class="w-full h-full flex items-center justify-center">
          <svg class="w-12 h-12 sf-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <!-- Descuento con el porcentaje exacto -->
        <span v-if="hasDiscount" class="sf-badge sf-badge--accent absolute top-3 left-3">
          {{ discountPercent ? `-${discountPercent}%` : 'Oferta' }}
        </span>
        <span v-if="!product.in_stock" class="sf-badge sf-badge--muted absolute top-3 right-3">
          Agotado
        </span>

        <!-- Acción rápida sobre la imagen (plantillas overlay y minimal) -->
        <div
          v-if="style === 'overlay' || style === 'minimal'"
          class="absolute inset-x-3 bottom-3 opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0"
        >
          <button
            type="button"
            class="sf-btn sf-btn--primary sf-btn--sm w-full"
            :disabled="!product.in_stock"
            :aria-label="product.in_stock ? `Agregar ${product.name} al carrito` : `${product.name} agotado`"
            @click.prevent="handleQuickAdd"
          >
            {{ product.in_stock ? 'Agregar al carrito' : 'Agotado' }}
          </button>
        </div>
      </div>

      <div :class="style === 'minimal' ? 'pt-3' : 'p-4 pb-2'">
        <h3 class="text-sm font-semibold line-clamp-2 leading-snug" :style="{ color: 'var(--sf-text)' }">
          {{ product.name }}
        </h3>
        <p v-if="product.short_description && style !== 'minimal'" class="sf-muted mt-1 text-xs line-clamp-2">
          {{ product.short_description }}
        </p>
      </div>
    </NuxtLink>

    <div
      :class="[
        'mt-auto flex items-end justify-between gap-2',
        style === 'minimal' ? 'pt-1' : 'px-4 pb-4'
      ]"
    >
      <div>
        <p class="text-base font-bold" :style="{ color: 'var(--sf-text)' }">
          {{ formatStorefrontCurrency(product.price_final, product.currency) }}
        </p>
        <p v-if="hasDiscount" class="sf-subtle text-xs line-through">
          {{ formatStorefrontCurrency(product.list_price_final, product.currency) }}
        </p>
      </div>

      <!-- En overlay y minimal la acción vive sobre la imagen -->
      <button
        v-if="style !== 'overlay' && style !== 'minimal'"
        type="button"
        class="sf-btn sf-btn--primary sf-btn--icon"
        :disabled="!product.in_stock"
        :aria-label="product.in_stock ? `Agregar ${product.name} al carrito` : `${product.name} agotado`"
        @click="handleQuickAdd"
      >
        <svg v-if="isAdding" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  </article>
</template>
