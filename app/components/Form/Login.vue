<template>
  <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-10 border border-slate-200">
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-5">
        <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h2 class="text-3xl font-bold text-slate-900">Iniciar Sesión</h2>
      <p class="text-slate-500 mt-3 text-lg">Accede a tu cuenta de Flowbit</p>
    </div>

    <form @submit.prevent="handleLogin" class="space-y-6">
      <div>
        <label for="email" class="block text-base font-medium text-slate-700 mb-2">
          Correo electrónico
        </label>
        <input
          id="email"
          v-model="loginForm.email"
          type="email"
          required
          class="w-full px-5 py-4 text-lg rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          placeholder="tu@email.com"
        />
      </div>

      <div>
        <label for="password" class="block text-base font-medium text-slate-700 mb-2">
          Contraseña
        </label>
        <div class="relative">
          <input
            id="password"
            v-model="loginForm.password"
            :type="showPassword ? 'text' : 'password'"
            required
            class="w-full px-5 py-4 text-lg rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all pr-14"
            placeholder="••••••••"
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <svg v-if="!showPassword" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <label class="flex items-center cursor-pointer">
          <input type="checkbox" v-model="loginForm.remember"
            class="w-5 h-5 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500">
          <span class="ml-3 text-base text-slate-600">Recordarme</span>
        </label>
        <a href="#" class="text-base text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
          ¿Olvidaste tu contraseña?
        </a>
      </div>

      <button
        type="submit"
        class="w-full py-5 px-6 text-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 mt-2"
      >
        Iniciar Sesión
      </button>
    </form>

    <div class="mt-8 text-center">
      <p class="text-base text-slate-500">
        ¿No tienes una cuenta?
        <span class="text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer transition-colors">
          Regístrate gratis
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

// Login form state
const loginForm = reactive({
  email: '',
  password: '',
  remember: false
})

const showPassword = ref(false)

// Handle login
const handleLogin = () => {
  console.log('Login attempt:', loginForm)
  // TODO: Implement actual login logic with Supabase
}
</script>

<style scoped>

</style>