<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type {
  ApprovalCategoryRow,
  ApprovalDelegationRow,
  ApprovalEscalationAction,
  ApprovalRejectionReasonRow,
  ApprovalSettingsRow
} from '~/types/approval.types'
import { APPROVAL_ESCALATION_LABELS, downloadText, formatDateMx } from '~/utils/approvals'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId, partner, companies } = storeToRefs(authStore)
const settingsApi = useApprovalSettings()
const { getCategoriesByCompany } = useApprovalCategory()
const people = useApprovalPeople()

const settings = ref<ApprovalSettingsRow | null>(null)
const reasons = ref<ApprovalRejectionReasonRow[]>([])
const delegations = ref<ApprovalDelegationRow[]>([])
// shallowRef: la lista se reemplaza completa y evita el desempaquetado profundo del tipo de fila
const categories = shallowRef<ApprovalCategoryRow[]>([])
const newReason = ref('')
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const delegationForm = ref({ from: '', to: '', category: '', starts: '', ends: '', reason: '' })

const isWorkspaceAdmin = computed(() => {
  const r = companies.value.find(c => c.company.id === selectedCompanyId.value)?.role
  return r === 'owner' || r === 'admin'
})

const escalationOptions = (Object.keys(APPROVAL_ESCALATION_LABELS) as ApprovalEscalationAction[])
  .map(value => ({ value, label: APPROVAL_ESCALATION_LABELS[value] }))

const categoryOptions = computed(() => categories.value.map(c => ({ value: c.id, label: c.name })))
const visibleDelegations = computed(() =>
  isWorkspaceAdmin.value ? delegations.value : delegations.value.filter(d => d.from_partner_id === partner.value?.id))

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const [s, r, d, c] = await Promise.all([
    settingsApi.getSettings(cid),
    settingsApi.getRejectionReasons(cid),
    settingsApi.getDelegations(cid),
    getCategoriesByCompany(cid),
    people.loadBase(cid)
  ])
  settings.value = s
  reasons.value = r
  delegations.value = d
  categories.value = c
  delegationForm.value.from = partner.value?.id ?? ''
}

watch(selectedCompanyId, load, { immediate: true })

const flash = (text: string): void => {
  message.value = text
  errorMessage.value = null
  setTimeout(() => { if (message.value === text) message.value = null }, 4000)
}

const saveSettings = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !settings.value) return
  busy.value = true
  try {
    const saved = await settingsApi.saveSettings(cid, settings.value)
    if (!saved) { errorMessage.value = settingsApi.lastError.value; return }
    settings.value = saved
    flash('Ajustes guardados.')
  } finally {
    busy.value = false
  }
}

const addReason = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !newReason.value.trim()) return
  const row = await settingsApi.addRejectionReason(cid, newReason.value)
  if (!row) { errorMessage.value = settingsApi.lastError.value; return }
  reasons.value = [...reasons.value, row].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  newReason.value = ''
}

const removeReason = async (id: string): Promise<void> => {
  if (await settingsApi.archiveRejectionReason(id)) reasons.value = reasons.value.filter(r => r.id !== id)
}

const addDelegation = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  const f = delegationForm.value
  if (!cid || !f.from || !f.to) { errorMessage.value = 'Elige al titular y al suplente.'; return }
  const row = await settingsApi.createDelegation({
    companyId: cid,
    fromPartnerId: f.from,
    toPartnerId: f.to,
    categoryId: f.category || null,
    startsOn: f.starts || null,
    endsOn: f.ends || null,
    reason: f.reason.trim() || null
  })
  if (!row) { errorMessage.value = settingsApi.lastError.value; return }
  delegations.value = [row, ...delegations.value]
  delegationForm.value = { from: partner.value?.id ?? '', to: '', category: '', starts: '', ends: '', reason: '' }
  flash('Delegación registrada. Las solicitudes nuevas se enrutan al suplente.')
}

const endDelegation = async (id: string): Promise<void> => {
  if (await settingsApi.endDelegation(id)) delegations.value = delegations.value.filter(d => d.id !== id)
}

