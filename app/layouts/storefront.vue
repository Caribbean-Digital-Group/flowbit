<script setup lang="ts">
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const storefrontStore = useStorefrontStore()
const {
  store,
  isLoading,
  notFound,
  itemCount,
  primaryColor,
  toastMessage
} = storeToRefs(storefrontStore)

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

const basePath = computed(() => storefrontPath(companySlug.value))

const navLinks = computed(() => [
  { label: 'Inicio', to: basePath.value },
  { label: 'Productos', to: `${basePath.value}/products` },
  { label: 'Nosotros', to: `${basePath.value}/about` }
])

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
  <div
    class="min-h-screen flex flex-col bg-slate-50 text-slate-800"
    :style="{ '--sf-primary': primaryColor }"
  >
    <!-- Tienda no encontrada / desactivada -->
    <div
      v-if="notFound"
      class="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div class="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mb-6">
        <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-slate-900 mb-2">Tienda no disponible</h1>
      <p class="text-slate-500 max-w-md">
        La tienda que buscas no existe o está temporalmente desactivada.
      </p>
    </div>

    <!-- Carga inicial -->
    <div v-else-if="isLoading && !store" class="flex-1 flex items-center justify-center py-32">
      <div
        class="w-10 h-10 rounded-full border-4 border-slate-200 animate-spin"
        :style="{ borderTopColor: primaryColor }"
        role="status"
        aria-label="Cargando tienda"
      />
    </div>

    <template v-else-if="store">
      <!-- Barra de anuncio -->
      <div
        v-if="store.announcement"
        class="text-center text-xs sm:text-sm font-medium text-white px-4 py-2"
        :style="{ backgroundColor: primaryColor }"
      >
        {{ store.announcement }}
      </div>

      <!-- Header -->
      <header class="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
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
                class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                :style="{ backgroundColor: primaryColor }"
              >
                {{ store.name.slice(0, 2).toUpperCase() }}
              </div>
              <span class="text-lg font-semibold text-slate-900 truncate">{{ store.name }}</span>
            </NuxtLink>

            <nav class="hidden md:flex items-center gap-6" aria-label="Navegación de la tienda">
              <NuxtLink
                v-for="link in navLinks"
                :key="link.to"
                :to="link.to"
                class="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-md px-1 py-0.5"
              >
                {{ link.label }}
              </NuxtLink>
            </nav>

            <div class="flex items-center gap-1.5 sm:gap-2">
              <!-- Buscador -->
              <button
                type="button"
                class="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
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
                class="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                aria-label="Mi cuenta"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </NuxtLink>

              <!-- Carrito -->
              <NuxtLink
                :to="`${basePath}/cart`"
                class="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                :aria-label="`Carrito de compra, ${itemCount} artículos`"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6a1 1 0 00.9 1.4h12M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
                <span
                  v-if="itemCount > 0"
                  class="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full text-[0.65rem] font-bold text-white flex items-center justify-center"
                  :style="{ backgroundColor: primaryColor }"
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
                class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                aria-label="Buscar productos"
              />
              <button
                type="submit"
                class="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                :style="{ backgroundColor: primaryColor }"
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
              class="text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap transition-colors"
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
      <footer class="bg-white border-t border-slate-200 mt-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <p class="text-sm font-semibold text-slate-900 mb-3">{{ store.name }}</p>
              <p v-if="store.description" class="text-sm text-slate-500 leading-relaxed line-clamp-4">
                {{ store.description }}
              </p>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900 mb-3">Información</p>
              <ul class="space-y-2">
                <li>
                  <NuxtLink :to="`${basePath}/about`" class="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                    Quiénes somos
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink :to="`${basePath}/about#politicas`" class="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                    Envíos y devoluciones
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink :to="`${basePath}/about#politicas`" class="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                    Privacidad y términos
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900 mb-3">Contacto</p>
              <ul class="space-y-2 text-sm text-slate-500">
                <li v-if="store.contact_email">
                  <a :href="`mailto:${store.contact_email}`" class="hover:text-slate-800 transition-colors">
                    {{ store.contact_email }}
                  </a>
                </li>
                <li v-if="store.contact_phone">
                  <a :href="`tel:${store.contact_phone}`" class="hover:text-slate-800 transition-colors">
                    {{ store.contact_phone }}
                  </a>
                </li>
                <li v-if="store.contact_address">{{ store.contact_address }}</li>
              </ul>
            </div>
          </div>
          <div class="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p class="text-xs text-slate-400">
              &copy; {{ new Date().getFullYear() }} {{ store.name }}. Todos los derechos reservados.
            </p>
            <p class="text-xs text-slate-400">
              Tienda en línea creada con <span class="font-semibold text-slate-500">Flowbit</span>
            </p>
          </div>
        </div>
      </footer>
    </template>

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
