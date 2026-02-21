<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

import type { Column } from '~/components/Datatable.vue'

const columns: Column[] = [
  {
    key: 'order_name',
    label: 'Orden',
    type: 'avatar',
    subtitleKey: 'product_name'
  },
  {
    key: 'description',
    label: 'Descripción',
    type: 'text'
  },
  {
    key: 'quantity',
    label: 'Cantidad',
    type: 'number'
  },
  {
    key: 'unit_price',
    label: 'Precio Unit.',
    type: 'currency'
  },
  {
    key: 'subtotal',
    label: 'Subtotal',
    type: 'currency'
  },
  {
    key: 'total',
    label: 'Total',
    type: 'currency'
  }
]

const orderLines = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    order_id: '550e8400-e29b-41d4-a716-446655440001',
    order_name: 'SO-000001',
    product_name: 'Laptop HP Pavilion 15',
    description: 'Laptop HP Pavilion 15 con Intel Core i7, 16GB RAM',
    quantity: 5,
    unit_price: 18999.00,
    unit_cost: 15000.00,
    discount_percent: 5.00,
    discount_amount: 4749.75,
    tax_rate: 16.00,
    tax_amount: 14439.62,
    subtotal: 90245.25,
    total: 104684.87,
    currency: 'MXN'
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440002',
    order_id: '550e8400-e29b-41d4-a716-446655440001',
    order_name: 'SO-000001',
    product_name: 'Mouse Logitech MX Master 3',
    description: 'Mouse inalámbrico ergonómico',
    quantity: 10,
    unit_price: 1999.00,
    unit_cost: 1200.00,
    discount_percent: 0.00,
    discount_amount: 0.00,
    tax_rate: 16.00,
    tax_amount: 3198.40,
    subtotal: 19990.00,
    total: 23188.40,
    currency: 'MXN'
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440003',
    order_id: '550e8400-e29b-41d4-a716-446655440002',
    order_name: 'SO-000002',
    product_name: 'Monitor Dell 27"',
    description: 'Monitor Dell UltraSharp 27" 4K USB-C',
    quantity: 3,
    unit_price: 12500.00,
    unit_cost: 9800.00,
    discount_percent: 10.00,
    discount_amount: 3750.00,
    tax_rate: 16.00,
    tax_amount: 5400.00,
    subtotal: 33750.00,
    total: 39150.00,
    currency: 'MXN'
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440004',
    order_id: '550e8400-e29b-41d4-a716-446655440003',
    order_name: 'PO-000001',
    product_name: 'Teclado Mecánico Keychron K2',
    description: 'Teclado mecánico inalámbrico 75%',
    quantity: 20,
    unit_price: 2499.00,
    unit_cost: 1800.00,
    discount_percent: 15.00,
    discount_amount: 7497.00,
    tax_rate: 16.00,
    tax_amount: 6798.72,
    subtotal: 42492.00,
    total: 49290.72,
    currency: 'MXN'
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440005',
    order_id: '550e8400-e29b-41d4-a716-446655440004',
    order_name: 'SO-000003',
    product_name: 'Webcam Logitech C920',
    description: 'Cámara web Full HD 1080p',
    quantity: 8,
    unit_price: 1799.00,
    unit_cost: 1200.00,
    discount_percent: 0.00,
    discount_amount: 0.00,
    tax_rate: 16.00,
    tax_amount: 2302.72,
    subtotal: 14392.00,
    total: 16694.72,
    currency: 'MXN'
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440006',
    order_id: '550e8400-e29b-41d4-a716-446655440005',
    order_name: 'PO-000002',
    product_name: 'Audífonos Sony WH-1000XM5',
    description: 'Audífonos con cancelación de ruido',
    quantity: 15,
    unit_price: 6999.00,
    unit_cost: 5200.00,
    discount_percent: 8.00,
    discount_amount: 8398.80,
    tax_rate: 16.00,
    tax_amount: 15437.79,
    subtotal: 96486.20,
    total: 111923.99,
    currency: 'MXN'
  }
]

const viewOrder = (row: Record<string, unknown>) => {
  navigateTo(`/admin/orders/${row.order_id}`)
}

const remove = (row: Record<string, unknown>) => {
  console.error('Eliminar línea:', row.id)
}

const deleteMany = (selected: Record<string, unknown>[]) => {
  console.error('Eliminar múltiples líneas:', selected.map(s => s.id))
}
</script>

<template>
  <div class="w-full py-4">
    <Datatable
      title="Líneas de Orden"
      description="Listado de todas las líneas de órdenes de venta y compra"
      :data="orderLines"
      :columns="columns"
      :selectable="true"
      :exportable="true"
      :creatable="false"
      export-filename="lineas-de-orden"
    >
      <template #actions="{ row }">
        <div class="flex items-center justify-center gap-2">
          <BtnApp variant="ghost" size="sm" @click="viewOrder(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </template>
          </BtnApp>
          <BtnApp variant="ghost" size="sm" @click="remove(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </template>
          </BtnApp>
        </div>
      </template>

      <template #bulkActions="{ selected }">
        <BtnDelete @click="deleteMany(selected)" />
      </template>
    </Datatable>
  </div>
</template>
