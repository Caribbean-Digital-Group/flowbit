<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyProductForm, type ProductFormData } from '~/components/Product/Form.vue'
import type { Tables, TablesUpdate } from '~/types/database.types'
import type { StockCard } from '~/types/inventory.types'

definePageMeta({
  layout: 'admin'
})

type Product = Tables<'product'>

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getProductById, updateProduct, archiveProduct } = useProduct()
const { getStockCard, lastError: inventoryError } = useInventory()

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const product = ref<Product | null>(null)
const formData = ref<ProductFormData>(createEmptyProductForm())
const initialForm = ref<ProductFormData>(createEmptyProductForm())

const stockCard = ref<StockCard | null>(null)
const isLoadingMovements = ref(false)
const movementsError = ref<string | null>(null)

/** Movimientos del libro: incluyen ajustes y costos, no solo pickings. */
const movements = computed(() => stockCard.value?.moves ?? [])

const movementUnits = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(value ?? 0)

const movementMoney = (value: number | null | undefined): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value ?? 0)

const movementDate = (value: string): string =>
  new Date(value).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

const productId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})




const productTypeLabels: Record<string, string> = {
  product: 'Producto',
  service: 'Servicio',
  others: 'Otros'
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  discontinued: 'Descontinuado',
  out_of_stock: 'Sin Stock',
  coming_soon: 'Próximamente'
}

const statusVariants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  active: 'success',
  inactive: 'secondary',
  discontinued: 'danger',
  out_of_stock: 'warning',
  coming_soon: 'primary'
}

const menuOptions: MenuOption[] = [
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'warning'
  }
]

const isLowStock = computed(() => {
  return formData.value.is_stockable && formData.value.stock_quantity <= formData.value.stock_min
})

const metadata = computed(() => {
  const current = product.value
  return {
    createdBy: current?.created_by ?? '—',
    createdAt: current?.created_at ?? '',
    updatedBy: current?.updated_by ?? '—',
    updatedAt: current?.updated_at ?? ''
  }
})

const mapProductToForm = (value: Product): ProductFormData => ({
  name: value.name ?? '',
  display_name: value.display_name ?? '',
  product_type: value.product_type,
  description: value.description ?? '',
  short_description: value.short_description ?? '',
  sku: value.sku ?? '',
  barcode: value.barcode ?? '',
  internal_ref: value.internal_ref ?? '',
  category_id: value.category_id,
  sale_price: value.sale_price ?? 0,
  cost_price: value.cost_price ?? 0,
  list_price: value.list_price ?? 0,
  currency: value.currency ?? 'MXN',
  tax_rate: value.tax_rate ?? 0,
  tax_included: value.tax_included ?? false,
  is_stockable: value.is_stockable ?? true,
  stock_quantity: value.stock_quantity ?? 0,
  stock_min: value.stock_min ?? 0,
  stock_max: value.stock_max ?? 0,
  tracking: value.tracking ?? 'none',
  weight: value.weight ?? 0,
  weight_unit: value.weight_unit ?? 'kg',
  length: value.length ?? 0,
  width: value.width ?? 0,
  height: value.height ?? 0,
  volume: value.volume ?? 0,
  can_be_sold: value.can_be_sold ?? true,
  can_be_purchased: value.can_be_purchased ?? true,
  is_published: value.is_published ?? false,
  featured: value.featured ?? false,
  default_supplier_id: value.default_supplier_id,
  supplier_sku: value.supplier_sku ?? '',
  lead_time: value.lead_time ?? 0,
  status: value.status ?? 'inactive',
  image_url: value.image_url ?? '',
  meta_title: value.meta_title ?? '',
  meta_description: value.meta_description ?? '',
  notes: value.notes ?? ''
})

/**
 * `stock_quantity` se omite a propósito: desde la migración de trazabilidad el
 * stock solo cambia con un movimiento o un ajuste registrado, que dejan
 * asiento en el libro. Enviarlo aquí haría fallar el guardado.
 */
