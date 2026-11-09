<script setup lang="ts">
import type { ApprovalCondition, ApprovalConditionOp, ApprovalConditionRule } from '~/types/approval.types'
import { APPROVAL_CONDITION_OP_OPTIONS, describeCondition, operatorNeedsValue } from '~/utils/approvals'

type Option = {
  value: string
  label: string
}

interface Props {
  fieldOptions: Option[]
}

const props = defineProps<Props>()
const condition = defineModel<ApprovalCondition | null>({ required: true })

const enabled = computed(() => condition.value !== null)

const toggle = (on: boolean): void => {
  condition.value = on ? { match: 'all', rules: [{ field: 'amount', op: 'gte', value: '' }] } : null
}

const update = (index: number, patch: Partial<ApprovalConditionRule>): void => {
  if (!condition.value) return
  const rules = condition.value.rules.map((r, i) => (i === index ? { ...r, ...patch } : r))
  condition.value = { ...condition.value, rules }
}

const addRule = (): void => {
  if (!condition.value) return
  condition.value = { ...condition.value, rules: [...condition.value.rules, { field: 'amount', op: 'gte', value: '' }] }
}

const removeRule = (index: number): void => {
  if (!condition.value) return
  const rules = condition.value.rules.filter((_, i) => i !== index)
  condition.value = rules.length ? { ...condition.value, rules } : null
}

const valueText = (rule: ApprovalConditionRule, part?: 0 | 1): string => {
  const v = rule.value
  if (part !== undefined) return Array.isArray(v) ? String(v[part] ?? '') : ''
  return Array.isArray(v) ? v.join(', ') : String(v ?? '')
}

const setBetween = (index: number, rule: ApprovalConditionRule, part: 0 | 1, value: string | number): void => {
  const current = Array.isArray(rule.value) ? [...rule.value] : ['', '']
  current[part] = value === '' ? '' : Number(value)
  update(index, { value: current })
}

const labels = computed(() => Object.fromEntries(props.fieldOptions.map(o => [o.value, o.label.replace(/^Campo: /, '')])))
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
    <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
      <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" :checked="enabled" @change="toggle(($event.target as HTMLInputElement).checked)">
      Este nivel aplica solo si se cumple una condición
    </label>
    <template v-if="condition">
      <div class="mt-3 flex items-center gap-2 text-xs text-slate-600">
        Se cumple cuando
        <select
          class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
          :value="condition.match"
          @change="condition = { ...condition!, match: ($event.target as HTMLSelectElement).value as 'all' | 'any' }"
        >
          <option value="all">todas</option>
          <option value="any">alguna</option>
        </select>
        las reglas son verdaderas:
      </div>
      <div v-for="(rule, index) in condition.rules" :key="index" class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_2rem] md:items-center">
        <FormSelect :model-value="rule.field" :options="fieldOptions" size="sm" @update:model-value="update(index, { field: String($event) })" />
        <FormSelect :model-value="rule.op" :options="APPROVAL_CONDITION_OP_OPTIONS" size="sm" @update:model-value="update(index, { op: $event as ApprovalConditionOp, value: $event === 'between' ? ['', ''] : rule.value })" />
        <div v-if="rule.op === 'between'" class="grid grid-cols-2 gap-2">
          <FormInput :model-value="valueText(rule, 0)" type="number" size="sm" placeholder="Desde" @update:model-value="setBetween(index, rule, 0, $event)" />
          <FormInput :model-value="valueText(rule, 1)" type="number" size="sm" placeholder="Hasta" @update:model-value="setBetween(index, rule, 1, $event)" />
        </div>
        <FormInput
          v-else-if="operatorNeedsValue(rule.op)"
          :model-value="valueText(rule)"
          size="sm"
          :placeholder="rule.op === 'in' || rule.op === 'not_in' ? 'Valores separados por coma' : 'Valor'"
          @update:model-value="update(index, { value: String($event) })"
        />
        <span v-else />
        <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar regla" @click="removeRule(index)">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2">
        <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="addRule">+ Agregar regla</button>
        <p class="text-xs italic text-slate-500">{{ describeCondition(condition, labels) }}</p>
      </div>
    </template>
  </div>
</template>
