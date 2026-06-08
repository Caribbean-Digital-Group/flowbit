<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyCrmLeadForm,
  type CrmLeadFormData,
  crmLeadPriorityOptions
} from '~/components/CrmLead/Form.vue'
import {
  createEmptyCrmActivityForm,
  type CrmActivityFormData,
  crmActivityTypeOptions
} from '~/components/CrmActivity/Form.vue'
import type { Database, Tables, TablesUpdate } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

type CrmLeadView = Database['public']['Views']['v_crm_leads']['Row']
type CrmActivityView = Database['public']['Views']['v_crm_activities']['Row']
type CrmHistoryView = Database['public']['Views']['v_crm_history']['Row']
type CrmLeadStage = Tables<'crm_lead_stage'>
type OrderView = Database['public']['Views']['v_orders']['Row']

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getLeadViewById, updateLead, archiveLead, getLinkedOrders, linkOrder, unlinkOrder } = useCrmLead()
const { getStagesByCompany } = useCrmStage()
const { getActivitiesByLead, createActivity, updateActivity, markAsDone, archiveActivity, getHistoryByLead } = useCrmActivity()
const { getPartnersByCompany, createPartner } = usePartner()
const { getCompanyMembers } = useMembership()
const { getOrdersByCompany } = useOrder()

const leadId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const isCreatingPartner = ref(false)
const errorMessage = ref<string | null>(null)

const leadView = ref<CrmLeadView | null>(null)
const formData = ref<CrmLeadFormData>(createEmptyCrmLeadForm())
const initialForm = ref<CrmLeadFormData>(createEmptyCrmLeadForm())

const stageOptions = ref<{ value: string; label: string }[]>([])
const partnerOptions = ref<{ value: string; label: string }[]>([])
const memberOptions = ref<{ value: string; label: string }[]>([])
const stages = ref<CrmLeadStage[]>([])

// Tabs
const activeTab = ref<'activities' | 'orders' | 'history'>('activities')

// Activities
const activities = ref<CrmActivityView[]>([])
const isLoadingActivities = ref(false)
const showActivityForm = ref(false)
const activityFormData = ref<CrmActivityFormData>(createEmptyCrmActivityForm())
const editingActivityId = ref<string | null>(null)
const isSavingActivity = ref(false)

// History
const historyItems = ref<CrmHistoryView[]>([])
const isLoadingHistory = ref(false)

// Linked orders
const linkedOrderIds = ref<string[]>([])
const allOrders = ref<OrderView[]>([])
const isLoadingOrders = ref(false)
const showLinkOrderPanel = ref(false)
const linkingOrderId = ref<string | null>(null)

// ──────────────────────────────
// COMPUTED
// ──────────────────────────────
const stageLabel = computed(() => leadView.value?.stage_name ?? '—')
const stageVariant = computed((): 'success' | 'warning' | 'danger' | 'primary' | 'secondary' => {
  if (leadView.value?.is_won) return 'success'
  if (leadView.value?.is_lost) return 'danger'
  return 'primary'
})

const priorityLabel = computed(() =>
  crmLeadPriorityOptions.find(o => o.value === leadView.value?.priority)?.label ?? '—'
)

const linkedOrders = computed(() =>
  allOrders.value.filter(o => o.id && linkedOrderIds.value.includes(o.id))
)

const unlinkableOrders = computed(() => {
  const partnerId = leadView.value?.partner_id ?? null
  return allOrders.value.filter(o => {
    if (!o.id || linkedOrderIds.value.includes(o.id)) return false
    if (partnerId && o.partner_id !== partnerId) return false
    return true
  })
})

const ordersTotal = computed(() =>
  linkedOrders.value.reduce((sum, o) => sum + Number(o.amount_total ?? 0), 0)
)

const orderStateLabel = (state: string | null): string =>
  ({ draft: 'Borrador', posted: 'Confirmada', cancel: 'Cancelada' }[state ?? ''] ?? '—')

const orderStateClass = (state: string | null): string =>
  state === 'posted' ? 'bg-indigo-100 text-indigo-700'
  : state === 'cancel' ? 'bg-red-100 text-red-700'
  : 'bg-amber-100 text-amber-700'

