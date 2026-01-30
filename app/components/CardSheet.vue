<template>
  <div :class="containerClasses">
    <!-- ============================================== -->
    <!-- HEADER SECTION -->
    <!-- ============================================== -->
    <header :class="headerClasses">
      <!-- Left side: Title and subtitle -->
      <div class="flex items-center gap-4 min-w-0 flex-1">
        <!-- Back button slot -->
        <slot name="backButton">
          <button
            v-if="showBackButton"
            type="button"
            class="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200"
            @click="$emit('back')"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </slot>

        <!-- Title area -->
        <div class="min-w-0 flex-1">
          <slot name="title">
            <h1 class="text-2xl lg:text-3xl font-bold text-slate-800 truncate">
              {{ title }}
            </h1>
            <p v-if="subtitle" class="mt-1 text-base lg:text-lg text-slate-500 truncate">
              {{ subtitle }}
            </p>
          </slot>
        </div>

        <!-- Status badge slot -->
        <slot name="status" />
      </div>

      <!-- Right side: Action buttons -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <!-- Options dropdown slot -->
        <slot name="options">
          <!-- Dropdown menu con opciones personalizadas -->
          <div v-if="showOptionsButton && hasMenuOptions" class="relative">
            <button
              ref="menuButtonRef"
              type="button"
              class="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200"
              :class="{ 'bg-slate-200': isMenuOpen }"
              @click="toggleMenu"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            <!-- Dropdown menu -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 scale-95 translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 translate-y-1"
            >
              <div
                v-if="isMenuOpen"
                ref="menuRef"
                class="absolute right-0 top-full mt-2 min-w-[200px] bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200 py-2 z-50 overflow-hidden"
              >
                <template v-for="(option, index) in menuOptions" :key="option.id">
                  <!-- Divisor -->
                  <div v-if="option.divider && index > 0" class="border-t border-slate-200 my-2" />
                  
                  <!-- Opción del menú -->
                  <button
                    type="button"
                    :class="getOptionClasses(option)"
                    :disabled="option.disabled"
                    @click="handleOptionClick(option)"
                  >
                    <!-- Icono de la opción -->
                    <svg 
                      v-if="option.icon" 
                      class="w-5 h-5 flex-shrink-0" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        stroke-linecap="round" 
                        stroke-linejoin="round" 
                        stroke-width="2" 
                        :d="option.icon" 
                      />
                    </svg>
                    <span>{{ option.label }}</span>
                  </button>
                </template>
              </div>
            </Transition>
          </div>
          
          <!-- Botón simple sin dropdown (comportamiento original) -->
          <button
            v-else-if="showOptionsButton"
            type="button"
            class="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200"
            @click="$emit('options')"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </slot>

        <!-- Edit button slot -->
        <slot name="editButton">
          <button
            v-if="showEditButton && !isEditing"
            type="button"
            class="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-lg transition-all duration-200"
            @click="$emit('edit')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Editar</span>
          </button>
        </slot>

        <!-- Save/Cancel buttons slot (visible when editing) -->
        <slot name="saveButtons">
          <template v-if="isEditing">
            <button
              type="button"
              class="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-lg transition-all duration-200"
              @click="$emit('cancel')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Cancelar</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-lg shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200"
              @click="$emit('save')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Guardar</span>
            </button>
          </template>
        </slot>

        <!-- Custom header actions slot -->
        <slot name="headerActions" />
      </div>
    </header>

    <!-- ============================================== -->
    <!-- BODY/CONTENT SECTION -->
    <!-- ============================================== -->
    <main :class="contentClasses">
      <!-- Content wrapper with optional sections -->
      <div class="space-y-8">
        <!-- Main content slot (for forms, details, etc.) -->
        <slot />

        <!-- Additional sections slot -->
        <slot name="sections" />
      </div>
    </main>

    <!-- ============================================== -->
    <!-- FOOTER SECTION - Tracking/Audit Data -->
    <!-- ============================================== -->
    <footer v-if="$slots.footer || showFooter" :class="footerClasses">
      <slot name="footer">
        <!-- Default footer layout for tracking data -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Created by -->
          <div class="flex items-center gap-4">
            <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-500 uppercase tracking-wide">Creado por</p>
              <p class="text-base lg:text-lg font-semibold text-slate-800 truncate">
                <slot name="createdBy">{{ createdBy || '—' }}</slot>
              </p>
            </div>
          </div>

          <!-- Created at -->
          <div class="flex items-center gap-4">
            <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-500 uppercase tracking-wide">Creado el</p>
              <p class="text-base lg:text-lg font-semibold text-slate-800 truncate">
                <slot name="createdAt">{{ formattedCreatedAt }}</slot>
              </p>
            </div>
          </div>

          <!-- Updated by -->
          <div class="flex items-center gap-4">
            <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 text-amber-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-500 uppercase tracking-wide">Actualizado por</p>
              <p class="text-base lg:text-lg font-semibold text-slate-800 truncate">
                <slot name="updatedBy">{{ updatedBy || '—' }}</slot>
              </p>
            </div>
          </div>

          <!-- Updated at -->
          <div class="flex items-center gap-4">
            <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-100 text-violet-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-500 uppercase tracking-wide">Actualizado el</p>
              <p class="text-base lg:text-lg font-semibold text-slate-800 truncate">
                <slot name="updatedAt">{{ formattedUpdatedAt }}</slot>
              </p>
            </div>
          </div>
        </div>
      </slot>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

