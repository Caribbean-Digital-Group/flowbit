<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { EmployeeViewRow } from '~/types/employee.types'
import type { HrKioskRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getAll, create, regenerateToken, archive, setPin, getEmployeesWithPin, kioskUrl, lastError } = useKiosk()
const { getAll: getEmployees } = useEmployee()
const { get: getSettings } = useHrSettings()

const kiosks = ref<HrKioskRow[]>([])
const employees = ref<EmployeeViewRow[]>([])
const withPin = ref<Set<string>>(new Set())
const pinMinLength = ref(4)
const isLoading = ref(false)
const message = ref<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null)
const newKiosk = ref({ name: '', location: '' })
/** URL recién generada: solo se muestra una vez. */
const revealedUrl = ref<{ name: string; url: string } | null>(null)
const pinEditor = ref<{ employeeId: string; name: string; pin: string } | null>(null)

const kioskColumns: Column[] = [
  { key: 'name', label: 'Kiosco', type: 'text' },
  { key: 'location', label: 'Ubicación', type: 'text' },
  { key: 'last_used_at', label: 'Último uso', type: 'date' }
]

const pinColumns: Column[] = [
  { key: 'name', label: 'Empleado', type: 'avatar', avatarKey: 'avatar_url', subtitleKey: 'job_title' },
  { key: 'number', label: 'Número', type: 'text' },
  {
    key: 'pin',
    label: 'NIP',
    type: 'badge',
    badgeConfig: { labels: { yes: 'Asignado', no: 'Sin NIP' }, colors: { yes: 'bg-emerald-100 text-emerald-700', no: 'bg-slate-100 text-slate-600' } }
  }
]

const kioskRows = computed(() => kiosks.value.map(k => ({
  id: k.id,
  name: k.name,
  location: k.location ?? '—',
  last_used_at: k.last_used_at ?? ''
})))

const pinRows = computed(() => employees.value
  .filter(e => e.status === 'active')
  .map(e => ({
    id: e.id,
    name: e.partner_name ?? '—',
    avatar_url: e.partner_avatar_url ?? '',
    job_title: e.job_title ?? '',
    number: e.employee_number ?? '—',
    pin: withPin.value.has(e.id) ? 'yes' : 'no'
  })))

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !isSelectedCompanyAdmin.value) return
  isLoading.value = true
  try {
    const [k, e, p, s] = await Promise.all([
      getAll(companyId),
      getEmployees(companyId),
      getEmployeesWithPin(companyId),
      getSettings(companyId)
    ])
    kiosks.value = k
    employees.value = e
    withPin.value = p
    if (s) pinMinLength.value = s.kiosk_pin_min_length
  } finally {
    isLoading.value = false
  }
}

const handleCreate = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  if (!newKiosk.value.name.trim()) {
    message.value = { kind: 'error', text: 'Indica el nombre del kiosco.' }
    return
  }
  const result = await create(companyId, newKiosk.value.name.trim(), trimToNull(newKiosk.value.location))
  if (!result) {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo crear.' }
    return
  }
  revealedUrl.value = { name: newKiosk.value.name.trim(), url: kioskUrl(result.token) }
  newKiosk.value = { name: '', location: '' }
  message.value = null
  await load()
}

const handleRegenerate = async (row: Record<string, unknown>) => {
  const result = await regenerateToken(row.id as string)
  if (!result) {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo regenerar.' }
    return
  }
  revealedUrl.value = { name: row.name as string, url: kioskUrl(result.token) }
  message.value = { kind: 'info', text: 'La dirección anterior dejó de funcionar. Abre la nueva en el dispositivo del kiosco.' }
}

const handleArchive = async (row: Record<string, unknown>) => {
  if (await archive(row.id as string)) await load()
  else message.value = { kind: 'error', text: lastError.value ?? 'No se pudo desactivar.' }
}

const copyUrl = async () => {
  if (!revealedUrl.value) return
  try {
    await navigator.clipboard.writeText(revealedUrl.value.url)
    message.value = { kind: 'success', text: 'Dirección copiada.' }
  } catch (error) {
    console.error('Error copying kiosk URL:', error)
  }
}

const savePin = async () => {
  const editor = pinEditor.value
  if (!editor) return
  const validation = validatePin(editor.pin, pinMinLength.value)
  if (validation) {
    message.value = { kind: 'error', text: validation }
    return
  }
  if (await setPin(editor.employeeId, editor.pin)) {
    message.value = { kind: 'success', text: `NIP de ${editor.name} guardado. Compártelo solo con esa persona.` }
    pinEditor.value = null
    await load()
  } else {
    message.value = { kind: 'error', text: lastError.value ?? 'No se pudo guardar el NIP.' }
  }
}

