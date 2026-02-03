<script setup lang="ts">
import type { MenuOption } from '~/components/CardSheet.vue'

definePageMeta({
  layout: 'admin'
})

const route = useRoute()
const router = useRouter()
const { id } = route.params

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO REACTIVO
// ═══════════════════════════════════════════════════════════════════════════
const isEditing = ref(false)
const isLoading = ref(false)

// Datos del producto (normalmente vendrían de una API)
const product = reactive({
  // Información básica
  name: 'Laptop HP Pavilion 15',
  display_name: 'HP Pavilion 15',
  product_type: 'product' as 'product' | 'service' | 'others',
  description: 'Laptop de alto rendimiento con procesador Intel Core i7, 16GB RAM y 512GB SSD',
  short_description: 'Laptop HP con Intel i7',
  
  // Códigos e identificación
  sku: 'HP-PAV-15-001',
  barcode: '7501234567890',
  internal_ref: 'PROD-001',
  
  // Categoría
  category_id: null as string | null,
  
  // Precios
  sale_price: 18999.00,
  cost_price: 15000.00,
  list_price: 21999.00,
  currency: 'MXN',
  tax_rate: 16.00,
  tax_included: false,
  
  // Inventario
  is_stockable: true,
  stock_quantity: 25,
  stock_min: 5,
  stock_max: 100,
  tracking: 'serial' as 'none' | 'lot' | 'serial',
  
  // Dimensiones
  weight: 2.1,
  weight_unit: 'kg',
  length: 36.0,
  width: 24.0,
  height: 2.0,
  volume: 0.0017,
  
  // Ventas y compras
  can_be_sold: true,
  can_be_purchased: true,
  is_published: true,
  featured: false,
  
  // Proveedor
  default_supplier_id: null as string | null,
  supplier_sku: 'HP-PAV15-7GEN',
  lead_time: 7,
  
  // Estado
  status: 'active' as 'active' | 'inactive' | 'discontinued' | 'out_of_stock' | 'coming_soon',
  
  // Media
  image_url: 'https://example.com/images/laptop.jpg',
  
  // SEO
  meta_title: 'Laptop HP Pavilion 15 - Comprar Online',
  meta_description: 'Compra la mejor laptop HP Pavilion 15 con Intel i7, 16GB RAM',
  
  // Notas
  notes: 'Producto importado, verificar disponibilidad',
  
  // Metadata
  created_at: '2026-01-20T09:00:00Z',
  updated_at: '2026-01-30T14:30:00Z',
  created_by: 'Carlos Martínez',
  updated_by: 'Ana López'
})

// Opciones para selects
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

// ═══════════════════════════════════════════════════════════════════════════
// OPCIONES DEL MENÚ DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTED PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el margen de ganancia
 */
const profitMargin = computed(() => {
  if (product.cost_price > 0) {
    return (((product.sale_price - product.cost_price) / product.cost_price) * 100).toFixed(2)
  }
  return '0.00'
})

/**
 * Calcula el precio con impuesto
 */
const priceWithTax = computed(() => {
  if (product.tax_included) {
    return product.sale_price
  }
  return product.sale_price * (1 + product.tax_rate / 100)
})

/**
 * Indica si el stock está bajo
 */
const isLowStock = computed(() => {
  return product.is_stockable && product.stock_quantity <= product.stock_min
})

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evento @back - Se dispara al hacer click en el botón de retroceso
 */
const handleBack = () => {
  console.log('Evento: @back')
  router.push('/admin/products')
}

/**
 * Evento @options - Se dispara al hacer click en el botón de opciones (3 puntos)
 */
