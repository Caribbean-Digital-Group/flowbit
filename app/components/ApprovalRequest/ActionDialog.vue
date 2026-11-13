<script lang="ts">
export interface ActionDialogResult {
  text: string
  option: string
  checked: boolean
}
</script>

<script setup lang="ts">
type Option = {
  value: string
  label: string
}

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  /** Texto obligatorio (motivo, comentario). */
  textLabel?: string
  textRequired?: boolean
  /** Lista opcional (motivo de rechazo, persona). */
  optionLabel?: string
  options?: Option[]
  optionRequired?: boolean
  checkboxLabel?: string
  loading?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  confirmLabel: 'Confirmar',
  confirmVariant: 'primary',
  textLabel: '',
  textRequired: false,
  optionLabel: '',
  options: () => [],
  optionRequired: false,
  checkboxLabel: '',
  loading: false,
  error: null
})

const emit = defineEmits<{
  close: []
  confirm: [result: ActionDialogResult]
}>()

const text = ref('')
const option = ref('')
const checked = ref(false)

watch(() => props.open, (open) => {
  if (open) { text.value = ''; option.value = ''; checked.value = false }
})

const canConfirm = computed(() =>
  (!props.textRequired || text.value.trim().length > 0)
  && (!props.optionRequired || option.value !== ''))

const confirm = (): void => {
  if (!canConfirm.value) return
  emit('confirm', { text: text.value.trim(), option: option.value, checked: checked.value })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="emit('close')" />
      <div class="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
        <h2 class="text-lg font-bold text-slate-800">{{ title }}</h2>
        <p v-if="description" class="mt-1 text-sm text-slate-500">{{ description }}</p>
        <div class="mt-5 space-y-4">
          <FormSelect
            v-if="options.length || optionLabel"
            v-model="option"
            :label="optionLabel"
            :options="options"
            :required="optionRequired"
            searchable
            clearable
            placeholder="Selecciona"
          />
          <FormTextArea v-if="textLabel" v-model="text" :label="textLabel" :required="textRequired" :rows="3" />
          <label v-if="checkboxLabel" class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="checked" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600">
            {{ checkboxLabel }}
          </label>
          <p v-if="error" class="text-sm font-medium text-red-600">{{ error }}</p>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <BtnApp variant="ghost" label="Cancelar" @click="emit('close')" />
          <BtnApp :variant="confirmVariant" :label="confirmLabel" :loading="loading" :disabled="!canConfirm" @click="confirm" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