const activityTypeLabel = (type: string): string =>
  crmActivityTypeOptions.find(o => o.value === type)?.label ?? type

const historyEventLabel = (event: string): string => {
  const map: Record<string, string> = {
    created: 'Lead creado',
    stage_changed: 'Cambio de etapa',
    responsible_changed: 'Cambio de responsable',
    order_linked: 'Orden vinculada',
    order_unlinked: 'Orden desvinculada',
    priority_changed: 'Cambio de prioridad',
    closed_won: 'Cerrado como Ganado',
    closed_lost: 'Cerrado como Cancelado',
    reopened: 'Lead reabierto'
  }
  return map[event] ?? event
}

const formatCurrency = (value: number, currency: string = 'MXN'): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN', maximumFractionDigits: 2 }).format(value || 0)

const formatDatetime = (value: string | null): string => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch { return value }
}

const formatDate = (value: string | null): string => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
  } catch { return value }
}

// ──────────────────────────────
// LOAD
// ──────────────────────────────
const mapViewToForm = (v: CrmLeadView): CrmLeadFormData => ({
  name: v.name ?? '',
  stage_id: v.stage_id ?? '',
  partner_id: v.partner_id ?? null,
  contact_name: v.contact_name ?? '',
  contact_email: v.contact_email ?? '',
  contact_phone: v.contact_phone ?? '',
  contact_company: v.contact_company ?? '',
  origin: (v.origin as CrmLeadFormData['origin']) ?? 'other',
  responsible_partner_id: v.responsible_partner_id ?? null,
  expected_close_date: v.expected_close_date ?? '',
  amount: Number(v.amount ?? 0),
  currency: v.currency ?? 'MXN',
  probability: v.probability ?? 0,
  description: v.description ?? '',
  priority: (v.priority as CrmLeadFormData['priority']) ?? 'medium',
  tags: (v.tags ?? []).join(', ')
})

const mapFormToUpdate = (value: CrmLeadFormData): TablesUpdate<'crm_lead'> => ({
  name: value.name.trim(),
  stage_id: value.stage_id,
  partner_id: value.partner_id || null,
  contact_name: value.contact_name.trim() || null,
  contact_email: value.contact_email.trim() || null,
  contact_phone: value.contact_phone.trim() || null,
  contact_company: value.contact_company.trim() || null,
  origin: value.origin,
  responsible_partner_id: value.responsible_partner_id || null,
  expected_close_date: value.expected_close_date || null,
  amount: Number(value.amount) || null,
  currency: value.currency || 'MXN',
  probability: Number(value.probability) || 0,
  description: value.description.trim() || null,
  priority: value.priority,
  tags: value.tags ? value.tags.split(',').map(t => t.trim()).filter(Boolean) : []
})

const loadLead = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !leadId.value) return

  isLoading.value = true
  try {
    const [view, stagesList, partners, members] = await Promise.all([
      getLeadViewById(leadId.value, companyId),
      getStagesByCompany(companyId),
      getPartnersByCompany(companyId),
      getCompanyMembers(companyId, 'team')
    ])

    if (!view) { router.push('/admin/crm/leads'); return }

    leadView.value = view
    stages.value = stagesList
    stageOptions.value = stagesList.map(s => ({ value: s.id, label: s.name }))
    partnerOptions.value = partners.map(p => ({
      value: p.id,
      label: (p.display_name?.trim() || p.name)?.trim() || p.id
    }))
    memberOptions.value = members
      .filter(m => m.is_active && m.partner_user_id)
      .map(m => ({
        value: m.partner_id,
        label: (m.partner_display_name?.trim() || m.partner_name)?.trim() || m.partner_id
      }))

    formData.value = mapViewToForm(view)
    initialForm.value = mapViewToForm(view)
  } finally {
    isLoading.value = false
  }
}

const loadActivities = async () => {
  if (!leadId.value) return
  isLoadingActivities.value = true
  try {
    activities.value = await getActivitiesByLead(leadId.value)
  } finally {
    isLoadingActivities.value = false
  }
}

const loadHistory = async () => {
  if (!leadId.value) return
  isLoadingHistory.value = true
  try {
    historyItems.value = await getHistoryByLead(leadId.value)
  } finally {
    isLoadingHistory.value = false
  }
}

