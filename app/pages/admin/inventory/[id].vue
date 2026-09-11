<script setup lang="ts">
import type { StockCard } from '~/types/inventory.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { getStockCard, lastError } = useInventory()

const productId = computed(() => route.params.id as string)

const isLoading = ref(false)
const card = ref<StockCard | null>(null)
const errorMessage = ref<string | null>(null)
const originFilter = ref<string>('all')

const load = async () => {
  isLoading.value = true
  errorMessage.value = null
  try {
    card.value = await getStockCard(productId.value, 300)
    if (!card.value && lastError.value) errorMessage.value = lastError.value
  } finally {
    isLoading.value = false
  }
}

onMounted(load)
watch(productId, load)

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0)

const units = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(value ?? 0)

const dateTime = (value: string): string =>
  new Date(value).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

const product = computed(() => card.value?.product ?? null)
const moves = computed(() => card.value?.moves ?? [])

/** Orígenes presentes en el historial, para filtrar sin opciones vacías. */
const availableOrigins = computed(() => {
  const set = new Set(moves.value.map(m => m.origin))
  return [...set]
})

const filteredMoves = computed(() =>
  originFilter.value === 'all'
    ? moves.value
    : moves.value.filter(m => m.origin === originFilter.value)
)

/** Enlace al documento que originó el movimiento. */
const documentLink = (move: { picking_id: string | null; order_id: string | null }): string | null => {
  if (move.picking_id) return `/admin/pickings/${move.picking_id}`
  if (move.order_id) return `/admin/orders/${move.order_id}`
  return null
}
</script>

