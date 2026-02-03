<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

import type { Column } from '~/components/Datatable.vue'

const columns: Column[] = [
  { 
    key: 'name', 
    label: 'Producto', 
    type: 'avatar', 
    subtitleKey: 'sku' 
  },
  { 
    key: 'product_type', 
    label: 'Tipo', 
    type: 'badge',
    badgeConfig: {
      labels: { 
        product: 'Producto', 
        service: 'Servicio', 
        others: 'Otro' 
      }
    }
  },
  { 
    key: 'status', 
    label: 'Estado', 
    type: 'badge',
    badgeConfig: {
      labels: { 
        active: 'Activo', 
        inactive: 'Inactivo',
        discontinued: 'Descontinuado',
        out_of_stock: 'Sin stock',
        coming_soon: 'Próximamente'
      }
    }
  },
  { key: 'sale_price', label: 'Precio', type: 'currency' },
  { key: 'stock_quantity', label: 'Stock', type: 'text' },
  { key: 'created_at', label: 'Fecha', type: 'date' }
]

// Datos de ejemplo
const products = [
  { 
    id: 1, 
    name: 'Laptop Dell XPS 15', 
    sku: 'DELL-XPS-15-001',
    product_type: 'product', 
    status: 'active', 
    sale_price: 25999.00, 
    stock_quantity: 15,
    image_url: null,
    created_at: '2026-01-15' 
  },
  { 
    id: 2, 
    name: 'Servicio de Soporte Técnico', 
    sku: 'SRV-SOPORTE-001',
    product_type: 'service', 
    status: 'active', 
    sale_price: 500.00, 
    stock_quantity: 0,
    image_url: null,
    created_at: '2026-01-18' 
  },
  { 
    id: 3, 
    name: 'Mouse Logitech MX Master 3', 
    sku: 'LOG-MX3-001',
    product_type: 'product', 
    status: 'active', 
    sale_price: 1899.00, 
    stock_quantity: 42,
    image_url: null,
    created_at: '2026-01-20' 
  },
  { 
    id: 4, 
    name: 'Teclado Mecánico Keychron K2', 
    sku: 'KEY-K2-001',
    product_type: 'product', 
    status: 'out_of_stock', 
    sale_price: 2499.00, 
    stock_quantity: 0,
    image_url: null,
    created_at: '2026-01-22' 
  },
  { 
    id: 5, 
    name: 'Monitor Samsung 27" 4K', 
    sku: 'SAM-MON27-4K',
    product_type: 'product', 
    status: 'active', 
    sale_price: 8999.00, 
    stock_quantity: 8,
    image_url: null,
    created_at: '2026-01-25' 
  },
  { 
    id: 6, 
    name: 'Consultoría de Software', 
    sku: 'SRV-CONSULT-001',
    product_type: 'service', 
    status: 'active', 
    sale_price: 1500.00, 
    stock_quantity: 0,
    image_url: null,
    created_at: '2026-01-28' 
  },
  { 
    id: 7, 
    name: 'Webcam Logitech C920', 
    sku: 'LOG-C920-001',
    product_type: 'product', 
    status: 'discontinued', 
    sale_price: 1299.00, 
    stock_quantity: 3,
    image_url: null,
    created_at: '2026-01-30' 
  },
  { 
    id: 8, 
    name: 'AirPods Pro 2', 
    sku: 'APL-APP2-001',
    product_type: 'product', 
    status: 'coming_soon', 
    sale_price: 5499.00, 
    stock_quantity: 0,
    image_url: null,
    created_at: '2026-02-01' 
  }
]

// Funciones de acciones
const edit = (row: Record<string, any>) => {
  console.log('Editar:', row)
  navigateTo(`/admin/products/${row.id}`)
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
      title="Productos"
      description="Lista de todos los productos y servicios registrados"
      :data="products"
      :columns="columns"
      :selectable="true"
      :exportable="true"
      export-filename="productos"
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
