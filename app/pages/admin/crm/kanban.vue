<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type {
  CrmKanbanCardAction,
  CrmKanbanLead,
  CrmKanbanStageOption
} from '~/components/CrmKanban/Card.vue'
import type { CrmLostDialogResult } from '~/components/CrmKanban/LostDialog.vue'
import type { CrmLeadPriority, CrmLeadStageRow, CrmLeadView, CrmLostReasonRow } from '~/types/crm.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId, partner } = storeToRefs(authStore)

const { getLeadsByCompany, getLeadViewById, createLead, moveLead, archiveLead, updateLead } = useCrmLead()
const { getStagesByCompany, seedDefaultStages } = useCrmStage()
const { getLostReasonsByCompany } = useCrmLostReason()
const { getCompanyMembers } = useMembership()

// ── Estado ──────────────────────────────────────────────────────────────────
const isLoading = ref(false)
const isSeeding = ref(false)
const stages = ref<CrmLeadStageRow[]>([])
const leads = ref<CrmKanbanLead[]>([])
const lostReasons = ref<CrmLostReasonRow[]>([])
const memberOptions = ref<{ value: string; label: string }[]>([])

// Filtros
const searchQuery = ref('')
const responsibleFilter = ref<string>('')
const priorityFilter = ref<CrmLeadPriority[]>([])
const onlyRotting = ref(false)
const onlyOverdue = ref(false)
const hideClosed = ref(false)
const isFiltersOpen = ref(false)
const filtersRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Preferencias por visitante
const compact = ref(false)
const foldedStageIds = ref<string[]>([])

// Arrastre
const draggingLeadId = ref<string | null>(null)
const dropTarget = ref<{ stageId: string; index: number } | null>(null)
const boardRef = ref<HTMLElement | null>(null)

// Operaciones
const savingLeadIds = ref<string[]>([])
const creatingStageId = ref<string | null>(null)
const pendingLost = ref<{ lead: CrmKanbanLead; stageId: string; index: number } | null>(null)
const isSavingLost = ref(false)

// Avisos
interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info' | 'won'
  undo?: () => Promise<void>
}
const toast = ref<Toast | null>(null)
const liveMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

const showToast = (message: string, tone: Toast['tone'] = 'info', undo?: () => Promise<void>) => {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { id: Date.now(), message, tone, undo }
  liveMessage.value = message
  toastTimer = setTimeout(() => { toast.value = null }, undo ? 7000 : 4500)
}

const dismissToast = () => {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = null
}

const runUndo = async () => {
  const undo = toast.value?.undo
  dismissToast()
  if (undo) await undo()
}

// ── Preferencias (localStorage) ────────────────────────────────────────────
const PREF_PREFIX = 'flowbit:crm-kanban'

const readPref = (key: string): string | null => {
  try { return localStorage.getItem(`${PREF_PREFIX}:${key}`) } catch { return null }
}

const writePref = (key: string, value: string) => {
  try { localStorage.setItem(`${PREF_PREFIX}:${key}`, value) } catch { /* almacenamiento no disponible */ }
}

const loadPrefs = (companyId: string, stageList: CrmLeadStageRow[]) => {
  compact.value = readPref('compact') === '1'
  hideClosed.value = readPref('hide-closed') === '1'
  const stored = readPref(`folded:${companyId}`)
  if (stored !== null) {
    try {
      const parsed: unknown = JSON.parse(stored)
      foldedStageIds.value = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
      return
    } catch { /* valor corrupto: usar predeterminado */ }
  }
  // Por defecto las columnas de cierre perdido inician plegadas
  foldedStageIds.value = stageList.filter(s => s.is_lost).map(s => s.id)
}

watch(compact, v => writePref('compact', v ? '1' : '0'))
watch(hideClosed, v => writePref('hide-closed', v ? '1' : '0'))

const toggleFold = (stageId: string) => {
  foldedStageIds.value = foldedStageIds.value.includes(stageId)
    ? foldedStageIds.value.filter(id => id !== stageId)
    : [...foldedStageIds.value, stageId]
  if (selectedCompanyId.value) writePref(`folded:${selectedCompanyId.value}`, JSON.stringify(foldedStageIds.value))
}

