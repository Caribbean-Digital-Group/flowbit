<script lang="ts">
export interface ProductFormData {
  name: string
  display_name: string
  product_type: 'product' | 'service' | 'others'
  description: string
  short_description: string
  sku: string
  barcode: string
  internal_ref: string
  category_id: string | null
  sale_price: number
  cost_price: number
  list_price: number
  currency: string
  tax_rate: number
  tax_included: boolean
  is_stockable: boolean
  stock_quantity: number
  stock_min: number
  stock_max: number
  tracking: 'none' | 'lot' | 'serial'
  weight: number
  weight_unit: string
  length: number
  width: number
  height: number
  volume: number
  can_be_sold: boolean
  can_be_purchased: boolean
  is_published: boolean
  featured: boolean
  default_supplier_id: string | null
  supplier_sku: string
  lead_time: number
  status: 'active' | 'inactive' | 'discontinued' | 'out_of_stock' | 'coming_soon'
  image_url: string
  meta_title: string
  meta_description: string
  notes: string
}

export const createEmptyProductForm = (): ProductFormData => ({
  name: '',
  display_name: '',
  product_type: 'product',
  description: '',
  short_description: '',
  sku: '',
  barcode: '',
  internal_ref: '',
  category_id: null,
  sale_price: 0,
  cost_price: 0,
  list_price: 0,
  currency: 'MXN',
  tax_rate: 16.00,
  tax_included: false,
  is_stockable: true,
  stock_quantity: 0,
  stock_min: 0,
  stock_max: 0,
  tracking: 'none',
  weight: 0,
  weight_unit: 'kg',
  length: 0,
  width: 0,
  height: 0,
  volume: 0,
  can_be_sold: true,
  can_be_purchased: true,
  is_published: false,
  featured: false,
  default_supplier_id: null,
  supplier_sku: '',
  lead_time: 0,
  status: 'active',
  image_url: '',
  meta_title: '',
  meta_description: '',
  notes: ''
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const formData = defineModel<ProductFormData>({ required: true })

const productTypeOptions = [
  { value: 'product', label: 'Producto' },
  { value: 'service', label: 'Servicio' },
  { value: 'others', label: 'Otros' }
]

const statusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'discontinued', label: 'Descontinuado' },
  { value: 'out_of_stock', label: 'Sin Stock' },
  { value: 'coming_soon', label: 'Próximamente' }
]

const trackingOptions = [
  { value: 'none', label: 'Sin seguimiento' },
  { value: 'lot', label: 'Por lote' },
  { value: 'serial', label: 'Por número de serie' }
]

const currencyOptions = [
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'USD', label: 'USD - Dólar Americano' },
  { value: 'EUR', label: 'EUR - Euro' }
]

const profitMargin = computed(() => {
  if (formData.value.cost_price > 0) {
    return (((formData.value.sale_price - formData.value.cost_price) / formData.value.cost_price) * 100).toFixed(2)
  }
  return '0.00'
})

const priceWithTax = computed(() => {
  if (formData.value.tax_included) {
    return formData.value.sale_price
  }
  return formData.value.sale_price * (1 + formData.value.tax_rate / 100)
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: formData.value.currency
  }).format(value)
}
</script>

