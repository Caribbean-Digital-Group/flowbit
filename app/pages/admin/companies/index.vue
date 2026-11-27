<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { companies, selectedCompanyId } = storeToRefs(authStore)
const { setDefaultCompany } = useCompany()

const busyCompanyId = ref<string | null>(null)
const errorMessage = ref('')
const successMessage = ref('')

const entries = computed(() => sortCompanyEntries(companies.value, selectedCompanyId.value))
const ownedCount = computed(() => countOwnedCompanies(companies.value))
const canCreate = computed(() => canCreateCompany(companies.value))

const canConfigure = (role: string): boolean => role === 'owner' || role === 'admin'

const roleVariant = (role: string): 'primary' | 'info' | 'secondary' => {
  if (role === 'owner') return 'primary'
  if (role === 'admin') return 'info'
  return 'secondary'
}

const flash = (message: string) => {
  successMessage.value = message
  setTimeout(() => {
    if (successMessage.value === message) successMessage.value = ''
  }, 4000)
}

const handleCreate = () => router.push('/admin/companies/create')

const handleUse = (companyId: string, name: string) => {
  errorMessage.value = ''
  authStore.selectCompany(companyId)
  flash(`Ahora trabajas en «${name}».`)
}

const handleConfigure = (companyId: string) => {
  authStore.selectCompany(companyId)
  router.push('/admin/settings')
}

const handleTeam = (companyId: string) => {
  authStore.selectCompany(companyId)
  router.push('/admin/team')
}

const handleSetDefault = async (companyId: string, name: string) => {
  errorMessage.value = ''
  busyCompanyId.value = companyId
  try {
    const ok = await setDefaultCompany(companyId)
    if (!ok) {
      errorMessage.value = 'No se pudo cambiar la empresa predeterminada. Intenta de nuevo.'
      return
    }
    await authStore.fetchCompanies()
    flash(`«${name}» se abrirá al iniciar sesión.`)
  } finally {
    busyCompanyId.value = null
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Mis empresas</h1>
        <p class="mt-1 text-sm text-slate-500">
          Cada empresa tiene sus propios contactos, productos, órdenes, inventario y equipo. Cambia de una a otra cuando quieras.
        </p>
      </div>
      <BtnApp
        label="Nueva empresa"
        variant="primary"
        :disabled="!canCreate"
        @click="handleCreate"
      />
    </div>

    <div
      v-if="!canCreate"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      Llegaste al límite de {{ MAX_OWNED_COMPANIES }} empresas propias. Las empresas a las que te invitan no cuentan para el límite.
    </div>

    <div
      v-if="successMessage"
      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      role="status"
    >
      {{ successMessage }}
    </div>

    <div
      v-if="errorMessage"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="entries.length === 0"
      class="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-12 text-center"
    >
      <p class="text-slate-800 font-medium">Todavía no tienes empresas</p>
      <p class="mt-1 text-sm text-slate-500">Crea la primera para empezar a trabajar.</p>
    </div>

    <ul v-else class="grid gap-4 md:grid-cols-2">
      <li
        v-for="entry in entries"
        :key="entry.company.id"
        :class="[
          'bg-white rounded-2xl border shadow-lg shadow-slate-200/50 p-5 flex flex-col gap-4',
          entry.company.id === selectedCompanyId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
        ]"
      >
        <div class="flex items-start gap-3">
          <div
            :class="[
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-semibold',
              entry.company.id === selectedCompanyId
                ? 'bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white'
                : 'bg-slate-100 text-slate-600'
            ]"
            aria-hidden="true"
          >
            {{ entry.company.name.charAt(0).toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-base font-semibold text-slate-800 truncate">{{ entry.company.name }}</p>
            <p class="text-sm text-slate-500 truncate">
              {{ entry.company.legal_name || entry.company.vat || 'Sin datos fiscales capturados' }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <BadgeApp :label="companyRoleLabel(entry.role)" :variant="roleVariant(entry.role)" />
          <BadgeApp v-if="entry.company.id === selectedCompanyId" label="En uso" variant="success" />
          <BadgeApp v-if="entry.isDefault" label="Predeterminada" variant="warning" />
          <span class="text-xs text-slate-500">Moneda: {{ entry.company.currency || 'MXN' }}</span>
        </div>

        <div class="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          <BtnApp
            v-if="entry.company.id !== selectedCompanyId"
            label="Usar esta empresa"
            variant="primary"
            size="sm"
            @click="handleUse(entry.company.id, entry.company.name)"
          />
          <BtnApp
            v-if="!entry.isDefault"
            label="Hacer predeterminada"
            variant="secondary"
            size="sm"
            :loading="busyCompanyId === entry.company.id"
            :disabled="busyCompanyId !== null"
            @click="handleSetDefault(entry.company.id, entry.company.name)"
          />
          <BtnApp
            v-if="canConfigure(entry.role)"
            label="Configurar"
            variant="ghost"
            size="sm"
            @click="handleConfigure(entry.company.id)"
          />
          <BtnApp
            v-if="canConfigure(entry.role)"
            label="Equipo"
            variant="ghost"
            size="sm"
            @click="handleTeam(entry.company.id)"
          />
        </div>
      </li>
    </ul>

    <p class="text-xs text-slate-500">
      Empresas propias: {{ ownedCount }} de {{ MAX_OWNED_COMPANIES }}.
      La empresa predeterminada es la que se abre al iniciar sesión en un dispositivo nuevo.
    </p>
  </div>
</template>
