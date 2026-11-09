<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type {
  ApprovalCategoryRow,
  ApprovalInsights,
  ApprovalRequestEventRow,
  ApprovalRequestLineRow,
  ApprovalRequestRow,
  ApprovalRequestViewRow
} from '~/types/approval.types'
import type { ApprovalStepWithApprovers } from '~/composables/useApprovalRequest'
import {
  APPROVAL_APPROVER_STATUS_LABELS,
  APPROVAL_PRIORITY_LABELS,
  APPROVAL_STEP_STATUS_LABELS,
  approvalEventLabel,
  approvalStatusLabel,
  formatDateMx,
  formatDateTimeMx,
  formatFieldValue,
  formatMoneyMx
} from '~/utils/approvals'

/**
 * Evidencia de una solicitud para auditoría o para anexar a la contabilidad.
 * Sin layout del panel: se imprime o se guarda como PDF desde el navegador.
 */
definePageMeta({ layout: false })
useHead({ title: 'Evidencia de aprobación — Flowbit', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const route = useRoute()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const requests = useApprovalRequest()
const { getCategoriesByCompany } = useApprovalCategory()
const people = useApprovalPeople()

const rid = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id))
const entity = ref<ApprovalRequestRow | null>(null)
const view = ref<ApprovalRequestViewRow | null>(null)
const category = ref<ApprovalCategoryRow | null>(null)
const lines = ref<ApprovalRequestLineRow[]>([])
const steps = ref<ApprovalStepWithApprovers[]>([])
const events = ref<ApprovalRequestEventRow[]>([])
const insights = ref<ApprovalInsights | null>(null)
const ready = ref(false)
const printedAt = new Date().toISOString()

const decisions = computed(() =>
  steps.value
    .filter(s => s.round === entity.value?.round)
    .flatMap(s => s.approvers.filter(a => a.status !== 'pending' && a.status !== 'cancelled').map(a => ({ step: s, approver: a }))))

onMounted(async () => {
  if (!authStore.isAuthenticated) await authStore.loadSession()
  const cid = selectedCompanyId.value
  if (!cid) return
  const [row, v, cats, ls, st, ev, ins] = await Promise.all([
    requests.getRequestById(rid.value, cid),
    requests.getRequestViewById(rid.value, cid),
    getCategoriesByCompany(cid, { includeArchived: true }),
    requests.getLines(rid.value),
    requests.getSteps(rid.value),
    requests.getEvents(rid.value),
    requests.getInsights(rid.value),
    people.loadBase(cid)
  ])
  entity.value = row
  view.value = v
  category.value = cats.find(c => c.id === row?.category_id) ?? null
  lines.value = ls
  steps.value = st
  events.value = ev
  insights.value = ins
  people.rememberName(row?.requesting_partner_id, v?.requesting_partner_display)
  if (category.value?.field_schema.length) await people.loadLookups(cid, category.value.field_schema)
  ready.value = true
  await nextTick()
  window.print()
})
</script>

