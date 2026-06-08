<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type TaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type ProjectTaskStatus = Database['public']['Enums']['project_task_status']
type ProjectPriority = Database['public']['Enums']['project_priority']

const authStore = useAuthStore()
const { selectedCompanyId, partner } = storeToRefs(authStore)

const { getTasksByCompany, setTaskStatus, computeAggregatedMetrics } = useProjectTask()
const { getProjectsByCompany } = useProject()

const ALL_STATUSES: ProjectTaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']

const statusConfig: Record<
  ProjectTaskStatus,
  {
    title: string
    accent: string
    headerClass: string
    dotClass: string
  }
> = {
  pending: {
    title: 'Inicio',
    accent: 'from-sky-400 to-blue-600',
    headerClass: 'border-sky-100 bg-gradient-to-br from-sky-50/90 to-blue-50/40',
    dotClass: 'bg-sky-500'
  },
  in_progress: {
    title: 'En proceso',
    accent: 'from-violet-500 to-purple-600',
    headerClass: 'border-violet-100 bg-gradient-to-br from-violet-50/90 to-purple-50/40',
    dotClass: 'bg-violet-500'
  },
  completed: {
    title: 'Terminadas',
    accent: 'from-emerald-400 to-teal-600',
    headerClass: 'border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-teal-50/40',
    dotClass: 'bg-emerald-500'
  },
  cancelled: {
    title: 'Canceladas',
    accent: 'from-slate-400 to-slate-600',
    headerClass: 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/70',
    dotClass: 'bg-slate-400'
  }
}

const priorityLabel: Record<ProjectPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente'
}

const allTasks = ref<TaskViewRow[]>([])
const isLoading = ref(false)
const toastError = ref<string | null>(null)

const searchQuery = ref('')
const selectedProjectIds = ref<string[]>([])
const selectedStatuses = ref<ProjectTaskStatus[]>([...ALL_STATUSES])
const selectedPriorities = ref<ProjectPriority[]>([])
const overdueOnly = ref(false)
const hideDone = ref(false)
const myTasksOnly = ref(false)

const canFilterMyTasks = computed(() => Boolean(partner.value?.id))
const projectOptions = ref<{ id: string; label: string; code: string }[]>([])

function taskMatchesSearchSimple(task: TaskViewRow): boolean {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return true
  const haystack = `${task.name} ${task.code} ${task.project_name} ${task.project_code} ${task.description} ${task.responsible_name} ${task.responsible_display_name}`
    .toLowerCase()
  return haystack.includes(q)
}

const filteredTasks = computed(() =>
  allTasks.value.filter((task) => {
    if (!task.id) return false
    if (!taskMatchesSearchSimple(task)) return false
    if (selectedProjectIds.value.length > 0) {
      if (!task.project_id || !selectedProjectIds.value.includes(task.project_id)) return false
    }
    if (selectedStatuses.value.length > 0) {
      const st = (task.status ?? 'pending') as ProjectTaskStatus
      if (!selectedStatuses.value.includes(st)) return false
    }
    if (selectedPriorities.value.length > 0) {
      const pr = (task.priority ?? 'medium') as ProjectPriority
      if (!selectedPriorities.value.includes(pr)) return false
    }
    if (overdueOnly.value && task.is_overdue !== true) return false
    if (hideDone.value) {
      const st = task.status ?? 'pending'
      if (st === 'completed' || st === 'cancelled') return false
    }
    if (myTasksOnly.value) {
      const pid = partner.value?.id
      if (!pid || task.responsible_partner_id !== pid) return false
    }
    return true
  })
)

function tasksInColumn(status: ProjectTaskStatus): TaskViewRow[] {
  return filteredTasks.value.filter((t) => (t.status ?? 'pending') === status)
}

const filteredMetrics = computed(() => computeAggregatedMetrics(filteredTasks.value))

