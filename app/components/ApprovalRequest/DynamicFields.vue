<script setup lang="ts">
import type { ApprovalFieldDefinition, ApprovalFieldValues } from '~/types/approval.types'

type LookupOption = {
  value: string
  label: string
}

interface Props {
  schema: ApprovalFieldDefinition[]
  readonly?: boolean
  lookups?: Record<'partner' | 'employee' | 'product', LookupOption[]>
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  lookups: () => ({ partner: [], employee: [], product: [] })
})

const values = defineModel<ApprovalFieldValues>({ required: true })

const textValue = (key: string): string => {
  const v = values.value[key]
  return v === null || v === undefined || typeof v === 'object' ? '' : String(v)
}

const setValue = (key: string, value: string | number): void => {
  values.value = { ...values.value, [key]: value === '' ? null : value }
}

const rangeValue = (key: string): { from?: string; to?: string } => {
  const v = values.value[key]
  return v && typeof v === 'object' ? v : {}
}

const setRange = (key: string, part: 'from' | 'to', value: string | number): void => {
  values.value = { ...values.value, [key]: { ...rangeValue(key), [part]: String(value) || undefined } }
}

const selectOptions = (field: ApprovalFieldDefinition): LookupOption[] => {
  if (field.type === 'select') return (field.options ?? []).filter(o => o.trim()).map(o => ({ value: o, label: o }))
  if (field.type === 'partner' || field.type === 'employee' || field.type === 'product') return props.lookups[field.type]
  return []
}
</script>

<template>
  <div v-if="schema.length" class="grid grid-cols-1 gap-5 md:grid-cols-2">
    <div
      v-for="field in schema"
      :key="field.key"
      :class="field.type === 'textarea' || field.type === 'daterange' ? 'md:col-span-2' : ''"
    >
      <FormTextArea
        v-if="field.type === 'textarea'"
        :model-value="textValue(field.key)"
        :label="field.label"
        :required="field.required"
        :readonly="readonly"
        :hint="field.help"
        :rows="3"
        @update:model-value="setValue(field.key, $event)"
      />
      <div v-else-if="field.type === 'daterange'" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput
          :model-value="rangeValue(field.key).from ?? ''"
          :label="`${field.label} · desde`"
          type="date"
          :required="field.required"
          :readonly="readonly"
          @update:model-value="setRange(field.key, 'from', $event)"
        />
        <FormInput
          :model-value="rangeValue(field.key).to ?? ''"
          :label="`${field.label} · hasta`"
          type="date"
          :readonly="readonly"
          @update:model-value="setRange(field.key, 'to', $event)"
        />
      </div>
      <FormSelect
        v-else-if="['select', 'partner', 'employee', 'product'].includes(field.type)"
        :model-value="textValue(field.key)"
        :label="field.label"
        :options="selectOptions(field)"
        :required="field.required"
        :disabled="readonly"
        :hint="field.help"
        searchable
        clearable
        placeholder="Selecciona"
        @update:model-value="setValue(field.key, String($event ?? ''))"
      />
      <FormInput
        v-else
        :model-value="textValue(field.key)"
        :label="field.label"
        :type="field.type === 'number' || field.type === 'money' ? 'number' : field.type === 'date' ? 'date' : 'text'"
        :step="field.type === 'money' ? '0.01' : undefined"
        :required="field.required"
        :readonly="readonly"
        :hint="field.help"
        @update:model-value="setValue(field.key, field.type === 'number' || field.type === 'money' ? ($event === '' ? '' : Number($event)) : $event)"
      />
    </div>
  </div>
</template>
