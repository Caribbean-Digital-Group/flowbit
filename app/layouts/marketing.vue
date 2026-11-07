<script setup lang="ts">
/**
 * Layout de las páginas públicas de marketing: la landing y /funcionalidades.
 *
 * El footer enlaza cada página de módulo: además de servir de navegación, es
 * el enlazado interno que le indica a los buscadores qué páginas importan.
 */
import { FEATURE_MODULES } from '~/utils/features'

const isMenuOpen = ref(false)
const route = useRoute()

watch(() => route.fullPath, () => { isMenuOpen.value = false })

const navLinks = [
  { label: 'Funcionalidades', to: '/funcionalidades' },
  { label: 'Manual', to: '/manual' },
  { label: 'Preguntas frecuentes', to: '/#preguntas-frecuentes' }
]

// El registro vive en el formulario del hero de la landing; ?registro=1 lo abre.
const registerLink = '/?registro=1'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-950">
    <header class="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-white/10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 gap-4">
          <NuxtLink to="/" class="flex items-center gap-2.5 group" aria-label="Flowbit, ir al inicio">
            <img src="/favicon.svg" alt="" aria-hidden="true" class="w-9 h-9 rounded-xl" width="36" height="36" />
            <span class="text-lg font-semibold text-white">Flowbit</span>
          </NuxtLink>

          <nav aria-label="Principal" class="hidden md:flex items-center gap-1">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              active-class="text-white"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>

          <div class="flex items-center gap-2">
            <NuxtLink
              :to="registerLink"
              class="hidden sm:inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
            >
              Crear cuenta gratis
            </NuxtLink>
            <button
              type="button"
              class="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              :aria-expanded="isMenuOpen"
              aria-controls="marketing-mobile-menu"
              aria-label="Abrir menú"
              @click="isMenuOpen = !isMenuOpen"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path v-if="!isMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <nav v-if="isMenuOpen" id="marketing-mobile-menu" aria-label="Principal móvil" class="md:hidden pb-4 space-y-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5"
          >
            {{ link.label }}
          </NuxtLink>
          <NuxtLink
            :to="registerLink"
            class="block px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 text-center"
          >
            Crear cuenta gratis
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="flex-1 w-full">
      <slot />
    </main>

    <footer class="relative bg-slate-950 border-t border-white/10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div class="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr]">
          <!-- Marca -->
          <div>
            <div class="flex items-center gap-2.5 mb-4">
              <img src="/favicon.svg" alt="" aria-hidden="true" class="w-9 h-9 rounded-xl" width="36" height="36" />
              <span class="text-lg font-semibold text-white">Flowbit</span>
            </div>
            <p class="text-sm text-slate-400 leading-relaxed max-w-xs">
              ERP gratuito y open source para pymes: CRM, ventas, punto de venta, inventario,
              tienda en línea, sitio web, Recursos Humanos y nómina en una sola plataforma.
            </p>
            <p class="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.6-2.6A11.95 11.95 0 0112 2.9a11.95 11.95 0 01-8.6 3.5A12 12 0 0012 21.8a12 12 0 008.6-16.4z" />
              </svg>
              Licencia MIT · Tus datos son tuyos
            </p>
          </div>

          <!-- Módulos -->
          <nav aria-label="Módulos">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              <NuxtLink to="/funcionalidades" class="hover:text-white transition-colors">Funcionalidades</NuxtLink>
            </h2>
            <ul class="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <li v-for="module in FEATURE_MODULES" :key="module.slug">
                <NuxtLink :to="`/funcionalidades/${module.slug}`" class="text-sm text-slate-400 hover:text-white transition-colors">
                  {{ module.name }}
                </NuxtLink>
              </li>
            </ul>
          </nav>

          <!-- Recursos -->
          <nav aria-label="Recursos">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Recursos</h2>
            <ul class="space-y-2.5">
              <li><NuxtLink to="/manual" class="text-sm text-slate-400 hover:text-white transition-colors">Manual de usuario</NuxtLink></li>
              <li><NuxtLink to="/manual/getting-started" class="text-sm text-slate-400 hover:text-white transition-colors">Primeros pasos</NuxtLink></li>
              <li><NuxtLink to="/#preguntas-frecuentes" class="text-sm text-slate-400 hover:text-white transition-colors">Preguntas frecuentes</NuxtLink></li>
              <li><NuxtLink :to="registerLink" class="text-sm text-slate-400 hover:text-white transition-colors">Crear cuenta</NuxtLink></li>
            </ul>
          </nav>

          <!-- Proyecto -->
          <nav aria-label="Proyecto">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Proyecto</h2>
            <ul class="space-y-2.5">
              <li>
                <a href="https://github.com/Caribbean-Digital-Group/flowbit" target="_blank" rel="noopener" class="text-sm text-slate-400 hover:text-white transition-colors">
                  Código en GitHub
                </a>
              </li>
              <li>
                <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener" class="text-sm text-slate-400 hover:text-white transition-colors">
                  Licencia MIT
                </a>
              </li>
              <li>
                <a href="https://github.com/Caribbean-Digital-Group/flowbit/issues" target="_blank" rel="noopener" class="text-sm text-slate-400 hover:text-white transition-colors">
                  Reportar un problema
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div class="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p class="text-xs text-slate-500">
            &copy; {{ new Date().getFullYear() }} Flowbit
          </p>
          <p class="text-xs text-slate-500">
            Hecho con Nuxt y Supabase
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>
