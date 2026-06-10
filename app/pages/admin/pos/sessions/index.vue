<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getSessionsByCompany } = usePosSession()

type SessionRow = {
  id: string
  name: string
  register_name: string
  status: string
  opened_by_name: string
  opened_at: string
  closed_at: string
  sales_total: number
  total_difference: number
}

const items = ref<SessionRow[]>([])
const isLoading = ref(false)

const columns: Column[] = [
  { key: 'name', label: 'Folio' },
  { key: 'register_name', label: 'Caja' },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      colors: { open: 'bg-emerald-100 text-emerald-700', closed: 'bg-slate-100 text-slate-600' },
      labels: { open: 'Abierta', closed: 'Cerrada' }
    }
  },
  { key: 'opened_by_name', label: 'Cajero' },
  { key: 'opened_at', label: 'Apertura', type: 'date' },
  { key: 'closed_at', label: 'Cierre' },
  { key: 'sales_total', label: 'Ventas', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'total_difference', label: 'Diferencia', type: 'currency', currency: 'MXN', align: 'right' }
]

const formatDateTime = (value: string | null): string => {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    const sessions = await getSessionsByCompany(cid)
    items.value = sessions.map(s => ({
      id: s.id ?? '',
      name: s.name ?? '',
      register_name: `${s.register_name ?? ''} (${s.register_code ?? ''})`,
      status: s.status ?? 'open',
      opened_by_name: s.opened_by_name ?? '—',
      opened_at: s.opened_at ?? '',
      closed_at: formatDateTime(s.closed_at),
      sales_total: Number(s.sales_total ?? 0),
      total_difference: Number(s.total_difference ?? 0)
    }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleView = (row: SessionRow) => router.push(`/admin/pos/sessions/${row.id}`)
</script>

<template>
  <Datatable
    title="Sesiones de Caja"
    description="Historial de aperturas y cortes del punto de venta."
    :data="items"
    :columns="columns"
    :is-loading="isLoading"
    :exportable="true"
    export-filename="sesiones-pos"
  >
    <template #actions="{ row }">
      <button
        class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        @click="handleView(row)"
      >
        Ver corte
      </button>
    </template>
  </Datatable>
</template>
