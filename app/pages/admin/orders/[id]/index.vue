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

// Datos de la orden (normalmente vendrían de una API)
const order = reactive({
  // Información básica
  name: 'SO-000125',
  order_type: 'sale' as 'purchase' | 'sale',
  reference: 'PO-CLIENT-2026-001',
  order_state: 'draft' as 'draft' | 'posted' | 'cancel',
  
  // Partner (Cliente/Proveedor)
  partner_id: '123e4567-e89b-12d3-a456-426614174000',
  partner_name: 'Corporativo ABC S.A. de C.V.',
  created_by_partner_id: null as string | null,
  created_by_partner_name: 'Juan Pérez',
  
  // Fechas
  order_date: '2026-01-30',
  confirmation_date: null as string | null,
  delivery_date: '2026-02-15',
  
  // Moneda y tipo de cambio
  currency: 'MXN',
  exchange_rate: 1.000000,
  
  // Configuración de impuestos
  tax_rate: 16.00,
  tax_included: false,
  
  // Montos (calculados desde líneas)
  amount_untaxed: 45000.00,
  amount_tax: 7200.00,
  amount_total: 52200.00,
  amount_discount: 2500.00,
  
  // Términos de pago
  payment_term: '30 días neto',
  payment_due_date: '2026-03-01',
  
  // Dirección de envío
  shipping_street: 'Av. Reforma 222',
  shipping_street2: 'Piso 15, Oficina 1501',
  shipping_city: 'Ciudad de México',
  shipping_state: 'CDMX',
  shipping_zip: '06600',
  shipping_country_code: 'MX',
  
  // Información adicional
  notes: 'Entregar en horario de oficina. Contactar a recepción.',
  terms: 'Precio válido por 15 días. Sujeto a disponibilidad de inventario.',
  
  // Flags de estado
  is_invoiced: false,
  is_delivered: false,
  is_paid: false,
  
  // Metadata
  created_at: '2026-01-30T09:00:00Z',
  updated_at: '2026-01-30T14:30:00Z',
  created_by: 'Carlos Martínez',
  updated_by: 'Ana López'
})

// Líneas de la orden (ejemplo)
const orderLines = ref([
  {
    id: '1',
    sequence: 10,
    product_id: 'prod-001',
    product_name: 'Laptop HP Pavilion 15',
    description: 'Laptop HP Pavilion 15 con Intel Core i7',
    quantity: 5,
    quantity_delivered: 0,
    quantity_invoiced: 0,
    unit_price: 18999.00,
    unit_cost: 15000.00,
    discount_percent: 5.00,
    discount_amount: 4749.75,
    tax_rate: 16.00,
    tax_amount: 14439.62,
    subtotal: 90245.25,
    total: 104684.87,
    margin: 15245.25,
    margin_percent: 16.89
  },
  {
    id: '2',
    sequence: 20,
    product_id: 'prod-002',
    product_name: 'Mouse Logitech MX Master 3',
    description: 'Mouse inalámbrico ergonómico',
    quantity: 10,
    quantity_delivered: 0,
    quantity_invoiced: 0,
    unit_price: 1999.00,
    unit_cost: 1200.00,
    discount_percent: 0.00,
    discount_amount: 0.00,
    tax_rate: 16.00,
    tax_amount: 3198.40,
    subtotal: 19990.00,
    total: 23188.40,
    margin: 7990.00,
    margin_percent: 39.97
  }
])

// Opciones para selects
const orderTypeOptions = [
  { value: 'sale', label: 'Venta' },
  { value: 'purchase', label: 'Compra' }
]

const orderStateOptions = [
  { value: 'draft', label: 'Borrador' },
  { value: 'posted', label: 'Confirmada' },
  { value: 'cancel', label: 'Cancelada' }
]

const currencyOptions = [
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'USD', label: 'USD - Dólar Americano' },
  { value: 'EUR', label: 'EUR - Euro' }
]

