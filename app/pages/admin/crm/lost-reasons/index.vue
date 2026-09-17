<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { CrmLostReasonRow } from '~/types/crm.types'

definePageMeta({ layout: 'admin' })

const columns: Column[] = [
  { key: 'sequence', label: '#', type: 'text' },
  { key: 'name', label: 'Motivo', type: 'avatar' },
  { key: 'usage_display', label: 'Leads perdidos', type: 'text' },
  { key: 'share', label: 'Participación', type: 'progress' },
  { key: 'description', label: 'Descripción', type: 'text' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getLostReasonsByCompany, getLostReasonUsage, archiveLostReason, seedDefaultLostReasons } = useCrmLostReason()

const isLoading = ref(false)
const isSeeding = ref(false)
const reasons = ref<CrmLostReasonRow[]>([])
const usage = ref<Record<string, number>>({})

const totalLost = computed(() => Object.values(usage.value).reduce((sum, n) => sum + n, 0))

const topReasons = computed(() =>
  reasons.value
    .map(r => ({ ...r, count: usage.value[r.id] ?? 0 }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
)

const tableRows = computed(() =>
  reasons.value.map((r) => {
    const count = usage.value[r.id] ?? 0
    return {
      id: r.id,
      sequence: r.sequence,
      name: r.name,
      description: r.description ?? '—',
      usage_display: String(count),
      share: totalLost.value > 0 ? Math.round((count / totalLost.value) * 100) : 0
    }
  })
)

const loadData = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) { reasons.value = []; usage.value = {}; return }

  isLoading.value = true
  try {
    const [list, stats] = await Promise.all([
      getLostReasonsByCompany(companyId),
      getLostReasonUsage(companyId)
    ])
    reasons.value = list
    usage.value = stats
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void loadData() }, { immediate: true })

const handleSeed = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isSeeding.value = true
  try {
    await seedDefaultLostReasons(companyId)
    await loadData()
  } finally {
    isSeeding.value = false
  }
}

const create = () => navigateTo('/admin/crm/lost-reasons/create')
const edit = (row: Record<string, unknown>) => navigateTo(`/admin/crm/lost-reasons/${row.id as string}`)
const remove = async (row: Record<string, unknown>) => {
  const ok = await archiveLostReason(row.id as string, selectedCompanyId.value ?? '')
  if (ok) await loadData()
}
const deleteMany = async (selected: Record<string, unknown>[]) => {
  for (const row of selected) await archiveLostReason(row.id as string, selectedCompanyId.value ?? '')
  await loadData()
}
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para gestionar sus motivos de pérdida.</p>
    </div>

    <template v-else>
      <!-- Resumen de motivos más frecuentes -->
      <section
        v-if="!isLoading && topReasons.length > 0"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-base font-semibold text-slate-800">¿Por qué perdemos oportunidades?</h2>
          <p class="text-sm text-slate-500">{{ totalLost }} leads perdidos con motivo registrado</p>
        </div>
        <ul class="mt-4 space-y-3">
          <li v-for="reason in topReasons" :key="reason.id" class="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3">
            <span class="truncate text-sm font-medium text-slate-700">{{ reason.name }}</span>
            <span class="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <span
                class="block h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500"
                :style="{ width: `${Math.max(4, Math.round((reason.count / totalLost) * 100))}%` }"
              />
            </span>
            <span class="w-16 text-right text-sm tabular-nums text-slate-500">
              {{ reason.count }} · {{ Math.round((reason.count / totalLost) * 100) }}%
            </span>
          </li>
        </ul>
      </section>

      <div
        v-if="isLoading"
        class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
      >
        Cargando motivos…
      </div>

      <Datatable
        v-else
        title="Motivos de pérdida"
        description="Catálogo de razones por las que se cierra una oportunidad como perdida"
        :data="tableRows"
        :columns="columns"
        :search-keys="['name', 'description']"
        :selectable="true"
        :creatable="true"
        create-label="Nuevo motivo"
        empty-title="Sin motivos configurados"
        empty-message="Crea tus motivos o carga el catálogo sugerido para empezar a medir por qué se pierden las oportunidades."
        @create="create"
      >
        <template #headerActions>
          <button
            type="button"
            :disabled="isSeeding"
            class="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60"
            @click="handleSeed"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ isSeeding ? 'Cargando…' : 'Cargar motivos sugeridos' }}
          </button>
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
