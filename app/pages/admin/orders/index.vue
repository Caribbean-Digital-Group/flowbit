<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type OrderListRow = Database['public']['Views']['v_orders']['Row']

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
  { key: 'amount_total', label: 'Total', type: 'currency', currencyKey: 'currency' },
  { key: 'order_date', label: 'Fecha', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getOrdersByCompany, cancelOrderById } = useOrder()

const orders = ref<Record<string, unknown>[]>([])
const isLoadingOrders = ref(false)

function mapOrderToTableRow(raw: OrderListRow): Record<string, unknown> {
  return {
    id: raw.id,
    name: raw.name ?? '—',
    partner_name: raw.partner_name?.trim() || '—',
    order_type: raw.order_type,
    order_state: raw.order_state,
    amount_total: raw.amount_total ?? 0,
    currency: raw.currency ?? 'MXN',
    order_date: raw.order_date ?? ''
  }
}

const loadOrders = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    orders.value = []
    return
  }

  isLoadingOrders.value = true
  try {
    const list = await getOrdersByCompany(companyId)
    orders.value = list.map(mapOrderToTableRow)
  } finally {
    isLoadingOrders.value = false
  }
}

watch(selectedCompanyId, () => {
  loadOrders()
}, { immediate: true })

const create = () => {
  navigateTo('/admin/orders/create')
}

const edit = (row: Record<string, unknown>) => {
  navigateTo(`/admin/orders/${row.id as string}`)
}

const remove = async (row: Record<string, unknown>) => {
  const ok = await cancelOrderById(row.id as string)
  if (ok) {
    await loadOrders()
  }
}

const deleteMany = async (selected: Record<string, unknown>[]) => {
  for (const row of selected) {
    await cancelOrderById(row.id as string)
  }
  await loadOrders()
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
        Elige una empresa en el panel superior para ver sus órdenes de venta y compra.
      </p>
    </div>

    <div
      v-else-if="isLoadingOrders"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando órdenes…
    </div>

    <Datatable
      v-else
      title="Órdenes"
      description="Órdenes de venta y compra de la empresa seleccionada"
      :data="orders"
      :columns="columns"
      :search-keys="['name', 'partner_name', 'order_type', 'order_state']"
      :selectable="true"
      :exportable="true"
      :creatable="true"
      create-label="Crear orden"
      export-filename="ordenes"
      @create="create"
    >
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

      <template #bulkActions="{ selected }">
        <BtnDelete @click="deleteMany(selected)" />
      </template>
    </Datatable>
  </div>
</template>