// ── Carga ───────────────────────────────────────────────────────────────────
const toKanbanLead = (view: CrmLeadView): CrmKanbanLead | null =>
  view.id && view.stage_id ? { ...view, id: view.id, stage_id: view.stage_id } : null

const loadBoard = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    stages.value = []
    leads.value = []
    return
  }

  isLoading.value = true
  try {
    const [stageList, leadList, reasons, members] = await Promise.all([
      getStagesByCompany(companyId),
      getLeadsByCompany(companyId),
      getLostReasonsByCompany(companyId),
      getCompanyMembers(companyId, 'team')
    ])
    stages.value = stageList
    leads.value = leadList.map(toKanbanLead).filter((l): l is CrmKanbanLead => l !== null)
    lostReasons.value = reasons
    memberOptions.value = members
      .filter(m => m.is_active && m.partner_user_id)
      .map(m => ({
        value: m.partner_id,
        label: (m.partner_display_name?.trim() || m.partner_name)?.trim() || m.partner_id
      }))
    loadPrefs(companyId, stageList)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void loadBoard() }, { immediate: true })

const refreshLead = async (leadId: string) => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const view = await getLeadViewById(leadId, companyId)
  const fresh = view ? toKanbanLead(view) : null
  const idx = leads.value.findIndex(l => l.id === leadId)
  if (!fresh) {
    if (idx >= 0) leads.value.splice(idx, 1)
    return
  }
  if (idx >= 0) leads.value.splice(idx, 1, fresh)
  else leads.value.push(fresh)
}

const handleSeed = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isSeeding.value = true
  try {
    const ok = await seedDefaultStages(companyId)
    if (!ok) showToast('No se pudieron crear las etapas. Verifica tus permisos.', 'error')
    await loadBoard()
  } finally {
    isSeeding.value = false
  }
}

// ── Filtros ─────────────────────────────────────────────────────────────────
const myPartnerId = computed(() => partner.value?.id ?? null)

const responsibleOptions = computed(() => [
  { value: '', label: 'Todo el equipo' },
  ...(myPartnerId.value ? [{ value: 'me', label: 'Mis leads' }] : []),
  { value: 'none', label: 'Sin responsable' },
  ...memberOptions.value.filter(m => m.value !== myPartnerId.value)
])

const matchesFilters = (lead: CrmKanbanLead): boolean => {
  const term = searchQuery.value.trim().toLowerCase()
  if (term) {
    const haystack = [
      lead.name,
      `#${lead.lead_number ?? ''}`,
      lead.contact_name,
      lead.contact_company,
      lead.contact_email,
      lead.partner_display_name,
      lead.responsible_display_name,
      ...(lead.tags ?? [])
    ].filter(Boolean).join(' ').toLowerCase()
    if (!haystack.includes(term)) return false
  }

  if (responsibleFilter.value === 'me' && lead.responsible_partner_id !== myPartnerId.value) return false
  if (responsibleFilter.value === 'none' && lead.responsible_partner_id) return false
  if (responsibleFilter.value && !['me', 'none'].includes(responsibleFilter.value)
    && lead.responsible_partner_id !== responsibleFilter.value) return false

  if (priorityFilter.value.length > 0 && !priorityFilter.value.includes((lead.priority ?? 'medium') as CrmLeadPriority)) return false
  if (onlyRotting.value && !lead.is_rotting) return false
  if (onlyOverdue.value && Number(lead.overdue_activity_count ?? 0) === 0) return false
  return true
}

const activeFilterCount = computed(() =>
  [
    searchQuery.value.trim() !== '',
    responsibleFilter.value !== '',
    priorityFilter.value.length > 0,
    onlyRotting.value,
    onlyOverdue.value
  ].filter(Boolean).length
)

const resetFilters = () => {
  searchQuery.value = ''
  responsibleFilter.value = ''
  priorityFilter.value = []
  onlyRotting.value = false
  onlyOverdue.value = false
}