const loadOrdersData = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !leadId.value) return
  isLoadingOrders.value = true
  try {
    const [linkedList, orders] = await Promise.all([
      getLinkedOrders(leadId.value),
      getOrdersByCompany(companyId)
    ])
    linkedOrderIds.value = linkedList.map(lo => lo.order_id)
    allOrders.value = orders
  } finally {
    isLoadingOrders.value = false
  }
}

watch([selectedCompanyId, leadId], () => {
  void loadLead()
  void loadActivities()
  void loadHistory()
  void loadOrdersData()
}, { immediate: true })

// ──────────────────────────────
// LEAD ACTIONS
// ──────────────────────────────
const handleEdit = () => { isEditing.value = true }
const handleCancel = () => { formData.value = { ...initialForm.value }; isEditing.value = false; errorMessage.value = null }
const handleBack = () => router.push('/admin/crm/leads')

const handleCreatePartner = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const rawName = (formData.value.contact_name || formData.value.contact_company).trim()
  if (!rawName) { errorMessage.value = 'Ingresa el nombre del contacto o empresa antes de crear el partner.'; return }

  const duplicate = partnerOptions.value.some(p => p.label.toLowerCase() === rawName.toLowerCase())
  if (duplicate) { errorMessage.value = `Ya existe un partner con el nombre "${rawName}".`; return }

  isCreatingPartner.value = true
  errorMessage.value = null
  try {
    const created = await createPartner(companyId, {
      name: rawName,
      display_name: formData.value.contact_name.trim() || null
    })
    if (!created) { errorMessage.value = 'No se pudo crear el contacto. Verifica tus permisos.'; return }
    partnerOptions.value = [...partnerOptions.value, { value: created.id, label: created.display_name?.trim() || created.name }]
    formData.value.partner_id = created.id
  } finally {
    isCreatingPartner.value = false
  }
}

const handleSave = async () => {
  errorMessage.value = null
  const companyId = selectedCompanyId.value
  if (!companyId || !leadId.value) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El título es obligatorio.'; return }
  if (!formData.value.stage_id) { errorMessage.value = 'Selecciona una etapa.'; return }

  isLoading.value = true
  try {
    const updated = await updateLead(leadId.value, companyId, mapFormToUpdate(formData.value))
    if (!updated) { errorMessage.value = 'No se pudo guardar el lead.'; return }
    const view = await getLeadViewById(leadId.value, companyId)
    if (view) { leadView.value = view; formData.value = mapViewToForm(view); initialForm.value = mapViewToForm(view) }
    isEditing.value = false
    void loadHistory()
  } finally {
    isLoading.value = false
  }
}

const moveToStage = async (stageId: string) => {
  const companyId = selectedCompanyId.value
  if (!companyId || !leadId.value) return
  isLoading.value = true
  try {
    await updateLead(leadId.value, companyId, { stage_id: stageId })
    const view = await getLeadViewById(leadId.value, companyId)
    if (view) { leadView.value = view; formData.value = mapViewToForm(view); initialForm.value = mapViewToForm(view) }
    void loadHistory()
  } finally {
    isLoading.value = false
  }
}

const menuOptions = computed<MenuOption[]>(() => {
  const opts: MenuOption[] = []
  const wonStage = stages.value.find(s => s.is_won)
  const lostStage = stages.value.find(s => s.is_lost)

  if (wonStage && !leadView.value?.is_won) {
    opts.push({
      id: 'mark-won',
      label: 'Marcar como Ganado',
      variant: 'success',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => moveToStage(wonStage.id)
    })
  }

  if (lostStage && !leadView.value?.is_lost) {
    opts.push({
      id: 'mark-lost',
      label: 'Marcar como Cancelado',
      variant: 'danger',
      icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => moveToStage(lostStage.id)
    })
  }

  if (leadView.value?.is_won || leadView.value?.is_lost) {
    const defaultStage = stages.value.find(s => !s.is_won && !s.is_lost)
    if (defaultStage) {
      opts.push({
        id: 'reopen',
        label: 'Reabrir lead',
        variant: 'default',
        icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
        action: () => moveToStage(defaultStage.id)
      })
    }
  }

  opts.push({
    id: 'archive',
    label: 'Archivar lead',
    variant: 'danger',
    divider: true,
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    action: async () => { if (leadId.value) { await archiveLead(leadId.value); router.push('/admin/crm/leads') } }
  })

  return opts
})

