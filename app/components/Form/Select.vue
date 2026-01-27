<template>
  <div class="w-full" ref="containerRef">
    <!-- Label -->
    <label
      v-if="label"
      :for="id"
      class="block text-base font-medium text-slate-700 mb-2"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-1">*</span>
    </label>

    <!-- Select wrapper -->
    <div class="relative">
      <!-- Select button -->
      <button
        :id="id"
        type="button"
        :disabled="disabled"
        :class="selectClasses"
        @click="toggleDropdown"
      >
        <span :class="['truncate', !selectedLabel && 'text-slate-400']">
          {{ selectedLabel || placeholder }}
        </span>
        
        <!-- Chevron icon -->
        <svg
          class="w-5 h-5 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div
          v-if="isOpen"
          class="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
        >
          <!-- Search input -->
          <div v-if="searchable" class="p-3 border-b border-slate-200">
            <div class="relative">
              <svg
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                :placeholder="searchPlaceholder"
                class="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                @keydown.esc="closeDropdown"
              />
            </div>
          </div>

          <!-- Options list -->
          <ul
            class="max-h-60 overflow-y-auto py-2"
            role="listbox"
          >
            <!-- Empty state -->
            <li
              v-if="filteredOptions.length === 0"
              class="px-4 py-3 text-sm text-slate-500 text-center"
            >
              {{ noResultsText }}
            </li>

            <!-- Options -->
            <li
              v-for="(option, index) in filteredOptions"
              :key="String(getOptionValue(option) ?? index)"
              role="option"
              :aria-selected="isSelected(option)"
              :class="optionClasses(option)"
              @click="selectOption(option)"
            >
              <span class="truncate">{{ getOptionLabel(option) }}</span>
              
              <!-- Check icon for selected option -->
              <svg
                v-if="isSelected(option)"
                class="w-5 h-5 text-indigo-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </li>
          </ul>

          <!-- Clear selection button -->
          <div v-if="clearable && modelValue !== null && modelValue !== undefined && modelValue !== ''" class="p-2 border-t border-slate-200">
            <button
              type="button"
              class="w-full px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              @click="clearSelection"
            >
              {{ clearText }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Error message -->
    <p v-if="error" class="mt-2 text-sm text-red-600">
      {{ error }}
    </p>

    <!-- Hint message -->
    <p v-if="hint && !error" class="mt-2 text-sm text-slate-500">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

// Types
type OptionValue = string | number | boolean | null
type OptionObject = Record<string, unknown>
type Option = OptionValue | OptionObject

// Props definition
interface Props {
  id?: string
  modelValue?: OptionValue
  options: Option[]
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  // Option mapping
  valueKey?: string
  labelKey?: string
  // Search
  searchable?: boolean
  searchPlaceholder?: string
  noResultsText?: string
  // Clearable
  clearable?: boolean
  clearText?: string
  // Sizing
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  id: () => `select-${Math.random().toString(36).substring(2, 9)}`,
  modelValue: null,
  placeholder: 'Seleccionar...',
  required: false,
  disabled: false,
  valueKey: 'value',
  labelKey: 'label',
  searchable: true,
  searchPlaceholder: 'Buscar...',
  noResultsText: 'No se encontraron resultados',
  clearable: false,
  clearText: 'Limpiar selección',
  size: 'lg'
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: OptionValue]
  change: [value: OptionValue]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const searchQuery = ref('')

// Helpers to get value and label from options
const getOptionValue = (option: Option): OptionValue => {
  if (option === null || typeof option !== 'object') {
    return option as OptionValue
  }
  return (option as OptionObject)[props.valueKey] as OptionValue
}

const getOptionLabel = (option: Option): string => {
  if (option === null || typeof option !== 'object') {
    return String(option)
  }
  return String((option as OptionObject)[props.labelKey] ?? '')
}

// Filtered options based on search query
const filteredOptions = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.options
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return props.options.filter(option => {
    const label = getOptionLabel(option).toLowerCase()
    return label.includes(query)
  })
})

// Get selected label
const selectedLabel = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') {
    return ''
  }
  
  const selectedOption = props.options.find(option => getOptionValue(option) === props.modelValue)
  return selectedOption ? getOptionLabel(selectedOption) : ''
})

// Check if option is selected
const isSelected = (option: Option): boolean => {
  return getOptionValue(option) === props.modelValue
}

// Toggle dropdown
const toggleDropdown = () => {
  if (props.disabled) return
  
  isOpen.value = !isOpen.value
  
  if (isOpen.value) {
    searchQuery.value = ''
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

// Close dropdown
const closeDropdown = () => {
  isOpen.value = false
  searchQuery.value = ''
}

// Select option
const selectOption = (option: Option) => {
  const value = getOptionValue(option)
  emit('update:modelValue', value)
  emit('change', value)
  closeDropdown()
}

// Clear selection
const clearSelection = () => {
  emit('update:modelValue', null)
  emit('change', null)
  closeDropdown()
}

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Size classes
const sizeClasses = computed(() => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg'
  }
  return sizes[props.size]
})

// Select button classes
const selectClasses = computed(() => {
  const baseClasses = [
    'w-full rounded-xl bg-slate-50 border text-left flex items-center justify-between gap-2',
    'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all',
    sizeClasses.value
  ]

  // Border color based on state
  if (props.error) {
    baseClasses.push('border-red-500 focus:ring-red-500 focus:border-red-500')
  } else if (isOpen.value) {
    baseClasses.push('border-indigo-500 ring-2 ring-indigo-500')
  } else {
    baseClasses.push('border-slate-300')
  }

  // Disabled state
  if (props.disabled) {
    baseClasses.push('opacity-50 cursor-not-allowed bg-slate-100')
  } else {
    baseClasses.push('cursor-pointer hover:border-slate-400')
  }

  return baseClasses.join(' ')
})

// Option classes
const optionClasses = (option: Option) => {
  const baseClasses = [
    'px-4 py-3 cursor-pointer flex items-center justify-between gap-2 transition-colors'
  ]
  
  if (isSelected(option)) {
    baseClasses.push('bg-indigo-50 text-indigo-900')
  } else {
    baseClasses.push('text-slate-700 hover:bg-slate-100')
  }
  
  return baseClasses.join(' ')
}
</script>
