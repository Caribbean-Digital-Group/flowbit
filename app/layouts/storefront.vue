<script setup lang="ts">
import { storeToRefs } from 'pinia'
import '~/assets/css/storefront.css'

const route = useRoute()
const router = useRouter()
const storefrontStore = useStorefrontStore()
const {
  store,
  isLoading,
  notFound,
  itemCount,
  toastMessage
} = storeToRefs(storefrontStore)

// Tema de la tienda: variables CSS, tipografía y composición
const { resolved, themeStyle, isDark, useThemeFonts } = useStorefrontTheme()
useThemeFonts()

/** La barra de anuncio puede llevar a una promoción concreta. */
const announcementLink = computed(() => store.value?.announcement_link?.trim() || null)

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const searchTerm = ref('')
const isSearchOpen = ref(false)

watch(
  companySlug,
  (slug) => {
    if (slug) void storefrontStore.initialize(slug)
  },
  { immediate: true }
)

// ── Analítica first-party ────────────────────────────────────────────
// El layout solo llama a la fachada: page_view en cada cambio de ruta y
// solo con consentimiento otorgado. El transporte vive en el tracker.
const tracker = useStorefrontTracker()
const lastTrackedPath = ref<string | null>(null)

const trackCurrentPage = () => {
  if (!store.value || tracker.consent.value !== 'granted') return
  if (lastTrackedPath.value === route.fullPath) return
  lastTrackedPath.value = route.fullPath
  // nextTick: esperar a que la página destino actualice el título
  void nextTick(() => tracker.trackPageView(route.path))
}

onMounted(async () => {
  watch(
    companySlug,
    (slug) => {
      if (slug) tracker.configure(slug)
    },
    { immediate: true }
  )
  watch([() => route.fullPath, store, tracker.consent], trackCurrentPage, { immediate: true })

  // Vincular usuario autenticado (solo el id, sin PII adicional)
  const user = await useSupabaseUser()
  tracker.identify(user?.id ?? null)
})

const basePath = computed(() => storefrontPath(companySlug.value))

const navLinks = computed(() => [
  { label: 'Inicio', to: basePath.value },
  { label: 'Productos', to: `${basePath.value}/products` },
  { label: 'Nosotros', to: `${basePath.value}/about` }
])

const whatsappLink = computed(() =>
  buildWhatsappLink(
    store.value?.whatsapp_phone,
    `¡Hola! Qué gusto saludarlos${store.value?.name ? ' ' + store.value.name : ''}. ✨ Estoy navegando por su tienda y me dio muchísima curiosidad ver todo lo que tienen. Tengo una duda, ¡sé que con su ayuda la resolvemos de volada!`
  )
)

const handleSearch = () => {
  const term = searchTerm.value.trim()
  isSearchOpen.value = false
  router.push({
    path: `${basePath.value}/products`,
    query: term ? { search: term } : {}
  })
  searchTerm.value = ''
}
</script>

