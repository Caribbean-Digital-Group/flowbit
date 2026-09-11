<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { InventorySummary, ProductStockView, StockStatus } from '~/types/inventory.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const {
  getSummary,
  getStockReport,
  adjustStock,
  generateRestockTasks,
  lastError
} = useInventory()

const isLoading = ref(false)
const isWorking = ref(false)
const summary = ref<InventorySummary | null>(null)
const rows = ref<ProductStockView[]>([])
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const statusFilter = ref<'all' | StockStatus>('all')
const search = ref('')
const showSettings = ref(false)

const handleSettingsSaved = () => {
  showSettings.value = false
  successMessage.value = 'Ajustes de inventario guardados.'
}

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const [summaryData, reportData] = await Promise.all([getSummary(cid), getStockReport(cid)])
    summary.value = summaryData
    rows.value = reportData
    if (!summaryData && lastError.value) errorMessage.value = lastError.value
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0)

const units = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(value ?? 0)

const totals = computed(() => summary.value?.totals ?? null)

/** Tarjetas del encabezado: la valoración es la respuesta a «cuánto tengo». */
const stats = computed(() => [
  {
    label: 'Valor del inventario',
    value: money(totals.value?.stock_value),
    change: totals.value ? `${units(totals.value.units_on_hand)} unidades` : undefined,
    trend: 'neutral' as const
  },
  {
    label: 'Valor a precio de venta',
    value: money(totals.value?.retail_value),
    change: totals.value ? `Margen ${money(totals.value.potential_margin)}` : undefined,
    trend: 'up' as const
  },
  {
    label: 'Productos con existencias',
    value: totals.value?.product_count ?? 0,
    change: totals.value ? `${totals.value.ok_count} en nivel correcto` : undefined,
    trend: 'neutral' as const
  },
  {
    label: 'Requieren atención',
    value: (totals.value?.low_count ?? 0) + (totals.value?.out_count ?? 0) + (totals.value?.negative_count ?? 0),
    change: totals.value
      ? `${totals.value.low_count} bajos · ${totals.value.out_count} agotados · ${totals.value.negative_count} negativos`
      : undefined,
    trend: (totals.value?.negative_count ?? 0) > 0 ? ('down' as const) : ('neutral' as const)
  }
])

const filteredRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return rows.value.filter(row => {
    if (statusFilter.value !== 'all' && row.stock_status !== statusFilter.value) return false
    if (!term) return true
    return (
      row.name.toLowerCase().includes(term) ||
      (row.sku ?? '').toLowerCase().includes(term) ||
      (row.category_name ?? '').toLowerCase().includes(term)
    )
  })
})

const statusCounts = computed(() => ({
  all: rows.value.length,
  ok: rows.value.filter(r => r.stock_status === 'ok').length,
  low: rows.value.filter(r => r.stock_status === 'low').length,
  out: rows.value.filter(r => r.stock_status === 'out').length,
  negative: rows.value.filter(r => r.stock_status === 'negative').length
}))

/** Participación de cada categoría en el valor total, para la barra. */
const categoryShare = computed(() => {
  const total = totals.value?.stock_value ?? 0
  if (!total) return []
  return (summary.value?.by_category ?? []).slice(0, 6).map(c => ({
    ...c,
    share: Math.round((c.stock_value / total) * 100)
  }))
})

// ── Ajuste de inventario ────────────────────────────────────────────────────

const adjustTarget = ref<ProductStockView | null>(null)
const adjustQuantity = ref<number>(0)
const adjustReason = ref('')

const openAdjust = (row: ProductStockView) => {
  adjustTarget.value = row
  adjustQuantity.value = row.stock_quantity
  adjustReason.value = ''
  errorMessage.value = null
}

const closeAdjust = () => {
  adjustTarget.value = null
}

const adjustDifference = computed(() => {
  if (!adjustTarget.value) return 0
  return Number(adjustQuantity.value ?? 0) - adjustTarget.value.stock_quantity
})