const togglePriority = (value: CrmLeadPriority) => {
  priorityFilter.value = priorityFilter.value.includes(value)
    ? priorityFilter.value.filter(p => p !== value)
    : [...priorityFilter.value, value]
}

// ── Columnas ────────────────────────────────────────────────────────────────
const visibleStages = computed(() =>
  hideClosed.value ? stages.value.filter(s => !s.is_won && !s.is_lost) : stages.value
)

const stageOptions = computed<CrmKanbanStageOption[]>(() =>
  stages.value.map(s => ({ id: s.id, name: s.name, color: s.color }))
)

const sortLeads = (a: CrmKanbanLead, b: CrmKanbanLead): number => {
  const diff = Number(a.kanban_sequence ?? 0) - Number(b.kanban_sequence ?? 0)
  if (diff !== 0) return diff
  return (b.created_at ?? '').localeCompare(a.created_at ?? '')
}

const leadsByStage = computed(() => {
  const map: Record<string, CrmKanbanLead[]> = {}
  for (const stage of stages.value) map[stage.id] = []
  for (const lead of leads.value) {
    if (!matchesFilters(lead)) continue
    map[lead.stage_id]?.push(lead)
  }
  for (const list of Object.values(map)) list.sort(sortLeads)
  return map
})

const orphanCount = computed(() => {
  const ids = new Set(stages.value.map(s => s.id))
  return leads.value.filter(l => !ids.has(l.stage_id)).length
})

// ── Indicadores ─────────────────────────────────────────────────────────────
const metrics = computed(() => {
  let openCount = 0
  let openAmount = 0
  let weighted = 0
  let won = 0
  let wonAmount = 0
  let lost = 0
  let rotting = 0
  let overdue = 0
  let noFollowUp = 0

  for (const lead of leads.value) {
    if (!matchesFilters(lead)) continue
    const amount = Number(lead.amount ?? 0)
    if (lead.is_won) { won += 1; wonAmount += amount; continue }
    if (lead.is_lost) { lost += 1; continue }
    openCount += 1
    openAmount += amount
    weighted += amount * (Number(lead.probability ?? 0) / 100)
    if (lead.is_rotting) rotting += 1
    if (Number(lead.overdue_activity_count ?? 0) > 0) overdue += 1
    if (!lead.next_activity_at && Number(lead.open_activity_count ?? 0) === 0) noFollowUp += 1
  }

  const closed = won + lost
  return {
    openCount,
    openAmount,
    weighted,
    won,
    wonAmount,
    rotting,
    overdue,
    noFollowUp,
    winRate: closed > 0 ? Math.round((won / closed) * 100) : null
  }
})

const pipelineTotal = computed(() =>
  Object.values(leadsByStage.value).flat().reduce((sum, l) => sum + Number(l.amount ?? 0), 0)
)

// ── Movimiento ──────────────────────────────────────────────────────────────
const stageById = (id: string) => stages.value.find(s => s.id === id)

const markSaving = (id: string, saving: boolean) => {
  savingLeadIds.value = saving
    ? [...savingLeadIds.value, id]
    : savingLeadIds.value.filter(x => x !== id)
}

/** Reasigna posiciones consecutivas cuando dos vecinas comparten valor. */
const renumberColumn = async (stageId: string, ordered: CrmKanbanLead[]) => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  await Promise.all(ordered.map((lead, i) => {
    const seq = (i + 1) * 1000
    lead.kanban_sequence = seq
    return updateLead(lead.id, companyId, { kanban_sequence: seq, stage_id: stageId })
  }))
}

interface MoveOptions {
  lostReasonId?: string | null
  lostNotes?: string | null
  /** Omite el aviso con «Deshacer» (se usa al deshacer) */
  silent?: boolean
}

