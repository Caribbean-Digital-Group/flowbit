<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { StatItem } from '~/components/StatGrid.vue'
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

type CrmLeadView = Database['public']['Views']['v_crm_leads']['Row']
type CrmLeadPriority = Database['public']['Enums']['crm_lead_priority']

const priorityLabels: Record<CrmLeadPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta'
}

const columns: Column[] = [
  { key: 'name', label: 'Lead / Oportunidad', type: 'avatar', subtitleKey: 'lead_code' },
  { key: 'stage_name', label: 'Etapa', type: 'text' },
  { key: 'contact_display', label: 'Contacto', type: 'text' },
  { key: 'responsible_display', label: 'Responsable', type: 'text' },
  { key: 'priority', label: 'Prioridad', type: 'badge', badgeConfig: { labels: priorityLabels } },
  { key: 'amount_display', label: 'Importe', type: 'text' },
  { key: 'expected_close_date', label: 'Cierre esperado', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getLeadsByCompany, archiveLead, computeMetrics } = useCrmLead()

const isLoading = ref(false)
const leadsRaw = ref<CrmLeadView[]>([])
const selectedPriorityFilters = ref<CrmLeadPriority[]>([])
const showOnlyOpen = ref(false)

const formatCurrency = (value: number, currency: string = 'MXN'): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN', maximumFractionDigits: 0 }).format(value || 0)

const mapToRow = (raw: CrmLeadView): Record<string, unknown> => ({
  id: raw.id,
  name: raw.name ?? '—',
  lead_code: `#${raw.lead_number ?? '—'}`,
  stage_name: raw.stage_name ?? '—',
  contact_display: raw.partner_display_name?.trim() || raw.contact_name?.trim() || raw.contact_company?.trim() || '—',
  responsible_display: raw.responsible_display_name?.trim() || '—',
  priority: raw.priority ?? 'medium',
  amount_display: raw.amount != null ? formatCurrency(Number(raw.amount), raw.currency ?? 'MXN') : '—',
  expected_close_date: raw.expected_close_date ?? '',
  is_won: raw.is_won ?? false,
  is_lost: raw.is_lost ?? false,
  order_count: raw.order_count ?? 0,
  open_activity_count: raw.open_activity_count ?? 0
})

const filteredLeads = computed(() => {
  return leadsRaw.value.filter((l) => {
    if (selectedPriorityFilters.value.length > 0
      && !selectedPriorityFilters.value.includes((l.priority ?? 'medium') as CrmLeadPriority)) {
      return false
    }
    if (showOnlyOpen.value && (l.is_won || l.is_lost)) return false
    return true
  })
})

const filteredRows = computed(() => filteredLeads.value.map(mapToRow))

const metrics = computed(() => computeMetrics(leadsRaw.value))

const stats = computed<StatItem[]>(() => {
  const m = metrics.value
  return [
    { label: 'Leads totales', value: String(m.total), change: `${m.open} abiertos`, trend: 'neutral' },
    { label: 'Ganados', value: String(m.won), change: m.won > 0 ? `${Math.round((m.won / m.total) * 100)}% conversión` : '—', trend: m.won > 0 ? 'up' : 'neutral' },
    { label: 'Cancelados', value: String(m.lost), change: m.lost > 0 ? `${Math.round((m.lost / m.total) * 100)}% pérdida` : '—', trend: m.lost > 0 ? 'down' : 'neutral' },
    { label: 'Valor total', value: formatCurrency(m.totalAmount), change: `Ganado: ${formatCurrency(m.wonAmount)}`, trend: 'neutral' }
  ]
})

const loadLeads = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) { leadsRaw.value = []; return }
  isLoading.value = true
  try {
    leadsRaw.value = await getLeadsByCompany(companyId)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => { void loadLeads() }, { immediate: true })

const togglePriorityFilter = (value: CrmLeadPriority) => {
  selectedPriorityFilters.value = selectedPriorityFilters.value.includes(value)
    ? selectedPriorityFilters.value.filter(v => v !== value)
    : [...selectedPriorityFilters.value, value]
}

const resetFilters = () => {
  selectedPriorityFilters.value = []
  showOnlyOpen.value = false
}

const filtersLabel = computed(() => {
  const p = selectedPriorityFilters.value.length
  return `${p} prioridad(es)${showOnlyOpen.value ? ' · solo abiertos' : ''}`
})

const create = () => navigateTo('/admin/crm/leads/create')
const edit = (row: Record<string, unknown>) => navigateTo(`/admin/crm/leads/${row.id as string}`)
const remove = async (row: Record<string, unknown>) => {
  const ok = await archiveLead(row.id as string)
  if (ok) await loadLeads()
}
const deleteMany = async (selected: Record<string, unknown>[]) => {
  for (const row of selected) await archiveLead(row.id as string)
  await loadLeads()
}
</script>

<template>
  <div class="w-full py-4 space-y-6">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">Sin empresa seleccionada</p>
      <p class="mt-1 text-sm text-amber-800/90">Elige una empresa para gestionar sus leads y oportunidades.</p>
    </div>

    <template v-else>
      <StatGrid :stats="stats" :loading="isLoading" :columns="4" />

      <div
        v-if="isLoading"
        class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
      >
        Cargando leads…
      </div>

      <Datatable
        v-else
        title="Leads y Oportunidades"
        description="Gestión del pipeline de ventas y seguimiento de prospectos"
        :data="filteredRows"
        :columns="columns"
        :search-keys="['name', 'lead_code', 'contact_display', 'responsible_display', 'stage_name']"
        :selectable="true"
        :exportable="true"
        :creatable="true"
        create-label="Nuevo lead"
        export-filename="leads"
        empty-title="Sin leads registrados"
        empty-message="Aún no hay leads para esta empresa. Crea el primero para comenzar el seguimiento del pipeline."
        @create="create"
      >
        <template #headerActions>
          <div class="flex w-full items-center justify-center sm:w-auto sm:justify-end">
            <details class="relative w-full sm:w-auto">
              <summary class="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-w-48">
                <span>Filtros: {{ filtersLabel }}</span>
                <svg class="ml-2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div class="absolute right-0 z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:w-64">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridad</p>
                  <div class="mt-2 space-y-2">
                    <label
                      v-for="(label, key) in priorityLabels"
                      :key="key"
                      class="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedPriorityFilters.includes(key as CrmLeadPriority)"
                        class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        @change="togglePriorityFilter(key as CrmLeadPriority)"
                      >
                      {{ label }}
                    </label>
                  </div>
                </div>
                <div class="mt-4 border-t border-slate-100 pt-4">
                  <label class="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      v-model="showOnlyOpen"
                      type="checkbox"
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    >
                    Solo leads abiertos (sin cerrar)
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
