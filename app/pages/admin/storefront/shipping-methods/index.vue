<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, archive } = useStorefrontShippingMethod()

type ShippingRow = {
  id: string
  name: string
  price: string
  delivery_estimate: string
  active: boolean
}

const items = ref<ShippingRow[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'price', label: 'Costo' },
  { key: 'delivery_estimate', label: 'Tiempo estimado' },
  { key: 'active', label: 'Estado', type: 'badge' as const }
]

const mapRow = (r: Awaited<ReturnType<typeof getAllByCompany>>[0]): ShippingRow => ({
  id: r.id,
  name: r.name,
  price:
    r.price > 0
      ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(r.price)
      : 'Gratis',
  delivery_estimate: r.delivery_estimate ?? '—',
  active: r.active ?? true
})

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    items.value = (await getAllByCompany(cid)).map(mapRow)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleCreate = () => router.push('/admin/storefront/shipping-methods/create')
const handleEdit = (row: Record<string, unknown>) =>
  router.push(`/admin/storefront/shipping-methods/${String(row.id)}`)

const handleRemove = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <Datatable
    title="Métodos de envío"
    description="Opciones de entrega que verán tus clientes en el checkout de la tienda."
    :data="items"
    :columns="columns"
    :is-loading="isLoading"
    :creatable="!!selectedCompanyId"
    create-label="Nuevo Método"
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
        @click="handleRemove(row)"
      >
        Archivar
      </button>
    </template>
  </Datatable>
</template>
