<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Tables } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type WarehouseRow = Tables<'warehouse'>

const columns: Column[] = [
  { key: 'name', label: 'Almacén', type: 'avatar', subtitleKey: 'code' },
  {
    key: 'is_default',
    label: 'Predeterminado',
    type: 'badge',
    badgeConfig: {
      labels: {
        true: 'Sí',
        false: 'No'
      }
    }
  },
  {
    key: 'active',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: {
        true: 'Activo',
        false: 'Inactivo'
      }
    }
  },
  { key: 'updated_at', label: 'Actualizado', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getWarehousesByCompany, archiveWarehouse } = useWarehouse()

const warehouses = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const mapRow = (row: WarehouseRow): Record<string, unknown> => ({
  id: row.id,
  name: row.name,
  code: row.code,
  is_default: row.is_default === true,
  active: row.active !== false,
  updated_at: row.updated_at ?? ''
})

const loadWarehouses = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    warehouses.value = []
    return
  }
  isLoading.value = true
  try {
    const data = await getWarehousesByCompany(companyId)
    warehouses.value = data.map(mapRow)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => {
  loadWarehouses()
}, { immediate: true })

const create = () => navigateTo('/admin/warehouses/create')
const edit = (row: Record<string, unknown>) => navigateTo(`/admin/warehouses/${row.id as string}`)

const remove = async (row: Record<string, unknown>) => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const ok = await archiveWarehouse(row.id as string, companyId)
  if (ok) await loadWarehouses()
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Selecciona una empresa para gestionar sus almacenes.
    </div>

    <div
      v-else-if="isLoading"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando almacenes...
    </div>

    <Datatable
      v-else
      title="Almacenes"
      description="Control de almacenes por empresa"
      :data="warehouses"
      :columns="columns"
      :search-keys="['name', 'code']"
      :creatable="true"
      :exportable="true"
      create-label="Nuevo almacén"
      export-filename="almacenes"
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
    </Datatable>
  </div>
</template>