const paymentTermOptions = [
  { value: 'immediate', label: 'Pago inmediato' },
  { value: '15_days', label: '15 días neto' },
  { value: '30_days', label: '30 días neto' },
  { value: '45_days', label: '45 días neto' },
  { value: '60_days', label: '60 días neto' }
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
    id: 'post',
    label: 'Confirmar Orden',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    action: () => handlePostOrder(),
    variant: 'success'
  },
  {
    id: 'cancel',
    label: 'Cancelar Orden',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    action: () => handleCancelOrder(),
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
 * Calcula el margen total de la orden
 */
const totalMargin = computed(() => {
  return orderLines.value.reduce((sum, line) => sum + line.margin, 0)
})

/**
 * Calcula el porcentaje de margen total
 */
const totalMarginPercent = computed(() => {
  if (order.amount_untaxed > 0) {
    return ((totalMargin.value / order.amount_untaxed) * 100).toFixed(2)
  }
  return '0.00'
})

/**
 * Cantidad total de productos
 */
const totalQuantity = computed(() => {
  return orderLines.value.reduce((sum, line) => sum + line.quantity, 0)
})

/**
 * Indica si la orden puede ser editada
 */
const canEdit = computed(() => {
  return order.order_state === 'draft'
})

/**
 * Indica si la orden puede ser confirmada
 */
const canPost = computed(() => {
  return order.order_state === 'draft' && orderLines.value.length > 0
})

/**
 * Indica si la orden puede ser cancelada
 */
const canCancel = computed(() => {
  return order.order_state !== 'cancel' && !order.is_delivered && !order.is_invoiced
})

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS DE EVENTOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evento @back - Se dispara al hacer click en el botón de retroceso
 */
const handleBack = () => {
  console.log('Evento: @back')
  router.push('/admin/orders')
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
  console.log('Acción: Duplicar orden', id)
}

/**
 * Exportar el registro a PDF
 */
const handleExportPDF = () => {
  console.log('Acción: Exportar PDF', id)
}

/**
 * Confirmar/Postear la orden
 */
const handlePostOrder = () => {
  console.log('Acción: Confirmar orden', id)
  if (canPost.value) {
    order.order_state = 'posted'
    order.confirmation_date = new Date().toISOString()
  }
}

/**
 * Cancelar la orden
 */
const handleCancelOrder = () => {
  console.log('Acción: Cancelar orden', id)
  if (canCancel.value) {
    order.order_state = 'cancel'
  }
}

/**
 * Eliminar el registro
 */
const handleDelete = () => {
  console.log('Acción: Eliminar orden', id)
}

/**
 * Evento @edit - Se dispara al hacer click en el botón "Editar"
 */
const handleEdit = () => {
  console.log('Evento: @edit')
  if (canEdit.value) {
    isEditing.value = true
  }
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
    console.log('Datos guardados:', order)
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
const formatDate = (dateString: string | null): string => {
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
 * Formatea una fecha corta
 */
const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Formatea precio con moneda
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: order.currency
  }).format(value)
}

/**
 * Obtener label del tipo de orden
 */
const getOrderTypeLabel = (type: string): string => {
  const option = orderTypeOptions.find(opt => opt.value === type)
  return option?.label || type
}

/**
 * Obtener label del estado
 */
const getStateLabel = (state: string): string => {
  const option = orderStateOptions.find(opt => opt.value === state)
  return option?.label || state
}

/**
 * Obtener variante del badge de estado
 */
const getStateVariant = (state: string): 'success' | 'warning' | 'danger' | 'primary' | 'secondary' => {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
    draft: 'secondary',
    posted: 'success',
    cancel: 'danger'
  }
  return variants[state] || 'secondary'
}

/**
 * Obtener variante del badge de tipo de orden
 */
const getOrderTypeVariant = (type: string): 'success' | 'warning' | 'danger' | 'primary' | 'secondary' => {
  return type === 'sale' ? 'primary' : 'warning'
}
</script>

