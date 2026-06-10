<script setup lang="ts">
import type { Tables } from '~/types/database.types'

definePageMeta({ layout: 'pos' })

type PosRegister = Tables<'pos_register'>
type PosSession = Tables<'pos_session'>

const authStore = useAuthStore()
const router = useRouter()
const { getAllByCompany } = usePosRegister()
const { getOpenSessionsByCompany, openSession } = usePosSession()

const isLoading = ref(true)
const registers = ref<PosRegister[]>([])
const openSessions = ref<PosSession[]>([])

const selectedRegister = ref<PosRegister | null>(null)
const openingBalance = ref<number>(0)
const openingNotes = ref('')
const isOpening = ref(false)
const openError = ref('')

const companyId = computed(() => authStore.selectedCompanyId ?? '')

const currentRole = computed(() =>
  authStore.companies.find(c => c.company.id === companyId.value)?.role ?? 'member'
)
const isAdmin = computed(() => ['owner', 'admin'].includes(currentRole.value))

const sessionByRegister = computed(() => {
  const map = new Map<string, PosSession>()
  for (const session of openSessions.value) {
    map.set(session.register_id, session)
  }
  return map
})

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0)

const formatDateTime = (value: string | null): string => {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

const loadData = async (): Promise<void> => {
  if (!companyId.value) {
    isLoading.value = false
    return
  }

  isLoading.value = true
  const [regs, sessions] = await Promise.all([
    getAllByCompany(companyId.value),
    getOpenSessionsByCompany(companyId.value)
  ])
  registers.value = regs
  openSessions.value = sessions
  isLoading.value = false
}

const startOpening = (register: PosRegister): void => {
  selectedRegister.value = register
  openingBalance.value = 0
  openingNotes.value = ''
  openError.value = ''
}

const cancelOpening = (): void => {
  selectedRegister.value = null
  openError.value = ''
}

const confirmOpening = async (): Promise<void> => {
  if (!selectedRegister.value || isOpening.value) return

  if (openingBalance.value < 0) {
    openError.value = 'El fondo de apertura no puede ser negativo.'
    return
  }

  isOpening.value = true
  openError.value = ''

  const { sessionId, errorMessage } = await openSession({
    registerId: selectedRegister.value.id,
    openingBalance: openingBalance.value,
    notes: openingNotes.value.trim() || null
  })

  isOpening.value = false

  if (!sessionId) {
    openError.value = errorMessage ?? 'No se pudo abrir la sesión.'
    return
  }

  router.push(`/pos/terminal?session=${sessionId}`)
}

const continueSession = (registerId: string): void => {
  const session = sessionByRegister.value.get(registerId)
  if (session) {
    router.push(`/pos/terminal?session=${session.id}`)
  }
}

const goToClose = (registerId: string): void => {
  const session = sessionByRegister.value.get(registerId)
  if (session) {
    router.push(`/pos/close?session=${session.id}`)
  }
}

watch(companyId, () => { loadData() })

onMounted(() => { loadData() })
</script>

<template>
  <div class="flex-1 flex flex-col">
    <!-- Encabezado -->
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/admin"
          class="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Volver al panel"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </NuxtLink>
        <div>
          <h1 class="text-xl font-bold text-slate-800">Punto de Venta</h1>
          <p class="text-sm text-slate-500">{{ authStore.selectedCompany?.name ?? '' }}</p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-sm font-semibold text-slate-700">{{ authStore.partnerDisplayName }}</p>
        <p class="text-xs text-slate-400">{{ isAdmin ? 'Supervisor' : 'Cajero' }}</p>
      </div>
    </header>

    <main class="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
      <!-- Cargando -->
      <div v-if="isLoading" class="flex items-center justify-center py-24">
        <div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>

      <!-- Sin cajas -->
      <div
        v-else-if="registers.length === 0"
        class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-12 text-center"
      >
        <div class="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">No hay cajas configuradas</h2>
        <p class="text-slate-500 mb-6">Para empezar a vender, primero crea una caja para esta empresa.</p>
        <BtnApp
          v-if="isAdmin"
          label="Crear caja"
          size="md"
          @click="router.push('/admin/pos/registers/create')"
        />
        <p v-else class="text-sm text-slate-400">Pide a un administrador que configure una caja.</p>
      </div>

      <!-- Selección de caja -->
      <div v-else>
        <h2 class="text-lg font-bold text-slate-800 mb-6">Selecciona una caja para iniciar turno</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="register in registers"
            :key="register.id"
            class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-6 flex flex-col gap-4"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0">
                <h3 class="font-bold text-slate-800 truncate">{{ register.name }}</h3>
                <p class="text-xs text-slate-400 font-mono">{{ register.code }}</p>
              </div>
              <BadgeApp
                :label="sessionByRegister.has(register.id) ? 'Abierta' : 'Cerrada'"
                :variant="sessionByRegister.has(register.id) ? 'success' : 'secondary'"
              />
            </div>

            <div v-if="sessionByRegister.has(register.id)" class="text-sm text-slate-500 space-y-1">
              <p>
                Sesión <span class="font-mono font-semibold text-slate-700">{{ sessionByRegister.get(register.id)?.name }}</span>
              </p>
              <p>Apertura: {{ formatDateTime(sessionByRegister.get(register.id)?.opened_at ?? null) }}</p>
              <p>Fondo: {{ formatCurrency(Number(sessionByRegister.get(register.id)?.opening_balance ?? 0)) }}</p>
            </div>
            <p v-else class="text-sm text-slate-400">Sin sesión activa. Abre la caja con un fondo inicial.</p>

            <div class="mt-auto flex flex-col gap-2">
              <template v-if="sessionByRegister.has(register.id)">
                <BtnApp
                  label="Continuar venta"
                  variant="success"
                  size="md"
                  block
                  @click="continueSession(register.id)"
                />
                <BtnApp
                  label="Corte de caja"
                  variant="secondary"
                  size="sm"
                  block
                  @click="goToClose(register.id)"
                />
              </template>
              <BtnApp
                v-else
                label="Abrir caja"
                size="md"
                block
                @click="startOpening(register)"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal de apertura -->
    <Teleport to="body">
      <div
        v-if="selectedRegister"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="cancelOpening"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-bold text-slate-800 mb-1">Apertura de caja</h3>
          <p class="text-sm text-slate-500 mb-5">
            {{ selectedRegister.name }} · El fondo inicial quedará registrado a tu nombre.
          </p>

          <div class="space-y-4">
            <FormInput
              v-model="openingBalance"
              type="number"
              label="Fondo inicial en efectivo"
              :min="0"
              step="0.01"
              size="md"
              required
            />
            <FormInput
              v-model="openingNotes"
              type="text"
              label="Notas (opcional)"
              placeholder="Ej. billetes de cambio entregados"
              size="md"
            />
          </div>

          <p v-if="openError" class="mt-3 text-sm text-red-600">{{ openError }}</p>

          <div class="mt-6 flex gap-3 justify-end">
            <BtnApp label="Cancelar" variant="ghost" size="md" @click="cancelOpening" />
            <BtnApp
              label="Abrir sesión"
              size="md"
              :loading="isOpening"
              @click="confirmOpening"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
