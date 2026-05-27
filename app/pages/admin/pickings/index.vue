<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type PickingRow = Database['public']['Views']['v_pickings']['Row']
type PickingType = Database['public']['Enums']['picking_type']
type PickingStatus = Database['public']['Enums']['picking_status']

const typeLabels: Record<PickingType, string> = {
  entrada: 'Entrada',
  salida: 'Salida'
}

const statusLabels: Record<PickingStatus, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado'
}

const columns: Column[] = [
  { key: 'name', label: 'Picking', type: 'avatar', subtitleKey: 'order_name' },
  {
    key: 'type',
    label: 'Tipo',
    type: 'badge',
    badgeConfig: {
      labels: typeLabels
    }
  },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: statusLabels
    }
  },
  { key: 'warehouse_name', label: 'Almacén', type: 'text' },
  { key: 'line_count', label: 'Líneas', type: 'text', align: 'right' },
  { key: 'total_quantity', label: 'Cantidad total', type: 'text', align: 'right' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getPickingsByCompany, syncOrderToDraftPicking, createPicking } = usePicking()
const { getOrdersByCompany } = useOrder()

const pickingsRaw = ref<PickingRow[]>([])
const selectedTypeFilters = ref<PickingType[]>(['entrada', 'salida'])
const selectedStatusFilters = ref<PickingStatus[]>(['borrador', 'publicado', 'confirmado'])
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

const filteredPickings = computed(() =>
  pickingsRaw.value.filter((row) => {
    const type = (row.type ?? 'salida') as PickingType
    const status = (row.status ?? 'borrador') as PickingStatus
    if (selectedTypeFilters.value.length > 0 && !selectedTypeFilters.value.includes(type)) {
      return false
    }
    if (selectedStatusFilters.value.length > 0 && !selectedStatusFilters.value.includes(status)) {
      return false
    }
    return true
  })
)

const filteredRows = computed(() => filteredPickings.value.map(mapRow))

const toggleTypeFilter = (value: PickingType) => {
  selectedTypeFilters.value = selectedTypeFilters.value.includes(value)
    ? selectedTypeFilters.value.filter((v) => v !== value)
    : [...selectedTypeFilters.value, value]
}

const toggleStatusFilter = (value: PickingStatus) => {
  selectedStatusFilters.value = selectedStatusFilters.value.includes(value)
    ? selectedStatusFilters.value.filter((v) => v !== value)
    : [...selectedStatusFilters.value, value]
}

const resetFilters = () => {
  selectedTypeFilters.value = ['entrada', 'salida']
  selectedStatusFilters.value = ['borrador', 'publicado', 'confirmado']
}

const filtersLabel = computed(() => {
  const types = selectedTypeFilters.value.length
  const statuses = selectedStatusFilters.value.length
  return `${types} tipo(s) · ${statuses} estado(s)`
})

const loadData = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    pickingsRaw.value = []
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
    pickingsRaw.value = pickings
    syncOptions.value = orders
      .filter(
        (order): order is typeof order & { id: string } =>
          order.id != null &&
          order.order_state === 'posted' &&
          order.is_delivered === true
      )
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

const handleCreateManual = async (type: PickingType) => {
  const companyId = selectedCompanyId.value
  errorMessage.value = null

  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa para crear movimientos.'
    return
  }

  isLoading.value = true
  try {
    const picking = await createPicking(companyId, {
      type,
      status: 'borrador',
      warehouse_id: undefined
    })

    if (!picking) {
      errorMessage.value = 'No se pudo crear el movimiento manual.'
      return
    }

    await loadData()
    navigateTo(`/admin/pickings/${picking.id}?edit=1`)
  } finally {
    isLoading.value = false
  }
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
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4"
    >
      <!-- Generar desde orden existente -->
      <div>
        <p class="text-sm font-medium text-slate-700 mb-3">Desde orden de compra/venta</p>
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
          <div class="lg:col-span-3">
            <FormSelect
              v-model="orderToSync"
              label="Orden entregada"
              :options="syncOptions"
              placeholder="Selecciona una orden"
            />
          </div>
          <BtnApp label="Generar picking" variant="primary" @click="handleSync" />
        </div>
      </div>

      <!-- Crear movimiento manual -->
      <div class="border-t border-slate-100 pt-4">
        <p class="text-sm font-medium text-slate-700 mb-3">Movimiento manual de almacén</p>
        <div class="flex flex-wrap gap-3">
          <BtnApp
            label="Nueva entrada"
            variant="secondary"
            @click="handleCreateManual('entrada')"
          >
            <template #iconLeft>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 16v-4a9 9 0 0118 0v4M12 3v9m0 0l-3-3m3 3l3-3" />
              </svg>
            </template>
          </BtnApp>
          <BtnApp
            label="Nueva salida"
            variant="secondary"
            @click="handleCreateManual('salida')"
          >
            <template #iconLeft>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 8v4a9 9 0 0018 0V8M12 21v-9m0 0l-3 3m3-3l3 3" />
              </svg>
            </template>
          </BtnApp>
        </div>
        <p class="mt-2 text-xs text-slate-400">
          Crea entradas o salidas de almacén sin necesidad de una orden de compra o venta vinculada.
        </p>
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
      description="Entradas y salidas de almacén"
      :data="filteredRows"
      :columns="columns"
      :search-keys="['name', 'order_name', 'warehouse_name', 'status', 'type']"
      :creatable="false"
      :exportable="true"
      export-filename="pickings"
      empty-title="Sin movimientos"
      empty-message="No hay pickings que coincidan con los filtros seleccionados."
    >
      <template #headerActions>
        <div class="flex w-full items-center justify-center sm:w-auto sm:justify-end">
          <details class="relative w-full sm:w-auto">
            <summary
              class="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-56"
            >
              <span>Filtros: {{ filtersLabel }}</span>
              <svg class="ml-2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div class="absolute right-0 z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:w-72">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tipo
                </p>
                <div class="mt-2 space-y-2">
                  <label
                    v-for="(label, key) in typeLabels"
                    :key="key"
                    class="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedTypeFilters.includes(key as PickingType)"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleTypeFilter(key as PickingType)"
                    >
                    {{ label }}
                  </label>
                </div>
              </div>

              <div class="mt-4 border-t border-slate-100 pt-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </p>
                <div class="mt-2 space-y-2">
                  <label
                    v-for="(label, key) in statusLabels"
                    :key="key"
                    class="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedStatusFilters.includes(key as PickingStatus)"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      @change="toggleStatusFilter(key as PickingStatus)"
                    >
                    {{ label }}
                  </label>
                </div>
              </div>

              <button
                type="button"
                class="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                @click="resetFilters"
              >
                Restablecer filtros
              </button>
            </div>
          </details>
        </div>
      </template>

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
