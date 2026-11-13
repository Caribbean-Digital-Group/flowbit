<script setup lang="ts">
import type { ApprovalLineDraft } from '~/composables/useApprovalRequest'
import { formatMoneyMx } from '~/utils/approvals'

interface Props {
  readonly?: boolean
  currency?: string
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  currency: 'MXN'
})

const lines = defineModel<ApprovalLineDraft[]>({ required: true })

const total = computed(() =>
  lines.value.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0))

const addLine = (): void => {
  lines.value = [...lines.value, { concept: '', quantity: 1, unit_price: 0 }]
}

const removeLine = (index: number): void => {
  lines.value = lines.value.filter((_, i) => i !== index)
}

const updateLine = (index: number, patch: Partial<ApprovalLineDraft>): void => {
  lines.value = lines.value.map((l, i) => (i === index ? { ...l, ...patch } : l))
}

const subtotal = (line: ApprovalLineDraft): string =>
  formatMoneyMx((Number(line.quantity) || 0) * (Number(line.unit_price) || 0), props.currency)
</script>

<template>
  <div class="space-y-3">
    <div class="hidden md:grid grid-cols-[1fr_7rem_9rem_9rem_2.5rem] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <span>Concepto</span><span>Cantidad</span><span>Precio unitario</span><span class="text-right">Subtotal</span><span />
    </div>
    <div
      v-for="(line, index) in lines"
      :key="index"
      class="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[1fr_7rem_9rem_9rem_2.5rem] md:items-center md:border-0 md:bg-transparent md:p-0"
    >
      <FormInput
        :model-value="line.concept"
        placeholder="Concepto"
        :readonly="readonly"
        size="sm"
        @update:model-value="updateLine(index, { concept: String($event) })"
      />
      <FormInput
        :model-value="line.quantity"
        type="number"
        min="0"
        step="0.001"
        :readonly="readonly"
        size="sm"
        @update:model-value="updateLine(index, { quantity: Number($event) })"
      />
      <FormInput
        :model-value="line.unit_price"
        type="number"
        min="0"
        step="0.01"
        :readonly="readonly"
        size="sm"
        @update:model-value="updateLine(index, { unit_price: Number($event) })"
      />
      <p class="text-right text-sm font-semibold text-slate-800 tabular-nums">{{ subtotal(line) }}</p>
      <button
        v-if="!readonly"
        type="button"
        class="justify-self-end rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Quitar partida"
        @click="removeLine(index)"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <p v-if="!lines.length" class="text-sm text-slate-500">Sin partidas.</p>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
      <BtnApp v-if="!readonly" variant="ghost" size="sm" label="Agregar partida" @click="addLine" />
      <p class="ml-auto text-sm text-slate-600">
        Total: <span class="text-base font-bold text-slate-900 tabular-nums">{{ formatMoneyMx(total, currency) }}</span>
      </p>
    </div>
  </div>
</template>
