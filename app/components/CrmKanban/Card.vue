<script lang="ts">
import type { CrmLeadView } from '~/types/crm.types'

export type CrmKanbanCardAction =
  | 'open'
  | 'won'
  | 'lost'
  | 'reopen'
  | 'schedule'
  | 'archive'

export interface CrmKanbanStageOption {
  id: string
  name: string
  color: string | null
}

export type CrmKanbanLead = CrmLeadView & { id: string; stage_id: string }
</script>

<script setup lang="ts">
import type { CrmActivityType, CrmLeadPriority } from '~/types/crm.types'

interface Props {
  lead: CrmKanbanLead
  stages?: CrmKanbanStageOption[]
  compact?: boolean
  isDragging?: boolean
  isSaving?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  stages: () => [],
  compact: false,
  isDragging: false,
  isSaving: false
})

const emit = defineEmits<{
  'drag-start': [event: DragEvent, lead: CrmKanbanLead]
  'drag-end': []
  'action': [action: CrmKanbanCardAction, lead: CrmKanbanLead]
  'move': [lead: CrmKanbanLead, stageId: string]
}>()

const isMenuOpen = ref(false)
const isMoveOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const isClosed = computed(() => Boolean(props.lead.is_won || props.lead.is_lost))
const priority = computed(() => CRM_PRIORITY_META[(props.lead.priority ?? 'medium') as CrmLeadPriority])
const amount = computed(() => Number(props.lead.amount ?? 0))
const probability = computed(() => Number(props.lead.probability ?? 0))

const contactLabel = computed(() =>
  props.lead.partner_display_name?.trim()
  || props.lead.contact_company?.trim()
  || props.lead.contact_name?.trim()
  || ''
)

const responsible = computed(() => props.lead.responsible_display_name?.trim() || '')

const tags = computed(() => (props.lead.tags ?? []).filter(Boolean))

// Próxima actividad
const nextActivity = computed(() => {
  if (!props.lead.next_activity_at || isClosed.value) return null
  const diff = daysFromToday(props.lead.next_activity_at)
  const isOverdue = new Date(props.lead.next_activity_at).getTime() < Date.now()
  return {
    label: formatRelativeDay(props.lead.next_activity_at),
    title: props.lead.next_activity_title ?? 'Actividad',
    icon: CRM_ACTIVITY_ICONS[(props.lead.next_activity_type ?? 'task') as CrmActivityType],
    tone: isOverdue
      ? 'bg-red-50 text-red-700 ring-red-200'
      : diff === 0
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-slate-50 text-slate-600 ring-slate-200'
  }
})

const needsFollowUp = computed(() =>
  !isClosed.value && !props.lead.next_activity_at && Number(props.lead.open_activity_count ?? 0) === 0
)

// Cierre esperado
const closeDate = computed(() => {
  if (!props.lead.expected_close_date || isClosed.value) return null
  const diff = daysFromToday(props.lead.expected_close_date)
  return {
    label: formatRelativeDay(props.lead.expected_close_date),
    tone: diff < 0 ? 'text-red-600 font-semibold' : diff <= 7 ? 'text-amber-600' : 'text-slate-500'
  }
})

const isRotting = computed(() => Boolean(props.lead.is_rotting))
const daysInStage = computed(() => Number(props.lead.days_in_stage ?? 0))

const otherStages = computed(() => props.stages.filter(s => s.id !== props.lead.stage_id))

const ariaLabel = computed(() => {
  const parts = [`Lead ${props.lead.lead_number ?? ''}: ${props.lead.name ?? ''}`]
  if (amount.value) parts.push(formatCrmCurrency(amount.value, props.lead.currency ?? 'MXN'))
  if (contactLabel.value) parts.push(contactLabel.value)
  if (isRotting.value) parts.push(`estancado ${daysInStage.value} días`)
  return parts.join(', ')
})

const closeMenu = () => {
  isMenuOpen.value = false
  isMoveOpen.value = false
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
  isMoveOpen.value = false
}

const runAction = (action: CrmKanbanCardAction) => {
  closeMenu()
  emit('action', action, props.lead)
}

const moveTo = (stageId: string) => {
  closeMenu()
  emit('move', props.lead, stageId)
}

const handleOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) closeMenu()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMenu()
}

