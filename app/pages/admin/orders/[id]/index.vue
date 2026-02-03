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
const activeTab = ref('other_info')

// Definición de tabs
const tabs = [
  { id: 'other_info', label: 'Otra Información', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'shipping', label: 'Envío', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { id: 'notes', label: 'Notas', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
]

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

/**
 * Dirección de envío formateada
 */
const formattedShippingAddress = computed(() => {
  const parts = [
    order.shipping_street,
    order.shipping_street2,
    [order.shipping_city, order.shipping_state, order.shipping_zip].filter(Boolean).join(', '),
    order.shipping_country_code
  ].filter(Boolean)
  return parts.join('\n')
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
      <!-- SLOT DEFAULT: Contenido principal - Estilo Odoo                      -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      
      <!-- ─────────────────────────────────────────────────────────────────────
           HEADER: Información principal de la orden (siempre visible)
           ───────────────────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
        <!-- Cliente/Proveedor -->
        <div class="lg:col-span-2">
          <FormInput
            v-model="order.partner_name"
            :label="order.order_type === 'sale' ? 'Cliente' : 'Proveedor'"
            placeholder="Seleccionar..."
            :readonly="!isEditing"
            required
            size="md"
          />
        </div>
        
        <!-- Fecha de Orden -->
        <div>
          <FormInput
            v-model="order.order_date"
            type="date"
            label="Fecha de Orden"
            :readonly="!isEditing"
            required
            size="md"
          />
        </div>
        
        <!-- Fecha de Entrega -->
        <div>
          <FormInput
            v-model="order.delivery_date"
            type="date"
            label="Fecha de Entrega"
            :readonly="!isEditing"
            size="md"
          />
        </div>
        
        <!-- Referencia -->
        <div>
          <FormInput
            v-model="order.reference"
            label="Referencia"
            placeholder="Ref. externa"
            :readonly="!isEditing"
            size="md"
          />
        </div>
        
        <!-- Moneda -->
        <div>
          <FormSelect
            v-model="order.currency"
            label="Moneda"
            :options="currencyOptions"
            :readonly="!isEditing"
            size="md"
          />
        </div>
        
        <!-- Términos de Pago -->
        <div>
          <FormInput
            v-model="order.payment_term"
            label="Términos de Pago"
            placeholder="Ej: 30 días neto"
            :readonly="!isEditing"
            size="md"
          />
        </div>
        
        <!-- Fecha Vencimiento -->
        <div>
          <FormInput
            v-model="order.payment_due_date"
            type="date"
            label="Vencimiento de Pago"
            :readonly="!isEditing"
            size="md"
          />
        </div>
      </div>

      <!-- ─────────────────────────────────────────────────────────────────────
           LÍNEAS DE LA ORDEN (siempre visibles)
           ───────────────────────────────────────────────────────────────────── -->
      <div class="border-t border-slate-200 pt-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-800">Líneas de la Orden</h3>
          <BtnApp
            v-if="isEditing"
            label="Agregar Línea"
            variant="primary"
            size="sm"
            @click="() => console.log('Agregar línea')"
          />
        </div>
        
        <!-- Tabla de líneas -->
        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Producto
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                  Cantidad
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-32">
                  Precio Unit.
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                  Dto. %
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                  IVA %
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-36">
                  Subtotal
                </th>
                <th v-if="isEditing" class="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-200">
              <tr v-for="line in orderLines" :key="line.id" class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3">
                  <div class="text-sm font-medium text-slate-900">{{ line.product_name }}</div>
                  <div class="text-xs text-slate-500">{{ line.description }}</div>
                </td>
                <td class="px-4 py-3 text-right text-sm text-slate-900 font-medium">
                  {{ line.quantity }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-slate-900">
                  {{ formatCurrency(line.unit_price) }}
                </td>
                <td class="px-4 py-3 text-right text-sm text-slate-900">
                  <span v-if="line.discount_percent > 0" class="text-red-600">{{ line.discount_percent }}%</span>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-4 py-3 text-right text-sm text-slate-900">
                  {{ line.tax_rate }}%
                </td>
                <td class="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                  {{ formatCurrency(line.subtotal) }}
                </td>
                <td v-if="isEditing" class="px-4 py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button
                      class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="Editar"
                      @click="() => console.log('Editar línea', line.id)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar"
                      @click="() => console.log('Eliminar línea', line.id)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <!-- Fila vacía si no hay líneas -->
              <tr v-if="orderLines.length === 0">
                <td :colspan="isEditing ? 7 : 6" class="px-4 py-8 text-center text-slate-500">
                  <div class="flex flex-col items-center gap-2">
                    <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span class="text-sm">No hay líneas en esta orden</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Resumen de totales (estilo Odoo - alineado a la derecha) -->
        <div class="flex justify-end mt-4">
          <div class="w-full max-w-sm bg-slate-50 rounded-lg p-4 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Subtotal:</span>
              <span class="font-medium text-slate-800">{{ formatCurrency(order.amount_untaxed) }}</span>
            </div>
            <div v-if="order.amount_discount > 0" class="flex justify-between text-sm">
              <span class="text-slate-600">Descuento:</span>
              <span class="font-medium text-red-600">-{{ formatCurrency(order.amount_discount) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-slate-600">Impuestos:</span>
              <span class="font-medium text-slate-800">{{ formatCurrency(order.amount_tax) }}</span>
            </div>
            <div class="border-t border-slate-200 pt-2 flex justify-between">
              <span class="text-base font-semibold text-slate-800">Total:</span>
              <span class="text-base font-bold text-indigo-600">{{ formatCurrency(order.amount_total) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- SLOT #sections: Tabs adicionales (estilo Odoo)                       -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <template #sections>
        <div class="border-t border-slate-200 pt-6">
          <!-- Tab Navigation -->
          <div class="border-b border-slate-200">
            <nav class="flex gap-1" aria-label="Tabs">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                class="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg"
                :class="[
                  activeTab === tab.id
                    ? 'text-indigo-600 bg-white border border-slate-200 border-b-white -mb-px'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                ]"
                @click="activeTab = tab.id"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
                </svg>
                {{ tab.label }}
              </button>
            </nav>
          </div>
          
          <!-- Tab Content -->
          <div class="pt-6">
            <!-- ═══════════════════════════════════════════════════════════════
                 TAB: Otra Información
                 ═══════════════════════════════════════════════════════════════ -->
            <div v-show="activeTab === 'other_info'" class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Columna 1: Configuración de Impuestos -->
                <div class="space-y-4">
                  <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Configuración Fiscal
                  </h4>
                  <div class="space-y-4 bg-slate-50 rounded-lg p-4">
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
                        <span class="text-sm text-slate-700">Impuesto incluido</span>
                      </label>
                    </div>
                    <FormInput
                      v-model="order.exchange_rate"
                      type="number"
                      label="Tipo de Cambio"
                      placeholder="1.000000"
                      :readonly="!isEditing"
                      size="md"
                    />
                  </div>
                </div>
                
                <!-- Columna 2: Estado de Cumplimiento -->
                <div class="space-y-4">
                  <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Estado de Cumplimiento
                  </h4>
                  <div class="space-y-3 bg-slate-50 rounded-lg p-4">
                    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                      <input
                        v-model="order.is_invoiced"
                        type="checkbox"
                        :disabled="!isEditing"
                        class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span class="text-sm text-slate-700">Facturada</span>
                      </div>
                    </label>
                    
                    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                      <input
                        v-model="order.is_delivered"
                        type="checkbox"
                        :disabled="!isEditing"
                        class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span class="text-sm text-slate-700">Entregada</span>
                      </div>
                    </label>
                    
                    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                      <input
                        v-model="order.is_paid"
                        type="checkbox"
                        :disabled="!isEditing"
                        class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span class="text-sm text-slate-700">Pagada</span>
                      </div>
                    </label>
                  </div>
                </div>
                
                <!-- Columna 3: Métricas -->
                <div class="space-y-4">
                  <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Métricas
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="bg-green-50 rounded-lg p-3 text-center">
                      <p class="text-lg font-bold text-green-600">{{ formatCurrency(totalMargin) }}</p>
                      <p class="text-xs text-green-700">Margen</p>
                    </div>
                    <div class="bg-green-50 rounded-lg p-3 text-center">
                      <p class="text-lg font-bold text-green-600">{{ totalMarginPercent }}%</p>
                      <p class="text-xs text-green-700">% Margen</p>
                    </div>
                    <div class="bg-blue-50 rounded-lg p-3 text-center">
                      <p class="text-lg font-bold text-blue-600">{{ totalQuantity }}</p>
                      <p class="text-xs text-blue-700">Unidades</p>
                    </div>
                    <div class="bg-blue-50 rounded-lg p-3 text-center">
                      <p class="text-lg font-bold text-blue-600">{{ orderLines.length }}</p>
                      <p class="text-xs text-blue-700">Líneas</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Fechas adicionales -->
              <div v-if="order.confirmation_date" class="pt-4 border-t border-slate-100">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="flex items-center gap-3 text-sm">
                    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span class="text-slate-500">Confirmada el:</span>
                      <span class="ml-2 font-medium text-slate-700">{{ formatShortDate(order.confirmation_date) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════
                 TAB: Envío
                 ═══════════════════════════════════════════════════════════════ -->
            <div v-show="activeTab === 'shipping'" class="space-y-6">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Dirección de Envío -->
                <div class="space-y-4">
                  <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Dirección de Envío
                  </h4>
                  
                  <div class="space-y-4 bg-slate-50 rounded-lg p-4">
                    <FormInput
                      v-model="order.shipping_street"
                      label="Calle"
                      placeholder="Dirección principal"
                      :readonly="!isEditing"
                      size="md"
                    />
                    
                    <FormInput
                      v-model="order.shipping_street2"
                      label="Calle 2"
                      placeholder="Departamento, piso, oficina, etc."
                      :readonly="!isEditing"
                      size="md"
                    />
                    
                    <div class="grid grid-cols-2 gap-4">
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
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
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
                
                <!-- Vista previa de dirección -->
                <div class="space-y-4">
                  <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Vista Previa
                  </h4>
                  <div class="bg-white border border-slate-200 rounded-lg p-6">
                    <div class="flex items-start gap-4">
                      <div class="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div class="flex-1">
                        <p class="font-medium text-slate-900">{{ order.partner_name }}</p>
                        <div class="mt-2 text-sm text-slate-600 space-y-0.5">
                          <p v-if="order.shipping_street">{{ order.shipping_street }}</p>
                          <p v-if="order.shipping_street2">{{ order.shipping_street2 }}</p>
                          <p v-if="order.shipping_city || order.shipping_state || order.shipping_zip">
                            {{ [order.shipping_city, order.shipping_state, order.shipping_zip].filter(Boolean).join(', ') }}
                          </p>
                          <p v-if="order.shipping_country_code" class="font-medium">{{ order.shipping_country_code }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Información de entrega -->
                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div class="flex items-start gap-3">
                      <svg class="w-5 h-5 text-amber-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p class="text-sm font-medium text-amber-800">Fecha de entrega estimada</p>
                        <p class="text-sm text-amber-700 mt-1">{{ formatShortDate(order.delivery_date) }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ═══════════════════════════════════════════════════════════════
                 TAB: Notas
                 ═══════════════════════════════════════════════════════════════ -->
            <div v-show="activeTab === 'notes'" class="space-y-6">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Notas Internas -->
                <div class="space-y-4">
                  <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Notas Internas
                  </h4>
                  <div class="bg-slate-50 rounded-lg p-4">
                    <textarea
                      v-model="order.notes"
                      :readonly="!isEditing"
                      rows="6"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      :class="{ 'bg-white': isEditing, 'bg-slate-100 cursor-default': !isEditing }"
                      placeholder="Notas internas sobre la orden (no visibles para el cliente)..."
                    />
                    <p class="mt-2 text-xs text-slate-500">
                      Estas notas son solo para uso interno y no se mostrarán al cliente.
                    </p>
                  </div>
                </div>
                
                <!-- Términos y Condiciones -->
                <div class="space-y-4">
                  <h4 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Términos y Condiciones
                  </h4>
                  <div class="bg-slate-50 rounded-lg p-4">
                    <textarea
                      v-model="order.terms"
                      :readonly="!isEditing"
                      rows="6"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      :class="{ 'bg-white': isEditing, 'bg-slate-100 cursor-default': !isEditing }"
                      placeholder="Términos y condiciones de la orden..."
                    />
                    <p class="mt-2 text-xs text-slate-500">
                      Estos términos se mostrarán en los documentos impresos de la orden.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </CardSheet>
  </div>
</template>
