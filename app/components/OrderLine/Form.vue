<script lang="ts">
export interface OrderLineFormData {
  product_id: string
  product_name: string
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_percent: number
  tax_rate: number
}

export const createEmptyOrderLineForm = (taxRate = 16.00): OrderLineFormData => ({
  product_id: '',
  product_name: '',
  description: '',
  quantity: 1,
  unit_price: 0,
  unit_cost: 0,
  discount_percent: 0,
  tax_rate: taxRate
})
</script>

<script setup lang="ts">
import type { Tables } from '~/types/database.types'

type Product = Tables<'product'>

interface Props {
  readonly?: boolean
  currency?: string
  companyId?: string | null
  orderType?: 'sale' | 'purchase'
  /** Tasa fiscal por defecto de la orden para nuevas líneas al elegir catálogo. */
  catalogTaxFallback?: number
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  currency: 'MXN',
  companyId: null,
  orderType: 'sale',
  catalogTaxFallback: 16
})

const formData = defineModel<OrderLineFormData>({ required: true })

const { searchProductsByCompany } = useProduct()

const productHits = shallowRef<Product[]>([])
const showProductDropdown = ref(false)
const loadingProducts = ref(false)
const productHitActive = ref(-1)

let debounceFetch: ReturnType<typeof setTimeout> | undefined
/** Texto enlazado al catálogo: si cambia manualmente sin coincidencias, limpiamos product_id */
const catalogLabelSnapshot = ref('')

const isEditing = computed(() => !props.readonly)

watch(
  () => props.companyId,
  () => {
    productHits.value = []
    showProductDropdown.value = false
    catalogLabelSnapshot.value = ''
  }
)

onMounted(() => {
  const pid = formData.value.product_id?.trim()
  if (pid && formData.value.product_name.trim()) {
    catalogLabelSnapshot.value = formData.value.product_name.trim()
  }
})

const catalogLabelPrimary = (p: Product): string =>
  (p.display_name ?? p.name ?? '').trim() || ''

const catalogLabelSubtitle = (p: Product): string => {
  const bits = [
    p.sku ? `SKU ${p.sku}` : '',
    p.barcode ? p.barcode : ''
  ].filter(Boolean)
  return bits.join(' · ')
}

function applyPricesFromCatalog(p: Product): void {
  const salePrice = Number(p.sale_price ?? 0)
  const costPrice = Number(p.cost_price ?? 0)

  if (props.orderType === 'sale') {
    formData.value.unit_price = salePrice || costPrice
    formData.value.unit_cost = costPrice
  } else {
    formData.value.unit_price = costPrice || salePrice
    formData.value.unit_cost = costPrice
  }

  const tr = Number(p.tax_rate ?? props.catalogTaxFallback ?? 16)
  if (!Number.isNaN(tr)) {
    formData.value.tax_rate = tr
  }
}

function chooseCatalogProduct(p: Product): void {
  formData.value.product_id = p.id
  formData.value.product_name = catalogLabelPrimary(p)
  if (!formData.value.description.trim()) {
    formData.value.description =
      catalogLabelPrimary(p)
      || p.description?.trim?.()
      || ''
  }

  applyPricesFromCatalog(p)
  catalogLabelSnapshot.value = catalogLabelPrimary(p).trim()
  showProductDropdown.value = false
  productHitActive.value = -1
}

async function runProductSearch(trigger: string): Promise<void> {
  const cid = props.companyId
  if (!cid || props.readonly) return

  loadingProducts.value = true
  try {
    productHits.value = await searchProductsByCompany(cid, trigger || '', 40)
  } finally {
    loadingProducts.value = false
  }
}

function scheduleProductSearch(): void {
  if (!props.companyId || props.readonly) return

  if (debounceFetch) clearTimeout(debounceFetch)
  debounceFetch = setTimeout(() => {
    void runProductSearch(formData.value.product_name)
  }, 220)

  productHitActive.value = -1
  showProductDropdown.value = true
}

