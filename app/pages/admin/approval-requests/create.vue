<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { ApprovalCategoryRow, ApprovalPlanStep, ApprovalRequestTemplateRow } from '~/types/approval.types'
import type { ActionDialogResult } from '~/components/ApprovalRequest/ActionDialog.vue'
import {
  approvalRequestToForm,
  createEmptyApprovalRequestForm,
  parseApprovalAmount,
  type ApprovalRequestFormData
} from '~/components/ApprovalRequest/Form.vue'
import { missingRequiredFields } from '~/utils/approvals'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, partner, companies } = storeToRefs(authStore)

const requests = useApprovalRequest()
const { getSelectableCategoriesForRequests } = useApprovalCategory()
const { simulate } = useApprovalFlow()
const people = useApprovalPeople()

const form = ref<ApprovalRequestFormData>(createEmptyApprovalRequestForm())
const categories = ref<ApprovalCategoryRow[]>([])
const templates = ref<ApprovalRequestTemplateRow[]>([])
const preview = ref<ApprovalPlanStep[]>([])
const previewLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const templateDialog = ref(false)
const templatePick = ref('')

const isWorkspaceAdmin = computed(() => {
  const r = companies.value.find(c => c.company.id === selectedCompanyId.value)?.role
  return r === 'owner' || r === 'admin'
})

const category = computed(() => categories.value.find(c => c.id === form.value.category_id))
const requesterId = computed(() => form.value.requesting_partner_id || partner.value?.id || '')
const managerOptions = computed(() => people.managerOptionsFor(form.value.category_id))
const memberOptions = computed(() => people.memberOptions.value.filter(o => o.value !== partner.value?.id))

const templateOptions = computed(() => templates.value.map(t => ({
  value: t.id,
  label: `${t.name}${t.owner_partner_id ? '' : ' · empresa'}${t.recurrence ? ' · recurrente' : ''}`
})))

const applyTemplate = (id: string | number | boolean | null): void => {
  const t = templates.value.find(x => x.id === id)
  if (!t) return
  const p = t.payload
  form.value = {
    ...form.value,
    category_id: t.category_id,
    title: p.title ?? t.name,
    description: p.description ?? '',
    amount: p.amount != null ? String(p.amount) : '',
    currency: p.currency ?? 'MXN',
    priority: p.priority ?? 'normal',
    field_values: { ...(p.field_values ?? {}) },
    lines: (p.lines ?? []).map(l => ({ ...l })),
    assigned_approval_manager_id: p.assigned_approval_manager_id ?? ''
  }
}

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const [cats, tpls] = await Promise.all([
    getSelectableCategoriesForRequests(cid),
    requests.getTemplates(cid),
    people.loadBase(cid)
  ])
  categories.value = cats
  templates.value = tpls

  // Duplicar una solicitud anterior
  const from = typeof route.query.from === 'string' ? route.query.from : ''
  if (from) {
    const [source, lines] = await Promise.all([requests.getRequestById(from, cid), requests.getLines(from)])
    if (source) {
      const copy = approvalRequestToForm(source, lines.map(l => ({ concept: l.concept, quantity: l.quantity, unit_price: l.unit_price, product_id: l.product_id })))
      form.value = {
        ...copy,
        title: `Copia de ${copy.title}`,
        request_date: createEmptyApprovalRequestForm().request_date,
        due_date: '',
        requesting_partner_id: source.requesting_partner_id === partner.value?.id ? '' : source.requesting_partner_id
      }
    }
  }
  if (typeof route.query.template === 'string') applyTemplate(route.query.template)
}

watch(selectedCompanyId, load, { immediate: true })

watch(() => category.value?.field_schema, async (schema) => {
  if (schema?.length && selectedCompanyId.value) await people.loadLookups(selectedCompanyId.value, schema)
})

