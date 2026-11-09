<script setup lang="ts">
import type { ApprovalApproverKind, ApprovalStepMode } from '~/types/approval.types'
import type { FlowStepInput } from '~/composables/useApprovalFlow'
import { APPROVAL_APPROVER_KIND_LABELS, APPROVAL_STEP_MODE_LABELS } from '~/utils/approvals'

type Option = {
  value: string
  label: string
}

interface Props {
  index: number
  total: number
  managerOptions: Option[]
  conditionFieldOptions: Option[]
}

defineProps<Props>()

const emit = defineEmits<{
  move: [direction: -1 | 1]
  remove: []
}>()

const step = defineModel<FlowStepInput>({ required: true })

const modeOptions = (Object.keys(APPROVAL_STEP_MODE_LABELS) as ApprovalStepMode[]).map(v => ({ value: v, label: APPROVAL_STEP_MODE_LABELS[v] }))
const kindOptions = (Object.keys(APPROVAL_APPROVER_KIND_LABELS) as ApprovalApproverKind[]).map(v => ({ value: v, label: APPROVAL_APPROVER_KIND_LABELS[v] }))

const addApprover = (): void => {
  step.value = { ...step.value, approvers: [...step.value.approvers, { kind: 'manager', approval_manager_id: null }] }
}

const updateApprover = (i: number, patch: Partial<FlowStepInput['approvers'][number]>): void => {
  step.value = { ...step.value, approvers: step.value.approvers.map((a, j) => (j === i ? { ...a, ...patch } : a)) }
}

const removeApprover = (i: number): void => {
  step.value = { ...step.value, approvers: step.value.approvers.filter((_, j) => j !== i) }
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">{{ step.sequence }}</span>
      <div class="min-w-[12rem] flex-1">
        <FormInput v-model="step.name" placeholder="Nombre del nivel (p. ej. Jefe directo)" size="sm" />
      </div>
      <div class="flex items-center gap-1">
        <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" :disabled="index === 0" aria-label="Subir" @click="emit('move', -1)">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
        </button>
        <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" :disabled="index === total - 1" aria-label="Bajar" @click="emit('move', 1)">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar nivel" @click="emit('remove')">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
      <FormInput
        v-model="step.sequence"
        label="Secuencia"
        type="number"
        min="1"
        size="sm"
        hint="Igual secuencia = en paralelo"
        @update:model-value="step.sequence = Math.max(1, Number($event) || 1)"
      />
      <FormSelect v-model="step.mode" label="Modo" :options="modeOptions" size="sm" />
      <FormInput
        v-if="step.mode === 'quorum'"
        :model-value="step.quorum ?? ''"
        label="Mínimo"
        type="number"
        min="1"
        size="sm"
        @update:model-value="step.quorum = $event === '' ? null : Number($event)"
      />
      <FormInput
        :model-value="step.sla_days ?? ''"
        label="Plazo (días hábiles)"
        type="number"
        min="1"
        size="sm"
        placeholder="Sin plazo"
        @update:model-value="step.sla_days = $event === '' ? null : Number($event)"
      />
    </div>

    <label class="mt-3 flex items-center gap-2 text-sm text-slate-700">
      <input v-model="step.informative" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600">
      Solo informativo (se avisa, pero no bloquea)
    </label>

    <div class="mt-4">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Aprobadores del nivel</p>
      <div v-for="(a, i) in step.approvers" :key="i" class="mb-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_2rem] md:items-center">
        <FormSelect :model-value="a.kind" :options="kindOptions" size="sm" @update:model-value="updateApprover(i, { kind: $event as ApprovalApproverKind, approval_manager_id: null })" />
        <FormSelect
          v-if="a.kind === 'manager'"
          :model-value="a.approval_manager_id ?? ''"
          :options="managerOptions"
          placeholder="Elige al aprobador"
          searchable
          size="sm"
          @update:model-value="updateApprover(i, { approval_manager_id: String($event || '') || null })"
        />
        <span v-else class="text-xs text-slate-500">Se resuelve al enviar cada solicitud</span>
        <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar aprobador" @click="removeApprover(i)">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="addApprover">+ Agregar aprobador</button>
    </div>

    <div class="mt-4">
      <ApprovalFlowConditionEditor v-model="step.condition" :field-options="conditionFieldOptions" />
    </div>
  </div>
</template>
