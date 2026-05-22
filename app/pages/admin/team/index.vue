<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { CompanyMember, RelationshipType } from '~/composables/useMembership'
import type { Database } from '~/types/database.types'

type PartnerCompanyRole = Database['public']['Enums']['partner_company_role']

definePageMeta({
  layout: 'admin'
})

const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany, companies, partner } = storeToRefs(authStore)

const { getCompanyMembers, updateMemberRole, removeMember } = useMembership()

type TabId = 'members' | 'pending'

// "team" = colaboradores con acceso al panel.
// "partner" = contactos de negocio (clientes/proveedores) ligados a la company.
const relationshipScope = ref<RelationshipType>('team')

const activeTab = ref<TabId>('members')
const isLoading = ref(false)
const isInviteModalOpen = ref(false)
const members = ref<CompanyMember[]>([])
const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)
const pendingRoleChange = ref<string | null>(null)
const pendingRemoval = ref<string | null>(null)

const currentCompanyRole = computed<PartnerCompanyRole | null>(() => {
  const id = selectedCompanyId.value
  if (!id) return null
  const found = companies.value.find(c => c.company.id === id)
  return (found?.role as PartnerCompanyRole) ?? null
})

const isCurrentUserAdmin = computed(() =>
  currentCompanyRole.value === 'owner' || currentCompanyRole.value === 'admin'
)

const isCurrentUserOwner = computed(() => currentCompanyRole.value === 'owner')

const isTeamScope = computed(() => relationshipScope.value === 'team')

const acceptedMembers = computed(() =>
  members.value.filter(m => m.invitation_status === 'accepted')
)

const pendingInvitations = computed(() =>
  members.value.filter(m => m.invitation_status === 'pending')
)

const roleLabels: Record<PartnerCompanyRole, string> = {
  owner: 'Owner',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Lector',
  guest: 'Invitado'
}

const allRoleOptions = computed(() => {
  const base: { value: PartnerCompanyRole; label: string }[] = [
    { value: 'admin', label: 'Administrador' },
    { value: 'member', label: 'Miembro' },
    { value: 'viewer', label: 'Lector' },
    { value: 'guest', label: 'Invitado' }
  ]
  if (isCurrentUserOwner.value) {
    base.unshift({ value: 'owner', label: 'Owner' })
  }
  return base
})

const memberColumns: Column[] = [
  {
    key: 'partner_name',
    label: 'Miembro',
    type: 'avatar',
    subtitleKey: 'partner_email',
    avatarKey: 'partner_avatar_url'
  },
  { key: 'role_label', label: 'Rol', type: 'text' },
  {
    key: 'link_status',
    label: 'Acceso',
    type: 'badge',
    badgeConfig: {
      labels: { linked: 'Vinculado', pending_signup: 'Pendiente de registro' },
      colors: {
        linked: 'bg-emerald-100 text-emerald-700',
        pending_signup: 'bg-amber-100 text-amber-700'
      }
    }
  },
  { key: 'accepted_at', label: 'Se unió', type: 'date' }
]

const invitationColumns: Column[] = [
  {
    key: 'partner_name',
    label: 'Invitado',
    type: 'avatar',
    subtitleKey: 'partner_email',
    avatarKey: 'partner_avatar_url'
  },
  { key: 'role_label', label: 'Rol propuesto', type: 'text' },
  { key: 'invited_by_name', label: 'Invitado por', type: 'text' },
  { key: 'invited_at', label: 'Enviada', type: 'date' }
]

const partnerColumns: Column[] = [
  {
    key: 'partner_name',
    label: 'Partner',
    type: 'avatar',
    subtitleKey: 'partner_email',
    avatarKey: 'partner_avatar_url'
  },
  { key: 'role_label', label: 'Rol', type: 'text' },
  { key: 'accepted_at', label: 'Alta', type: 'date' }
]