// ──────────────────────────────
// ACTIVITY ACTIONS
// ──────────────────────────────
const openActivityForm = (activity?: CrmActivityView) => {
  if (activity) {
    editingActivityId.value = activity.id ?? null
    activityFormData.value = {
      type: (activity.type as CrmActivityFormData['type']) ?? 'task',
      title: activity.title ?? '',
      scheduled_at: activity.scheduled_at
        ? (() => {
            const d = new Date(activity.scheduled_at)
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          })()
        : '',
      responsible_partner_id: activity.responsible_partner_id ?? null,
      notes: activity.notes ?? ''
    }
  } else {
    editingActivityId.value = null
    activityFormData.value = createEmptyCrmActivityForm()
  }
  showActivityForm.value = true
}

const closeActivityForm = () => {
  showActivityForm.value = false
  editingActivityId.value = null
  activityFormData.value = createEmptyCrmActivityForm()
}

const handleSaveActivity = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !leadId.value) return
  if (!activityFormData.value.title.trim()) return

  isSavingActivity.value = true
  try {
    const scheduledAtUtc = activityFormData.value.scheduled_at
      ? new Date(activityFormData.value.scheduled_at).toISOString()
      : null

    if (editingActivityId.value) {
      await updateActivity(editingActivityId.value, {
        type: activityFormData.value.type,
        title: activityFormData.value.title.trim(),
        scheduled_at: scheduledAtUtc,
        responsible_partner_id: activityFormData.value.responsible_partner_id || null,
        notes: activityFormData.value.notes.trim() || null
      })
    } else {
      await createActivity(companyId, {
        lead_id: leadId.value,
        type: activityFormData.value.type,
        title: activityFormData.value.title.trim(),
        scheduled_at: scheduledAtUtc,
        responsible_partner_id: activityFormData.value.responsible_partner_id || null,
        notes: activityFormData.value.notes.trim() || null
      })
    }
    closeActivityForm()
    await loadActivities()
  } finally {
    isSavingActivity.value = false
  }
}

const handleMarkActivityDone = async (activityId: string) => {
  await markAsDone(activityId)
  await loadActivities()
}

const handleDeleteActivity = async (activityId: string) => {
  await archiveActivity(activityId)
  await loadActivities()
}

// ──────────────────────────────
// ORDER LINK ACTIONS
// ──────────────────────────────
const handleLinkOrder = async (orderId: string) => {
  if (!leadId.value) return
  linkingOrderId.value = orderId
  try {
    await linkOrder(leadId.value, orderId)
    await loadOrdersData()
    const view = await getLeadViewById(leadId.value, selectedCompanyId.value ?? '')
    if (view) leadView.value = view
    void loadHistory()
  } finally {
    linkingOrderId.value = null
  }
}

