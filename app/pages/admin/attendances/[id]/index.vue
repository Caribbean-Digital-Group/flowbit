<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { HrAttendanceViewRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getAttendance, update, archive, lastError } = useAttendance()

const attendance = ref<HrAttendanceViewRow | null>(null)
const form = ref({ check_in: '', check_out: '', notes: '' })
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const attendanceId = computed(() => String(route.params.id ?? ''))

const menuOptions = computed<MenuOption[]>(() => [{
  id: 'archive',
  label: 'Anular marca',
  icon: 'M6 18L18 6M6 6l12 12',
  action: () => void handleArchive(),
  variant: 'danger'
}])

const fillForm = (row: HrAttendanceViewRow) => {
  form.value = {
    check_in: isoToLocalDateTime(row.check_in),
    check_out: row.missing_check_out ? '' : isoToLocalDateTime(row.check_out),
    notes: row.notes ?? ''
  }
}

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !attendanceId.value) return
  isLoading.value = true
  try {
    attendance.value = await getAttendance(attendanceId.value, companyId)
    if (attendance.value) fillForm(attendance.value)
    else errorMessage.value = 'No se encontró la marca.'
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  const checkIn = localDateTimeToIso(form.value.check_in)
  if (!checkIn) {
    errorMessage.value = 'La hora de entrada no es válida.'
    return
  }
  isLoading.value = true
  try {
    const checkOut = localDateTimeToIso(form.value.check_out)
    const saved = await update(attendanceId.value, {
      check_in: checkIn,
      check_out: checkOut,
      missing_check_out: false,
      notes: trimToNull(form.value.notes)
    })
    if (!saved) {
      errorMessage.value = lastError.value
      return
    }
    errorMessage.value = null
    isEditing.value = false
    await load()
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  if (await archive(attendanceId.value)) router.push('/admin/attendances')
  else errorMessage.value = lastError.value
}

watch([attendanceId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <CardSheet
    :title="attendance?.employee_name || 'Marca'"
    :subtitle="attendance ? formatHrDate(attendance.work_date) : ''"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-edit-button="isSelectedCompanyAdmin"
    :show-options-button="isSelectedCompanyAdmin"
    :created-by="attendance?.created_by ?? '—'"
    :created-at="attendance?.created_at ?? ''"
    :updated-by="attendance?.updated_by ?? '—'"
    :updated-at="attendance?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="router.push('/admin/attendances')"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="() => { if (attendance) fillForm(attendance); isEditing = false }"
  >
    <template v-if="attendance" #status>
      <BadgeApp :label="attendance.source === 'kiosk' ? 'Kiosco' : 'Manual'" :variant="attendance.source === 'kiosk' ? 'primary' : 'secondary'" />
    </template>
    <HrNotice v-if="errorMessage" kind="error" :message="errorMessage" class="mb-6" />
    <HrNotice
      v-if="attendance?.missing_check_out"
      kind="info"
      message="Esta entrada se cerró sin salida porque la persona volvió a marcar más de 20 horas después. Captura la hora real de salida."
      class="mb-6"
    />
    <div v-if="attendance" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormInput v-model="form.check_in" type="datetime-local" label="Entrada" :readonly="!isEditing" size="md" />
      <FormInput v-model="form.check_out" type="datetime-local" label="Salida" :readonly="!isEditing" size="md" />
      <FormInput :model-value="formatMinutes(attendance.worked_minutes)" label="Duración" readonly size="md" />
      <FormInput :model-value="attendance.kiosk_name ?? '—'" label="Kiosco" readonly size="md" />
      <div class="sm:col-span-2">
        <FormTextArea v-model="form.notes" label="Notas" :rows="2" :readonly="!isEditing" size="md" />
      </div>
    </div>
  </CardSheet>
</template>
