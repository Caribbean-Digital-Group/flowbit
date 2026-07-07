<script setup lang="ts">
import type { StorefrontProductCard } from '~/composables/useStorefront'

interface Props {
  product: StorefrontProductCard
  companySlug: string
}

const props = defineProps<Props>()

const storefrontStore = useStorefrontStore()

const productPath = computed(() =>
  storefrontPath(props.companySlug, `/products/${props.product.slug}`)
)

const hasDiscount = computed(
  () =>
    props.product.list_price_final !== null &&
    props.product.list_price_final > props.product.price_final
)

const handleQuickAdd = () => {
  if (!props.product.in_stock) return
  storefrontStore.addItem(props.product, 1)
  storefrontStore.notify(`«${props.product.name}» agregado al carrito`)
}
</script>

<template>
  <article
    class="group relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-300/50 hover:border-slate-200"
  >
    <NuxtLink :to="productPath" class="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
      <div class="aspect-square bg-slate-50 overflow-hidden relative">
        <img
          v-if="product.image_url"
          :src="product.image_url"
          :alt="product.name"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
        />
        <div v-else class="w-full h-full flex items-center justify-center">
          <svg class="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <span
          v-if="hasDiscount"
          class="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-500/30"
        >
          Oferta
        </span>
        <span
          v-if="!product.in_stock"
          class="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-slate-900/70 text-white text-xs font-semibold backdrop-blur-sm"
        >
          Agotado
        </span>
      </div>

      <div class="p-4 pb-2">
        <h3 class="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
          {{ product.name }}
        </h3>
        <p v-if="product.short_description" class="mt-1 text-xs text-slate-500 line-clamp-2">
          {{ product.short_description }}
        </p>
      </div>
    </NuxtLink>

    <div class="px-4 pb-4 mt-auto flex items-end justify-between gap-2">
      <div>
        <p class="text-base font-bold text-slate-900">
          {{ formatStorefrontCurrency(product.price_final, product.currency) }}
        </p>
        <p v-if="hasDiscount" class="text-xs text-slate-400 line-through">
          {{ formatStorefrontCurrency(product.list_price_final, product.currency) }}
        </p>
      </div>

      <button
        type="button"
        class="p-2.5 rounded-xl text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
        :style="{ backgroundColor: 'var(--sf-primary, #6366f1)' }"
        :disabled="!product.in_stock"
        :aria-label="product.in_stock ? `Agregar ${product.name} al carrito` : `${product.name} agotado`"
        @click="handleQuickAdd"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  </article>
</template>
