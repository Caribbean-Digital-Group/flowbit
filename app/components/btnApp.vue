<template>
  <button
    :type="type"
    :disabled="isDisabled"
    :class="buttonClasses"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-2 h-5 w-5"
      :class="spinnerColorClass"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>

    <!-- Icon left slot -->
    <span v-if="$slots.iconLeft && !loading" class="mr-2 flex items-center">
      <slot name="iconLeft" />
    </span>

    <!-- Button content -->
    <span class="truncate">
      <slot>{{ loading ? loadingText : label }}</slot>
    </span>

    <!-- Icon right slot -->
    <span v-if="$slots.iconRight && !loading" class="ml-2 flex items-center">
      <slot name="iconRight" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props definition
interface Props {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  loading?: boolean
  loadingText?: string
  disabled?: boolean
  block?: boolean
  rounded?: 'md' | 'lg' | 'xl' | 'full'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'lg',
  label: '',
  loading: false,
  loadingText: 'Cargando...',
  disabled: false,
  block: false,
  rounded: 'xl'
})

// Emits
const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

// Computed: is button disabled
const isDisabled = computed(() => props.disabled || props.loading)

// Handle click
const handleClick = (event: MouseEvent) => {
  if (isDisabled.value) {
    event.preventDefault()
    return
  }
  emit('click', event)
}

// Variant classes
const variantClasses = computed(() => {
  const variants = {
    primary: [
      'bg-gradient-to-r from-indigo-600 to-violet-600',
      'hover:from-indigo-700 hover:to-violet-700',
      'text-white font-semibold',
      'shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40',
      'focus:ring-indigo-500'
    ],
    secondary: [
      'bg-slate-100 hover:bg-slate-200',
      'text-slate-700 font-semibold',
      'focus:ring-slate-400'
    ],
    outline: [
      'bg-transparent border-2 border-indigo-600',
      'hover:bg-indigo-50',
      'text-indigo-600 font-semibold',
      'focus:ring-indigo-500'
    ],
    ghost: [
      'bg-transparent hover:bg-slate-100',
      'text-slate-700 font-medium',
      'focus:ring-slate-400'
    ],
    danger: [
      'bg-gradient-to-r from-red-600 to-rose-600',
      'hover:from-red-700 hover:to-rose-700',
      'text-white font-semibold',
      'shadow-lg shadow-red-500/25 hover:shadow-red-500/40',
      'focus:ring-red-500'
    ],
    success: [
      'bg-gradient-to-r from-emerald-600 to-teal-600',
      'hover:from-emerald-700 hover:to-teal-700',
      'text-white font-semibold',
      'shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40',
      'focus:ring-emerald-500'
    ]
  }
  return variants[props.variant].join(' ')
})

// Size classes
const sizeClasses = computed(() => {
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
    xl: 'px-8 py-5 text-xl'
  }
  return sizes[props.size]
})

// Rounded classes
const roundedClasses = computed(() => {
  const rounded = {
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full'
  }
  return rounded[props.rounded]
})

// Spinner color class based on variant
const spinnerColorClass = computed(() => {
  const colors = {
    primary: 'text-white',
    secondary: 'text-slate-600',
    outline: 'text-indigo-600',
    ghost: 'text-slate-600',
    danger: 'text-white',
    success: 'text-white'
  }
  return colors[props.variant]
})

// Button classes
const buttonClasses = computed(() => {
  const baseClasses = [
    'inline-flex items-center justify-center',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    variantClasses.value,
    sizeClasses.value,
    roundedClasses.value
  ]

  // Block width
  if (props.block) {
    baseClasses.push('w-full')
  }

  // Disabled/Loading state
  if (isDisabled.value) {
    baseClasses.push('opacity-60 cursor-not-allowed pointer-events-none')
  } else {
    baseClasses.push('cursor-pointer')
  }

  return baseClasses.join(' ')
})
</script>