watch(isMenuOpen, (open) => {
  if (open) {
    document.addEventListener('click', handleOutside)
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('click', handleOutside)
    document.removeEventListener('keydown', handleKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutside)
  document.removeEventListener('keydown', handleKeydown)
})

const onDragStart = (event: DragEvent) => {
  closeMenu()
  emit('drag-start', event, props.lead)
}
</script>

<template>
  <article
    :data-lead-id="lead.id"
    draggable="true"
    tabindex="0"
    role="button"
    :aria-label="ariaLabel"
    :class="[
      'group relative cursor-grab select-none rounded-xl border bg-white shadow-sm outline-none transition-all duration-200 active:cursor-grabbing',
      'hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/80 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
      isDragging ? 'rotate-1 scale-[0.98] opacity-40' : '',
      isRotting ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200',
      isClosed ? 'bg-white/70' : '',
      isMenuOpen ? 'z-20' : 'z-0',
      compact ? 'p-2.5' : 'p-3.5'
    ]"
    @dragstart="onDragStart"
    @dragend="emit('drag-end')"
    @click="emit('action', 'open', lead)"
    @keydown.enter.self.prevent="emit('action', 'open', lead)"
  >
    <!-- Franja de prioridad -->
    <span :class="['absolute inset-y-3 left-0 w-1 rounded-r-full', priority.accent]" aria-hidden="true" />

    <!-- Encabezado -->
    <div class="flex items-start justify-between gap-2 pl-1.5">
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        <span class="text-[11px] font-semibold tabular-nums text-slate-400">#{{ lead.lead_number ?? '—' }}</span>
        <span
          v-if="lead.is_won"
          class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
          Ganado
        </span>
        <span
          v-else-if="lead.is_lost"
          class="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
          :title="lead.lost_reason_name ?? 'Perdido'"
        >
          {{ lead.lost_reason_name ?? 'Perdido' }}
        </span>
        <span
          v-else-if="isRotting"
          class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
          :title="`Sin avanzar desde hace ${daysInStage} días`"
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {{ daysInStage }} d sin avanzar
        </span>
        <template v-if="!compact">
          <span
            v-for="tag in tags.slice(0, 2)"
            :key="tag"
            class="max-w-[6rem] truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
          >
            {{ tag }}
          </span>
          <span v-if="tags.length > 2" class="text-[10px] text-slate-400">+{{ tags.length - 2 }}</span>
        </template>
      </div>

      <!-- Menú de acciones -->
      <div ref="menuRef" class="relative -mr-1 -mt-1 shrink-0" @click.stop @keydown.enter.stop>
        <button
          type="button"
          :aria-expanded="isMenuOpen"
          aria-haspopup="menu"
          :aria-label="`Acciones para ${lead.name ?? 'el lead'}`"
          :class="[
            'rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100',
            isMenuOpen ? 'bg-slate-100 text-slate-700 opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
          ]"
          @click="toggleMenu"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </button>

        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="scale-95 opacity-0"
          enter-to-class="scale-100 opacity-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="scale-100 opacity-100"
          leave-to-class="scale-95 opacity-0"
        >
          <div
            v-if="isMenuOpen"
            role="menu"
            class="absolute right-0 top-8 z-30 w-56 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl shadow-slate-300/40"
          >
            <template v-if="!isMoveOpen">
              <button type="button" role="menuitem" class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50" @click="runAction('open')">
                <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                Abrir detalle
              </button>
              <button
                v-if="otherStages.length > 0"
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                @click="isMoveOpen = true"
              >
                <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Mover a etapa…
                <svg class="ml-auto h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button v-if="!isClosed" type="button" role="menuitem" class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50" @click="runAction('schedule')">
                <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Programar actividad
              </button>
              <div class="my-1 border-t border-slate-100" />
              <template v-if="!isClosed">
                <button type="button" role="menuitem" class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-emerald-700 hover:bg-emerald-50" @click="runAction('won')">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Marcar como ganado
                </button>
                <button type="button" role="menuitem" class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-rose-700 hover:bg-rose-50" @click="runAction('lost')">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Marcar como perdido
                </button>
              </template>
              <button v-else type="button" role="menuitem" class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50" @click="runAction('reopen')">
                <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Reabrir lead
              </button>
              <button type="button" role="menuitem" class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-500 hover:bg-slate-50 hover:text-red-600" @click="runAction('archive')">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                Archivar
              </button>
            </template>

            <template v-else>
              <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50" @click="isMoveOpen = false">
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                Mover a
              </button>
              <div class="max-h-64 overflow-y-auto">
                <button
                  v-for="stage in otherStages"
                  :key="stage.id"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                  @click="moveTo(stage.id)"
                >
                  <span :class="['h-2.5 w-2.5 shrink-0 rounded-full', getStagePalette(stage.color).dot]" />
                  <span class="truncate">{{ stage.name }}</span>
                </button>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Título y contacto -->
    <h3
      :class="[
        'mt-1.5 pl-1.5 font-semibold leading-snug text-slate-800',
        compact ? 'line-clamp-1 text-sm' : 'line-clamp-2 text-[15px]',
        lead.is_lost ? 'text-slate-500 line-through decoration-slate-300' : ''
      ]"
    >
      {{ lead.name }}
    </h3>
    <p v-if="contactLabel" class="mt-0.5 flex items-center gap-1 truncate pl-1.5 text-xs text-slate-500">
      <svg class="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      <span class="truncate">{{ contactLabel }}</span>
    </p>

    <!-- Valor, probabilidad y responsable -->
    <div class="mt-2.5 flex items-center justify-between gap-2 pl-1.5">
      <div class="min-w-0">
        <p :class="['font-bold tabular-nums tracking-tight', amount > 0 ? 'text-slate-900' : 'text-slate-400', compact ? 'text-sm' : 'text-base']">
          {{ amount > 0 ? formatCrmCurrency(amount, lead.currency ?? 'MXN') : 'Sin importe' }}
        </p>
        <div v-if="!compact && !isClosed" class="mt-1 flex items-center gap-1.5" :title="`Probabilidad de cierre: ${probability}%`">
          <span class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <span
              :class="['block h-full rounded-full', probability >= 70 ? 'bg-emerald-500' : probability >= 40 ? 'bg-indigo-500' : 'bg-slate-400']"
              :style="{ width: `${probability}%` }"
            />
          </span>
          <span class="text-[11px] font-medium tabular-nums text-slate-500">{{ probability }}%</span>
        </div>
      </div>

      <span
        v-if="responsible"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-[10px] font-bold text-white ring-2 ring-white"
        :title="`Responsable: ${responsible}`"
      >
        {{ getInitials(responsible) }}
      </span>
      <span
        v-else
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-300"
        title="Sin responsable asignado"
      >
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
      </span>
    </div>

    <!-- Próxima actividad -->
    <div v-if="!compact && (nextActivity || needsFollowUp)" class="mt-2.5 pl-1.5">
      <p
        v-if="nextActivity"
        :class="['flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset', nextActivity.tone]"
        :title="nextActivity.title"
      >
        <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="nextActivity.icon" /></svg>
        <span class="shrink-0 font-semibold">{{ nextActivity.label }}</span>
        <span class="truncate opacity-80">· {{ nextActivity.title }}</span>
      </p>
      <button
        v-else
        type="button"
        class="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
        @click.stop="runAction('schedule')"
      >
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Sin seguimiento programado
      </button>
    </div>

    <!-- Pie -->
    <div
      v-if="!compact && (closeDate || Number(lead.order_count ?? 0) > 0 || Number(lead.overdue_activity_count ?? 0) > 0)"
      class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pl-1.5 pt-2 text-[11px]"
    >
      <span v-if="closeDate" :class="['flex items-center gap-1', closeDate.tone]" title="Cierre esperado">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
        {{ closeDate.label }}
      </span>
      <span v-if="Number(lead.overdue_activity_count ?? 0) > 0" class="flex items-center gap-1 font-semibold text-red-600">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        {{ lead.overdue_activity_count }} vencida(s)
      </span>
      <span v-if="Number(lead.order_count ?? 0) > 0" class="flex items-center gap-1 text-indigo-600">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
        {{ lead.order_count }} orden(es)
      </span>
    </div>

    <!-- Guardando -->
    <div v-if="isSaving" class="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
      <svg class="h-5 w-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  </article>
</template>