<template>
  <div>
    <CardSheet
      :title="order.name"
      :subtitle="`${getOrderTypeLabel(order.order_type)} - ${order.partner_name}`"
      :show-back-button="true"
      :show-options-button="true"
      :show-edit-button="canEdit"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="order.created_by"
      :created-at="formatDate(order.created_at)"
      :updated-by="order.updated_by"
      :updated-at="formatDate(order.updated_at)"
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
            :label="getOrderTypeLabel(order.order_type)" 
            :variant="getOrderTypeVariant(order.order_type)" 
          />
          <BadgeApp 
            :label="getStateLabel(order.order_state)" 
            :variant="getStateVariant(order.order_state)" 
          />
          <BadgeApp 
            v-if="order.is_paid"
            label="Pagada" 
            variant="success" 
          />
          <BadgeApp 
            v-if="order.is_delivered"
            label="Entregada" 
            variant="success" 
          />
          <BadgeApp 
            v-if="order.is_invoiced"
            label="Facturada" 
            variant="primary" 
          />
        </div>
      </template>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT DEFAULT: Contenido principal del card                           -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <!-- INFORMACIÓN DE LA ORDEN                                             -->
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
            Información de la Orden
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              v-model="order.name"
              label="Número de Orden"
              placeholder="Auto-generado"
              readonly
              size="md"
            />
            
            <FormSelect
              v-model="order.order_type"
              label="Tipo de Orden"
              :options="orderTypeOptions"
              :readonly="!isEditing"
              required
              size="md"
            />
            
            <FormInput
              v-model="order.reference"
              label="Referencia Externa"
              placeholder="PO del cliente, factura del proveedor, etc."
              :readonly="!isEditing"
              size="md"
            />
            
            <FormSelect
              v-model="order.order_state"
              label="Estado"
              :options="orderStateOptions"
              readonly
              size="md"
            />
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="order.partner_name"
                :label="order.order_type === 'sale' ? 'Cliente' : 'Proveedor'"
                placeholder="Seleccionar..."
                :readonly="!isEditing"
                required
                size="md"
              />
            </div>
          </div>
          
          <!-- Fechas -->
          <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
            Fechas
          </h4>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              v-model="order.order_date"
              type="date"
              label="Fecha de Orden"
              :readonly="!isEditing"
              required
              size="md"
            />
            
            <FormInput
              v-model="order.delivery_date"
              type="date"
              label="Fecha de Entrega"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-if="order.confirmation_date"
              :model-value="formatShortDate(order.confirmation_date)"
              label="Fecha de Confirmación"
              readonly
              size="md"
            />
            
            <FormInput
              v-model="order.payment_due_date"
              type="date"
              label="Fecha de Vencimiento"
              :readonly="!isEditing"
              size="md"
            />
          </div>
          
          <!-- Términos de Pago y Moneda -->
          <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
            Términos de Pago
          </h4>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              v-model="order.currency"
              label="Moneda"
              :options="currencyOptions"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="order.exchange_rate"
              type="number"
              label="Tipo de Cambio"
              placeholder="1.000000"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="order.payment_term"
              label="Términos de Pago"
              placeholder="Ej: 30 días neto"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="order.tax_rate"
              type="number"
              label="Tasa de Impuesto (%)"
              placeholder="16.00"
              :readonly="!isEditing"
              size="md"
            />
            
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="order.tax_included"
                  type="checkbox"
                  :disabled="!isEditing"
                  class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span class="text-sm text-slate-700">Impuesto incluido en precios</span>
              </label>
            </div>
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────────────────── -->
        <!-- TOTALES Y RESUMEN                                                   -->
        <!-- ─────────────────────────────────────────────────────────────────── -->
        <div class="space-y-6">
          <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
            Resumen de la Orden
          </h3>
          
          <!-- Totales -->
          <div class="bg-slate-50 rounded-lg p-6 space-y-4">
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Subtotal (antes de impuestos):</span>
              <span class="font-medium text-slate-800">{{ formatCurrency(order.amount_untaxed) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Descuento total:</span>
              <span class="font-medium text-red-600">-{{ formatCurrency(order.amount_discount) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Impuestos ({{ order.tax_rate }}%):</span>
              <span class="font-medium text-slate-800">{{ formatCurrency(order.amount_tax) }}</span>
            </div>
            <div class="border-t border-slate-200 pt-4 flex justify-between">
              <span class="text-lg font-semibold text-slate-800">Total:</span>
              <span class="text-lg font-bold text-indigo-600">{{ formatCurrency(order.amount_total) }}</span>
            </div>
          </div>
          
          <!-- Estadísticas -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-green-50 rounded-lg p-4 text-center">
              <p class="text-2xl font-bold text-green-600">{{ formatCurrency(totalMargin) }}</p>
              <p class="text-sm text-green-700">Margen Total</p>
              <p class="text-xs text-green-600">({{ totalMarginPercent }}%)</p>
            </div>
            <div class="bg-blue-50 rounded-lg p-4 text-center">
              <p class="text-2xl font-bold text-blue-600">{{ totalQuantity }}</p>
              <p class="text-sm text-blue-700">Productos</p>
              <p class="text-xs text-blue-600">{{ orderLines.length }} líneas</p>
            </div>
          </div>
          
          <!-- Estado de la orden -->
          <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
            Estado de Cumplimiento
          </h4>
          
          <div class="grid grid-cols-3 gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="order.is_invoiced"
                type="checkbox"
                :disabled="!isEditing"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Facturada</span>
            </label>
            
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="order.is_delivered"
                type="checkbox"
                :disabled="!isEditing"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Entregada</span>
            </label>
            
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="order.is_paid"
                type="checkbox"
                :disabled="!isEditing"
                class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">Pagada</span>
            </label>
          </div>
          
          <!-- Dirección de Envío -->
          <h4 class="text-base font-medium text-slate-700 border-b border-slate-100 pb-2 mt-6">
            Dirección de Envío
          </h4>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <FormInput
                v-model="order.shipping_street"
                label="Calle"
                placeholder="Dirección principal"
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <div class="sm:col-span-2">
              <FormInput
                v-model="order.shipping_street2"
                label="Calle 2"
                placeholder="Depto, piso, oficina, etc."
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <FormInput
              v-model="order.shipping_city"
              label="Ciudad"
              placeholder="Ciudad"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="order.shipping_state"
              label="Estado/Provincia"
              placeholder="Estado"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="order.shipping_zip"
              label="Código Postal"
              placeholder="CP"
              :readonly="!isEditing"
              size="md"
            />
            
            <FormInput
              v-model="order.shipping_country_code"
              label="País"
              placeholder="MX"
              :readonly="!isEditing"
              size="md"
            />
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT #sections: Secciones adicionales                                -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <template #sections>
        <div class="border-t border-slate-200 pt-6 space-y-6">
          <!-- Líneas de la Orden -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-slate-800">Líneas de la Orden</h3>
              <BtnApp
                v-if="isEditing"
                label="Agregar Línea"
                variant="primary"
                size="sm"
                @click="() => console.log('Agregar línea')"
              />
            </div>
            
            <!-- Tabla de líneas -->
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Precio Unit.
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Descuento
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Impuesto
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Subtotal
                    </th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th v-if="isEditing" class="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200">
                  <tr v-for="line in orderLines" :key="line.id" class="hover:bg-slate-50">
                    <td class="px-4 py-4">
                      <div class="text-sm font-medium text-slate-900">{{ line.product_name }}</div>
                      <div class="text-sm text-slate-500">{{ line.description }}</div>
                    </td>
                    <td class="px-4 py-4 text-right text-sm text-slate-900">
                      {{ line.quantity }}
                    </td>
                    <td class="px-4 py-4 text-right text-sm text-slate-900">
                      {{ formatCurrency(line.unit_price) }}
                    </td>
                    <td class="px-4 py-4 text-right text-sm text-slate-900">
                      {{ line.discount_percent }}%
                      <span class="text-slate-500">({{ formatCurrency(line.discount_amount) }})</span>
                    </td>
                    <td class="px-4 py-4 text-right text-sm text-slate-900">
                      {{ line.tax_rate }}%
                      <span class="text-slate-500">({{ formatCurrency(line.tax_amount) }})</span>
                    </td>
                    <td class="px-4 py-4 text-right text-sm text-slate-900">
                      {{ formatCurrency(line.subtotal) }}
                    </td>
                    <td class="px-4 py-4 text-right text-sm font-medium text-slate-900">
                      {{ formatCurrency(line.total) }}
                    </td>
                    <td v-if="isEditing" class="px-4 py-4 text-center">
                      <div class="flex items-center justify-center gap-2">
                        <button
                          class="text-indigo-600 hover:text-indigo-900"
                          @click="() => console.log('Editar línea', line.id)"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          class="text-red-600 hover:text-red-900"
                          @click="() => console.log('Eliminar línea', line.id)"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Notas y Términos -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 class="text-lg font-semibold text-slate-800 mb-4">Notas Internas</h3>
              <FormInput
                v-model="order.notes"
                label=""
                placeholder="Notas internas sobre la orden..."
                :readonly="!isEditing"
                size="md"
              />
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-slate-800 mb-4">Términos y Condiciones</h3>
              <FormInput
                v-model="order.terms"
                label=""
                placeholder="Términos y condiciones de la orden..."
                :readonly="!isEditing"
                size="md"
              />
            </div>
          </div>
        </div>
      </template>
    </CardSheet>
  </div>
</template>
