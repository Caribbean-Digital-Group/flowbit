<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import {
  groupBySupplier,
  type RestockSeverity,
  type RestockSuggestion,
  type SupplierGroup
} from '~/utils/restock'

definePageMeta({ layout: 'admin' })

useHead({ title: 'Por reabastecer · Inventario' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getSuggestions, createPurchaseOrders } = useRestock()

const isLoading = ref(false)
const isCreating = ref(false)
const suggestions = ref<RestockSuggestion[]>([])
const selectedIds = ref<Set<string>>(new Set())
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const createdOrders = ref<{ orderId: string; supplierName: string }[]>([])

let request = 0
const load = async () => {
  const companyId = selectedCompanyId.value
  const requestId = ++request
  if (!companyId) {
    suggestions.value = []
    return
  }

  isLoading.value = true
  errorMessage.value = null
  try {
    const data = await getSuggestions(companyId)
    if (requestId !== request) return
    suggestions.value = data
    selectedIds.value = new Set(data.filter((s) => s.supplierId).map((s) => s.productId))
  } finally {
    if (requestId === request) isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void load() }, { immediate: true })

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0)

const units = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(value ?? 0)

const SEVERITY_LABELS: Record<RestockSeverity, string> = {
  negative: 'Negativo',
  out: 'Agotado',
  low: 'Bajo mínimo'
}

const SEVERITY_CLASSES: Record<RestockSeverity, string> = {
  negative: 'bg-rose-100 text-rose-700',
  out: 'bg-amber-100 text-amber-800',
  low: 'bg-sky-100 text-sky-700'
}

const groups = computed<SupplierGroup[]>(() => groupBySupplier(suggestions.value))

const selectedGroups = computed<SupplierGroup[]>(() =>
  groupBySupplier(suggestions.value.filter((s) => s.supplierId && selectedIds.value.has(s.productId)))
)

const withoutSupplierCount = computed(() => suggestions.value.filter((s) => !s.supplierId).length)

const stats = computed(() => [
  {
    label: 'Productos por reabastecer',
    value: String(suggestions.value.length),
    trend: 'neutral' as const
  },
  {
    label: 'Proveedores',
    value: String(groups.value.filter((g) => g.supplierId).length),
    change: withoutSupplierCount.value ? `${withoutSupplierCount.value} sin proveedor` : undefined,
    trend: withoutSupplierCount.value ? ('down' as const) : ('neutral' as const)
  },
  {
    label: 'Costo estimado',
    value: money(suggestions.value.reduce((sum, s) => sum + s.estimatedCost, 0)),
    trend: 'neutral' as const
  }
])

const columns: Column[] = [
  { key: 'name', label: 'Producto', sortable: true },
  { key: 'severity', label: 'Estado', sortable: true },
  { key: 'onHand', label: 'Existencia', sortable: true, align: 'right' },
  { key: 'reserved', label: 'Reservado', sortable: true, align: 'right' },
  { key: 'available', label: 'Disponible', sortable: true, align: 'right' },
  { key: 'stockMin', label: 'Mínimo', sortable: true, align: 'right' },
  { key: 'suggestedQuantity', label: 'Sugerido', sortable: true, align: 'right' },
  { key: 'estimatedCost', label: 'Costo estimado', sortable: true, type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'supplierName', label: 'Proveedor habitual', sortable: true }
]

const tableRows = computed(() => suggestions.value.map((s) => ({ ...s, id: s.productId })))

const isSelected = (productId: string): boolean => selectedIds.value.has(productId)

const toggle = (productId: string) => {
  const next = new Set(selectedIds.value)
  if (next.has(productId)) next.delete(productId)
  else next.add(productId)
  selectedIds.value = next
}

const toggleGroup = (group: SupplierGroup) => {
  const next = new Set(selectedIds.value)
  const allSelected = group.items.every((item) => next.has(item.productId))
  for (const item of group.items) {
    if (allSelected) next.delete(item.productId)
    else next.add(item.productId)
  }
  selectedIds.value = next
}