<template>
  <div class="sf-root min-h-screen flex flex-col" :style="themeStyle">
    <!-- Tienda no encontrada / desactivada -->
    <div
      v-if="notFound"
      class="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div class="sf-surface-muted w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
        <svg class="w-8 h-8 sf-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h1 class="sf-heading text-2xl font-bold mb-2">Tienda no disponible</h1>
      <p class="sf-muted max-w-md">
        La tienda que buscas no existe o está temporalmente desactivada.
      </p>
    </div>

    <!-- Carga inicial -->
    <div v-else-if="isLoading && !store" class="flex-1 flex items-center justify-center py-32">
      <div
        class="w-10 h-10 rounded-full border-4 animate-spin"
        :style="{ borderColor: 'var(--sf-border)', borderTopColor: 'var(--sf-primary)' }"
        role="status"
        aria-label="Cargando tienda"
      />
    </div>

    <template v-else-if="store">
      <!-- Barra de anuncio -->
      <component
        :is="announcementLink ? 'a' : 'div'"
        v-if="store.announcement"
        :href="announcementLink ?? undefined"
        class="block text-center text-xs sm:text-sm font-medium px-4 py-2"
        :class="announcementLink ? 'hover:opacity-90 transition-opacity' : ''"
        :style="{
          backgroundColor: 'var(--sf-primary-strong)',
          color: 'var(--sf-primary-contrast)'
        }"
      >
        {{ store.announcement }}
        <span v-if="announcementLink" aria-hidden="true">&nbsp;→</span>
      </component>

      <!-- Header -->
      <header
        class="sf-border-b backdrop-blur-md sticky top-0 z-40"
        :style="{ backgroundColor: isDark ? 'rgba(2,6,23,0.82)' : 'rgba(255,255,255,0.88)' }"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between gap-4 h-16">
            <NuxtLink :to="basePath" class="flex items-center gap-2.5 min-w-0 group">
              <img
                v-if="store.logo_url"
                :src="store.logo_url"
                :alt="`Logo de ${store.name}`"
                class="w-9 h-9 rounded-xl object-cover shadow-sm"
              />
              <div
                v-else
                class="w-9 h-9 flex items-center justify-center font-bold text-sm shadow-sm"
                :style="{
                  backgroundColor: 'var(--sf-primary-strong)',
                  color: 'var(--sf-primary-contrast)',
                  borderRadius: 'var(--sf-radius-md)'
                }"
              >
                {{ store.name.slice(0, 2).toUpperCase() }}
              </div>
              <span class="sf-heading text-lg font-semibold truncate">{{ store.name }}</span>
            </NuxtLink>

            <nav class="hidden md:flex items-center gap-6" aria-label="Navegación de la tienda">
              <NuxtLink
                v-for="link in navLinks"
                :key="link.to"
                :to="link.to"
                class="sf-muted text-sm font-medium transition-colors hover:opacity-70 rounded-md px-1 py-0.5"
              >
                {{ link.label }}
              </NuxtLink>
            </nav>

            <div class="flex items-center gap-1.5 sm:gap-2">
              <!-- Buscador -->
              <button
                type="button"
                class="sf-icon-btn"
                :aria-expanded="isSearchOpen"
                aria-label="Buscar productos"
                @click="isSearchOpen = !isSearchOpen"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                </svg>
              </button>

              <!-- Cuenta -->
              <NuxtLink
                :to="`${basePath}/account`"
                class="sf-icon-btn"
                aria-label="Mi cuenta"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </NuxtLink>

              <!-- Carrito -->
              <NuxtLink
                :to="`${basePath}/cart`"
                class="sf-icon-btn relative"
                :aria-label="`Carrito de compra, ${itemCount} artículos`"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6a1 1 0 00.9 1.4h12M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
                <span
                  v-if="itemCount > 0"
                  class="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full text-[0.65rem] font-bold flex items-center justify-center"
                  :style="{ backgroundColor: 'var(--sf-accent-strong)', color: 'var(--sf-accent-contrast)' }"
                >
                  {{ itemCount > 99 ? '99+' : itemCount }}
                </span>
              </NuxtLink>
            </div>
          </div>

          <!-- Barra de búsqueda expandible -->
          <form
            v-if="isSearchOpen"
            class="pb-3"
            role="search"
            @submit.prevent="handleSearch"
          >
            <div class="flex gap-2">
              <input
                v-model="searchTerm"
                type="search"
                placeholder="Buscar productos..."
                class="sf-input flex-1"
                aria-label="Buscar productos"
              />
              <button
                type="submit"
                class="sf-btn sf-btn--primary sf-btn--sm"
              >
                Buscar
              </button>
            </div>
          </form>

          <!-- Navegación mobile -->
          <nav class="md:hidden flex items-center gap-5 pb-3 overflow-x-auto" aria-label="Navegación de la tienda">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="sf-muted text-sm font-medium whitespace-nowrap transition-opacity hover:opacity-70"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>
      </header>

      <main class="flex-1">
        <slot />
      </main>

      <!-- Footer -->
      <footer :class="['sf-footer mt-16', whatsappLink ? 'sf-footer--fab' : '']">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            <!-- Marca -->
            <div class="sm:col-span-2">
              <NuxtLink :to="basePath" class="inline-flex items-center gap-3">
                <img
                  v-if="store.logo_url"
                  :src="store.logo_url"
                  :alt="store.name"
                  class="h-9 w-auto max-w-[160px] object-contain"
                />
                <span
                  v-else
                  class="w-9 h-9 flex items-center justify-center font-bold text-sm"
                  :style="{
                    backgroundColor: 'var(--sf-primary-strong)',
                    color: 'var(--sf-primary-contrast)',
                    borderRadius: 'var(--sf-radius-md)'
                  }"
                >
                  {{ store.name.slice(0, 2).toUpperCase() }}
                </span>
                <span class="sf-heading text-base font-semibold">{{ store.name }}</span>
              </NuxtLink>
              <p v-if="store.description" class="sf-muted text-sm leading-relaxed line-clamp-4 mt-4 max-w-md">
                {{ store.description }}
              </p>
            </div>

            <!-- Información -->
            <nav aria-label="Información de la tienda">
              <p class="sf-footer-title">Información</p>
              <ul class="space-y-2.5">
                <li><NuxtLink :to="`${basePath}/products`" class="sf-footer-link">Catálogo</NuxtLink></li>
                <li><NuxtLink :to="`${basePath}/about`" class="sf-footer-link">Quiénes somos</NuxtLink></li>
                <li><NuxtLink :to="`${basePath}/about#politicas`" class="sf-footer-link">Envíos y devoluciones</NuxtLink></li>
                <li><NuxtLink :to="`${basePath}/about#politicas`" class="sf-footer-link">Privacidad y términos</NuxtLink></li>
              </ul>
            </nav>

            <!-- Contacto -->
            <div v-if="store.contact_email || store.contact_phone || store.contact_address">
              <p class="sf-footer-title">Contacto</p>
              <ul class="space-y-2.5">
                <li v-if="store.contact_email">
                  <a :href="`mailto:${store.contact_email}`" class="sf-footer-link break-all">{{ store.contact_email }}</a>
                </li>
                <li v-if="store.contact_phone">
                  <a :href="`tel:${store.contact_phone}`" class="sf-footer-link">{{ store.contact_phone }}</a>
                </li>
                <li v-if="store.contact_address" class="sf-muted text-sm leading-relaxed">{{ store.contact_address }}</li>
              </ul>
            </div>
          </div>

          <div class="sf-footer-bar flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <p class="sf-subtle text-xs">
              &copy; {{ new Date().getFullYear() }} {{ store.name }}. Todos los derechos reservados.
            </p>
            <p class="sf-subtle text-xs">
              Tienda en línea creada con <span class="sf-muted font-semibold">Flowbit</span>
            </p>
          </div>
        </div>
      </footer>

      <!-- Botón flotante de WhatsApp -->
      <a
        v-if="whatsappLink"
        :href="whatsappLink"
        target="_blank"
        rel="noopener"
        class="sf-wa-btn group fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/40 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
        aria-label="Contactar por WhatsApp"
      >
        <span class="absolute inset-0 rounded-full bg-[#25D366] opacity-60 sf-wa-ping" aria-hidden="true" />
        <svg class="relative w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <span class="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          ¿Necesitas ayuda? Escríbenos
        </span>
      </a>
    </template>

    <!-- Consentimiento de cookies / analítica -->
    <StorefrontCookieConsent
      v-if="store"
      :base-path="basePath"
      :primary-color="resolved.primaryStrong"
    />

    <!-- Toast de feedback -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="toastMessage"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-lg shadow-slate-900/20"
        role="status"
        aria-live="polite"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sf-wa-ping {
  animation: sf-wa-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes sf-wa-ping {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  70%,
  100% {
    transform: scale(1.7);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sf-wa-ping {
    animation: none;
  }
}
</style>
