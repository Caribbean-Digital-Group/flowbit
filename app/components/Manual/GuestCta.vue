<script setup lang="ts">
/**
 * Llamado a la acción del manual público. Solo se muestra a quien no tiene
 * sesión: a un usuario que ya opera Flowbit no se le ofrece crear una cuenta.
 */
const authStore = useAuthStore()

// La sesión se resuelve en el cliente; hasta entonces no se pinta nada
// para evitar que el aviso parpadee a quien sí está autenticado.
const resolved = ref(false)

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await authStore.loadSession()
  }
  resolved.value = true
})

const showCta = computed(() => resolved.value && !authStore.isAuthenticated)
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
  >
    <section
      v-if="showCta"
      class="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-6 text-center shadow-lg shadow-indigo-200/50 print:hidden"
    >
      <h2 class="text-lg font-bold text-white mb-1.5">¿Listo para aplicarlo en tu empresa?</h2>
      <p class="text-sm text-white/85 max-w-lg mx-auto leading-relaxed mb-4">
        Flowbit es un ERP open source y gratuito: ventas, inventario, proyectos, punto de venta y tienda en línea en un solo lugar.
      </p>
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold shadow-lg hover:shadow-xl transition-shadow"
      >
        Crear mi cuenta gratis
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </NuxtLink>
    </section>
  </Transition>
</template>