const handleCreateOrders = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || selectedGroups.value.length === 0) return

  isCreating.value = true
  errorMessage.value = null
  successMessage.value = null
  createdOrders.value = []
  try {
    const result = await createPurchaseOrders(companyId, selectedGroups.value)
    createdOrders.value = result.created
    if (result.created.length > 0) {
      const count = result.created.length
      successMessage.value = count === 1
        ? 'Se creó 1 orden de compra en borrador. Revisa precios y cantidades antes de confirmarla.'
        : `Se crearon ${count} órdenes de compra en borrador. Revisa precios y cantidades antes de confirmarlas.`
    }
    if (result.failed.length > 0) {
      errorMessage.value = result.failed.map((f) => `${f.supplierName}: ${f.reason}`).join(' ')
    }
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <NuxtLink to="/admin/inventory" class="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
          ← Inventario
        </NuxtLink>
        <h1 class="mt-1 text-2xl font-bold text-slate-800">Por reabastecer</h1>
        <p class="mt-1 text-sm text-slate-500">
          Productos cuyo disponible (existencia menos reservado) está por debajo del mínimo, con la cantidad sugerida para volver al máximo.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BtnApp variant="secondary" size="md" :disabled="isLoading" @click="load">
          Actualizar
        </BtnApp>
        <BtnApp
          variant="primary"
          size="md"
          :disabled="isCreating || isLoading || selectedGroups.length === 0"
          @click="handleCreateOrders"
        >
          {{ isCreating ? 'Creando órdenes…' : `Crear órdenes de compra (${selectedGroups.length})` }}
        </BtnApp>
      </div>
    </div>

    <div
      v-if="successMessage"
      class="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-sm text-emerald-900"
      role="status"
    >
      <p>{{ successMessage }}</p>
      <ul v-if="createdOrders.length" class="mt-2 flex flex-wrap gap-2">
        <li v-for="order in createdOrders" :key="order.orderId">
          <NuxtLink
            :to="`/admin/orders/${order.orderId}`"
            class="inline-flex rounded-xl bg-white px-3 py-1.5 font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
          >
            {{ order.supplierName }} →
          </NuxtLink>
        </li>
      </ul>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-4 text-sm text-rose-900"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <StatGrid :stats="stats" :columns="3" :loading="isLoading" />

    <div v-if="isLoading" class="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-lg shadow-slate-200/50">
      Calculando sugerencias…
    </div>

    <div
      v-else-if="suggestions.length === 0"
      class="rounded-2xl bg-white p-10 text-center shadow-lg shadow-slate-200/50"
    >
      <p class="text-lg font-semibold text-slate-800">Todo surtido</p>
      <p class="mt-1 text-sm text-slate-500">
        Ningún producto con mínimo definido está por debajo de su nivel. Si esperabas ver alguno, revisa que tenga capturado el stock mínimo.
      </p>
      <NuxtLink to="/admin/products" class="mt-4 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900">
        Ir a Productos
      </NuxtLink>
    </div>

    <template v-else>
      <section class="space-y-4">
        <h2 class="text-lg font-bold text-slate-800">Órdenes de compra sugeridas</h2>
        <p class="text-sm text-slate-500">
          Se crea una orden en borrador por proveedor con los productos marcados. El precio de cada línea es el costo del producto; ajústalo en la orden si tu proveedor cotizó otro.
        </p>

        <div class="grid gap-4 lg:grid-cols-2">
          <article
            v-for="group in groups"
            :key="group.supplierId ?? 'none'"
            class="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/50"
            :class="group.supplierId ? '' : 'ring-1 ring-amber-200'"
          >
            <header class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-semibold text-slate-800">{{ group.supplierName }}</h3>
                <p class="text-sm text-slate-500">
                  {{ group.items.length }} {{ group.items.length === 1 ? 'producto' : 'productos' }} · {{ money(group.estimatedTotal) }}
                </p>
              </div>
              <button
                v-if="group.supplierId"
                type="button"
                class="rounded-xl px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                @click="toggleGroup(group)"
              >
                {{ group.items.every((i) => isSelected(i.productId)) ? 'Quitar todos' : 'Marcar todos' }}
              </button>
            </header>

            <p v-if="!group.supplierId" class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Asigna un proveedor habitual a estos productos para incluirlos en una orden de compra.
            </p>

            <ul class="mt-4 divide-y divide-slate-100">
              <li v-for="item in group.items" :key="item.productId" class="flex items-center gap-3 py-2.5">
                <input
                  v-if="group.supplierId"
                  :id="`restock-${item.productId}`"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  :checked="isSelected(item.productId)"
                  @change="toggle(item.productId)"
                >
                <label :for="`restock-${item.productId}`" class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-slate-800">{{ item.name }}</span>
                  <span class="block text-xs text-slate-500">
                    Disponible {{ units(item.available) }} · mínimo {{ units(item.stockMin) }}
                  </span>
                </label>
                <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="SEVERITY_CLASSES[item.severity]">
                  {{ SEVERITY_LABELS[item.severity] }}
                </span>
                <span class="w-20 text-right text-sm font-semibold text-slate-800">+{{ units(item.suggestedQuantity) }}</span>
                <NuxtLink
                  v-if="!group.supplierId"
                  :to="`/admin/products/${item.productId}`"
                  class="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                >
                  Asignar
                </NuxtLink>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <Datatable
        title="Detalle"
        description="Existencia, reservas y cantidad sugerida por producto."
        :data="tableRows"
        :columns="columns"
        :search-keys="['name', 'sku', 'supplierName']"
        export-filename="por-reabastecer"
        @row-click="(row) => navigateTo(`/admin/inventory/${row.id}`)"
      >
        <template #cell-severity="{ row }">
          <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="SEVERITY_CLASSES[row.severity as RestockSeverity]">
            {{ SEVERITY_LABELS[row.severity as RestockSeverity] }}
          </span>
        </template>
        <template #cell-supplierName="{ row }">
          <span :class="row.supplierId ? 'text-slate-700' : 'text-amber-700'">
            {{ row.supplierId ? row.supplierName : 'Sin proveedor' }}
          </span>
        </template>
      </Datatable>
    </template>
  </div>
</template>