const confirmAdjust = async () => {
  if (!adjustTarget.value) return
  if (!adjustReason.value.trim()) {
    errorMessage.value = 'Escribe el motivo del ajuste: queda registrado en el historial del producto.'
    return
  }

  isWorking.value = true
  try {
    const result = await adjustStock(
      adjustTarget.value.id,
      Number(adjustQuantity.value ?? 0),
      adjustReason.value.trim()
    )

    if (!result) {
      errorMessage.value = lastError.value ?? 'No se pudo registrar el ajuste.'
      return
    }

    successMessage.value = result.status === 'unchanged'
      ? 'Las existencias ya coincidían: no se registró ningún movimiento.'
      : `Ajuste registrado: ${adjustDifference.value > 0 ? '+' : ''}${units(result.difference)} unidades.`
    closeAdjust()
    await load()
  } finally {
    isWorking.value = false
  }
}

// ── Tareas de reabastecimiento ──────────────────────────────────────────────

const handleGenerateTasks = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return

  isWorking.value = true
  errorMessage.value = null
  try {
    const result = await generateRestockTasks(cid)
    if (!result) {
      errorMessage.value = lastError.value ?? 'No se pudieron generar las tareas.'
      return
    }
    successMessage.value =
      `Agenda sincronizada: ${result.pending_tasks} tarea(s) de reabastecimiento pendientes` +
      (result.closed_tasks > 0 ? ` y ${result.closed_tasks} cerrada(s) por reposición.` : '.')
  } finally {
    isWorking.value = false
  }
}

