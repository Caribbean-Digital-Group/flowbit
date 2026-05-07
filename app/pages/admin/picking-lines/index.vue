<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type PickingLineRow = Database['public']['Views']['v_picking_lines']['Row']

const columns: Column[] = [
  {
    key: 'picking_name',
    label: 'Picking',
    type: 'avatar',
    subtitleKey: 'product_name'
  },
  {
    key: 'picking_type',
    label: 'Tipo movimiento',
    type: 'badge',
    badgeConfig: {
      labels: {
        entrada: 'Entrada',
        salida: 'Salida'
      }
    }
  },
  {
    key: 'picking_status',
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
  {
    key: 'tracking_type',
    label: 'Seguimiento',
    type: 'badge',
    badgeConfig: {
      labels: {
        none: 'Sin seguimiento',
        lot: 'Lote',
        serial: 'Serie'
      }
    }
  },
  {
    key: 'quantity',
    label: 'Cantidad',
    type: 'number'
  },
  {
    key: 'lot_name',
    label: 'Lote',
    type: 'text'
  },
  {
    key: 'serial_number',
    label: 'Serie',
    type: 'text'
  },
  {
    key: 'order_name',
    label: 'Orden origen',
    type: 'text'
  }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getPickingLineViewsByCompany, deletePickingLine } = usePickingLine()

const rows = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const mapLineToRow = (raw: PickingLineRow): Record<string, unknown> => ({
  id: raw.id ?? '',
  picking_id: raw.picking_id ?? '',
  picking_name: raw.picking_name ?? '—',
  picking_type: raw.picking_type ?? 'salida',
  picking_status: raw.picking_status ?? 'borrador',
  product_name: raw.product_name?.trim() || '—',
  tracking_type: raw.tracking_type ?? 'none',
  quantity: raw.quantity ?? 0,
  lot_name: raw.lot_name?.trim() || '—',
  serial_number: raw.serial_number?.trim() || '—',
  order_name: raw.order_name ?? '—'
})

const loadLines = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value
  if (!companyId) {
    rows.value = []
    return
  }

  isLoading.value = true
  try {
    const list = await getPickingLineViewsByCompany(companyId)
    rows.value = list.map(mapLineToRow)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => {
  loadLines()
}, { immediate: true })

const viewPicking = (row: Record<string, unknown>) => {
  navigateTo(`/admin/pickings/${row.picking_id as string}`)
}

const remove = async (row: Record<string, unknown>) => {
  errorMessage.value = null
  if (!['borrador', 'publicado'].includes(row.picking_status as string)) {
    errorMessage.value = 'Solo puedes eliminar líneas cuando el picking está en borrador o publicado.'
    return
  }

  const ok = await deletePickingLine(row.id as string)
  if (!ok) {
    errorMessage.value = 'No se pudo eliminar la línea de picking.'
    return
  }

  await loadLines()
}

const deleteMany = async (selected: Record<string, unknown>[]) => {
  errorMessage.value = null

  for (const row of selected) {
    if (!['borrador', 'publicado'].includes(row.picking_status as string)) {
      errorMessage.value = 'Solo puedes eliminar líneas de pickings en borrador o publicado.'
      return
    }
  }

  for (const row of selected) {
    await deletePickingLine(row.id as string)
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
        Elige una empresa para ver las líneas de picking del inventario.
      </p>
    </div>

    <div
      v-else-if="isLoading"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando líneas de picking...
    </div>

    <Datatable
      v-else
      title="Líneas de Picking"
      description="Detalle de productos movidos por entradas y salidas de almacén"
      :data="rows"
      :columns="columns"
      :search-keys="['picking_name', 'product_name', 'tracking_type', 'lot_name', 'serial_number', 'order_name']"
      :selectable="true"
      :exportable="true"
      :creatable="false"
      export-filename="lineas-picking"
    >
      <template #actions="{ row }">
        <div class="flex items-center justify-center gap-2">
          <BtnApp variant="ghost" size="sm" @click="viewPicking(row)">
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
