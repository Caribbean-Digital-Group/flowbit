<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, archive } = useStorefrontCoupon()

type CouponRow = {
  id: string
  code: string
  discount: string
  min_purchase: string
  usage: string
  validity: string
  active: boolean
}

const items = ref<CouponRow[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'code', label: 'Código' },
  { key: 'discount', label: 'Descuento' },
  { key: 'min_purchase', label: 'Compra mínima' },
  { key: 'usage', label: 'Usos' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'active', label: 'Estado', type: 'badge' as const }
]

const currency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const formatDate = (value: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-MX') : null

const mapRow = (r: Awaited<ReturnType<typeof getAllByCompany>>[0]): CouponRow => ({
  id: r.id,
  code: r.code,
  discount: r.discount_type === 'percent' ? `${r.discount_value}%` : currency(r.discount_value),
  min_purchase: r.min_purchase ? currency(r.min_purchase) : '—',
  usage: r.usage_limit ? `${r.usage_count} / ${r.usage_limit}` : `${r.usage_count}`,
  validity:
    r.starts_at || r.expires_at
      ? `${formatDate(r.starts_at) ?? '∞'} → ${formatDate(r.expires_at) ?? '∞'}`
      : 'Siempre',
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

const handleCreate = () => router.push('/admin/storefront/coupons/create')
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/storefront/coupons/${String(row.id)}`)

const handleRemove = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <Datatable
    title="Cupones de la tienda"
    description="Códigos de descuento que tus clientes pueden aplicar en el checkout."
    :data="items"
    :columns="columns"
    :is-loading="isLoading"
    :creatable="!!selectedCompanyId"
    create-label="Nuevo Cupón"
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
