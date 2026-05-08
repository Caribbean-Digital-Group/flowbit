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
const { selectedCompanyId } = storeToRefs(authStore)

const { getTasksByCompany, setTaskStatus, computeAggregatedMetrics } = useProjectTask()
const { getProjectsByCompany } = useProject()

const ALL_STATUSES: ProjectTaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']

const statusConfig: Record<
  ProjectTaskStatus,
  {
    title: string
    subtitle: string
    accent: string
    headerClass: string
    dotClass: string
  }
> = {
  pending: {
    title: 'Inicio',
    subtitle: 'Por arrancar',
    accent: 'from-sky-400 to-blue-600',
    headerClass: 'border-sky-100 bg-gradient-to-br from-sky-50/90 to-blue-50/40',
    dotClass: 'bg-sky-500'
  },
  in_progress: {
    title: 'En proceso',
    subtitle: 'En curso',
    accent: 'from-violet-500 to-purple-600',
    headerClass: 'border-violet-100 bg-gradient-to-br from-violet-50/90 to-purple-50/40',
    dotClass: 'bg-violet-500'
  },
  completed: {
    title: 'Terminadas',
    subtitle: 'Listo',
    accent: 'from-emerald-400 to-teal-600',
    headerClass: 'border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-teal-50/40',
    dotClass: 'bg-emerald-500'
  },
  cancelled: {
    title: 'Canceladas',
    subtitle: 'Cerradas',
    accent: 'from-slate-400 to-slate-600',
    headerClass: 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/70',
    dotClass: 'bg-slate-500'
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
        label:
          [p.code, p.name].filter(Boolean).join(' · ') || 'Proyecto',
        code: p.code ?? ''
      }))
      .filter((p) => p.id)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => void loadData(), { immediate: true })

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
}

const activeFilterCount = computed(() => {
  let n = 0
  if (searchQuery.value.trim()) n += 1
  if (selectedProjectIds.value.length > 0) n += 1
  if (selectedStatuses.value.length !== ALL_STATUSES.length) n += 1
  if (selectedPriorities.value.length > 0) n += 1
  if (overdueOnly.value) n += 1
  if (hideDone.value) n += 1
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
    return new Intl.DateTimeFormat('es-MX', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(d))
  } catch {
    return d
  }
}

