<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, archive } = usePaymentMethod()

type PaymentMethodRow = {
  id: string
  name: string
  code: string
  description: string
  active: boolean
  created_at: string
}

const items = ref<PaymentMethodRow[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'code', label: 'Código' },
  { key: 'description', label: 'Descripción' },
  { key: 'active', label: 'Estado', type: 'badge' as const }
]

const mapRow = (r: Awaited<ReturnType<typeof getAllByCompany>>[0]): PaymentMethodRow => ({
  id: r.id,
  name: r.name,
  code: r.code ?? '—',
  description: r.description ?? '—',
  active: r.active ?? true,
  created_at: r.created_at ?? ''
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

const handleCreate = () => router.push('/admin/payment-methods/create')
const handleEdit = (row: PaymentMethodRow) => router.push(`/admin/payment-methods/${row.id}`)

const handleRemove = async (row: PaymentMethodRow) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(row.id, cid)
  await load()
}
</script>

<template>
  <Datatable
    title="Métodos de Pago"
    description="Catálogo de formas de pago disponibles para las órdenes."
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