function openProductDropdown(): void {
  if (!props.companyId || props.readonly) return
  showProductDropdown.value = true
  void runProductSearch(formData.value.product_name.trim())
}

function onProductLabelInput(): void {
  const snap = catalogLabelSnapshot.value.trim()
  if (formData.value.product_id.trim() && snap) {
    if (formData.value.product_name.trim() !== snap) {
      formData.value.product_id = ''
      catalogLabelSnapshot.value = ''
    }
  }

  scheduleProductSearch()
}

function onProductBlur(): void {
  window.setTimeout(() => {
    showProductDropdown.value = false
    productHitActive.value = -1
  }, 180)
}

function cycleActiveHit(delta: number): void {
  if (!productHits.value.length) return
  productHitActive.value = Math.max(
    0,
    Math.min(productHitActive.value + delta, productHits.value.length - 1)
  )
}

function onCatalogKeydown(e: KeyboardEvent): void {
  if (!showProductDropdown.value || !productHits.value.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    cycleActiveHit(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    cycleActiveHit(-1)
  } else if (e.key === 'Enter' && productHitActive.value >= 0) {
    e.preventDefault()
    const picked = productHits.value[productHitActive.value]
    if (picked) chooseCatalogProduct(picked)
  } else if (e.key === 'Escape') {
    showProductDropdown.value = false
  }
}

const unitPriceLabel = computed(() =>
  props.orderType === 'purchase' ? 'Precio unitario' : 'Precio unitario'
)

const catalogHintMessage = computed(() => {
  if (!props.companyId) {
    return 'Selecciona una empresa para buscar productos del catálogo.'
  }

  const name = formData.value.product_name.trim()
  const needCreate = !!name.length && !formData.value.product_id

  return needCreate
    ? 'Al guardar esta línea se creará automáticamente un producto en el catálogo con el nombre indicado.'
    : 'Filtra por nombre, SKU u otro código. Si no encuentras coincidencias, puedes escribir un nombre nuevo; se creará el producto al guardar.'
})

const grossAmount = computed(() =>
  Math.round(formData.value.quantity * formData.value.unit_price * 100) / 100
)

const discountAmount = computed(() =>
  Math.round(grossAmount.value * formData.value.discount_percent / 100 * 100) / 100
)

// Local ref para el input de monto de descuento (se sincroniza bidireccionalmente con discount_percent)
const localDiscountAmount = ref(discountAmount.value)
let skipAmountSync = false

watch(
  () => [formData.value.discount_percent, formData.value.quantity, formData.value.unit_price] as const,
  ([pct, qty, price]) => {
    if (!skipAmountSync) {
      localDiscountAmount.value = Math.round(qty * price * pct / 100 * 100) / 100
    }
  }
)

async function onDiscountAmountInput() {
  skipAmountSync = true
  if (grossAmount.value > 0) {
    const clamped = Math.min(localDiscountAmount.value, grossAmount.value)
    formData.value.discount_percent = Math.min(
      100,
      Math.round(clamped / grossAmount.value * 100 * 100) / 100
    )
  }
  await nextTick()
  skipAmountSync = false
}

const subtotal = computed(() => {
  const base = formData.value.quantity * formData.value.unit_price
  return Math.round((base - discountAmount.value) * 100) / 100
})

const taxAmount = computed(() => {
  return Math.round(subtotal.value * formData.value.tax_rate / 100 * 100) / 100
})

const total = computed(() => {
  return Math.round((subtotal.value + taxAmount.value) * 100) / 100
})

const margin = computed(() => {
  return Math.round((subtotal.value - (formData.value.quantity * formData.value.unit_cost)) * 100) / 100
})

const marginPercent = computed(() => {
  if (subtotal.value > 0) {
    return Math.round((margin.value / subtotal.value) * 100 * 100) / 100
  }
  return 0
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: props.currency
  }).format(value)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Producto -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        Producto
      </h4>

      <div class="relative space-y-4 bg-slate-50 rounded-lg p-4">
        <label class="block text-base font-medium text-slate-700 mb-2">
          Buscar producto en catálogo
          <span class="text-red-500 ml-1">*</span>
        </label>
        <div class="relative">
          <input
            v-if="isEditing && companyId"
            v-model="formData.product_name"
            type="text"
            autocomplete="off"
            placeholder="Nombre, SKU, código interno..."
            required
            class="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            @focus="openProductDropdown"
            @blur="onProductBlur"
            @input="onProductLabelInput"
            @keydown="onCatalogKeydown"
          >
          <FormInput
            v-else
            v-model="formData.product_name"
            label="Nombre del Producto"
            placeholder="Ej: Laptop HP Pavilion 15"
            :readonly="readonly"
            required
            size="md"
          />

          <div
            v-if="companyId && isEditing && showProductDropdown && (loadingProducts || productHits.length)"
            class="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 max-h-64 overflow-auto"
          >
            <div
              v-if="loadingProducts"
              class="px-4 py-3 text-sm text-slate-500"
            >
              Buscando…
            </div>
            <button
              v-for="(p, idx) in productHits"
              v-else
              :key="p.id"
              type="button"
              class="w-full px-4 py-2.5 text-left text-sm hover:bg-indigo-50 border-b border-slate-50 last:border-0"
              :class="[
                idx === productHitActive
                  ? 'bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200'
                  : 'text-slate-800'
              ]"
              @mousedown.prevent="chooseCatalogProduct(p)"
            >
              <div class="font-medium truncate">
                {{ catalogLabelPrimary(p) || '—' }}
              </div>
              <div
                v-if="catalogLabelSubtitle(p)"
                class="text-xs text-slate-500 truncate"
              >
                {{ catalogLabelSubtitle(p) }}
              </div>
            </button>
          </div>

          <p class="mt-2 text-xs text-slate-500 leading-relaxed">
            {{ catalogHintMessage }}
          </p>
        </div>

        <div class="w-full">
          <label class="block text-base font-medium text-slate-700 mb-2">
            Descripción
          </label>
          <textarea
            v-model="formData.description"
            :readonly="readonly"
            rows="3"
            class="w-full px-4 py-3 text-base border border-slate-300 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
            :class="{ 'bg-slate-100 cursor-default': readonly }"
            placeholder="Descripción detallada del producto o servicio..."
          />
        </div>
      </div>
    </div>

    <!-- Cantidades y Precios -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Cantidades y Precios
      </h4>

      <div class="bg-slate-50 rounded-lg p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            v-model="formData.quantity"
            type="number"
            label="Cantidad"
            placeholder="1"
            :readonly="readonly"
            required
            :min="0.001"
            :step="1"
            size="md"
          />

          <FormInput
            v-model="formData.unit_price"
            type="number"
            :label="unitPriceLabel"
            placeholder="0.00"
            :readonly="readonly"
            required
            :min="0"
            :step="0.01"
            size="md"
          />

          <FormInput
            v-model="formData.unit_cost"
            type="number"
            label="Costo Unitario"
            placeholder="0.00"
            :readonly="readonly"
            :min="0"
            :step="0.01"
            size="md"
          />
        </div>
      </div>
    </div>

    <!-- Descuento e Impuesto -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
        Descuento e Impuesto
      </h4>

      <div class="bg-slate-50 rounded-lg p-4 space-y-4">
        <!-- Descuento: monto y porcentaje sincronizados -->
        <div>
          <p class="text-sm font-medium text-slate-700 mb-2">Descuento</p>
          <div class="grid grid-cols-2 gap-3">
            <!-- Monto de descuento -->
            <div class="space-y-1">
              <label class="text-xs font-medium text-slate-500 uppercase tracking-wider">Monto ({{ currency }})</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">$</span>
                <input
                  v-if="isEditing"
                  v-model.number="localDiscountAmount"
                  type="number"
                  min="0"
                  :max="grossAmount"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  @input="onDiscountAmountInput"
                />
                <div v-else class="pl-7 pr-3 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-700">
                  {{ localDiscountAmount.toFixed(2) }}
                </div>
              </div>
            </div>

            <!-- Porcentaje de descuento -->
            <div class="space-y-1">
              <label class="text-xs font-medium text-slate-500 uppercase tracking-wider">Porcentaje</label>
              <div class="relative">
                <input
                  v-if="isEditing"
                  v-model.number="formData.discount_percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full pl-3 pr-7 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <div v-else class="pl-3 pr-7 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-700">
                  {{ formData.discount_percent.toFixed(2) }}
                </div>
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none">%</span>
              </div>
            </div>
          </div>
          <p class="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4" />
            </svg>
            Ingresa el monto o el porcentaje; ambos se sincronizan automáticamente.
          </p>
        </div>

        <!-- Tasa de Impuesto -->
        <FormInput
          v-model="formData.tax_rate"
          type="number"
          label="Tasa de Impuesto (%)"
          placeholder="16.00"
          :readonly="readonly"
          :min="0"
          :step="0.01"
          size="md"
        />
      </div>
    </div>

    <!-- Resumen Calculado -->
    <div class="space-y-4">
      <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Resumen
      </h4>

      <div class="rounded-xl border border-slate-200 overflow-hidden shadow-sm">

        <!-- Importe bruto -->
        <div class="flex justify-between items-center px-4 py-2.5 text-sm bg-white border-b border-slate-100">
          <span class="text-slate-500">Importe bruto</span>
          <span class="text-slate-600">{{ formatCurrency(grossAmount) }}</span>
        </div>

        <!-- Descuento (solo si hay descuento) -->
        <template v-if="discountAmount > 0">
          <div class="flex justify-between items-center px-4 py-2.5 text-sm border-b border-slate-100">
            <span class="text-slate-500">Descuento ({{ formData.discount_percent }}%)</span>
            <span class="font-semibold text-red-600">−{{ formatCurrency(discountAmount) }}</span>
          </div>
        </template>

        <!-- Subtotal s/IVA -->
        <div
          class="flex justify-between items-center px-4 py-2.5 text-sm border-b border-slate-100"
          :class="discountAmount > 0 ? 'bg-green-50' : 'bg-white'"
        >
          <div>
            <div class="text-slate-600">Subtotal s/IVA</div>
            <div v-if="discountAmount > 0" class="text-xs text-green-600 mt-0.5">Importe bruto menos descuento</div>
          </div>
          <span class="font-semibold" :class="discountAmount > 0 ? 'text-green-700' : 'text-slate-800'">
            {{ formatCurrency(subtotal) }}
          </span>
        </div>

        <!-- IVA (solo si hay impuesto) -->
        <div v-if="taxAmount > 0" class="flex justify-between items-center px-4 py-2.5 text-sm bg-white border-b border-slate-100">
          <span class="text-slate-500">IVA ({{ formData.tax_rate }}%)</span>
          <span class="text-slate-700">{{ formatCurrency(taxAmount) }}</span>
        </div>

        <!-- Total -->
        <div class="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600">
          <div>
            <div class="text-sm font-bold text-white">Total</div>
            <div v-if="taxAmount > 0" class="text-xs text-indigo-200 mt-0.5">Subtotal + IVA</div>
          </div>
          <span class="text-lg font-bold text-white">{{ formatCurrency(total) }}</span>
        </div>

        <!-- Margen -->
        <div class="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
          <div class="px-4 py-3 text-center">
            <p class="text-sm font-bold" :class="margin >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ formatCurrency(margin) }}
            </p>
            <p class="text-xs text-slate-500 mt-0.5">Margen</p>
          </div>
          <div class="px-4 py-3 text-center">
            <p class="text-sm font-bold" :class="marginPercent >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ marginPercent.toFixed(2) }}%
            </p>
            <p class="text-xs text-slate-500 mt-0.5">% Margen</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
