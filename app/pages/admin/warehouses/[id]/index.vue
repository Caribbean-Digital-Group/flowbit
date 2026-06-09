<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { StatItem } from '~/components/StatGrid.vue'
import { createEmptyWarehouseForm, type WarehouseFormData } from '~/components/Warehouse/Form.vue'
import type { Database, Tables, TablesUpdate } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

type Warehouse = Tables<'warehouse'>
type PickingView = Database['public']['Views']['v_pickings']['Row']

/** Subconjunto de producto usado en el dashboard; evita recursión profunda de tipos Supabase en computed. */
interface WarehouseInventoryProduct {
  id: string
  name: string
  display_name: string | null
  sku: string | null
  internal_ref: string | null
  is_stockable: boolean | null
  status: string | null
  stock_quantity: number | null
  stock_min: number | null
  cost_price: number | null
  sale_price: number | null
  currency: string | null
}

const filterStockableProducts = (items: WarehouseInventoryProduct[]): WarehouseInventoryProduct[] =>
  items.filter(p => p.is_stockable === true && p.status !== 'inactive')

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getWarehouseById, updateWarehouse, archiveWarehouse } = useWarehouse()
const { getPickingsByWarehouse } = usePicking()
const { getProductsByCompany } = useProduct()

// ── Core state ──────────────────────────────────────────────────────────────
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const row = ref<Warehouse | null>(null)
const formData = ref<WarehouseFormData>(createEmptyWarehouseForm())
const initialForm = ref<WarehouseFormData>(createEmptyWarehouseForm())

// ── Dashboard state ─────────────────────────────────────────────────────────
const dashboardLoading = ref(false)
const pickings = ref<PickingView[]>([])
const products = ref<WarehouseInventoryProduct[]>([])

// ── Computed ────────────────────────────────────────────────────────────────
const rowId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const confirmedEntradas = computed(() =>
  pickings.value.filter(p => p.type === 'entrada' && p.status === 'confirmado')
)
const confirmedSalidas = computed(() =>
  pickings.value.filter(p => p.type === 'salida' && p.status === 'confirmado')
)
const totalEntradasQty = computed(() =>
  confirmedEntradas.value.reduce((s, p) => s + (p.total_quantity ?? 0), 0)
)
const totalSalidasQty = computed(() =>
  confirmedSalidas.value.reduce((s, p) => s + (p.total_quantity ?? 0), 0)
)
const stockableProducts = computed(() => filterStockableProducts(products.value))
const inStockProducts = computed(() =>
  stockableProducts.value
    .filter(p => (p.stock_quantity ?? 0) > 0)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
)
const outOfStockProducts = computed(() =>
  stockableProducts.value
    .filter(p => (p.stock_quantity ?? 0) <= 0)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
)
const valuationByCurrency = computed(() => {
  const map = new Map<string, { costTotal: number; saleTotal: number }>()
  for (const p of inStockProducts.value) {
    const cur = p.currency ?? 'MXN'
    const e = map.get(cur) ?? { costTotal: 0, saleTotal: 0 }
    e.costTotal += (p.stock_quantity ?? 0) * (p.cost_price ?? 0)
    e.saleTotal += (p.stock_quantity ?? 0) * (p.sale_price ?? 0)
    map.set(cur, e)
  }
  return Array.from(map.entries()).map(([currency, v]) => ({ currency, ...v }))
})

const dashboardStats = computed<StatItem[]>(() => [
  {
    label: 'Entradas Confirmadas',
    value: `${fmtNum(totalEntradasQty.value)} uds`,
    change: `${confirmedEntradas.value.length} mov.`,
    trend: 'up'
  },
  {
    label: 'Salidas Confirmadas',
    value: `${fmtNum(totalSalidasQty.value)} uds`,
    change: `${confirmedSalidas.value.length} mov.`,
    trend: 'down'
  },
  {
    label: 'Productos en Stock',
    value: inStockProducts.value.length,
    trend: 'neutral'
  },
  {
    label: 'Sin Existencia',
    value: outOfStockProducts.value.length,
    change: outOfStockProducts.value.length > 0 ? 'Revisar' : undefined,
    trend: outOfStockProducts.value.length > 0 ? 'down' : 'neutral'
  }
])

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n: number) => new Intl.NumberFormat('es-MX').format(n)
const fmtCur = (amount: number, currency = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)

