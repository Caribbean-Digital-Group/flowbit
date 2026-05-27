<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Tables } from '~/types/database.types'

type ProductRow = Tables<'product'>

const columns: Column[] = [
  {
    key: 'name',
    label: 'Producto',
    type: 'avatar'
  },
  {
    key: 'sku',
    label: 'SKU',
    type: 'text'
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
  { key: 'sale_price', label: 'Precio', type: 'currency', currencyKey: 'currency' },
  { key: 'stock_quantity', label: 'Stock', type: 'text' },
  { key: 'created_at', label: 'Fecha', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getProductsByCompany, archiveProduct } = useProduct()

const products = ref<Record<string, unknown>[]>([])
const isLoadingProducts = ref(false)

function mapProductToTableRow(raw: ProductRow): Record<string, unknown> {
  return {
    id: raw.id,
    name: raw.display_name?.trim() || raw.name,
    sku: raw.sku?.trim() || null,
    product_type: raw.product_type,
    status: raw.status ?? 'inactive',
    sale_price: raw.sale_price ?? 0,
    currency: (raw.currency?.trim() || 'MXN').toUpperCase(),
    stock_quantity: raw.stock_quantity ?? 0,
    image_url: raw.image_url ?? '',
    created_at: raw.created_at ?? ''
  }
}

const loadProducts = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    products.value = []
    return
  }

  isLoadingProducts.value = true
  try {
    const list = await getProductsByCompany(companyId)
    products.value = list.map(mapProductToTableRow)
  } finally {
    isLoadingProducts.value = false
  }
}

watch(selectedCompanyId, () => {
  loadProducts()
}, { immediate: true })

// Funciones de acciones
const create = () => {
  navigateTo('/admin/products/create')
}

const edit = (row: Record<string, any>) => {
  navigateTo(`/admin/products/${row.id}`)
}

const remove = async (row: Record<string, any>) => {
  const companyId = selectedCompanyId.value
  if (!companyId) return

  const ok = await archiveProduct(row.id as string, companyId)
  if (ok) {
    await loadProducts()
  }
}

const deleteMany = async (selected: Record<string, any>[]) => {
  const companyId = selectedCompanyId.value
  if (!companyId) return

  for (const row of selected) {
    await archiveProduct(row.id as string, companyId)
  }
  await loadProducts()
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el selector del panel superior para ver sus productos.
      </p>
    </div>

    <div
      v-else-if="isLoadingProducts"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando productos…
    </div>

    <Datatable
      v-else
      title="Productos"
      description="Lista de todos los productos y servicios registrados"
      :data="products"
      :columns="columns"
      :search-keys="['name', 'sku', 'product_type', 'status']"
      :selectable="true"
      :exportable="true"
      :creatable="true"
      create-label="Crear producto"
      export-filename="productos"
      @create="create"
    >
      <!-- SKU vacío -->
      <template #cell-sku="{ value }">
        <span :class="value ? 'font-mono text-slate-700' : 'text-slate-400'">
          {{ value ?? '—' }}
        </span>
      </template>

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
