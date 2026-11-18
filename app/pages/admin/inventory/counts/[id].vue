<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { StockCountLineView, StockCountListItem } from '~/composables/useStockCount'
import type { ApplyStockCountResult } from '~/types/stockCount.types'
import {
  COUNT_LINE_STATE_LABELS,
  STOCK_COUNT_STATUS_LABELS,
  computeAdjustment,
  evaluateCountLine,
  findLineByCode,
  matchesCountSearch,
  summarizeCount,
  type CountLineState
} from '~/utils/stockCount'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const countId = computed(() => String(route.params.id))

const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getCount, getLines, setCounted, applyCount, cancelCount, lastError } = useStockCount()

const isLoading = ref(true)
const count = ref<StockCountListItem | null>(null)
const lines = ref<StockCountLineView[]>([])
const drafts = ref<Record<string, string>>({})
const savingIds = ref<Set<string>>(new Set())

const search = ref('')
const scanMessage = ref<string | null>(null)
type Filter = 'all' | 'pending' | 'differences'
const filter = ref<Filter>('all')

const uncountedAsZero = ref(false)
const isApplying = ref(false)
const isCancelling = ref(false)
const applyResult = ref<ApplyStockCountResult | null>(null)

useHead(() => ({ title: count.value ? `${count.value.reference} · Conteo físico` : 'Conteo físico' }))

const toDraft = (value: number | null): string => (value === null ? '' : String(value))

let request = 0
const load = async () => {
  const companyId = selectedCompanyId.value
  const requestId = ++request
  if (!companyId) return

  isLoading.value = true
  try {
    const found = await getCount(countId.value, companyId)
    if (requestId !== request) return
    count.value = found
    if (!found) return
    const data = await getLines(found)
    if (requestId !== request) return
    lines.value = data
    drafts.value = Object.fromEntries(data.map((l) => [l.id, toDraft(l.counted_quantity)]))
  } finally {
    if (requestId === request) isLoading.value = false
  }
}

watch([selectedCompanyId, countId], () => { void load() }, { immediate: true })

const isOpen = computed(() => count.value?.status === 'in_progress')

const units = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(value ?? 0)

const signedUnits = (value: number | null | undefined): string => {
  const v = value ?? 0
  return `${v > 0 ? '+' : ''}${units(v)}`
}

const money = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0)

const dateTime = (value: string | null | undefined): string =>
  value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'

const lineInputs = computed(() => lines.value.map((l) => ({
  expectedQuantity: l.expected_quantity,
  countedQuantity: l.counted_quantity,
  unitCost: l.unit_cost
})))

const summary = computed(() => summarizeCount(lineInputs.value, uncountedAsZero.value && isOpen.value))

const stats = computed(() => [
  {
    label: 'Avance',
    value: `${summary.value.progress}%`,
    change: `${summary.value.countedLines} de ${summary.value.totalLines} productos`,
    trend: 'neutral' as const
  },
  {
    label: 'Sobrantes',
    value: money(summary.value.surplusValue),
    change: `${summary.value.surplusLines} productos · ${units(summary.value.surplusUnits)} u`,
    trend: 'up' as const
  },
  {
    label: 'Faltantes',
    value: money(summary.value.shortageValue),
    change: `${summary.value.shortageLines} productos · ${units(summary.value.shortageUnits)} u`,
    trend: summary.value.shortageLines ? ('down' as const) : ('neutral' as const)
  },
  {
    label: 'Efecto en el inventario',
    value: money(summary.value.netValue),
    change: 'Al costo congelado al iniciar',
    trend: summary.value.netValue < 0 ? ('down' as const) : summary.value.netValue > 0 ? ('up' as const) : ('neutral' as const)
  }
])

interface LineRow {
  line: StockCountLineView
  state: CountLineState
  difference: number | null
  differenceValue: number | null
  clamped: boolean
}

const rows = computed<LineRow[]>(() => lines.value.map((line) => {
  const result = evaluateCountLine({
    expectedQuantity: line.expected_quantity,
    countedQuantity: line.counted_quantity,
    unitCost: line.unit_cost
  })
  const clamped = isOpen.value && result.difference !== null && result.difference < 0
    ? computeAdjustment(result.difference, line.currentQuantity).clamped
    : false
  return { line, ...result, clamped }
}))

