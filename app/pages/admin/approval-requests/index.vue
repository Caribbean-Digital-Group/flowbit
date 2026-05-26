<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { ApprovalRequestStatus } from '~/components/ApprovalRequest/Form.vue'
import { approvalRequestStatusLabels } from '~/components/ApprovalRequest/Form.vue'

definePageMeta({
  layout: 'admin'
})

const columns: Column[] = [
  {
    key: 'request_number',
    label: 'Folio',
    type: 'text'
  },
  { key: 'title', label: 'Asunto', type: 'text', subtitleKey: 'category_name' },
  { key: 'status', label: 'Estado', type: 'badge' },
  { key: 'requesting_partner_display', label: 'Solicitante', type: 'text' },
  {
    key: 'amount_disp',
    label: 'Importe',
    type: 'text'
  },
  { key: 'request_date', label: 'Fecha solicitud', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getRequestsByCompany } = useApprovalRequest()

const isLoading = ref(false)
const rawRows = ref<Awaited<ReturnType<typeof getRequestsByCompany>>>([])

const statusBadgeConfig = {
  labels: approvalRequestStatusLabels as Record<string, string>
}

const augmentedColumns = computed<Column[]>(() =>
  columns.map((c) =>
    c.key === 'status' ? { ...c, badgeConfig: statusBadgeConfig } : { ...c }
  ))

const formatted = computed(() => {
  return rawRows.value.map((r) => {
    const amount = r.amount ?? null
    const cur = r.currency ?? 'MXN'
    let amount_disp = '—'
    if (amount != null && Number.isFinite(Number(amount))) {
      amount_disp = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: cur
      }).format(Number(amount))
    }
    return {
      ...r,
      requesting_partner_display: r.requesting_partner_display ?? '—',
      category_name: r.category_name ?? '—',
      amount_disp,
      title: r.title ?? '—',
      request_date: r.request_date ?? '',
      status: (r.status ?? 'draft') as ApprovalRequestStatus
    }
  })
})

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) {
    rawRows.value = []
    return
  }
  isLoading.value = true
  try {
    rawRows.value = await getRequestsByCompany(cid)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const openCreate = () => navigateTo('/admin/approval-requests/create')

const openDetail = (row: Record<string, unknown>) =>
  navigateTo(`/admin/approval-requests/${row.id as string}`)
</script>

<template>
  <div class="w-full py-4 space-y-6">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Elige tu empresa para listar tus solicitudes o las que puede ver tu rol como aprobador.
    </div>

    <div
      v-else-if="isLoading"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando solicitudes…
    </div>

    <Datatable
      v-else
      title="Solicitudes de aprobación"
      description="Las solicitudes en borrador son privadas hasta que las publiques; los aprobadores ven el tablero completo."
      :data="formatted"
      :columns="augmentedColumns"
      :search-keys="['title', 'reference', 'category_name', 'assigned_approver_display']"
      :selectable="false"
      :exportable="true"
      export-filename="solicitudes-aprobacion"
      empty-title="Sin registros"
      empty-message="Crea una solicitud en borrador y publícala cuando el paquete de información esté completo."
      :creatable="true"
      create-label="Nueva solicitud"
      @create="openCreate"
    >
      <template #actions="{ row }">
        <BtnApp variant="ghost" size="sm" @click="openDetail(row)">
          <template #iconLeft>
            <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
