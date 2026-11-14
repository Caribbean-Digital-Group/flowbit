<script lang="ts">
import type { ExpenseCategoryRow } from '~/types/expense.types'

export interface ExpenseCategoryFormData {
  name: string
  description: string
  color: string
  active: boolean
}

export const createEmptyExpenseCategoryForm = (): ExpenseCategoryFormData => ({
  name: '',
  description: '',
  color: 'slate',
  active: true
})

export const mapExpenseCategoryToForm = (row: ExpenseCategoryRow): ExpenseCategoryFormData => ({
  name: row.name,
  description: row.description ?? '',
  color: row.color ?? 'slate',
  active: row.active ?? true
})

export const mapFormToExpenseCategory = (form: ExpenseCategoryFormData) => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  color: isExpenseCategoryColor(form.color) ? form.color : null,
  active: form.active
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), { readonly: false })

const formData = defineModel<ExpenseCategoryFormData>({ required: true })

const colorOptions = EXPENSE_CATEGORY_COLORS.map(value => ({
  value,
  label: EXPENSE_CATEGORY_COLOR_LABELS[value]
}))

const dotClass = computed(() =>
  isExpenseCategoryColor(formData.value.color)
    ? EXPENSE_CATEGORY_DOT_CLASSES[formData.value.color]
    : EXPENSE_CATEGORY_DOT_CLASSES.slate
)
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput
        v-model="formData.name"
        label="Nombre"
        placeholder="Ej: Renta, Servicios, Publicidad"
        :readonly="readonly"
        required
        size="md"
      />
      <div class="flex items-end gap-3">
        <div class="flex-1">
          <FormSelect
            v-model="formData.color"
            label="Color"
            :options="colorOptions"
            :disabled="readonly"
            size="md"
          />
        </div>
        <span class="mb-4 h-4 w-4 shrink-0 rounded-full" :class="dotClass" aria-hidden="true" />
      </div>
    </div>

    <FormTextArea
      v-model="formData.description"
      label="Descripción"
      placeholder="Qué gastos agrupa esta categoría..."
      :readonly="readonly"
      :rows="3"
      size="md"
    />

    <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <input
        v-model="formData.active"
        type="checkbox"
        :disabled="readonly"
        class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
      />
      <label class="text-sm text-slate-700 cursor-pointer select-none">Activa</label>
    </div>
  </div>
</template>
