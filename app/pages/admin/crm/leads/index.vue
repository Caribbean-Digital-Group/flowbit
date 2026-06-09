<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
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
const { getLeadsByCompany, archiveLead } = useCrmLead()

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

// ── Pipeline stat cards ────────────────────────────────────────────────────────

type StatAccent = 'violet' | 'indigo' | 'emerald' | 'amber' | 'rose'

interface LeadStat {
  key: string
  label: string
  value: string
  sublabel: string
  iconPath: string
  accent: StatAccent
}

const accentStyles: Record<StatAccent, { icon: string; blob: string }> = {
  violet: { icon: 'bg-violet-50 text-violet-600', blob: 'bg-violet-400' },
  indigo: { icon: 'bg-indigo-50 text-indigo-600', blob: 'bg-indigo-400' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', blob: 'bg-emerald-400' },
  amber: { icon: 'bg-amber-50 text-amber-600', blob: 'bg-amber-400' },
  rose: { icon: 'bg-rose-50 text-rose-600', blob: 'bg-rose-400' }
}

const ICONS = {
  funnel: 'M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z',
  chart: 'M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605',
  trophy: 'M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0',
  bell: 'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0'
} as const

const pipelineMetrics = computed(() => {
  let total = 0
  let open = 0
  let won = 0
  let lost = 0
  let openAmount = 0
  let wonAmount = 0
  let weightedPipeline = 0
  let openActivities = 0
  let overdueActivities = 0

  for (const lead of leadsRaw.value) {
    total += 1
    const amount = Number(lead.amount ?? 0)

    if (lead.is_won) {
      won += 1
      wonAmount += amount
    } else if (lead.is_lost) {
      lost += 1
    } else {
      open += 1
      openAmount += amount
      weightedPipeline += amount * (Number(lead.probability ?? 0) / 100)
      openActivities += Number(lead.open_activity_count ?? 0)
      overdueActivities += Number(lead.overdue_activity_count ?? 0)
    }
  }

  const closed = won + lost
  const conversionRate = closed > 0 ? Math.round((won / closed) * 100) : 0

  return {
    total,
    open,
    won,
    lost,
    openAmount,
    wonAmount,
    weightedPipeline,
    conversionRate,
    openActivities,
    overdueActivities
  }
})

const leadStats = computed<LeadStat[]>(() => {
  const m = pipelineMetrics.value
  return [
    {
      key: 'pipeline',
      label: 'Pipeline abierto',
      value: formatCurrency(m.openAmount),
      sublabel: `${m.open} abiertos · ${m.total} leads totales`,
      iconPath: ICONS.funnel,
      accent: 'violet'
    },
    {
      key: 'forecast',
      label: 'Pronóstico ponderado',
      value: formatCurrency(Math.round(m.weightedPipeline)),
      sublabel: 'Estimado según probabilidad de cierre',
      iconPath: ICONS.chart,
      accent: 'indigo'
    },
    {
      key: 'conversion',
      label: 'Tasa de conversión',
      value: `${m.conversionRate}%`,
      sublabel: `${m.won} ganados · ${m.lost} perdidos · ${formatCurrency(m.wonAmount)}`,
      iconPath: ICONS.trophy,
      accent: 'emerald'
    },
    {
      key: 'activities',
      label: 'Actividades por atender',
      value: String(m.openActivities),
      sublabel: m.overdueActivities > 0
        ? `${m.overdueActivities} atrasadas requieren acción`
        : 'Sin actividades atrasadas',
      iconPath: ICONS.bell,
      accent: m.overdueActivities > 0 ? 'rose' : 'amber'
    }
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
      <!-- Stat cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="isLoading">
          <div
            v-for="i in 4"
            :key="`lead-stat-skeleton-${i}`"
            class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 space-y-3">
                <div class="h-3 w-24 rounded bg-slate-200" />
                <div class="h-7 w-32 rounded bg-slate-200" />
              </div>
              <div class="h-11 w-11 rounded-xl bg-slate-200" />
            </div>
            <div class="mt-4 h-3 w-28 rounded bg-slate-200" />
          </div>
        </template>

        <template v-else>
          <div
            v-for="stat in leadStats"
            :key="stat.key"
            class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"
          >
            <div
              :class="[
                'pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]',
                accentStyles[stat.accent].blob
              ]"
            />

            <div class="relative flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-500">{{ stat.label }}</p>
                <p class="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">
                  {{ stat.value }}
                </p>
              </div>
              <span
                :class="[
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  accentStyles[stat.accent].icon
                ]"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="stat.iconPath" />
                </svg>
              </span>
            </div>

            <p class="relative mt-3 truncate text-xs text-slate-500">{{ stat.sublabel }}</p>
          </div>
        </template>
      </div>

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