// Vista previa del flujo en vivo (mismo cálculo que hará el motor al enviar)
let previewTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [form.value.category_id, form.value.amount, form.value.assigned_approval_manager_id, form.value.priority,
    JSON.stringify(form.value.field_values), form.value.requesting_partner_id, form.value.lines.length],
  () => {
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(refreshPreview, 350)
  }
)

const refreshPreview = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !form.value.category_id || !requesterId.value) { preview.value = []; return }
  if (!category.value?.flow_id && !form.value.assigned_approval_manager_id) { preview.value = []; return }
  // Simular a otra persona es exclusivo de administradores
  if (form.value.requesting_partner_id && !isWorkspaceAdmin.value) { preview.value = []; return }
  previewLoading.value = true
  try {
    preview.value = await simulate({
      companyId: cid,
      categoryId: form.value.category_id,
      requesterPartnerId: requesterId.value,
      amount: parseApprovalAmount(form.value.amount),
      fieldValues: form.value.field_values,
      priority: form.value.priority,
      assignedManagerId: form.value.assigned_approval_manager_id || null
    }) ?? []
  } finally {
    previewLoading.value = false
  }
}

const validate = (forSubmit: boolean): boolean => {
  if (!form.value.title.trim()) { errorMessage.value = 'El asunto es obligatorio.'; return false }
  if (!form.value.category_id) { errorMessage.value = 'Selecciona una categoría.'; return false }
  if (forSubmit) {
    const missing = missingRequiredFields(category.value?.field_schema ?? [], form.value.field_values)
    if (missing.length) { errorMessage.value = `Faltan campos obligatorios: ${missing.join(', ')}.`; return false }
    if (!category.value?.flow_id && !form.value.assigned_approval_manager_id) {
      errorMessage.value = 'Elige al aprobador.'
      return false
    }
  }
  return true
}

const save = async (submit: boolean): Promise<void> => {
  const cid = selectedCompanyId.value
  const me = partner.value?.id
  if (!cid || !me) return
  errorMessage.value = null
  if (!validate(submit)) return

  isSaving.value = true
  try {
    const onBehalf = form.value.requesting_partner_id && form.value.requesting_partner_id !== me
    const created = await requests.createRequest(cid, onBehalf ? form.value.requesting_partner_id : me, {
      title: form.value.title.trim(),
      category_id: form.value.category_id,
      request_date: form.value.request_date || undefined,
      description: form.value.description.trim() || null,
      amount: parseApprovalAmount(form.value.amount),
      currency: (form.value.currency || 'MXN').slice(0, 3).toUpperCase(),
      reference: form.value.reference.trim() || null,
      assigned_approval_manager_id: category.value?.flow_id ? null : (form.value.assigned_approval_manager_id || null),
      priority: form.value.priority,
      due_date: form.value.due_date || null,
      field_values: form.value.field_values,
      captured_by_partner_id: onBehalf ? me : null
    })
    if (!created) { errorMessage.value = requests.lastError.value ?? 'No se pudo crear la solicitud.'; return }

    if (category.value?.allow_lines && form.value.lines.length) {
      const ok = await requests.saveLines(cid, created.id, form.value.lines)
      if (!ok) { errorMessage.value = requests.lastError.value; return }
    }

    // Con adjunto obligatorio, primero se adjunta en el detalle y luego se envía
    if (submit && !category.value?.require_attachment) {
      const { errorMessage: err } = await requests.submitRequest(created.id)
      if (err) {
        await router.push({ path: `/admin/approval-requests/${created.id}`, query: { error: err } })
        return
      }
    }
    await router.push({
      path: `/admin/approval-requests/${created.id}`,
      query: submit && category.value?.require_attachment ? { notice: 'attach' } : {}
    })
  } finally {
    isSaving.value = false
  }
}

