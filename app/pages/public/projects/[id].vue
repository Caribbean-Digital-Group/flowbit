<script setup lang="ts">
import type { GanttTask } from '~/components/Project/Gantt.vue'
import type { PublicProjectResult } from '~/composables/usePublicProject'

definePageMeta({
  layout: 'public'
})

const route = useRoute()

const projectId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const { getPublicProject } = usePublicProject()

const isLoading = ref(true)
const result = ref<PublicProjectResult | null>(null)

useHead({
  title: 'Vista pública del proyecto · Flowbit',
  meta: [
    { name: 'robots', content: 'noindex,nofollow' },
    { name: 'description', content: 'Seguimiento público de un proyecto gestionado en Flowbit.' }
  ]
})

const loadProject = async () => {
  const id = projectId.value
  if (!id) {
    result.value = { status: 'not_found' }
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    result.value = await getPublicProject(id)
  } finally {
    isLoading.value = false
  }
}

watch(projectId, () => void loadProject(), { immediate: true })

const projectStatusLabels: Record<string, string> = {
  pending: 'Por iniciar',
  in_progress: 'En proceso',
  paused: 'En pausa',
  completed: 'Finalizado',
  cancelled: 'Cancelado'
}

const projectStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  pending: 'secondary',
  in_progress: 'primary',
  paused: 'warning',
  completed: 'success',
  cancelled: 'danger'
}

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

const formatUpdatedAt = (value: string | null | undefined): string => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

const maskResponsibleName = (name: string | null | undefined): string => {
  const trimmed = name?.trim()
  if (!trimmed) return '—'
  return `@${trimmed.slice(0, 2)}`
}

const isPublicResult = computed(() => result.value?.status === 'public')

const ganttTasks = computed<GanttTask[]>(() => {
  if (result.value?.status !== 'public') return []
  return result.value.tasks.map((task) => ({
    id: task.id,
    code: task.code,
    name: task.name,
    status: task.status,
    start_date: task.start_date,
    due_date: task.due_date,
    completed_at: task.completed_at,
    progress: task.progress,
    responsible_name: maskResponsibleName(task.responsible_name),
    is_overdue: task.is_overdue
  }))
})

