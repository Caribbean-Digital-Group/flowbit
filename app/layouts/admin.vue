<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Database } from '~/types/database.types'
import type { PendingInvitation } from '~/composables/useMembership'

type TaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type ApprovalRequestViewRow = Database['public']['Views']['v_approval_requests']['Row']
type PartnerCompanyRole = Database['public']['Enums']['partner_company_role']

// Estado del sidebar
const isSidebarOpen = ref(true)
const isSidebarCollapsed = ref(false)
const isMobileMenuOpen = ref(false)

// Toggle sidebar en desktop (colapsado/expandido)
const toggleSidebarCollapse = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

// Toggle sidebar en mobile
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

// Cerrar mobile menu al cambiar de ruta
const route = useRoute()
watch(() => route.path, () => {
  isMobileMenuOpen.value = false
})

// Función para determinar si un item del menú está activo
const isMenuItemActive = (item: { to: string; exact?: boolean }) => {
  if (item.exact) {
    return route.path === item.to
  }
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

// Auth Store
const authStore = useAuthStore()
const { partner, selectedCompanyId: selectedCompanyIdRef, pendingInvitationCount } = storeToRefs(authStore)
const { getAssignedTasksForPartner } = useProjectTask()
const { getPublishedRequestsForMyManager } = useApprovalRequest()
const { getMyInvitations, respondInvitation } = useMembership()

const assignedTasksPreview = ref<TaskViewRow[]>([])
const pendingApprovalsPreview = ref<ApprovalRequestViewRow[]>([])
const isTaskNotifOpen = ref(false)
const isLoadingAssignedTasks = ref(false)
const taskNotifRef = ref<HTMLElement | null>(null)

const taskStatusLabels: Record<string, string> = {
  pending: 'Inicio',
  in_progress: 'En proceso',
  completed: 'Terminada',
  cancelled: 'Cancelada'
}

const openAssignedTaskCount = computed(() =>
  assignedTasksPreview.value.filter((t) => {
    const st = t.status ?? 'pending'
    return st !== 'completed' && st !== 'cancelled'
  }).length
)

const pendingApprovalCount = computed(() => pendingApprovalsPreview.value.length)

const taskNotifBadgeTotal = computed(
  () => openAssignedTaskCount.value + pendingApprovalCount.value
)

const notificationBadgeLabel = computed(() => {
  const n = taskNotifBadgeTotal.value
  if (n > 99) return '99+'
  return String(n)
})

async function refreshTaskNotifPanel() {
  const companyId = selectedCompanyIdRef.value
  const partnerId = partner.value?.id
  if (!companyId || !partnerId) {
    assignedTasksPreview.value = []
    pendingApprovalsPreview.value = []
    return
  }
  isLoadingAssignedTasks.value = true
  try {
    const [tasks, approvals] = await Promise.all([
      getAssignedTasksForPartner(partnerId, companyId),
      getPublishedRequestsForMyManager(companyId, partnerId)
    ])
    assignedTasksPreview.value = tasks
    pendingApprovalsPreview.value = approvals
  } finally {
    isLoadingAssignedTasks.value = false
  }
}

function toggleTaskNotif() {
  isTaskNotifOpen.value = !isTaskNotifOpen.value
  if (isTaskNotifOpen.value) {
    void refreshTaskNotifPanel()
  }
}

function closeTaskNotif() {
  isTaskNotifOpen.value = false
}

function formatTaskDueShort(d: string | null): string {
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('es-MX', { month: 'short', day: 'numeric' }).format(new Date(d))
  } catch {
    return d
  }
}

function openTaskDetailFromNotif(task: TaskViewRow) {
  if (!task.id) return
  closeTaskNotif()
  navigateTo(`/admin/tasks/${task.id}`)
}

function formatApprovalAmountShort(
  amount: number | null,
  currency: string | null
): string {
  if (amount == null) return ''
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency && currency.length === 3 ? currency : 'MXN',
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return String(amount)
  }
}

function openApprovalDetailFromNotif(req: ApprovalRequestViewRow) {
  if (!req.id) return
  closeTaskNotif()
  navigateTo(`/admin/approval-requests/${req.id}`)
}

