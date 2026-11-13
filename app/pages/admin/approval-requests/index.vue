<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { ActionDialogResult } from '~/components/ApprovalRequest/ActionDialog.vue'
import type { ApprovalMyPendingRow, ApprovalRejectionReasonRow, ApprovalRequestViewRow } from '~/types/approval.types'
import {
  APPROVAL_PRIORITY_BADGE_COLORS,
  APPROVAL_PRIORITY_LABELS,
  APPROVAL_PRIORITY_OPTIONS,
  APPROVAL_PRIORITY_ORDER,
  APPROVAL_STATUS_BADGE_COLORS,
  APPROVAL_STATUS_LABELS,
  formatDateMx
} from '~/utils/approvals'

definePageMeta({ layout: 'admin' })

type Tab = 'pending' | 'mine' | 'all'

const route = useRoute()
const authStore = useAuthStore()
const { selectedCompanyId, partner } = storeToRefs(authStore)
const { getRequestsByCompany, getMyPending, bulkDecide, lastError } = useApprovalRequest()
const { getRejectionReasons } = useApprovalSettings()
const { getSelectableCategoriesForRequests } = useApprovalCategory()

const isLoading = ref(false)
const rows = ref<ApprovalRequestViewRow[]>([])
const pending = ref<ApprovalMyPendingRow[]>([])
const reasons = ref<ApprovalRejectionReasonRow[]>([])
const categoryOptions = ref<{ value: string; label: string }[]>([])

const tab = ref<Tab>((route.query.tab as Tab) || 'pending')
const filterCategory = ref('')
const filterStatus = ref('')
const filterPriority = ref('')
const onlyOverdue = ref(false)

const selected = ref<Record<string, unknown>[]>([])
const bulkDialog = ref<'approve' | 'reject' | null>(null)
const bulkLoading = ref(false)
const bulkMessage = ref<string | null>(null)
const bulkError = ref<string | null>(null)

const statusFilterOptions = Object.entries(APPROVAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))

const columns: Column[] = [
  { key: 'request_number', label: 'Folio', sortable: true },
  { key: 'title', label: 'Asunto', subtitleKey: 'category_name', sortable: true },
  { key: 'status', label: 'Estado', type: 'badge', badgeConfig: { labels: APPROVAL_STATUS_LABELS, colors: APPROVAL_STATUS_BADGE_COLORS } },
  { key: 'priority', label: 'Prioridad', type: 'badge', badgeConfig: { labels: APPROVAL_PRIORITY_LABELS, colors: APPROVAL_PRIORITY_BADGE_COLORS } },
  { key: 'requesting_partner_display', label: 'Solicitante', sortable: true },
  { key: 'stage', label: 'Dónde está' },
  { key: 'amount', label: 'Importe', type: 'currency', currencyKey: 'currency', align: 'right', sortable: true },
  { key: 'due_label', label: 'Vence' }
]

const pendingIds = computed(() => new Set(pending.value.map(p => p.request_id)))
const myPid = computed(() => partner.value?.id ?? '')

const tabRows = computed(() => {
  if (tab.value === 'pending') return rows.value.filter(r => r.id && pendingIds.value.has(r.id))
  if (tab.value === 'mine') {
    return rows.value.filter(r => r.requesting_partner_id === myPid.value || r.captured_by_partner_id === myPid.value)
  }
  return rows.value
})

const formatted = computed(() =>
  tabRows.value
    .filter(r => !filterCategory.value || r.category_id === filterCategory.value)
    .filter(r => !filterStatus.value || r.status === filterStatus.value)
    .filter(r => !filterPriority.value || r.priority === filterPriority.value)
    .filter(r => !onlyOverdue.value || r.is_overdue)
    .map((r) => {
      const myStep = pending.value.find(p => p.request_id === r.id)
      const dueIso = myStep?.due_at ?? r.current_due_at
      return {
        ...r,
        title: r.title ?? '—',
        category_name: r.category_name ?? '—',
        requesting_partner_display: r.requesting_partner_display ?? '—',
        priority: r.priority ?? 'normal',
        stage: r.status === 'published'
          ? `${r.current_step_name ?? 'Revisión'}${r.pending_approvers_display ? ` · ${r.pending_approvers_display}` : ''}`
          : r.status === 'returned' ? 'Con el solicitante' : '—',
        due_label: dueIso ? `${formatDateMx(dueIso)}${r.is_overdue ? ' · vencida' : ''}` : (r.due_date ? formatDateMx(r.due_date) : '—'),
        _sort_priority: APPROVAL_PRIORITY_ORDER[r.priority ?? 'normal']
      }
    })
    .sort((a, b) => tab.value === 'pending'
      ? (a._sort_priority - b._sort_priority) || String(a.due_label).localeCompare(String(b.due_label))
      : 0))

const counts = computed(() => ({
  pending: pendingIds.value.size,
  mine: rows.value.filter(r => r.requesting_partner_id === myPid.value || r.captured_by_partner_id === myPid.value).length,
  all: rows.value.length
}))

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) { rows.value = []; pending.value = []; return }
  isLoading.value = true
  try {
    const [r, p, rs, cats] = await Promise.all([
      getRequestsByCompany(cid),
      getMyPending(cid),
      getRejectionReasons(cid),
      getSelectableCategoriesForRequests(cid)
    ])
    rows.value = r
    pending.value = p
    reasons.value = rs
    categoryOptions.value = cats.map(c => ({ value: c.id, label: c.name }))
    if (!route.query.tab && p.length === 0) tab.value = 'mine'
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })
watch(tab, () => { selected.value = []; bulkMessage.value = null })

