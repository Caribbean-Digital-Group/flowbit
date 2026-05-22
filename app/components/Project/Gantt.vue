<script lang="ts">
import type { Database } from '~/types/database.types'

export type GanttTaskStatus = Database['public']['Enums']['project_task_status']

export interface GanttTask {
  id: string
  code: string | null
  name: string
  status: GanttTaskStatus
  start_date: string | null
  due_date: string | null
  completed_at?: string | null
  progress: number
  responsible_name: string | null
  is_overdue: boolean
}
</script>

<script setup lang="ts">
interface Props {
  tasks: GanttTask[]
  /** Fecha de inicio del proyecto, sirve como límite inferior del eje. */
  projectStart?: string | null
  /** Fecha de fin estimada, sirve como límite superior del eje. */
  projectEnd?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  projectStart: null,
  projectEnd: null
})

const MS_PER_DAY = 24 * 60 * 60 * 1000

const statusLabels: Record<GanttTaskStatus, string> = {
  pending: 'Por iniciar',
  in_progress: 'En proceso',
  completed: 'Terminada',
  cancelled: 'Cancelada'
}

const statusBarClass: Record<GanttTaskStatus, string> = {
  pending: 'bg-slate-300/80 ring-1 ring-inset ring-slate-300',
  in_progress: 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500',
  completed: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  cancelled: 'bg-slate-200 ring-1 ring-inset ring-slate-300'
}

const statusDotClass: Record<GanttTaskStatus, string> = {
  pending: 'bg-slate-400',
  in_progress: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-slate-400'
}

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

const startOfDay = (date: Date): Date => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const daysBetween = (from: Date, to: Date): number => {
  const diff = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.round(diff / MS_PER_DAY)
}

interface NormalizedTask extends GanttTask {
  effectiveStart: Date
  effectiveEnd: Date
}

const normalizedTasks = computed<NormalizedTask[]>(() => {
  const today = startOfDay(new Date())
  return props.tasks.map((task) => {
    const start = parseDate(task.start_date)
    const due = parseDate(task.due_date)
    const completed = parseDate(task.completed_at ?? null)

    let effectiveStart = start ?? due ?? completed ?? today
    let effectiveEnd = due ?? completed ?? start ?? today

    if (effectiveEnd.getTime() < effectiveStart.getTime()) {
      effectiveEnd = effectiveStart
    }

    return {
      ...task,
      effectiveStart: startOfDay(effectiveStart),
      effectiveEnd: startOfDay(effectiveEnd)
    }
  })
})

interface TimelineRange {
  start: Date
  end: Date
  totalDays: number
}

const timeline = computed<TimelineRange | null>(() => {
  const stamps: number[] = []

  const startBound = parseDate(props.projectStart)
  if (startBound) stamps.push(startOfDay(startBound).getTime())

  const endBound = parseDate(props.projectEnd)
  if (endBound) stamps.push(startOfDay(endBound).getTime())

  for (const task of normalizedTasks.value) {
    stamps.push(task.effectiveStart.getTime())
    stamps.push(task.effectiveEnd.getTime())
  }

  if (stamps.length === 0) return null

  const min = Math.min(...stamps)
  const max = Math.max(...stamps)
  const start = startOfDay(new Date(min))
  const end = startOfDay(new Date(max))

  // Asegura al menos 1 día de rango para evitar divisiones por cero.
  const totalDays = Math.max(1, daysBetween(start, end) + 1)

  return { start, end, totalDays }
})

interface PositionedTask extends NormalizedTask {
  offsetPercent: number
  widthPercent: number
}

const positionedTasks = computed<PositionedTask[]>(() => {
  const range = timeline.value
  if (!range) return []
  return normalizedTasks.value.map((task) => {
    const offsetDays = Math.max(0, daysBetween(range.start, task.effectiveStart))
    const spanDays = Math.max(1, daysBetween(task.effectiveStart, task.effectiveEnd) + 1)
    const offsetPercent = (offsetDays / range.totalDays) * 100
    const widthPercent = Math.min(100 - offsetPercent, (spanDays / range.totalDays) * 100)
    return {
      ...task,
      offsetPercent,
      widthPercent: Math.max(widthPercent, 1.5)
    }
  })
})

interface MonthMarker {
  label: string
  offsetPercent: number
}

