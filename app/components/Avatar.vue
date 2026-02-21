<script setup lang="ts">
interface Props {
  /** URL de la imagen del avatar */
  src?: string
  /** Nombre del usuario para mostrar iniciales si no hay imagen */
  name?: string
  /** Tamaño del avatar: 'sm' | 'md' | 'lg' */
  size?: 'sm' | 'md' | 'lg'
  /** Email del usuario (opcional, para mostrar en el dropdown) */
  email?: string
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  name: 'Usuario',
  size: 'md',
  email: ''
})

const emit = defineEmits<{
  profile: []
  logout: []
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLElement | null>(null)

// Calcular iniciales del nombre
const initials = computed(() => {
  if (!props.name) return 'U'
  const parts = props.name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const first = parts[0][0] ?? ''
    const second = parts[1][0] ?? ''
    return (first + second).toUpperCase()
  }
  return props.name.slice(0, 2).toUpperCase()
})

// Tamaños del avatar
const sizeClasses = computed(() => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  }
  return sizes[props.size]
})

// Toggle del dropdown
const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

// Cerrar dropdown
const closeDropdown = () => {
  isOpen.value = false
}

// Manejar clic en "Mi perfil"
const handleProfile = () => {
  emit('profile')
  closeDropdown()
}

// Manejar clic en "Cerrar sesión"
const handleLogout = () => {
  emit('logout')
  closeDropdown()
}

// Cerrar dropdown al hacer clic fuera
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (
    dropdownRef.value &&
    !dropdownRef.value.contains(target) &&
    buttonRef.value &&
    !buttonRef.value.contains(target)
  ) {
    closeDropdown()
  }
}

// Cerrar dropdown con Escape
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="relative inline-block">
    <!-- Avatar Button -->
    <button
      ref="buttonRef"
      type="button"
      class="flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all hover:ring-2 hover:ring-slate-200"
      :class="sizeClasses"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="toggleDropdown"
    >
      <!-- Imagen del avatar -->
      <img
        v-if="src"
        :src="src"
        :alt="name"
        class="rounded-full object-cover"
        :class="sizeClasses"
      />
      <!-- Iniciales si no hay imagen -->
      <div
        v-else
        class="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-semibold flex items-center justify-center shadow-lg shadow-indigo-500/25"
        :class="sizeClasses"
      >
        {{ initials }}
      </div>
    </button>

    <!-- Dropdown Menu -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-show="isOpen"
        ref="dropdownRef"
        class="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-50"
        role="menu"
        aria-orientation="vertical"
      >
        <!-- Header del dropdown con info del usuario -->
        <div class="px-4 py-3 border-b border-slate-100">
          <p class="text-sm font-medium text-slate-900 truncate">{{ name }}</p>
          <p v-if="email" class="text-xs text-slate-500 truncate mt-0.5">{{ email }}</p>
        </div>

        <!-- Opciones del menú -->
        <div class="py-1">
          <!-- Mi perfil -->
          <button
            type="button"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            role="menuitem"
            @click="handleProfile"
          >
            <svg
              class="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
            Mi perfil
          </button>

          <!-- Cerrar sesión -->
          <button
            type="button"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
            role="menuitem"
            @click="handleLogout"
          >
            <svg
              class="w-5 h-5 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