// ============================================================================
// Invitaciones recibidas (dropdown)
// ============================================================================
const invitationsPreview = ref<PendingInvitation[]>([])
const isInvitationsOpen = ref(false)
const isLoadingInvitations = ref(false)
const respondingInvitationId = ref<string | null>(null)
const invitationsRef = ref<HTMLElement | null>(null)

const invitationRoleLabels: Record<PartnerCompanyRole, string> = {
  owner: 'Owner',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Lector',
  guest: 'Invitado'
}

const invitationsBadgeLabel = computed(() => {
  const n = pendingInvitationCount.value
  if (n > 99) return '99+'
  return String(n)
})

async function refreshInvitationsPreview() {
  if (!partner.value) {
    invitationsPreview.value = []
    return
  }
  isLoadingInvitations.value = true
  try {
    invitationsPreview.value = await getMyInvitations()
    await authStore.fetchPendingInvitationCount()
  } finally {
    isLoadingInvitations.value = false
  }
}

function toggleInvitationsDropdown() {
  isInvitationsOpen.value = !isInvitationsOpen.value
  if (isInvitationsOpen.value) {
    void refreshInvitationsPreview()
  }
}

function closeInvitations() {
  isInvitationsOpen.value = false
}

async function respondInvitationFromHeader(relationshipId: string, accept: boolean) {
  respondingInvitationId.value = relationshipId
  try {
    const result = await respondInvitation(relationshipId, accept)
    if (!result.success) return
    invitationsPreview.value = invitationsPreview.value.filter(i => i.relationship_id !== relationshipId)
    await authStore.fetchPendingInvitationCount()
    if (accept) {
      await authStore.fetchCompanies()
    }
  } finally {
    respondingInvitationId.value = null
  }
}

watch([selectedCompanyIdRef, partner], () => {
  void refreshTaskNotifPanel()
}, { immediate: true })

watch(partner, (current) => {
  if (current) {
    void authStore.fetchPendingInvitationCount()
  }
}, { immediate: true })

const availableCompanies = computed(() =>
  authStore.companies.map(c => c.company)
)

const selectedCompanyId = computed(() => authStore.selectedCompanyId ?? '')
const isCompanySelectorOpen = ref(false)

const selectedCompany = computed(() => authStore.selectedCompany)

const selectCompany = (companyId: string) => {
  authStore.selectCompany(companyId)
  isCompanySelectorOpen.value = false
}

const toggleCompanySelector = () => {
  isCompanySelectorOpen.value = !isCompanySelectorOpen.value
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await authStore.loadSession()
  }
  if (!authStore.isAuthenticated) {
    await navigateTo('/')
  }
})

// Cerrar selector al hacer click fuera
const companySelectorRef = ref<HTMLElement | null>(null)
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (companySelectorRef.value && !companySelectorRef.value.contains(target)) {
    isCompanySelectorOpen.value = false
  }
  if (taskNotifRef.value && !taskNotifRef.value.contains(target)) {
    isTaskNotifOpen.value = false
  }
  if (invitationsRef.value && !invitationsRef.value.contains(target)) {
    isInvitationsOpen.value = false
  }
}