// Helper para formatear fechas en formato corto YYYY-MM-DD
const formatShortDate = (dateString: string): string => {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return dateString
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interfaz para las opciones del menú dropdown
 */
export interface MenuOption {
  /** Identificador único de la opción */
  id: string
  /** Texto a mostrar en la opción */
  label: string
  /** Path SVG del icono (opcional) */
  icon?: string
  /** Función a ejecutar al hacer click */
  action: () => void
  /** Clases CSS adicionales para la opción */
  class?: string
  /** Si es true, muestra un divisor antes de esta opción */
  divider?: boolean
  /** Deshabilitar la opción */
  disabled?: boolean
  /** Variante de color: 'default' | 'danger' | 'warning' | 'success' */
  variant?: 'default' | 'danger' | 'warning' | 'success'
}

// Props definition
interface Props {
  // Content props
  title?: string
  subtitle?: string
  
  // Button visibility props
  showBackButton?: boolean
  showOptionsButton?: boolean
  showEditButton?: boolean
  showFooter?: boolean
  
  // State props
  isEditing?: boolean
  isLoading?: boolean
  
  // Tracking data props
  createdBy?: string
  createdAt?: string
  updatedBy?: string
  updatedAt?: string
  
  // Style props
  variant?: 'elevated' | 'flat' | 'outlined'
  padding?: 'sm' | 'md' | 'lg' | 'xl'
  fullHeight?: boolean
  
  // Menu options props
  /** Array de opciones para el menú dropdown */
  menuOptions?: MenuOption[]
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  showBackButton: true,
  showOptionsButton: true,
  showEditButton: true,
  showFooter: true,
  isEditing: false,
  isLoading: false,
  createdBy: '',
  createdAt: '',
  updatedBy: '',
  updatedAt: '',
  variant: 'elevated',
  padding: 'lg',
  fullHeight: false,
  menuOptions: () => []
})

// Emits
defineEmits<{
  back: []
  options: []
  edit: []
  save: []
  cancel: []
}>()

// ═══════════════════════════════════════════════════════════════════════════
// MENU DROPDOWN STATE
// ═══════════════════════════════════════════════════════════════════════════
const isMenuOpen = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)
const menuButtonRef = ref<HTMLButtonElement | null>(null)

/**
 * Togglea el estado del menú dropdown
 */
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

/**
 * Cierra el menú
 */
const closeMenu = () => {
  isMenuOpen.value = false
}

