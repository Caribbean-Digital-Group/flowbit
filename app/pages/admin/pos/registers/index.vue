<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, archive } = usePosRegister()

const items = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'code', label: 'Código' },
  { key: 'max_discount_percent', label: 'Desc. máx. cajero' },
  { key: 'blind_close', label: 'Corte ciego' },
  { key: 'active', label: 'Estado', type: 'badge' as const }
]

const mapRow = (r: Awaited<ReturnType<typeof getAllByCompany>>[0]): Record<string, unknown> => ({
  id: r.id,
  name: r.name,
  code: r.code,
  max_discount_percent: `${Number(r.max_discount_percent ?? 100)}%`,
  blind_close: r.blind_close ? 'Sí' : 'No',
  active: r.active ?? true
})

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    items.value = (await getAllByCompany(cid, { activeOnly: false })).map(mapRow)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleCreate = () => router.push('/admin/pos/registers/create')
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/pos/registers/${row.id as string}`)

const handleArchive = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(row.id as string, cid)
  await load()
}
</script>

<template>
  <Datatable
    title="Cajas (POS)"
    description="Terminales de punto de venta de la empresa."
    :data="items"
    :columns="columns"
    :is-loading="isLoading"
    :creatable="!!selectedCompanyId"
    create-label="Nueva Caja"
    @create="handleCreate"
  >
    <template #actions="{ row }">
      <button
        class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        @click="handleEdit(row)"
      >
        Ver
      </button>
      <button
        class="text-xs text-red-500 hover:text-red-700 font-medium transition-colors ml-3"
        @click="handleArchive(row)"
      >
        Archivar
      </button>
    </template>
  </Datatable>
</template>
