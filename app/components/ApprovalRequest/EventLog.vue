<script setup lang="ts">
import type { ApprovalRequestEventRow } from '~/types/approval.types'
import { approvalEventLabel, approvalStatusLabel, formatDateTimeMx } from '~/utils/approvals'

interface Props {
  events: ApprovalRequestEventRow[]
  nameOf: (partnerId: string | null | undefined) => string
  chainOk?: boolean | null
}

const props = withDefaults(defineProps<Props>(), { chainOk: null })

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.events : props.events.slice(-8)))

/** Detalle corto del evento a partir del payload. */
const detail = (e: ApprovalRequestEventRow): string => {
  const p = e.payload as Record<string, unknown>
  const parts: string[] = []
  if (typeof p.comment === 'string' && p.comment) parts.push(`«${p.comment}»`)
  if (typeof p.reason === 'string' && p.reason) parts.push(`Motivo: ${p.reason}`)
  if (typeof p.note === 'string' && p.note) parts.push(p.note)
  if (typeof p.file_name === 'string') parts.push(p.file_name)
  if (typeof p.to_name === 'string') parts.push(`a ${p.to_name}`)
  if (typeof p.name === 'string' && e.event_type === 'approver_added') parts.push(p.name)
  if (typeof p.status === 'string' && e.event_type === 'resolved') parts.push(approvalStatusLabel(p.status))
  if (p.forced === true) parts.push('forzada')
  if (Array.isArray(p.critical) && p.critical.length) parts.push(`Campos: ${p.critical.join(', ')}`)
  if (Array.isArray(p.steps) && p.steps.length) parts.push(p.steps.join(', '))
  return parts.join(' · ')
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Bitácora</h3>
      <span
        v-if="chainOk !== null"
        class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
        :class="chainOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
        :title="chainOk ? 'Cada evento guarda el hash del anterior; la cadena no tiene alteraciones' : 'Un evento fue alterado después de registrarse'"
      >
        {{ chainOk ? 'Integridad verificada' : 'Integridad comprometida' }}
      </span>
    </div>
    <button
      v-if="events.length > 8"
      type="button"
      class="mb-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Ver los más recientes' : `Ver los ${events.length} eventos` }}
    </button>
    <ol class="space-y-2">
      <li v-for="e in shown" :key="e.id" class="flex gap-3 text-xs">
        <span class="w-6 flex-shrink-0 text-right font-mono text-slate-400">{{ e.seq }}</span>
        <div class="min-w-0 flex-1">
          <p class="text-slate-700">
            <span class="font-semibold">{{ e.automatic ? 'Sistema' : nameOf(e.actor_partner_id) }}</span>
            · {{ approvalEventLabel(e.event_type) }}
            <span v-if="detail(e)" class="text-slate-500">— {{ detail(e) }}</span>
          </p>
          <p class="text-slate-400">{{ formatDateTimeMx(e.created_at) }}<template v-if="e.ip"> · IP {{ e.ip }}</template></p>
        </div>
      </li>
    </ol>
  </div>
</template>
