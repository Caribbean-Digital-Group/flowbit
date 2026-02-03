<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

import type { Column } from '~/components/Datatable.vue'

const columns: Column[] = [
  { 
    key: 'name', 
    label: 'Orden', 
    type: 'avatar', 
    subtitleKey: 'partner_name' 
  },
  { 
    key: 'order_type', 
    label: 'Tipo', 
    type: 'badge',
    badgeConfig: {
      labels: { 
        sale: 'Venta', 
        purchase: 'Compra' 
      }
    }
  },
  { 
    key: 'order_state', 
    label: 'Estado', 
    type: 'badge',
    badgeConfig: {
      labels: { 
        draft: 'Borrador', 
        posted: 'Confirmada',
        cancel: 'Cancelada'
      }
    }
  },
  { key: 'amount_total', label: 'Total', type: 'currency' },
  { key: 'order_date', label: 'Fecha', type: 'date' }
]

// Datos de ejemplo
const orders = [
  { 
    id: '550e8400-e29b-41d4-a716-446655440001', 
    name: 'SO-000001', 
    partner_name: 'Juan Pérez',
    order_type: 'sale', 
    order_state: 'posted', 
    amount_total: 15499.00, 
    currency: 'MXN',
    order_date: '2026-01-15' 
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440002', 
    name: 'SO-000002', 
    partner_name: 'María García',
    order_type: 'sale', 
    order_state: 'draft', 
    amount_total: 8750.50, 
    currency: 'MXN',
    order_date: '2026-01-18' 
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440003', 
    name: 'PO-000001', 
    partner_name: 'Proveedor Tech SA',
    order_type: 'purchase', 
    order_state: 'posted', 
    amount_total: 45000.00, 
    currency: 'MXN',
    order_date: '2026-01-20' 
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440004', 
    name: 'SO-000003', 
    partner_name: 'Carlos López',
    order_type: 'sale', 
    order_state: 'cancel', 
    amount_total: 3200.00, 
    currency: 'MXN',
    order_date: '2026-01-22' 
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440005', 
    name: 'PO-000002', 
    partner_name: 'Distribuidora Norte',
    order_type: 'purchase', 
    order_state: 'draft', 
    amount_total: 28500.00, 
    currency: 'MXN',
    order_date: '2026-01-25' 
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440006', 
    name: 'SO-000004', 
    partner_name: 'Ana Martínez',
    order_type: 'sale', 
    order_state: 'posted', 
    amount_total: 12350.75, 
    currency: 'MXN',
    order_date: '2026-01-28' 
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440007', 
    name: 'SO-000005', 
    partner_name: 'Roberto Sánchez',
    order_type: 'sale', 
    order_state: 'draft', 
    amount_total: 5680.00, 
    currency: 'MXN',
    order_date: '2026-01-30' 
  },
  { 
    id: '550e8400-e29b-41d4-a716-446655440008', 
    name: 'PO-000003', 
    partner_name: 'Importaciones Express',
    order_type: 'purchase', 
    order_state: 'posted', 
    amount_total: 89000.00, 
    currency: 'MXN',
    order_date: '2026-02-01' 
  }
]

// Funciones de acciones
const edit = (row: Record<string, any>) => {
  console.log('Editar:', row)
  navigateTo(`/admin/orders/${row.id}`)
}

const remove = (row: Record<string, any>) => {
  console.log('Eliminar:', row)
  // Aquí puedes mostrar confirmación y eliminar
}

const deleteMany = (selected: Record<string, any>[]) => {
  console.log('Eliminar múltiples:', selected)
  // Aquí puedes eliminar múltiples registros
}
</script>

<template>
  <div class="w-full py-4">
    <Datatable
      title="Órdenes"
      description="Lista de todas las órdenes de venta y compra"
      :data="orders"
      :columns="columns"
      :selectable="true"
      :exportable="true"
      export-filename="ordenes"
    >
      <!-- Acciones personalizadas por fila -->
      <template #actions="{ row }">
        <div class="flex items-center justify-center gap-2">
          <BtnApp variant="ghost" size="sm" @click="edit(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

      <!-- Acciones en lote -->
      <template #bulkActions="{ selected }">
        <BtnDelete @click="deleteMany(selected)" />
      </template>
    </Datatable>
  </div>
</template>
