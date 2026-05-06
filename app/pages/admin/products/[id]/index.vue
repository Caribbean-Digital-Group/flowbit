<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyProductForm, type ProductFormData } from '~/components/Product/Form.vue'
import type { Tables, TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type Product = Tables<'product'>

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getProductById, updateProduct, archiveProduct } = useProduct()

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const product = ref<Product | null>(null)
const formData = ref<ProductFormData>(createEmptyProductForm())
const initialForm = ref<ProductFormData>(createEmptyProductForm())

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

watch([productId, selectedCompanyId], () => {
  isEditing.value = false
  void loadProduct()
}, { immediate: true })
</script>

<template>
  <div>
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
  </div>
</template>
