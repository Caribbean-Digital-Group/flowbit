<script setup lang="ts">
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
  if (companySelectorRef.value && !companySelectorRef.value.contains(event.target as Node)) {
    isCompanySelectorOpen.value = false
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
    title: 'Partners',
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
    title: 'Líneas de orden',
    to: '/admin/order-lines',
    iconPaths: [
      'M4 6h16M4 10h16M4 14h16M4 18h16'
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

          <!-- Right: Selected Company + Avatar -->
          <div class="flex items-center gap-3">
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
