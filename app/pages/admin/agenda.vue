<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

type TaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type ApprovalRequestViewRow = Database['public']['Views']['v_approval_requests']['Row']
type CrmActivityViewRow = Database['public']['Views']['v_crm_activities']['Row']

type AgendaItemType = 'task' | 'approval' | 'activity'
type AgendaFilter = 'all' | AgendaItemType
type AgendaView = 'list' | 'calendar'

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
const activeView = ref<AgendaView>('calendar')

const tasks = ref<TaskViewRow[]>([])
const approvals = ref<ApprovalRequestViewRow[]>([])
const activities = ref<CrmActivityViewRow[]>([])

// Calendar state
const today = new Date()
const calendarYear = ref(today.getFullYear())
const calendarMonth = ref(today.getMonth()) // 0-indexed

const filterOptions: Array<{ value: AgendaFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'task', label: 'Tareas' },
  { value: 'approval', label: 'Aprobaciones' },
  { value: 'activity', label: 'Seguimientos' }
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
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

const formatDateOnlyLabel = (iso: string): string =>
  new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))

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

const allAgendaItems = computed<AgendaItem[]>(() => {
  const items: AgendaItem[] = []
  const todayMs = startOfToday().getTime()

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
      isOverdue: Boolean(task.is_overdue) || new Date(dateIso).getTime() < todayMs
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

  return items.sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime())
})

const agendaItems = computed<AgendaItem[]>(() =>
  allAgendaItems.value
    .filter((item) => activeFilter.value === 'all' || item.type === activeFilter.value)
    .filter((item) => {
      const term = search.value.trim().toLowerCase()
      if (!term) return true
      return item.title.toLowerCase().includes(term) || item.subtitle.toLowerCase().includes(term)
    })
)

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
  const todayKey = new Date().toISOString().slice(0, 10)
  return agendaItems.value.filter(i => i.dateIso.slice(0, 10) === todayKey).length
})

// Calendar computed
const calendarMonthLabel = computed(() =>
  new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(
    new Date(calendarYear.value, calendarMonth.value, 1)
  )
)

const calendarDays = computed(() => {
  const year = calendarYear.value
  const month = calendarMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Start grid on Monday (0=Mon...6=Sun)
  let startDow = firstDay.getDay() // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1

  const days: Array<{ date: Date | null; dayKey: string | null }> = []

  // Leading empty cells
  for (let i = 0; i < startDow; i++) {
    days.push({ date: null, dayKey: null })
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date, dayKey })
  }

  return days
})

const itemsByDay = computed(() => {
  const map = new Map<string, AgendaItem[]>()
  for (const item of allAgendaItems.value) {
    const key = item.dateIso.slice(0, 10)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
})

const selectedCalendarDay = ref<string | null>(null)

const selectedDayItems = computed(() => {
  if (!selectedCalendarDay.value) return []
  return (itemsByDay.value.get(selectedCalendarDay.value) ?? [])
    .filter((item) => activeFilter.value === 'all' || item.type === activeFilter.value)
})

const todayKey = new Date().toISOString().slice(0, 10)

const prevMonth = () => {
  if (calendarMonth.value === 0) {
    calendarMonth.value = 11
    calendarYear.value -= 1
  } else {
    calendarMonth.value -= 1
  }
  selectedCalendarDay.value = null
}

const nextMonth = () => {
  if (calendarMonth.value === 11) {
    calendarMonth.value = 0
    calendarYear.value += 1
  } else {
    calendarMonth.value += 1
  }
  selectedCalendarDay.value = null
}

const goToToday = () => {
  calendarYear.value = today.getFullYear()
  calendarMonth.value = today.getMonth()
  selectedCalendarDay.value = todayKey
}

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

const typeIconColor = (type: AgendaItemType): string => {
  if (type === 'task') return 'bg-indigo-500'
  if (type === 'approval') return 'bg-violet-500'
  return 'bg-sky-500'
}

const calendarDotClass = (type: AgendaItemType): string => {
  if (type === 'task') return 'bg-indigo-500'
  if (type === 'approval') return 'bg-violet-500'
  return 'bg-sky-500'
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
    activities.value = activityRows.filter((a) => a.responsible_partner_id === partnerId)
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, () => partner.value?.id], () => {
  void refreshAgenda()
}, { immediate: true })
</script>

