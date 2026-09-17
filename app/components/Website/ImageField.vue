<script setup lang="ts">
/** Campo de imagen: URL editable + vista previa + acceso a la biblioteca de medios. */
interface Props {
  label?: string
  hint?: string
  companyId: string
  readonly?: boolean
  aspect?: 'square' | 'video' | 'auto'
}

withDefaults(defineProps<Props>(), { label: 'Imagen', hint: '', readonly: false, aspect: 'video' })
const modelValue = defineModel<string>({ default: '' })
const pickerOpen = ref(false)

const onSelect = (payload: { url: string }) => {
  modelValue.value = payload.url
}
</script>

<template>
  <div>
    <p v-if="label" class="block text-sm font-medium text-slate-700 mb-1.5">{{ label }}</p>
    <div class="flex gap-3">
      <button
        type="button"
        :class="['flex-shrink-0 w-24 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center', aspect === 'square' ? 'h-24' : 'h-16']"
        :disabled="readonly"
        @click="!readonly && (pickerOpen = true)"
      >
        <img v-if="modelValue" :src="modelValue" alt="" class="w-full h-full object-cover" />
        <svg v-else class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" /></svg>
      </button>
      <div class="flex-1 min-w-0 space-y-2">
        <FormInput v-model="modelValue" type="url" placeholder="https://… o elige de la biblioteca" :readonly="readonly" size="sm" />
        <div class="flex items-center gap-3">
          <button v-if="!readonly" type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="pickerOpen = true">Elegir de la biblioteca</button>
          <button v-if="!readonly && modelValue" type="button" class="text-xs font-medium text-slate-500 hover:text-red-600" @click="modelValue = ''">Quitar</button>
        </div>
        <p v-if="hint" class="text-xs text-slate-500">{{ hint }}</p>
      </div>
    </div>
    <WebsiteMediaPicker v-model:open="pickerOpen" :company-id="companyId" @select="onSelect" />
  </div>
</template>
