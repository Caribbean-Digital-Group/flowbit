<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type OrderLineRow = Database['public']['Views']['v_order_lines']['Row']

const columns: Column[] = [
  {
    key: 'order_name',
    label: 'Orden',
    type: 'avatar',
    subtitleKey: 'product_name'
  },
  {
    key: 'order_type',
    label: 'Tipo orden',
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

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getOrderLinesByCompany, deleteOrderLine } = useOrderLine()

const orderLines = ref<Record<string, unknown>[]>([])
const isLoadingLines = ref(false)
const errorMessage = ref<string | null>(null)

function mapLineToRow(raw: OrderLineRow): Record<string, unknown> {
  return {
    id: raw.id,
    order_id: raw.order_id,
    order_name: raw.order_name ?? '—',
    order_type: raw.order_type,
    order_state: raw.order_state,
    product_name: raw.product_name?.trim() ? raw.product_name : '—',
    description: raw.description ?? '',
    quantity: raw.quantity ?? 0,
    unit_price: raw.unit_price ?? 0,
    subtotal: raw.subtotal ?? 0,
    total: raw.total ?? 0,
    currency: raw.currency ?? 'MXN'
  }
}

const loadLines = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value
  if (!companyId) {
    orderLines.value = []
    return
  }

  isLoadingLines.value = true
  try {
    const list = await getOrderLinesByCompany(companyId)
    orderLines.value = list.map(mapLineToRow)
  } finally {
    isLoadingLines.value = false
  }
}

watch(selectedCompanyId, () => {
  loadLines()
}, { immediate: true })

const viewOrder = (row: Record<string, unknown>) => {
  navigateTo(`/admin/orders/${row.order_id as string}`)
}

const remove = async (row: Record<string, unknown>) => {
  errorMessage.value = null

  if (row.order_state !== 'draft') {
    errorMessage.value = 'Solo se pueden eliminar líneas de órdenes en borrador.'
    return
  }

  const ok = await deleteOrderLine(row.id as string)
  if (!ok) {
    errorMessage.value = 'No se pudo eliminar la línea. Verifica permisos o el estado de la orden.'
    return
  }

  await loadLines()
}

const deleteMany = async (selected: Record<string, unknown>[]) => {
  errorMessage.value = null

  for (const row of selected) {
    if (row.order_state !== 'draft') {
      errorMessage.value = 'Solo se pueden eliminar líneas de órdenes en borrador.'
      return
    }
  }

  for (const row of selected) {
    await deleteOrderLine(row.id as string)
  }
  await loadLines()
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="errorMessage"
      class="mb-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa para ver las líneas de orden de esa compañía.
      </p>
    </div>

    <div
      v-else-if="isLoadingLines"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando líneas…
    </div>

    <Datatable
      v-else
      title="Líneas de Orden"
      description="Líneas de órdenes de venta y compra del partner y productos vinculados"
      :data="orderLines"
      :columns="columns"
      :search-keys="['order_name', 'product_name', 'description', 'order_type', 'order_state']"
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
