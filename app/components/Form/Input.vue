<template>
  <div class="w-full">
    <!-- Label -->
    <label
      v-if="label"
      :for="id"
      class="block text-base font-medium text-slate-700 mb-2"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-1">*</span>
    </label>

    <!-- Input wrapper -->
    <div class="relative">
      <!-- Icon slot (left) -->
      <div
        v-if="$slots.iconLeft"
        class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <slot name="iconLeft" />
      </div>

      <!-- Input element -->
      <input
        :id="id"
        :type="computedType"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :readonly="readonly"
        :min="min"
        :max="max"
        :step="step"
        :minlength="minlength"
        :maxlength="maxlength"
        :pattern="pattern"
        :autocomplete="autocomplete"
        :class="inputClasses"
        @input="handleInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />

      <!-- Icon slot (right) / Password toggle -->
      <div
        v-if="$slots.iconRight || type === 'password'"
        class="absolute right-4 top-1/2 -translate-y-1/2"
      >
        <!-- Password toggle button -->
        <button
          v-if="type === 'password'"
          type="button"
          @click="togglePasswordVisibility"
          class="text-slate-400 hover:text-slate-600 transition-colors p-1"
        >
          <svg v-if="!passwordVisible" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        </button>
        <!-- Custom right icon -->
        <slot v-else name="iconRight" />
      </div>
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
import { ref, computed } from 'vue'

// Props definition
interface Props {
  id?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local'
  modelValue?: string | number
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  error?: string
  hint?: string
  // Number input specific
  min?: number | string
  max?: number | string
  step?: number | string
  // Text input specific
  minlength?: number
  maxlength?: number
  pattern?: string
  autocomplete?: string
  // Sizing
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  id: () => `input-${Math.random().toString(36).substring(2, 9)}`,
  type: 'text',
  modelValue: '',
  required: false,
  disabled: false,
  readonly: false,
  size: 'lg',
  autocomplete: 'off'
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

// Password visibility toggle
const passwordVisible = ref(false)

const togglePasswordVisibility = () => {
  passwordVisible.value = !passwordVisible.value
}

// Computed type for password toggle
const computedType = computed(() => {
  if (props.type === 'password') {
    return passwordVisible.value ? 'text' : 'password'
  }
  return props.type
})

// Handle input event
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = props.type === 'number' ? Number(target.value) : target.value
  emit('update:modelValue', value)
}

// Size classes
const sizeClasses = computed(() => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg'
  }
  return sizes[props.size]
})

// Input classes
const inputClasses = computed(() => {
  const baseClasses = [
    'w-full rounded-xl bg-slate-50 border text-slate-900 placeholder-slate-400',
    'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all',
    sizeClasses.value
  ]

  // Add padding for icons
  if (props.type === 'password') {
    baseClasses.push('pr-14')
  }

  // Border color based on state
  if (props.error) {
    baseClasses.push('border-red-500 focus:ring-red-500 focus:border-red-500')
  } else {
    baseClasses.push('border-slate-300')
  }

  // Disabled state
  if (props.disabled) {
    baseClasses.push('opacity-50 cursor-not-allowed bg-slate-100')
  }

  // Readonly state
  if (props.readonly) {
    baseClasses.push('bg-slate-100 cursor-default')
  }

  return baseClasses.join(' ')
})
</script>

<style scoped>
/* Remove number input arrows */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
