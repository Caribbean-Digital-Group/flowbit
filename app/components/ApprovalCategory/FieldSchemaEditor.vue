<script setup lang="ts">
import type { ApprovalFieldDefinition, ApprovalFieldType } from '~/types/approval.types'
import { APPROVAL_FIELD_TYPE_OPTIONS, fieldSchemaIssues, toFieldKey } from '~/utils/approvals'

interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), { readonly: false })

const schema = defineModel<ApprovalFieldDefinition[]>({ required: true })

const issues = computed(() => fieldSchemaIssues(schema.value))

const add = (): void => {
  schema.value = [...schema.value, { key: '', label: '', type: 'text', required: false }]
}

const update = (index: number, patch: Partial<ApprovalFieldDefinition>): void => {
  schema.value = schema.value.map((f, i) => {
    if (i !== index) return f
    const next = { ...f, ...patch }
    // La clave se propone a partir del nombre mientras no se haya editado a mano
    if (patch.label !== undefined && (!f.key || f.key === toFieldKey(f.label))) next.key = toFieldKey(patch.label)
    return next
  })
}

const move = (index: number, direction: -1 | 1): void => {
  const target = index + direction
  if (target < 0 || target >= schema.value.length) return
  const list = [...schema.value]
  ;[list[index], list[target]] = [list[target]!, list[index]!]
  schema.value = list
}

const remove = (index: number): void => {
  schema.value = schema.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="!schema.length" class="text-sm text-slate-500">Sin campos adicionales: la solicitud usa asunto, monto y descripción.</p>
    <div
      v-for="(field, index) in schema"
      :key="index"
      class="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-start"
    >
      <FormInput :model-value="field.label" placeholder="Nombre del campo" size="sm" :readonly="readonly" @update:model-value="update(index, { label: String($event) })" />
      <FormInput :model-value="field.key" placeholder="clave" size="sm" :readonly="readonly" hint="Para condiciones: field.clave" @update:model-value="update(index, { key: String($event) })" />
      <FormSelect :model-value="field.type" :options="APPROVAL_FIELD_TYPE_OPTIONS" size="sm" :disabled="readonly" @update:model-value="update(index, { type: $event as ApprovalFieldType })" />
      <div class="flex items-center gap-2 pt-1.5">
        <label class="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" :checked="field.required" :disabled="readonly" @change="update(index, { required: ($event.target as HTMLInputElement).checked })">
          Obligatorio
        </label>
        <template v-if="!readonly">
          <button type="button" class="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Subir" @click="move(index, -1)">↑</button>
          <button type="button" class="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Bajar" @click="move(index, 1)">↓</button>
          <button type="button" class="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Quitar" @click="remove(index)">✕</button>
        </template>
      </div>
      <div v-if="field.type === 'select'" class="md:col-span-4">
        <FormInput
          :model-value="(field.options ?? []).join(', ')"
          placeholder="Opciones separadas por coma"
          size="sm"
          :readonly="readonly"
          @update:model-value="update(index, { options: String($event).split(',').map(o => o.trim()) })"
        />
      </div>
    </div>
    <div v-if="issues.length" class="space-y-1">
      <p v-for="issue in issues" :key="issue" class="text-xs text-amber-700">⚠️ {{ issue }}</p>
    </div>
    <BtnApp v-if="!readonly" variant="ghost" size="sm" label="Agregar campo" @click="add" />
  </div>
</template>