/**
 * Ejecuta la acción de una opción y cierra el menú
 */
const handleOptionClick = (option: MenuOption) => {
  if (option.disabled) return
  option.action()
  closeMenu()
}

/**
 * Maneja clicks fuera del menú para cerrarlo
 */
const handleClickOutside = (event: MouseEvent) => {
  if (!isMenuOpen.value) return
  const target = event.target as Node
  if (
    menuRef.value && !menuRef.value.contains(target) &&
    menuButtonRef.value && !menuButtonRef.value.contains(target)
  ) {
    closeMenu()
  }
}

/**
 * Cierra el menú con Escape
 */
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isMenuOpen.value) {
    closeMenu()
  }
}

// Computed para verificar si hay opciones de menú
const hasMenuOptions = computed(() => props.menuOptions && props.menuOptions.length > 0)

/**
 * Clases para cada opción del menú según su variante
 */
const getOptionClasses = (option: MenuOption): string => {
  const base = [
    'flex items-center gap-3 w-full px-4 py-3 text-left text-sm font-medium',
    'transition-colors duration-150'
  ]
  
  if (option.disabled) {
    base.push('opacity-50 cursor-not-allowed')
  } else {
    base.push('cursor-pointer')
  }
  
  const variants = {
    default: option.disabled 
      ? 'text-slate-400' 
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
    danger: option.disabled 
      ? 'text-red-300' 
      : 'text-red-600 hover:bg-red-50 hover:text-red-700',
    warning: option.disabled 
      ? 'text-amber-300' 
      : 'text-amber-600 hover:bg-amber-50 hover:text-amber-700',
    success: option.disabled 
      ? 'text-emerald-300' 
      : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
  }
  
  base.push(variants[option.variant || 'default'])
  
  if (option.class) {
    base.push(option.class)
  }
  
  return base.join(' ')
}

// Lifecycle hooks para event listeners
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

// Container classes
const containerClasses = computed(() => {
  const base = [
    'flex flex-col',
    'bg-white',
    'rounded-2xl lg:rounded-3xl',
    'overflow-hidden',
    'transition-all duration-300'
  ]
  
  // Variant styles
  const variants = {
    elevated: 'shadow-xl shadow-slate-200/50 border border-slate-100',
    flat: 'border border-slate-200',
    outlined: 'border-2 border-slate-300'
  }
  base.push(variants[props.variant])
  
  // Full height option
  if (props.fullHeight) {
    base.push('h-full min-h-0')
  }
  
  return base.join(' ')
})

// Header classes
const headerClasses = computed(() => {
  const base = [
    'flex flex-col lg:flex-row lg:items-center justify-between gap-4',
    'bg-gradient-to-r from-slate-50 to-white',
    'border-b border-slate-100'
  ]
  
  // Padding based on prop
  const paddings = {
    sm: 'px-4 py-4',
    md: 'px-6 py-5',
    lg: 'px-8 py-6',
    xl: 'px-10 py-8'
  }
  base.push(paddings[props.padding])
  
  return base.join(' ')
})

// Content classes
const contentClasses = computed(() => {
  const base = [
    'flex-1',
    'bg-white',
    'overflow-y-auto'
  ]
  
  // Padding based on prop
  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  }
  base.push(paddings[props.padding])
  
  return base.join(' ')
})

// Footer classes
const footerClasses = computed(() => {
  const base = [
    'bg-gradient-to-r from-slate-50 to-slate-100/50',
    'border-t border-slate-200'
  ]
  
  // Padding based on prop
  const paddings = {
    sm: 'px-4 py-4',
    md: 'px-6 py-5',
    lg: 'px-8 py-6',
    xl: 'px-10 py-8'
  }
  base.push(paddings[props.padding])
  
  return base.join(' ')
})

// Fechas formateadas
const formattedCreatedAt = computed(() => formatShortDate(props.createdAt))
const formattedUpdatedAt = computed(() => formatShortDate(props.updatedAt))
</script>