async function loadData() {
  const companyId = selectedCompanyId.value
  toastError.value = null
  if (!companyId) {
    allTasks.value = []
    projectOptions.value = []
    return
  }
  isLoading.value = true
  try {
    const [tasks, projects] = await Promise.all([
      getTasksByCompany(companyId),
      getProjectsByCompany(companyId)
    ])
    allTasks.value = tasks
    projectOptions.value = projects
      .map((p) => ({
        id: p.id ?? '',
        label: [p.code, p.name].filter(Boolean).join(' · ') || 'Proyecto',
        code: p.code ?? ''
      }))
      .filter((p) => p.id)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }
  finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => void loadData(), { immediate: true })
watch(canFilterMyTasks, (ok) => { if (!ok) myTasksOnly.value = false })

function toggleProject(id: string) {
  selectedProjectIds.value = selectedProjectIds.value.includes(id)
    ? selectedProjectIds.value.filter((x) => x !== id)
    : [...selectedProjectIds.value, id]
}

function toggleStatus(st: ProjectTaskStatus) {
  if (selectedStatuses.value.includes(st)) {
    if (selectedStatuses.value.length <= 1) return
    selectedStatuses.value = selectedStatuses.value.filter((x) => x !== st)
  }
  else {
    selectedStatuses.value = [...selectedStatuses.value, st]
  }
}

function togglePriority(p: ProjectPriority) {
  selectedPriorities.value = selectedPriorities.value.includes(p)
    ? selectedPriorities.value.filter((x) => x !== p)
    : [...selectedPriorities.value, p]
}

function resetFilters() {
  searchQuery.value = ''
  selectedProjectIds.value = []
  selectedStatuses.value = [...ALL_STATUSES]
  selectedPriorities.value = []
  overdueOnly.value = false
  hideDone.value = false
  myTasksOnly.value = false
}

function toggleMyTasksFilter() {
  if (!canFilterMyTasks.value) return
  myTasksOnly.value = !myTasksOnly.value
}

const activeFilterCount = computed(() => {
  let n = 0
  if (searchQuery.value.trim()) n += 1
  if (selectedProjectIds.value.length > 0) n += 1
  if (selectedStatuses.value.length !== ALL_STATUSES.length) n += 1
  if (selectedPriorities.value.length > 0) n += 1
  if (overdueOnly.value) n += 1
  if (hideDone.value) n += 1
  if (myTasksOnly.value) n += 1
  return n
})

async function handleKanbanDragStart(event: DragEvent, taskId: string) {
  event.dataTransfer?.setData('text/task-id', taskId)
}

async function handleKanbanDrop(event: DragEvent, newStatus: ProjectTaskStatus) {
  event.preventDefault()
  const taskId = event.dataTransfer?.getData('text/task-id')
  if (!taskId) return
  const ok = await setTaskStatus(taskId, newStatus)
  if (!ok) {
    toastError.value = 'No se pudo mover la tarjeta. Revisa permisos o el estado del proyecto.'
    return
  }
  toastError.value = null
  const idx = allTasks.value.findIndex((t) => t.id === taskId)
  if (idx !== -1) {
    const row = allTasks.value[idx]
    if (row && row.status !== newStatus) {
      allTasks.value[idx] = { ...row, status: newStatus }
    }
  }
  await loadData()
}

function goProject(task: TaskViewRow) {
  if (!task.project_id) return
  navigateTo(`/admin/projects/${task.project_id}`)
}

function goTaskDetail(task: TaskViewRow) {
  if (!task.id) return
  navigateTo(`/admin/tasks/${task.id}`)
}

const formatDue = (d: string | null): string => {
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('es-MX', { month: 'short', day: 'numeric' }).format(new Date(d))
  }
  catch {
    return d
  }
}

const filtersSummary = computed(() => {
  const parts: string[] = []
  parts.push(`${filteredTasks.value.length} tarea${filteredTasks.value.length !== 1 ? 's' : ''} visible${filteredTasks.value.length !== 1 ? 's' : ''}`)
  if (hideDone.value) parts.push('sin cerradas')
  if (overdueOnly.value) parts.push('solo atrasadas')
  if (selectedProjectIds.value.length > 0) parts.push(`${selectedProjectIds.value.length} proyecto(s)`)
  if (myTasksOnly.value) parts.push('solo mis tareas')
  return parts.join(' · ')
})

function getInitial(task: TaskViewRow): string {
  const name = task.responsible_display_name?.trim() || task.responsible_name?.trim() || ''
  return name.charAt(0).toUpperCase()
}

