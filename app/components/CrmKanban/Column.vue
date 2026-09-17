<script setup lang="ts">
import type { CrmLeadStageRow } from '~/types/crm.types'
import type { CrmKanbanCardAction, CrmKanbanLead, CrmKanbanStageOption } from '~/components/CrmKanban/Card.vue'

interface Props {
  stage: CrmLeadStageRow
  leads: CrmKanbanLead[]
  stageOptions?: CrmKanbanStageOption[]
  /** Valor total del pipeline visible, para la barra de participación */
  pipelineTotal?: number
  folded?: boolean
  compact?: boolean
  draggingLeadId?: string | null
  /** Índice donde se muestra el marcador de inserción (null = columna no activa) */
  dropIndex?: number | null
  savingLeadIds?: string[]
  isCreating?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  stageOptions: () => [],
  pipelineTotal: 0,
  folded: false,
  compact: false,
  draggingLeadId: null,
  dropIndex: null,
  savingLeadIds: () => [],
  isCreating: false
})

const emit = defineEmits<{
  'toggle-fold': [stageId: string]
  'drag-start': [event: DragEvent, lead: CrmKanbanLead]
  'drag-end': []
  'drag-over': [stageId: string, index: number]
  'drag-leave': [stageId: string]
  'drop': [stageId: string, index: number]
  'card-action': [action: CrmKanbanCardAction, lead: CrmKanbanLead]
  'card-move': [lead: CrmKanbanLead, stageId: string]
  'quick-create': [stageId: string, name: string]
}>()

const listRef = ref<HTMLElement | null>(null)
const isQuickAddOpen = ref(false)
const quickName = ref('')
const quickInputRef = ref<HTMLInputElement | null>(null)

const palette = computed(() => getStagePalette(props.stage.color))
const isClosing = computed(() => props.stage.is_won || props.stage.is_lost)

const totals = computed(() => {
  let amount = 0
  let weighted = 0
  let rotting = 0
  for (const lead of props.leads) {
    const value = Number(lead.amount ?? 0)
    amount += value
    weighted += value * (Number(lead.probability ?? 0) / 100)
    if (lead.is_rotting) rotting += 1
  }
  return { amount, weighted, rotting }
})

const share = computed(() =>
  props.pipelineTotal > 0 ? Math.round((totals.value.amount / props.pipelineTotal) * 100) : 0
)

const isDropTarget = computed(() => props.dropIndex !== null && props.draggingLeadId !== null)

/** Posición de inserción según la altura del cursor sobre las tarjetas visibles. */
const computeIndex = (clientY: number): number => {
  const container = listRef.value
  if (!container) return props.leads.length
  const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-lead-id]'))
    .filter(el => el.dataset.leadId !== props.draggingLeadId)
  for (let i = 0; i < cards.length; i += 1) {
    const rect = cards[i]!.getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return i
  }
  return cards.length
}

const onDragOver = (event: DragEvent) => {
  if (!props.draggingLeadId) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const index = props.folded ? 0 : computeIndex(event.clientY)
  if (index !== props.dropIndex) emit('drag-over', props.stage.id, index)
}

const onDragLeave = (event: DragEvent) => {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (current && related && current.contains(related)) return
  emit('drag-leave', props.stage.id)
}

const onDrop = (event: DragEvent) => {
  if (!props.draggingLeadId) return
  event.preventDefault()
  const index = props.folded ? 0 : computeIndex(event.clientY)
  emit('drop', props.stage.id, index)
}

// La tarjeta arrastrada permanece en el DOM (quitarla durante dragstart
// cancela el arrastre en Chrome); el marcador se ubica ignorándola.
const items = computed(() => {
  let position = 0
  return props.leads.map((lead) => {
    const isDragged = lead.id === props.draggingLeadId
    const slot = isDragged ? -1 : position
    if (!isDragged) position += 1
    return { lead, slot, isDragged }
  })
})

const placeableCount = computed(() => items.value.filter(i => !i.isDragged).length)

const openQuickAdd = async () => {
  isQuickAddOpen.value = true
  await nextTick()
  quickInputRef.value?.focus()
}

const cancelQuickAdd = () => {
  isQuickAddOpen.value = false
  quickName.value = ''
}

const submitQuickAdd = () => {
  const name = quickName.value.trim()
  if (!name) return
  emit('quick-create', props.stage.id, name)
  quickName.value = ''
}

watch(() => props.isCreating, (creating, wasCreating) => {
  if (wasCreating && !creating) quickInputRef.value?.focus()
})
</script>

