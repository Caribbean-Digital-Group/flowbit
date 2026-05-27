<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyProductForm, type ProductFormData } from '~/components/Product/Form.vue'
import type { TablesInsert } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const { createProduct, checkSkuExists } = useProduct()

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const formData = ref<ProductFormData>(createEmptyProductForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const mapFormToProductInsert = (value: ProductFormData): Omit<TablesInsert<'product'>, 'company_id'> => ({
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

const handleBack = () => {
  router.push('/admin/products')
}

const handleSave = async () => {
  errorMessage.value = null
  if (!formData.value.name.trim()) return

  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa antes de crear un producto.'
    return
  }

  const sku = formData.value.sku.trim()
  if (sku) {
    const skuTaken = await checkSkuExists(companyId, sku)
    if (skuTaken) {
      errorMessage.value = `El SKU "${sku}" ya está asignado a otro producto en esta empresa.`
      return
    }
  }

  isSaving.value = true
  try {
    const product = await createProduct(companyId, mapFormToProductInsert(formData.value))
    if (product) {
      router.push(`/admin/products/${product.id}`)
    } else {
      errorMessage.value = 'No se pudo crear el producto. Verifica tus permisos en la empresa seleccionada.'
    }
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  router.push('/admin/products')
}
</script>

<template>
  <CardSheet
    title="Nuevo Producto"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="!selectedCompanyId"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para poder registrar productos.
      </p>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <ProductForm v-model="formData" />
  </CardSheet>
</template>
