<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type ProjectListRow = Database['public']['Views']['v_projects']['Row']
type ProjectStatus = Database['public']['Enums']['project_status']
type ProjectPriority = Database['public']['Enums']['project_priority']

const statusLabels: Record<ProjectStatus, string> = {
  pending: 'Por iniciar',
  in_progress: 'En proceso',
  paused: 'En pausa',
  completed: 'Finalizado',
  cancelled: 'Cancelado'
}

const priorityLabels: Record<ProjectPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente'
}

const columns: Column[] = [
  {
    key: 'name',
    label: 'Proyecto',
    type: 'avatar',
    subtitleKey: 'code'
  },
  {
    key: 'responsible_display',
    label: 'Responsable',
    type: 'text'
  },
  {
    key: 'status',
    label: 'Estatus',
    type: 'badge',
    badgeConfig: {
      labels: statusLabels
    }
  },
  {
    key: 'priority',
    label: 'Prioridad',
    type: 'badge',
    badgeConfig: {
      labels: priorityLabels
    }
  },
  { key: 'progress_label', label: 'Avance', type: 'text' },
  { key: 'end_date_estimated', label: 'Fin estimado', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getProjectsByCompany, archiveProject, computeAggregatedMetrics } = useProject()

const isLoading = ref(false)
const projectsRaw = ref<ProjectListRow[]>([])
const selectedStatusFilters = ref<ProjectStatus[]>([
  'pending',
  'in_progress',
  'paused',
  'completed'
])
const selectedPriorityFilters = ref<ProjectPriority[]>([])
const showOnlyOverdue = ref(false)

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value || 0)

const mapToTableRow = (raw: ProjectListRow): Record<string, unknown> => {
  const responsible = raw.responsible_display_name?.trim() || raw.responsible_name?.trim() || '—'
  const isPublic = Boolean((raw as ProjectListRow & { is_public?: boolean | null }).is_public)
  return {
    id: raw.id,
    name: raw.name ?? '—',
    code: raw.code ?? '—',
    project_type_name: raw.project_type_name ?? '—',
    responsible_display: responsible,
    status: raw.status ?? 'pending',
    priority: raw.priority ?? 'medium',
    progress: raw.progress ?? 0,
    progress_label: `${raw.progress ?? 0}%`,
    end_date_estimated: raw.end_date_estimated ?? '',
    is_overdue: raw.is_overdue ?? false,
    overdue_task_count: raw.overdue_task_count ?? 0,
    days_remaining: raw.days_remaining ?? null,
    is_public: isPublic
  }
}

const openPublicView = (row: Record<string, unknown>) => {
  const id = row.id as string | undefined
  if (!id) return
  if (typeof window === 'undefined') return
  window.open(`${window.location.origin}/public/projects/${id}`, '_blank', 'noopener,noreferrer')
}

const filteredProjects = computed(() => {
  return projectsRaw.value.filter((p) => {
    if (selectedStatusFilters.value.length > 0
      && !selectedStatusFilters.value.includes((p.status ?? 'pending') as ProjectStatus)) {
      return false
    }
    if (selectedPriorityFilters.value.length > 0
      && !selectedPriorityFilters.value.includes((p.priority ?? 'medium') as ProjectPriority)) {
      return false
    }
    if (showOnlyOverdue.value && !p.is_overdue) return false
    return true
  })
})

const filteredRows = computed(() => filteredProjects.value.map(mapToTableRow))

const aggregatedMetrics = computed(() =>
  computeAggregatedMetrics(projectsRaw.value)
)

// ── Stat cards ─────────────────────────────────────────────────────────────────

type StatAccent = 'indigo' | 'sky' | 'rose' | 'emerald' | 'amber'

interface ProjectStat {
  key: string
  label: string
  value: string
  sublabel: string
  iconPath: string
  accent: StatAccent
  valueClass: string
  progress?: number
}

