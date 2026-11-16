<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { ExpenseCategoryRow } from '~/types/expense.types'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getByCompany, archive } = useExpenseCategory()

type CategoryListRow = {
  id: string
  name: string
  color: string
  description: string
  active: string
}

const items = ref<CategoryListRow[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'description', label: 'Descripción' },
  { key: 'active', label: 'Estado', type: 'badge' as const, badgeConfig: { labels: { active: 'Activa', inactive: 'Archivada' } } }
]

const mapRow = (r: ExpenseCategoryRow): CategoryListRow => ({
  id: r.id,
  name: r.name,
  color: r.color ?? 'slate',
  description: r.description ?? '—',
  active: r.active === false ? 'inactive' : 'active'
})

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    items.value = (await getByCompany(cid)).map(mapRow)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const dotClass = (color: unknown): string =>
  isExpenseCategoryColor(String(color)) ? EXPENSE_CATEGORY_DOT_CLASSES[String(color) as ExpenseCategoryColor] : EXPENSE_CATEGORY_DOT_CLASSES.slate

const handleCreate = () => router.push('/admin/expense-categories/create')
// El slot de Datatable entrega filas genéricas; solo se usa el id.
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/expense-categories/${String(row.id)}`)

const handleRemove = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <Datatable
    title="Categorías de gasto"
    description="Agrupa tus gastos (renta, servicios, publicidad…) para leer el estado de resultados por concepto."
    :data="items"
    :columns="columns"
    :is-loading="isLoading"
    :creatable="!!selectedCompanyId"
    create-label="Nueva categoría"
    export-filename="categorias-de-gasto"
    @create="handleCreate"
  >
    <template #cell-name="{ row }">
      <span class="inline-flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full" :class="dotClass(row.color)" aria-hidden="true" />
        <span class="font-medium text-slate-800">{{ row.name }}</span>
      </span>
    </template>
    <template #actions="{ row }">
      <button
        class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        @click="handleEdit(row)"
      >
        Ver
      </button>
      <button
        class="text-xs text-red-500 hover:text-red-700 font-medium transition-colors ml-3"
        @click="handleRemove(row)"
      >
        Archivar
      </button>
    </template>
  </Datatable>
</template>