// Definición de módulos del sidebar
const menuItems = [
  {
    title: 'Dashboard',
    to: '/admin',
    exact: true,
    iconPaths: [
      'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
    ]
  },
  {
    title: 'Contactos',
    to: '/admin/partners',
    iconPaths: [
      'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
    ]
  },
  {
    title: 'Productos',
    to: '/admin/products',
    iconPaths: [
      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
    ]
  },
  {
    title: 'Órdenes',
    to: '/admin/orders',
    iconPaths: [
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
    ]
  },
  {
    title: 'Líneas de orden',
    to: '/admin/order-lines',
    iconPaths: [
      'M4 6h16M4 10h16M4 14h16M4 18h16'
    ]
  },
  {
    title: 'Proyectos',
    to: '/admin/projects',
    iconPaths: [
      'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
      'M12 11v6m-3-3h6'
    ]
  },
  {
    title: 'Tareas',
    to: '/admin/tasks',
    iconPaths: [
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2',
      'M9 14l2 2 4-4'
    ]
  },
  {
    title: 'Almacenes',
    to: '/admin/warehouses',
    iconPaths: [
      'M3 7l9-4 9 4-9 4-9-4z',
      'M3 7v10l9 4 9-4V7'
    ]
  },
  {
    title: 'Movimientos',
    to: '/admin/pickings',
    iconPaths: [
      'M8 7h12m0 0l-4-4m4 4l-4 4',
      'M16 17H4m0 0l4-4m-4 4l4 4'
    ]
  },
  {
    title: 'Líneas de picking',
    to: '/admin/picking-lines',
    iconPaths: [
      'M4 6h16M4 12h16M4 18h16',
      'M9 6v12M15 6v12'
    ]
  },
  {
    title: 'Equipo',
    to: '/admin/team',
    iconPaths: [
      'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z'
    ]
  },
  {
    title: 'Solicitudes de aprobación',
    to: '/admin/approval-requests',
    iconPaths: [
      'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      'M12 8v4l3 3'
    ]
  },
  {
    title: 'Categorías de aprobación',
    to: '/admin/approval-categories',
    iconPaths: [
      'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'
    ]
  },
  {
    title: 'Gerentes / aprobadores',
    to: '/admin/approval-managers',
    iconPaths: [
      'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V8m8 0V6',
      'M12 12a3 3 0 110-6 3 3 0 010 6z'
    ]
  },
  {
    title: 'Configuración',
    to: '/admin/settings',
    iconPaths: [
      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z'
    ]
  }
]

// Handlers para el Avatar dropdown
const handleProfile = () => {
  navigateTo('/admin/profile')
}

const { signOut } = useSupabaseAuth()