const runBulk = async (result: ActionDialogResult): Promise<void> => {
  if (!bulkDialog.value) return
  const ids = selected.value.map(r => String(r.id))
  bulkLoading.value = true
  bulkError.value = null
  try {
    const res = await bulkDecide(ids, bulkDialog.value, result.text || null, result.option || null)
    if (!res.length && lastError.value) { bulkError.value = lastError.value; return }
    const ok = res.filter(r => r.ok).length
    const failed = res.filter(r => !r.ok)
    bulkMessage.value = failed.length
      ? `${ok} resueltas. ${failed.length} no se pudieron: ${failed[0]?.error ?? ''}`
      : `${ok} solicitudes ${bulkDialog.value === 'approve' ? 'aprobadas' : 'rechazadas'}.`
    bulkDialog.value = null
    selected.value = []
    await load()
  } finally {
    bulkLoading.value = false
  }
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'pending', label: 'Pendientes de mí' },
  { id: 'mine', label: 'Mis solicitudes' },
  { id: 'all', label: 'Todas las que puedo ver' }
]

const openDetail = (row: Record<string, unknown>) => navigateTo(`/admin/approval-requests/${row.id as string}`)
</script>

<template>
  <div class="w-full space-y-5 py-4">
    <div v-if="!selectedCompanyId" class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900">
      Elige tu empresa para ver tus solicitudes.
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          :class="tab === t.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'"
          @click="tab = t.id"
        >
          {{ t.label }}
          <span
            class="rounded-full px-2 py-0.5 text-xs"
            :class="tab === t.id ? 'bg-white/20' : t.id === 'pending' && counts.pending ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'"
          >{{ counts[t.id] }}</span>
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:grid-cols-2 lg:grid-cols-4">
        <FormSelect v-model="filterCategory" :options="categoryOptions" placeholder="Todas las categorías" clearable searchable size="sm" />
        <FormSelect v-model="filterStatus" :options="statusFilterOptions" placeholder="Todos los estados" clearable size="sm" />
        <FormSelect v-model="filterPriority" :options="APPROVAL_PRIORITY_OPTIONS" placeholder="Todas las prioridades" clearable size="sm" />
        <label class="flex items-center gap-2 px-1 text-sm text-slate-700">
          <input v-model="onlyOverdue" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600">
          Solo vencidas
        </label>
      </div>

      <p v-if="bulkMessage" class="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{{ bulkMessage }}</p>

      <div v-if="isLoading" class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50">
        Cargando solicitudes…
      </div>

      <Datatable
        v-else
        :key="tab"
        title="Solicitudes de aprobación"
        :description="tab === 'pending' ? 'Las que esperan tu decisión, de la más urgente a la menos urgente.' : 'Solo ves las solicitudes en las que participas o que tu rol permite revisar.'"
        :data="formatted"
        :columns="columns"
        :search-keys="['title', 'reference', 'category_name', 'requesting_partner_display', 'pending_approvers_display']"
        :selectable="tab === 'pending'"
        :exportable="true"
        export-filename="solicitudes-aprobacion"
        empty-title="Nada por aquí"
        :empty-message="tab === 'pending' ? 'No tienes solicitudes pendientes de aprobar.' : 'Crea una solicitud para empezar.'"
        :creatable="true"
        create-label="Nueva solicitud"
        @create="navigateTo('/admin/approval-requests/create')"
        @row-click="openDetail"
        @selection-change="selected = $event"
      >
        <template #bulkActions="{ selected: sel }">
          <div v-if="tab === 'pending' && sel.length" class="flex gap-2">
            <BtnApp variant="success" size="sm" :label="`Aprobar ${sel.length}`" @click="bulkDialog = 'approve'" />
            <BtnApp variant="danger" size="sm" :label="`Rechazar ${sel.length}`" @click="bulkDialog = 'reject'" />
          </div>
        </template>
        <template #actions="{ row }">
          <BtnApp variant="ghost" size="sm" label="Abrir" @click="openDetail(row)" />
        </template>
      </Datatable>
    </template>

    <ApprovalRequestActionDialog
      :open="bulkDialog !== null"
      :title="bulkDialog === 'approve' ? `Aprobar ${selected.length} solicitudes` : `Rechazar ${selected.length} solicitudes`"
      :description="bulkDialog === 'approve' ? 'El comentario se guarda en cada una.' : 'El motivo se guarda en cada una y se avisa a cada solicitante.'"
      :confirm-label="bulkDialog === 'approve' ? 'Aprobar' : 'Rechazar'"
      :confirm-variant="bulkDialog === 'approve' ? 'success' : 'danger'"
      :text-label="bulkDialog === 'approve' ? 'Comentario (opcional)' : 'Motivo del rechazo'"
      :text-required="bulkDialog === 'reject' && reasons.length === 0"
      :option-label="bulkDialog === 'reject' && reasons.length ? 'Motivo predefinido' : ''"
      :options="bulkDialog === 'reject' ? reasons.map(r => ({ value: r.id, label: r.name })) : []"
      :loading="bulkLoading"
      :error="bulkError"
      @close="bulkDialog = null"
      @confirm="runBulk"
    />
  </div>
</template>
