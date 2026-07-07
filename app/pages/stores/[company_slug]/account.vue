<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StorefrontMyOrder } from '~/composables/useStorefront'

definePageMeta({ layout: 'storefront' })

const route = useRoute()
const storefrontStore = useStorefrontStore()
const authStore = useAuthStore()
const { store, primaryColor } = storeToRefs(storefrontStore)
const { getMyOrders } = useStorefront()
const { signIn, signUp, signOut } = useSupabaseAuth()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const basePath = computed(() => storefrontPath(companySlug.value))

// ── Sesión ───────────────────────────────────────────────────────────────
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const authError = ref<string | null>(null)
const authNotice = ref<string | null>(null)
const isSubmitting = ref(false)

// ── Pedidos ──────────────────────────────────────────────────────────────
const orders = ref<StorefrontMyOrder[]>([])
const accountEmail = ref<string | null>(null)
const isLoadingOrders = ref(false)

const loadOrders = async () => {
  isLoadingOrders.value = true
  try {
    const result = await getMyOrders(companySlug.value)
    orders.value = result.status === 'ok' ? result.orders : []
    accountEmail.value = result.email ?? null
  } finally {
    isLoadingOrders.value = false
  }
}

onMounted(async () => {
  await authStore.loadSession()
  if (authStore.isAuthenticated) void loadOrders()
})

const handleSubmit = async () => {
  authError.value = null
  authNotice.value = null
  if (!email.value.trim() || !password.value) {
    authError.value = 'Escribe tu correo y contraseña.'
    return
  }
  isSubmitting.value = true
  try {
    const action = mode.value === 'login' ? signIn : signUp
    const result = await action({ email: email.value.trim(), password: password.value })
    if (!result.success) {
      authError.value = result.error ?? 'No se pudo iniciar sesión.'
      return
    }
    if (result.requiresConfirmation) {
      authNotice.value = 'Te enviamos un correo de confirmación. Revisa tu bandeja de entrada.'
      return
    }
    password.value = ''
    void loadOrders()
  } finally {
    isSubmitting.value = false
  }
}

const handleSignOut = async () => {
  await signOut()
  orders.value = []
  accountEmail.value = null
}

const stateLabel = (order: StorefrontMyOrder): { label: string; classes: string } => {
  if (order.order_state === 'cancel') return { label: 'Cancelado', classes: 'bg-rose-50 text-rose-600' }
  if (order.is_delivered) return { label: 'Entregado', classes: 'bg-emerald-50 text-emerald-600' }
  return { label: 'En preparación', classes: 'bg-indigo-50 text-indigo-600' }
}

useHead(() => ({
  title: store.value ? `Mi cuenta — ${store.value.name}` : 'Mi cuenta',
  meta: [{ name: 'robots', content: 'noindex' }]
}))
</script>

<template>
  <div v-if="store" class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">Mi cuenta</h1>

    <!-- Sin sesión: login / registro -->
    <div v-if="!authStore.isAuthenticated" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 sm:p-10 max-w-md mx-auto">
      <div class="flex rounded-xl bg-slate-100 p-1 mb-6" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'login'"
          class="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
          @click="mode = 'login'"
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'register'"
          class="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
          @click="mode = 'register'"
        >
          Crear cuenta
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <FormInput
          v-model="email"
          label="Correo electrónico"
          type="email"
          placeholder="tucorreo@ejemplo.com"
          required
          size="md"
        />
        <FormInput
          v-model="password"
          label="Contraseña"
          type="password"
          :placeholder="mode === 'register' ? 'Mínimo 6 caracteres' : 'Tu contraseña'"
          required
          size="md"
        />

        <p v-if="authError" class="text-sm text-rose-500" role="alert">{{ authError }}</p>
        <p v-if="authNotice" class="text-sm text-emerald-600" role="status">{{ authNotice }}</p>

        <button
          type="submit"
          class="w-full py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
          :style="{ backgroundColor: primaryColor }"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Registrarme' }}
        </button>
      </form>

      <p class="mt-5 text-xs text-slate-400 text-center leading-relaxed">
        Con tu cuenta puedes consultar el historial de pedidos que hiciste con tu correo en esta tienda.
        También puedes comprar como invitado sin registrarte.
      </p>
    </div>

    <!-- Con sesión: historial -->
    <template v-else>
      <div class="flex items-center justify-between mb-6">
        <p class="text-sm text-slate-500">
          Sesión iniciada como
          <span class="font-semibold text-slate-800">{{ accountEmail ?? authStore.partnerEmail }}</span>
        </p>
        <button
          type="button"
          class="text-sm font-medium text-slate-500 hover:text-rose-500 transition-colors"
          @click="handleSignOut"
        >
          Cerrar sesión
        </button>
      </div>

      <div v-if="isLoadingOrders" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 py-16 text-center text-sm text-slate-400">
        Cargando tus pedidos…
      </div>

      <div v-else-if="!orders.length" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 py-16 text-center">
        <p class="text-slate-600 font-medium">Aún no tienes pedidos en esta tienda</p>
        <NuxtLink
          :to="`${basePath}/products`"
          class="mt-5 inline-flex px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          :style="{ backgroundColor: primaryColor }"
        >
          Explorar productos
        </NuxtLink>
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="order in orders"
          :key="order.order_ref"
          class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 px-6 py-4"
        >
          <NuxtLink
            :to="`${basePath}/checkout/confirmation/${encodeURIComponent(order.order_ref)}`"
            class="flex items-center justify-between gap-4 group"
          >
            <div>
              <p class="text-sm font-semibold text-slate-900 group-hover:underline">{{ order.order_ref }}</p>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ new Date(order.order_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }}
                · {{ order.line_count }} artículo{{ order.line_count === 1 ? '' : 's' }}
              </p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-sm font-bold text-slate-900">
                {{ formatStorefrontCurrency(order.amount_total, order.currency) }}
              </p>
              <span
                class="inline-flex mt-1 px-2 py-0.5 rounded-full text-[0.65rem] font-semibold"
                :class="stateLabel(order).classes"
              >
                {{ stateLabel(order).label }}
              </span>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </template>
  </div>
</template>
