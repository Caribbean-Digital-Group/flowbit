<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { PendingInvitation } from '~/composables/useMembership'
import type { Database } from '~/types/database.types'

type PartnerCompanyRole = Database['public']['Enums']['partner_company_role']

definePageMeta({
  layout: 'admin'
})

const authStore = useAuthStore()
const { partner } = storeToRefs(authStore)
const { getMyInvitations, respondInvitation } = useMembership()

const invitations = ref<PendingInvitation[]>([])
const isLoading = ref(false)
const pendingAction = ref<string | null>(null)
const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)

const roleLabels: Record<PartnerCompanyRole, string> = {
  owner: 'Owner',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Lector',
  guest: 'Invitado'
}

const loadInvitations = async () => {
  isLoading.value = true
  try {
    invitations.value = await getMyInvitations()
    await authStore.fetchPendingInvitationCount()
  } finally {
    isLoading.value = false
  }
}

const flash = (message: string, type: 'success' | 'error' = 'success') => {
  if (type === 'success') {
    actionSuccess.value = message
    setTimeout(() => { actionSuccess.value = null }, 3500)
  } else {
    actionError.value = message
    setTimeout(() => { actionError.value = null }, 5000)
  }
}

const handleRespond = async (relationshipId: string, accept: boolean) => {
  actionError.value = null
  actionSuccess.value = null
  pendingAction.value = relationshipId

  try {
    const result = await respondInvitation(relationshipId, accept)
    if (!result.success) {
      flash(result.error ?? 'No se pudo procesar la invitación.', 'error')
      return
    }

    flash(accept ? 'Te uniste a la empresa.' : 'Invitación rechazada.')
    invitations.value = invitations.value.filter(inv => inv.relationship_id !== relationshipId)
    await authStore.fetchPendingInvitationCount()
    if (accept) {
      // Refresca la lista de companies del usuario para que aparezca en el selector.
      await authStore.fetchCompanies()
    }
  } finally {
    pendingAction.value = null
  }
}

const formatRelativeDate = (value: string | null): string => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

const inviterLabel = (inv: PendingInvitation): string => {
  if (inv.invited_by_name?.trim()) return inv.invited_by_name
  if (inv.invited_by_email?.trim()) return inv.invited_by_email
  return 'Equipo de la empresa'
}

onMounted(() => {
  loadInvitations()
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto space-y-6">
    <!-- Cabecera -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Invitaciones recibidas</h1>
        <p class="mt-1 text-sm text-slate-500 max-w-xl">
          Aquí verás las invitaciones que otras empresas te han enviado.
          Acepta para unirte y empezar a trabajar, o rechaza si no te interesa.
        </p>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        :disabled="isLoading"
        @click="loadInvitations"
      >
        <svg
          class="w-4 h-4"
          :class="{ 'animate-spin': isLoading }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </button>
    </div>

    <!-- Mensajes -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="actionSuccess"
        class="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm"
      >
        <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ actionSuccess }}
      </div>
    </Transition>

    <div
      v-if="actionError"
      class="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
    >
      <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ actionError }}
    </div>

    <!-- Loading -->
    <div
      v-if="isLoading && invitations.length === 0"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando invitaciones…
    </div>

    <!-- Estado vacío -->
    <div
      v-else-if="invitations.length === 0"
      class="rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center shadow-lg shadow-slate-200/50"
    >
      <div class="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="text-base font-semibold text-slate-900">Sin invitaciones pendientes</h3>
      <p class="mt-1 text-sm text-slate-500 max-w-md mx-auto">
        Cuando alguna empresa te invite usando tu correo
        <span v-if="partner?.email" class="font-medium text-slate-700">({{ partner.email }})</span>,
        aparecerá aquí.
      </p>
    </div>

    <!-- Lista de invitaciones -->
    <ul v-else class="space-y-4">
      <li
        v-for="inv in invitations"
        :key="inv.relationship_id"
        class="rounded-2xl bg-white border border-slate-100 shadow-lg shadow-slate-200/50 p-5 sm:p-6"
      >
        <div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex items-start gap-4 min-w-0">
            <!-- Logo / Inicial -->
            <div class="flex-shrink-0">
              <img
                v-if="inv.company_logo_url"
                :src="inv.company_logo_url"
                :alt="inv.company_name"
                class="w-14 h-14 rounded-xl object-cover ring-1 ring-slate-200"
              />
              <div
                v-else
                class="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20"
              >
                {{ (inv.company_display_name || inv.company_name).charAt(0).toUpperCase() }}
              </div>
            </div>

            <div class="min-w-0">
              <h3 class="text-lg font-semibold text-slate-900 truncate">
                {{ inv.company_display_name || inv.company_name }}
              </h3>
              <p class="mt-1 text-sm text-slate-500 leading-relaxed">
                Te invitó <span class="font-medium text-slate-700">{{ inviterLabel(inv) }}</span>
                como
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ml-1"
                  :class="{
                    'bg-fuchsia-100 text-fuchsia-700': inv.role === 'owner',
                    'bg-indigo-100 text-indigo-700': inv.role === 'admin',
                    'bg-sky-100 text-sky-700': inv.role === 'member',
                    'bg-slate-100 text-slate-600': inv.role === 'viewer' || inv.role === 'guest'
                  }"
                >
                  {{ roleLabels[inv.role] }}
                </span>
              </p>
              <p v-if="inv.invited_at" class="mt-2 text-xs text-slate-400">
                Enviada el {{ formatRelativeDate(inv.invited_at) }}
              </p>
            </div>
          </div>

          <!-- Acciones -->
          <div class="flex items-center gap-2 sm:justify-end flex-shrink-0">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
              :disabled="pendingAction === inv.relationship_id"
              @click="handleRespond(inv.relationship_id, false)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Rechazar
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50"
              :disabled="pendingAction === inv.relationship_id"
              @click="handleRespond(inv.relationship_id, true)"
            >
              <svg
                v-if="pendingAction === inv.relationship_id"
                class="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ pendingAction === inv.relationship_id ? 'Procesando…' : 'Aceptar' }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
