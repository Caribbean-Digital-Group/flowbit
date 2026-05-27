<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { StatItem } from '~/components/StatGrid.vue'
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

const stats = computed<StatItem[]>(() => {
  const m = aggregatedMetrics.value
  return [
    {
      label: 'Proyectos totales',
      value: String(m.total),
      change: `${m.inProgress} activos`,
      trend: 'neutral'
    },
    {
      label: 'Avance promedio',
      value: `${m.averageProgress}%`,
      change: `${m.completed} finalizados`,
      trend: m.averageProgress >= 50 ? 'up' : 'neutral'
    },
    {
      label: 'En riesgo',
      value: String(m.overdue),
      change: m.overdue === 0 ? 'Sin retrasos' : 'Atrasados',
      trend: m.overdue === 0 ? 'up' : 'down'
    },
    {
      label: 'Presupuesto',
      value: formatCurrency(m.totalBudgetEstimated),
      change: `Real: ${formatCurrency(m.totalBudgetActual)}`,
      trend: m.totalBudgetActual <= m.totalBudgetEstimated ? 'up' : 'down'
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
      <!-- KPIs -->
      <StatGrid :stats="stats" :loading="isLoading" :columns="4" />

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