<template>
  <div class="space-y-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- INFORMACIÓN BÁSICA -->
      <div class="space-y-6">
        <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
          Información Básica
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <FormInput
              v-model="formData.name"
              label="Nombre"
              placeholder="Nombre del producto"
              :readonly="readonly"
              required
              size="md"
            />
          </div>

          <div class="sm:col-span-2">
            <FormInput
              v-model="formData.display_name"
              label="Nombre para mostrar"
              placeholder="Nombre comercial o alias"
              :readonly="readonly"
              size="md"
            />
          </div>

          <FormSelect
            v-model="formData.product_type"
            label="Tipo de Producto"
            :options="productTypeOptions"
            :readonly="readonly"
            required
            size="md"
          />

          <FormSelect
            v-model="formData.status"
            label="Estado"
            :options="statusOptions"
            :readonly="readonly"
            required
            size="md"
          />

          <div class="sm:col-span-2">
            <FormInput
              v-model="formData.short_description"
              label="Descripción Corta"
              placeholder="Breve descripción del producto"
              :readonly="readonly"
              size="md"
            />
          </div>

          <div class="sm:col-span-2">
            <FormInput
              v-model="formData.description"
              label="Descripción Completa"
              placeholder="Descripción detallada del producto"
              :readonly="readonly"
              size="md"
            />
          </div>
        </div>

        <!-- Códigos e Identificación -->
        <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
          Códigos e Identificación
        </h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            v-model="formData.sku"
            label="SKU"
            placeholder="Código único del producto"
            :readonly="readonly"
            size="md"
          />

          <FormInput
            v-model="formData.barcode"
            label="Código de Barras"
            placeholder="EAN, UPC, etc."
            :readonly="readonly"
            size="md"
          />

          <FormInput
            v-model="formData.internal_ref"
            label="Referencia Interna"
            placeholder="Código interno"
            :readonly="readonly"
            size="md"
          />

          <FormInput
            v-model="formData.supplier_sku"
            label="SKU del Proveedor"
            placeholder="Código del proveedor"
            :readonly="readonly"
            size="md"
          />
        </div>
      </div>

      <!-- PRECIOS E INVENTARIO -->
      <div class="space-y-6">
        <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
          Precios
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            v-model="formData.sale_price"
            type="number"
            label="Precio de Venta"
            placeholder="0.00"
            :readonly="readonly"
            required
            size="md"
          />

          <FormInput
            v-model="formData.cost_price"
            type="number"
            label="Precio de Costo"
            placeholder="0.00"
            :readonly="readonly"
            size="md"
          />

          <FormInput
            v-model="formData.list_price"
            type="number"
            label="Precio de Lista"
            placeholder="0.00"
            :readonly="readonly"
            size="md"
          />

          <FormSelect
            v-model="formData.currency"
            label="Moneda"
            :options="currencyOptions"
            :readonly="readonly"
            size="md"
          />

          <FormInput
            v-model="formData.tax_rate"
            type="number"
            label="Tasa de Impuesto (%)"
            placeholder="16.00"
            :readonly="readonly"
            size="md"
          />

          <div class="sm:col-span-2 bg-slate-50 rounded-lg p-4 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Precio con IVA:</span>
              <span class="font-medium text-slate-800">{{ formatCurrency(priceWithTax) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Margen de ganancia:</span>
              <span class="font-medium" :class="Number(profitMargin) >= 20 ? 'text-green-600' : 'text-amber-600'">
                {{ profitMargin }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Inventario -->
        <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
          Inventario
        </h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2 flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="formData.is_stockable"
                type="checkbox"
                :disabled="readonly"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Gestionar inventario</span>
            </label>
          </div>

          <template v-if="formData.is_stockable">
            <FormInput
              v-model="formData.stock_quantity"
              type="number"
              label="Cantidad en Stock"
              placeholder="0"
              :readonly="readonly"
              size="md"
            />

            <FormSelect
              v-model="formData.tracking"
              label="Tipo de Seguimiento"
              :options="trackingOptions"
              :readonly="readonly"
              size="md"
            />

            <FormInput
              v-model="formData.stock_min"
              type="number"
              label="Stock Mínimo"
              placeholder="0"
              :readonly="readonly"
              size="md"
            />

            <FormInput
              v-model="formData.stock_max"
              type="number"
              label="Stock Máximo"
              placeholder="0"
              :readonly="readonly"
              size="md"
            />
          </template>

          <FormInput
            v-model="formData.lead_time"
            type="number"
            label="Tiempo de Entrega (días)"
            placeholder="0"
            :readonly="readonly"
            size="md"
          />
        </div>

        <!-- Opciones de Venta -->
        <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
          Opciones de Venta
        </h4>

        <div class="grid grid-cols-2 gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="formData.can_be_sold"
              type="checkbox"
              :disabled="readonly"
              class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span class="text-sm text-slate-700">Puede venderse</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="formData.can_be_purchased"
              type="checkbox"
              :disabled="readonly"
              class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span class="text-sm text-slate-700">Puede comprarse</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="formData.is_published"
              type="checkbox"
              :disabled="readonly"
              class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span class="text-sm text-slate-700">Publicado en tienda</span>
          </label>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="formData.featured"
              type="checkbox"
              :disabled="readonly"
              class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span class="text-sm text-slate-700">Producto destacado</span>
          </label>
        </div>

        <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
          Imagen de la tienda
        </h4>

        <div class="space-y-4">
          <FormInput
            v-model="formData.image_url"
            type="url"
            label="URL de la imagen"
            placeholder="https://..."
            :readonly="readonly"
            size="md"
          />

          <div
            v-if="formData.image_url.trim()"
            class="w-32 h-32 rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
          >
            <img
              :src="formData.image_url.trim()"
              alt="Vista previa del producto"
              class="w-full h-full object-cover"
            />
          </div>
          <p v-else class="text-xs text-slate-500">
            La imagen se muestra en el catálogo y la ficha del producto en la tienda en línea.
          </p>
        </div>
      </div>
    </div>

    <!-- DIMENSIONES Y PESO -->
    <div class="border-t border-slate-200 pt-6">
      <h3 class="text-lg font-semibold text-slate-800 mb-4">Dimensiones y Peso</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <FormInput
          v-model="formData.weight"
          type="number"
          label="Peso (kg)"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.length"
          type="number"
          label="Largo (cm)"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.width"
          type="number"
          label="Ancho (cm)"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.height"
          type="number"
          label="Alto (cm)"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />

        <FormInput
          v-model="formData.volume"
          type="number"
          label="Volumen (m³)"
          placeholder="0.00"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>

    <!-- NOTAS -->
    <div class="border-t border-slate-200 pt-6">
      <h3 class="text-lg font-semibold text-slate-800 mb-4">Notas Internas</h3>
      <FormInput
        v-model="formData.notes"
        label=""
        placeholder="Notas internas sobre el producto..."
        :readonly="readonly"
        size="md"
      />
    </div>
  </div>
</template>