<template>
  <div class="mx-auto max-w-4xl bg-white p-8 text-slate-800 print:p-0">
    <p v-if="!ready" class="text-sm text-slate-500 print:hidden">Preparando la evidencia…</p>
    <template v-else-if="entity">
      <header class="mb-6 flex items-start justify-between border-b border-slate-300 pb-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">{{ selectedCompany?.display_name || selectedCompany?.name }}</p>
          <h1 class="text-2xl font-bold">Evidencia de aprobación #{{ entity.request_number }}</h1>
          <p class="text-sm text-slate-600">{{ entity.title }}</p>
        </div>
        <div class="text-right text-sm">
          <p class="text-lg font-bold">{{ approvalStatusLabel(entity.status) }}</p>
          <p v-if="entity.forced" class="font-semibold">Resolución forzada</p>
          <p v-if="entity.auto_approved" class="font-semibold">Aprobación automática</p>
          <p class="text-slate-500">Generada {{ formatDateTimeMx(printedAt) }}</p>
        </div>
      </header>

      <section class="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <p><span class="text-slate-500">Categoría:</span> {{ category?.name }}</p>
        <p><span class="text-slate-500">Prioridad:</span> {{ APPROVAL_PRIORITY_LABELS[entity.priority] }}</p>
        <p><span class="text-slate-500">Solicitante:</span> {{ view?.requesting_partner_display }}</p>
        <p v-if="view?.captured_by_display"><span class="text-slate-500">Capturó:</span> {{ view.captured_by_display }}</p>
        <p><span class="text-slate-500">Fecha de solicitud:</span> {{ formatDateMx(entity.request_date) }}</p>
        <p><span class="text-slate-500">Enviada:</span> {{ formatDateTimeMx(entity.submitted_at) }}</p>
        <p><span class="text-slate-500">Importe:</span> {{ formatMoneyMx(entity.amount, entity.currency) }}</p>
        <p v-if="entity.reference"><span class="text-slate-500">Referencia:</span> {{ entity.reference }}</p>
        <p v-if="entity.resolution_note" class="col-span-2"><span class="text-slate-500">Nota de resolución:</span> {{ entity.resolution_note }}</p>
      </section>

      <section v-if="category?.field_schema.length" class="mb-6">
        <h2 class="mb-2 text-sm font-bold uppercase tracking-wide">Datos</h2>
        <table class="w-full text-sm">
          <tr v-for="f in category.field_schema" :key="f.key" class="border-b border-slate-100">
            <td class="w-1/3 py-1 text-slate-500">{{ f.label }}</td>
            <td class="py-1">{{ formatFieldValue(f, entity.field_values[f.key], people.lookupLabel) }}</td>
          </tr>
        </table>
      </section>

      <section v-if="entity.description" class="mb-6">
        <h2 class="mb-2 text-sm font-bold uppercase tracking-wide">Descripción</h2>
        <p class="whitespace-pre-line text-sm">{{ entity.description }}</p>
      </section>

      <section v-if="lines.length" class="mb-6">
        <h2 class="mb-2 text-sm font-bold uppercase tracking-wide">Partidas</h2>
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-300 text-left text-slate-500"><th class="py-1">Concepto</th><th class="py-1 text-right">Cantidad</th><th class="py-1 text-right">Precio</th><th class="py-1 text-right">Subtotal</th></tr></thead>
          <tbody>
            <tr v-for="l in lines" :key="l.id" class="border-b border-slate-100">
              <td class="py-1">{{ l.concept }}</td>
              <td class="py-1 text-right">{{ l.quantity }}</td>
              <td class="py-1 text-right">{{ formatMoneyMx(l.unit_price, entity.currency) }}</td>
              <td class="py-1 text-right">{{ formatMoneyMx(l.subtotal, entity.currency) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-sm font-bold uppercase tracking-wide">Cadena de aprobación</h2>
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-300 text-left text-slate-500"><th class="py-1">Nivel</th><th class="py-1">Persona</th><th class="py-1">Decisión</th><th class="py-1">Fecha y hora</th></tr></thead>
          <tbody>
            <tr v-for="d in decisions" :key="d.approver.id" class="border-b border-slate-100 align-top">
              <td class="py-1">{{ d.step.sequence }}. {{ d.step.name }} <span class="text-slate-500">({{ APPROVAL_STEP_STATUS_LABELS[d.step.status] }})</span></td>
              <td class="py-1">{{ people.nameOf(d.approver.partner_id) }}<span v-if="d.approver.delegated_from_partner_id" class="text-slate-500"> por {{ people.nameOf(d.approver.delegated_from_partner_id) }}</span></td>
              <td class="py-1">{{ APPROVAL_APPROVER_STATUS_LABELS[d.approver.status] }}<span v-if="d.approver.comment" class="block text-slate-500">«{{ d.approver.comment }}»</span></td>
              <td class="py-1">{{ formatDateTimeMx(d.approver.decided_at) }}</td>
            </tr>
            <tr v-if="!decisions.length"><td colspan="4" class="py-2 text-slate-500">Sin decisiones registradas.</td></tr>
          </tbody>
        </table>
      </section>

      <section class="mb-6">
        <h2 class="mb-2 text-sm font-bold uppercase tracking-wide">Bitácora</h2>
        <table class="w-full text-xs">
          <tr v-for="e in events" :key="e.id" class="border-b border-slate-100">
            <td class="w-8 py-0.5 text-slate-400">{{ e.seq }}</td>
            <td class="py-0.5">{{ formatDateTimeMx(e.created_at) }}</td>
            <td class="py-0.5">{{ e.automatic ? 'Sistema' : people.nameOf(e.actor_partner_id) }}</td>
            <td class="py-0.5">{{ approvalEventLabel(e.event_type) }}</td>
          </tr>
        </table>
      </section>

      <footer class="border-t border-slate-300 pt-3 text-xs text-slate-500">
        <p>
          Integridad de la bitácora: <strong>{{ insights?.chain.ok ? 'verificada' : 'NO verificada' }}</strong>
          ({{ insights?.chain.events ?? events.length }} eventos encadenados con SHA-256).
        </p>
        <p v-if="insights?.chain.last_hash" class="break-all font-mono">Último hash: {{ insights.chain.last_hash }}</p>
        <p class="mt-1">Documento generado por Flowbit ERP. No sustituye una firma electrónica avanzada.</p>
      </footer>
    </template>
    <p v-else class="text-sm text-red-600">Solicitud no encontrada o sin acceso.</p>
  </div>
</template>