const performMove = async (
  lead: CrmKanbanLead,
  stageId: string,
  index: number,
  options: MoveOptions = {}
): Promise<boolean> => {
  const companyId = selectedCompanyId.value
  const target = stageById(stageId)
  if (!companyId || !target) return false

  const column = (leadsByStage.value[stageId] ?? []).filter(l => l.id !== lead.id)
  const safeIndex = Math.max(0, Math.min(index, column.length))

  // Sin cambios reales
  const currentColumn = leadsByStage.value[lead.stage_id] ?? []
  if (lead.stage_id === stageId && currentColumn.findIndex(l => l.id === lead.id) === safeIndex) return true

  // Cierre perdido: pedir motivo antes de mover
  if (target.is_lost && !lead.is_lost && options.lostReasonId === undefined) {
    pendingLost.value = { lead, stageId, index: safeIndex }
    return false
  }

  const before = column[safeIndex - 1]?.kanban_sequence ?? null
  const after = column[safeIndex]?.kanban_sequence ?? null
  const needsRenumber = before !== null && after !== null && Number(before) >= Number(after)
  const sequence = computeKanbanSequence(
    before === null ? null : Number(before),
    after === null ? null : Number(after)
  )

  const previous: CrmKanbanLead = { ...lead }
  const stageChanged = lead.stage_id !== stageId
  const lostReason = options.lostReasonId ? lostReasons.value.find(r => r.id === options.lostReasonId) : null

  // Actualización optimista
  const idx = leads.value.findIndex(l => l.id === lead.id)
  if (idx < 0) return false
  leads.value.splice(idx, 1, {
    ...lead,
    stage_id: stageId,
    kanban_sequence: sequence,
    stage_name: target.name,
    stage_color: target.color,
    is_won: target.is_won,
    is_lost: target.is_lost,
    probability: stageChanged && target.probability != null ? target.probability : lead.probability,
    is_rotting: stageChanged ? false : lead.is_rotting,
    days_in_stage: stageChanged ? 0 : lead.days_in_stage,
    lost_reason_id: target.is_lost ? (options.lostReasonId ?? lead.lost_reason_id) : null,
    lost_reason_name: target.is_lost ? (lostReason?.name ?? lead.lost_reason_name) : null
  })

  markSaving(lead.id, true)
  try {
    const updated = await moveLead(lead.id, companyId, {
      stageId,
      kanbanSequence: sequence,
      lostReasonId: options.lostReasonId,
      lostNotes: options.lostNotes
    })

    if (!updated) {
      const current = leads.value.findIndex(l => l.id === lead.id)
      if (current >= 0) leads.value.splice(current, 1, previous)
      showToast('No se pudo mover el lead. Revisa tu conexión o permisos.', 'error')
      return false
    }

    if (needsRenumber) {
      const ordered = [...column]
      const moved = leads.value.find(l => l.id === lead.id)
      if (moved) ordered.splice(safeIndex, 0, moved)
      await renumberColumn(stageId, ordered)
    }

    await refreshLead(lead.id)

    if (stageChanged && !options.silent) {
      const undo = async () => {
        const fresh = leads.value.find(l => l.id === lead.id)
        if (!fresh) return
        const prevColumn = (leadsByStage.value[previous.stage_id] ?? []).filter(l => l.id !== lead.id)
        const prevIndex = prevColumn.findIndex(l => Number(l.kanban_sequence ?? 0) > Number(previous.kanban_sequence ?? 0))
        await performMove(fresh, previous.stage_id, prevIndex < 0 ? prevColumn.length : prevIndex, {
          lostReasonId: previous.lost_reason_id ?? null,
          lostNotes: previous.lost_notes ?? null,
          silent: true
        })
        showToast(`«${lead.name}» volvió a ${previous.stage_name ?? 'su etapa'}.`, 'info')
      }

      if (target.is_won) showToast(`¡Oportunidad ganada! «${lead.name}» se movió a ${target.name}.`, 'won', undo)
      else if (target.is_lost) showToast(`«${lead.name}» se marcó como perdido.`, 'info', undo)
      else showToast(`«${lead.name}» se movió a ${target.name}.`, 'success', undo)
    }
    return true
  } finally {
    markSaving(lead.id, false)
  }
}

