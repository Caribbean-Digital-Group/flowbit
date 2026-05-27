<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type TaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type ApprovalRequestViewRow = Database['public']['Views']['v_approval_requests']['Row']
type CrmActivityViewRow = Database['public']['Views']['v_crm_activities']['Row']

type AgendaItemType = 'task' | 'approval' | 'activity'
type AgendaFilter = 'all' | AgendaItemType

interface AgendaItem {
  id: string
  type: AgendaItemType
  title: string
  subtitle: string
  dateIso: string
  dateLabel: string
  statusLabel: string
  href: string
  isOverdue: boolean
}

const authStore = useAuthStore()
const { selectedCompanyId, partner } = storeToRefs(authStore)

const { getAssignedTasksForPartner } = useProjectTask()
const { getPublishedRequestsForMyManager } = useApprovalRequest()
const { getActivitiesByCompany } = useCrmActivity()

const isLoading = ref(false)
const activeFilter = ref<AgendaFilter>('all')
const search = ref('')

const tasks = ref<TaskViewRow[]>([])
const approvals = ref<ApprovalRequestViewRow[]>([])
const activities = ref<CrmActivityViewRow[]>([])

const filterOptions: Array<{ value: AgendaFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'task', label: 'Tareas' },
  { value: 'approval', label: 'Aprobaciones' },
  { value: 'activity', label: 'Seguimientos CRM' }
]

const taskStatusLabel = (status: string | null): string => {
  if (status === 'completed') return 'Terminada'
  if (status === 'in_progress') return 'En proceso'
  if (status === 'cancelled') return 'Cancelada'
  return 'Pendiente'
}

const activityTypeLabel = (type: string | null): string => {
  if (type === 'call') return 'Llamada'
  if (type === 'meeting') return 'Reunión'
  if (type === 'email') return 'Correo'
  if (type === 'demo') return 'Demo'
  if (type === 'followup') return 'Seguimiento'
  return 'Tarea'
}

const formatDateLabel = (iso: string): string =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))

const formatDateOnlyLabel = (iso: string): string =>
  new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(iso))

const startOfToday = (): Date => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

const normalizeDate = (value: string | null): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const agendaItems = computed<AgendaItem[]>(() => {
  const items: AgendaItem[] = []
  const today = startOfToday().getTime()

  for (const task of tasks.value) {
    const dateIso = normalizeDate(task.due_date ?? task.created_at)
    if (!task.id || !dateIso) continue
    if (task.status === 'completed' || task.status === 'cancelled') continue

    items.push({
      id: task.id,
      type: 'task',
      title: task.name ?? 'Tarea sin título',
      subtitle: `${task.project_code ? `${task.project_code} · ` : ''}${task.project_name ?? 'Proyecto'}`,
      dateIso,
      dateLabel: formatDateLabel(dateIso),
      statusLabel: taskStatusLabel(task.status),
      href: `/admin/tasks/${task.id}`,
      isOverdue: Boolean(task.is_overdue) || new Date(dateIso).getTime() < today
    })
  }

  for (const req of approvals.value) {
    const dateIso = normalizeDate(req.request_date ?? req.created_at)
    if (!req.id || !dateIso) continue

    items.push({
      id: req.id,
      type: 'approval',
      title: req.title ?? 'Solicitud sin título',
      subtitle: `${req.category_name ?? 'Sin categoría'}${req.request_number != null ? ` · #${req.request_number}` : ''}`,
      dateIso,
      dateLabel: formatDateLabel(dateIso),
      statusLabel: 'Publicada',
      href: `/admin/approval-requests/${req.id}`,
      isOverdue: false
    })
  }

  for (const activity of activities.value) {
    const dateIso = normalizeDate(activity.scheduled_at ?? activity.created_at)
    if (!activity.id || !activity.lead_id || !dateIso) continue
    if (activity.status === 'done') continue

    items.push({
      id: activity.id,
      type: 'activity',
      title: activity.title ?? 'Actividad CRM',
      subtitle: `${activity.lead_name ?? 'Lead'} · ${activityTypeLabel(activity.type)}`,
      dateIso,
      dateLabel: formatDateLabel(dateIso),
      statusLabel: activity.status === 'overdue' ? 'Atrasada' : 'Pendiente',
      href: `/admin/crm/leads/${activity.lead_id}`,
      isOverdue: activity.status === 'overdue'
    })
  }

  return items
    .filter((item) => {
      if (activeFilter.value === 'all') return true
      return item.type === activeFilter.value
    })
    .filter((item) => {
      const term = search.value.trim().toLowerCase()
      if (!term) return true
      return item.title.toLowerCase().includes(term) || item.subtitle.toLowerCase().includes(term)
    })
    .sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime())
})

