<script setup lang="ts">
import type { ApprovalPlanStep } from '~/types/approval.types'
import { APPROVAL_RESOLVED_VIA_LABELS, APPROVAL_STEP_MODE_LABELS } from '~/utils/approvals'

interface Props {
  steps: ApprovalPlanStep[]
  loading?: boolean
  title?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  title: 'Quién la aprobará'
})

const modeText = (step: ApprovalPlanStep): string =>
  step.mode === 'quorum' ? `Mínimo ${step.quorum ?? 1} aprobaciones` : APPROVAL_STEP_MODE_LABELS[step.mode]
</script>

<template>
  <div class="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
    <h3 class="mb-4 text-xs font-semibold uppercase tracking-wide text-indigo-700">{{ title }}</h3>
    <p v-if="loading" class="text-sm text-slate-500">Calculando el flujo…</p>
    <p v-else-if="!steps.length" class="text-sm text-slate-500">Elige categoría y aprobador para ver el flujo.</p>
    <ol v-else class="space-y-3">
      <li
        v-for="step in steps"
        :key="`${step.sequence}-${step.name}`"
        class="flex gap-3 rounded-xl bg-white p-3 shadow-sm"
        :class="step.skipped ? 'opacity-60' : ''"
      >
        <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
          {{ step.sequence }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-slate-800">
            {{ step.name }}
            <span v-if="step.informative" class="ml-1 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Informativo</span>
            <span v-if="step.skipped" class="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Se omite</span>
          </p>
          <p class="text-xs text-slate-500">{{ step.skipped ? step.note : modeText(step) }}</p>
          <ul v-if="!step.skipped" class="mt-2 flex flex-wrap gap-1.5">
            <li
              v-for="approver in step.approvers"
              :key="approver.partner_id"
              class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
              :title="APPROVAL_RESOLVED_VIA_LABELS[approver.resolved_via] ?? approver.resolved_via"
            >
              {{ approver.name ?? 'Persona' }}
              <span v-if="approver.delegated_from_name" class="text-slate-400">· suplente de {{ approver.delegated_from_name }}</span>
            </li>
          </ul>
        </div>
      </li>
    </ol>
  </div>
</template>