const handleLogout = async () => {
  await signOut()
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen bg-slate-100">
    <!-- Mobile Menu Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-300"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
        @click="toggleMobileMenu"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 transition-all duration-300 ease-in-out',
        // Desktop: colapsado o expandido
        isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64',
        // Mobile: mostrar/ocultar
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <!-- Logo Header -->
      <div class="flex items-center justify-between h-16 px-4 border-b border-slate-200">
        <NuxtLink
          to="/admin"
          class="flex items-center gap-2.5 group overflow-hidden"
        >
          <div class="w-9 h-9 min-w-[36px] bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
            <span class="text-white font-bold text-sm">FB</span>
          </div>
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0 -translate-x-4"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition-all duration-200"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 -translate-x-4"
          >
            <span
              v-if="!isSidebarCollapsed"
              class="text-xl font-semibold text-slate-900 whitespace-nowrap"
            >
              Flowbit
            </span>
          </Transition>
        </NuxtLink>

        <!-- Close button mobile -->
        <button
          type="button"
          class="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          @click="toggleMobileMenu"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Navigation Menu -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
            isSidebarCollapsed ? 'justify-center' : '',
            isMenuItemActive(item)
              ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          ]"
        >
          <!-- Icon -->
          <svg class="w-5 h-5 min-w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              v-for="(path, index) in item.iconPaths"
              :key="index"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="path"
            />
          </svg>

          <!-- Label -->
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <span
              v-if="!isSidebarCollapsed"
              class="whitespace-nowrap"
            >
              {{ item.title }}
            </span>
          </Transition>
        </NuxtLink>
      </nav>

      <!-- Collapse Toggle Button (Desktop only) -->
      <div class="hidden lg:block p-3 border-t border-slate-200">
        <button
          type="button"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200',
            isSidebarCollapsed ? 'justify-center' : ''
          ]"
          @click="toggleSidebarCollapse"
        >
          <svg
            :class="[
              'w-5 h-5 transition-transform duration-300',
              isSidebarCollapsed ? 'rotate-180' : ''
            ]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <span v-if="!isSidebarCollapsed" class="whitespace-nowrap">
              Colapsar menú
            </span>
          </Transition>
        </button>
      </div>
    </aside>

    <!-- Main Content Wrapper -->
    <div
      :class="[
        'transition-all duration-300 ease-in-out',
        isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      ]"
    >
      <!-- Top Header -->
      <header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div class="flex items-center justify-between h-16 px-4 sm:px-6">
          <!-- Left: Mobile menu button + Breadcrumb -->
          <div class="flex items-center gap-4">
            <!-- Mobile menu button -->
            <button
              type="button"
              class="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              @click="toggleMobileMenu"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <!-- Page title / Breadcrumb slot -->
            <div class="hidden sm:block">
              <h1 class="text-lg font-semibold text-slate-900">
                <slot name="header-title">Panel de Administración</slot>
              </h1>
            </div>
          </div>

          <!-- Right: Notificaciones (tareas) + empresa + Avatar -->
          <div class="flex items-center gap-3">
            <!-- Tareas asignadas + solicitudes por aprobar -->
            <div ref="taskNotifRef" class="relative">
              <button
                type="button"
                class="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                :title="'Tareas y solicitudes pendientes'"
                :aria-expanded="isTaskNotifOpen"
                aria-haspopup="true"
                aria-label="Tareas asignadas y solicitudes de aprobación pendientes"
                @click.stop="toggleTaskNotif"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span
                  v-if="taskNotifBadgeTotal > 0"
                  class="absolute -right-0.5 -top-0.5 min-h-[1.125rem] min-w-[1.125rem] rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm flex items-center justify-center tabular-nums"
                >
                  {{ notificationBadgeLabel }}
                </span>
              </button>

              <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 scale-95 -translate-y-1"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 -translate-y-1"
              >
                <div
                  v-if="isTaskNotifOpen"
                  class="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,30rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 z-50 flex flex-col"
                >
                  <div class="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 px-4 py-3">
                    <p class="text-sm font-semibold text-slate-800">
                      Tu bandeja en esta empresa
                    </p>
                    <p class="mt-0.5 text-xs text-slate-500">
                      Tareas donde eres responsable y solicitudes publicadas donde eres el aprobador asignado.
                    </p>
                  </div>

                  <div class="flex-1 overflow-y-auto p-2 space-y-4">
                    <template v-if="!partner">
                      <p class="px-3 py-6 text-center text-sm text-slate-500 leading-relaxed">
                        No hay un partner vinculado a tu cuenta. Asignaciones no disponibles hasta vincular tu usuario.
                      </p>
                    </template>
                    <template v-else-if="isLoadingAssignedTasks">
                      <div class="flex justify-center py-10">
                        <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                      </div>
                    </template>
                    <template v-else>
                      <div>
                        <p class="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Tareas
                        </p>
                        <template v-if="assignedTasksPreview.length === 0">
                          <p class="px-3 py-4 text-center text-sm text-slate-500">
                            No tienes tareas asignadas en esta empresa.
                          </p>
                        </template>
                        <ul v-else class="space-y-1">
                          <li v-for="task in assignedTasksPreview" :key="task.id ?? ''">
                            <button
                              type="button"
                              class="w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:border-indigo-100 hover:bg-indigo-50/60"
                              @click="openTaskDetailFromNotif(task)"
                            >
                              <p class="text-sm font-medium text-slate-900 line-clamp-2">
                                {{ task.name }}
                              </p>
                              <p class="mt-0.5 text-xs text-slate-500 truncate">
                                {{ task.project_code ? `${task.project_code} · ` : '' }}{{ task.project_name ?? 'Proyecto' }}
                              </p>
                              <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                  {{ taskStatusLabels[task.status ?? 'pending'] ?? task.status }}
                                </span>
                                <span
                                  v-if="task.is_overdue && task.status !== 'completed' && task.status !== 'cancelled'"
                                  class="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
                                >
                                  Atrasada
                                </span>
                                <span v-if="task.due_date" class="text-[10px] text-slate-400">
                                  Vence {{ formatTaskDueShort(task.due_date) }}
                                </span>
                              </div>
                            </button>
                          </li>
                        </ul>
                      </div>

                      <div class="border-t border-slate-100 pt-3">
                        <p class="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Por aprobar
                        </p>
                        <template v-if="pendingApprovalsPreview.length === 0">
                          <p class="px-3 py-4 text-center text-sm text-slate-500">
                            No tienes solicitudes pendientes por aprobar.
                          </p>
                        </template>
                        <ul v-else class="space-y-1">
                          <li v-for="req in pendingApprovalsPreview" :key="req.id ?? ''">
                            <button
                              type="button"
                              class="w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:border-violet-100 hover:bg-violet-50/60"
                              @click="openApprovalDetailFromNotif(req)"
                            >
                              <p class="text-sm font-medium text-slate-900 line-clamp-2">
                                {{ req.title ?? 'Sin título' }}
                              </p>
                              <p class="mt-0.5 text-xs text-slate-500 truncate">
                                <span v-if="req.request_number != null">#{{ req.request_number }}</span>
                                <span v-if="req.category_name"> · {{ req.category_name }}</span>
                                <span v-if="req.request_number == null && !req.category_name">Solicitud</span>
                              </p>
                              <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span class="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Publicada
                                </span>
                                <span
                                  v-if="req.amount != null"
                                  class="text-[10px] text-slate-500"
                                >
                                  {{ formatApprovalAmountShort(req.amount, req.currency) }}
                                </span>
                              </div>
                            </button>
                          </li>
                        </ul>
                      </div>
                    </template>
                  </div>

                  <div class="border-t border-slate-100 px-3 py-2 bg-slate-50/80 flex flex-col gap-0.5">
                    <NuxtLink
                      to="/admin/tasks"
                      class="block text-center text-xs font-semibold text-indigo-700 hover:text-indigo-900 py-1.5 rounded-lg hover:bg-white"
                      @click="closeTaskNotif"
                    >
                      Ver todas las tareas
                    </NuxtLink>
                    <NuxtLink
                      to="/admin/approval-requests"
                      class="block text-center text-xs font-semibold text-violet-700 hover:text-violet-900 py-1.5 rounded-lg hover:bg-white"
                      @click="closeTaskNotif"
                    >
                      Ver todas las solicitudes
                    </NuxtLink>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Invitaciones recibidas -->
            <div ref="invitationsRef" class="relative">
              <button
                type="button"
                class="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2"
                :title="'Invitaciones recibidas'"
                :aria-expanded="isInvitationsOpen"
                aria-haspopup="true"
                aria-label="Invitaciones recibidas"
                @click.stop="toggleInvitationsDropdown"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span
                  v-if="pendingInvitationCount > 0"
                  class="absolute -right-0.5 -top-0.5 min-h-[1.125rem] min-w-[1.125rem] rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm flex items-center justify-center tabular-nums"
                >
                  {{ invitationsBadgeLabel }}
                </span>
              </button>

              <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 scale-95 -translate-y-1"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 -translate-y-1"
              >
                <div
                  v-if="isInvitationsOpen"
                  class="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 z-50 flex flex-col"
                >
                  <div class="border-b border-slate-100 bg-gradient-to-r from-fuchsia-50/80 to-violet-50/60 px-4 py-3">
                    <p class="text-sm font-semibold text-slate-800">
                      Invitaciones recibidas
                    </p>
                    <p class="mt-0.5 text-xs text-slate-500">
                      Empresas que te invitaron a unirte.
                    </p>
                  </div>

                  <div class="flex-1 overflow-y-auto p-2">
                    <template v-if="!partner">
                      <p class="px-3 py-6 text-center text-sm text-slate-500 leading-relaxed">
                        No hay un partner vinculado a tu cuenta.
                      </p>
                    </template>
                    <template v-else-if="isLoadingInvitations && invitationsPreview.length === 0">
                      <div class="flex justify-center py-10">
                        <div class="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
                      </div>
                    </template>
                    <template v-else-if="invitationsPreview.length === 0">
                      <p class="px-3 py-8 text-center text-sm text-slate-500">
                        No tienes invitaciones pendientes.
                      </p>
                    </template>
                    <ul v-else class="space-y-2">
                      <li
                        v-for="inv in invitationsPreview"
                        :key="inv.relationship_id"
                        class="rounded-lg border border-slate-100 px-3 py-2.5 hover:border-fuchsia-100 hover:bg-fuchsia-50/40 transition-colors"
                      >
                        <div class="flex items-start gap-2.5">
                          <div class="flex-shrink-0 mt-0.5">
                            <img
                              v-if="inv.company_logo_url"
                              :src="inv.company_logo_url"
                              :alt="inv.company_name"
                              class="w-9 h-9 rounded-lg object-cover ring-1 ring-slate-200"
                            />
                            <div
                              v-else
                              class="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm"
                            >
                              {{ (inv.company_display_name || inv.company_name).charAt(0).toUpperCase() }}
                            </div>
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-semibold text-slate-900 truncate">
                              {{ inv.company_display_name || inv.company_name }}
                            </p>
                            <p class="mt-0.5 text-xs text-slate-500 truncate">
                              Rol: {{ invitationRoleLabels[inv.role] }}
                              <span v-if="inv.invited_by_name"> · {{ inv.invited_by_name }}</span>
                            </p>
                            <div class="mt-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-fuchsia-600 hover:from-indigo-600 hover:to-fuchsia-700 transition-all disabled:opacity-60"
                                :disabled="respondingInvitationId === inv.relationship_id"
                                @click="respondInvitationFromHeader(inv.relationship_id, true)"
                              >
                                Aceptar
                              </button>
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-60"
                                :disabled="respondingInvitationId === inv.relationship_id"
                                @click="respondInvitationFromHeader(inv.relationship_id, false)"
                              >
                                Rechazar
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div class="border-t border-slate-100 px-3 py-2 bg-slate-50/80">
                    <NuxtLink
                      to="/admin/invitations"
                      class="block text-center text-xs font-semibold text-fuchsia-700 hover:text-fuchsia-900 py-1.5 rounded-lg hover:bg-white"
                      @click="closeInvitations"
                    >
                      Ver todas las invitaciones
                    </NuxtLink>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Company Selector -->
            <div ref="companySelectorRef" class="relative">
              <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                @click="toggleCompanySelector"
              >
                <!-- Company Icon -->
                <div class="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <span class="text-white text-xs font-semibold">
                    {{ selectedCompany?.name?.charAt(0) || 'C' }}
                  </span>
                </div>
                <!-- Company Name -->
                <span class="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
                  {{ selectedCompany?.name || 'Seleccionar' }}
                </span>
                <!-- Chevron -->
                <svg
                  :class="[
                    'w-4 h-4 text-slate-400 transition-transform duration-200',
                    isCompanySelectorOpen ? 'rotate-180' : ''
                  ]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Dropdown Menu -->
              <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 scale-95 -translate-y-1"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 -translate-y-1"
              >
                <div
                  v-if="isCompanySelectorOpen"
                  class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50"
                >
                  <!-- Header -->
                  <div class="px-3 py-2 border-b border-slate-100">
                    <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Seleccionar empresa
                    </p>
                  </div>

                  <!-- Company List -->
                  <div class="max-h-60 overflow-y-auto py-1">
                    <button
                      v-for="company in availableCompanies"
                      :key="company.id"
                      type="button"
                      :class="[
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors',
                        selectedCompanyId === company.id ? 'bg-indigo-50' : ''
                      ]"
                      @click="selectCompany(company.id)"
                    >
                      <!-- Company Icon -->
                      <div
                        :class="[
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                          selectedCompanyId === company.id 
                            ? 'bg-gradient-to-br from-indigo-500 to-violet-600' 
                            : 'bg-slate-200'
                        ]"
                      >
                        <span
                          :class="[
                            'text-sm font-semibold',
                            selectedCompanyId === company.id ? 'text-white' : 'text-slate-600'
                          ]"
                        >
                          {{ company.name.charAt(0) }}
                        </span>
                      </div>
                      <!-- Company Info -->
                      <div class="flex-1 min-w-0">
                        <p
                          :class="[
                            'text-sm font-medium truncate',
                            selectedCompanyId === company.id ? 'text-indigo-700' : 'text-slate-700'
                          ]"
                        >
                          {{ company.name }}
                        </p>
                      </div>
                      <!-- Check Icon -->
                      <svg
                        v-if="selectedCompanyId === company.id"
                        class="w-5 h-5 text-indigo-600 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>

                  <!-- Empty State -->
                  <div
                    v-if="availableCompanies.length === 0"
                    class="px-3 py-4 text-center"
                  >
                    <p class="text-sm text-slate-500">No hay empresas disponibles</p>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Divider -->
            <div class="hidden sm:block w-px h-6 bg-slate-200" />

            <!-- Avatar Dropdown -->
            <Avatar
              :name="authStore.partnerDisplayName"
              :email="authStore.partnerEmail"
              size="md"
              @profile="handleProfile"
              @logout="handleLogout"
            />
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
