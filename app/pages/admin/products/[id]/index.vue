<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyProductForm, type ProductFormData } from '~/components/Product/Form.vue'
import type { Database, Tables, TablesUpdate } from '~/types/database.types'

type PickingLineView = Database['public']['Views']['v_picking_lines']['Row']

definePageMeta({
  layout: 'admin'
})

type Product = Tables<'product'>

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getProductById, updateProduct, archiveProduct } = useProduct()
const { getPickingLinesByProduct } = usePickingLine()

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const product = ref<Product | null>(null)
const formData = ref<ProductFormData>(createEmptyProductForm())
const initialForm = ref<ProductFormData>(createEmptyProductForm())

const movements = ref<PickingLineView[]>([])
const isLoadingMovements = ref(false)

const productId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const pickingStatusLabels: Record<string, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado'
}

const pickingStatusVariants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  borrador: 'secondary',
  publicado: 'warning',
  confirmado: 'success',
  cancelado: 'danger'
}

const movementStats = computed(() => {
  const confirmed = movements.value.filter(m => m.picking_status === 'confirmado')
  const totalIn = confirmed
    .filter(m => m.picking_type === 'entrada')
    .reduce((sum, m) => sum + (m.quantity ?? 0), 0)
  const totalOut = confirmed
    .filter(m => m.picking_type === 'salida')
    .reduce((sum, m) => sum + (m.quantity ?? 0), 0)
  const pending = movements.value.filter(
    m => m.picking_status === 'borrador' || m.picking_status === 'publicado'
  ).length
  return { totalIn, totalOut, netMovement: totalIn - totalOut, pending }
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
  stock_quantity: value.stock_quantity,
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
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  isLoadingMovements.value = true
  try {
    movements.value = await getPickingLinesByProduct(id, companyId)
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

      <ProductForm v-model="formData" :readonly="!isEditing" />
    </CardSheet>

    <!-- Movimientos de Inventario -->
    <div class="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50">
      <!-- Cabecera -->
      <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h3 class="text-base font-semibold text-slate-800">Movimientos de Inventario</h3>
          <p class="text-sm text-slate-500">Historial de entradas y salidas de este producto en pickings</p>
        </div>
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
      </div>

      <!-- Estadísticas de resumen -->
      <div class="grid grid-cols-2 gap-3 border-b border-slate-100 p-6 sm:grid-cols-4">
        <div class="rounded-xl bg-emerald-50 p-4">
          <p class="text-xs font-medium text-emerald-600">Entradas confirmadas</p>
          <p class="mt-1 text-2xl font-bold text-emerald-700">+{{ movementStats.totalIn }}</p>
        </div>
        <div class="rounded-xl bg-red-50 p-4">
          <p class="text-xs font-medium text-red-600">Salidas confirmadas</p>
          <p class="mt-1 text-2xl font-bold text-red-700">-{{ movementStats.totalOut }}</p>
        </div>
        <div class="rounded-xl bg-indigo-50 p-4">
          <p class="text-xs font-medium text-indigo-600">Movimiento neto</p>
          <p
            class="mt-1 text-2xl font-bold"
            :class="movementStats.netMovement >= 0 ? 'text-indigo-700' : 'text-orange-700'"
          >
            {{ movementStats.netMovement >= 0 ? '+' : '' }}{{ movementStats.netMovement }}
          </p>
        </div>
        <div class="rounded-xl bg-amber-50 p-4">
          <p class="text-xs font-medium text-amber-600">Pendientes</p>
          <p class="mt-1 text-2xl font-bold text-amber-700">{{ movementStats.pending }}</p>
        </div>
      </div>

      <!-- Estado de carga -->
      <div v-if="isLoadingMovements" class="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
        <svg class="size-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Cargando movimientos...
      </div>

      <!-- Estado vacío -->
      <div v-else-if="!movements.length" class="flex flex-col items-center gap-2 p-10 text-center">
        <svg class="size-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <p class="text-sm text-slate-400">Sin movimientos registrados para este producto</p>
      </div>

      <!-- Tabla de movimientos -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50">
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Picking</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Orden</th>
              <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Cantidad</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr
              v-for="mv in movements"
              :key="mv.id ?? ''"
              class="transition-colors"
              :class="mv.picking_status === 'cancelado' ? 'opacity-50' : 'hover:bg-slate-50/60'"
            >
              <!-- Fecha -->
              <td class="whitespace-nowrap px-6 py-3.5 text-slate-500">
                {{ formatDate(mv.created_at ?? '') }}
              </td>

              <!-- Tipo entrada/salida -->
              <td class="px-6 py-3.5">
                <div class="flex items-center gap-1.5">
                  <svg
                    class="size-4 shrink-0"
                    :class="mv.picking_type === 'entrada' ? 'text-emerald-500' : 'text-red-500'"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                  >
                    <path
                      v-if="mv.picking_type === 'entrada'"
                      stroke-linecap="round" stroke-linejoin="round"
                      d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
                    />
                    <path
                      v-else
                      stroke-linecap="round" stroke-linejoin="round"
                      d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
                    />
                  </svg>
                  <span
                    class="font-medium"
                    :class="mv.picking_type === 'entrada' ? 'text-emerald-700' : 'text-red-700'"
                  >
                    {{ mv.picking_type === 'entrada' ? 'Entrada' : 'Salida' }}
                  </span>
                </div>
              </td>

              <!-- Referencia picking -->
              <td class="px-6 py-3.5">
                <NuxtLink
                  v-if="mv.picking_id"
                  :to="`/admin/pickings/${mv.picking_id}`"
                  class="font-medium transition-colors"
                  :class="mv.picking_status === 'cancelado'
                    ? 'text-slate-400 line-through'
                    : 'text-indigo-600 hover:text-indigo-800'"
                >
                  {{ mv.picking_name ?? '—' }}
                </NuxtLink>
                <span v-else class="text-slate-400">—</span>
              </td>

              <!-- Orden vinculada -->
              <td class="px-6 py-3.5">
                <NuxtLink
                  v-if="mv.order_id"
                  :to="`/admin/orders/${mv.order_id}`"
                  class="text-slate-600 transition-colors hover:text-indigo-600"
                >
                  {{ mv.order_name ?? '—' }}
                </NuxtLink>
                <span v-else class="text-slate-400">—</span>
              </td>

              <!-- Cantidad -->
              <td
                class="px-6 py-3.5 text-right font-mono font-semibold"
                :class="mv.picking_type === 'entrada' ? 'text-emerald-700' : 'text-red-700'"
              >
                {{ mv.picking_type === 'entrada' ? '+' : '-' }}{{ mv.quantity ?? 0 }}
              </td>

              <!-- Estado -->
              <td class="px-6 py-3.5">
                <BadgeApp
                  :label="pickingStatusLabels[mv.picking_status ?? ''] ?? (mv.picking_status ?? '')"
                  :variant="pickingStatusVariants[mv.picking_status ?? ''] ?? 'secondary'"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