<template>
  <!-- Columna plegada -->
  <section
    v-if="folded"
    :aria-label="`Etapa ${stage.name} (plegada)`"
    :class="[
      'flex w-14 shrink-0 snap-start flex-col items-center rounded-2xl border bg-white/80 py-3 transition-all',
      isDropTarget ? `ring-2 ${palette.ring} border-transparent` : 'border-slate-200'
    ]"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <button
      type="button"
      class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      :aria-label="`Desplegar ${stage.name}`"
      title="Desplegar columna"
      @click="emit('toggle-fold', stage.id)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
    </button>
    <span :class="['mt-2 h-2.5 w-2.5 rounded-full', palette.dot]" />
    <span class="mt-2 rounded-full bg-slate-100 px-1.5 text-[11px] font-bold tabular-nums text-slate-600">{{ leads.length }}</span>
    <span class="mt-3 text-sm font-semibold text-slate-700 [writing-mode:vertical-rl]">{{ stage.name }}</span>
  </section>

  <!-- Columna expandida -->
  <section
    v-else
    :aria-label="`Etapa ${stage.name}, ${leads.length} leads`"
    :class="[
      'flex max-h-full w-[85vw] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition-all duration-200 sm:w-80',
      palette.soft,
      isDropTarget ? `ring-2 ${palette.ring} border-transparent shadow-lg` : 'border-slate-200/80'
    ]"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div :class="['h-1 shrink-0', palette.bar]" />

    <!-- Encabezado -->
    <header class="shrink-0 px-3.5 pb-2 pt-3">
      <div class="flex items-center gap-2">
        <span :class="['h-2.5 w-2.5 shrink-0 rounded-full', palette.dot]" />
        <h2 class="truncate text-sm font-bold text-slate-800" :title="stage.description ?? stage.name">{{ stage.name }}</h2>
        <span class="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 shadow-sm">{{ leads.length }}</span>
        <span
          v-if="stage.probability != null && !isClosing"
          class="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
          title="Probabilidad asignada al entrar a esta etapa"
        >
          {{ stage.probability }}%
        </span>

        <div class="ml-auto flex items-center">
          <button
            v-if="!isClosing"
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
            :aria-label="`Agregar lead en ${stage.name}`"
            title="Agregar lead aquí"
            @click="openQuickAdd"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
            :aria-label="`Plegar ${stage.name}`"
            title="Plegar columna"
            @click="emit('toggle-fold', stage.id)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          </button>
          <NuxtLink
            :to="`/admin/crm/stages/${stage.id}`"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
            :aria-label="`Configurar ${stage.name}`"
            title="Configurar etapa"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </NuxtLink>
        </div>
      </div>

      <div class="mt-2 flex items-baseline justify-between gap-2">
        <p class="text-lg font-bold tabular-nums tracking-tight text-slate-900">
          {{ formatCrmCurrency(totals.amount, 'MXN', totals.amount >= 1_000_000) }}
        </p>
        <p v-if="!isClosing && totals.amount > 0" class="text-[11px] text-slate-500" title="Valor ponderado por probabilidad">
          ≈ {{ formatCrmCurrency(totals.weighted, 'MXN', totals.weighted >= 1_000_000) }} pond.
        </p>
      </div>

      <div class="mt-2 flex items-center gap-2">
        <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80">
          <span :class="['block h-full rounded-full transition-all duration-500', palette.fill]" :style="{ width: `${share}%` }" />
        </span>
        <span class="w-9 text-right text-[10px] font-semibold tabular-nums text-slate-500">{{ share }}%</span>
      </div>

      <p v-if="totals.rotting > 0" class="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-700">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        {{ totals.rotting }} estancado(s) · más de {{ stage.rotting_days }} días
      </p>
    </header>

    <!-- Alta rápida -->
    <form
      v-if="isQuickAddOpen"
      class="mx-3 mb-2 shrink-0 rounded-xl border border-indigo-200 bg-white p-2 shadow-sm"
      @submit.prevent="submitQuickAdd"
    >
      <label :for="`quick-add-${stage.id}`" class="sr-only">Nombre del nuevo lead</label>
      <input
        :id="`quick-add-${stage.id}`"
        ref="quickInputRef"
        v-model="quickName"
        type="text"
        maxlength="255"
        placeholder="Nombre de la oportunidad…"
        :disabled="isCreating"
        class="w-full rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        @keydown.esc.prevent="cancelQuickAdd"
      >
      <div class="mt-1 flex items-center justify-between gap-2 px-1">
        <span class="text-[10px] text-slate-400">Enter para crear · Esc para cerrar</span>
        <div class="flex items-center gap-1">
          <button type="button" class="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100" @click="cancelQuickAdd">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="!quickName.trim() || isCreating"
            class="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ isCreating ? 'Creando…' : 'Crear' }}
          </button>
        </div>
      </div>
    </form>

    <!-- Tarjetas -->
    <div ref="listRef" class="min-h-24 flex-1 space-y-2.5 overflow-y-auto px-3 pb-3 pt-1">
      <template v-for="item in items" :key="item.lead.id">
        <div
          v-if="isDropTarget && dropIndex === item.slot"
          class="h-16 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 transition-all"
          aria-hidden="true"
        />
        <CrmKanbanCard
          :lead="item.lead"
          :stages="stageOptions"
          :compact="compact"
          :is-dragging="item.isDragged"
          :is-saving="savingLeadIds.includes(item.lead.id)"
          @drag-start="(event, l) => emit('drag-start', event, l)"
          @drag-end="emit('drag-end')"
          @action="(action, l) => emit('card-action', action, l)"
          @move="(l, stageId) => emit('card-move', l, stageId)"
        />
      </template>

      <div
        v-if="isDropTarget && dropIndex !== null && dropIndex >= placeableCount"
        class="h-16 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60"
        aria-hidden="true"
      />

      <!-- Vacío -->
      <div
        v-if="leads.length === 0 && !isDropTarget"
        class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/50 px-4 py-8 text-center"
      >
        <span :class="['flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm', palette.text]">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
        </span>
        <p class="mt-2 text-xs font-medium text-slate-500">Arrastra leads aquí</p>
        <button
          v-if="!isClosing"
          type="button"
          class="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          @click="openQuickAdd"
        >
          o crea uno nuevo
        </button>
      </div>
    </div>
  </section>
</template>
