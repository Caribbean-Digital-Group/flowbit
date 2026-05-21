<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <header class="bg-white/85 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <NuxtLink to="/" class="flex items-center gap-2.5 group">
            <div class="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
              <span class="text-white font-bold text-sm">FB</span>
            </div>
            <span class="text-xl font-semibold text-slate-900">Flowbit</span>
          </NuxtLink>

          <span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Vista pública
          </span>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <slot />
      </div>
    </main>

    <footer class="bg-white border-t border-slate-200">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p class="text-xs text-slate-500">
          Esta vista muestra únicamente el seguimiento del proyecto. Para acceder al panel administrativo es necesario iniciar sesión.
        </p>
        <p class="text-xs text-slate-400">
          &copy; {{ new Date().getFullYear() }} Flowbit
        </p>
      </div>
    </footer>
  </div>
</template>
