<template>
  <div class="w-full">
    <label
      v-if="label"
      :for="id"
      class="block text-base font-medium text-slate-700 mb-2"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-1">*</span>
    </label>

    <textarea
      :id="id"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :rows="rows"
      :minlength="minlength"
      :maxlength="maxlength"
      :autocomplete="autocomplete"
      :class="textareaClasses"
      @input="handleInput"
      @blur="$emit('blur', $event)"
      @focus="$emit('focus', $event)"
    />

    <div class="flex items-start justify-between mt-2">
      <p v-if="error" class="text-sm text-red-600">
        {{ error }}
      </p>
      <p v-else-if="hint" class="text-sm text-slate-500">
        {{ hint }}
      </p>
      <span v-else />

      <span
        v-if="maxlength && showCount"
        class="text-sm text-slate-400 ml-auto tabular-nums"
        :class="{ 'text-red-500': currentLength >= maxlength }"
      >
        {{ currentLength }}/{{ maxlength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  id?: string
  modelValue?: string
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  error?: string
  hint?: string
  rows?: number
  minlength?: number
  maxlength?: number
  autocomplete?: string
  showCount?: boolean
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  id: () => `textarea-${Math.random().toString(36).substring(2, 9)}`,
  modelValue: '',
  required: false,
  disabled: false,
  readonly: false,
  rows: 4,
  showCount: false,
  resize: 'vertical',
  size: 'lg',
  autocomplete: 'off'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

const currentLength = computed(() => (props.modelValue ?? '').length)

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg'
  }
  return sizes[props.size]
})

const resizeClass = computed(() => {
  const map: Record<string, string> = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize'
  }
  return map[props.resize]
})

const textareaClasses = computed(() => {
  const base = [
    'w-full rounded-xl bg-slate-50 border text-slate-900 placeholder-slate-400',
    'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all',
    sizeClasses.value,
    resizeClass.value
  ]

  if (props.error) {
    base.push('border-red-500 focus:ring-red-500 focus:border-red-500')
  } else {
    base.push('border-slate-300')
  }

  if (props.disabled) {
    base.push('opacity-50 cursor-not-allowed bg-slate-100')
  }

  if (props.readonly) {
    base.push('bg-slate-100 cursor-default')
  }

  return base.join(' ')
})
</script>