const mapFormToProductUpdate = (value: ProductFormData): TablesUpdate<'product'> => ({
  name: value.name.trim(),
  display_name: value.display_name.trim() || null,
  product_type: value.product_type,
  description: value.description.trim() || null,
  short_description: value.short_description.trim() || null,
  sku: value.sku.trim() || null,
  barcode: value.barcode.trim() || null,
  internal_ref: value.internal_ref.trim() || null,
  category_id: value.category_id,
  sale_price: value.sale_price,
  cost_price: value.cost_price,
  list_price: value.list_price,
  currency: value.currency.trim() || 'MXN',
  tax_rate: value.tax_rate,
  tax_included: value.tax_included,
  is_stockable: value.is_stockable,
  stock_min: value.stock_min,
  stock_max: value.stock_max,
  tracking: value.tracking,
  weight: value.weight,
  weight_unit: value.weight_unit.trim() || 'kg',
  length: value.length,
  width: value.width,
  height: value.height,
  volume: value.volume,
  can_be_sold: value.can_be_sold,
  can_be_purchased: value.can_be_purchased,
  is_published: value.is_published,
  featured: value.featured,
  default_supplier_id: value.default_supplier_id,
  supplier_sku: value.supplier_sku.trim() || null,
  lead_time: value.lead_time,
  status: value.status,
  image_url: value.image_url.trim() || null,
  meta_title: value.meta_title.trim() || null,
  meta_description: value.meta_description.trim() || null,
  notes: value.notes.trim() || null
})

const loadProduct = async (): Promise<void> => {
  const id = productId.value
  const companyId = selectedCompanyId.value

  if (!id) {
    errorMessage.value = 'No se recibió un identificador de producto válido.'
    return
  }
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa para ver este producto.'
    return
  }

  isLoading.value = true
  errorMessage.value = null
  try {
    const data = await getProductById(id, companyId)
    if (!data) {
      errorMessage.value = 'No se encontró el producto solicitado o no tienes acceso.'
      return
    }

    product.value = data
    const mapped = mapProductToForm(data)
    formData.value = mapped
    initialForm.value = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

const handleBack = () => {
  router.push('/admin/products')
}

const handleArchive = async () => {
  const id = productId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const ok = await archiveProduct(id, companyId)
    if (!ok) {
      errorMessage.value = 'No se pudo archivar el producto.'
      return
    }
    router.push('/admin/products')
  } finally {
    isLoading.value = false
  }
}

const handleEdit = () => {
  errorMessage.value = null
  isEditing.value = true
}

