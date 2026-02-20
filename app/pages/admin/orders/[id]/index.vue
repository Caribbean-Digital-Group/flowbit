<script setup lang="ts">
import type { MenuOption } from '~/components/CardSheet.vue'
import type { OrderFormData, OrderLine } from '~/components/Order/Form.vue'

definePageMeta({
  layout: 'admin'
})

const route = useRoute()
const router = useRouter()
const { id } = route.params

const isEditing = ref(false)
const isLoading = ref(false)

const formData = ref<OrderFormData>({
  name: 'SO-000125',
  order_type: 'sale',
  reference: 'PO-CLIENT-2026-001',
  order_state: 'draft',
  partner_id: '123e4567-e89b-12d3-a456-426614174000',
  partner_name: 'Corporativo ABC S.A. de C.V.',
  created_by_partner_id: null,
  created_by_partner_name: 'Juan Pérez',
  order_date: '2026-01-30',
  confirmation_date: null,
  delivery_date: '2026-02-15',
  currency: 'MXN',
  exchange_rate: 1.000000,
  tax_rate: 16.00,
  tax_included: false,
  amount_untaxed: 45000.00,
  amount_tax: 7200.00,
  amount_total: 52200.00,
  amount_discount: 2500.00,
  payment_term: '30 días neto',
  payment_due_date: '2026-03-01',
  shipping_street: 'Av. Reforma 222',
  shipping_street2: 'Piso 15, Oficina 1501',
  shipping_city: 'Ciudad de México',
  shipping_state: 'CDMX',
  shipping_zip: '06600',
  shipping_country_code: 'MX',
  notes: 'Entregar en horario de oficina. Contactar a recepción.',
  terms: 'Precio válido por 15 días. Sujeto a disponibilidad de inventario.',
  is_invoiced: false,
  is_delivered: false,
  is_paid: false
})

const orderLines = ref<OrderLine[]>([
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

const metadata = reactive({
  created_at: '2026-01-30T09:00:00Z',
  updated_at: '2026-01-30T14:30:00Z',
  created_by: 'Carlos Martínez',
  updated_by: 'Ana López'
})

const orderTypeLabels: Record<string, string> = {
  sale: 'Venta',
  purchase: 'Compra'
}

const stateLabels: Record<string, string> = {
  draft: 'Borrador',
  posted: 'Confirmada',
  cancel: 'Cancelada'
}

const stateVariants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  draft: 'secondary',
  posted: 'success',
  cancel: 'danger'
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
    id: 'post',
    label: 'Confirmar Orden',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    action: () => handlePostOrder(),
    variant: 'success'
  },
  {
    id: 'cancel-order',
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

const canEdit = computed(() => formData.value.order_state === 'draft')

const canPost = computed(() => {
  return formData.value.order_state === 'draft' && orderLines.value.length > 0
})

const canCancel = computed(() => {
  return formData.value.order_state !== 'cancel' && !formData.value.is_delivered && !formData.value.is_invoiced
})

const handleBack = () => {
  router.push('/admin/orders')
}

const handleDuplicate = () => {
  console.error('Acción: Duplicar orden', id)
}

const handleExportPDF = () => {
  console.error('Acción: Exportar PDF', id)
}

const handlePostOrder = () => {
  if (canPost.value) {
    formData.value.order_state = 'posted'
    formData.value.confirmation_date = new Date().toISOString()
  }
}

const handleCancelOrder = () => {
  if (canCancel.value) {
    formData.value.order_state = 'cancel'
  }
}

const handleDelete = () => {
  console.error('Acción: Eliminar orden', id)
}

const handleEdit = () => {
  if (canEdit.value) {
    isEditing.value = true
  }
}

const handleSave = async () => {
  isLoading.value = true

  try {
    // TODO: integrate with useOrder composable
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
</script>

<template>
  <div>
    <CardSheet
      :title="formData.name"
      :subtitle="`${orderTypeLabels[formData.order_type] || formData.order_type} - ${formData.partner_name}`"
      :show-back-button="true"
      :show-options-button="true"
      :show-edit-button="canEdit"
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
            :label="orderTypeLabels[formData.order_type] || formData.order_type"
            :variant="formData.order_type === 'sale' ? 'primary' : 'warning'"
          />
          <BadgeApp
            :label="stateLabels[formData.order_state] || formData.order_state"
            :variant="stateVariants[formData.order_state] || 'secondary'"
          />
          <BadgeApp
            v-if="formData.is_paid"
            label="Pagada"
            variant="success"
          />
          <BadgeApp
            v-if="formData.is_delivered"
            label="Entregada"
            variant="success"
          />
          <BadgeApp
            v-if="formData.is_invoiced"
            label="Facturada"
            variant="primary"
          />
        </div>
      </template>

      <OrderForm
        v-model="formData"
        v-model:lines="orderLines"
        :readonly="!isEditing"
      />
    </CardSheet>
  </div>
</template>
