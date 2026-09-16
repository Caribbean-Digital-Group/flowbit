<script lang="ts">
export interface CrmLostDialogResult {
  lostReasonId: string | null
  lostNotes: string
}
</script>

<script setup lang="ts">
import type { CrmLostReasonRow } from '~/types/crm.types'

interface Props {
  open: boolean
  leadName?: string
  stageName?: string
  reasons?: CrmLostReasonRow[]
  isSaving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  leadName: '',
  stageName: '',
  reasons: () => [],
  isSaving: false
})

const emit = defineEmits<{
  'confirm': [result: CrmLostDialogResult]
  'cancel': []
}>()

const selectedReasonId = ref<string | null>(null)
const notes = ref('')
const hasReasonError = ref(false)
const dialogRef = ref<HTMLElement | null>(null)

const hasReasons = computed(() => props.reasons.length > 0)

watch(() => props.open, async (open) => {
  if (!open) return
  selectedReasonId.value = null
  notes.value = ''
  hasReasonError.value = false
  await nextTick()
  dialogRef.value?.querySelector<HTMLElement>('input, textarea, button')?.focus()
})

const confirm = () => {
  if (hasReasons.value && !selectedReasonId.value) {
    hasReasonError.value = true
    return
  }
  emit('confirm', { lostReasonId: selectedReasonId.value, lostNotes: notes.value })
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !props.isSaving) emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
        @click.self="!isSaving && emit('cancel')"
        @keydown="onKeydown"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crm-lost-dialog-title"
          class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div class="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-white px-5 py-4">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <div class="min-w-0">
              <h2 id="crm-lost-dialog-title" class="text-base font-semibold text-slate-800">¿Por qué se perdió esta oportunidad?</h2>
              <p class="mt-0.5 truncate text-sm text-slate-500">
                <span class="font-medium text-slate-700">{{ leadName }}</span>
                <template v-if="stageName"> pasará a «{{ stageName }}»</template>
              </p>
            </div>
          </div>

          <div class="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
            <fieldset v-if="hasReasons">
              <legend class="mb-2 text-sm font-medium text-slate-700">
                Motivo <span class="text-red-500">*</span>
              </legend>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  v-for="reason in reasons"
                  :key="reason.id"
                  :class="[
                    'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition',
                    selectedReasonId === reason.id
                      ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-200'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  ]"
                >
                  <input
                    v-model="selectedReasonId"
                    type="radio"
                    name="crm-lost-reason"
                    :value="reason.id"
                    class="mt-0.5 h-4 w-4 border-slate-300 text-rose-600 focus:ring-rose-500"
                    @change="hasReasonError = false"
                  >
                  <span class="min-w-0">
                    <span class="block font-medium text-slate-800">{{ reason.name }}</span>
                    <span v-if="reason.description" class="mt-0.5 block text-xs text-slate-500">{{ reason.description }}</span>
                  </span>
                </label>
              </div>
              <p v-if="hasReasonError" class="mt-2 text-xs font-medium text-red-600" role="alert">
                Elige un motivo para continuar.
              </p>
            </fieldset>

            <div v-else class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Aún no hay motivos de pérdida configurados.
              <NuxtLink to="/admin/crm/lost-reasons" class="font-semibold underline">Configúralos</NuxtLink>
              para medir por qué se pierden las oportunidades.
            </div>

            <div>
              <label for="crm-lost-notes" class="mb-1.5 block text-sm font-medium text-slate-700">Comentario <span class="font-normal text-slate-400">(opcional)</span></label>
              <textarea
                id="crm-lost-notes"
                v-model="notes"
                rows="3"
                maxlength="1000"
                placeholder="Ej. Eligieron al proveedor actual por un 15 % menos…"
                class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
          </div>

          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
            <BtnApp variant="ghost" :disabled="isSaving" @click="emit('cancel')">Cancelar</BtnApp>
            <BtnApp variant="danger" :disabled="isSaving" @click="confirm">
              {{ isSaving ? 'Guardando…' : 'Marcar como perdido' }}
            </BtnApp>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
