<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

type StageRow = { id: string; name: string; sequence: number; description: string | null; is_won: boolean; is_lost: boolean; active: boolean }

const columns: Column[] = [
  { key: 'sequence', label: '#', type: 'text' },
  { key: 'name', label: 'Etapa', type: 'avatar' },
  { key: 'type_label', label: 'Tipo', type: 'badge', badgeConfig: { labels: { normal: 'Normal', won: 'Ganado', lost: 'Cancelado' } } },
  { key: 'description', label: 'Descripción', type: 'text' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getStagesByCompany, archiveStage, seedDefaultStages } = useCrmStage()

const isLoading = ref(false)
const isSeedingStages = ref(false)
const stagesRaw = ref<StageRow[]>([])

const mapToRow = (s: StageRow): Record<string, unknown> => ({
  id: s.id,
  sequence: s.sequence,
  name: s.name,
  description: s.description ?? '—',
  is_won: s.is_won,
  is_lost: s.is_lost,
  type_label: s.is_won ? 'won' : s.is_lost ? 'lost' : 'normal'
})

const tableRows = computed(() => stagesRaw.value.map(mapToRow))

const loadStages = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) { stagesRaw.value = []; return }

  isLoading.value = true
  try {
    stagesRaw.value = (await getStagesByCompany(companyId)) as StageRow[]
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void loadStages() }, { immediate: true })

const handleSeedStages = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isSeedingStages.value = true
  try {
    await seedDefaultStages(companyId)
    await loadStages()
  } finally {
    isSeedingStages.value = false
  }
}

const create = () => navigateTo('/admin/crm/stages/create')
const edit = (row: Record<string, unknown>) => navigateTo(`/admin/crm/stages/${row.id as string}`)
const remove = async (row: Record<string, unknown>) => {
  const ok = await archiveStage(row.id as string)
  if (ok) await loadStages()
}
const deleteMany = async (selected: Record<string, unknown>[]) => {
  for (const row of selected) await archiveStage(row.id as string)
  await loadStages()
}
</script>

<template>
  <div class="w-full py-4 space-y-6">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para gestionar su pipeline.</p>
    </div>

    <template v-else>
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
          <button
            type="button"
            :disabled="isSeedingStages"
            class="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60"
            @click="handleSeedStages"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ isSeedingStages ? 'Inicializando…' : 'Inicializar etapas por defecto' }}
          </button>
        </template>

        <template #actions="{ row }">
          <div class="flex items-center justify-center gap-2">
            <BtnApp variant="ghost" size="sm" @click="edit(row)">
              <template #iconLeft>
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </template>
            </BtnApp>
            <BtnApp variant="ghost" size="sm" @click="remove(row)">
              <template #iconLeft>
                <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
