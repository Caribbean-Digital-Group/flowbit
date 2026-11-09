<script setup lang="ts">
import type { ApprovalStepWithApprovers } from '~/composables/useApprovalRequest'
import {
  APPROVAL_APPROVER_STATUS_LABELS,
  APPROVAL_RESOLVED_VIA_LABELS,
  APPROVAL_STEP_MODE_LABELS,
  APPROVAL_STEP_STATUS_LABELS,
  formatDateTimeMx
} from '~/utils/approvals'

interface Props {
  steps: ApprovalStepWithApprovers[]
  currentRound: number
  nameOf: (partnerId: string | null | undefined) => string
}

const props = defineProps<Props>()

const showHistory = ref(false)

const rounds = computed(() => {
  const map = new Map<number, ApprovalStepWithApprovers[]>()
  for (const step of props.steps) {
    const list = map.get(step.round) ?? []
    list.push(step)
    map.set(step.round, list)
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0])
})

const visibleRounds = computed(() =>
  showHistory.value ? rounds.value : rounds.value.filter(([round]) => round === props.currentRound))

const stepDot = (status: string): string => ({
  active: 'bg-indigo-500 ring-4 ring-indigo-100',
  approved: 'bg-emerald-500',
  rejected: 'bg-red-500',
  skipped: 'bg-slate-300',
  cancelled: 'bg-slate-300',
  waiting: 'bg-white border-2 border-slate-300'
}[status] ?? 'bg-slate-300')

const approverClass = (status: string): string => ({
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-red-200 bg-red-50 text-red-800',
  informed: 'border-sky-200 bg-sky-50 text-sky-800'
}[status] ?? 'border-slate-200 bg-slate-50 text-slate-600')

const isOverdue = (step: ApprovalStepWithApprovers): boolean =>
  step.status === 'active' && !!step.due_at && new Date(step.due_at).getTime() < Date.now()
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Flujo de aprobación</h3>
      <button
        v-if="rounds.length > 1"
        type="button"
        class="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        @click="showHistory = !showHistory"
      >
        {{ showHistory ? 'Ver solo la ronda actual' : `Ver rondas anteriores (${rounds.length - 1})` }}
      </button>
    </div>

    <p v-if="!steps.length" class="text-sm text-slate-500">La solicitud aún no se envía.</p>

    <div v-for="[round, roundSteps] in visibleRounds" :key="round" class="mb-6 last:mb-0">
      <p v-if="rounds.length > 1" class="mb-3 text-xs font-semibold text-slate-400">
        Ronda {{ round }}{{ round === currentRound ? ' (actual)' : '' }}
      </p>
      <ol class="relative space-y-5 border-l border-slate-200 pl-6">
        <li v-for="step in roundSteps" :key="step.id" class="relative">
          <span class="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full" :class="stepDot(step.status)" />
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p class="text-sm font-semibold text-slate-800">{{ step.sequence }}. {{ step.name }}</p>
            <span class="text-xs text-slate-500">{{ APPROVAL_STEP_STATUS_LABELS[step.status] }}</span>
            <span v-if="step.informative" class="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Informativo</span>
            <span v-if="step.ad_hoc" class="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Agregado</span>
            <span v-if="isOverdue(step)" class="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Vencido</span>
          </div>
          <p class="text-xs text-slate-500">
            {{ step.mode === 'quorum' ? `Mínimo ${step.quorum} aprobaciones` : APPROVAL_STEP_MODE_LABELS[step.mode] }}
            <template v-if="step.due_at"> · vence {{ formatDateTimeMx(step.due_at) }}</template>
            <template v-if="step.note"> · {{ step.note }}</template>
          </p>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="a in step.approvers"
              :key="a.id"
              class="rounded-xl border px-3 py-2 text-xs"
              :class="approverClass(a.status)"
            >
              <div class="flex flex-wrap items-center gap-x-2">
                <span class="font-semibold">{{ nameOf(a.partner_id) }}</span>
                <span>{{ APPROVAL_APPROVER_STATUS_LABELS[a.status] }}</span>
                <span v-if="a.decided_at" class="opacity-70">· {{ formatDateTimeMx(a.decided_at) }}</span>
                <span class="opacity-70">· {{ APPROVAL_RESOLVED_VIA_LABELS[a.resolved_via] ?? a.resolved_via }}</span>
                <span v-if="a.delegated_from_partner_id" class="opacity-70">· en lugar de {{ nameOf(a.delegated_from_partner_id) }}</span>
              </div>
              <p v-if="a.comment" class="mt-1 whitespace-pre-line text-slate-700">«{{ a.comment }}»</p>
            </li>
          </ul>
        </li>
      </ol>
    </div>
  </div>
</template>