const visibleRows = computed(() => rows.value.filter((row) => {
  if (!matchesCountSearch(row.line, search.value)) return false
  if (filter.value === 'pending') return row.state === 'pending'
  if (filter.value === 'differences') return row.state === 'surplus' || row.state === 'shortage'
  return true
}))

const filterOptions = computed<{ id: Filter; label: string }[]>(() => [
  { id: 'all', label: `Todos (${rows.value.length})` },
  { id: 'pending', label: `Sin contar (${summary.value.pendingLines})` },
  { id: 'differences', label: `Con diferencia (${summary.value.surplusLines + summary.value.shortageLines})` }
])

const clampedCount = computed(() => rows.value.filter((r) => r.clamped).length)

const STATE_CLASSES: Record<CountLineState, string> = {
  pending: 'bg-slate-100 text-slate-600',
  match: 'bg-emerald-100 text-emerald-700',
  surplus: 'bg-sky-100 text-sky-700',
  shortage: 'bg-rose-100 text-rose-700'
}

const STATUS_CLASSES: Record<string, string> = {
  in_progress: 'bg-amber-100 text-amber-800',
  applied: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-600'
}

const focusLine = async (lineId: string) => {
  await nextTick()
  const input = document.getElementById(`count-${lineId}`) as HTMLInputElement | null
  input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  input?.focus()
  input?.select()
}

/** Enter en el buscador: un código exacto (lector o teclado) salta a su línea. */
const handleSearchEnter = async () => {
  scanMessage.value = null
  const match = findLineByCode(lines.value, search.value)
  if (match) {
    filter.value = 'all'
    search.value = ''
    scanMessage.value = `«${match.name}»: captura la cantidad contada.`
    await focusLine(match.id)
    return
  }
  if (visibleRows.value.length === 1 && visibleRows.value[0]) {
    await focusLine(visibleRows.value[0].line.id)
    return
  }
  if (search.value.trim()) {
    scanMessage.value = 'Ningún producto de este conteo tiene ese código. Busca por nombre o revisa que pertenezca al almacén y la categoría del conteo.'
  }
}

const parseDraft = (raw: string): number | null | 'invalid' => {
  const text = raw.trim().replace(',', '.')
  if (text === '') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return 'invalid'
  return Math.round(value * 1000) / 1000
}

const saveLine = async (line: StockCountLineView) => {
  if (!isOpen.value) return
  const parsed = parseDraft(drafts.value[line.id] ?? '')
  if (parsed === 'invalid') {
    drafts.value[line.id] = toDraft(line.counted_quantity)
    return
  }
  if (parsed === line.counted_quantity) return

  savingIds.value = new Set(savingIds.value).add(line.id)
  try {
    const ok = await setCounted(line.id, parsed)
    if (ok) line.counted_quantity = parsed
    else drafts.value[line.id] = toDraft(line.counted_quantity)
  } finally {
    const next = new Set(savingIds.value)
    next.delete(line.id)
    savingIds.value = next
  }
}

/** Atajo: el conteo coincide con lo esperado. */
const markAsExpected = async (line: StockCountLineView) => {
  drafts.value[line.id] = toDraft(line.expected_quantity)
  await saveLine(line)
}

const handleApply = async () => {
  if (!count.value || !isSelectedCompanyAdmin.value) return
  const pending = summary.value.pendingLines
  const question = pending > 0 && !uncountedAsZero.value
    ? `Se ajustarán ${summary.value.surplusLines + summary.value.shortageLines} productos. ${pending} sin contar se dejarán igual. ¿Aplicar el conteo?`
    : `Se ajustarán ${summary.value.surplusLines + summary.value.shortageLines} productos. ¿Aplicar el conteo?`
  if (!window.confirm(question)) return

  isApplying.value = true
  try {
    const result = await applyCount(count.value.id, uncountedAsZero.value)
    if (result) {
      applyResult.value = result
      await load()
    }
  } finally {
    isApplying.value = false
  }
}