const handleOptions = () => {
  console.log('Evento: @options (sin menuOptions)')
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS DE OPCIONES DEL MENÚ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Duplicar el registro actual
 */
const handleDuplicate = () => {
  console.log('Acción: Duplicar producto', id)
}

/**
 * Exportar el registro a PDF
 */
const handleExportPDF = () => {
  console.log('Acción: Exportar PDF', id)
}

/**
 * Archivar el registro
 */
const handleArchive = () => {
  console.log('Acción: Archivar producto', id)
}

/**
 * Eliminar el registro
 */
const handleDelete = () => {
  console.log('Acción: Eliminar producto', id)
}

/**
 * Evento @edit - Se dispara al hacer click en el botón "Editar"
 */
const handleEdit = () => {
  console.log('Evento: @edit')
  isEditing.value = true
}

/**
 * Evento @save - Se dispara al hacer click en el botón "Guardar" (modo edición)
 */
const handleSave = async () => {
  console.log('Evento: @save')
  isLoading.value = true
  
  try {
    // Simular guardado
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Datos guardados:', product)
    isEditing.value = false
  } catch (error) {
    console.error('Error al guardar:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Evento @cancel - Se dispara al hacer click en el botón "Cancelar" (modo edición)
 */
const handleCancel = () => {
  console.log('Evento: @cancel')
  isEditing.value = false
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formatea una fecha ISO a formato legible
 */
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

/**
 * Formatea precio con moneda
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: product.currency
  }).format(value)
}

/**
 * Obtener label del tipo de producto
 */
const getProductTypeLabel = (type: string): string => {
  const option = productTypeOptions.find(opt => opt.value === type)
  return option?.label || type
}

/**
 * Obtener label del estado
 */
const getStatusLabel = (status: string): string => {
  const option = statusOptions.find(opt => opt.value === status)
  return option?.label || status
}

/**
 * Obtener variante del badge de estado
 */
const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'primary' | 'secondary' => {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
    active: 'success',
    inactive: 'secondary',
    discontinued: 'danger',
    out_of_stock: 'warning',
    coming_soon: 'primary'
  }
  return variants[status] || 'secondary'
}
</script>

<template>
  <div>
    <CardSheet
      :title="product.name"
      :subtitle="`SKU: ${product.sku}`"
      :show-back-button="true"
      :show-options-button="true"
      :show-edit-button="true"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="product.created_by"
      :created-at="formatDate(product.created_at)"
      :updated-by="product.updated_by"
      :updated-at="formatDate(product.updated_at)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      :full-height="false"
      @back="handleBack"
      @options="handleOptions"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT #status: Badge de estado junto al título                        -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <template #status>
        <div class="flex items-center gap-2">
          <BadgeApp 
            :label="getProductTypeLabel(product.product_type)" 
            variant="primary" 
          />
          <BadgeApp 
            :label="getStatusLabel(product.status)" 
            :variant="getStatusVariant(product.status)" 
          />
          <BadgeApp 
            v-if="isLowStock"
            label="Stock Bajo" 
            variant="warning" 
          />
        </div>
      </template>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT DEFAULT: Contenido principal del card                           -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <!-- INFORMACIÓN BÁSICA                                                  -->
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
            Información Básica
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <FormInput
                v-model="product.name"
                label="Nombre"
                placeholder="Nombre del producto"
                :readonly="!isEditing"
                required
                size="md"
              />
            </div>
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="product.display_name"
                label="Nombre para mostrar"
                placeholder="Nombre comercial o alias"
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <FormSelect
              v-model="product.product_type"
              label="Tipo de Producto"
              :options="productTypeOptions"
              :readonly="!isEditing"
              required
              size="md"
            />
            
            <FormSelect
              v-model="product.status"
              label="Estado"
              :options="statusOptions"
              :readonly="!isEditing"
              required
              size="md"
            />
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="product.short_description"
                label="Descripción Corta"
                placeholder="Breve descripción del producto"
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="product.description"
                label="Descripción Completa"
                placeholder="Descripción detallada del producto"
                :readonly="!isEditing"
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
              v-model="product.sku"
              label="SKU"
              placeholder="Código único del producto"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="product.barcode"
              label="Código de Barras"
              placeholder="EAN, UPC, etc."
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="product.internal_ref"
              label="Referencia Interna"
              placeholder="Código interno"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="product.supplier_sku"
              label="SKU del Proveedor"
              placeholder="Código del proveedor"
              :readonly="!isEditing"
              size="md"
            />
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────────────────── -->
        <!-- PRECIOS E INVENTARIO                                               -->
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
            Precios
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              v-model="product.sale_price"
              type="number"
              label="Precio de Venta"
              placeholder="0.00"
              :readonly="!isEditing"
              required
              size="md"
            />
            
            <FormInput
              v-model="product.cost_price"
              type="number"
              label="Precio de Costo"
              placeholder="0.00"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="product.list_price"
              type="number"
              label="Precio de Lista"
              placeholder="0.00"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormSelect
              v-model="product.currency"
              label="Moneda"
              :options="currencyOptions"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="product.tax_rate"
              type="number"
              label="Tasa de Impuesto (%)"
              placeholder="16.00"
              :readonly="!isEditing"
              size="md"
            />
            
            <!-- Indicadores calculados (solo lectura) -->
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
                  v-model="product.is_stockable"
                  type="checkbox"
                  :disabled="!isEditing"
                  class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span class="text-sm text-slate-700">Gestionar inventario</span>
              </label>
            </div>
            
            <template v-if="product.is_stockable">
              <FormInput
                v-model="product.stock_quantity"
                type="number"
                label="Cantidad en Stock"
                placeholder="0"
                :readonly="!isEditing"
                size="md"
              />
              
              <FormSelect
                v-model="product.tracking"
                label="Tipo de Seguimiento"
                :options="trackingOptions"
                :readonly="!isEditing"
                size="md"
              />
              
              <FormInput
                v-model="product.stock_min"
                type="number"
                label="Stock Mínimo"
                placeholder="0"
                :readonly="!isEditing"
                size="md"
              />
              
              <FormInput
                v-model="product.stock_max"
                type="number"
                label="Stock Máximo"
                placeholder="0"
                :readonly="!isEditing"
                size="md"
              />
            </template>
            
            <FormInput
              v-model="product.lead_time"
              type="number"
              label="Tiempo de Entrega (días)"
              placeholder="0"
              :readonly="!isEditing"
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
                v-model="product.can_be_sold"
                type="checkbox"
                :disabled="!isEditing"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Puede venderse</span>
            </label>
            
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="product.can_be_purchased"
                type="checkbox"
                :disabled="!isEditing"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Puede comprarse</span>
            </label>
            
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="product.is_published"
                type="checkbox"
                :disabled="!isEditing"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Publicado en tienda</span>
            </label>
            
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="product.featured"
                type="checkbox"
                :disabled="!isEditing"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Producto destacado</span>
            </label>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT #sections: Secciones adicionales                                -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <template #sections>
        <div class="border-t border-slate-200 pt-6 space-y-6">
          <!-- Dimensiones y Peso -->
          <div>
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Dimensiones y Peso</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <FormInput
                v-model="product.weight"
                type="number"
                label="Peso (kg)"
                placeholder="0.00"
                :readonly="!isEditing"
                size="md"
              />
              
              <FormInput
                v-model="product.length"
                type="number"
                label="Largo (cm)"
                placeholder="0.00"
                :readonly="!isEditing"
                size="md"
              />
              
              <FormInput
                v-model="product.width"
                type="number"
                label="Ancho (cm)"
                placeholder="0.00"
                :readonly="!isEditing"
                size="md"
              />
              
              <FormInput
                v-model="product.height"
                type="number"
                label="Alto (cm)"
                placeholder="0.00"
                :readonly="!isEditing"
                size="md"
              />
              
              <FormInput
                v-model="product.volume"
                type="number"
                label="Volumen (m³)"
                placeholder="0.00"
                :readonly="!isEditing"
                size="md"
              />
            </div>
          </div>
          
          <!-- Notas -->
          <div>
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Notas Internas</h3>
            <FormInput
              v-model="product.notes"
              label=""
              placeholder="Notas internas sobre el producto..."
              :readonly="!isEditing"
              size="md"
            />
          </div>
        </div>
      </template>
    </CardSheet>
  </div>
</template>