const handleSave = async () => {
  const id = productId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  if (!formData.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const saved = await updateProduct(id, companyId, mapFormToProductUpdate(formData.value))
    if (!saved) {
      errorMessage.value = 'No se pudo guardar el producto. Verifica tus permisos de edición.'
      return
    }

    product.value = saved
    const mapped = mapProductToForm(saved)
    formData.value = mapped
    initialForm.value = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleCancel = () => {
  formData.value = { ...initialForm.value }
  errorMessage.value = null
  isEditing.value = false
}

const formatDate = (dateString: string): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadMovements = async (): Promise<void> => {
  const id = productId.value
  if (!id) return

  isLoadingMovements.value = true
  movementsError.value = null
  try {
    stockCard.value = await getStockCard(id, 50)
    if (!stockCard.value) {
      movementsError.value = inventoryError.value ?? 'No se pudo cargar el historial de inventario.'
    }
  } finally {
    isLoadingMovements.value = false
  }
}

watch([productId, selectedCompanyId], () => {
  isEditing.value = false
  void loadProduct()
  void loadMovements()
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <CardSheet
      :title="formData.name || 'Producto sin nombre'"
      :subtitle="`SKU: ${formData.sku}`"
      :show-back-button="true"
      :show-options-button="true"
      :show-edit-button="true"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="metadata.createdBy"
      :created-at="formatDate(metadata.createdAt)"
      :updated-by="metadata.updatedBy"
      :updated-at="formatDate(metadata.updatedAt)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      :full-height="false"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
      <div
        v-if="errorMessage"
        class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
      >
        {{ errorMessage }}
      </div>

      <template #status>
        <div class="flex items-center gap-2">
          <BadgeApp
            :label="productTypeLabels[formData.product_type] || formData.product_type"
            variant="primary"
          />
          <BadgeApp
            :label="statusLabels[formData.status] || formData.status"
            :variant="statusVariants[formData.status] || 'secondary'"
          />
          <BadgeApp
            v-if="isLowStock"
            label="Stock Bajo"
            variant="warning"
          />
        </div>
      </template>

      <ProductForm v-model="formData" :readonly="!isEditing" :product-id="productId" />
    </CardSheet>

    <!-- Movimientos de inventario (libro de trazabilidad) -->
    <div class="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h3 class="text-base font-semibold text-slate-800">Movimientos de inventario</h3>
          <p class="text-sm text-slate-500">
            Entradas y salidas confirmadas, con su origen y el saldo que dejaron.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            :disabled="isLoadingMovements"
            class="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            @click="loadMovements"
          >
            <svg class="size-3.5" :class="{ 'animate-spin': isLoadingMovements }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
          <NuxtLink
            v-if="productId"
            :to="`/admin/inventory/${productId}`"
            class="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            Historial completo
            <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>
      </div>

      <!-- Resumen -->
      <div class="grid grid-cols-2 gap-3 border-b border-slate-100 p-6 sm:grid-cols-4">
        <div class="rounded-xl bg-emerald-50 p-4">
          <p class="text-xs font-medium text-emerald-600">Entradas</p>
          <p class="mt-1 text-2xl font-bold text-emerald-700">+{{ movementUnits(stockCard?.summary.total_in) }}</p>
        </div>
        <div class="rounded-xl bg-red-50 p-4">
          <p class="text-xs font-medium text-red-600">Salidas</p>
          <p class="mt-1 text-2xl font-bold text-red-700">−{{ movementUnits(stockCard?.summary.total_out) }}</p>
        </div>
        <div class="rounded-xl bg-indigo-50 p-4">
          <p class="text-xs font-medium text-indigo-600">Existencias</p>
          <p class="mt-1 text-2xl font-bold text-indigo-700">
            {{ movementUnits(stockCard?.product?.stock_quantity) }}
          </p>
        </div>
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-medium text-slate-500">Valor</p>
          <p class="mt-1 text-2xl font-bold text-slate-700">{{ movementMoney(stockCard?.product?.stock_value) }}</p>
        </div>
      </div>

      <div v-if="isLoadingMovements" class="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
        <svg class="size-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Cargando movimientos...
      </div>

      <div v-else-if="movementsError" class="p-8 text-center">
        <p class="text-sm text-slate-500">{{ movementsError }}</p>
      </div>

      <div v-else-if="!movements.length" class="flex flex-col items-center gap-2 p-10 text-center">
        <svg class="size-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <p class="text-sm text-slate-400">Sin movimientos registrados para este producto</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50">
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Origen</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Documento</th>
              <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Cantidad</th>
              <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Costo unit.</th>
              <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Saldo</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="mv in movements" :key="mv.id" class="transition-colors hover:bg-slate-50/60">
              <td class="whitespace-nowrap px-6 py-3.5 text-slate-500">{{ movementDate(mv.occurred_at) }}</td>
              <td class="px-6 py-3.5">
                <span :class="['inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', STOCK_ORIGIN_CLASSES[mv.origin]]">
                  {{ STOCK_ORIGIN_LABELS[mv.origin] }}
                </span>
              </td>
              <td class="px-6 py-3.5">
                <NuxtLink
                  v-if="mv.picking_id"
                  :to="`/admin/pickings/${mv.picking_id}`"
                  class="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {{ mv.picking_name || 'Movimiento' }}
                </NuxtLink>
                <span v-else class="text-xs text-slate-400">{{ mv.reference || '—' }}</span>
                <p v-if="mv.lot_name || mv.serial_number" class="mt-0.5 text-[11px] text-slate-400">
                  {{ mv.serial_number ? `Serie ${mv.serial_number}` : `Lote ${mv.lot_name}` }}
                </p>
              </td>
              <td
                class="px-6 py-3.5 text-right font-mono font-semibold"
                :class="mv.move_type === 'in' ? 'text-emerald-700' : 'text-red-700'"
              >
                {{ mv.move_type === 'in' ? '+' : '−' }}{{ movementUnits(mv.quantity) }}
              </td>
              <td class="px-6 py-3.5 text-right font-mono text-slate-500">{{ movementMoney(mv.unit_cost) }}</td>
              <td class="px-6 py-3.5 text-right font-mono font-bold text-slate-800">{{ movementUnits(mv.balance_after) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