const groupedAgenda = computed(() => {
  const grouped = new Map<string, AgendaItem[]>()
  for (const item of agendaItems.value) {
    const dayKey = item.dateIso.slice(0, 10)
    const list = grouped.get(dayKey) ?? []
    list.push(item)
    grouped.set(dayKey, list)
  }

  return Array.from(grouped.entries()).map(([dayKey, items]) => ({
    dayKey,
    dayLabel: formatDateOnlyLabel(`${dayKey}T00:00:00`),
    items
  }))
})

const totalCount = computed(() => agendaItems.value.length)
const overdueCount = computed(() => agendaItems.value.filter(i => i.isOverdue).length)
const todayCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return agendaItems.value.filter(i => i.dateIso.slice(0, 10) === today).length
})

const typeLabel = (type: AgendaItemType): string => {
  if (type === 'task') return 'Tarea'
  if (type === 'approval') return 'Aprobación'
  return 'Seguimiento'
}

const typeBadgeClass = (type: AgendaItemType): string => {
  if (type === 'task') return 'bg-indigo-100 text-indigo-700'
  if (type === 'approval') return 'bg-violet-100 text-violet-700'
  return 'bg-sky-100 text-sky-700'
}

const refreshAgenda = async () => {
  const companyId = selectedCompanyId.value
  const partnerId = partner.value?.id

  if (!companyId || !partnerId) {
    tasks.value = []
    approvals.value = []
    activities.value = []
    return
  }

  isLoading.value = true
  try {
    const [taskRows, approvalRows, activityRows] = await Promise.all([
      getAssignedTasksForPartner(partnerId, companyId),
      getPublishedRequestsForMyManager(companyId, partnerId),
      getActivitiesByCompany(companyId)
    ])

    tasks.value = taskRows
    approvals.value = approvalRows
    activities.value = activityRows.filter((activity) => activity.responsible_partner_id === partnerId)
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, () => partner.value?.id], () => {
  void refreshAgenda()
}, { immediate: true })
</script>

<template>
  <section class="space-y-6">
    <header class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">Agenda de trabajo</h1>
          <p class="mt-1 text-sm text-slate-500">
            Vista tipo agenda para organizar tareas, aprobaciones y seguimientos CRM en una sola línea de tiempo.
          </p>
        </div>
        <BtnApp variant="secondary" @click="refreshAgenda">
          Actualizar agenda
        </BtnApp>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ totalCount }}</p>
        </div>
        <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-red-600">Atrasados</p>
          <p class="mt-1 text-2xl font-bold text-red-700">{{ overdueCount }}</p>
        </div>
        <div class="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Hoy</p>
          <p class="mt-1 text-2xl font-bold text-indigo-700">{{ todayCount }}</p>
        </div>
      </div>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 space-y-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="rounded-xl border px-3 py-1.5 text-sm font-medium transition"
            :class="activeFilter === option.value
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'"
            @click="activeFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="w-full lg:w-80">
          <FormInput
            v-model="search"
            label="Buscar en agenda"
            placeholder="Buscar por título, lead o proyecto"
            size="sm"
          />
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-center py-12">
        <div class="h-9 w-9 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>

      <div v-else-if="!partner" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No hay un partner vinculado a tu cuenta, por lo que no se puede construir la agenda personal.
      </div>

      <div v-else-if="groupedAgenda.length === 0" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No hay eventos para mostrar con los filtros actuales.
      </div>

      <div v-else class="space-y-5">
        <article
          v-for="group in groupedAgenda"
          :key="group.dayKey"
          class="rounded-xl border border-slate-200 overflow-hidden"
        >
          <header class="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h2 class="text-sm font-semibold capitalize text-slate-700">{{ group.dayLabel }}</h2>
          </header>

          <ul class="divide-y divide-slate-100">
            <li v-for="item in group.items" :key="`${item.type}-${item.id}`" class="px-4 py-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="typeBadgeClass(item.type)">
                      {{ typeLabel(item.type) }}
                    </span>
                    <span
                      v-if="item.isOverdue"
                      class="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                    >
                      Atrasado
                    </span>
                  </div>
                  <p class="text-sm font-semibold text-slate-900">{{ item.title }}</p>
                  <p class="text-xs text-slate-500">{{ item.subtitle }}</p>
                </div>

                <div class="flex flex-col items-end gap-1">
                  <p class="text-xs font-medium text-slate-600">{{ item.dateLabel }}</p>
                  <p class="text-[11px] text-slate-500">{{ item.statusLabel }}</p>
                  <NuxtLink
                    :to="item.href"
                    class="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                  >
                    Abrir
                  </NuxtLink>
                </div>
              </div>
            </li>
          </ul>
        </article>
      </div>
    </section>
  </section>
</template>
