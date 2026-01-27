<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <div class="flex items-center">
            <NuxtLink to="/" class="flex items-center gap-2">
              <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span class="text-white font-bold text-sm">FB</span>
              </div>
              <span class="text-xl font-semibold text-gray-900">Flowbit</span>
            </NuxtLink>
          </div>

          <!-- Navigation -->
          <nav class="hidden md:flex items-center gap-6">
            <!-- <NuxtLink
              to="/"
              class="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
            >
              Inicio
            </NuxtLink>
            <NuxtLink
              to="/admin"
              class="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
            >
              Admin
            </NuxtLink> -->
          </nav>

          <!-- Mobile menu button -->
          <button
            type="button"
            class="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NuxtPage />
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <span class="text-white font-bold text-xs">FB</span>
            </div>
            <span class="text-sm text-gray-600">Flowbit</span>
          </div>
          <p class="text-sm text-gray-500">
            &copy; {{ new Date().getFullYear() }} Flowbit. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>
  