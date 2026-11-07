<script setup lang="ts">
interface Props {
  title?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Empieza gratis en menos de 2 minutos',
  description: 'Crea tu cuenta, da de alta tu empresa e invita a tu equipo. Sin tarjeta de crédito y sin instalar nada.'
})
</script>

<template>
  <section class="bg-white px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
    <div class="relative max-w-5xl mx-auto overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 py-12 sm:px-12 sm:py-16 text-center">
      <div class="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-20 -left-20 w-80 h-80 bg-fuchsia-500/25 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative">
        <h2 class="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">{{ title }}</h2>
        <p class="text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">{{ description }}</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <NuxtLink
            to="/?registro=1"
            class="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors shadow-2xl"
          >
            Crear cuenta gratis
            <svg class="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </NuxtLink>
          <NuxtLink
            to="/manual"
            class="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
          >
            Leer el manual
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
