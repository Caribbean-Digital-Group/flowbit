<script setup lang="ts">
import { storeToRefs } from 'pinia'
definePageMeta({ layout: 'admin' })

type TrackingType = 'none' | 'lot' | 'serial'
type ScanStage = 'scan_product' | 'scan_serial' | 'scan_lot' | 'confirm_quantity'
type LineStatus = 'pending' | 'scanned' | 'discrepancy'

interface ScanLine {
  id: string
  product_id: string
  product_name: string
  product_barcode: string | null
  product_sku: string | null
  expected_quantity: number
  tracking_type: TrackingType
  done_quantity: number
  captured_serial: string
  captured_lot: string
  scan_notes: string | null
  status: LineStatus
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getPickingViewById, setPickingStatus } = usePicking()
const { getPickingLinesByPickingId, updateScanProgress, updatePickingLine } = usePickingLine()
const { getProductsByCompany } = useProduct()

const rowId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const pickingName = ref('Picking')
const pickingType = ref<'entrada' | 'salida'>('salida')
const pickingStatus = ref<string>('publicado')

const scanLines = ref<ScanLine[]>([])
const currentIndex = ref(0)
const stage = ref<ScanStage>('scan_product')
const scanInput = ref('')
const stageError = ref<string | null>(null)
const scanInputRef = ref<HTMLInputElement | null>(null)
const showSummary = ref(false)

const currentLine = computed(() => scanLines.value[currentIndex.value] ?? null)
const doneCount = computed(() => scanLines.value.filter((l) => l.status !== 'pending').length)
const totalCount = computed(() => scanLines.value.length)
const progressPercent = computed(() =>
  totalCount.value > 0 ? Math.round((doneCount.value / totalCount.value) * 100) : 0
)
const allDone = computed(() => doneCount.value === totalCount.value)

const typeLabel: Record<string, string> = { entrada: 'Entrada', salida: 'Salida' }
const stageLabel: Record<ScanStage, string> = {
  scan_product: 'Escanea el código de barras del producto',
  scan_serial: 'Escanea el número de serie',
  scan_lot: 'Escanea o escribe el número de lote',
  confirm_quantity: 'Confirma la cantidad procesada'
}

const loadData = async () => {
  const companyId = selectedCompanyId.value
  const id = rowId.value
  if (!companyId || !id) return

  isLoading.value = true
  errorMessage.value = null

  try {
    const [header, rawLines, products] = await Promise.all([
      getPickingViewById(id, companyId),
      getPickingLinesByPickingId(id, companyId),
      getProductsByCompany(companyId, { productType: 'product', status: 'active' })
    ])

    if (!header) {
      errorMessage.value = 'No se encontró el picking.'
      return
    }

    if (header.status === 'confirmado' || header.status === 'cancelado') {
      errorMessage.value = `Este picking está ${header.status} y no puede procesarse.`
      return
    }

    pickingName.value = header.name || 'Picking'
    pickingType.value = (header.type || 'salida') as 'entrada' | 'salida'
    pickingStatus.value = header.status || 'publicado'

    const productMap = new Map(products.map((p) => [p.id, p]))

    scanLines.value = rawLines.map((line): ScanLine => {
      const prod = productMap.get(line.product_id)
      return {
        id: line.id,
        product_id: line.product_id,
        product_name: prod?.display_name?.trim() || prod?.name || 'Producto desconocido',
        product_barcode: prod?.barcode || null,
        product_sku: prod?.sku || null,
        expected_quantity: line.quantity,
        tracking_type: (line.tracking_type || 'none') as TrackingType,
        done_quantity: line.done_quantity ?? 0,
        captured_serial: line.serial_number || '',
        captured_lot: line.lot_name || '',
        scan_notes: line.scan_notes || null,
        status: line.scanned_at ? (line.done_quantity !== line.quantity ? 'discrepancy' : 'scanned') : 'pending'
      }
    })

    const firstPending = scanLines.value.findIndex((l) => l.status === 'pending')
    currentIndex.value = firstPending >= 0 ? firstPending : 0
    stage.value = 'scan_product'

    if (allDone.value) showSummary.value = true
  } finally {
    isLoading.value = false
    await nextTick()
    focusInput()
  }
}

