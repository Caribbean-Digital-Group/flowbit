<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { CrmLeadStageRow } from '~/types/crm.types'

definePageMeta({ layout: 'admin' })

const columns: Column[] = [
  { key: 'sequence', label: '#', type: 'text' },
  { key: 'name', label: 'Etapa', type: 'avatar' },
  { key: 'type_label', label: 'Tipo', type: 'badge', badgeConfig: { labels: { normal: 'Normal', won: 'Ganado', lost: 'Cancelado' } } },
  { key: 'probability_display', label: 'Probabilidad', type: 'text' },
  { key: 'rotting_display', label: 'Alerta de estancamiento', type: 'text' },
  { key: 'description', label: 'Descripción', type: 'text' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getStagesByCompany, archiveStage, seedDefaultStages, reorderStages, countActiveLeadsInStage } = useCrmStage()

const isLoading = ref(false)
const isSeedingStages = ref(false)
const isReordering = ref(false)
const feedback = ref<{ type: 'error' | 'success'; message: string } | null>(null)
const stagesRaw = ref<CrmLeadStageRow[]>([])

// Reordenamiento por arrastre
const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

const mapToRow = (s: CrmLeadStageRow): Record<string, unknown> => ({
  id: s.id,
  sequence: s.sequence,
  name: s.name,
  description: s.description ?? '—',
  is_won: s.is_won,
  is_lost: s.is_lost,
  type_label: s.is_won ? 'won' : s.is_lost ? 'lost' : 'normal',
  probability_display: s.probability != null ? `${s.probability}%` : 'Manual',
  rotting_display: s.rotting_days ? `${s.rotting_days} días` : '—'
})

const tableRows = computed(() => stagesRaw.value.map(mapToRow))

const loadStages = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) { stagesRaw.value = []; return }

  isLoading.value = true
  try {
    stagesRaw.value = await getStagesByCompany(companyId)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void loadStages() }, { immediate: true })

const handleSeedStages = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isSeedingStages.value = true
  feedback.value = null
  try {
    const ok = await seedDefaultStages(companyId)
    feedback.value = ok
      ? { type: 'success', message: 'Etapas y motivos de pérdida por defecto listos.' }
      : { type: 'error', message: 'No se pudieron inicializar las etapas. Verifica tus permisos.' }
    await loadStages()
  } finally {
    isSeedingStages.value = false
  }
}

const onChipDragStart = (event: DragEvent, id: string) => {
  draggingId.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const onChipDragEnd = () => {
  draggingId.value = null
  dragOverId.value = null
}

const persistOrder = async (ordered: CrmLeadStageRow[]) => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const previous = stagesRaw.value
  stagesRaw.value = ordered.map((s, i) => ({ ...s, sequence: (i + 1) * 10 }))
  isReordering.value = true
  try {
    const ok = await reorderStages(companyId, ordered.map(s => s.id))
    if (!ok) {
      stagesRaw.value = previous
      feedback.value = { type: 'error', message: 'No se pudo guardar el nuevo orden.' }
    }
  } finally {
    isReordering.value = false
  }
}

const onChipDrop = async (targetId: string) => {
  const sourceId = draggingId.value
  onChipDragEnd()
  if (!sourceId || sourceId === targetId) return

  const list = [...stagesRaw.value]
  const from = list.findIndex(s => s.id === sourceId)
  const to = list.findIndex(s => s.id === targetId)
  if (from < 0 || to < 0) return
  const [moved] = list.splice(from, 1)
  if (!moved) return
  list.splice(to, 0, moved)
  await persistOrder(list)
}

