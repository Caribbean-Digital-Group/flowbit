<template>
  <div class="min-h-screen bg-slate-950 flex items-center justify-center px-4">
    <!-- Background blobs -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-0 -left-40 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px]"></div>
      <div class="absolute bottom-0 right-0 w-[500px] h-[500px] bg-fuchsia-600/20 rounded-full blur-[120px]"></div>
    </div>

    <div class="relative w-full max-w-md">
      <!-- Glow border -->
      <div class="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 rounded-3xl blur opacity-30"></div>

      <div class="relative bg-white rounded-3xl shadow-xl p-10 border border-slate-200">

        <!-- Loading state while detecting session -->
        <div v-if="isDetecting" class="text-center py-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-5">
            <svg class="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <p class="text-slate-500">Verificando enlace de recuperación...</p>
        </div>

        <!-- Invalid / expired link -->
        <div v-else-if="isInvalidLink" class="text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-5">
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-slate-900 mb-3">Enlace inválido</h2>
          <p class="text-slate-500 mb-8">Este enlace de recuperación ha expirado o ya fue usado. Solicita uno nuevo.</p>
          <NuxtLink
            to="/"
            class="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Volver al inicio
          </NuxtLink>
        </div>

        <!-- Success state -->
        <div v-else-if="updateSuccess" class="text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-5">
            <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-slate-900 mb-3">¡Contraseña actualizada!</h2>
          <p class="text-slate-500 mb-8">Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.</p>
          <NuxtLink
            to="/"
            class="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Iniciar sesión
          </NuxtLink>
        </div>

        <!-- New password form -->
        <template v-else>
          <div class="text-center mb-10">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-5">
              <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 class="text-3xl font-bold text-slate-900">Nueva contraseña</h2>
            <p class="text-slate-500 mt-3">Elige una contraseña segura para tu cuenta.</p>
          </div>

          <div
            v-if="updateError"
            class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <svg class="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ updateError }}
          </div>

          <form @submit.prevent="handleUpdatePassword" class="space-y-6">
            <FormInput
              id="new-password"
              v-model="newPassword"
              type="password"
              label="Nueva contraseña"
              placeholder="••••••••"
              required
            />

            <FormInput
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              label="Confirmar contraseña"
              placeholder="••••••••"
              required
            />

            <BtnApp
              type="submit"
              variant="primary"
              size="lg"
              :loading="isUpdating"
              loading-text="Actualizando..."
              block
              class="mt-2"
            >
              Actualizar contraseña
            </BtnApp>
          </form>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { updatePassword } = useSupabaseAuth()
const supabase = useSupabase()

const isDetecting = ref(true)
const isInvalidLink = ref(false)
const updateSuccess = ref(false)
const updateError = ref<string | null>(null)
const isUpdating = ref(false)

const newPassword = ref('')
const confirmPassword = ref('')

onMounted(async () => {
  // Supabase puts the recovery tokens in the URL hash — the client picks them up automatically.
  // We subscribe to the auth state change to detect the PASSWORD_RECOVERY event.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      isDetecting.value = false
    } else if (event === 'SIGNED_IN') {
      // May fire before PASSWORD_RECOVERY on some versions; treat as valid recovery session
      isDetecting.value = false
    }
  })

  // Fallback: if no event fires within 3 seconds the link is invalid/expired
  setTimeout(() => {
    if (isDetecting.value) {
      isDetecting.value = false
      isInvalidLink.value = true
    }
    subscription.unsubscribe()
  }, 3000)
})

const handleUpdatePassword = async () => {
  if (isUpdating.value) return

  if (newPassword.value !== confirmPassword.value) {
    updateError.value = 'Las contraseñas no coinciden.'
    return
  }

  if (newPassword.value.length < 6) {
    updateError.value = 'La contraseña debe tener al menos 6 caracteres.'
    return
  }

  isUpdating.value = true
  updateError.value = null

  try {
    const { success, error } = await updatePassword(newPassword.value)

    if (!success) {
      updateError.value = error
      return
    }

    updateSuccess.value = true
  } catch (err) {
    console.error('Update password error:', err)
    updateError.value = 'Ocurrió un error inesperado. Intenta de nuevo.'
  } finally {
    isUpdating.value = false
  }
}
</script>
