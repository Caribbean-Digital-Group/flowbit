<script setup lang="ts">
/**
 * Layout de la documentación (/manual).
 * Es una sección pública: funciona sin sesión y se adapta cuando el visitante
 * sí está autenticado, ofreciéndole la vuelta al panel en vez del registro.
 */
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

onMounted(async () => {
  // Se resuelve la sesión solo para adaptar el encabezado; nunca redirige.
  if (!authStore.isAuthenticated) {
    await authStore.loadSession()
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <header class="bg-white/85 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 print:hidden">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 gap-3">
          <NuxtLink to="/manual" class="flex items-center gap-2.5 group min-w-0">
            <div class="w-9 h-9 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
              <span class="text-white font-bold text-sm">FB</span>
            </div>
            <div class="min-w-0">
              <span class="block text-lg font-semibold text-slate-900 leading-tight">Flowbit</span>
              <span class="block text-[11px] text-slate-500 leading-tight">Manual de usuario</span>
            </div>
          </NuxtLink>

          <div class="flex items-center gap-1.5">
            <NuxtLink
              to="/manual"
              class="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              Todas las guías
            </NuxtLink>

            <!-- Con sesión: vuelta al panel -->
            <NuxtLink
              v-if="isAuthenticated"
              to="/admin"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg shadow-slate-900/15 hover:bg-slate-800 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Volver al panel
            </NuxtLink>

            <!-- Invitado: registro -->
            <NuxtLink
              v-else
              to="/"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow"
            >
              Probar Flowbit gratis
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <slot />
      </div>
    </main>

    <!-- Asistente Bit, también disponible para visitantes sin cuenta -->
    <ManualFloatingAssistant />

    <footer class="bg-white border-t border-slate-200 print:hidden">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p class="text-xs text-slate-500 text-center sm:text-left">
          Manual de Flowbit, el ERP open source de Caribbean Digital Group. Comparte estas guías libremente.
        </p>
        <p class="text-xs text-slate-400">&copy; {{ new Date().getFullYear() }} Flowbit</p>
      </div>
    </footer>
  </div>
</template>