const handleUnlinkOrder = async (orderId: string) => {
  if (!leadId.value) return
  linkingOrderId.value = orderId
  try {
    await unlinkOrder(leadId.value, orderId)
    await loadOrdersData()
    const view = await getLeadViewById(leadId.value, selectedCompanyId.value ?? '')
    if (view) leadView.value = view
    void loadHistory()
  } finally {
    linkingOrderId.value = null
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <CardSheet
      :title="leadView?.name ?? 'Lead'"
      :subtitle="`#${leadView?.lead_number ?? '—'} · ${leadView?.stage_name ?? '—'}`"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :show-footer="false"
      :menu-options="menuOptions"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
      <template #status>
        <BadgeApp :variant="stageVariant" :label="stageLabel" />
        <BadgeApp
          v-if="leadView?.priority"
          :variant="leadView.priority === 'high' ? 'warning' : 'secondary'"
          :label="priorityLabel"
        />
      </template>

      <div
        v-if="errorMessage"
        class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
      >
        {{ errorMessage }}
      </div>

      <!-- PIPELINE BAR (read-only) -->
      <div v-if="!isEditing && stages.length > 0" class="mb-6">
        <div class="flex items-center gap-1 overflow-x-auto pb-1">
          <button
            v-for="stage in stages.sort((a, b) => a.sequence - b.sequence)"
            :key="stage.id"
            type="button"
            :title="`Mover a: ${stage.name}`"
            :class="[
              'flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              stage.id === leadView?.stage_id
                ? stage.is_won
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : stage.is_lost
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            ]"
            @click="moveToStage(stage.id)"
          >
            {{ stage.name }}
          </button>
        </div>
      </div>

      <!-- LEAD FORM -->
      <CrmLeadForm
        v-model="formData"
        :readonly="!isEditing"
        :stage-options="stageOptions"
        :partner-options="partnerOptions"
        :responsible-options="memberOptions"
        :is-creating-partner="isCreatingPartner"
        @create-partner="handleCreatePartner"
      />

      <!-- METADATA FOOTER -->
      <div
        v-if="leadView && !isEditing"
        class="mt-6 border-t border-slate-200 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-500"
      >
        <div>
          <span class="block font-medium text-slate-600">Creado</span>
          {{ formatDate(leadView.created_at ?? null) }}
        </div>
        <div v-if="leadView.actual_close_date">
          <span class="block font-medium text-slate-600">Fecha de cierre real</span>
          {{ formatDate(leadView.actual_close_date) }}
        </div>
        <div>
          <span class="block font-medium text-slate-600">Órdenes vinculadas</span>
          {{ leadView.order_count ?? 0 }}
          <span v-if="leadView.orders_total" class="ml-1">({{ formatCurrency(Number(leadView.orders_total)) }})</span>
        </div>
        <div>
          <span class="block font-medium text-slate-600">Actividades abiertas</span>
          {{ leadView.open_activity_count ?? 0 }}
        </div>
      </div>
    </CardSheet>

    <!-- ─── TABS: Activities / Orders / History ─── -->
    <div class="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
      <!-- Tab Headers -->
      <div class="flex border-b border-slate-200 bg-slate-50">
        <button
          v-for="tab in [
            { key: 'activities', label: 'Actividades', count: activities.filter(a => a.status !== 'done').length },
            { key: 'orders', label: 'Órdenes vinculadas', count: linkedOrders.length },
            { key: 'history', label: 'Historial', count: historyItems.length }
          ]"
          :key="tab.key"
          type="button"
          :class="[
            'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2',
            activeTab === tab.key
              ? 'border-indigo-500 text-indigo-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
          ]"
          @click="activeTab = tab.key as typeof activeTab"
        >
          {{ tab.label }}
          <span
            v-if="tab.count > 0"
            class="min-w-[1.25rem] rounded-full bg-indigo-100 px-1.5 text-[11px] font-bold text-indigo-700"
          >
            {{ tab.count }}
          </span>
        </button>
      </div>

      <!-- ACTIVITIES TAB -->
      <div v-if="activeTab === 'activities'" class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-700">Actividades de seguimiento</h3>
          <BtnApp variant="primary" size="sm" @click="openActivityForm()">
            <template #iconLeft>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
            Nueva actividad
          </BtnApp>
        </div>

        <div v-if="isLoadingActivities" class="py-8 text-center text-sm text-slate-500">
          Cargando actividades…
        </div>

        <div v-else-if="activities.length === 0" class="py-8 text-center text-sm text-slate-500">
          No hay actividades registradas para este lead.
        </div>

        <ul v-else class="space-y-2">
          <li
            v-for="act in activities"
            :key="act.id ?? ''"
            :class="[
              'rounded-xl border p-4 transition-colors',
              act.computed_status === 'overdue'
                ? 'border-red-200 bg-red-50'
                : act.computed_status === 'done'
                  ? 'border-slate-100 bg-slate-50'
                  : 'border-slate-200 bg-white'
            ]"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-slate-900">{{ act.title }}</span>
                  <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    {{ activityTypeLabel(act.type ?? 'task') }}
                  </span>
                  <span
                    v-if="act.computed_status === 'overdue'"
                    class="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                  >
                    Vencida
                  </span>
                  <span
                    v-else-if="act.computed_status === 'done'"
                    class="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                  >
                    Realizada
                  </span>
                </div>
                <div class="mt-1 text-xs text-slate-500 space-y-0.5">
                  <p v-if="act.scheduled_at">
                    Programada: {{ formatDatetime(act.scheduled_at ?? null) }}
                  </p>
                  <p v-if="act.responsible_display_name">
                    Responsable: {{ act.responsible_display_name }}
                  </p>
                  <p v-if="act.notes" class="text-slate-600 mt-1">{{ act.notes }}</p>
                </div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button
                  v-if="act.computed_status !== 'done'"
                  type="button"
                  title="Marcar como realizada"
                  class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                  @click="handleMarkActivityDone(act.id ?? '')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Editar"
                  class="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                  @click="openActivityForm(act)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Eliminar"
                  class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  @click="handleDeleteActivity(act.id ?? '')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- ORDERS TAB -->
      <div v-if="activeTab === 'orders'" class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Órdenes de venta vinculadas</h3>
            <p v-if="linkedOrders.length > 0" class="text-xs text-slate-500 mt-0.5">
              Total: {{ formatCurrency(ordersTotal) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <BtnApp
              variant="primary"
              size="sm"
              @click="navigateTo({ path: '/admin/orders/create', query: leadView?.partner_id ? { partner_id: leadView.partner_id } : {} })"
            >
              <template #iconLeft>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </template>
              Nueva orden
            </BtnApp>
            <BtnApp variant="secondary" size="sm" @click="showLinkOrderPanel = !showLinkOrderPanel">
              <template #iconLeft>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </template>
              Vincular orden
            </BtnApp>
          </div>
        </div>

        <!-- Link order panel -->
        <div v-if="showLinkOrderPanel" class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Órdenes disponibles para vincular</p>
            <span v-if="leadView?.partner_id" class="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
              Filtradas por partner del lead
            </span>
          </div>
          <div v-if="isLoadingOrders" class="text-sm text-slate-500">Cargando órdenes…</div>
          <div v-else-if="unlinkableOrders.length === 0" class="text-sm text-slate-500">
            No hay órdenes disponibles{{ leadView?.partner_id ? ' para el partner de este lead' : '' }}.
          </div>
          <ul v-else class="space-y-2 max-h-72 overflow-y-auto">
            <li
              v-for="order in unlinkableOrders"
              :key="order.id ?? ''"
              class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-medium text-slate-900 truncate">{{ order.name ?? `Orden ${order.id?.slice(0, 8)}` }}</p>
                  <span :class="['text-xs px-1.5 py-0.5 rounded font-medium', orderStateClass(order.order_state)]">
                    {{ orderStateLabel(order.order_state) }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  <span v-if="order.partner_name" class="font-medium text-slate-700">{{ order.partner_name }} · </span>
                  {{ formatCurrency(Number(order.amount_total ?? 0)) }}
                  <span v-if="order.line_count"> · {{ order.line_count }} línea{{ order.line_count === 1 ? '' : 's' }}</span>
                  <span v-if="order.order_date"> · {{ formatDate(order.order_date) }}</span>
                </p>
              </div>
              <button
                type="button"
                :disabled="linkingOrderId === order.id"
                class="ml-3 flex-shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                @click="handleLinkOrder(order.id ?? '')"
              >
                Vincular
              </button>
            </li>
          </ul>
        </div>

        <div v-if="linkedOrders.length === 0" class="py-8 text-center text-sm text-slate-500">
          No hay órdenes vinculadas a este lead.
        </div>

        <ul v-else class="space-y-3">
          <li
            v-for="order in linkedOrders"
            :key="order.id ?? ''"
            class="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-200 transition-colors"
          >
            <div class="flex items-start justify-between gap-3">
              <!-- Order info -->
              <div class="min-w-0 flex-1">
                <!-- Name + state + reference -->
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold text-slate-900">{{ order.name ?? `Orden ${order.id?.slice(0, 8)}` }}</p>
                  <span :class="['text-xs px-1.5 py-0.5 rounded font-medium', orderStateClass(order.order_state)]">
                    {{ orderStateLabel(order.order_state) }}
                  </span>
                  <span v-if="order.reference" class="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    Ref: {{ order.reference }}
                  </span>
                </div>

                <!-- Partner + amount + date -->
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span v-if="order.partner_name" class="font-medium text-slate-700">{{ order.partner_name }}</span>
                  <span class="font-semibold text-slate-800">{{ formatCurrency(Number(order.amount_total ?? 0)) }}</span>
                  <span v-if="order.line_count">{{ order.line_count }} línea{{ order.line_count === 1 ? '' : 's' }}</span>
                  <span v-if="order.order_date">{{ formatDate(order.order_date) }}</span>
                  <span v-if="order.project_name" class="text-violet-600">{{ order.project_name }}</span>
                </div>

                <!-- Status pills -->
                <div class="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span :class="['inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', order.is_delivered ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500']">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Entregada
                  </span>
                  <span :class="['inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', order.is_invoiced ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500']">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Facturada
                  </span>
                  <span :class="['inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', order.is_paid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500']">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pagada
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1 flex-shrink-0">
                <NuxtLink
                  :to="`/admin/orders/${order.id}`"
                  class="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Ver orden"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </NuxtLink>
                <button
                  type="button"
                  :disabled="linkingOrderId === order.id"
                  title="Desvincular orden"
                  class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-60 transition-colors"
                  @click="handleUnlinkOrder(order.id ?? '')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- HISTORY TAB -->
      <div v-if="activeTab === 'history'" class="p-5 space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">Historial de cambios</h3>

        <div v-if="isLoadingHistory" class="py-8 text-center text-sm text-slate-500">
          Cargando historial…
        </div>

        <div v-else-if="historyItems.length === 0" class="py-8 text-center text-sm text-slate-500">
          No hay eventos registrados en el historial.
        </div>

        <ul v-else class="relative space-y-0">
          <li
            v-for="(item, index) in historyItems"
            :key="item.id ?? index"
            class="flex gap-3 pb-4"
          >
            <div class="flex flex-col items-center">
              <div
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm',
                  item.event === 'closed_won' ? 'bg-emerald-500' :
                  item.event === 'closed_lost' ? 'bg-red-500' :
                  item.event === 'created' ? 'bg-indigo-500' :
                  'bg-slate-400'
                ]"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    :d="item.event === 'closed_won' ? 'M5 13l4 4L19 7' :
                        item.event === 'closed_lost' ? 'M6 18L18 6M6 6l12 12' :
                        item.event === 'created' ? 'M12 4v16m8-8H4' :
                        item.event?.includes('changed') ? 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' :
                        'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'"
                  />
                </svg>
              </div>
              <div v-if="index < historyItems.length - 1" class="w-px flex-1 bg-slate-200 mt-1" />
            </div>
            <div class="flex-1 pt-1 pb-2">
              <p class="text-sm font-semibold text-slate-800">{{ historyEventLabel(item.event ?? '') }}</p>
              <div v-if="item.old_value || item.new_value" class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <span v-if="item.old_value" class="line-through">{{ item.old_value }}</span>
                <svg v-if="item.old_value && item.new_value" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span v-if="item.new_value" class="font-medium text-slate-700">{{ item.new_value }}</span>
              </div>
              <p class="mt-1 text-[11px] text-slate-400">
                {{ formatDatetime(item.created_at ?? null) }}
                <span v-if="item.created_by_display_name"> · {{ item.created_by_display_name }}</span>
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- ACTIVITY FORM SLIDE-OVER -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showActivityForm"
          class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
          @click.self="closeActivityForm"
        />
      </Transition>

      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-if="showActivityForm"
          class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        >
          <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-gradient-to-r from-indigo-50 to-violet-50">
            <h3 class="text-base font-semibold text-slate-800">
              {{ editingActivityId ? 'Editar actividad' : 'Nueva actividad' }}
            </h3>
            <button
              type="button"
              class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              @click="closeActivityForm"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5">
            <CrmActivityForm
              v-model="activityFormData"
              :responsible-options="memberOptions"
            />
          </div>

          <div class="border-t border-slate-200 px-5 py-4 flex justify-end gap-3">
            <BtnApp variant="ghost" @click="closeActivityForm">Cancelar</BtnApp>
            <BtnApp variant="primary" :disabled="isSavingActivity" @click="handleSaveActivity">
              {{ isSavingActivity ? 'Guardando…' : 'Guardar actividad' }}
            </BtnApp>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