// Arrastrar y soltar
const onDragStart = (event: DragEvent, lead: CrmKanbanLead) => {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', lead.id)
  }
  // Diferido: cambiar el DOM dentro de dragstart puede cancelar el arrastre
  requestAnimationFrame(() => { draggingLeadId.value = lead.id })
}

const onDragEnd = () => {
  draggingLeadId.value = null
  dropTarget.value = null
}

const onDragOver = (stageId: string, index: number) => {
  dropTarget.value = { stageId, index }
}

const onDragLeave = (stageId: string) => {
  if (dropTarget.value?.stageId === stageId) dropTarget.value = null
}

const onDrop = async (stageId: string, index: number) => {
  const lead = leads.value.find(l => l.id === draggingLeadId.value)
  onDragEnd()
  if (!lead) return
  await performMove(lead, stageId, index)
}

// Desplazamiento horizontal automático cerca de los bordes
const onBoardDragOver = (event: DragEvent) => {
  const board = boardRef.value
  if (!board || !draggingLeadId.value) return
  const rect = board.getBoundingClientRect()
  const edge = 80
  if (event.clientX < rect.left + edge) board.scrollBy({ left: -24 })
  else if (event.clientX > rect.right - edge) board.scrollBy({ left: 24 })
}

// ── Diálogo de pérdida ──────────────────────────────────────────────────────
const pendingStageName = computed(() =>
  pendingLost.value ? stageById(pendingLost.value.stageId)?.name ?? '' : ''
)

const confirmLost = async (result: CrmLostDialogResult) => {
  const pending = pendingLost.value
  if (!pending) return
  isSavingLost.value = true
  try {
    await performMove(pending.lead, pending.stageId, pending.index, {
      lostReasonId: result.lostReasonId,
      lostNotes: result.lostNotes
    })
    pendingLost.value = null
  } finally {
    isSavingLost.value = false
  }
}

// ── Acciones de tarjeta ────────────────────────────────────────────────────
const handleCardAction = async (action: CrmKanbanCardAction, lead: CrmKanbanLead) => {
  const companyId = selectedCompanyId.value
  switch (action) {
    case 'open':
      if (!draggingLeadId.value) await navigateTo(`/admin/crm/leads/${lead.id}`)
      break
    case 'schedule':
      await navigateTo({ path: `/admin/crm/leads/${lead.id}`, query: { activity: 'new' } })
      break
    case 'won': {
      const wonStage = stages.value.find(s => s.is_won)
      if (!wonStage) { showToast('Configura una etapa de cierre ganado para usar esta acción.', 'error'); return }
      await performMove(lead, wonStage.id, 0)
      break
    }
    case 'lost': {
      const lostStage = stages.value.find(s => s.is_lost)
      if (!lostStage) { showToast('Configura una etapa de cierre perdido para usar esta acción.', 'error'); return }
      pendingLost.value = { lead, stageId: lostStage.id, index: 0 }
      break
    }
    case 'reopen': {
      const openStage = stages.value.find(s => !s.is_won && !s.is_lost)
      if (!openStage) return
      await performMove(lead, openStage.id, 0)
      break
    }
    case 'archive': {
      if (!companyId) return
      const idx = leads.value.findIndex(l => l.id === lead.id)
      if (idx < 0) return
      leads.value.splice(idx, 1)
      const ok = await archiveLead(lead.id, companyId)
      if (!ok) {
        leads.value.splice(idx, 0, lead)
        showToast('No se pudo archivar el lead.', 'error')
        return
      }
      showToast(`«${lead.name}» se archivó.`, 'info', async () => {
        const restored = await updateLead(lead.id, companyId, { active: true })
        if (restored) {
          await refreshLead(lead.id)
          showToast(`«${lead.name}» se restauró.`, 'success')
        }
      })
      break
    }
  }
}

const handleCardMove = async (lead: CrmKanbanLead, stageId: string) => {
  await performMove(lead, stageId, 0)
}

