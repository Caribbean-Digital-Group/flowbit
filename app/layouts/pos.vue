<script setup lang="ts">
const authStore = useAuthStore()
const router = useRouter()

const isReady = ref(false)

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await authStore.loadSession()
  }

  if (!authStore.isAuthenticated) {
    router.push('/')
    return
  }

  isReady.value = true
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col">
    <div
      v-if="!isReady"
      class="flex-1 flex items-center justify-center"
    >
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25 animate-pulse">
          <span class="text-white font-bold text-base">FB</span>
        </div>
        <p class="text-slate-500 text-sm font-medium">Cargando punto de venta…</p>
      </div>
    </div>

    <slot v-else />
  </div>
</template>
