<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

const columns: Column[] = [
  { key: 'holiday_date', label: 'Fecha', type: 'date' },
  { key: 'weekday', label: 'Día', type: 'text' },
  { key: 'name', label: 'Nombre', type: 'text' },
  {
    key: 'kind',
    label: 'Tipo',
    type: 'badge',
    badgeConfig: {
      labels: { statutory: 'Obligatorio (LFT)', company: 'De la empresa' },
      colors: { statutory: 'bg-indigo-100 text-indigo-700', company: 'bg-slate-100 text-slate-600' }
    }
  }
]

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getHolidays, createHoliday, archiveHoliday, loadStatutoryHolidays, lastError } = useHrSettings()

const year = ref(new Date().getFullYear())
const rows = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)
const newHoliday = ref({ holiday_date: '', name: '' })
const message = ref<{ kind: 'error' | 'success'; text: string } | null>(null)

const yearOptions = computed(() => {
  const current = new Date().getFullYear()
  return [current - 1, current, current + 1].map(y => ({ value: y, label: String(y) }))
})

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    rows.value = (await getHolidays(companyId, year.value)).map(h => ({
      id: h.id,
      holiday_date: h.holiday_date,
      weekday: WEEKDAY_LABELS[new Date(`${h.holiday_date}T00:00:00Z`).getUTCDay()],
      name: h.name,
      kind: h.is_statutory ? 'statutory' : 'company'
    }))
  } finally {
    isLoading.value = false
  }
}

const handleLoadStatutory = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const added = await loadStatutoryHolidays(companyId, year.value)
  message.value = lastError.value
    ? { kind: 'error', text: lastError.value }
    : { kind: 'success', text: added ? `Se agregaron ${added} días de descanso obligatorio.` : 'Ya estaban cargados todos los días de ley del año.' }
  await load()
}

const handleAdd = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  if (!newHoliday.value.holiday_date || !newHoliday.value.name.trim()) {
    message.value = { kind: 'error', text: 'Indica la fecha y el nombre del día festivo.' }
    return
  }
  const created = await createHoliday({
    company_id: companyId,
    holiday_date: newHoliday.value.holiday_date,
    name: newHoliday.value.name.trim()
  })
  if (!created) {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo agregar.' }
    return
  }
  message.value = null
  newHoliday.value = { holiday_date: '', name: '' }
  if (created.holiday_date.startsWith(String(year.value))) await load()
}

const handleRemove = async (row: Record<string, unknown>) => {
  if (await archiveHoliday(row.id as string)) await load()
  else message.value = { kind: 'error', text: lastError.value ?? 'No se pudo quitar.' }
}

watch([selectedCompanyId, year], load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <template v-else>
      <HrNotice v-if="message" :kind="message.kind" :message="message.text" class="mb-4" />

      <div
        v-if="isSelectedCompanyAdmin"
        class="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50 sm:grid-cols-2 lg:grid-cols-[10rem_1fr_1fr_auto] lg:items-end"
      >
        <FormSelect v-model="year" label="Año" :options="yearOptions" size="md" />
        <FormInput v-model="newHoliday.holiday_date" type="date" label="Fecha" size="md" />
        <FormInput v-model="newHoliday.name" label="Nombre" placeholder="Ej: Aniversario de la empresa" size="md" />
        <div class="flex flex-wrap gap-2">
          <BtnApp variant="primary" size="md" @click="handleAdd">
            Agregar
          </BtnApp>
          <BtnApp variant="secondary" size="md" @click="handleLoadStatutory">
            Cargar días de ley {{ year }}
          </BtnApp>
        </div>
      </div>

      <HrNotice v-if="isLoading" kind="loading" message="Cargando días festivos…" />
      <Datatable
        v-else
        title="Días festivos"
        description="No generan inasistencias ni cuentan como días de vacaciones. Trabajar un día de descanso obligatorio se paga doble además del sueldo (art. 75 LFT)."
        :data="rows"
        :columns="columns"
        :search-keys="['name']"
        export-filename="dias-festivos"
        empty-title="Sin días festivos"
        empty-message="Carga los días de descanso obligatorio del año con un clic."
      >
        <template v-if="isSelectedCompanyAdmin" #actions="{ row }">
          <div class="flex justify-center">
            <BtnApp variant="ghost" size="sm" @click="handleRemove(row)">
              Quitar
            </BtnApp>
          </div>
        </template>
      </Datatable>
    </template>
  </div>
</template>
