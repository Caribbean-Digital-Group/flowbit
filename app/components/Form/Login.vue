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
      <FormInput
        id="email"
        v-model="loginForm.email"
        type="email"
        label="Correo electrónico"
        placeholder="tu@email.com"
        required
      />

      <FormInput
        id="password"
        v-model="loginForm.password"
        type="password"
        label="Contraseña"
        placeholder="••••••••"
        required
      />

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

      <BtnApp
        type="submit"
        variant="primary"
        size="lg"
        :loading="isLoading"
        loading-text="Iniciando sesión..."
        block
        class="mt-2"
      >
        Iniciar Sesión
      </BtnApp>
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
import { reactive, ref } from 'vue'

// Login form state
const loginForm = reactive({
  email: '',
  password: '',
  remember: false
})

// Loading state
const isLoading = ref(false)

// Handle login
const handleLogin = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  
  try {
    console.log('Login attempt:', loginForm)
    // TODO: Implement actual login logic with Supabase
    // Simular delay de login
    await new Promise(resolve => setTimeout(resolve, 2000))
  } catch (error) {
    console.error('Login error:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>

</style>