const exportConfig = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const config = await settingsApi.exportConfig(cid)
  if (!config) { errorMessage.value = settingsApi.lastError.value; return }
  downloadText(`aprobaciones-configuracion-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(config, null, 2), 'application/json')
}

const importConfig = async (event: Event): Promise<void> => {
  const cid = selectedCompanyId.value
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!cid || !file) return
  try {
    const json: unknown = JSON.parse(await file.text())
    const report = await settingsApi.importConfig(cid, json)
    if (!report) { errorMessage.value = settingsApi.lastError.value; return }
    flash(`Importados: ${report.flows} flujos y ${report.categories} categorías.${report.skipped_approvers.length ? ` Se omitieron ${report.skipped_approvers.length} aprobadores que no existen en esta empresa.` : ''}`)
    await load()
  } catch {
    errorMessage.value = 'El archivo no es un JSON válido.'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

const loadDemo = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  busy.value = true
  try {
    const report = await settingsApi.loadDemo(cid)
    if (!report) { errorMessage.value = settingsApi.lastError.value; return }
    flash(`Ejemplos cargados: ${report.categories} categorías y ${report.flows} flujos. Asigna aprobadores a cada categoría.`)
    await load()
  } finally {
    busy.value = false
  }
}

const runSla = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const r = await settingsApi.runSlaNow(cid)
  if (!r) { errorMessage.value = settingsApi.lastError.value; return }
  flash(`Recordatorios: ${r.reminders ?? 0} · escaladas: ${r.escalated ?? 0} · resueltas por plazo: ${r.auto_resolved ?? 0} · expiradas: ${r.expired ?? 0} · borradores recurrentes: ${r.recurring_created ?? 0}`)
}

const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50'
const toggleRow = 'flex items-start gap-3 text-sm text-slate-700'
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Configuración de aprobaciones</h1>
      <p class="text-sm text-slate-500">Políticas del motor, plazos, delegaciones y herramientas.</p>
    </div>

    <p v-if="message" class="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{{ message }}</p>
    <p v-if="errorMessage" class="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{{ errorMessage }}</p>

    <!-- Delegación: disponible para cualquier aprobador -->
    <section :class="card">
      <h2 class="text-lg font-bold text-slate-800">Delegaciones y suplencias</h2>
      <p class="mb-4 text-sm text-slate-500">
        Durante el periodo, las solicitudes nuevas del titular van al suplente. Sin fechas, la delegación es permanente.
      </p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FormSelect
          v-model="delegationForm.from"
          label="Titular"
          :options="isWorkspaceAdmin ? people.approverOptions.value : people.approverOptions.value.filter(o => o.value === partner?.id)"
          searchable
          size="sm"
        />
        <FormSelect v-model="delegationForm.to" label="Suplente" :options="people.approverOptions.value.filter(o => o.value !== delegationForm.from)" searchable size="sm" />
        <FormSelect v-model="delegationForm.category" label="Categoría" :options="categoryOptions" placeholder="Todas" clearable size="sm" />
        <FormInput v-model="delegationForm.starts" label="Desde" type="date" size="sm" />
        <FormInput v-model="delegationForm.ends" label="Hasta" type="date" size="sm" />
        <FormInput v-model="delegationForm.reason" label="Motivo" placeholder="Vacaciones" size="sm" />
      </div>
      <div class="mt-3 flex justify-end">
        <BtnApp label="Registrar delegación" size="sm" @click="addDelegation" />
      </div>
      <ul class="mt-4 divide-y divide-slate-100">
        <li v-for="d in visibleDelegations" :key="d.id" class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span>
            <strong>{{ people.nameOf(d.from_partner_id) }}</strong> → <strong>{{ people.nameOf(d.to_partner_id) }}</strong>
            <span class="text-slate-500">
              · {{ categories.find(c => c.id === d.category_id)?.name ?? 'todas las categorías' }}
              · {{ d.starts_on || d.ends_on ? `${formatDateMx(d.starts_on)} – ${formatDateMx(d.ends_on)}` : 'permanente' }}
              <template v-if="d.reason"> · {{ d.reason }}</template>
            </span>
          </span>
          <button type="button" class="text-xs font-semibold text-red-600 hover:text-red-800" @click="endDelegation(d.id)">Terminar</button>
        </li>
        <li v-if="!visibleDelegations.length" class="py-2 text-sm text-slate-500">Sin delegaciones activas.</li>
      </ul>
    </section>

    <template v-if="isWorkspaceAdmin && settings">
      <section :class="card">
        <h2 class="mb-4 text-lg font-bold text-slate-800">Políticas</h2>
        <div class="space-y-3">
          <label :class="toggleRow">
            <input v-model="settings.advanced_enabled" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600">
            <span><strong>Funciones avanzadas.</strong> Flujos multinivel, reglas y la política de no aprobar lo propio. Apagado, la empresa usa solo el modo simple.</span>
          </label>
          <label :class="toggleRow">
            <input v-model="settings.prevent_self_approval" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600">
            <span><strong>Nadie aprueba lo propio.</strong> Si el solicitante es aprobador de un nivel, se le quita.</span>
          </label>
          <div class="pl-7">
            <FormSelect
              v-model="settings.self_approval_fallback"
              label="Si el nivel queda vacío"
              :options="[{ value: 'next_level', label: 'Saltar al siguiente nivel' }, { value: 'owners', label: 'Pasarlo a los owners' }]"
              size="sm"
            />
          </div>
          <label :class="toggleRow">
            <input v-model="settings.dedupe_consecutive" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600">
            <span><strong>No pedir dos veces.</strong> Si alguien aparece en niveles consecutivos, aprueba una sola vez.</span>
          </label>
          <label :class="toggleRow">
            <input v-model="settings.require_reject_reason" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600">
            <span><strong>Motivo obligatorio al rechazar.</strong></span>
          </label>
          <label :class="toggleRow">
            <input v-model="settings.restart_from_first" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600">
            <span><strong>Reenviar desde el nivel 1.</strong> Si se apaga, una solicitud devuelta continúa desde el nivel que la devolvió. Cada flujo puede cambiarlo.</span>
          </label>
          <label :class="toggleRow">
            <input v-model="settings.notify_requester_each_level" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600">
            <span><strong>Avisar al solicitante en cada avance de nivel.</strong> Siempre se le avisa al resolverse.</span>
          </label>
        </div>
      </section>

      <section :class="card">
        <h2 class="mb-1 text-lg font-bold text-slate-800">Plazos y escalamiento</h2>
        <p class="mb-4 text-sm text-slate-500">Se cuentan días hábiles (sin fines de semana ni los días festivos de RR. HH.). El proceso corre cada hora.</p>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            :model-value="settings.default_sla_days ?? ''"
            label="Plazo por defecto por nivel (días hábiles)"
            type="number"
            min="1"
            placeholder="Sin plazo"
            @update:model-value="settings!.default_sla_days = $event === '' ? null : Number($event)"
          />
          <FormInput
            :model-value="settings.reminder_every_hours"
            label="Recordar cada (horas) al vencer"
            type="number"
            min="1"
            @update:model-value="settings!.reminder_every_hours = Math.max(1, Number($event) || 24)"
          />
          <FormSelect v-model="settings.escalation_action" label="Al vencer el plazo" :options="escalationOptions" />
          <FormInput
            :model-value="settings.expire_after_days ?? ''"
            label="Expirar solicitudes en revisión después de (días)"
            type="number"
            min="1"
            placeholder="Nunca"
            @update:model-value="settings!.expire_after_days = $event === '' ? null : Number($event)"
          />
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-3">
          <BtnApp variant="ghost" size="sm" label="Correr el proceso ahora" @click="runSla" />
          <BtnApp label="Guardar ajustes" :loading="busy" @click="saveSettings" />
        </div>
      </section>

      <section :class="card">
        <h2 class="mb-1 text-lg font-bold text-slate-800">Motivos de rechazo</h2>
        <p class="mb-4 text-sm text-slate-500">Catálogo para elegir al rechazar; el aprobador puede agregar texto libre.</p>
        <div class="flex gap-2">
          <div class="flex-1"><FormInput v-model="newReason" placeholder="Fuera de presupuesto" size="sm" /></div>
          <BtnApp label="Agregar" size="sm" @click="addReason" />
        </div>
        <ul class="mt-3 flex flex-wrap gap-2">
          <li v-for="r in reasons" :key="r.id" class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
            {{ r.name }}
            <button type="button" class="text-slate-400 hover:text-red-600" aria-label="Quitar" @click="removeReason(r.id)">✕</button>
          </li>
        </ul>
      </section>

      <section :class="card">
        <h2 class="mb-1 text-lg font-bold text-slate-800">Herramientas</h2>
        <p class="mb-4 text-sm text-slate-500">Replica la configuración entre empresas o empieza con flujos típicos de México.</p>
        <div class="flex flex-wrap gap-3">
          <BtnApp variant="secondary" label="Exportar configuración" @click="exportConfig" />
          <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importConfig">
          <BtnApp variant="secondary" label="Importar configuración" @click="fileInput?.click()" />
          <BtnApp variant="ghost" :loading="busy" label="Cargar flujos de ejemplo" @click="loadDemo" />
        </div>
        <p class="mt-3 text-xs text-slate-500">
          Los ejemplos crean Compras, Viáticos, Gastos menores, Descuentos comerciales y Alta de proveedor, con sus flujos y formularios.
        </p>
      </section>
    </template>
  </div>
</template>
