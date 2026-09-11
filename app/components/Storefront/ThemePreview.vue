<script setup lang="ts">
import { resolveStorefrontTheme, type ThemeOverrides } from '~/utils/storefrontTheme'

interface Props {
  overrides: ThemeOverrides
  storeName?: string
  heroTitle?: string
  heroSubtitle?: string
  ctaLabel?: string
  device?: 'desktop' | 'mobile'
}

const props = withDefaults(defineProps<Props>(), {
  storeName: 'Mi tienda',
  heroTitle: '',
  heroSubtitle: '',
  ctaLabel: 'Explorar productos',
  device: 'desktop'
})

/**
 * Maqueta en miniatura de la portada: se redibuja con cada cambio del
 * formulario para que el vendedor vea el resultado antes de guardar.
 * Usa los mismos tokens que la tienda real, así que lo que se ve aquí
 * es exactamente lo que se publica.
 */
const theme = computed(() => resolveStorefrontTheme(props.overrides))

const title = computed(() => props.heroTitle?.trim() || props.storeName)
const subtitle = computed(
  () => props.heroSubtitle?.trim() || 'Descubre nuestra selección de productos.'
)

const layout = computed(() => theme.value.heroLayout)
const isCompactHero = computed(() => layout.value === 'compact')
</script>