const mapMemberToRow = (member: CompanyMember): Record<string, unknown> => ({
  id: member.relationship_id,
  relationship_id: member.relationship_id,
  partner_id: member.partner_id,
  partner_name: member.partner_display_name?.trim() || member.partner_name,
  partner_email: member.partner_email ?? '—',
  partner_avatar_url: member.partner_avatar_url ?? '',
  partner_user_id: member.partner_user_id,
  role: member.role,
  role_label: roleLabels[member.role] ?? member.role,
  accepted_at: member.accepted_at ?? member.created_at ?? '',
  invited_at: member.invited_at ?? member.created_at ?? '',
  invited_by_name: member.invited_by_name?.trim() || member.invited_by_email || '—',
  link_status: member.partner_user_id ? 'linked' : 'pending_signup'
})

const memberRows = computed(() => acceptedMembers.value.map(mapMemberToRow))
const invitationRows = computed(() => pendingInvitations.value.map(mapMemberToRow))

// Para la vista de "Partners" mostramos las relaciones business sin la pestaña
// de invitaciones pendientes: ese flujo es exclusivo del equipo.
const partnerRows = computed(() => members.value.map(mapMemberToRow))

const loadMembers = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    members.value = []
    return
  }
  isLoading.value = true
  try {
    members.value = await getCompanyMembers(companyId, relationshipScope.value)
  } finally {
    isLoading.value = false
  }
}

const flashSuccess = (message: string) => {
  actionSuccess.value = message
  setTimeout(() => {
    actionSuccess.value = null
  }, 3500)
}

const handleInvited = async () => {
  flashSuccess('Invitación enviada correctamente.')
  // La invitación siempre crea una relación de tipo "team"; nos posicionamos
  // automáticamente en esa vista para que el usuario pueda verla aparecer.
  relationshipScope.value = 'team'
  activeTab.value = 'pending'
  await loadMembers()
}

const handleChangeRole = async (relationshipId: string, role: PartnerCompanyRole) => {
  actionError.value = null
  pendingRoleChange.value = relationshipId
  try {
    const result = await updateMemberRole(relationshipId, role)
    if (!result.success) {
      actionError.value = result.error
      return
    }
    flashSuccess('Rol actualizado.')
    await loadMembers()
  } finally {
    pendingRoleChange.value = null
  }
}

const handleRemove = async (relationshipId: string, isPending: boolean) => {
  actionError.value = null
  const isPartnerScope = !isTeamScope.value
  let confirmText = '¿Eliminar a este miembro de la empresa? Perderá el acceso de inmediato.'
  if (isPending) {
    confirmText = '¿Cancelar esta invitación pendiente?'
  } else if (isPartnerScope) {
    confirmText = '¿Quitar este partner de la empresa? El registro del partner se conservará, sólo se desactivará la relación.'
  }

  if (typeof window !== 'undefined' && !window.confirm(confirmText)) return

  pendingRemoval.value = relationshipId
  try {
    const result = await removeMember(relationshipId)
    if (!result.success) {
      actionError.value = result.error
      return
    }
    if (isPending) {
      flashSuccess('Invitación cancelada.')
    } else if (isPartnerScope) {
      flashSuccess('Partner desvinculado.')
    } else {
      flashSuccess('Miembro removido.')
    }
    await loadMembers()
  } finally {
    pendingRemoval.value = null
  }
}

const switchScope = (next: RelationshipType) => {
  if (next === relationshipScope.value) return
  relationshipScope.value = next
  activeTab.value = 'members'
  actionError.value = null
}

watch(selectedCompanyId, () => {
  members.value = []
  loadMembers()
}, { immediate: true })

watch(relationshipScope, () => {
  members.value = []
  loadMembers()
})

const isSelfRow = (row: Record<string, unknown>): boolean => {
  const partnerId = row.partner_id as string | null
  return !!partnerId && !!partner.value?.id && partnerId === partner.value.id
}

