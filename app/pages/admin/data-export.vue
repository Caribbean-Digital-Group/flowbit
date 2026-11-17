<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  DATA_EXPORT_GROUP_LABELS,
  selectExportEntities,
  type DataExportEntity,
  type DataExportGroup
} from '~/utils/dataExport'

definePageMeta({ layout: 'admin' })

/**
 * Exportar todos los datos de la empresa: un ZIP con un CSV por entidad y un
 * `LEEME.txt`. Solo owner/admin; los datos privados de empleados y nómina se
 * incluyen únicamente con confirmación explícita.
 */
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { isExporting, progress, lastResults, exportCompanyData } = useCompanyDataExport()

const includeSensitive = ref(false)
const errorMessage = ref<string | null>(null)

const companyName = computed(() =>
  selectedCompany.value?.display_name || selectedCompany.value?.name || 'empresa'
)

const groupedEntities = computed(() => {
  const groups = new Map<DataExportGroup, DataExportEntity[]>()
  for (const entity of selectExportEntities(true)) {
    const list = groups.get(entity.group) ?? []
    list.push(entity)
    groups.set(entity.group, list)
  }
  return Array.from(groups.entries()).map(([group, entities]) => ({
    group,
    label: DATA_EXPORT_GROUP_LABELS[group],
    entities
  }))
})

const progressPercent = computed(() =>
  progress.value.total > 0 ? Math.round((progress.value.done / progress.value.total) * 100) : 0
)

const failedResults = computed(() => lastResults.value.filter(result => result.error))
const truncatedResults = computed(() => lastResults.value.filter(result => result.truncated))
const exportedRows = computed(() =>
  lastResults.value.reduce((sum, result) => sum + (result.error ? 0 : result.rows), 0)
)

const handleExport = async () => {
  if (!selectedCompanyId.value) return
  errorMessage.value = null
  const results = await exportCompanyData({
    companyId: selectedCompanyId.value,
    companyName: companyName.value,
    includeSensitive: includeSensitive.value
  })
  if (!results) errorMessage.value = 'No se pudo generar el archivo. Intenta de nuevo.'
}

const formatNumber = (value: number) => new Intl.NumberFormat('es-MX').format(value)
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <NuxtLink to="/admin/settings" class="text-sm text-slate-500 hover:text-indigo-600">
          ← Configuración de empresa
        </NuxtLink>
        <h1 class="mt-1 text-2xl font-bold text-slate-900">Exportar datos de la empresa</h1>
        <p class="mt-1 text-sm text-slate-500">
          Descarga un ZIP con todos los datos de {{ companyName }}: un archivo CSV por tabla y una guía para leerlos.
          Útil para respaldos, auditorías o para llevarte tu información a otra herramienta.
        </p>
      </div>
    </div>

    <!-- Sin permisos -->
    <div
      v-if="!isSelectedCompanyAdmin"
      class="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm"
    >
      <svg class="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0-8v2m-7 8h14a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.27 16a2 2 0 001.73 3z" />
      </svg>
      Solo el propietario o un administrador de la empresa puede exportar todos los datos.
    </div>

    <template v-else>
      <div class="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-6 sm:p-8 space-y-6">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="group in groupedEntities" :key="group.group" class="rounded-xl border border-slate-200 p-4">
            <h2 class="text-sm font-semibold text-slate-800">{{ group.label }}</h2>
            <ul class="mt-2 space-y-1">
              <li
                v-for="entity in group.entities"
                :key="entity.file"
                class="text-xs"
                :class="entity.sensitive && !includeSensitive ? 'text-slate-400 line-through' : 'text-slate-600'"
              >
                {{ entity.label }}
              </li>
            </ul>
          </div>
        </div>

        <label class="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
          <input
            v-model="includeSensitive"
            type="checkbox"
            class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            :disabled="isExporting"
          >
          <span class="text-sm text-slate-700">
            <span class="font-medium text-slate-800">Incluir datos privados de empleados y nómina</span>
            <span class="block text-slate-500">
              CURP, NSS, RFC, cuentas bancarias, salarios y recibos. Guarda el archivo en un lugar seguro y no lo
              compartas por correo o chat.
            </span>
          </span>
        </label>

        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 disabled:opacity-50"
            :disabled="isExporting || !selectedCompanyId"
            @click="handleExport"
          >
            <svg v-if="isExporting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ isExporting ? 'Generando ZIP…' : 'Descargar ZIP' }}
          </button>

          <div v-if="isExporting" class="flex-1">
            <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full bg-indigo-500 transition-all duration-300" :style="{ width: `${progressPercent}%` }" />
            </div>
            <p class="mt-1 text-xs text-slate-500">
              {{ progress.done }} de {{ progress.total }} · {{ progress.current }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="lastResults.length && !isExporting"
        class="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-6 space-y-3"
      >
        <p class="text-sm text-slate-700">
          <span class="font-semibold text-emerald-700">Descarga lista.</span>
          {{ formatNumber(exportedRows) }} filas en {{ lastResults.length - failedResults.length }} archivos.
          El detalle de cada archivo está en <code class="text-xs bg-slate-100 px-1 rounded">LEEME.txt</code> dentro del ZIP.
        </p>
        <ul v-if="failedResults.length" class="text-sm text-amber-800 space-y-1">
          <li v-for="result in failedResults" :key="result.entity.file">
            No se exportó «{{ result.entity.label }}»: {{ result.error }}
          </li>
        </ul>
        <ul v-if="truncatedResults.length" class="text-sm text-amber-800 space-y-1">
          <li v-for="result in truncatedResults" :key="result.entity.file">
            «{{ result.entity.label }}» llegó al tope de filas por archivo y puede estar incompleto.
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