const monthMarkers = computed<MonthMarker[]>(() => {
  const range = timeline.value
  if (!range) return []
  const markers: MonthMarker[] = []
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1)

  while (cursor.getTime() <= range.end.getTime()) {
    const offsetDays = daysBetween(range.start, cursor)
    if (offsetDays >= 0 && offsetDays <= range.totalDays) {
      const offsetPercent = (offsetDays / range.totalDays) * 100
      markers.push({
        label: new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' })
          .format(cursor)
          .replace('.', ''),
        offsetPercent
      })
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return markers
})

const todayPosition = computed<number | null>(() => {
  const range = timeline.value
  if (!range) return null
  const today = startOfDay(new Date())
  const offsetDays = daysBetween(range.start, today)
  if (offsetDays < 0 || offsetDays > range.totalDays) return null
  return (offsetDays / range.totalDays) * 100
})

const formatDateShort = (value: string | null | Date | undefined): string => {
  if (!value) return '—'
  const date = value instanceof Date ? value : parseDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(date)
}

const orderedTasks = computed<PositionedTask[]>(() => {
  const list = [...positionedTasks.value]
  list.sort((a, b) => {
    const aTime = a.effectiveStart.getTime()
    const bTime = b.effectiveStart.getTime()
    if (aTime !== bTime) return aTime - bTime
    return a.effectiveEnd.getTime() - b.effectiveEnd.getTime()
  })
  return list
})
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 overflow-hidden">
    <div class="border-b border-slate-200 bg-gradient-to-r from-indigo-50/80 via-violet-50/60 to-fuchsia-50/40 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-slate-800">
          Diagrama de Gantt
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">
          Tareas ordenadas cronológicamente según su fecha de inicio. La barra muestra duración y el sólido el avance reportado.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-slate-400" />
          Por iniciar
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          En proceso
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Terminada
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-rose-500" />
          Vencida
        </span>
      </div>
    </div>

    <div v-if="!timeline || orderedTasks.length === 0" class="px-6 py-16 text-center text-sm text-slate-500">
      Aún no hay tareas con fechas que puedan dibujarse en el diagrama.
    </div>

    <div v-else class="overflow-x-auto">
      <div class="min-w-[720px] px-4 py-5">
        <!-- Eje de meses -->
        <div class="grid grid-cols-[minmax(220px,_280px)_1fr] gap-4 pb-3 border-b border-slate-100">
          <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Tarea
          </div>
          <div class="relative h-6">
            <div class="absolute inset-x-0 top-1/2 h-px bg-slate-100" />
            <div
              v-for="(marker, idx) in monthMarkers"
              :key="`m-${idx}`"
              class="absolute -translate-x-1/2 -top-0.5 flex flex-col items-center"
              :style="{ left: `${marker.offsetPercent}%` }"
            >
              <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {{ marker.label }}
              </span>
              <span class="h-2 w-px bg-slate-200" />
            </div>
            <div
              v-if="todayPosition !== null"
              class="absolute inset-y-0 w-px bg-fuchsia-500/70"
              :style="{ left: `${todayPosition}%` }"
            >
              <span class="absolute -top-1.5 -translate-x-1/2 rounded-full bg-fuchsia-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                Hoy
              </span>
            </div>
          </div>
        </div>

        <!-- Filas -->
        <ul class="divide-y divide-slate-100">
          <li
            v-for="task in orderedTasks"
            :key="task.id"
            class="grid grid-cols-[minmax(220px,_280px)_1fr] gap-4 py-3"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :class="task.is_overdue && task.status !== 'completed' && task.status !== 'cancelled'
                    ? 'bg-rose-500'
                    : statusDotClass[task.status]"
                />
                <p class="text-sm font-semibold text-slate-800 truncate">
                  {{ task.name }}
                </p>
              </div>
              <p class="mt-0.5 text-[11px] font-mono text-slate-400 truncate">
                {{ task.code }}
              </p>
              <p class="mt-1 text-[11px] text-slate-500 truncate">
                {{ task.responsible_name || 'Sin responsable' }} · {{ statusLabels[task.status] }}
              </p>
              <p class="mt-0.5 text-[11px] text-slate-400">
                {{ formatDateShort(task.start_date) }} → {{ formatDateShort(task.due_date) }}
              </p>
            </div>

            <div class="relative h-9">
              <div class="absolute inset-y-3 inset-x-0 rounded-full bg-slate-50" />
              <div
                v-if="todayPosition !== null"
                class="absolute inset-y-0 w-px bg-fuchsia-500/40"
                :style="{ left: `${todayPosition}%` }"
              />
              <div
                class="absolute top-1.5 bottom-1.5 rounded-full shadow-sm overflow-hidden"
                :class="[
                  statusBarClass[task.status],
                  task.is_overdue && task.status !== 'completed' && task.status !== 'cancelled'
                    ? 'ring-2 ring-rose-400 ring-offset-1 ring-offset-white'
                    : ''
                ]"
                :style="{
                  left: `${task.offsetPercent}%`,
                  width: `${task.widthPercent}%`
                }"
                :title="`${task.name} (${task.progress}%)`"
              >
                <div
                  v-if="task.status !== 'cancelled'"
                  class="h-full bg-white/30 backdrop-saturate-150"
                  :style="{ width: `${Math.min(Math.max(100 - task.progress, 0), 100)}%`, marginLeft: 'auto' }"
                />
                <span
                  class="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white drop-shadow-sm tabular-nums"
                >
                  {{ task.progress ?? 0 }}%
                </span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