const completionRate = computed(() => {
  if (result.value?.status !== 'public') return 0
  const summary = result.value.summary
  const tracked = summary.total_tasks
  if (tracked === 0) return 0
  return Math.round((summary.completed_tasks / tracked) * 100)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div
      v-if="isLoading"
      class="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 px-8 py-16 flex flex-col items-center justify-center text-slate-500"
    >
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      <p class="mt-4 text-sm font-medium">
        Cargando el seguimiento del proyecto…
      </p>
    </div>

    <!-- Privado -->
    <div
      v-else-if="result?.status === 'private'"
      class="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 px-6 sm:px-10 py-12 sm:py-16 text-center"
    >
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300">
        <svg class="h-8 w-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3zm6 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6a2 2 0 012-2h8a2 2 0 012 2z" />
        </svg>
      </div>
      <h1 class="mt-6 text-2xl font-bold text-slate-900">
        Este proyecto es privado
      </h1>
      <p class="mt-3 text-sm text-slate-600 max-w-md mx-auto">
        El propietario aún no ha habilitado el acceso público a este proyecto. Si crees que deberías poder verlo, contacta a la persona que te compartió el enlace para que active la opción «vista pública» desde su panel.
      </p>
      <NuxtLink
        to="/"
        class="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-violet-700"
      >
        Ir al inicio
      </NuxtLink>
    </div>

    <!-- No encontrado / error -->
    <div
      v-else-if="result?.status === 'not_found' || result?.status === 'error'"
      class="rounded-3xl border border-amber-100 bg-amber-50 shadow-xl shadow-amber-200/30 px-6 sm:px-10 py-12 sm:py-16 text-center"
    >
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-amber-300">
        <svg class="h-8 w-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.062 19h15.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L2.33 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 class="mt-6 text-2xl font-bold text-amber-900">
        No encontramos este proyecto
      </h1>
      <p class="mt-3 text-sm text-amber-800 max-w-md mx-auto">
        El enlace puede estar incompleto, expirado o el proyecto puede haber sido archivado. Verifica que la URL coincida con la que te compartieron.
      </p>
      <NuxtLink
        to="/"
        class="mt-8 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition-all hover:bg-amber-50"
      >
        Volver al inicio
      </NuxtLink>
    </div>

    <!-- Público: vista del proyecto -->
    <template v-else-if="isPublicResult && result?.status === 'public'">
      <!-- Encabezado del proyecto -->
      <div class="rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
        <div class="relative px-6 sm:px-10 py-8 bg-gradient-to-br from-indigo-50 via-white to-violet-50">
          <div class="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-200/40 to-violet-200/40 blur-3xl pointer-events-none" />
          <div class="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                <span>{{ result.project.code || 'Proyecto' }}</span>
                <span class="text-slate-300">·</span>
                <span>{{ result.project.company_name || 'Flowbit' }}</span>
                <span
                  v-if="result.project.project_type_name"
                  class="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200"
                >
                  {{ result.project.project_type_name }}
                </span>
              </div>
              <h1 class="mt-2 text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
                {{ result.project.name }}
              </h1>
              <p
                v-if="result.project.description"
                class="mt-3 text-sm text-slate-600 leading-relaxed max-w-2xl"
              >
                {{ result.project.description }}
              </p>
              <div class="mt-4 flex flex-wrap items-center gap-2">
                <BadgeApp
                  :label="projectStatusLabels[result.project.status] || result.project.status"
                  :variant="projectStatusVariant[result.project.status] || 'secondary'"
                />
                <BadgeApp
                  v-if="result.project.is_overdue"
                  label="Fuera de plazo"
                  variant="danger"
                />
                <span class="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Actualizado {{ formatUpdatedAt(result.project.updated_at) }}
                </span>
              </div>
            </div>

            <div class="lg:w-72 shrink-0">
              <div class="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm shadow-slate-200/40">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Avance general
                </p>
                <div class="mt-2 flex items-end gap-2">
                  <span class="text-4xl font-bold text-slate-900 tabular-nums">
                    {{ result.project.progress }}%
                  </span>
                  <span class="pb-1.5 text-xs font-medium text-slate-500">del plan</span>
                </div>
                <div class="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 transition-all duration-500"
                    :style="{ width: `${Math.min(Math.max(result.project.progress ?? 0, 0), 100)}%` }"
                  />
                </div>
                <dl class="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt class="font-semibold text-slate-500">Inicio</dt>
                    <dd class="mt-0.5 text-slate-800 font-medium">{{ formatDate(result.project.start_date) }}</dd>
                  </div>
                  <div>
                    <dt class="font-semibold text-slate-500">Fin estimado</dt>
                    <dd class="mt-0.5 text-slate-800 font-medium">{{ formatDate(result.project.end_date_estimated) }}</dd>
                  </div>
                  <div v-if="result.project.end_date_actual" class="col-span-2">
                    <dt class="font-semibold text-slate-500">Fin real</dt>
                    <dd class="mt-0.5 text-emerald-700 font-medium">{{ formatDate(result.project.end_date_actual) }}</dd>
                  </div>
                  <div>
                    <dt class="font-semibold text-slate-500">Responsable</dt>
                    <dd class="mt-0.5 text-slate-800 font-medium">{{ maskResponsibleName(result.project.responsible_name) }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <!-- Resumen de tareas -->
        <div class="border-t border-slate-200 bg-slate-50/70 px-4 sm:px-8 py-2.5">
          <div class="flex items-center gap-3 overflow-x-auto">
            <span class="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Resumen
            </span>
            <div class="flex min-w-0 flex-1 items-center divide-x divide-slate-200">
              <div class="flex flex-1 items-center justify-center gap-2 px-3 sm:px-4 first:pl-0">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Total</span>
                <span class="text-sm font-bold tabular-nums text-slate-900">{{ result.summary.total_tasks }}</span>
              </div>
              <div class="flex flex-1 items-center justify-center gap-2 px-3 sm:px-4">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Por iniciar</span>
                <span class="text-sm font-bold tabular-nums text-slate-500">{{ result.summary.pending_tasks }}</span>
              </div>
              <div class="flex flex-1 items-center justify-center gap-2 px-3 sm:px-4">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">En proceso</span>
                <span class="text-sm font-bold tabular-nums text-indigo-600">{{ result.summary.in_progress_tasks }}</span>
              </div>
              <div class="flex flex-1 items-center justify-center gap-2 px-3 sm:px-4">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Terminadas</span>
                <span class="text-sm font-bold tabular-nums text-emerald-600">{{ result.summary.completed_tasks }}</span>
              </div>
              <div class="flex flex-1 items-center justify-center gap-2 px-3 sm:px-4 last:pr-0">
                <span
                  class="h-1.5 w-1.5 shrink-0 rounded-full"
                  :class="result.summary.overdue_tasks > 0 ? 'bg-rose-500' : 'bg-slate-300'"
                />
                <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Vencidas</span>
                <span
                  class="text-sm font-bold tabular-nums"
                  :class="result.summary.overdue_tasks > 0 ? 'text-rose-600' : 'text-slate-500'"
                >
                  {{ result.summary.overdue_tasks }}
                </span>
              </div>
            </div>
            <span class="hidden sm:inline shrink-0 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 tabular-nums">
              {{ completionRate }}% avance
            </span>
          </div>
        </div>
      </div>

      <!-- Diagrama de Gantt -->
      <ProjectGantt
        :tasks="ganttTasks"
        :project-start="result.project.start_date"
        :project-end="result.project.end_date_estimated"
      />

      <!-- Listado de tareas -->
      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 overflow-hidden">
        <div class="border-b border-slate-200 bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-800">
              Detalle de tareas
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Listado completo con estado, fechas, avance y responsable de cada tarea activa.
            </p>
          </div>
          <span class="text-xs font-semibold text-slate-500">
            Avance global: <span class="text-slate-800 tabular-nums">{{ completionRate }}%</span>
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50/60">
              <tr>
                <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Código</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tarea</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Responsable</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                <th class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Inicio</th>
                <th class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Vence</th>
                <th class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Avance</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              <tr
                v-for="task in result.tasks"
                :key="task.id"
                class="hover:bg-slate-50/60"
              >
                <td class="px-4 py-3 text-xs font-mono text-slate-500">{{ task.code }}</td>
                <td class="px-4 py-3">
                  <p class="text-sm font-semibold text-slate-800">{{ task.name }}</p>
                  <p v-if="task.description" class="mt-0.5 text-xs text-slate-500 line-clamp-2">
                    {{ task.description }}
                  </p>
                </td>
                <td class="px-4 py-3 text-sm text-slate-600">{{ maskResponsibleName(task.responsible_name) }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5">
                    <BadgeApp
                      :label="task.status === 'pending' ? 'Por iniciar' : task.status === 'in_progress' ? 'En proceso' : task.status === 'completed' ? 'Terminada' : 'Cancelada'"
                      :variant="task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'primary' : task.status === 'cancelled' ? 'danger' : 'secondary'"
                    />
                    <span
                      v-if="task.is_overdue"
                      class="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700"
                    >
                      Vencida
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{{ formatDate(task.start_date) }}</td>
                <td class="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{{ formatDate(task.due_date) }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="inline-flex items-center gap-2">
                    <div class="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div
                        class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        :style="{ width: `${Math.min(Math.max(task.progress ?? 0, 0), 100)}%` }"
                      />
                    </div>
                    <span class="text-xs font-semibold text-slate-700 tabular-nums">{{ task.progress }}%</span>
                  </div>
                </td>
              </tr>
              <tr v-if="result.tasks.length === 0">
                <td colspan="7" class="px-4 py-12 text-center text-sm text-slate-500">
                  Este proyecto aún no tiene tareas registradas.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