const accentStyles: Record<StatAccent, { icon: string; blob: string }> = {
  indigo: { icon: 'bg-indigo-50 text-indigo-600', blob: 'bg-indigo-400' },
  sky: { icon: 'bg-sky-50 text-sky-600', blob: 'bg-sky-400' },
  rose: { icon: 'bg-rose-50 text-rose-600', blob: 'bg-rose-400' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', blob: 'bg-emerald-400' },
  amber: { icon: 'bg-amber-50 text-amber-600', blob: 'bg-amber-400' }
}

const ICONS = {
  briefcase: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z',
  chart: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  alert: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  banknotes: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z'
} as const

const projectStats = computed<ProjectStat[]>(() => {
  const m = aggregatedMetrics.value
  const utilization = m.totalBudgetEstimated > 0
    ? Math.round((m.totalBudgetActual / m.totalBudgetEstimated) * 100)
    : 0

  return [
    {
      key: 'active',
      label: 'Proyectos activos',
      value: String(m.inProgress),
      sublabel: `${m.pending} por iniciar · ${m.total} en total`,
      iconPath: ICONS.briefcase,
      accent: 'indigo',
      valueClass: 'text-slate-900'
    },
    {
      key: 'progress',
      label: 'Avance promedio',
      value: `${m.averageProgress}%`,
      sublabel: `${m.completed} finalizados · ${m.paused} en pausa`,
      iconPath: ICONS.chart,
      accent: 'sky',
      valueClass: 'text-slate-900',
      progress: m.averageProgress
    },
    {
      key: 'risk',
      label: 'En riesgo',
      value: String(m.overdue),
      sublabel: m.overdue > 0 ? 'Atrasados, requieren atención' : 'Todo en tiempo',
      iconPath: ICONS.alert,
      accent: m.overdue > 0 ? 'rose' : 'emerald',
      valueClass: m.overdue > 0 ? 'text-rose-600' : 'text-slate-900'
    },
    {
      key: 'budget',
      label: 'Presupuesto estimado',
      value: formatCurrency(m.totalBudgetEstimated),
      sublabel: m.totalBudgetEstimated > 0
        ? `Ejecutado: ${formatCurrency(m.totalBudgetActual)} (${utilization}%)`
        : `Ejecutado: ${formatCurrency(m.totalBudgetActual)}`,
      iconPath: ICONS.banknotes,
      accent: 'amber',
      valueClass: 'text-slate-900'
    }
  ]
})

const loadProjects = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    projectsRaw.value = []
    return
  }

  isLoading.value = true
  try {
    projectsRaw.value = await getProjectsByCompany(companyId)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => {
  void loadProjects()
}, { immediate: true })

const toggleStatusFilter = (value: ProjectStatus) => {
  selectedStatusFilters.value = selectedStatusFilters.value.includes(value)
    ? selectedStatusFilters.value.filter(v => v !== value)
    : [...selectedStatusFilters.value, value]
}

const togglePriorityFilter = (value: ProjectPriority) => {
  selectedPriorityFilters.value = selectedPriorityFilters.value.includes(value)
    ? selectedPriorityFilters.value.filter(v => v !== value)
    : [...selectedPriorityFilters.value, value]
}

const resetFilters = () => {
  selectedStatusFilters.value = ['pending', 'in_progress', 'paused', 'completed']
  selectedPriorityFilters.value = []
  showOnlyOverdue.value = false
}

const create = () => {
  navigateTo('/admin/projects/create')
}

const edit = (row: Record<string, unknown>) => {
  navigateTo(`/admin/projects/${row.id as string}`)
}

const remove = async (row: Record<string, unknown>) => {
  const ok = await archiveProject(row.id as string)
  if (ok) await loadProjects()
}

const deleteMany = async (selected: Record<string, unknown>[]) => {
  for (const row of selected) {
    await archiveProject(row.id as string)
  }
  await loadProjects()
}

const filtersLabel = computed(() => {
  const status = selectedStatusFilters.value.length
  const priority = selectedPriorityFilters.value.length
  return `${status} estado(s) · ${priority} prioridad(es)${showOnlyOverdue.value ? ' · solo atrasados' : ''}`
})
</script>

