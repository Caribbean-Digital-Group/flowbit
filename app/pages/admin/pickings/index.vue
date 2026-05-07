<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type PickingRow = Database['public']['Views']['v_pickings']['Row']

const columns: Column[] = [
  { key: 'name', label: 'Picking', type: 'avatar', subtitleKey: 'order_name' },
  {
    key: 'type',
    label: 'Tipo',
    type: 'badge',
    badgeConfig: {
      labels: {
        entrada: 'Entrada',
        salida: 'Salida'
      }
    }
  },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: {
        borrador: 'Borrador',
        publicado: 'Publicado',
        confirmado: 'Confirmado',
        cancelado: 'Cancelado'
      }
    }
  },
  { key: 'warehouse_name', label: 'Almacén', type: 'text' },
  { key: 'line_count', label: 'Líneas', type: 'number' },
  { key: 'total_quantity', label: 'Cantidad total', type: 'number' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getPickingsByCompany, syncOrderToDraftPicking } = usePicking()
const { getOrdersByCompany } = useOrder()

const rows = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const orderToSync = ref('')
const syncOptions = ref<{ value: string; label: string }[]>([])

const mapRow = (row: PickingRow): Record<string, unknown> => ({
  id: row.id,
  name: row.name ?? '—',
  order_name: row.order_name ?? 'Sin orden',
  type: row.type ?? 'salida',
  status: row.status ?? 'borrador',
  warehouse_name: row.warehouse_name ?? '—',
  line_count: row.line_count ?? 0,
  total_quantity: row.total_quantity ?? 0
})

const loadData = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    rows.value = []
    syncOptions.value = []
    return
  }

  isLoading.value = true
  errorMessage.value = null
  try {
    const [pickings, orders] = await Promise.all([
      getPickingsByCompany(companyId),
      getOrdersByCompany(companyId)
    ])
    rows.value = pickings.map(mapRow)
    syncOptions.value = orders
      .filter((order) => order.order_state === 'posted' && order.is_delivered === true)
      .map((order) => ({
        value: order.id,
        label: `${order.name ?? 'Orden'} - ${order.partner_name ?? 'Sin partner'}`
      }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => {
  loadData()
}, { immediate: true })

const goDetail = (row: Record<string, unknown>) => {
  navigateTo(`/admin/pickings/${row.id as string}`)
}

const handleSync = async () => {
  errorMessage.value = null
  if (!orderToSync.value) {
    errorMessage.value = 'Selecciona una orden entregada.'
    return
  }
  const pickingId = await syncOrderToDraftPicking(orderToSync.value, false)
  if (!pickingId) {
    errorMessage.value = 'No se pudo generar el picking para la orden.'
    return
  }
  orderToSync.value = ''
  await loadData()
  navigateTo(`/admin/pickings/${pickingId}`)
}
</script>

<template>
  <div class="w-full py-4 space-y-4">
    <div
      v-if="errorMessage"
      class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="selectedCompanyId"
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
        <div class="lg:col-span-3">
          <FormSelect
            v-model="orderToSync"
            label="Generar picking desde orden entregada"
            :options="syncOptions"
            placeholder="Selecciona una orden"
          />
        </div>
        <BtnApp label="Generar" variant="primary" @click="handleSync" />
      </div>
    </div>

    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Selecciona una empresa para gestionar pickings.
    </div>

    <div
      v-else-if="isLoading"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando movimientos...
    </div>

    <Datatable
      v-else
      title="Movimientos de Inventario"
      description="Entradas y salidas de almacén vinculadas a órdenes"
      :data="rows"
      :columns="columns"
      :search-keys="['name', 'order_name', 'warehouse_name', 'status', 'type']"
      :creatable="false"
      :exportable="true"
      export-filename="pickings"
    >
      <template #actions="{ row }">
        <BtnApp variant="ghost" size="sm" @click="goDetail(row)">
          <template #iconLeft>
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </template>
        </BtnApp>
      </template>
    </Datatable>
  </div>
</template>