const removePin = async (row: Record<string, unknown>) => {
  if (await setPin(row.id as string, '')) await load()
  else message.value = { kind: 'error', text: lastError.value ?? 'No se pudo quitar el NIP.' }
}

watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <HrNotice v-else-if="!isSelectedCompanyAdmin" kind="admin-only" />
    <template v-else>
      <HrNotice v-if="message" :kind="message.kind" :message="message.text" class="mb-4" />

      <div
        v-if="revealedUrl"
        class="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <p class="font-semibold text-emerald-900">
          Dirección del kiosco «{{ revealedUrl.name }}»
        </p>
        <p class="mt-1 text-sm text-emerald-800">
          Ábrela en la tableta o computadora de la entrada. Por seguridad no se vuelve a mostrar: si la pierdes, regenera la dirección.
        </p>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code class="flex-1 break-all rounded-xl bg-white px-4 py-2 text-sm text-slate-800">{{ revealedUrl.url }}</code>
          <div class="flex gap-2">
            <BtnApp variant="primary" size="sm" @click="copyUrl">
              Copiar
            </BtnApp>
            <BtnApp variant="ghost" size="sm" @click="revealedUrl = null">
              Listo
            </BtnApp>
          </div>
        </div>
      </div>

      <div class="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormInput v-model="newKiosk.name" label="Nuevo kiosco" placeholder="Ej: Recepción" size="md" />
        <FormInput v-model="newKiosk.location" label="Ubicación" placeholder="Ej: Planta baja" size="md" />
        <BtnApp variant="primary" size="md" @click="handleCreate">
          Crear kiosco
        </BtnApp>
      </div>

      <HrNotice v-if="isLoading" kind="loading" message="Cargando kioscos…" />
      <template v-else>
        <Datatable
          title="Kioscos"
          description="Pantallas públicas donde el equipo marca entrada y salida con su NIP. Tras 5 NIP incorrectos el kiosco se bloquea 5 minutos."
          :data="kioskRows"
          :columns="kioskColumns"
          :paginated="false"
          :exportable="false"
          empty-title="Sin kioscos"
          empty-message="Crea un kiosco para empezar a registrar asistencia."
          class="mb-8"
        >
          <template #actions="{ row }">
            <div class="flex justify-center gap-1">
              <BtnApp variant="ghost" size="sm" @click="handleRegenerate(row)">
                Nueva dirección
              </BtnApp>
              <BtnApp variant="ghost" size="sm" @click="handleArchive(row)">
                Desactivar
              </BtnApp>
            </div>
          </template>
        </Datatable>

        <div
          v-if="pinEditor"
          class="mb-6 rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-slate-200/50"
        >
          <h3 class="mb-4 font-semibold text-slate-800">
            NIP de {{ pinEditor.name }}
          </h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <FormInput
              v-model="pinEditor.pin"
              type="password"
              label="NIP"
              :hint="`Entre ${pinMinLength} y 8 dígitos, distinto al de los demás.`"
              autocomplete="new-password"
              :maxlength="8"
              size="md"
            />
            <div class="flex gap-2">
              <BtnApp variant="ghost" size="md" @click="pinEditor = null">
                Cancelar
              </BtnApp>
              <BtnApp variant="primary" size="md" @click="savePin">
                Guardar NIP
              </BtnApp>
            </div>
          </div>
        </div>

        <Datatable
          title="NIP del equipo"
          description="El NIP se guarda cifrado: nadie puede consultarlo, solo cambiarlo."
          :data="pinRows"
          :columns="pinColumns"
          :search-keys="['name', 'number']"
          :exportable="false"
          empty-title="Sin empleados"
          empty-message="Registra empleados para asignarles un NIP."
        >
          <template #actions="{ row }">
            <div class="flex justify-center gap-1">
              <BtnApp variant="ghost" size="sm" @click="pinEditor = { employeeId: row.id, name: row.name, pin: '' }">
                {{ row.pin === 'yes' ? 'Cambiar' : 'Asignar' }}
              </BtnApp>
              <BtnApp v-if="row.pin === 'yes'" variant="ghost" size="sm" @click="removePin(row)">
                Quitar
              </BtnApp>
            </div>
          </template>
        </Datatable>
      </template>
    </template>
  </div>
</template>