const filtersSummary = computed(() => {
  const parts: string[] = []
  parts.push(`${filteredTasks.value.length} tarea(s) visibles`)
  if (hideDone.value) parts.push('sin cerradas')
  if (overdueOnly.value) parts.push('solo atrasadas')
  if (selectedProjectIds.value.length > 0) {
    parts.push(`${selectedProjectIds.value.length} proyecto(s)`)
  }
  return parts.join(' · ')
})
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)] w-full pb-10">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900 shadow-sm"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa arriba para ver el tablero global de tareas de todos tus proyectos.
      </p>
    </div>

    <template v-else>
      <!-- Hero -->
      <div
        class="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 sm:p-10 shadow-xl shadow-indigo-900/25 text-white mb-8"
      >
        <div
          class="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />
        <div
          class="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl"
        />

        <div class="relative z-10 max-w-3xl space-y-3">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">
            Visión única · Empresa seleccionada
          </p>
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Centro de trabajo
          </h1>
          <p class="text-base text-white/90 leading-relaxed max-w-xl">
            Organiza todas las tareas de tus proyectos en un solo lugar. Arrastra tarjetas entre columnas para actualizar etapas.
          </p>
        </div>

        <dl
          v-if="!isLoading"
          class="relative z-10 mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div class="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm border border-white/15">
            <dt class="text-xs font-medium text-white/70">
              Totales visibles
            </dt>
            <dd class="text-2xl font-bold tabular-nums mt-1">
              {{ filteredMetrics.total }}
            </dd>
          </div>
          <div class="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm border border-white/15">
            <dt class="text-xs font-medium text-white/70">
              Activas (inicio / proceso)
            </dt>
            <dd class="text-2xl font-bold tabular-nums mt-1">
              {{ filteredMetrics.pending + filteredMetrics.inProgress }}
            </dd>
          </div>
          <div class="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm border border-white/15">
            <dt class="text-xs font-medium text-white/70">
              Atrasadas
            </dt>
            <dd class="text-2xl font-bold tabular-nums mt-1 text-amber-200">
              {{ filteredMetrics.overdue }}
            </dd>
          </div>
          <div class="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm border border-white/15">
            <dt class="text-xs font-medium text-white/70">
              Completadas
            </dt>
            <dd class="text-2xl font-bold tabular-nums mt-1">
              {{ filteredMetrics.completed }}
            </dd>
          </div>
        </dl>

        <p
          class="relative z-10 mt-6 text-xs text-white/70 sm:text-sm"
        >
          {{ filtersSummary }}
        </p>
      </div>

      <div
        v-if="toastError"
        class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {{ toastError }}
      </div>

      <!-- Barra filtros: z-index < header (30) pero > contenido siguiente, para que el panel no lo tape el Kanban. -->
      <div
        class="relative z-28 mb-8 -mx-1 px-1 sm:-mx-2 sm:px-2 lg:mx-0 lg:px-0 sticky top-16"
      >
        <div
          class="rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-lg shadow-slate-200/50 p-5 sm:p-6 overflow-visible"
        >
          <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div class="flex-1 w-full space-y-2">
              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Buscar
              </label>
              <div class="relative">
                <svg
                  class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  v-model="searchQuery"
                  type="search"
                  placeholder="Nombre, código, proyecto o responsable…"
                  autocomplete="off"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40 focus:bg-white outline-none transition-all"
                >
              </div>
            </div>

            <details class="group relative z-50 w-full lg:w-auto lg:min-w-[220px]">
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3 font-medium text-slate-700 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <span class="flex items-center gap-2">
                  <span class="rounded-lg bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">{{ activeFilterCount }}</span>
                  Filtros avanzados
                </span>
                <svg class="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div
                class="absolute right-0 left-0 z-[60] mt-2 w-full min-w-0 sm:left-auto sm:w-[min(100vw-2rem,28rem)] max-h-[min(70vh,480px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl ring-1 ring-slate-900/5"
              >
                <div class="space-y-5">
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Proyectos
                    </p>
                    <div class="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                      <label
                        v-for="p in projectOptions"
                        :key="p.id"
                        class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          :checked="selectedProjectIds.includes(p.id)"
                          class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          @change="toggleProject(p.id)"
                        >
                        <span class="truncate">{{ p.label }}</span>
                      </label>
                      <p
                        v-if="projectOptions.length === 0"
                        class="text-xs text-slate-500 py-2"
                      >
                        No hay proyectos activos.
                      </p>
                    </div>
                    <p class="mt-2 text-[11px] text-slate-500">
                      Sin seleccionar = muestra todos los proyectos.
                    </p>
                  </div>

                  <div class="border-t border-slate-100 pt-4">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Etapa en tablero
                    </p>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          :checked="selectedStatuses.includes('pending')"
                          class="h-4 w-4 rounded border-slate-300 text-sky-600"
                          @change="toggleStatus('pending')"
                        >
                        Inicio
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          :checked="selectedStatuses.includes('in_progress')"
                          class="h-4 w-4 rounded border-slate-300 text-violet-600"
                          @change="toggleStatus('in_progress')"
                        >
                        En proceso
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          :checked="selectedStatuses.includes('completed')"
                          class="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          @change="toggleStatus('completed')"
                        >
                        Terminadas
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          :checked="selectedStatuses.includes('cancelled')"
                          class="h-4 w-4 rounded border-slate-300 text-slate-600"
                          @change="toggleStatus('cancelled')"
                        >
                        Canceladas
                      </label>
                    </div>
                  </div>

                  <div class="border-t border-slate-100 pt-4">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Prioridad
                    </p>
                    <div class="flex flex-wrap gap-2">
                      <label
                        v-for="(label, key) in priorityLabel"
                        :key="key"
                        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition"
                        :class="selectedPriorities.includes(key as ProjectPriority) ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-600'"
                      >
                        <input
                          type="checkbox"
                          class="hidden"
                          :checked="selectedPriorities.includes(key as ProjectPriority)"
                          @change="togglePriority(key as ProjectPriority)"
                        >
                        {{ label }}
                      </label>
                    </div>
                  </div>

                  <div class="border-t border-slate-100 pt-4 flex flex-wrap gap-3">
                    <label class="inline-flex items-center gap-2 text-sm cursor-pointer rounded-xl border px-4 py-2 transition"
                           :class="overdueOnly ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-200 text-slate-700'">
                      <input v-model="overdueOnly" type="checkbox" class="h-4 w-4 rounded text-red-600">
                      Solo atrasadas
                    </label>
                    <label class="inline-flex items-center gap-2 text-sm cursor-pointer rounded-xl border px-4 py-2 transition"
                           :class="hideDone ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'">
                      <input v-model="hideDone" type="checkbox" class="h-4 w-4 rounded text-amber-600">
                      Ocultar terminadas / canceladas
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
      </div>

      <!-- Kanban -->
      <div v-if="isLoading" class="flex justify-center py-24 rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/40">
        <div class="text-center space-y-3">
          <div class="inline-block h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p class="text-slate-500 text-sm font-medium">
            Cargando tareas de todos tus proyectos…
          </p>
        </div>
      </div>

      <div
        v-else
        class="relative z-0 grid gap-5 xl:grid-cols-4 lg:grid-cols-2"
      >
        <section
          v-for="status in ALL_STATUSES"
          :key="status"
          class="flex min-h-[420px] flex-col rounded-2xl border shadow-lg shadow-slate-200/40 overflow-hidden"
          :class="statusConfig[status].headerClass"
          @dragover.prevent
          @drop="handleKanbanDrop($event, status)"
        >
          <!-- Cabecera de columna -->
          <header class="relative border-b border-white/60 px-4 py-4 sm:px-5">
            <div class="absolute inset-x-0 top-0 h-1 rounded-b-full opacity-95 bg-gradient-to-r" :class="statusConfig[status].accent" />
            <div class="flex items-center justify-between gap-2 mt-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="statusConfig[status].dotClass" />
                <div class="min-w-0">
                  <h2 class="text-sm font-bold text-slate-800 truncate">
                    {{ statusConfig[status].title }}
                  </h2>
                  <p class="text-xs text-slate-500">
                    {{ statusConfig[status].subtitle }}
                  </p>
                </div>
              </div>
              <span
                class="shrink-0 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm border border-slate-100"
              >
                {{ tasksInColumn(status).length }}
              </span>
            </div>
          </header>

          <div class="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4 bg-white/45 min-h-[200px] max-h-[calc(100vh-22rem)]">
            <article
              v-for="task in tasksInColumn(status)"
              :key="task.id ?? ''"
              draggable="true"
              class="group relative rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm hover:shadow-md hover:border-indigo-200/80 transition-all cursor-grab active:cursor-grabbing"
              @dragstart="handleKanbanDragStart($event, task.id!)"
            >
              <!-- Prioridad stripe -->
              <div
                class="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl opacity-95"
                :class="task.priority === 'urgent'
                  ? 'bg-gradient-to-b from-red-500 to-orange-400'
                  : task.priority === 'high'
                    ? 'bg-gradient-to-b from-orange-400 to-amber-400'
                    : task.priority === 'low'
                      ? 'bg-slate-300'
                      : 'bg-gradient-to-b from-indigo-400 to-violet-400'"
              />

              <div class="pl-2">
                <div class="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    class="text-left flex-1 min-w-0"
                    @click="goProject(task)"
                  >
                    <p class="text-sm font-semibold text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors">
                      {{ task.name }}
                    </p>
                    <p class="mt-1 text-[11px] font-mono text-slate-500">
                      {{ task.code }}
                    </p>
                  </button>
                  <div class="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      v-if="task.is_overdue && status !== 'completed' && status !== 'cancelled'"
                      class="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700"
                    >
                      Atrasada
                    </span>
                    <button
                      type="button"
                      draggable="false"
                      class="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                      title="Abrir vista detalle"
                      aria-label="Abrir detalle de la tarea"
                      @mousedown.stop
                      @click.stop="goTaskDetail(task)"
                    >
                      Abrir tarea
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  class="mt-2 block w-full text-left rounded-lg bg-slate-50/90 px-2 py-2 text-[11px] text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-800 transition-colors border border-slate-100/80"
                  @click="goProject(task)"
                >
                  <span class="font-medium text-slate-700">Proyecto:</span>
                  {{ task.project_name ?? '—' }}
                  <span v-if="task.project_code" class="text-slate-400"> · {{ task.project_code }}</span>
                </button>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600"
                  >
                    {{ priorityLabel[(task.priority ?? 'medium') as ProjectPriority] }}
                  </span>
                  <span
                    class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums bg-indigo-50 text-indigo-700 border border-indigo-100"
                  >
                    {{ task.progress ?? 0 }}%
                  </span>
                  <span v-if="task.due_date" class="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {{ formatDue(task.due_date) }}
                  </span>
                </div>

                <p
                  v-if="task.responsible_display_name?.trim() || task.responsible_name?.trim()"
                  class="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 truncate"
                  :title="(task.responsible_display_name ?? task.responsible_name) ?? ''"
                >
                  <svg class="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ task.responsible_display_name?.trim() || task.responsible_name }}
                </p>
              </div>
            </article>

            <p
              v-if="tasksInColumn(status).length === 0"
              class="text-center text-xs text-slate-400 py-8 px-2 leading-relaxed"
            >
              No hay tareas en esta columna con los filtros actuales.<br>Suelta aquí tarjetas de otras columnas para cambiarlas a «{{ statusConfig[status].title }}».
            </p>
          </div>
        </section>
      </div>

      <div class="hidden lg:block mt-6">
        <p class="text-xs text-slate-400 max-w-xl">
          Consejos: combiná «Ocultar terminadas» con «Solo atrasadas» para ver foco ejecutivo por incumplimiento. Los números del encabezado reflejan el conjunto que ves tras los filtros.
        </p>
      </div>
    </template>
  </div>
</template>
