<script setup lang="ts">
// Handlers para el Avatar dropdown
const handleProfile = () => {
  // Navegar a la página de perfil
  navigateTo('/perfil')
}

const handleLogout = () => {
  // Lógica para cerrar sesión
  console.log('Cerrando sesión...')
  // Aquí puedes agregar la lógica de logout con Supabase
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <!-- Header -->
    <header class="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <div class="flex items-center">
            <NuxtLink to="/" class="flex items-center gap-2.5 group">
              <div class="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
                <span class="text-white font-bold text-sm">FB</span>
              </div>
              <span class="text-xl font-semibold text-slate-900">Flowbit</span>
            </NuxtLink>
          </div>

          
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 w-full">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-xs">FB</span>
            </div>
            <span class="text-sm font-medium text-slate-700">Flowbit</span>
          </div>
          <p class="text-sm text-slate-500">
            &copy; {{ new Date().getFullYear() }} Flowbit. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>