const saveTemplate = async (result: ActionDialogResult): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !form.value.category_id) return
  const scope = result.option || 'mine'
  const saved = await requests.saveTemplate({
    companyId: cid,
    ownerPartnerId: scope === 'company' ? null : (partner.value?.id ?? null),
    name: result.text,
    categoryId: form.value.category_id,
    payload: {
      title: form.value.title,
      description: form.value.description,
      amount: parseApprovalAmount(form.value.amount),
      currency: form.value.currency,
      priority: form.value.priority,
      field_values: form.value.field_values,
      lines: form.value.lines.map(l => ({ concept: l.concept, quantity: l.quantity, unit_price: l.unit_price })),
      assigned_approval_manager_id: form.value.assigned_approval_manager_id || null
    },
    recurrence: scope === 'weekly' || scope === 'monthly' ? scope : null,
    nextRunOn: scope === 'weekly' || scope === 'monthly' ? new Date().toISOString().slice(0, 10) : null
  })
  if (saved) {
    templates.value = [...templates.value, saved]
    templateDialog.value = false
  } else {
    errorMessage.value = requests.lastError.value
  }
}

const templateScopeOptions = computed(() => [
  { value: 'mine', label: 'Solo para mí' },
  ...(isWorkspaceAdmin.value ? [{ value: 'company', label: 'Para toda la empresa' }] : []),
  { value: 'weekly', label: 'Mía y recurrente: un borrador cada semana' },
  { value: 'monthly', label: 'Mía y recurrente: un borrador cada mes' }
])
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <div v-if="!selectedCompanyId" class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900">
      Selecciona una empresa.
    </div>

    <CardSheet
      v-else
      title="Nueva solicitud"
      subtitle="Se guarda como borrador; envíala cuando esté completa"
      :show-back-button="true"
      :show-edit-button="false"
      :show-footer="false"
      :is-editing="true"
      variant="elevated"
      padding="lg"
      @back="router.push('/admin/approval-requests')"
    >
      <div class="mb-6 flex flex-wrap items-end gap-3">
        <div v-if="templateOptions.length" class="min-w-[16rem] flex-1">
          <FormSelect
            v-model="templatePick"
            :options="templateOptions"
            label="Partir de una plantilla"
            placeholder="Selecciona una plantilla"
            searchable
            clearable
            size="sm"
            @update:model-value="applyTemplate"
          />
        </div>
        <BtnApp variant="ghost" size="sm" label="Guardar como plantilla" :disabled="!form.category_id" @click="templateDialog = true" />
      </div>

      <p v-if="errorMessage" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{{ errorMessage }}</p>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
        <ApprovalRequestForm
          v-model="form"
          :categories="categories"
          :manager-options="managerOptions"
          :member-options="memberOptions"
          :lookups="people.lookups.value"
        />
        <aside class="space-y-4">
          <ApprovalRequestFlowPreview :steps="preview" :loading="previewLoading" />
          <p v-if="category?.require_attachment" class="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Esta categoría pide al menos un archivo adjunto. Guarda el borrador, adjunta el archivo y envíala desde el detalle.
          </p>
          <p v-else class="text-xs text-slate-500">Podrás adjuntar archivos después de guardar.</p>
        </aside>
      </div>

      <div class="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6">
        <BtnApp variant="ghost" label="Cancelar" @click="router.push('/admin/approval-requests')" />
        <BtnApp variant="secondary" label="Guardar borrador" :loading="isSaving" @click="save(false)" />
        <BtnApp
          variant="primary"
          :label="category?.require_attachment ? 'Guardar y adjuntar' : 'Enviar a aprobación'"
          :loading="isSaving"
          @click="save(true)"
        />
      </div>
    </CardSheet>

    <ApprovalRequestActionDialog
      :open="templateDialog"
      title="Guardar como plantilla"
      description="Guarda categoría, textos, montos, campos y partidas para reutilizarlos."
      confirm-label="Guardar plantilla"
      text-label="Nombre de la plantilla"
      :text-required="true"
      option-label="¿Para quién?"
      :options="templateScopeOptions"
      @close="templateDialog = false"
      @confirm="saveTemplate"
    />
  </div>
</template>