function priorityBadgeClass(priority: string | null): string {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'low': return 'bg-slate-100 text-slate-600 border-slate-200'
    default: return 'bg-indigo-50 text-indigo-700 border-indigo-100'
  }
}

function priorityStripeClass(priority: string | null): string {
  switch (priority) {
    case 'urgent': return 'bg-gradient-to-b from-red-500 to-orange-400'
    case 'high': return 'bg-gradient-to-b from-orange-400 to-amber-400'
    case 'low': return 'bg-slate-300'
    default: return 'bg-gradient-to-b from-indigo-400 to-violet-400'
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 pb-6">
    <!-- Sin empresa -->
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900 shadow-sm"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa arriba para ver el tablero global de tareas de todos tus proyectos.
      </p>
    </div>

    <template v-else>
      <!-- Cabecera compacta + stats -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-800">Centro de trabajo</h1>
          <p class="mt-0.5 text-sm text-slate-500">
            {{ filtersSummary }}
          </p>
        </div>

        <!-- Stats chips -->
        <div v-if="!isLoading" class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
            <span class="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
            <span class="text-sm font-bold tabular-nums text-slate-700">{{ filteredMetrics.total }}</span>
            <span class="text-xs text-slate-400">Total</span>
          </div>
          <div class="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-2">
            <span class="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
            <span class="text-sm font-bold tabular-nums text-indigo-700">{{ filteredMetrics.pending + filteredMetrics.inProgress }}</span>
            <span class="text-xs text-indigo-400">Activas</span>
          </div>
          <div
            class="flex items-center gap-2 rounded-xl border px-3.5 py-2 transition-colors"
            :class="filteredMetrics.overdue > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'"
          >
            <span class="h-2 w-2 shrink-0 rounded-full" :class="filteredMetrics.overdue > 0 ? 'bg-amber-500' : 'bg-slate-300'" />
            <span class="text-sm font-bold tabular-nums" :class="filteredMetrics.overdue > 0 ? 'text-amber-700' : 'text-slate-400'">{{ filteredMetrics.overdue }}</span>
            <span class="text-xs" :class="filteredMetrics.overdue > 0 ? 'text-amber-500' : 'text-slate-400'">Atrasadas</span>
          </div>
          <div class="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2">
            <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span class="text-sm font-bold tabular-nums text-emerald-700">{{ filteredMetrics.completed }}</span>
            <span class="text-xs text-emerald-500">Listas</span>
          </div>
        </div>
        <div v-else class="flex gap-2">
          <div v-for="i in 4" :key="i" class="h-9 w-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>

      <!-- Toast error -->
      <div
        v-if="toastError"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {{ toastError }}
      </div>

      <!-- Barra de filtros compacta (sticky) -->
      <div class="sticky top-16 z-30">
        <div class="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-2.5 shadow-md backdrop-blur-md">
          <!-- Búsqueda -->
          <div class="relative min-w-0 flex-1">
            <svg
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Buscar tarea, código o proyecto…"
              autocomplete="off"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-400/30"
            >
          </div>

          <div class="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <!-- Mis tareas -->
          <button
            type="button"
            :disabled="!canFilterMyTasks"
            :title="canFilterMyTasks ? 'Solo tareas donde eres el responsable' : 'Tu usuario no tiene partner vinculado'"
            class="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all"
            :class="[
              myTasksOnly
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50',
              !canFilterMyTasks ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
            ]"
            @click="toggleMyTasksFilter"
          >
            <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span class="hidden sm:inline">Mis tareas</span>
          </button>

          <!-- Filtros avanzados -->
          <details class="group relative shrink-0">
            <summary class="flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-indigo-200 hover:bg-slate-50">
              <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span class="hidden sm:inline">Filtros</span>
              <span
                v-if="activeFilterCount > 0"
                class="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white"
              >{{ activeFilterCount }}</span>
              <svg class="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div class="absolute right-0 top-full z-50 mt-2 max-h-[min(70vh,480px)] w-[min(100vw-2rem,28rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl ring-1 ring-slate-900/5">
              <div class="space-y-5">
                <div class="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <label
                    class="flex cursor-pointer items-center gap-2 text-sm"
                    :class="!canFilterMyTasks ? 'cursor-not-allowed opacity-50' : 'text-slate-700'"
                  >
                    <input v-model="myTasksOnly" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" :disabled="!canFilterMyTasks">
                    Solo mis tareas (responsable = mi partner)
                  </label>
                </div>

                <div>
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Proyectos</p>
                  <div class="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                    <label
                      v-for="p in projectOptions"
                      :key="p.id"
                      class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input type="checkbox" :checked="selectedProjectIds.includes(p.id)" class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" @change="toggleProject(p.id)">
                      <span class="truncate">{{ p.label }}</span>
                    </label>
                    <p v-if="projectOptions.length === 0" class="py-2 text-xs text-slate-500">No hay proyectos activos.</p>
                  </div>
                  <p class="mt-2 text-[11px] text-slate-500">Sin seleccionar = todos los proyectos.</p>
                </div>

                <div class="border-t border-slate-100 pt-4">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Etapa</p>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="flex items-center gap-2 text-sm">
                      <input type="checkbox" :checked="selectedStatuses.includes('pending')" class="h-4 w-4 rounded border-slate-300 text-sky-600" @change="toggleStatus('pending')">Inicio
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                      <input type="checkbox" :checked="selectedStatuses.includes('in_progress')" class="h-4 w-4 rounded border-slate-300 text-violet-600" @change="toggleStatus('in_progress')">En proceso
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                      <input type="checkbox" :checked="selectedStatuses.includes('completed')" class="h-4 w-4 rounded border-slate-300 text-emerald-600" @change="toggleStatus('completed')">Terminadas
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                      <input type="checkbox" :checked="selectedStatuses.includes('cancelled')" class="h-4 w-4 rounded border-slate-300 text-slate-600" @change="toggleStatus('cancelled')">Canceladas
                    </label>
                  </div>
                </div>

                <div class="border-t border-slate-100 pt-4">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridad</p>
                  <div class="flex flex-wrap gap-2">
                    <label
                      v-for="(label, key) in priorityLabel"
                      :key="key"
                      class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
                      :class="selectedPriorities.includes(key as ProjectPriority) ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-600'"
                    >
                      <input type="checkbox" class="hidden" :checked="selectedPriorities.includes(key as ProjectPriority)" @change="togglePriority(key as ProjectPriority)">
                      {{ label }}
                    </label>
                  </div>
                </div>

                <div class="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <label
                    class="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition"
                    :class="overdueOnly ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-200 text-slate-700'"
                  >
                    <input v-model="overdueOnly" type="checkbox" class="h-4 w-4 rounded text-red-600">Solo atrasadas
                  </label>
                  <label
                    class="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition"
                    :class="hideDone ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'"
                  >
                    <input v-model="hideDone" type="checkbox" class="h-4 w-4 rounded text-amber-600">Ocultar terminadas / canceladas
                  </label>
                </div>

                <button
                  type="button"
                  class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  @click="resetFilters"
                >
                  Restablecer todos los filtros
                </button>
              </div>
            </div>
          </details>
        </div>
      </div>

      <!-- Cargando -->
      <div v-if="isLoading" class="flex items-center justify-center rounded-2xl border border-slate-100 bg-white py-32 shadow-sm">
        <div class="space-y-3 text-center">
          <div class="inline-block h-9 w-9 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p class="text-sm font-medium text-slate-500">Cargando tareas de todos tus proyectos…</p>
        </div>
      </div>

      <!-- Tablero Kanban -->
      <div
        v-else
        class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <section
          v-for="status in ALL_STATUSES"
          :key="status"
          class="flex flex-col overflow-hidden rounded-2xl border shadow-sm"
          :class="statusConfig[status].headerClass"
          @dragover.prevent
          @drop="handleKanbanDrop($event, status)"
        >
          <!-- Cabecera de columna -->
          <header class="relative shrink-0 border-b border-white/60 px-4 py-3">
            <div class="absolute inset-x-0 top-0 h-1 rounded-b-full bg-gradient-to-r" :class="statusConfig[status].accent" />
            <div class="mt-1 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="statusConfig[status].dotClass" />
                <h2 class="text-sm font-bold text-slate-800">{{ statusConfig[status].title }}</h2>
              </div>
              <span class="shrink-0 rounded-full border border-slate-100 bg-white/90 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 shadow-sm">
                {{ tasksInColumn(status).length }}
              </span>
            </div>
          </header>

          <!-- Área de tarjetas -->
          <div class="min-h-[160px] flex-1 space-y-2.5 overflow-y-auto bg-white/45 p-3 max-h-[calc(100vh-18rem)]">
            <!-- Tarjeta de tarea -->
            <article
              v-for="task in tasksInColumn(status)"
              :key="task.id ?? ''"
              draggable="true"
              class="group relative cursor-grab rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-indigo-200/70 hover:shadow-md active:cursor-grabbing"
              @dragstart="handleKanbanDragStart($event, task.id!)"
            >
              <!-- Franja de prioridad -->
              <div class="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl" :class="priorityStripeClass(task.priority)" />

              <div class="pl-2.5">
                <!-- Nombre + botón abrir -->
                <div class="flex items-start gap-1.5">
                  <div class="min-w-0 flex-1">
                    <button type="button" class="w-full text-left" @click.stop="goTaskDetail(task)" @mousedown.stop>
                      <p class="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
                        {{ task.name }}
                      </p>
                    </button>
                    <div class="mt-0.5 flex items-center gap-1.5">
                      <span class="font-mono text-[10px] text-slate-400">{{ task.code }}</span>
                      <span
                        v-if="task.is_overdue && status !== 'completed' && status !== 'cancelled'"
                        class="rounded bg-red-100 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-red-700"
                      >Atrasada</span>
                    </div>
                  </div>
                  <!-- Abrir detalle (aparece en hover) -->
                  <button
                    type="button"
                    draggable="false"
                    class="shrink-0 rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-indigo-50 hover:text-indigo-600 group-hover:opacity-100"
                    title="Abrir detalle"
                    @mousedown.stop
                    @click.stop="goTaskDetail(task)"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>

                <!-- Proyecto -->
                <button
                  type="button"
                  class="mt-2 flex w-full items-center gap-1.5 truncate rounded-lg border border-slate-100/80 bg-slate-50/80 px-2 py-1.5 text-left text-[11px] text-slate-500 transition-colors hover:bg-indigo-50/70 hover:text-indigo-700"
                  @click.stop="goProject(task)"
                >
                  <svg class="h-3 w-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span class="truncate">{{ task.project_name ?? '—' }}</span>
                  <span v-if="task.project_code" class="shrink-0 text-slate-400">· {{ task.project_code }}</span>
                </button>

                <!-- Metadatos -->
                <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span
                    class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    :class="priorityBadgeClass(task.priority)"
                  >
                    {{ priorityLabel[(task.priority ?? 'medium') as ProjectPriority] }}
                  </span>
                  <span class="inline-flex items-center rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-indigo-700">
                    {{ task.progress ?? 0 }}%
                  </span>
                  <span v-if="task.due_date" class="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <svg class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {{ formatDue(task.due_date) }}
                  </span>
                </div>

                <!-- Responsable -->
                <div
                  v-if="task.responsible_display_name?.trim() || task.responsible_name?.trim()"
                  class="mt-2 flex items-center gap-1.5"
                >
                  <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-[9px] font-bold text-white">
                    {{ getInitial(task) }}
                  </span>
                  <span
                    class="truncate text-[11px] text-slate-500"
                    :title="(task.responsible_display_name ?? task.responsible_name) ?? ''"
                  >
                    {{ task.responsible_display_name?.trim() || task.responsible_name }}
                  </span>
                </div>
              </div>
            </article>

            <!-- Estado vacío -->
            <div
              v-if="tasksInColumn(status).length === 0"
              class="flex flex-col items-center justify-center px-3 py-10 text-center"
            >
              <svg class="mb-2 h-8 w-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p class="text-xs leading-relaxed text-slate-400">
                Sin tareas aquí.
              </p>
              <p class="text-[11px] text-slate-300">
                Suelta una tarjeta para moverla a «{{ statusConfig[status].title }}».
              </p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
