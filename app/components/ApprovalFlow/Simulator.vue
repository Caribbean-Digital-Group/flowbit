<script setup lang="ts">
import type { ApprovalCategoryRow, ApprovalFieldValues, ApprovalPlanStep, ApprovalPriority } from '~/types/approval.types'
import { APPROVAL_PRIORITY_OPTIONS } from '~/utils/approvals'

type Option = {
  value: string
  label: string
}

interface Props {
  companyId: string
  categories: ApprovalCategoryRow[]
  requesterOptions: Option[]
  lookups?: Record<'partner' | 'employee' | 'product', Option[]>
  /** Nota cuando el flujo editado tiene cambios sin guardar. */
  dirty?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lookups: () => ({ partner: [], employee: [], product: [] }),
  dirty: false
})

const { simulate, lastError } = useApprovalFlow()

const categoryId = ref(props.categories[0]?.id ?? '')
const requester = ref('')
const amount = ref<string | number>('')
const priority = ref<ApprovalPriority>('normal')
const fieldValues = ref<ApprovalFieldValues>({})
const result = ref<ApprovalPlanStep[] | null>(null)
const loading = ref(false)

watch(() => props.categories, (cats) => {
  if (!categoryId.value && cats[0]) categoryId.value = cats[0].id
})

const schema = computed(() => props.categories.find(c => c.id === categoryId.value)?.field_schema ?? [])
const categoryOptions = computed(() => props.categories.map(c => ({ value: c.id, label: c.name })))

const run = async (): Promise<void> => {
  if (!categoryId.value || !requester.value) return
  loading.value = true
  try {
    result.value = await simulate({
      companyId: props.companyId,
      categoryId: categoryId.value,
      requesterPartnerId: requester.value,
      amount: amount.value === '' ? null : Number(amount.value),
      fieldValues: fieldValues.value,
      priority: priority.value
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
    <h3 class="text-sm font-bold text-slate-800">Simulador</h3>
    <p class="mb-4 text-xs text-slate-500">Prueba con datos hipotéticos qué niveles y personas resultarían. No crea nada.</p>
    <p v-if="dirty" class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Guarda los cambios del flujo para simular la versión nueva.</p>
    <div class="space-y-3">
      <FormSelect v-model="categoryId" label="Categoría" :options="categoryOptions" size="sm" />
      <FormSelect v-model="requester" label="Solicitante" :options="requesterOptions" searchable size="sm" placeholder="Elige a una persona" />
      <div class="grid grid-cols-2 gap-3">
        <FormInput v-model="amount" label="Monto" type="number" min="0" step="0.01" size="sm" />
        <FormSelect v-model="priority" label="Prioridad" :options="APPROVAL_PRIORITY_OPTIONS" size="sm" />
      </div>
      <ApprovalRequestDynamicFields v-if="schema.length" v-model="fieldValues" :schema="schema" :lookups="lookups" />
      <BtnApp label="Simular" size="sm" block :loading="loading" :disabled="!categoryId || !requester" @click="run" />
    </div>
    <p v-if="lastError" class="mt-3 text-xs text-red-600">{{ lastError }}</p>
    <div v-if="result" class="mt-4">
      <ApprovalRequestFlowPreview :steps="result" title="Resultado" />
    </div>
  </div>
</template>