/** Exporta el reporte tal como se está viendo, filtros incluidos. */
const exportCsv = () => {
  const header = ['Producto', 'SKU', 'Categoría', 'Existencias', 'Mínimo', 'Costo unitario', 'Valor', 'Estado']
  const lines = filteredRows.value.map(r => [
    r.name,
    r.sku ?? '',
    r.category_name ?? '',
    r.stock_quantity,
    r.stock_min,
    r.unit_cost,
    r.stock_value,
    STOCK_STATUS_LABELS[r.stock_status]
  ])

  const csv = [header, ...lines]
    .map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `inventario-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const statusTabs: { value: 'all' | StockStatus; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'negative', label: 'Negativos' },
  { value: 'out', label: 'Agotados' },
  { value: 'low', label: 'Bajo mínimo' },
  { value: 'ok', label: 'Correctos' }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Inventario</h1>
        <p class="text-sm text-slate-500 mt-1">
          Existencias, valoración y trazabilidad de cada producto.
          <span v-if="summary" class="text-slate-400">
            Actualizado {{ new Date(summary.generated_at).toLocaleString('es-MX') }}
          </span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
          @click="showSettings = true"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Ajustes
        </button>
        <button
          type="button"
          :disabled="isWorking || isLoading"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-colors disabled:opacity-50"
          @click="exportCsv"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
        <button
          type="button"
          :disabled="isWorking || isLoading"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow disabled:opacity-50"
          @click="handleGenerateTasks"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 14l2 2 4-4" />
          </svg>
          Sincronizar agenda
        </button>
      </div>
    </div>

    <!-- Avisos -->
    <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <p class="text-sm text-red-800 leading-relaxed">{{ errorMessage }}</p>
    </div>
    <div v-if="successMessage" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
      <p class="text-sm text-emerald-800 leading-relaxed">{{ successMessage }}</p>
    </div>

    <!-- Indicadores -->
    <StatGrid :stats="stats" :columns="4" :loading="isLoading" />

    <!-- Aviso de productos sin costo: distorsionan la valoración -->
    <div
      v-if="totals && totals.uncosted_count > 0"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3"
    >
      <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-amber-900">
          {{ totals.uncosted_count }} producto(s) con existencias pero sin costo registrado
        </p>
        <p class="text-xs text-amber-800 mt-1 leading-relaxed">
          Esas unidades valen $0 en el reporte, así que la valoración total está por debajo de la real.
          Captura su costo en la ficha del producto o regístralo en la próxima entrada de mercancía.
        </p>
      </div>
    </div>

    <!-- Valoración por categoría y almacén -->
    <div v-if="summary" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-5">
        <h2 class="text-sm font-bold text-slate-800 mb-4">Valor por categoría</h2>
        <div v-if="categoryShare.length" class="space-y-3">
          <div v-for="cat in categoryShare" :key="cat.category_name">
            <div class="flex items-center justify-between gap-3 mb-1">
              <p class="text-xs font-semibold text-slate-700 truncate">{{ cat.category_name }}</p>
              <p class="text-xs font-bold text-slate-800 tabular-nums flex-shrink-0">
                {{ money(cat.stock_value) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600"
                  :style="{ width: `${cat.share}%` }"
                />
              </div>
              <span class="text-[10px] font-semibold text-slate-400 tabular-nums w-8 text-right">{{ cat.share }}%</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">
              {{ cat.product_count }} producto(s) · {{ units(cat.units) }} unidades
            </p>
          </div>
        </div>
        <p v-else class="text-sm text-slate-400 py-6 text-center">Sin datos de valoración todavía.</p>
      </section>

      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-5">
        <h2 class="text-sm font-bold text-slate-800 mb-1">Existencias por almacén</h2>
        <p class="text-xs text-slate-500 mb-4">Calculado desde el libro de movimientos.</p>
        <div v-if="summary.by_warehouse.length" class="space-y-2.5">
          <div
            v-for="wh in summary.by_warehouse"
            :key="wh.warehouse_id ?? 'none'"
            class="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3.5 py-2.5"
          >
            <div class="min-w-0">
              <p class="text-xs font-semibold text-slate-800 truncate">{{ wh.warehouse_name }}</p>
              <p class="text-[11px] text-slate-400">{{ wh.product_count }} producto(s)</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-sm font-bold text-slate-800 tabular-nums">{{ units(wh.units) }}</p>
              <p class="text-[11px] text-slate-400 tabular-nums">{{ money(wh.stock_value) }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-slate-400 py-6 text-center">Aún no hay movimientos registrados.</p>
      </section>
    </div>

    <!-- Reporte de existencias -->
    <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 class="text-sm font-bold text-slate-800">Existencias por producto</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ filteredRows.length }} de {{ rows.length }} producto(s)
          </p>
        </div>
        <div class="relative sm:w-72">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="search"
            placeholder="Buscar producto, SKU o categoría…"
            class="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
        </div>
      </div>

      <!-- Filtros por estado -->
      <div class="flex gap-1.5 px-5 py-3 border-b border-slate-100 overflow-x-auto">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          :class="[
            'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            statusFilter === tab.value
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          ]"
          @click="statusFilter = tab.value"
        >
          {{ tab.label }}
          <span class="ml-1 text-[10px] text-slate-400">{{ statusCounts[tab.value] }}</span>
        </button>
      </div>

      <div v-if="isLoading" class="py-16 text-center">
        <div class="w-8 h-8 mx-auto rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
        <p class="text-sm text-slate-400 mt-3">Calculando existencias…</p>
      </div>

      <div v-else-if="!filteredRows.length" class="py-16 text-center">
        <p class="text-sm font-semibold text-slate-700">Sin productos que mostrar</p>
        <p class="text-xs text-slate-500 mt-1">Cambia el filtro o registra productos inventariables.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="text-left font-semibold px-5 py-3">Producto</th>
              <th class="text-right font-semibold px-3 py-3">Existencias</th>
              <th class="text-right font-semibold px-3 py-3">Mínimo</th>
              <th class="text-right font-semibold px-3 py-3">Costo unit.</th>
              <th class="text-right font-semibold px-3 py-3">Valor</th>
              <th class="text-center font-semibold px-3 py-3">Estado</th>
              <th class="text-right font-semibold px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in filteredRows"
              :key="row.id"
              class="hover:bg-slate-50/60 transition-colors"
            >
              <td class="px-5 py-3">
                <p class="font-semibold text-slate-800 leading-snug">{{ row.name }}</p>
                <p class="text-xs text-slate-400 mt-0.5">
                  {{ row.sku || 'Sin SKU' }}
                  <span v-if="row.category_name"> · {{ row.category_name }}</span>
                </p>
              </td>
              <td class="px-3 py-3 text-right tabular-nums font-semibold"
                  :class="row.stock_quantity < 0 ? 'text-red-600' : 'text-slate-800'">
                {{ units(row.stock_quantity) }}
              </td>
              <td class="px-3 py-3 text-right tabular-nums text-slate-500">{{ units(row.stock_min) }}</td>
              <td class="px-3 py-3 text-right tabular-nums text-slate-500">{{ money(row.unit_cost) }}</td>
              <td class="px-3 py-3 text-right tabular-nums font-semibold text-slate-800">{{ money(row.stock_value) }}</td>
              <td class="px-3 py-3 text-center">
                <span :class="['inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold', STOCK_STATUS_CLASSES[row.stock_status]]">
                  {{ STOCK_STATUS_LABELS[row.stock_status] }}
                </span>
                <p v-if="row.suggested_restock > 0 && row.stock_status !== 'ok'" class="text-[10px] text-slate-400 mt-1">
                  Surtir {{ units(row.suggested_restock) }}
                </p>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink
                    :to="`/admin/inventory/${row.id}`"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-indigo-700 transition-colors"
                    title="Ver trazabilidad"
                  >
                    Historial
                  </NuxtLink>
                  <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    @click="openAdjust(row)"
                  >
                    Ajustar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Ajustes de inventario -->
    <InventorySettingsModal
      v-if="showSettings && selectedCompanyId"
      :company-id="selectedCompanyId"
      @close="showSettings = false"
      @saved="handleSettingsSaved"
    />

    <!-- Modal de ajuste -->
    <Teleport to="body">
      <div
        v-if="adjustTarget"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="closeAdjust"
      >
        <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-800">Ajustar inventario</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ adjustTarget.name }}</p>
          </div>

          <div class="p-5 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-slate-50 px-3 py-2.5">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sistema</p>
                <p class="text-lg font-bold text-slate-800 tabular-nums">{{ units(adjustTarget.stock_quantity) }}</p>
              </div>
              <div class="rounded-xl bg-indigo-50 px-3 py-2.5">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Diferencia</p>
                <p
                  class="text-lg font-bold tabular-nums"
                  :class="adjustDifference > 0 ? 'text-emerald-600' : adjustDifference < 0 ? 'text-red-600' : 'text-slate-500'"
                >
                  {{ adjustDifference > 0 ? '+' : '' }}{{ units(adjustDifference) }}
                </p>
              </div>
            </div>

            <FormInput
              v-model.number="adjustQuantity"
              label="Cantidad contada"
              type="number"
              step="0.001"
              size="md"
              hint="La cantidad física que realmente hay."
            />

            <FormTextArea
              v-model="adjustReason"
              label="Motivo del ajuste"
              placeholder="Conteo físico de septiembre, merma por daño, error de captura…"
              :rows="2"
            />

            <p class="text-[11px] text-slate-400 leading-relaxed">
              El ajuste queda como movimiento en el historial del producto, con tu usuario y la fecha.
              No se puede borrar: una corrección posterior sería otro movimiento.
            </p>
          </div>

          <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              @click="closeAdjust"
            >
              Cancelar
            </button>
            <button
              type="button"
              :disabled="isWorking"
              class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 disabled:opacity-50"
              @click="confirmAdjust"
            >
              {{ isWorking ? 'Registrando…' : 'Registrar ajuste' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
