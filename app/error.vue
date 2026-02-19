<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const errorMessages: Record<number, { title: string; description: string }> = {
  400: {
    title: 'Solicitud incorrecta',
    description: 'La solicitud no pudo ser procesada debido a un error en los datos enviados.',
  },
  401: {
    title: 'No autorizado',
    description: 'Necesitas iniciar sesión para acceder a este recurso.',
  },
  403: {
    title: 'Acceso denegado',
    description: 'No tienes permisos para acceder a este recurso.',
  },
  404: {
    title: 'Página no encontrada',
    description: 'Lo sentimos, la página que buscas no existe o ha sido movida.',
  },
  500: {
    title: 'Error del servidor',
    description: 'Algo salió mal en nuestro servidor. Estamos trabajando para solucionarlo.',
  },
  503: {
    title: 'Servicio no disponible',
    description: 'El servicio está temporalmente fuera de línea. Intenta nuevamente más tarde.',
  },
}

const currentError = computed(() => {
  const status = props.error?.statusCode || 500
  return errorMessages[status] || {
    title: 'Error inesperado',
    description: props.error?.message || 'Ha ocurrido un error inesperado.',
  }
})

const handleError = () => {
  clearError()
  navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 flex items-center justify-center p-4">
    <!-- Fondo con efectos -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse" />
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse animation-delay-2000" />
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse animation-delay-4000" />
    </div>

    <!-- Contenido principal -->
    <div class="relative z-10 text-center max-w-lg mx-auto">
      <!-- Ilustración SVG -->
      <div class="mb-8 relative">
        <svg
          class="w-64 h-64 mx-auto text-purple-300"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Círculo exterior -->
          <circle
            cx="100"
            cy="100"
            r="90"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray="8 8"
            class="animate-spin-slow"
          />
          <!-- Círculo interior -->
          <circle
            cx="100"
            cy="100"
            r="70"
            stroke="currentColor"
            stroke-width="1"
            class="opacity-60"
          />
          <!-- Icono de alerta -->
          <path
            d="M100 50L130 110H70L100 50Z"
            stroke="currentColor"
            stroke-width="3"
            stroke-linejoin="round"
            fill="none"
            class="text-purple-500"
          />
          <circle cx="100" cy="90" r="3" fill="currentColor" class="text-purple-500" />
          <line
            x1="100"
            y1="70"
            x2="100"
            y2="82"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            class="text-purple-500"
          />
        </svg>

        <!-- Código de error superpuesto -->
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 animate-pulse">
            {{ error?.statusCode || 500 }}
          </span>
        </div>
      </div>

      <!-- Título del error -->
      <h1 class="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
        {{ currentError.title }}
      </h1>

      <!-- Descripción -->
      <p class="text-slate-600 text-lg mb-8 leading-relaxed">
        {{ currentError.description }}
      </p>

      <!-- Mensaje técnico (solo en desarrollo) -->
      <div
        v-if="error?.message && error.message !== currentError.description"
        class="mb-8 p-4 bg-white/70 rounded-xl border border-slate-200 backdrop-blur-sm shadow-sm"
      >
        <p class="text-sm text-slate-500 font-mono">
          {{ error.message }}
        </p>
      </div>

      <!-- Botones de acción -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          class="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl font-semibold text-white shadow-lg shadow-purple-300/50 hover:shadow-purple-400/60 transition-all duration-300 hover:scale-105 cursor-pointer"
          @click="handleError"
        >
          <span class="relative z-10 flex items-center justify-center gap-2">
            <svg class="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al inicio
          </span>
        </button>

        <button
          class="px-8 py-4 bg-white/80 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-white hover:border-slate-300 hover:text-slate-900 transition-all duration-300 backdrop-blur-sm shadow-sm cursor-pointer"
          @click="$router.go(-1)"
        >
          Página anterior
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin-slow 20s linear infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}
</style>
