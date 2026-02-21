<script setup lang="ts">
import type { MenuOption } from '~/components/CardSheet.vue'
import type { ProductFormData } from '~/components/Product/Form.vue'

definePageMeta({
  layout: 'admin'
})

const route = useRoute()
const router = useRouter()
const { id } = route.params

const isEditing = ref(false)
const isLoading = ref(false)

const formData = ref<ProductFormData>({
  name: 'Laptop HP Pavilion 15',
  display_name: 'HP Pavilion 15',
  product_type: 'product',
  description: 'Laptop de alto rendimiento con procesador Intel Core i7, 16GB RAM y 512GB SSD',
  short_description: 'Laptop HP con Intel i7',
  sku: 'HP-PAV-15-001',
  barcode: '7501234567890',
  internal_ref: 'PROD-001',
  category_id: null,
  sale_price: 18999.00,
  cost_price: 15000.00,
  list_price: 21999.00,
  currency: 'MXN',
  tax_rate: 16.00,
  tax_included: false,
  is_stockable: true,
  stock_quantity: 25,
  stock_min: 5,
  stock_max: 100,
  tracking: 'serial',
  weight: 2.1,
  weight_unit: 'kg',
  length: 36.0,
  width: 24.0,
  height: 2.0,
  volume: 0.0017,
  can_be_sold: true,
  can_be_purchased: true,
  is_published: true,
  featured: false,
  default_supplier_id: null,
  supplier_sku: 'HP-PAV15-7GEN',
  lead_time: 7,
  status: 'active',
  image_url: 'https://example.com/images/laptop.jpg',
  meta_title: 'Laptop HP Pavilion 15 - Comprar Online',
  meta_description: 'Compra la mejor laptop HP Pavilion 15 con Intel i7, 16GB RAM',
  notes: 'Producto importado, verificar disponibilidad'
})

const metadata = reactive({
  created_at: '2026-01-20T09:00:00Z',
  updated_at: '2026-01-30T14:30:00Z',
  created_by: 'Carlos Martínez',
  updated_by: 'Ana López'
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
    id: 'duplicate',
    label: 'Duplicar',
    icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
    action: () => handleDuplicate()
  },
  {
    id: 'export',
    label: 'Exportar PDF',
    icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    action: () => handleExportPDF()
  },
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => handleArchive(),
    variant: 'warning'
  },
  {
    id: 'delete',
    label: 'Eliminar',
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    action: () => handleDelete(),
    variant: 'danger',
    divider: true
  }
]

const isLowStock = computed(() => {
  return formData.value.is_stockable && formData.value.stock_quantity <= formData.value.stock_min
})

const handleBack = () => {
  router.push('/admin/products')
}

const handleDuplicate = () => {
  console.error('Acción: Duplicar producto', id)
}

const handleExportPDF = () => {
  console.error('Acción: Exportar PDF', id)
}

const handleArchive = () => {
  console.error('Acción: Archivar producto', id)
}

const handleDelete = () => {
  console.error('Acción: Eliminar producto', id)
}

const handleEdit = () => {
  isEditing.value = true
}

const handleSave = async () => {
  isLoading.value = true

  try {
    // TODO: integrate with useProduct composable
    await new Promise(resolve => setTimeout(resolve, 1000))
    isEditing.value = false
  } catch (error) {
    console.error('Error al guardar:', error)
  } finally {
    isLoading.value = false
  }
}

const handleCancel = () => {
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
</script>

<template>
  <div>
    <CardSheet
      :title="formData.name"
      :subtitle="`SKU: ${formData.sku}`"
      :show-back-button="true"
      :show-options-button="true"
      :show-edit-button="true"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="metadata.created_by"
      :created-at="formatDate(metadata.created_at)"
      :updated-by="metadata.updated_by"
      :updated-at="formatDate(metadata.updated_at)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      :full-height="false"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
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