<template>
  <section class="space-y-5">
    <!-- Header -->
    <header class="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 class="text-lg font-bold text-slate-900">Agenda de trabajo</h1>
            <p class="text-sm text-slate-500">Tareas, aprobaciones y seguimientos CRM en una sola vista</p>
          </div>
        </div>
        <BtnApp variant="secondary" size="sm" @click="refreshAgenda">
          <template #iconLeft>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </template>
          Actualizar
        </BtnApp>
      </div>

      <!-- Stats -->
      <div class="mt-5 grid grid-cols-3 gap-3">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ totalCount }}</p>
          <p class="text-[11px] text-slate-400">eventos activos</p>
        </div>
        <div class="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-red-400">Atrasados</p>
          <p class="mt-1 text-2xl font-bold text-red-600">{{ overdueCount }}</p>
          <p class="text-[11px] text-red-400">requieren atención</p>
        </div>
        <div class="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">Hoy</p>
          <p class="mt-1 text-2xl font-bold text-indigo-600">{{ todayCount }}</p>
          <p class="text-[11px] text-indigo-400">para hoy</p>
        </div>
      </div>
    </header>

    <!-- Toolbar -->
    <div class="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg shadow-slate-200/50">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <!-- View switcher -->
        <div class="flex items-center gap-2">
          <div class="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
              :class="activeView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="activeView = 'list'"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Lista
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
              :class="activeView === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="activeView = 'calendar'"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendario
            </button>
          </div>

          <!-- Type filters -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              type="button"
              class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
              :class="activeFilter === option.value
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'"
              @click="activeFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- Search (only in list view) -->
        <div v-if="activeView === 'list'" class="w-full lg:w-72">
          <FormInput
            v-model="search"
            label="Buscar en agenda"
            placeholder="Título, proyecto o lead..."
            size="sm"
          />
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 shadow-lg shadow-slate-200/50">
      <div class="flex flex-col items-center gap-3">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p class="text-sm text-slate-400">Cargando agenda...</p>
      </div>
    </div>

    <!-- No partner -->
    <div v-else-if="!partner" class="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-lg shadow-slate-200/50">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <svg class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-slate-700">Sin partner vinculado</p>
      <p class="mt-1 text-xs text-slate-400">No se puede construir la agenda personal sin un partner asociado a tu cuenta.</p>
    </div>

    <!-- LIST VIEW -->
    <template v-else-if="activeView === 'list'">
      <div v-if="groupedAgenda.length === 0" class="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-lg shadow-slate-200/50">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p class="text-sm font-medium text-slate-700">Sin eventos</p>
        <p class="mt-1 text-xs text-slate-400">No hay eventos para los filtros seleccionados.</p>
      </div>

      <div v-else class="space-y-4">
        <article
          v-for="group in groupedAgenda"
          :key="group.dayKey"
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50"
        >
          <!-- Day header -->
          <header class="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
              :class="group.dayKey === todayKey ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'"
            >
              {{ new Date(`${group.dayKey}T00:00:00`).getDate() }}
            </div>
            <h2 class="text-sm font-semibold capitalize text-slate-700">{{ group.dayLabel }}</h2>
            <span class="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {{ group.items.length }}
            </span>
          </header>

          <ul class="divide-y divide-slate-50">
            <li
              v-for="item in group.items"
              :key="`${item.type}-${item.id}`"
              class="group px-5 py-4 transition-colors hover:bg-slate-50/60"
            >
              <div class="flex items-start gap-4">
                <!-- Color dot -->
                <div class="mt-1 flex-shrink-0">
                  <div class="h-2.5 w-2.5 rounded-full" :class="typeIconColor(item.type)" />
                </div>

                <!-- Content -->
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" :class="typeBadgeClass(item.type)">
                      {{ typeLabel(item.type) }}
                    </span>
                    <span v-if="item.isOverdue" class="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                      Atrasado
                    </span>
                  </div>
                  <p class="text-sm font-semibold text-slate-900 leading-snug">{{ item.title }}</p>
                  <p class="text-xs text-slate-400">{{ item.subtitle }}</p>
                </div>

                <!-- Meta -->
                <div class="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <p class="text-xs font-medium text-slate-500">{{ item.dateLabel }}</p>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    :class="item.isOverdue ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'"
                  >
                    {{ item.statusLabel }}
                  </span>
                  <NuxtLink
                    :to="item.href"
                    class="mt-0.5 flex items-center gap-1 text-xs font-semibold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-800"
                  >
                    Abrir
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </NuxtLink>
                </div>
              </div>
            </li>
          </ul>
        </article>
      </div>
    </template>

    <!-- CALENDAR VIEW -->
    <template v-else>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Calendar grid -->
        <div class="lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
          <!-- Month nav -->
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              @click="prevMonth"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div class="flex items-center gap-3">
              <h2 class="text-sm font-bold capitalize text-slate-900">{{ calendarMonthLabel }}</h2>
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                @click="goToToday"
              >
                Hoy
              </button>
            </div>

            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              @click="nextMonth"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Day-of-week headers -->
          <div class="grid grid-cols-7 border-b border-slate-100">
            <div
              v-for="dow in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']"
              :key="dow"
              class="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              {{ dow }}
            </div>
          </div>

          <!-- Calendar cells -->
          <div class="grid grid-cols-7">
            <div
              v-for="(cell, idx) in calendarDays"
              :key="idx"
              class="relative min-h-[72px] border-b border-r border-slate-100 p-1.5 last:border-r-0 transition-colors"
              :class="[
                cell.date ? 'cursor-pointer hover:bg-indigo-50/40' : 'bg-slate-50/30',
                cell.dayKey && selectedCalendarDay === cell.dayKey ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : '',
                cell.dayKey && cell.dayKey === todayKey ? 'bg-blue-50/50' : ''
              ]"
              @click="cell.dayKey && (selectedCalendarDay = cell.dayKey)"
            >
              <!-- Day number -->
              <div v-if="cell.date" class="flex items-center justify-between">
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                  :class="cell.dayKey === todayKey
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/40'
                    : 'text-slate-700'"
                >
                  {{ cell.date.getDate() }}
                </span>
                <span
                  v-if="cell.dayKey && itemsByDay.get(cell.dayKey)?.length"
                  class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500"
                >
                  {{ itemsByDay.get(cell.dayKey)?.length }}
                </span>
              </div>

              <!-- Event dots (up to 3) -->
              <div v-if="cell.dayKey && itemsByDay.get(cell.dayKey)?.length" class="mt-1.5 space-y-0.5">
                <div
                  v-for="(event, ei) in (itemsByDay.get(cell.dayKey) ?? []).slice(0, 3)"
                  :key="ei"
                  class="flex items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-[10px] font-medium leading-none"
                  :class="event.isOverdue ? 'bg-red-100 text-red-700' : typeBadgeClass(event.type)"
                >
                  <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full" :class="calendarDotClass(event.type)" />
                  <span class="truncate">{{ event.title }}</span>
                </div>
                <div
                  v-if="(itemsByDay.get(cell.dayKey)?.length ?? 0) > 3"
                  class="px-1 text-[9px] font-semibold text-slate-400"
                >
                  +{{ (itemsByDay.get(cell.dayKey)?.length ?? 0) - 3 }} más
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Day detail panel -->
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
          <div class="border-b border-slate-100 px-5 py-4">
            <h3 class="text-sm font-bold text-slate-900">
              <template v-if="selectedCalendarDay">
                {{ formatDateOnlyLabel(`${selectedCalendarDay}T00:00:00`) }}
              </template>
              <template v-else>
                Selecciona un día
              </template>
            </h3>
            <p class="mt-0.5 text-xs text-slate-400">
              {{ selectedCalendarDay ? `${selectedDayItems.length} evento${selectedDayItems.length !== 1 ? 's' : ''}` : 'Haz clic en cualquier día del calendario' }}
            </p>
          </div>

          <!-- No day selected -->
          <div v-if="!selectedCalendarDay" class="flex flex-col items-center justify-center px-5 py-12 text-center">
            <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-xs text-slate-400">Selecciona un día para ver los eventos programados</p>
          </div>

          <!-- Day events -->
          <div v-else-if="selectedDayItems.length === 0" class="flex flex-col items-center justify-center px-5 py-12 text-center">
            <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <svg class="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p class="text-sm font-medium text-slate-700">Sin eventos</p>
            <p class="mt-0.5 text-xs text-slate-400">No hay eventos para este día con los filtros activos.</p>
          </div>

          <ul v-else class="divide-y divide-slate-50 overflow-y-auto" style="max-height: 520px">
            <li
              v-for="item in selectedDayItems"
              :key="`cal-${item.type}-${item.id}`"
              class="group px-5 py-3.5"
            >
              <div class="flex items-start gap-3">
                <div class="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full" :class="typeIconColor(item.type)" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1 mb-0.5">
                    <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="typeBadgeClass(item.type)">
                      {{ typeLabel(item.type) }}
                    </span>
                    <span v-if="item.isOverdue" class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      Atrasado
                    </span>
                  </div>
                  <p class="text-xs font-semibold text-slate-800 leading-snug">{{ item.title }}</p>
                  <p class="mt-0.5 text-[11px] text-slate-400">{{ item.subtitle }}</p>
                  <NuxtLink
                    :to="item.href"
                    class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-800"
                  >
                    Ver detalle
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </NuxtLink>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
