<script setup lang="ts">
// Vista privada a pantalla completa: no debe aparecer en buscadores.
useHead({
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'theme-color', content: '#065f46' }
  ]
})

const authStore = useAuthStore()

const isReady = ref(false)

// El guard global ya exige sesión; esto es el respaldo, igual que en el layout `admin`.
onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await authStore.loadSession()
  }
  if (!authStore.isAuthenticated) {
    await navigateTo({ path: '/', query: { redirect: '/valle-bit' } })
    return
  }
  isReady.value = true
})
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-emerald-900">
    <div v-if="!isReady" class="flex h-full items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <div class="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-3xl shadow-lg" aria-hidden="true">
          🤖
        </div>
        <p class="text-sm font-medium text-emerald-100">Abriendo Valle Bit…</p>
      </div>
    </div>

    <slot v-else />
  </div>
</template>