watch([rowId, selectedCompanyId], () => loadData(), { immediate: true })

const focusInput = () => {
  scanInputRef.value?.focus()
}

const matchesBarcode = (line: ScanLine, raw: string): boolean => {
  const trimmed = raw.trim()
  if (!trimmed) return false
  if (line.product_barcode && line.product_barcode.trim().toLowerCase() === trimmed.toLowerCase()) return true
  if (line.product_sku && line.product_sku.trim().toLowerCase() === trimmed.toLowerCase()) return true
  return false
}

const handleScan = async () => {
  const raw = scanInput.value.trim()
  scanInput.value = ''
  stageError.value = null
  if (!raw || !currentLine.value) return

  const line = currentLine.value

  if (stage.value === 'scan_product') {
    if (matchesBarcode(line, raw)) {
      if (line.tracking_type === 'serial') {
        stage.value = 'scan_serial'
      } else if (line.tracking_type === 'lot') {
        stage.value = 'scan_lot'
      } else {
        line.done_quantity = line.expected_quantity
        stage.value = 'confirm_quantity'
      }
    } else {
      stageError.value = `Código no coincide. Esperado: ${line.product_barcode || line.product_sku || 'sin código'}`
    }
  } else if (stage.value === 'scan_serial') {
    line.captured_serial = raw
    line.done_quantity = 1
    stage.value = 'confirm_quantity'
  } else if (stage.value === 'scan_lot') {
    line.captured_lot = raw
    stage.value = 'confirm_quantity'
  }

  await nextTick()
  focusInput()
}

const confirmLine = async () => {
  const line = currentLine.value
  if (!line) return

  isSaving.value = true
  stageError.value = null

  try {
    const isDiscrepancy = line.done_quantity !== line.expected_quantity

    const updated = await updateScanProgress(line.id, line.done_quantity, line.scan_notes)
    if (!updated) {
      stageError.value = 'Error al guardar el progreso. Intenta de nuevo.'
      return
    }

    if (line.tracking_type === 'serial' && line.captured_serial) {
      await updatePickingLine(line.id, { serial_number: line.captured_serial })
    }
    if (line.tracking_type === 'lot' && line.captured_lot) {
      await updatePickingLine(line.id, { lot_name: line.captured_lot })
    }

    line.status = isDiscrepancy ? 'discrepancy' : 'scanned'

    const nextPending = scanLines.value.findIndex((l, i) => i > currentIndex.value && l.status === 'pending')
    if (nextPending >= 0) {
      currentIndex.value = nextPending
    } else {
      const anyPending = scanLines.value.findIndex((l) => l.status === 'pending')
      if (anyPending >= 0) {
        currentIndex.value = anyPending
      } else {
        showSummary.value = true
        return
      }
    }

    stage.value = 'scan_product'
  } finally {
    isSaving.value = false
    await nextTick()
    focusInput()
  }
}

const skipLine = () => {
  if (!currentLine.value) return
  currentLine.value.scan_notes = 'Omitida manualmente'
  const nextPending = scanLines.value.findIndex((l, i) => i !== currentIndex.value && l.status === 'pending')
  if (nextPending >= 0) {
    currentIndex.value = nextPending
    stage.value = 'scan_product'
  } else {
    showSummary.value = true
  }
  stageError.value = null
  scanInput.value = ''
  nextTick(() => focusInput())
}

const jumpToLine = (index: number) => {
  currentIndex.value = index
  stage.value = 'scan_product'
  stageError.value = null
  scanInput.value = ''
  showSummary.value = false
  nextTick(() => focusInput())
}