// ── Alta rápida ─────────────────────────────────────────────────────────────
const handleQuickCreate = async (stageId: string, name: string) => {
  const companyId = selectedCompanyId.value
  const stage = stageById(stageId)
  if (!companyId || !stage) return

  creatingStageId.value = stageId
  try {
    const created = await createLead(companyId, {
      name,
      stage_id: stageId,
      probability: stage.probability ?? 0,
      responsible_partner_id: myPartnerId.value,
      priority: 'medium',
      origin: 'other'
    })
    if (!created) { showToast('No se pudo crear el lead.', 'error'); return }
    await refreshLead(created.id)
    showToast(`Lead «${name}» creado en ${stage.name}.`, 'success')
  } finally {
    creatingStageId.value = null
  }
}

// ── Atajos de teclado ───────────────────────────────────────────────────────
const onGlobalKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  const isTyping = target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
  if (event.key === '/' && !isTyping) {
    event.preventDefault()
    searchInputRef.value?.focus()
  }
  if (event.key === 'Escape') {
    if (draggingLeadId.value) onDragEnd()
    isFiltersOpen.value = false
  }
}

const onGlobalClick = (event: MouseEvent) => {
  if (isFiltersOpen.value && filtersRef.value && !filtersRef.value.contains(event.target as Node)) {
    isFiltersOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('click', onGlobalClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('click', onGlobalClick)
  if (toastTimer) clearTimeout(toastTimer)
})

const toastStyles: Record<Toast['tone'], string> = {
  success: 'bg-slate-900 text-white',
  info: 'bg-slate-900 text-white',
  error: 'bg-red-600 text-white',
  won: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
}
</script>

<template>
  <div class="w-full space-y-5 py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para ver su tablero de oportunidades.</p>
    </div>

    <template v-else>
      <!-- Encabezado -->
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-sky-600">CRM</p>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">Tablero de oportunidades</h1>
          <p class="mt-1 text-sm text-slate-500">Arrastra cada lead a la etapa que refleja su avance real.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <CrmLeadViewSwitch current="kanban" />
          <BtnApp variant="primary" size="md" @click="navigateTo('/admin/crm/leads/create')">
            <template #iconLeft>
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            </template>
            Nuevo lead
          </BtnApp>
        </div>
      </header>

      <!-- Indicadores -->
      <div v-if="isLoading" class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div v-for="i in 5" :key="i" class="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <div v-else-if="stages.length > 0" class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div class="col-span-2 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-violet-200/60 lg:col-span-1">
          <p class="text-xs font-medium text-white/80">Pipeline abierto</p>
          <p class="mt-1 truncate text-xl font-bold tabular-nums">{{ formatCrmCurrency(metrics.openAmount) }}</p>
          <p class="text-[11px] text-white/80">{{ metrics.openCount }} oportunidades</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-medium text-slate-500">Pronóstico ponderado</p>
          <p class="mt-1 truncate text-xl font-bold tabular-nums text-slate-800">{{ formatCrmCurrency(metrics.weighted) }}</p>
          <p class="text-[11px] text-slate-400">Según probabilidad</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-medium text-slate-500">Ganado</p>
          <p class="mt-1 truncate text-xl font-bold tabular-nums text-emerald-600">{{ formatCrmCurrency(metrics.wonAmount) }}</p>
          <p class="text-[11px] text-slate-400">
            {{ metrics.won }} cerrados{{ metrics.winRate !== null ? ` · ${metrics.winRate}% de éxito` : '' }}
          </p>
        </div>
        <button
          type="button"
          :aria-pressed="onlyRotting"
          :class="[
            'rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
            onlyRotting ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-200' : 'border-slate-200 bg-white'
          ]"
          title="Filtrar leads estancados"
          @click="onlyRotting = !onlyRotting"
        >
          <p class="text-xs font-medium text-slate-500">Estancados</p>
          <p :class="['mt-1 text-xl font-bold tabular-nums', metrics.rotting > 0 ? 'text-amber-600' : 'text-slate-800']">{{ metrics.rotting }}</p>
          <p class="text-[11px] text-slate-400">{{ onlyRotting ? 'Filtro activo' : 'Clic para filtrar' }}</p>
        </button>
        <button
          type="button"
          :aria-pressed="onlyOverdue"
          :class="[
            'rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
            onlyOverdue ? 'border-red-300 bg-red-50 ring-2 ring-red-200' : 'border-slate-200 bg-white'
          ]"
          title="Filtrar leads con actividades vencidas"
          @click="onlyOverdue = !onlyOverdue"
        >
          <p class="text-xs font-medium text-slate-500">Seguimiento vencido</p>
          <p :class="['mt-1 text-xl font-bold tabular-nums', metrics.overdue > 0 ? 'text-red-600' : 'text-slate-800']">{{ metrics.overdue }}</p>
          <p class="text-[11px] text-slate-400">{{ metrics.noFollowUp }} sin actividad programada</p>
        </button>
      </div>

      <!-- Barra de filtros -->
      <div v-if="stages.length > 0" class="sticky top-16 z-30">
        <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-md backdrop-blur-md sm:px-4">
          <div class="relative min-w-[12rem] flex-1">
            <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <label for="kanban-search" class="sr-only">Buscar leads</label>
            <input
              id="kanban-search"
              ref="searchInputRef"
              v-model="searchQuery"
              type="search"
              placeholder="Buscar lead, contacto, etiqueta…"
              autocomplete="off"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-400/30"
            >
            <kbd class="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-400 sm:block">/</kbd>
          </div>

          <label for="kanban-responsible" class="sr-only">Responsable</label>
          <select
            id="kanban-responsible"
            v-model="responsibleFilter"
            class="rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
          >
            <option v-for="opt in responsibleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <div ref="filtersRef" class="relative">
            <button
              type="button"
              :aria-expanded="isFiltersOpen"
              :class="[
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition',
                activeFilterCount > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              ]"
              @click="isFiltersOpen = !isFiltersOpen"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Filtros
              <span v-if="activeFilterCount > 0" class="rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">{{ activeFilterCount }}</span>
            </button>

            <div
              v-if="isFiltersOpen"
              class="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridad</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="(meta, key) in CRM_PRIORITY_META"
                  :key="key"
                  type="button"
                  :aria-pressed="priorityFilter.includes(key as CrmLeadPriority)"
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                    priorityFilter.includes(key as CrmLeadPriority) ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  ]"
                  @click="togglePriority(key as CrmLeadPriority)"
                >
                  <span :class="['h-2 w-2 rounded-full', meta.accent]" />
                  {{ meta.label }}
                </button>
              </div>

              <div class="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input v-model="onlyRotting" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500">
                  Solo estancados
                </label>
                <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input v-model="onlyOverdue" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500">
                  Con actividades vencidas
                </label>
              </div>

              <div class="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <button type="button" class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" @click="resetFilters">
                  Limpiar
                </button>
                <button type="button" class="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700" @click="isFiltersOpen = false">
                  Listo
                </button>
              </div>
            </div>
          </div>

          <div class="ml-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              :aria-pressed="hideClosed"
              :class="['rounded-lg px-2.5 py-1.5 text-xs font-medium transition', hideClosed ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800']"
              title="Ocultar columnas de cierre"
              @click="hideClosed = !hideClosed"
            >
              Solo abiertos
            </button>
            <button
              type="button"
              :aria-pressed="compact"
              :class="['rounded-lg p-1.5 transition', compact ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800']"
              :title="compact ? 'Vista detallada' : 'Vista compacta'"
              :aria-label="compact ? 'Cambiar a vista detallada' : 'Cambiar a vista compacta'"
              @click="compact = !compact"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="compact" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Avisos -->
      <div
        v-if="orphanCount > 0"
        class="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <span>
          {{ orphanCount }} lead(s) están en etapas archivadas y no aparecen en el tablero.
          <NuxtLink to="/admin/crm/leads" class="font-semibold underline">Revísalos en la lista</NuxtLink>.
        </span>
      </div>

      <!-- Tablero: cargando -->
      <div v-if="isLoading" class="flex gap-4 overflow-hidden" aria-busy="true" aria-label="Cargando tablero">
        <div v-for="i in 4" :key="i" class="w-80 shrink-0 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div class="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div class="h-6 w-24 animate-pulse rounded bg-slate-200" />
          <div v-for="j in (5 - i)" :key="j" class="h-28 animate-pulse rounded-xl bg-white" />
        </div>
      </div>

      <!-- Tablero: sin etapas -->
      <div
        v-else-if="stages.length === 0"
        class="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-lg shadow-slate-200/50"
      >
        <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-lg">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
        </span>
        <h2 class="mt-4 text-lg font-semibold text-slate-800">Tu pipeline aún no tiene etapas</h2>
        <p class="mt-1 max-w-md text-sm text-slate-500">
          Empieza con un pipeline probado (Nuevo → Calificado → Propuesta → Negociación → Ganado / Cancelado)
          y ajústalo después a tu proceso.
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <BtnApp variant="primary" size="md" :disabled="isSeeding" @click="handleSeed">
            {{ isSeeding ? 'Creando etapas…' : 'Crear pipeline sugerido' }}
          </BtnApp>
          <BtnApp variant="secondary" size="md" @click="navigateTo('/admin/crm/stages/create')">
            Definir mis etapas
          </BtnApp>
        </div>
      </div>

      <!-- Tablero -->
      <div
        v-else
        ref="boardRef"
        class="-mx-4 flex h-[calc(100dvh-20rem)] min-h-[30rem] snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0"
        @dragover="onBoardDragOver"
      >
        <CrmKanbanColumn
          v-for="stage in visibleStages"
          :key="stage.id"
          :stage="stage"
          :leads="leadsByStage[stage.id] ?? []"
          :stage-options="stageOptions"
          :pipeline-total="pipelineTotal"
          :folded="foldedStageIds.includes(stage.id)"
          :compact="compact"
          :dragging-lead-id="draggingLeadId"
          :drop-index="dropTarget?.stageId === stage.id ? dropTarget.index : null"
          :saving-lead-ids="savingLeadIds"
          :is-creating="creatingStageId === stage.id"
          @toggle-fold="toggleFold"
          @drag-start="onDragStart"
          @drag-end="onDragEnd"
          @drag-over="onDragOver"
          @drag-leave="onDragLeave"
          @drop="onDrop"
          @card-action="handleCardAction"
          @card-move="handleCardMove"
          @quick-create="handleQuickCreate"
        />

        <NuxtLink
          to="/admin/crm/stages/create"
          class="flex w-14 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600"
          title="Agregar etapa"
          aria-label="Agregar etapa"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          <span class="text-xs font-semibold [writing-mode:vertical-rl]">Nueva etapa</span>
        </NuxtLink>
      </div>
    </template>

    <!-- Motivo de pérdida -->
    <CrmKanbanLostDialog
      :open="pendingLost !== null"
      :lead-name="pendingLost?.lead.name ?? ''"
      :stage-name="pendingStageName"
      :reasons="lostReasons"
      :is-saving="isSavingLost"
      @confirm="confirmLost"
      @cancel="pendingLost = null"
    />

    <!-- Región viva para lectores de pantalla -->
    <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

    <!-- Aviso flotante con deshacer -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-4 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-4 opacity-0"
      >
        <div
          v-if="toast"
          :key="toast.id"
          role="status"
          :class="['fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl', toastStyles[toast.tone]]"
        >
          <span v-if="toast.tone === 'won'" class="text-lg" aria-hidden="true">🎉</span>
          <svg v-else-if="toast.tone === 'error'" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <svg v-else class="h-5 w-5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          <span class="min-w-0 flex-1">{{ toast.message }}</span>
          <button
            v-if="toast.undo"
            type="button"
            class="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/25"
            @click="runUndo"
          >
            Deshacer
          </button>
          <button type="button" class="shrink-0 opacity-70 transition hover:opacity-100" aria-label="Cerrar aviso" @click="dismissToast">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