const handleCancel = async () => {
  if (!count.value || !isSelectedCompanyAdmin.value) return
  if (!window.confirm('El conteo se cancelará y lo capturado no afectará el inventario. ¿Continuar?')) return
  isCancelling.value = true
  try {
    if (await cancelCount(count.value.id)) await load()
  } finally {
    isCancelling.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <NuxtLink to="/admin/inventory/counts" class="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
        ← Conteos
      </NuxtLink>
    </div>

    <div v-if="isLoading && !count" class="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-lg shadow-slate-200/50">
      Cargando conteo…
    </div>

    <div v-else-if="!count" class="rounded-2xl bg-white p-10 text-center shadow-lg shadow-slate-200/50">
      <p class="text-lg font-semibold text-slate-800">Conteo no encontrado</p>
      <p class="mt-1 text-sm text-slate-500">{{ lastError ?? 'Puede pertenecer a otra empresa.' }}</p>
    </div>

    <template v-else>
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold text-slate-800">{{ count.reference }}</h1>
            <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="STATUS_CLASSES[count.status]">
              {{ STOCK_COUNT_STATUS_LABELS[count.status] }}
            </span>
          </div>
          <p class="mt-1 text-sm text-slate-500">
            {{ count.warehouseName }} · {{ count.categoryName ?? 'Todo el almacén' }} · iniciado {{ dateTime(count.started_at) }}
            <template v-if="count.applied_at"> · aplicado {{ dateTime(count.applied_at) }}</template>
          </p>
          <p v-if="count.notes" class="mt-1 text-sm text-slate-600">{{ count.notes }}</p>
        </div>
        <div v-if="isOpen && isSelectedCompanyAdmin" class="flex flex-wrap gap-2">
          <BtnApp variant="ghost" size="md" :disabled="isCancelling || isApplying" @click="handleCancel">
            {{ isCancelling ? 'Cancelando…' : 'Cancelar conteo' }}
          </BtnApp>
        </div>
      </header>

      <div v-if="lastError" class="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-4 text-sm text-rose-900" role="alert">
        {{ lastError }}
      </div>

      <div
        v-if="applyResult"
        class="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-sm text-emerald-900"
        role="status"
      >
        Conteo aplicado: {{ applyResult.adjusted_lines }} ajustes registrados en el libro de inventario
        con la referencia {{ applyResult.reference }}.
        <template v-if="applyResult.skipped_lines"> {{ applyResult.skipped_lines }} productos sin contar quedaron igual.</template>
        <template v-if="applyResult.clamped_lines"> {{ applyResult.clamped_lines }} faltantes se ajustaron solo hasta dejar el almacén en cero.</template>
      </div>

      <StatGrid :stats="stats" :columns="4" :loading="isLoading" />

      <section v-if="isOpen" class="rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/50">
        <label for="count-search" class="block text-sm font-semibold text-slate-700">Buscar o escanear</label>
        <input
          id="count-search"
          v-model="search"
          type="search"
          inputmode="search"
          autocomplete="off"
          class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Nombre, SKU o código de barras y Enter"
          @keydown.enter.prevent="handleSearchEnter"
        >
        <p class="mt-2 text-xs text-slate-500">
          Con un lector de códigos, escanea y la línea del producto se selecciona sola. Escribe la cantidad y pulsa Enter para guardar.
        </p>
        <p v-if="scanMessage" class="mt-2 text-sm text-indigo-800" role="status">{{ scanMessage }}</p>
      </section>
      <div v-else class="max-w-md">
        <FormInput v-model="search" type="search" placeholder="Buscar por nombre, SKU o código" />
      </div>

      <div class="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar productos">
        <button
          v-for="option in filterOptions"
          :key="option.id"
          type="button"
          role="tab"
          :aria-selected="filter === option.id"
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="filter === option.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'"
          @click="filter = option.id"
        >
          {{ option.label }}
        </button>
      </div>

      <section class="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50">
        <div class="hidden grid-cols-12 gap-3 border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <span class="col-span-4">Producto</span>
          <span class="col-span-2 text-right">Esperado</span>
          <span class="col-span-2 text-right">Contado</span>
          <span class="col-span-2 text-right">Diferencia</span>
          <span class="col-span-2 text-right">{{ isOpen ? 'Estado' : 'Ajuste aplicado' }}</span>
        </div>

        <p v-if="visibleRows.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No hay productos con este filtro.
        </p>

        <ul class="divide-y divide-slate-100">
          <li
            v-for="row in visibleRows"
            :key="row.line.id"
            class="grid grid-cols-2 items-center gap-3 px-5 py-3 md:grid-cols-12"
          >
            <div class="col-span-2 min-w-0 md:col-span-4">
              <p class="truncate text-sm font-medium text-slate-800">{{ row.line.name }}</p>
              <p class="truncate text-xs text-slate-500">
                {{ [row.line.sku, row.line.barcode].filter(Boolean).join(' · ') || 'Sin SKU' }}
                <template v-if="isOpen && row.line.currentQuantity !== row.line.expected_quantity">
                  · hoy hay {{ units(row.line.currentQuantity) }}
                </template>
              </p>
            </div>

            <div class="text-sm text-slate-600 md:col-span-2 md:text-right">
              <span class="md:hidden">Esperado: </span>{{ units(row.line.expected_quantity) }}
            </div>

            <div class="flex items-center justify-end gap-2 md:col-span-2">
              <template v-if="isOpen">
                <button
                  v-if="row.state === 'pending'"
                  type="button"
                  class="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  :title="`Contado = ${units(row.line.expected_quantity)}`"
                  @click="markAsExpected(row.line)"
                >
                  ✓ Igual
                </button>
                <input
                  :id="`count-${row.line.id}`"
                  v-model="drafts[row.line.id]"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  :aria-label="`Cantidad contada de ${row.line.name}`"
                  class="w-24 rounded-xl border border-slate-200 px-3 py-2 text-right text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  :class="savingIds.has(row.line.id) ? 'opacity-60' : ''"
                  placeholder="—"
                  @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                  @blur="saveLine(row.line)"
                >
              </template>
              <span v-else class="text-sm text-slate-800">
                {{ row.line.counted_quantity === null ? '—' : units(row.line.counted_quantity) }}
              </span>
            </div>

            <div class="text-sm md:col-span-2 md:text-right">
              <template v-if="row.difference !== null && row.difference !== 0">
                <span :class="row.difference > 0 ? 'text-sky-700' : 'text-rose-700'" class="font-semibold">
                  {{ signedUnits(row.difference) }}
                </span>
                <span class="block text-xs text-slate-500">{{ money(row.differenceValue) }}</span>
              </template>
              <span v-else class="text-slate-400">—</span>
            </div>

            <div class="text-right md:col-span-2">
              <template v-if="isOpen">
                <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="STATE_CLASSES[row.state]">
                  {{ COUNT_LINE_STATE_LABELS[row.state] }}
                </span>
                <span v-if="row.clamped" class="mt-1 block text-xs text-amber-700">Se ajustará hasta 0</span>
              </template>
              <span v-else class="text-sm font-semibold text-slate-800">
                {{ row.line.adjusted_quantity === null ? '—' : signedUnits(row.line.adjusted_quantity) }}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="isOpen" class="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/50">
        <h2 class="text-lg font-bold text-slate-800">Aplicar el conteo</h2>
        <p class="mt-1 text-sm text-slate-500">
          Cada diferencia se registra como ajuste en el libro de inventario con la referencia {{ count.reference }} y el costo congelado al iniciar.
          Se calcula contra la existencia del inicio del conteo, así que las ventas y entradas hechas mientras contabas se respetan.
        </p>

        <label class="mt-4 flex items-start gap-3 text-sm text-slate-700">
          <input
            v-model="uncountedAsZero"
            type="checkbox"
            class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          >
          <span>
            Tratar los productos sin contar como <strong>0</strong>
            <span class="block text-xs text-slate-500">
              Úsalo solo si recorriste todo el almacén: lo que no encontraste se da de baja. Si no lo marcas, esos productos quedan igual.
            </span>
          </span>
        </label>

        <p v-if="clampedCount" class="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {{ clampedCount }} {{ clampedCount === 1 ? 'producto tiene' : 'productos tienen' }} un faltante mayor que la existencia actual del almacén
          (salió mercancía durante el conteo). Se ajustarán solo hasta dejar el almacén en cero.
        </p>

        <div class="mt-5 flex flex-wrap items-center justify-end gap-3">
          <p v-if="!isSelectedCompanyAdmin" class="text-sm text-slate-500">
            Solo un owner o admin puede aplicar el conteo. Tú puedes seguir capturando.
          </p>
          <BtnApp
            v-else
            variant="primary"
            size="md"
            :disabled="isApplying || summary.countedLines === 0 && !uncountedAsZero"
            @click="handleApply"
          >
            {{ isApplying ? 'Aplicando…' : 'Aplicar ajustes' }}
          </BtnApp>
        </div>
      </section>
    </template>
  </div>
</template>
