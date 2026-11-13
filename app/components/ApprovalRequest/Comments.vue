<script setup lang="ts">
import type { ApprovalRequestCommentRow } from '~/types/approval.types'
import { formatDateTimeMx } from '~/utils/approvals'

type Option = {
  value: string
  label: string
}

interface Props {
  comments: ApprovalRequestCommentRow[]
  nameOf: (partnerId: string | null | undefined) => string
  mentionOptions: Option[]
  sending?: boolean
}

withDefaults(defineProps<Props>(), { sending: false })

const emit = defineEmits<{
  send: [payload: { body: string; mentions: string[] }]
}>()

const body = ref('')
const mentionPick = ref('')
const mentions = ref<string[]>([])

const addMention = (value: string | number | boolean | null): void => {
  const id = String(value ?? '')
  if (id && !mentions.value.includes(id)) mentions.value = [...mentions.value, id]
  mentionPick.value = ''
}

const send = (): void => {
  if (!body.value.trim()) return
  emit('send', { body: body.value.trim(), mentions: mentions.value })
  body.value = ''
  mentions.value = []
}
</script>

<template>
  <div>
    <h3 class="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Conversación</h3>
    <ul v-if="comments.length" class="mb-5 space-y-3">
      <li v-for="c in comments" :key="c.id" class="rounded-xl bg-slate-50 px-4 py-3">
        <p class="text-xs text-slate-500">
          <span class="font-semibold text-slate-700">{{ nameOf(c.author_partner_id) }}</span>
          · {{ formatDateTimeMx(c.created_at) }}
          <template v-if="c.mentions.length"> · mencionó a {{ c.mentions.map(m => nameOf(m)).join(', ') }}</template>
        </p>
        <p class="mt-1 whitespace-pre-line text-sm text-slate-800">{{ c.body }}</p>
      </li>
    </ul>
    <p v-else class="mb-5 text-sm text-slate-500">Aún no hay comentarios.</p>

    <div class="space-y-3">
      <FormTextArea v-model="body" placeholder="Escribe un comentario para el solicitante y los aprobadores" :rows="3" />
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[14rem] flex-1">
          <FormSelect
            v-model="mentionPick"
            :options="mentionOptions"
            placeholder="Mencionar a…"
            searchable
            size="sm"
            @update:model-value="addMention"
          />
        </div>
        <BtnApp label="Comentar" size="sm" :loading="sending" :disabled="!body.trim()" @click="send" />
      </div>
      <div v-if="mentions.length" class="flex flex-wrap gap-1.5">
        <button
          v-for="m in mentions"
          :key="m"
          type="button"
          class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          @click="mentions = mentions.filter(x => x !== m)"
        >
          @{{ nameOf(m) }} ✕
        </button>
      </div>
      <p class="text-xs text-slate-400">Solo reciben la mención quienes pueden ver esta solicitud.</p>
    </div>
  </div>
</template>
