<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { ExpenseRow, ExpenseStatus } from '~/types/expense.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getByCompany, setStatus, archive, lastError } = useExpense()
const lookups = useExpenseLookups()
const { categoryOptions } = lookups

type StatusFilter = ExpenseStatus | 'all'

type ExpenseListRow = {
  id: string
  expense_date: string
  description: string
  category: string
  partner: string
  project: string
  payment_method: string
  reference: string
  amount: number
  tax_amount: number
  total: number
  currency: string
  status: ExpenseStatus
}

const rows = ref<ExpenseRow[]>([])
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const queryString = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

const statusFilter = ref<StatusFilter>(isExpenseStatus(queryString(route.query.status)) ? queryString(route.query.status) as ExpenseStatus : 'all')
const categoryFilter = ref<string>(queryString(route.query.category))
const fromFilter = ref<string>(queryString(route.query.from))
const toFilter = ref<string>(queryString(route.query.to))

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  ...EXPENSE_STATUS_OPTIONS
]

const columns = [
  { key: 'expense_date', label: 'Fecha', type: 'date' as const },
  { key: 'description', label: 'Descripción' },
  { key: 'category', label: 'Categoría' },
  { key: 'partner', label: 'Proveedor' },
  { key: 'reference', label: 'Folio' },
  { key: 'total', label: 'Total', type: 'currency' as const, currencyKey: 'currency', align: 'right' as const },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge' as const,
    badgeConfig: { labels: EXPENSE_STATUS_LABELS, colors: EXPENSE_STATUS_BADGE_CLASSES }
  },
  { key: 'project', label: 'Proyecto' },
  { key: 'payment_method', label: 'Método de pago' }
]

const items = computed<ExpenseListRow[]>(() => {
  const categories = new Map(lookups.categories.value.map(c => [c.id, c.name]))
  const partners = lookups.labelMap(lookups.partnerOptions.value)
  const projects = lookups.labelMap(lookups.projectOptions.value)
  const methods = lookups.labelMap(lookups.paymentMethodOptions.value)
  const fallbackCurrency = selectedCompany.value?.currency || 'MXN'

  return rows.value.map(r => ({
    id: r.id,
    expense_date: r.expense_date,
    description: r.description,
    category: (r.category_id && categories.get(r.category_id)) || EXPENSE_UNCATEGORIZED_LABEL,
    partner: (r.partner_id && partners.get(r.partner_id)) || '—',
    project: (r.project_id && projects.get(r.project_id)) || '—',
    payment_method: (r.payment_method_id && methods.get(r.payment_method_id)) || '—',
    reference: r.reference ?? '—',
    amount: Number(r.amount) || 0,
    tax_amount: Number(r.tax_amount) || 0,
    total: expenseTotal(r.amount, r.tax_amount),
    currency: r.currency || fallbackCurrency,
    status: r.status
  }))
})

const money = (value: number, currency = selectedCompany.value?.currency || 'MXN'): string => {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

const summary = computed(() => {
  const totals: Record<ExpenseStatus, number> = { draft: 0, approved: 0, paid: 0, cancelled: 0 }
  for (const item of items.value) totals[item.status] = roundMoney(totals[item.status] + item.total)
  return [
    { label: 'Pagado', value: money(totals.paid), tone: 'text-emerald-600' },
    { label: 'Aprobado por pagar', value: money(totals.approved), tone: 'text-amber-600' },
    { label: 'En borrador', value: money(totals.draft), tone: 'text-slate-700' },
    { label: 'Gastos en la vista', value: String(items.value.length), tone: 'text-indigo-600' }
  ]
})

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { rows.value = []; return }
  if (fromFilter.value && toFilter.value && toFilter.value < fromFilter.value) {
    errorMessage.value = 'La fecha final debe ser posterior a la inicial.'
    return
  }
  isLoading.value = true
  errorMessage.value = null
  try {
    rows.value = await getByCompany(cid, {
      from: fromFilter.value || undefined,
      to: toFilter.value || undefined,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      categoryId: categoryFilter.value || undefined
    })
    if (lastError.value) errorMessage.value = lastError.value
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, (cid) => { void lookups.load(cid) }, { immediate: true })
watch([selectedCompanyId, statusFilter, categoryFilter, fromFilter, toFilter], () => { void load() }, { immediate: true })

const clearFilters = () => {
  statusFilter.value = 'all'
  categoryFilter.value = ''
  fromFilter.value = ''
  toFilter.value = ''
}

const hasFilters = computed(() =>
  statusFilter.value !== 'all' || !!categoryFilter.value || !!fromFilter.value || !!toFilter.value
)

const handleCreate = () => router.push('/admin/expenses/create')
// El slot de Datatable entrega filas genéricas; solo se usan id y estado.
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/expenses/${String(row.id)}`)

const handleMarkPaid = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const result = await setStatus(String(row.id), cid, 'paid')
  if (!result) { errorMessage.value = lastError.value ?? 'No se pudo marcar como pagado.'; return }
  await load()
}

const handleRemove = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="card in summary"
        :key="card.label"
        class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50"
      >
        <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
        <p class="mt-1 text-xl font-bold tabular-nums" :class="card.tone">{{ card.value }}</p>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <FormSelect v-model="statusFilter" label="Estado" :options="statusFilterOptions" size="sm" />
        <FormSelect
          v-model="categoryFilter"
          label="Categoría"
          :options="categoryOptions"
          placeholder="Todas"
          searchable
          clearable
          size="sm"
        />
        <FormInput v-model="fromFilter" type="date" label="Desde" size="sm" />
        <FormInput v-model="toFilter" type="date" label="Hasta" size="sm" />
        <div class="flex gap-3 lg:justify-end">
          <BtnApp v-if="hasFilters" variant="ghost" size="sm" label="Limpiar filtros" @click="clearFilters" />
          <NuxtLink
            to="/admin/reports/profit-loss"
            class="self-center text-sm font-medium text-indigo-600 hover:underline"
          >
            Estado de resultados
          </NuxtLink>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <Datatable
      title="Gastos"
      description="Renta, servicios, publicidad y demás gastos de operación. Solo los pagados cuentan en el estado de resultados."
      :data="items"
      :columns="columns"
      :is-loading="isLoading"
      :search-keys="['description', 'category', 'partner', 'project', 'reference']"
      :creatable="!!selectedCompanyId"
      create-label="Nuevo gasto"
      export-filename="gastos"
      @create="handleCreate"
    >
      <template #actions="{ row }">
        <button
          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          @click="handleEdit(row)"
        >
          Ver
        </button>
        <button
          v-if="row.status === 'approved' || row.status === 'draft'"
          class="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors ml-3"
          @click="handleMarkPaid(row)"
        >
          Marcar pagado
        </button>
        <button
          class="text-xs text-red-500 hover:text-red-700 font-medium transition-colors ml-3"
          @click="handleRemove(row)"
        >
          Archivar
        </button>
      </template>
    </Datatable>
  </div>
</template>