<template>
  <div
    class="overflow-hidden border border-slate-200 shadow-inner"
    :style="{ ...theme.tokens, borderRadius: '0.75rem', backgroundColor: 'var(--sf-bg)' }"
  >
    <div :class="device === 'mobile' ? 'max-w-[22rem] mx-auto' : ''">
      <!-- Barra de anuncio -->
      <div
        class="text-center text-[0.6rem] font-medium py-1"
        :style="{ backgroundColor: 'var(--sf-primary-strong)', color: 'var(--sf-primary-contrast)' }"
      >
        Envío gratis en compras mayores a $999
      </div>

      <!-- Encabezado -->
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        :style="{ backgroundColor: 'var(--sf-surface)', borderColor: 'var(--sf-border)' }"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <span
            class="w-5 h-5 flex items-center justify-center text-[0.5rem] font-bold"
            :style="{
              backgroundColor: 'var(--sf-primary-strong)',
              color: 'var(--sf-primary-contrast)',
              borderRadius: 'var(--sf-radius-sm)'
            }"
          >
            {{ storeName.slice(0, 2).toUpperCase() }}
          </span>
          <span
            class="text-[0.65rem] font-semibold truncate"
            :style="{
              color: 'var(--sf-text)',
              fontFamily: 'var(--sf-font-heading)',
              textTransform: 'var(--sf-heading-transform)' as never
            }"
          >
            {{ storeName }}
          </span>
        </div>
        <div class="flex items-center gap-2" :style="{ color: 'var(--sf-text-subtle)' }">
          <span class="hidden sm:inline text-[0.55rem]">Inicio · Productos</span>
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: 'var(--sf-accent-strong)' }" />
        </div>
      </div>

      <!-- Hero -->
      <div
        class="px-4 relative overflow-hidden"
        :class="isCompactHero ? 'py-3' : 'py-6'"
        :style="isCompactHero ? { backgroundColor: 'var(--sf-surface)' } : {}"
      >
        <div
          v-if="theme.theme.decorated && !isCompactHero"
          class="absolute -top-10 -right-8 w-28 h-28 rounded-full"
          :style="{ background: 'var(--sf-primary)', opacity: 0.18, filter: 'blur(28px)' }"
          aria-hidden="true"
        />

        <div
          class="relative"
          :class="[
            layout === 'centered' || layout === 'banner' ? 'text-center' : '',
            layout === 'split' || layout === 'editorial' ? 'grid grid-cols-[1.1fr_1fr] gap-3 items-center' : ''
          ]"
        >
          <div>
            <p
              v-if="!isCompactHero"
              class="text-[0.5rem] font-bold uppercase tracking-widest"
              :style="{ color: 'var(--sf-primary-readable)' }"
            >
              Tienda en línea
            </p>
            <p
              class="font-bold leading-tight"
              :class="isCompactHero ? 'text-xs' : 'text-sm mt-1'"
              :style="{
                color: 'var(--sf-text)',
                fontFamily: 'var(--sf-font-heading)',
                textTransform: 'var(--sf-heading-transform)' as never,
                letterSpacing: 'var(--sf-heading-tracking)'
              }"
            >
              {{ title }}
            </p>
            <p
              class="text-[0.55rem] mt-1 leading-relaxed line-clamp-2"
              :style="{ color: 'var(--sf-text-muted)' }"
            >
              {{ subtitle }}
            </p>
            <div
              class="mt-2 flex gap-1.5"
              :class="layout === 'centered' || layout === 'banner' ? 'justify-center' : ''"
            >
              <span
                class="px-2 py-1 text-[0.5rem] font-semibold"
                :style="{
                  backgroundColor: 'var(--sf-primary-strong)',
                  color: 'var(--sf-primary-contrast)',
                  borderRadius: 'var(--sf-radius-pill)'
                }"
              >
                {{ ctaLabel }}
              </span>
              <span
                v-if="!isCompactHero"
                class="px-2 py-1 text-[0.5rem] font-semibold border"
                :style="{
                  borderColor: 'var(--sf-border)',
                  color: 'var(--sf-text)',
                  borderRadius: 'var(--sf-radius-pill)'
                }"
              >
                Conócenos
              </span>
            </div>
          </div>

          <!-- Bloque visual del hero -->
          <div
            v-if="layout === 'split' || layout === 'editorial'"
            class="grid grid-cols-2 gap-1.5"
          >
            <span
              v-for="n in 4"
              :key="n"
              class="block"
              :class="n === 1 && layout === 'split' ? 'row-span-2 aspect-[3/4]' : 'aspect-square'"
              :style="{
                background: n % 2 === 0
                  ? 'var(--sf-surface-muted)'
                  : 'linear-gradient(135deg, var(--sf-primary) 0%, var(--sf-secondary) 100%)',
                opacity: n % 2 === 0 ? 1 : 0.85,
                borderRadius: 'var(--sf-radius-md)'
              }"
            />
          </div>
        </div>
      </div>

      <!-- Rejilla de productos -->
      <div class="px-4 pb-4">
        <p
          class="text-[0.6rem] font-bold mb-2"
          :style="{
            color: 'var(--sf-text)',
            fontFamily: 'var(--sf-font-heading)',
            textTransform: 'var(--sf-heading-transform)' as never
          }"
        >
          Destacados
        </p>
        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="n in 4"
            :key="n"
            class="overflow-hidden"
            :style="{
              backgroundColor: theme.cardStyle === 'minimal' ? 'transparent' : 'var(--sf-surface)',
              border: theme.cardStyle === 'minimal' ? 'none' : '1px solid var(--sf-border)',
              borderRadius: theme.cardStyle === 'minimal' ? '0' : 'var(--sf-radius-lg)',
              boxShadow: theme.cardStyle === 'elevated' ? 'var(--sf-shadow-sm)' : 'none'
            }"
          >
            <div
              class="aspect-square relative"
              :style="{
                backgroundColor: 'var(--sf-surface-muted)',
                borderRadius: theme.cardStyle === 'minimal' ? 'var(--sf-radius-sm)' : '0'
              }"
            >
              <span
                v-if="n === 1"
                class="absolute top-1 left-1 px-1 py-0.5 text-[0.4rem] font-bold"
                :style="{
                  backgroundColor: 'var(--sf-accent-strong)',
                  color: 'var(--sf-accent-contrast)',
                  borderRadius: 'var(--sf-radius-pill)'
                }"
              >
                -20%
              </span>
            </div>
            <div class="p-1.5">
              <span class="block h-1 rounded-full mb-1" :style="{ backgroundColor: 'var(--sf-border)', width: '85%' }" />
              <div class="flex items-center justify-between gap-1">
                <span class="text-[0.5rem] font-bold" :style="{ color: 'var(--sf-text)' }">$299</span>
                <span
                  class="w-3.5 h-3.5 flex items-center justify-center text-[0.5rem] leading-none"
                  :style="{
                    backgroundColor: 'var(--sf-primary-strong)',
                    color: 'var(--sf-primary-contrast)',
                    borderRadius: 'var(--sf-radius-sm)'
                  }"
                >
                  +
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