<template>
  <div class="w-full py-4 space-y-6">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para gestionar sus proyectos.
      </p>
    </div>

    <template v-else>
      <!-- Stat cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="isLoading">
          <div
            v-for="i in 4"
            :key="`project-stat-skeleton-${i}`"
            class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 space-y-3">
                <div class="h-3 w-24 rounded bg-slate-200" />
                <div class="h-7 w-32 rounded bg-slate-200" />
              </div>
              <div class="h-11 w-11 rounded-xl bg-slate-200" />
            </div>
            <div class="mt-4 h-3 w-28 rounded bg-slate-200" />
          </div>
        </template>

        <template v-else>
          <div
            v-for="stat in projectStats"
            :key="stat.key"
            class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"
          >
            <div
              :class="[
                'pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]',
                accentStyles[stat.accent].blob
              ]"
            />

            <div class="relative flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-500">{{ stat.label }}</p>
                <p :class="['mt-2 truncate text-2xl font-bold tracking-tight', stat.valueClass]">
                  {{ stat.value }}
                </p>
              </div>
              <span
                :class="[
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  accentStyles[stat.accent].icon
                ]"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="stat.iconPath" />
                </svg>
              </span>
            </div>

            <div
              v-if="typeof stat.progress === 'number'"
              class="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
            >
              <div
                class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 transition-all"
                :style="{ width: `${Math.min(Math.max(stat.progress, 0), 100)}%` }"
              />
            </div>

            <p class="relative mt-3 truncate text-xs text-slate-500">{{ stat.sublabel }}</p>
          </div>
        </template>
      </div>

      <div
        v-if="isLoading"
        class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
      >
        Cargando proyectos…
      </div>

      <Datatable
        v-else
        title="Proyectos"
        description="Gestión y seguimiento de proyectos de la empresa seleccionada"
        :data="filteredRows"
        :columns="columns"
        :search-keys="['name', 'code', 'responsible_display']"
        :selectable="true"
        :exportable="true"
        :creatable="true"
        create-label="Nuevo proyecto"
        export-filename="proyectos"
        empty-title="Sin proyectos"
        empty-message="Aún no hay proyectos para esta empresa. Crea el primero para comenzar el seguimiento."
        @create="create"
      >
        <template #headerActions>
          <div class="flex w-full items-center justify-center sm:w-auto sm:justify-end">
            <details class="relative w-full sm:w-auto">
              <summary
                class="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-56"
              >
                <span>Filtros: {{ filtersLabel }}</span>
                <svg class="ml-2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div class="absolute right-0 z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:w-72">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estatus
                  </p>
                  <div class="mt-2 space-y-2">
                    <label
                      v-for="(label, key) in statusLabels"
                      :key="key"
                      class="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedStatusFilters.includes(key as ProjectStatus)"
                        class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        @change="toggleStatusFilter(key as ProjectStatus)"
                      >
                      {{ label }}
                    </label>
                  </div>
                </div>

                <div class="mt-4 border-t border-slate-100 pt-4">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Prioridad
                  </p>
                  <div class="mt-2 space-y-2">
                    <label
                      v-for="(label, key) in priorityLabels"
                      :key="key"
                      class="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedPriorityFilters.includes(key as ProjectPriority)"
                        class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        @change="togglePriorityFilter(key as ProjectPriority)"
                      >
                      {{ label }}
                    </label>
                  </div>
                </div>

                <div class="mt-4 border-t border-slate-100 pt-4">
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      v-model="showOnlyOverdue"
                      type="checkbox"
                      class="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    >
                    Solo proyectos atrasados
                  </label>
                </div>

                <button
                  type="button"
                  class="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  @click="resetFilters"
                >
                  Restablecer filtros
                </button>
              </div>
            </details>
          </div>
        </template>

        <template #actions="{ row }">
          <div class="flex items-center justify-center gap-2">
            <BtnApp
              v-if="row.is_public"
              variant="ghost"
              size="sm"
              title="Abrir vista pública en una nueva pestaña"
              @click="openPublicView(row)"
            >
              <template #iconLeft>
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </template>
            </BtnApp>
            <BtnApp variant="ghost" size="sm" @click="edit(row)">
              <template #iconLeft>
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </template>
            </BtnApp>
            <BtnApp variant="ghost" size="sm" @click="remove(row)">
              <template #iconLeft>
                <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </template>
            </BtnApp>
          </div>
        </template>

        <template #bulkActions="{ selected }">
          <BtnDelete @click="deleteMany(selected)" />
        </template>
      </Datatable>
    </template>
  </div>
</template>
