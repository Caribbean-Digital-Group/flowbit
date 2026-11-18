<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { StockCountCategoryOption, StockCountListItem } from '~/composables/useStockCount'
import { STOCK_COUNT_STATUS_LABELS } from '~/utils/stockCount'
import type { Tables } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

useHead({ title: 'Conteo físico · Inventario' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getCounts, getCategories, startCount, lastError } = useStockCount()
const { getWarehousesByCompany } = useWarehouse()

const isLoading = ref(false)
const counts = ref<StockCountListItem[]>([])
const warehouses = ref<Tables<'warehouse'>[]>([])
const categories = ref<StockCountCategoryOption[]>([])

const showStart = ref(false)
const isStarting = ref(false)
const startForm = reactive<{ warehouseId: string | null; categoryId: string | null; notes: string }>({
  warehouseId: null,
  categoryId: null,
  notes: ''
})

let request = 0
const load = async () => {
  const companyId = selectedCompanyId.value
  const requestId = ++request
  if (!companyId) {
    counts.value = []
    return
  }

  isLoading.value = true
  try {
    const [countList, warehouseList, categoryList] = await Promise.all([
      getCounts(companyId),
      getWarehousesByCompany(companyId),
      getCategories(companyId)
    ])
    if (requestId !== request) return
    counts.value = countList
    warehouses.value = warehouseList.filter((w) => w.active !== false)
    categories.value = categoryList
    if (!startForm.warehouseId) {
      startForm.warehouseId = warehouses.value.find((w) => w.is_default)?.id ?? warehouses.value[0]?.id ?? null
    }
  } finally {
    if (requestId === request) isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void load() }, { immediate: true })

const openWarehouseIds = computed(() => new Set(
  counts.value.filter((c) => c.status === 'in_progress').map((c) => c.warehouse_id)
))

const warehouseOptions = computed(() => warehouses.value.map((w) => ({
  value: w.id,
  label: openWarehouseIds.value.has(w.id) ? `${w.name} (conteo en curso)` : w.name
})))

const categoryOptions = computed(() => [
  { value: null, label: 'Todas las categorías' },
  ...categories.value.map((c) => ({ value: c.id, label: c.name }))
])

const selectedWarehouseBusy = computed(() =>
  !!startForm.warehouseId && openWarehouseIds.value.has(startForm.warehouseId)
)

const handleStart = async () => {
  if (!startForm.warehouseId || selectedWarehouseBusy.value) return
  isStarting.value = true
  try {
    const id = await startCount(startForm.warehouseId, startForm.categoryId, startForm.notes.trim() || null)
    if (id) await navigateTo(`/admin/inventory/counts/${id}`)
  } finally {
    isStarting.value = false
  }
}

const dateTime = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—'

const columns: Column[] = [
  { key: 'reference', label: 'Folio', sortable: true },
  { key: 'warehouseName', label: 'Almacén', sortable: true },
  { key: 'categoryLabel', label: 'Alcance', sortable: true },
  {
    key: 'status',
    label: 'Estado',
    sortable: true,
    type: 'badge',
    badgeConfig: {
      labels: STOCK_COUNT_STATUS_LABELS,
      colors: {
        in_progress: 'bg-amber-100 text-amber-700',
        applied: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-slate-100 text-slate-600'
      }
    }
  },
  { key: 'progressLabel', label: 'Avance', align: 'right' },
  { key: 'startedLabel', label: 'Iniciado', sortable: true }
]

const rows = computed(() => counts.value.map((c) => ({
  ...c,
  categoryLabel: c.categoryName ?? 'Todo el almacén',
  progressLabel: `${c.countedLines} / ${c.totalLines}`,
  startedLabel: dateTime(c.started_at)
})))
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink to="/admin/inventory" class="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
        ← Inventario
      </NuxtLink>
      <h1 class="mt-1 text-2xl font-bold text-slate-800">Conteo físico</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-500">
        Cuenta lo que hay en el almacén, compara contra la existencia del sistema y ajusta todas las diferencias en un solo paso.
        La existencia esperada se congela al iniciar: lo que se venda mientras cuentas no se pierde.
      </p>
    </div>

    <div
      v-if="lastError"
      class="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-4 text-sm text-rose-900"
      role="alert"
    >
      {{ lastError }}
    </div>

    <section
      v-if="showStart"
      class="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/50"
      aria-labelledby="start-count-title"
    >
      <h2 id="start-count-title" class="text-lg font-bold text-slate-800">Iniciar un conteo</h2>
      <p class="mt-1 text-sm text-slate-500">
        Se toma una foto de la existencia actual de cada producto inventariable del almacén. Después capturas lo que cuentas, desde la computadora o el celular.
      </p>

      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <FormSelect
          v-model="startForm.warehouseId"
          label="Almacén"
          :options="warehouseOptions"
          required
          placeholder="Elige un almacén"
          :error="selectedWarehouseBusy ? 'Este almacén ya tiene un conteo en curso.' : undefined"
        />
        <FormSelect
          v-model="startForm.categoryId"
          label="Categoría (opcional)"
          :options="categoryOptions"
          hint="Para conteos cíclicos: cuenta una categoría a la vez."
        />
        <div class="md:col-span-2">
          <FormTextArea
            v-model="startForm.notes"
            label="Notas (opcional)"
            placeholder="Ej. Cierre de mes, pasillos 1 a 4"
            :rows="2"
          />
        </div>
      </div>

      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <BtnApp variant="ghost" size="md" :disabled="isStarting" @click="showStart = false">
          Cancelar
        </BtnApp>
        <BtnApp
          variant="primary"
          size="md"
          :disabled="isStarting || !startForm.warehouseId || selectedWarehouseBusy"
          @click="handleStart"
        >
          {{ isStarting ? 'Iniciando…' : 'Iniciar conteo' }}
        </BtnApp>
      </div>
    </section>

    <div
      v-if="!isLoading && warehouses.length === 0"
      class="rounded-2xl bg-white p-10 text-center shadow-lg shadow-slate-200/50"
    >
      <p class="text-lg font-semibold text-slate-800">Primero crea un almacén</p>
      <p class="mt-1 text-sm text-slate-500">El conteo se hace por almacén.</p>
      <NuxtLink to="/admin/warehouses" class="mt-4 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900">
        Ir a Almacenes
      </NuxtLink>
    </div>

    <Datatable
      v-else
      title="Conteos"
      description="Conteos en curso, aplicados y cancelados."
      :data="rows"
      :columns="columns"
      :search-keys="['reference', 'warehouseName', 'categoryLabel']"
      :creatable="!showStart"
      create-label="Nuevo conteo"
      export-filename="conteos-fisicos"
      empty-title="Aún no hay conteos"
      empty-message="Inicia tu primer conteo para comparar el almacén contra el sistema."
      @create="showStart = true"
      @row-click="(row) => navigateTo(`/admin/inventory/counts/${row.id}`)"
    />
  </div>
</template>