<template>
  <div class="space-y-6">
    <!-- Encabezado -->
    <div class="flex items-start gap-3">
      <button
        type="button"
        class="mt-1 p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label="Volver"
        @click="router.back()"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0">
        <nav class="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
          <NuxtLink to="/admin/inventory" class="hover:text-indigo-600 font-medium">Inventario</NuxtLink>
          <span class="text-slate-300">/</span>
          <span class="font-semibold text-slate-700">Trazabilidad</span>
        </nav>
        <h1 class="text-2xl font-bold text-slate-800 truncate">
          {{ product?.name ?? 'Producto' }}
        </h1>
        <p v-if="product" class="text-sm text-slate-500 mt-0.5">
          {{ product.sku || 'Sin SKU' }} · Cada entrada y salida registrada, con su origen y documento.
        </p>
      </div>
      <NuxtLink
        v-if="product"
        :to="`/admin/products/${product.id}`"
        class="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
      >
        Ficha del producto
      </NuxtLink>
    </div>

    <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <p class="text-sm text-red-800">{{ errorMessage }}</p>
    </div>

    <div v-if="isLoading" class="py-20 text-center">
      <div class="w-8 h-8 mx-auto rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
      <p class="text-sm text-slate-400 mt-3">Cargando historial…</p>
    </div>

    <template v-else-if="product">
      <!-- Resumen -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Existencias</p>
          <p
            class="text-2xl font-bold tabular-nums mt-1"
            :class="product.stock_quantity < 0 ? 'text-red-600' : 'text-slate-800'"
          >
            {{ units(product.stock_quantity) }}
          </p>
          <span :class="['inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold', STOCK_STATUS_CLASSES[product.stock_status]]">
            {{ STOCK_STATUS_LABELS[product.stock_status] }}
          </span>
        </div>
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Valor</p>
          <p class="text-2xl font-bold text-slate-800 tabular-nums mt-1">{{ money(product.stock_value) }}</p>
          <p class="text-[11px] text-slate-400 mt-2">Costo promedio {{ money(product.unit_cost) }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total entradas</p>
          <p class="text-2xl font-bold text-emerald-600 tabular-nums mt-1">
            +{{ units(card?.summary.total_in) }}
          </p>
        </div>
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total salidas</p>
          <p class="text-2xl font-bold text-red-600 tabular-nums mt-1">
            −{{ units(card?.summary.total_out) }}
          </p>
        </div>
      </div>

      <!-- Historial -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h2 class="text-sm font-bold text-slate-800">Historial de movimientos</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ card?.summary.move_count ?? 0 }} movimiento(s) registrados.
            El saldo mostrado es el que quedó después de cada uno.
          </p>
        </div>

        <div v-if="availableOrigins.length > 1" class="flex gap-1.5 px-5 py-3 border-b border-slate-100 overflow-x-auto">
          <button
            type="button"
            :class="[
              'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              originFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
            ]"
            @click="originFilter = 'all'"
          >
            Todos
          </button>
          <button
            v-for="origin in availableOrigins"
            :key="origin"
            type="button"
            :class="[
              'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              originFilter === origin ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
            ]"
            @click="originFilter = origin"
          >
            {{ STOCK_ORIGIN_LABELS[origin] }}
          </button>
        </div>

        <div v-if="!filteredMoves.length" class="py-16 text-center">
          <p class="text-sm font-semibold text-slate-700">Sin movimientos</p>
          <p class="text-xs text-slate-500 mt-1">
            Este producto todavía no registra entradas ni salidas.
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="text-left font-semibold px-5 py-3">Fecha</th>
                <th class="text-left font-semibold px-3 py-3">Origen</th>
                <th class="text-left font-semibold px-3 py-3">Documento</th>
                <th class="text-left font-semibold px-3 py-3">Almacén</th>
                <th class="text-right font-semibold px-3 py-3">Cantidad</th>
                <th class="text-right font-semibold px-3 py-3">Costo unit.</th>
                <th class="text-right font-semibold px-5 py-3">Saldo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="move in filteredMoves" :key="move.id" class="hover:bg-slate-50/60 transition-colors">
                <td class="px-5 py-3 whitespace-nowrap text-slate-600">{{ dateTime(move.occurred_at) }}</td>
                <td class="px-3 py-3">
                  <span :class="['inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold', STOCK_ORIGIN_CLASSES[move.origin]]">
                    {{ STOCK_ORIGIN_LABELS[move.origin] }}
                  </span>
                </td>
                <td class="px-3 py-3">
                  <NuxtLink
                    v-if="documentLink(move)"
                    :to="documentLink(move)!"
                    class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {{ move.picking_name || move.order_name || 'Ver documento' }}
                  </NuxtLink>
                  <span v-else class="text-xs text-slate-400">{{ move.reference || '—' }}</span>
                  <p v-if="move.lot_name || move.serial_number" class="text-[11px] text-slate-400 mt-0.5">
                    {{ move.serial_number ? `Serie ${move.serial_number}` : `Lote ${move.lot_name}` }}
                  </p>
                </td>
                <td class="px-3 py-3 text-xs text-slate-500">{{ move.warehouse_name || '—' }}</td>
                <td
                  class="px-3 py-3 text-right tabular-nums font-semibold"
                  :class="move.move_type === 'in' ? 'text-emerald-600' : 'text-red-600'"
                >
                  {{ move.move_type === 'in' ? '+' : '−' }}{{ units(move.quantity) }}
                </td>
                <td class="px-3 py-3 text-right tabular-nums text-slate-500">{{ money(move.unit_cost) }}</td>
                <td class="px-5 py-3 text-right tabular-nums font-bold text-slate-800">{{ units(move.balance_after) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Notas del movimiento más reciente con justificación -->
        <div
          v-if="filteredMoves.some(m => m.notes)"
          class="px-5 py-3 border-t border-slate-100 bg-slate-50/60"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Notas registradas</p>
          <ul class="space-y-1">
            <li
              v-for="move in filteredMoves.filter(m => m.notes).slice(0, 4)"
              :key="`note-${move.id}`"
              class="text-xs text-slate-600"
            >
              <span class="text-slate-400">{{ dateTime(move.occurred_at) }}:</span>
              {{ move.notes }}
            </li>
          </ul>
        </div>
      </section>
    </template>

    <div v-else class="py-20 text-center">
      <p class="text-sm font-semibold text-slate-700">Producto no encontrado</p>
      <NuxtLink to="/admin/inventory" class="text-xs text-indigo-600 hover:underline mt-2 inline-block">
        Volver al inventario
      </NuxtLink>
    </div>
  </div>
</template>
