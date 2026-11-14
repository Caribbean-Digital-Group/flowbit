<script lang="ts">
import type { ExpenseRow, ExpenseStatus } from '~/types/expense.types'

export interface ExpenseFormData {
  expense_date: string
  description: string
  category_id: string
  partner_id: string
  project_id: string
  payment_method_id: string
  amount: string | number
  tax_amount: string | number
  currency: string
  reference: string
  notes: string
  status: ExpenseStatus
  paid_at: string
}

export type ExpenseFormOption = { value: string; label: string }

export const createEmptyExpenseForm = (currency = 'MXN'): ExpenseFormData => ({
  expense_date: todayIn(),
  description: '',
  category_id: '',
  partner_id: '',
  project_id: '',
  payment_method_id: '',
  amount: '',
  tax_amount: 0,
  currency,
  reference: '',
  notes: '',
  status: 'draft',
  paid_at: ''
})

export const mapExpenseToForm = (row: ExpenseRow): ExpenseFormData => ({
  expense_date: row.expense_date,
  description: row.description,
  category_id: row.category_id ?? '',
  partner_id: row.partner_id ?? '',
  project_id: row.project_id ?? '',
  payment_method_id: row.payment_method_id ?? '',
  amount: row.amount,
  tax_amount: row.tax_amount ?? 0,
  currency: row.currency ?? 'MXN',
  reference: row.reference ?? '',
  notes: row.notes ?? '',
  status: row.status,
  paid_at: row.paid_at ?? ''
})

/** Convierte el formulario en columnas de `expense`. El trigger ajusta `paid_at` según el estado. */
export const mapFormToExpense = (form: ExpenseFormData) => ({
  expense_date: form.expense_date,
  description: form.description.trim(),
  category_id: form.category_id || null,
  partner_id: form.partner_id || null,
  project_id: form.project_id || null,
  payment_method_id: form.payment_method_id || null,
  amount: toNumberOrNull(form.amount) ?? 0,
  tax_amount: toNumberOrNull(form.tax_amount) ?? 0,
  currency: trimToNull(form.currency)?.toUpperCase() ?? null,
  reference: trimToNull(form.reference),
  notes: trimToNull(form.notes),
  status: form.status,
  paid_at: form.status === 'paid' ? (form.paid_at || null) : null
})

/** Devuelve el mensaje de error, o `null` si el formulario es válido. */
export const validateExpenseForm = (form: ExpenseFormData): string | null => {
  if (!form.description.trim()) return 'La descripción es obligatoria.'
  if (!form.expense_date) return 'Indica la fecha del gasto.'
  const amount = toNumberOrNull(form.amount)
  if (amount === null || amount < 0) return 'El importe debe ser un número mayor o igual a cero.'
  const tax = toNumberOrNull(form.tax_amount)
  if (tax !== null && tax < 0) return 'Los impuestos no pueden ser negativos.'
  if (form.status === 'paid' && form.paid_at && form.paid_at < form.expense_date) {
    return 'La fecha de pago no puede ser anterior a la fecha del gasto.'
  }
  return null
}
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  categoryOptions?: ExpenseFormOption[]
  partnerOptions?: ExpenseFormOption[]
  projectOptions?: ExpenseFormOption[]
  paymentMethodOptions?: ExpenseFormOption[]
}

withDefaults(defineProps<Props>(), {
  readonly: false,
  categoryOptions: () => [],
  partnerOptions: () => [],
  projectOptions: () => [],
  paymentMethodOptions: () => []
})

const formData = defineModel<ExpenseFormData>({ required: true })

const total = computed(() => expenseTotal(toNumberOrNull(formData.value.amount), toNumberOrNull(formData.value.tax_amount)))

const formattedTotal = computed(() => {
  const currency = formData.value.currency?.trim().toUpperCase() || 'MXN'
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(total.value)
  } catch {
    return `${total.value.toFixed(2)} ${currency}`
  }
})

/** Sugiere el IVA general (16 %) sobre el subtotal. */
const applyVat = () => {
  const amount = toNumberOrNull(formData.value.amount) ?? 0
  formData.value.tax_amount = roundMoney(amount * 0.16)
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <FormInput
          v-model="formData.description"
          label="Descripción"
          placeholder="Ej: Renta de oficina de marzo"
          :readonly="readonly"
          required
          size="md"
        />
      </div>
      <FormInput
        v-model="formData.expense_date"
        type="date"
        label="Fecha del gasto"
        :readonly="readonly"
        required
        size="md"
      />
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <FormSelect
        v-model="formData.category_id"
        label="Categoría"
        :options="categoryOptions"
        :disabled="readonly"
        placeholder="Sin categoría"
        searchable
        clearable
        size="md"
      />
      <FormSelect
        v-model="formData.partner_id"
        label="Proveedor"
        :options="partnerOptions"
        :disabled="readonly"
        placeholder="Sin proveedor"
        searchable
        clearable
        size="md"
      />
      <FormSelect
        v-model="formData.project_id"
        label="Proyecto"
        :options="projectOptions"
        :disabled="readonly"
        placeholder="Sin proyecto"
        searchable
        clearable
        size="md"
      />
      <FormSelect
        v-model="formData.payment_method_id"
        label="Método de pago"
        :options="paymentMethodOptions"
        :disabled="readonly"
        placeholder="Sin método"
        clearable
        size="md"
      />
    </div>

    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <FormInput
        v-model="formData.amount"
        type="number"
        step="0.01"
        min="0"
        label="Subtotal"
        :readonly="readonly"
        required
        size="md"
      />
      <div>
        <FormInput
          v-model="formData.tax_amount"
          type="number"
          step="0.01"
          min="0"
          label="Impuestos (IVA)"
          :readonly="readonly"
          size="md"
        />
        <button
          v-if="!readonly"
          type="button"
          class="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          @click="applyVat"
        >
          Calcular IVA 16 %
        </button>
      </div>
      <FormInput
        v-model="formData.currency"
        label="Moneda"
        placeholder="MXN"
        :maxlength="3"
        :readonly="readonly"
        size="md"
      />
      <div class="rounded-xl bg-slate-50 px-4 py-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
        <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">{{ formattedTotal }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <FormSelect
        v-model="formData.status"
        label="Estado"
        :options="EXPENSE_STATUS_OPTIONS"
        :disabled="readonly"
        size="md"
      />
      <FormInput
        v-if="formData.status === 'paid'"
        v-model="formData.paid_at"
        type="date"
        label="Fecha de pago"
        hint="Si la dejas vacía se usa la fecha del gasto."
        :readonly="readonly"
        size="md"
      />
      <FormInput
        v-model="formData.reference"
        label="Folio o comprobante"
        placeholder="Ej: Factura A-1234"
        :readonly="readonly"
        size="md"
      />
    </div>

    <FormTextArea
      v-model="formData.notes"
      label="Notas"
      placeholder="Detalles adicionales del gasto..."
      :readonly="readonly"
      :rows="3"
      size="md"
    />

    <p class="text-xs text-slate-500">
      Solo los gastos en estado «Pagado» cuentan en el estado de resultados, en el mes de su fecha de pago.
    </p>
  </div>
</template>