// ── Mappers ──────────────────────────────────────────────────────────────────
const mapRowToForm = (value: Warehouse): WarehouseFormData => ({
  name: value.name,
  code: value.code,
  description: value.description ?? '',
  is_default: value.is_default === true,
  active: value.active !== false
})

const mapFormToUpdate = (value: WarehouseFormData): TablesUpdate<'warehouse'> => ({
  name: value.name.trim(),
  code: value.code.trim().toUpperCase(),
  description: value.description.trim() || null,
  is_default: value.is_default,
  active: value.active
})

// ── Data loading ─────────────────────────────────────────────────────────────
const loadRow = async () => {
  const id = rowId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const found = await getWarehouseById(id, companyId)
    if (!found) { errorMessage.value = 'No se encontró el almacén.'; return }
    row.value = found
    const mapped = mapRowToForm(found)
    formData.value = mapped
    initialForm.value = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

const loadDashboard = async () => {
  const id = rowId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return
  dashboardLoading.value = true
  try {
    const [pickingData, productData] = await Promise.all([
      getPickingsByWarehouse(id, companyId),
      getProductsByCompany(companyId)
    ])
    pickings.value = pickingData
    products.value = productData as WarehouseInventoryProduct[]
  } finally {
    dashboardLoading.value = false
  }
}

watch([rowId, selectedCompanyId], () => {
  isEditing.value = false
  loadRow()
  loadDashboard()
}, { immediate: true })

// ── PDF Report ───────────────────────────────────────────────────────────────
const downloadValuationPdf = () => {
  const warehouseName = row.value?.name ?? 'Almacén'
  const companyName = selectedCompany.value?.name ?? ''
  const generatedAt = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const inventoryRows = inStockProducts.value.map(p => {
    const qty = p.stock_quantity ?? 0
    const cost = p.cost_price ?? 0
    const sale = p.sale_price ?? 0
    const cur = p.currency ?? 'MXN'
    return `<tr>
      <td>${p.sku ?? p.internal_ref ?? '—'}</td>
      <td>${p.display_name ?? p.name ?? '—'}</td>
      <td class="right">${fmtNum(qty)}</td>
      <td class="right">${fmtCur(cost, cur)}</td>
      <td class="right">${fmtCur(qty * cost, cur)}</td>
      <td class="right">${fmtCur(sale, cur)}</td>
      <td class="right">${fmtCur(qty * sale, cur)}</td>
      <td class="center">${cur}</td>
    </tr>`
  }).join('')

  const currencyTotals = valuationByCurrency.value.map(v => `
    <tr class="subtotal">
      <td colspan="4" class="right">Subtotal ${v.currency}:</td>
      <td class="right">${fmtCur(v.costTotal, v.currency)}</td>
      <td></td>
      <td class="right">${fmtCur(v.saleTotal, v.currency)}</td>
      <td class="center">${v.currency}</td>
    </tr>`).join('')

  const outOfStockRows = outOfStockProducts.value.map(p => `
    <tr>
      <td>${p.sku ?? p.internal_ref ?? '—'}</td>
      <td>${p.display_name ?? p.name ?? '—'}</td>
      <td class="right">${fmtNum(p.stock_quantity ?? 0)}</td>
      <td class="right">${fmtNum(p.stock_min ?? 0)}</td>
      <td class="right">${fmtCur(p.cost_price ?? 0, p.currency ?? 'MXN')}</td>
      <td class="center">${p.currency ?? 'MXN'}</td>
    </tr>`).join('')

  const outOfStockSection = outOfStockProducts.value.length > 0 ? `
    <div class="sec">
      <div class="st">Productos sin Existencia <span class="stb">${outOfStockProducts.value.length} producto(s) agotado(s)</span></div>
      <table>
        <thead><tr>
          <th>SKU / Ref.</th><th>Producto</th>
          <th class="right">Stock Actual</th><th class="right">Stock Mínimo</th>
          <th class="right">P. Compra</th><th class="center">Moneda</th>
        </tr></thead>
        <tbody>${outOfStockRows}</tbody>
      </table>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Valuación de Inventario — ${warehouseName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1e293b;padding:24px;background:#fff}
    .rh{text-align:center;padding-bottom:18px;margin-bottom:26px;border-bottom:3px solid #4f46e5}
    .rh .co{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.1em}
    .rh h1{font-size:20px;font-weight:800;color:#4f46e5;margin-top:6px}
    .rh .wh{font-size:14px;color:#334155;margin-top:4px;font-weight:600}
    .rh .mt{font-size:9px;color:#94a3b8;margin-top:8px}
    .sg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px}
    .sc{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
    .sl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
    .sv{font-size:18px;font-weight:800;color:#1e293b;margin-top:5px}
    .ss{font-size:9px;color:#94a3b8;margin-top:2px}
    .sec{margin-bottom:28px}
    .st{font-size:12px;font-weight:700;color:#4f46e5;border-bottom:1px solid #e2e8f0;padding-bottom:7px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
    .stb{font-size:9px;color:#94a3b8;font-weight:400}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th{background:#f1f5f9;color:#475569;font-weight:700;text-align:left;padding:6px 8px;border:1px solid #e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:.04em}
    td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:middle}
    tr:nth-child(even) td{background:#f8fafc}
    .subtotal td{font-weight:700;background:#ede9fe!important;color:#4338ca}
    .right{text-align:right}.center{text-align:center}
    .ft{text-align:center;font-size:9px;color:#94a3b8;margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0}
    @media print{@page{margin:12mm;size:A4 landscape}body{padding:0}}
  </style>
</head>
<body>
  <div class="rh">
    <div class="co">${companyName}</div>
    <h1>Reporte de Valuación de Inventario</h1>
    <div class="wh">Almacén: ${warehouseName}</div>
    <div class="mt">Generado: ${generatedAt} &nbsp;·&nbsp; Documento contable y financiero de uso interno</div>
  </div>
  <div class="sg">
    <div class="sc"><div class="sl">Entradas Confirmadas</div><div class="sv">${fmtNum(totalEntradasQty.value)} uds</div><div class="ss">${confirmedEntradas.value.length} movimiento(s)</div></div>
    <div class="sc"><div class="sl">Salidas Confirmadas</div><div class="sv">${fmtNum(totalSalidasQty.value)} uds</div><div class="ss">${confirmedSalidas.value.length} movimiento(s)</div></div>
    <div class="sc"><div class="sl">Productos en Stock</div><div class="sv">${inStockProducts.value.length}</div><div class="ss">con existencia</div></div>
    <div class="sc"><div class="sl">Sin Existencia</div><div class="sv">${outOfStockProducts.value.length}</div><div class="ss">productos agotados</div></div>
  </div>
  <div class="sec">
    <div class="st">Valuación de Inventario <span class="stb">Productos almacenables con stock &gt; 0 · ${companyName}</span></div>
    ${inStockProducts.value.length === 0
      ? '<p style="color:#94a3b8;font-style:italic;text-align:center;padding:20px 0">Sin productos en inventario.</p>'
      : `<table>
          <thead><tr>
            <th>SKU / Ref.</th><th>Producto</th>
            <th class="right">Stock</th><th class="right">P. Compra</th>
            <th class="right">Val. Compra</th><th class="right">P. Venta</th>
            <th class="right">Val. Venta</th><th class="center">Moneda</th>
          </tr></thead>
          <tbody>${inventoryRows}</tbody>
          <tfoot>${currencyTotals}</tfoot>
        </table>`
    }
  </div>
  ${outOfStockSection}
  <div class="ft">Flowbit ERP &nbsp;·&nbsp; ${generatedAt} &nbsp;·&nbsp; Confidencial</div>
  <script>window.onload=function(){window.print()}<\/script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ── Event handlers ───────────────────────────────────────────────────────────
const handleSave = async () => {
  const id = rowId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const updated = await updateWarehouse(id, companyId, mapFormToUpdate(formData.value))
    if (!updated) { errorMessage.value = 'No se pudo actualizar el almacén.'; return }
    row.value = updated
    const mapped = mapRowToForm(updated)
    formData.value = mapped
    initialForm.value = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = rowId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return
  isLoading.value = true
  try {
    const ok = await archiveWarehouse(id, companyId)
    if (!ok) { errorMessage.value = 'No se pudo archivar el almacén.'; return }
    router.push('/admin/warehouses')
  } finally {
    isLoading.value = false
  }
}

const handleCancelEdit = () => {
  isEditing.value = false
  formData.value = { ...initialForm.value }
}

// ── Menu options ─────────────────────────────────────────────────────────────
const menuOptions: MenuOption[] = [
  {
    id: 'download-valuation',
    label: 'Reporte Valuación PDF',
    icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    action: () => downloadValuationPdf(),
    variant: 'default'
  },
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'warning',
    divider: true
  }
]
</script>

<template>
  <CardSheet
    :title="formData.name || 'Almacén'"
    :subtitle="formData.code || 'Sin código'"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :menu-options="menuOptions"
    @back="router.push('/admin/warehouses')"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="handleCancelEdit"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <WarehouseForm v-model="formData" :readonly="!isEditing" />

    <template #sections>
      <div class="border-t border-slate-100 pt-8 space-y-8">

        <!-- Dashboard header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Métricas del Almacén</h2>
            <p class="text-sm text-slate-500 mt-1">
              Movimientos confirmados de este almacén · Inventario de toda la empresa
            </p>
          </div>
        </div>

        <!-- KPI Cards -->
        <StatGrid :stats="dashboardStats" :columns="4" :loading="dashboardLoading" />

        <!-- Inventory Valuation -->
        <div>
          <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 class="text-base font-bold text-slate-800">Valuación de Inventario</h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Productos almacenables con existencia · Empresa completa
              </p>
            </div>

            <!-- Currency totals summary -->
            <div
              v-if="!dashboardLoading && valuationByCurrency.length > 0"
              class="flex flex-wrap gap-4"
            >
              <div
                v-for="v in valuationByCurrency"
                :key="v.currency"
                class="text-right"
              >
                <div class="text-xs text-slate-500">Costo total ({{ v.currency }})</div>
                <div class="text-sm font-bold text-indigo-700">{{ fmtCur(v.costTotal, v.currency) }}</div>
                <div class="text-xs text-slate-400">Venta: {{ fmtCur(v.saleTotal, v.currency) }}</div>
              </div>
            </div>
          </div>

          <!-- Loading skeleton -->
          <div
            v-if="dashboardLoading"
            class="rounded-2xl border border-slate-200 overflow-hidden animate-pulse"
          >
            <div class="bg-slate-50 h-10" />
            <div v-for="i in 4" :key="i" class="border-t border-slate-100 px-4 py-3 flex gap-4">
              <div class="h-4 bg-slate-200 rounded w-20" />
              <div class="h-4 bg-slate-200 rounded flex-1" />
              <div class="h-4 bg-slate-200 rounded w-16" />
              <div class="h-4 bg-slate-200 rounded w-24" />
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="inStockProducts.length === 0"
            class="rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm"
          >
            <svg class="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Sin productos con existencia registrada.
          </div>

          <!-- Valuation table -->
          <div v-else class="rounded-2xl border border-slate-200 overflow-hidden shadow-sm shadow-slate-100/80">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200">
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">SKU / Ref.</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Producto</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Stock</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">P. Compra</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-indigo-500 uppercase tracking-wide whitespace-nowrap">Val. Compra</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">P. Venta</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap">Val. Venta</th>
                    <th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Moneda</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="p in inStockProducts"
                    :key="p.id"
                    class="hover:bg-slate-50/60 transition-colors"
                  >
                    <td class="px-4 py-3 font-mono text-xs text-slate-500">
                      {{ p.sku ?? p.internal_ref ?? '—' }}
                    </td>
                    <td class="px-4 py-3 font-medium text-slate-800">
                      {{ p.display_name ?? p.name }}
                    </td>
                    <td class="px-4 py-3 text-right text-slate-700 tabular-nums">
                      {{ fmtNum(p.stock_quantity ?? 0) }}
                    </td>
                    <td class="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {{ fmtCur(p.cost_price ?? 0, p.currency ?? 'MXN') }}
                    </td>
                    <td class="px-4 py-3 text-right font-semibold text-indigo-700 tabular-nums">
                      {{ fmtCur((p.stock_quantity ?? 0) * (p.cost_price ?? 0), p.currency ?? 'MXN') }}
                    </td>
                    <td class="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {{ fmtCur(p.sale_price ?? 0, p.currency ?? 'MXN') }}
                    </td>
                    <td class="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                      {{ fmtCur((p.stock_quantity ?? 0) * (p.sale_price ?? 0), p.currency ?? 'MXN') }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {{ p.currency ?? 'MXN' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr
                    v-for="v in valuationByCurrency"
                    :key="'tot-' + v.currency"
                    class="bg-indigo-50/70 border-t-2 border-indigo-100"
                  >
                    <td colspan="4" class="px-4 py-3 text-right font-semibold text-indigo-600 text-xs uppercase tracking-wide">
                      Subtotal {{ v.currency }}
                    </td>
                    <td class="px-4 py-3 text-right font-bold text-indigo-800 tabular-nums">
                      {{ fmtCur(v.costTotal, v.currency) }}
                    </td>
                    <td />
                    <td class="px-4 py-3 text-right font-bold text-emerald-800 tabular-nums">
                      {{ fmtCur(v.saleTotal, v.currency) }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        {{ v.currency }}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Out of Stock Products -->
        <div v-if="!dashboardLoading && outOfStockProducts.length > 0">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-base font-bold text-slate-800">Productos sin Existencia</h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Productos almacenables con stock igual a cero
              </p>
            </div>
            <BadgeApp :label="`${outOfStockProducts.length} agotado(s)`" variant="danger" />
          </div>

          <div class="rounded-2xl border border-red-100 overflow-hidden shadow-sm shadow-red-50/80">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-red-50 border-b border-red-100">
                    <th class="px-4 py-3 text-left text-xs font-semibold text-red-400 uppercase tracking-wide whitespace-nowrap">SKU / Ref.</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-red-400 uppercase tracking-wide">Producto</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-red-400 uppercase tracking-wide whitespace-nowrap">Stock Actual</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-red-400 uppercase tracking-wide whitespace-nowrap">Stock Mínimo</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-red-400 uppercase tracking-wide whitespace-nowrap">P. Compra</th>
                    <th class="px-4 py-3 text-center text-xs font-semibold text-red-400 uppercase tracking-wide">Moneda</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-red-50">
                  <tr
                    v-for="p in outOfStockProducts"
                    :key="p.id"
                    class="hover:bg-red-50/40 transition-colors"
                  >
                    <td class="px-4 py-3 font-mono text-xs text-slate-500">
                      {{ p.sku ?? p.internal_ref ?? '—' }}
                    </td>
                    <td class="px-4 py-3 font-medium text-slate-800">
                      {{ p.display_name ?? p.name }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        {{ fmtNum(p.stock_quantity ?? 0) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right text-slate-500 tabular-nums">
                      {{ fmtNum(p.stock_min ?? 0) }}
                    </td>
                    <td class="px-4 py-3 text-right text-slate-600 tabular-nums">
                      {{ fmtCur(p.cost_price ?? 0, p.currency ?? 'MXN') }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {{ p.currency ?? 'MXN' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </template>
  </CardSheet>
</template>
