<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteContactSubmissionRow, WebsiteSubmissionStatus } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, setStatus, convertToLead, lastError } = useWebsiteSubmission()

const submissions = ref<WebsiteContactSubmissionRow[]>([])
const filter = ref<WebsiteSubmissionStatus | 'all'>('new')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const expanded = ref<string | null>(null)

const tabs: { id: WebsiteSubmissionStatus | 'all'; label: string }[] = [
  { id: 'new', label: 'Nuevos' }, { id: 'read', label: 'Leídos' }, { id: 'archived', label: 'Archivados' }, { id: 'all', label: 'Todos' }
]

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try { submissions.value = await getAllByCompany(cid, filter.value) } finally { isLoading.value = false }
}

watch([selectedCompanyId, filter], load, { immediate: true })

const toggle = async (s: WebsiteContactSubmissionRow) => {
  expanded.value = expanded.value === s.id ? null : s.id
  if (s.status === 'new' && selectedCompanyId.value && await setStatus(s.id, selectedCompanyId.value, 'read')) s.status = 'read'
}

const changeStatus = async (s: WebsiteContactSubmissionRow, status: WebsiteSubmissionStatus) => {
  if (!selectedCompanyId.value) return
  if (await setStatus(s.id, selectedCompanyId.value, status)) await load()
}

const toLead = async (s: WebsiteContactSubmissionRow) => {
  errorMessage.value = null
  const result = await convertToLead(s.id)
  if (!result) { errorMessage.value = lastError.value; return }
  if (result.status === 'error' && result.code === 'no_stage') { errorMessage.value = 'El CRM no tiene etapas activas. Crea el pipeline en CRM → Pipeline.'; return }
  if (result.status === 'forbidden') { errorMessage.value = 'No tienes permiso para crear leads.'; return }
  await load()
}

const STATUS_LABEL: Record<WebsiteSubmissionStatus, string> = { new: 'Nuevo', read: 'Leído', archived: 'Archivado' }
const STATUS_VARIANT: Record<WebsiteSubmissionStatus, 'primary' | 'secondary' | 'danger'> = { new: 'primary', read: 'secondary', archived: 'danger' }
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Mensajes del sitio</h1>
      <p class="text-slate-500 mt-1">Formulario de contacto del sitio web. Conviértelos en leads del CRM con un clic.</p>
    </div>
    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <div class="flex gap-1 rounded-2xl bg-white shadow-lg shadow-slate-200/50 p-1.5 w-fit">
      <button v-for="t in tabs" :key="t.id" type="button" :class="['px-4 py-2 rounded-xl text-sm font-semibold', filter === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800']" @click="filter = t.id">{{ t.label }}</button>
    </div>
    <div v-if="isLoading" class="py-16 text-center text-slate-400">Cargando…</div>
    <div v-else-if="!submissions.length" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-12 text-center text-slate-400">No hay mensajes en esta bandeja.</div>
    <ul v-else class="space-y-3">
      <li v-for="s in submissions" :key="s.id" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50">
        <button type="button" class="w-full text-left p-5 flex flex-wrap items-center gap-3" @click="toggle(s)">
          <BadgeApp :label="STATUS_LABEL[s.status]" :variant="STATUS_VARIANT[s.status]" />
          <span class="font-semibold text-slate-800">{{ s.name }}</span>
          <span class="text-sm text-slate-500 truncate">{{ s.subject || s.message.slice(0, 80) }}</span>
          <span v-if="s.crm_lead_id" class="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Lead creado</span>
          <span class="ml-auto text-xs text-slate-400">{{ formatWebsiteDateTime(s.created_at) }}</span>
        </button>
        <div v-if="expanded === s.id" class="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
          <div class="grid sm:grid-cols-3 gap-3 text-sm">
            <p><span class="text-slate-400">Correo:</span> <a v-if="s.email" :href="`mailto:${s.email}`" class="text-indigo-600">{{ s.email }}</a><span v-else>—</span></p>
            <p><span class="text-slate-400">Teléfono:</span> <a v-if="s.phone" :href="`tel:${s.phone}`" class="text-indigo-600">{{ s.phone }}</a><span v-else>—</span></p>
            <p><span class="text-slate-400">Origen:</span> {{ s.source_url || '—' }}</p>
          </div>
          <p class="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 rounded-xl p-4">{{ s.message }}</p>
          <div class="flex flex-wrap gap-2">
            <NuxtLink v-if="s.crm_lead_id" :to="`/admin/crm/leads/${s.crm_lead_id}`" class="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold">Ver lead en CRM</NuxtLink>
            <BtnApp v-else label="Crear lead en CRM" size="sm" @click="toLead(s)" />
            <BtnApp v-if="s.status !== 'archived'" label="Archivar" size="sm" variant="secondary" @click="changeStatus(s, 'archived')" />
            <BtnApp v-else label="Restaurar" size="sm" variant="secondary" @click="changeStatus(s, 'read')" />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