const scopeCopy = computed(() => {
  if (isTeamScope.value) {
    return {
      title: 'Equipo',
      description: `Personas con acceso al panel de ${selectedCompany.value?.name ?? 'esta empresa'} e invitaciones pendientes.`,
      inviteLabel: 'Invitar miembro',
      goToCreate: false
    }
  }
  return {
    title: 'Partners de negocio',
    description: `Clientes, proveedores y demás contactos vinculados a ${selectedCompany.value?.name ?? 'esta empresa'} (no tienen acceso al panel).`,
    inviteLabel: 'Nuevo partner',
    goToCreate: true
  }
})

const handlePrimaryCta = () => {
  if (scopeCopy.value.goToCreate) {
    navigateTo('/admin/partners/create')
    return
  }
  isInviteModalOpen.value = true
}
</script>

<template>
  <div class="w-full space-y-6">
    <!-- Cabecera -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-slate-900">{{ scopeCopy.title }}</h1>
        <p class="mt-1 text-sm text-slate-500 max-w-2xl">
          {{ scopeCopy.description }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <NuxtLink
          v-if="isTeamScope"
          to="/admin/invitations"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Invitaciones recibidas
          <span
            v-if="authStore.pendingInvitationCount > 0"
            class="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white"
          >
            {{ authStore.pendingInvitationCount }}
          </span>
        </NuxtLink>

        <button
          type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-60"
          :disabled="!selectedCompanyId || !isCurrentUserAdmin"
          @click="handlePrimaryCta"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ scopeCopy.inviteLabel }}
        </button>
      </div>
    </div>

    <!-- Sin empresa seleccionada -->
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para administrar su equipo.
      </p>
    </div>

    <!-- Permisos insuficientes -->
    <div
      v-else-if="!isCurrentUserAdmin"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Permisos insuficientes</p>
      <p class="mt-1 text-sm text-amber-800/90">
        Solo los owners o admins de la empresa pueden ver y gestionar los miembros.
      </p>
    </div>

    <template v-else>
      <!-- Segmented control: Equipo vs Partners -->
      <div class="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start">
        <button
          type="button"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            isTeamScope
              ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200/70'
              : 'text-slate-500 hover:text-slate-700'
          ]"
          @click="switchScope('team')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Equipo
        </button>
        <button
          type="button"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            !isTeamScope
              ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200/70'
              : 'text-slate-500 hover:text-slate-700'
          ]"
          @click="switchScope('partner')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Partners
        </button>
      </div>

      <!-- Mensajes -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
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

      <!-- Tabs (sólo visibles en la vista de Equipo) -->
      <div
        v-if="isTeamScope"
        class="flex items-center gap-2 border-b border-slate-200"
      >
        <button
          type="button"
          :class="[
            'relative px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'members' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          ]"
          @click="activeTab = 'members'"
        >
          Miembros activos
          <span class="ml-2 text-xs font-semibold text-slate-400">{{ acceptedMembers.length }}</span>
          <span
            v-if="activeTab === 'members'"
            class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600"
          />
        </button>
        <button
          type="button"
          :class="[
            'relative px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'pending' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          ]"
          @click="activeTab = 'pending'"
        >
          Invitaciones enviadas
          <span class="ml-2 text-xs font-semibold text-slate-400">{{ pendingInvitations.length }}</span>
          <span
            v-if="activeTab === 'pending'"
            class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600"
          />
        </button>
      </div>

      <!-- Loading -->
      <div
        v-if="isLoading"
        class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
      >
        Cargando…
      </div>

      <!-- =================== VISTA EQUIPO =================== -->
      <Datatable
        v-else-if="isTeamScope && activeTab === 'members'"
        title="Miembros activos"
        description="Personas con acceso confirmado a esta empresa."
        :data="memberRows"
        :columns="memberColumns"
        :search-keys="['partner_name', 'partner_email', 'role_label']"
        :exportable="false"
        :paginated="memberRows.length > 10"
        :creatable="false"
        empty-title="Sin miembros"
        empty-message="Aún no hay miembros activos. Invita a alguien con el botón superior."
      >
        <template #cell-role_label="{ row }">
          <span
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            :class="{
              'bg-fuchsia-100 text-fuchsia-700': row.role === 'owner',
              'bg-indigo-100 text-indigo-700': row.role === 'admin',
              'bg-sky-100 text-sky-700': row.role === 'member',
              'bg-slate-100 text-slate-600': row.role === 'viewer' || row.role === 'guest'
            }"
          >
            {{ row.role_label }}
          </span>
        </template>

        <template #actions="{ row }">
          <div class="flex items-center justify-center gap-2">
            <select
              :value="row.role"
              :disabled="
                isSelfRow(row)
                || (row.role === 'owner' && !isCurrentUserOwner)
                || pendingRoleChange === row.relationship_id
              "
              class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              @change="(event) => handleChangeRole(row.relationship_id as string, (event.target as HTMLSelectElement).value as PartnerCompanyRole)"
            >
              <option v-for="opt in allRoleOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <button
              type="button"
              class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="isSelfRow(row) || (row.role === 'owner' && !isCurrentUserOwner) || pendingRemoval === row.relationship_id"
              :title="isSelfRow(row) ? 'No puedes removerte a ti mismo' : 'Remover miembro'"
              @click="handleRemove(row.relationship_id as string, false)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </template>
      </Datatable>

      <Datatable
        v-else-if="isTeamScope && activeTab === 'pending'"
        title="Invitaciones enviadas"
        description="Personas invitadas que aún no han aceptado."
        :data="invitationRows"
        :columns="invitationColumns"
        :search-keys="['partner_name', 'partner_email', 'role_label']"
        :exportable="false"
        :paginated="invitationRows.length > 10"
        :creatable="false"
        empty-title="Sin invitaciones pendientes"
        empty-message="No hay invitaciones pendientes para esta empresa."
      >
        <template #cell-role_label="{ row }">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            {{ row.role_label }}
          </span>
        </template>

        <template #actions="{ row }">
          <div class="flex items-center justify-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
              :disabled="pendingRemoval === row.relationship_id"
              @click="handleRemove(row.relationship_id as string, true)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancelar
            </button>
          </div>
        </template>
      </Datatable>

      <!-- =================== VISTA PARTNERS DE NEGOCIO =================== -->
      <Datatable
        v-else
        title="Partners vinculados"
        description="Clientes y proveedores asociados a esta empresa. No tienen acceso al panel."
        :data="partnerRows"
        :columns="partnerColumns"
        :search-keys="['partner_name', 'partner_email', 'role_label']"
        :exportable="false"
        :paginated="partnerRows.length > 10"
        :creatable="false"
        empty-title="Sin partners vinculados"
        empty-message="Aún no hay partners de negocio en esta empresa. Crea uno desde el botón superior."
      >
        <template #cell-role_label="{ row }">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {{ row.role_label }}
          </span>
        </template>

        <template #actions="{ row }">
          <div class="flex items-center justify-center gap-2">
            <BtnApp variant="ghost" size="sm" @click="navigateTo(`/admin/partners/${row.partner_id as string}`)">
              <template #iconLeft>
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </template>
            </BtnApp>
            <button
              type="button"
              class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="pendingRemoval === row.relationship_id"
              :title="'Quitar partner de esta empresa'"
              @click="handleRemove(row.relationship_id as string, false)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </template>
      </Datatable>
    </template>

    <!-- Modal de invitación (solo se abre desde la vista de Equipo) -->
    <TeamInviteModal
      v-model="isInviteModalOpen"
      :company-id="selectedCompanyId"
      :company-name="selectedCompany?.name ?? ''"
      :can-assign-owner="isCurrentUserOwner"
      @invited="handleInvited"
    />
  </div>
</template>
