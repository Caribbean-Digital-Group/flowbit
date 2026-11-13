<script setup lang="ts">
import type { ApprovalRequestAttachmentRow } from '~/types/approval.types'
import { formatDateTimeMx } from '~/utils/approvals'

interface Props {
  attachments: ApprovalRequestAttachmentRow[]
  nameOf: (partnerId: string | null | undefined) => string
  canUpload?: boolean
  canRemove?: (row: ApprovalRequestAttachmentRow) => boolean
  uploading?: boolean
  required?: boolean
}

withDefaults(defineProps<Props>(), {
  canUpload: false,
  canRemove: () => false,
  uploading: false,
  required: false
})

const emit = defineEmits<{
  upload: [files: File[]]
  open: [row: ApprovalRequestAttachmentRow]
  remove: [row: ApprovalRequestAttachmentRow]
}>()

const input = ref<HTMLInputElement | null>(null)

const onPick = (event: Event): void => {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (files.length) emit('upload', files)
  if (input.value) input.value.value = ''
}

const size = (bytes: number | null): string => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const isImage = (row: ApprovalRequestAttachmentRow): boolean => (row.mime_type ?? '').startsWith('image/')
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Adjuntos
        <span v-if="required" class="ml-1 normal-case text-amber-600">(la categoría pide al menos uno)</span>
      </h3>
      <template v-if="canUpload">
        <input
          ref="input"
          type="file"
          multiple
          class="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,.xlsx,.xls,.docx,.doc,.xml"
          @change="onPick"
        >
        <BtnApp variant="ghost" size="sm" :loading="uploading" label="Adjuntar archivo" @click="input?.click()" />
      </template>
    </div>
    <ul v-if="attachments.length" class="space-y-2">
      <li v-for="a in attachments" :key="a.id" class="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
        <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="isImage(a)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </span>
        <button type="button" class="min-w-0 flex-1 text-left" @click="emit('open', a)">
          <p class="truncate text-sm font-medium text-indigo-700 hover:underline">{{ a.file_name }}</p>
          <p class="text-xs text-slate-500">{{ nameOf(a.uploaded_by_partner_id) }} · {{ formatDateTimeMx(a.created_at) }} {{ size(a.size_bytes) }}</p>
        </button>
        <button
          v-if="canRemove(a)"
          type="button"
          class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Quitar adjunto"
          @click="emit('remove', a)"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </li>
    </ul>
    <p v-else class="text-sm text-slate-500">Sin archivos adjuntos.</p>
  </div>
</template>
