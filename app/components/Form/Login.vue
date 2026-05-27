<template>
  <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-10 border border-slate-200">

    <!-- FORGOT PASSWORD VIEW -->
    <template v-if="view === 'forgot-password'">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-5">
          <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-slate-900">Recuperar contraseña</h2>
        <p class="text-slate-500 mt-3 text-base">Te enviaremos un enlace a tu correo para restablecer tu contraseña.</p>
      </div>

      <div
        v-if="resetError"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        <svg class="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ resetError }}
      </div>

      <div
        v-if="resetSuccess"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        <svg class="h-5 w-5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Revisa tu correo. Si la cuenta existe, recibirás un enlace de recuperación.
      </div>

      <form v-if="!resetSuccess" @submit.prevent="handleResetRequest" class="space-y-6">
        <FormInput
          id="reset-email"
          v-model="resetEmail"
          type="email"
          label="Correo electrónico"
          placeholder="tu@email.com"
          required
        />

        <BtnApp
          type="submit"
          variant="primary"
          size="lg"
          :loading="isResetLoading"
          loading-text="Enviando..."
          block
          class="mt-2"
        >
          Enviar enlace de recuperación
        </BtnApp>
      </form>

      <div class="mt-8 text-center">
        <button
          type="button"
          @click="goTo('login')"
          class="text-base text-indigo-600 hover:text-indigo-700 font-medium transition-colors inline-flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al inicio de sesión
        </button>
      </div>
    </template>

    <!-- REGISTER VIEW -->
    <template v-else-if="view === 'register'">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-violet-100 rounded-2xl mb-5">
          <svg class="w-8 h-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-slate-900">Crear cuenta</h2>
        <p class="text-slate-500 mt-3 text-base">Regístrate para acceder a Flowbit.</p>
      </div>

      <div
        v-if="registerError"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        <svg class="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ registerError }}
      </div>

      <div
        v-if="registerSuccess"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        <svg class="h-5 w-5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Cuenta creada. Revisa tu correo para confirmar tu cuenta.
      </div>

      <form v-if="!registerSuccess" @submit.prevent="handleRegister" class="space-y-6">
        <FormInput
          id="register-email"
          v-model="registerForm.email"
          type="email"
          label="Correo electrónico"
          placeholder="tu@email.com"
          required
        />

        <FormInput
          id="register-password"
          v-model="registerForm.password"
          type="password"
          label="Contraseña"
          placeholder="Mínimo 8 caracteres"
          required
        />

        <FormInput
          id="register-confirm-password"
          v-model="registerForm.confirmPassword"
          type="password"
          label="Confirmar contraseña"
          placeholder="Repite tu contraseña"
          required
        />

        <BtnApp
          type="submit"
          variant="primary"
          size="lg"
          :loading="isRegisterLoading"
          loading-text="Creando cuenta..."
          block
          class="mt-2"
        >
          Crear cuenta
        </BtnApp>
      </form>

      <div class="mt-8 text-center">
        <button
          type="button"
          @click="goTo('login')"
          class="text-base text-indigo-600 hover:text-indigo-700 font-medium transition-colors inline-flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al inicio de sesión
        </button>
      </div>
    </template>

    <!-- LOGIN VIEW -->
    <template v-else>
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

      <div
        v-if="errorMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        <svg class="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ errorMessage }}
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
          <button
            type="button"
            @click="goTo('forgot-password')"
            class="text-base text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </button>
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
          <button
            type="button"
            @click="goTo('register')"
            class="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            Créala gratis
          </button>
        </p>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
type View = 'login' | 'forgot-password' | 'register'

const { signInOrSignUp, signUp, requestPasswordReset } = useSupabaseAuth()

const view = ref<View>('login')

const loginForm = reactive({
  email: '',
  password: '',
  remember: false,
})

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const resetEmail = ref('')
const isResetLoading = ref(false)
const resetError = ref<string | null>(null)
const resetSuccess = ref(false)

const registerForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
})
const isRegisterLoading = ref(false)
const registerError = ref<string | null>(null)
const registerSuccess = ref(false)

const goTo = (target: View) => {
  view.value = target
  resetEmail.value = ''
  resetError.value = null
  resetSuccess.value = false
  registerForm.email = ''
  registerForm.password = ''
  registerForm.confirmPassword = ''
  registerError.value = null
  registerSuccess.value = false
  errorMessage.value = null
}

const handleLogin = async () => {
  if (isLoading.value) return

  isLoading.value = true
  errorMessage.value = null

  try {
    const { success, error } = await signInOrSignUp({
      email: loginForm.email,
      password: loginForm.password,
    })

    if (!success) {
      errorMessage.value = error
      return
    }

    await navigateTo('/admin')
  } catch (err) {
    console.error('Login error:', err)
    errorMessage.value = 'Ocurrió un error inesperado. Intenta de nuevo.'
  } finally {
    isLoading.value = false
  }
}

const handleRegister = async () => {
  if (isRegisterLoading.value) return

  if (registerForm.password !== registerForm.confirmPassword) {
    registerError.value = 'Las contraseñas no coinciden.'
    return
  }

  if (registerForm.password.length < 8) {
    registerError.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  isRegisterLoading.value = true
  registerError.value = null

  try {
    const { success, error, requiresConfirmation } = await signUp({
      email: registerForm.email,
      password: registerForm.password,
    })

    if (!success) {
      registerError.value = error
      return
    }

    if (requiresConfirmation) {
      registerSuccess.value = true
      return
    }

    await navigateTo('/admin')
  } catch (err) {
    console.error('Register error:', err)
    registerError.value = 'Ocurrió un error inesperado. Intenta de nuevo.'
  } finally {
    isRegisterLoading.value = false
  }
}

const handleResetRequest = async () => {
  if (isResetLoading.value) return

  isResetLoading.value = true
  resetError.value = null

  try {
    const { success, error } = await requestPasswordReset(resetEmail.value)

    if (!success) {
      resetError.value = error
      return
    }

    resetSuccess.value = true
  } catch (err) {
    console.error('Reset error:', err)
    resetError.value = 'Ocurrió un error inesperado. Intenta de nuevo.'
  } finally {
    isResetLoading.value = false
  }
}
</script>

<style scoped>

</style>