// Alternativa accesible al arrastre (teclado / táctil)
const moveChip = async (id: string, direction: -1 | 1) => {
  const list = [...stagesRaw.value]
  const from = list.findIndex(s => s.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return
  const [moved] = list.splice(from, 1)
  if (!moved) return
  list.splice(to, 0, moved)
  await persistOrder(list)
}

const tryArchive = async (id: string): Promise<boolean> => {
  const companyId = selectedCompanyId.value
  if (!companyId) return false
  const leadCount = await countActiveLeadsInStage(id, companyId)
  if (leadCount > 0) {
    const name = stagesRaw.value.find(s => s.id === id)?.name ?? 'La etapa'
    feedback.value = {
      type: 'error',
      message: `«${name}» tiene ${leadCount} lead(s) activo(s). Muévelos a otra etapa antes de archivarla.`
    }
    return false
  }
  return archiveStage(id, companyId)
}

const create = () => navigateTo('/admin/crm/stages/create')
const edit = (row: Record<string, unknown>) => navigateTo(`/admin/crm/stages/${row.id as string}`)
const remove = async (row: Record<string, unknown>) => {
  feedback.value = null
  const ok = await tryArchive(row.id as string)
  if (ok) await loadStages()
}
const deleteMany = async (selected: Record<string, unknown>[]) => {
  feedback.value = null
  for (const row of selected) await tryArchive(row.id as string)
  await loadStages()
}
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para gestionar su pipeline.</p>
    </div>

    <template v-else>
      <div
        v-if="feedback"
        role="status"
        :class="[
          'flex items-start justify-between gap-3 rounded-2xl border px-5 py-3 text-sm',
          feedback.type === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        ]"
      >
        <span>{{ feedback.message }}</span>
        <button type="button" class="shrink-0 opacity-70 hover:opacity-100" aria-label="Cerrar aviso" @click="feedback = null">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Pipeline visual -->
      <section
        v-if="!isLoading && stagesRaw.length > 0"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-800">Flujo del pipeline</h2>
            <p class="text-sm text-slate-500">Arrastra las etapas para cambiar su orden en el tablero.</p>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="isReordering" class="text-xs text-slate-400">Guardando orden…</span>
            <NuxtLink
              to="/admin/crm/kanban"
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Abrir tablero
            </NuxtLink>
          </div>
        </div>

        <ol class="mt-4 flex gap-2 overflow-x-auto pb-2">
          <li
            v-for="(stage, index) in stagesRaw"
            :key="stage.id"
            draggable="true"
            :class="[
              'group relative flex min-w-44 shrink-0 cursor-grab items-center gap-2 rounded-xl border bg-white py-2.5 pl-3 pr-2 transition-all active:cursor-grabbing',
              draggingId === stage.id ? 'scale-95 opacity-40' : '',
              dragOverId === stage.id && draggingId !== stage.id ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
            ]"
            @dragstart="onChipDragStart($event, stage.id)"
            @dragend="onChipDragEnd"
            @dragover.prevent="dragOverId = stage.id"
            @dragleave="dragOverId = dragOverId === stage.id ? null : dragOverId"
            @drop.prevent="onChipDrop(stage.id)"
          >
            <span :class="['absolute inset-y-2 left-0 w-1 rounded-r-full', getStagePalette(stage.color).bar]" />
            <svg class="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm8-12a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            <button type="button" class="min-w-0 flex-1 text-left" @click="navigateTo(`/admin/crm/stages/${stage.id}`)">
              <span class="block truncate text-sm font-semibold text-slate-800">{{ stage.name }}</span>
              <span class="block text-[11px] text-slate-500">
                <template v-if="stage.is_won">Cierre ganado</template>
                <template v-else-if="stage.is_lost">Cierre perdido</template>
                <template v-else>{{ stage.probability != null ? `${stage.probability}% prob.` : 'Prob. manual' }}</template>
              </span>
            </button>
            <div class="flex flex-col">
              <button
                type="button"
                :disabled="index === 0 || isReordering"
                class="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:invisible"
                :aria-label="`Mover ${stage.name} antes`"
                @click="moveChip(stage.id, -1)"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                :disabled="index === stagesRaw.length - 1 || isReordering"
                class="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:invisible"
                :aria-label="`Mover ${stage.name} después`"
                @click="moveChip(stage.id, 1)"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </li>
        </ol>
      </section>

      <div
        v-if="isLoading"
        class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
      >
        Cargando etapas…
      </div>

      <Datatable
        v-else
        title="Etapas del Pipeline"
        description="Configura las fases por las que atraviesa un lead en el proceso de ventas"
        :data="tableRows"
        :columns="columns"
        :search-keys="['name', 'description']"
        :selectable="true"
        :creatable="true"
        create-label="Nueva etapa"
        empty-title="Sin etapas configuradas"
        empty-message="Aún no hay etapas para este pipeline. Crea la primera o inicializa con las etapas por defecto."
        @create="create"
      >
        <template #headerActions>
          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink
              to="/admin/crm/lost-reasons"
              class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <svg class="h-4 w-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Motivos de pérdida
            </NuxtLink>
            <button
              type="button"
              :disabled="isSeedingStages"
              class="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60"
              @click="handleSeedStages"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {{ isSeedingStages ? 'Inicializando…' : 'Inicializar etapas por defecto' }}
            </button>
          </div>
        </template>

        <template #actions="{ row }">
          <div class="flex items-center justify-center gap-2">
            <BtnApp variant="ghost" size="sm" @click="edit(row)">
              <template #iconLeft>
                <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </template>
            </BtnApp>
            <BtnApp variant="ghost" size="sm" @click="remove(row)">
              <template #iconLeft>
                <svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