const confirmPicking = async () => {
  const companyId = selectedCompanyId.value
  const id = rowId.value
  if (!companyId || !id) return

  isSaving.value = true
  errorMessage.value = null
  try {
    if (pickingStatus.value === 'borrador') {
      const published = await setPickingStatus(id, 'publicado')
      if (!published) {
        errorMessage.value = 'No se pudo publicar el picking antes de confirmarlo.'
        return
      }
      pickingStatus.value = 'publicado'
    }

    const ok = await setPickingStatus(id, 'confirmado')
    if (!ok) {
      errorMessage.value = 'No se pudo confirmar el picking. Verifica el estado e intenta de nuevo.'
      return
    }
    router.push(`/admin/pickings/${id}`)
  } finally {
    isSaving.value = false
  }
}

const statusColorClass = (status: LineStatus) => {
  if (status === 'scanned') return 'text-emerald-600'
  if (status === 'discrepancy') return 'text-amber-600'
  return 'text-slate-400'
}

const statusIcon = (status: LineStatus) => {
  if (status === 'scanned') return 'M5 13l4 4L19 7'
  if (status === 'discrepancy') return 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
  return 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">

    <!-- HEADER BARRA SUPERIOR -->
    <div class="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <button
          class="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
          @click="router.push(`/admin/pickings/${rowId}`)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span class="text-sm font-medium">Regresar</span>
        </button>

        <div class="flex-1 text-center">
          <p class="text-sm font-bold text-slate-800">{{ pickingName }}</p>
          <p class="text-xs text-slate-500">{{ typeLabel[pickingType] }} · Escaneo</p>
        </div>

        <div class="text-right min-w-[60px]">
          <p class="text-sm font-bold text-indigo-600">{{ doneCount }}/{{ totalCount }}</p>
          <p class="text-xs text-slate-400">líneas</p>
        </div>
      </div>

      <!-- BARRA DE PROGRESO -->
      <div class="h-1.5 bg-slate-100 w-full">
        <div
          class="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- LOADING STATE -->
    <div v-if="isLoading" class="flex items-center justify-center py-32">
      <div class="flex flex-col items-center gap-3 text-slate-500">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p class="text-sm">Cargando picking...</p>
      </div>
    </div>

    <!-- ERROR STATE -->
    <div v-else-if="errorMessage" class="max-w-2xl mx-auto px-4 py-12">
      <div class="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
        <svg class="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p class="text-red-700 font-medium">{{ errorMessage }}</p>
        <button
          class="mt-4 rounded-xl bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors"
          @click="router.push(`/admin/pickings/${rowId}`)"
        >
          Volver al picking
        </button>
      </div>
    </div>

    <!-- RESUMEN FINAL -->
    <div v-else-if="showSummary" class="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div class="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center">
        <div class="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          :class="scanLines.some(l => l.status === 'discrepancy') ? 'bg-amber-100' : 'bg-emerald-100'">
          <svg class="w-8 h-8"
            :class="scanLines.some(l => l.status === 'discrepancy') ? 'text-amber-600' : 'text-emerald-600'"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              :d="scanLines.some(l => l.status === 'discrepancy')
                ? 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
                : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-slate-800">
          {{ scanLines.some(l => l.status === 'discrepancy') ? 'Escaneo completado con diferencias' : 'Escaneo completado' }}
        </h2>
        <p class="text-slate-500 text-sm mt-1">
          {{ doneCount }} de {{ totalCount }} líneas procesadas
        </p>
      </div>

      <!-- RESUMEN POR LÍNEA -->
      <div class="space-y-2">
        <div
          v-for="(line, idx) in scanLines"
          :key="line.id"
          class="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
          @click="jumpToLine(idx)"
        >
          <svg class="w-5 h-5 shrink-0" :class="statusColorClass(line.status)"
            fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :d="statusIcon(line.status)" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-800 truncate">{{ line.product_name }}</p>
            <p class="text-xs text-slate-400">
              {{ line.done_quantity }} / {{ line.expected_quantity }} uds.
              <span v-if="line.captured_serial" class="ml-1">· Serie: {{ line.captured_serial }}</span>
              <span v-if="line.captured_lot" class="ml-1">· Lote: {{ line.captured_lot }}</span>
            </p>
          </div>
          <span
            class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
            :class="{
              'bg-emerald-100 text-emerald-700': line.status === 'scanned',
              'bg-amber-100 text-amber-700': line.status === 'discrepancy',
              'bg-slate-100 text-slate-500': line.status === 'pending'
            }"
          >
            {{ line.status === 'scanned' ? 'OK' : line.status === 'discrepancy' ? 'Diferencia' : 'Pendiente' }}
          </span>
        </div>
      </div>

      <!-- ACCIONES FINALES -->
      <div class="space-y-3">
        <div v-if="scanLines.some(l => l.status === 'discrepancy')"
          class="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <p class="font-semibold mb-1">Hay líneas con diferencias</p>
          <p>Las cantidades procesadas no coinciden con las planeadas. Puedes confirmar igualmente o regresar a corregir.</p>
        </div>

        <button
          class="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-indigo-200/50 hover:opacity-90 transition-opacity disabled:opacity-50"
          :disabled="isSaving || pickingStatus === 'confirmado'"
          @click="confirmPicking"
        >
          <span v-if="isSaving">Confirmando...</span>
          <span v-else-if="pickingStatus === 'confirmado'">Ya confirmado</span>
          <span v-else>Confirmar picking</span>
        </button>

        <button
          class="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          @click="showSummary = false; jumpToLine(scanLines.findIndex(l => l.status === 'pending') >= 0 ? scanLines.findIndex(l => l.status === 'pending') : 0)"
        >
          Seguir escaneando
        </button>
      </div>
    </div>

    <!-- VISTA DE ESCANEO ACTIVO -->
    <div v-else-if="currentLine" class="max-w-2xl mx-auto px-4 py-6 space-y-5">

      <!-- TARJETA DE LÍNEA ACTUAL -->
      <div class="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-5 py-3">
          <p class="text-xs font-semibold text-white/70 uppercase tracking-wider">Línea {{ currentIndex + 1 }} de {{ totalCount }}</p>
          <p class="text-lg font-bold text-white mt-0.5 truncate">{{ currentLine.product_name }}</p>
        </div>

        <div class="p-5 grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-xs text-slate-400 mb-1">Esperado</p>
            <p class="text-2xl font-bold text-slate-800">{{ currentLine.expected_quantity }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-1">Procesado</p>
            <p class="text-2xl font-bold"
              :class="currentLine.done_quantity > 0 ? (currentLine.done_quantity === currentLine.expected_quantity ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'">
              {{ currentLine.done_quantity }}
            </p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-1">Tracking</p>
            <p class="text-sm font-semibold text-slate-600 capitalize">{{ currentLine.tracking_type === 'none' ? 'Ninguno' : currentLine.tracking_type === 'lot' ? 'Lote' : 'Serie' }}</p>
          </div>
        </div>

        <div v-if="currentLine.product_barcode || currentLine.product_sku" class="px-5 pb-4">
          <p class="text-xs text-slate-400">
            <span v-if="currentLine.product_barcode">Barcode: <span class="font-mono font-medium text-slate-600">{{ currentLine.product_barcode }}</span></span>
            <span v-if="currentLine.product_barcode && currentLine.product_sku" class="mx-2">·</span>
            <span v-if="currentLine.product_sku">SKU: <span class="font-mono font-medium text-slate-600">{{ currentLine.product_sku }}</span></span>
          </p>
        </div>

        <div v-if="!currentLine.product_barcode && !currentLine.product_sku"
          class="mx-5 mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
          Este producto no tiene código de barras ni SKU configurado. Puedes omitir la validación del código.
        </div>
      </div>

      <!-- CAMPO DE ESCANEO -->
      <div class="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">
            {{ stageLabel[stage] }}
          </label>
          <div class="flex gap-2">
            <input
              ref="scanInputRef"
              v-model="scanInput"
              type="text"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              class="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              :placeholder="stage === 'scan_product' ? 'Escanea o escribe el código...' : stage === 'scan_serial' ? 'Escanea el número de serie...' : 'Escanea o escribe el lote...'"
              @keyup.enter="stage === 'confirm_quantity' ? confirmLine() : handleScan()"
            />
            <button
              v-if="stage !== 'confirm_quantity'"
              class="rounded-xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700 transition-colors"
              @click="handleScan"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          <p v-if="stageError" class="mt-2 text-sm text-red-600 font-medium">
            {{ stageError }}
          </p>
        </div>

        <!-- CONFIRM QUANTITY STAGE -->
        <div v-if="stage === 'confirm_quantity'" class="space-y-4">
          <div v-if="currentLine.tracking_type === 'serial'" class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p class="text-xs text-slate-400 mb-0.5">Número de serie capturado</p>
            <p class="text-sm font-mono font-semibold text-slate-800">{{ currentLine.captured_serial || '—' }}</p>
          </div>
          <div v-if="currentLine.tracking_type === 'lot'" class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p class="text-xs text-slate-400 mb-0.5">Lote capturado</p>
            <p class="text-sm font-mono font-semibold text-slate-800">{{ currentLine.captured_lot || '—' }}</p>
          </div>

          <div v-if="currentLine.tracking_type !== 'serial'">
            <label class="block text-sm font-medium text-slate-700 mb-1">Cantidad procesada</label>
            <input
              v-model.number="currentLine.done_quantity"
              type="number"
              min="0"
              :step="1"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-bold text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              @keyup.enter="confirmLine"
            />
            <p v-if="currentLine.done_quantity !== currentLine.expected_quantity"
              class="mt-1.5 text-xs text-amber-600 font-medium">
              Diferencia: {{ currentLine.done_quantity - currentLine.expected_quantity > 0 ? '+' : '' }}{{ currentLine.done_quantity - currentLine.expected_quantity }} uds. respecto a lo esperado
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
            <input
              v-model="currentLine.scan_notes"
              type="text"
              placeholder="Observaciones sobre esta línea..."
              class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <button
            class="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-indigo-200/50 hover:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="isSaving"
            @click="confirmLine"
          >
            <span v-if="isSaving">Guardando...</span>
            <span v-else>
              {{ currentIndex + 1 < totalCount ? 'Confirmar y siguiente' : 'Confirmar última línea' }}
            </span>
          </button>
        </div>

        <!-- ACCIONES DE ETAPA PRODUCTO/SERIE/LOTE -->
        <div v-else class="flex items-center justify-between">
          <button
            class="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            @click="skipLine"
          >
            Omitir esta línea
          </button>
          <div v-if="!currentLine.product_barcode && stage === 'scan_product'">
            <button
              class="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              @click="() => { currentLine!.done_quantity = currentLine!.expected_quantity; stage = 'confirm_quantity'; nextTick(() => focusInput()) }"
            >
              Confirmar sin escanear
            </button>
          </div>
        </div>
      </div>

      <!-- LISTA LATERAL DE LÍNEAS -->
      <div class="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700">Todas las líneas</p>
          <button
            v-if="doneCount > 0"
            class="text-xs text-indigo-600 font-medium hover:text-indigo-800"
            @click="showSummary = true"
          >
            Ver resumen
          </button>
        </div>
        <div class="divide-y divide-slate-100 max-h-56 overflow-y-auto">
          <button
            v-for="(line, idx) in scanLines"
            :key="line.id"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            :class="{ 'bg-indigo-50': idx === currentIndex }"
            @click="jumpToLine(idx)"
          >
            <svg class="w-4 h-4 shrink-0" :class="idx === currentIndex ? 'text-indigo-500' : statusColorClass(line.status)"
              fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :d="statusIcon(line.status)" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium truncate"
                :class="idx === currentIndex ? 'text-indigo-700' : 'text-slate-700'">
                {{ line.product_name }}
              </p>
              <p class="text-xs text-slate-400">{{ line.done_quantity }}/{{ line.expected_quantity }} uds.</p>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- SIN LÍNEAS -->
    <div v-else-if="!isLoading" class="max-w-2xl mx-auto px-4 py-16 text-center">
      <p class="text-slate-400 text-sm">Este picking no tiene líneas para escanear.</p>
      <button
        class="mt-4 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
        @click="router.push(`/admin/pickings/${rowId}`)"
      >
        Volver al picking
      </button>
    </div>

  </div>
</template>
