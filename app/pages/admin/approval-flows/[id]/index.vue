<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { ApprovalCategoryRow, ApprovalFieldDefinition, ApprovalFlowRow } from '~/types/approval.types'
import type { FlowStepInput } from '~/composables/useApprovalFlow'
import { conditionFieldOptions, flowIssues, formatDateTimeMx, normalizeCondition } from '~/utils/approvals'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const flowApi = useApprovalFlow()
const { getCategoriesByCompany, updateCategory } = useApprovalCategory()
const people = useApprovalPeople()

const fid = computed(() => String(route.params.id))
const flow = ref<ApprovalFlowRow | null>(null)
const name = ref('')
const description = ref('')
const restart = ref<'company' | 'first' | 'returned'>('company')
const steps = ref<FlowStepInput[]>([])
const categories = ref<ApprovalCategoryRow[]>([])
const snapshot = ref('')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const message = ref<string | null>(null)
const assignPick = ref('')

const dirty = computed(() => JSON.stringify({ n: name.value, d: description.value, r: restart.value, s: steps.value }) !== snapshot.value)
const issues = computed(() => flowIssues(steps.value))
const usingCategories = computed(() => categories.value.filter(c => c.flow_id === fid.value))
const assignableCategories = computed(() =>
  categories.value.filter(c => c.flow_id !== fid.value && !c.archived).map(c => ({ value: c.id, label: c.name + (c.flow_id ? ' (tiene otro flujo)' : '') })))

/** Campos disponibles en condiciones: base + los de las categorías que usan el flujo. */
const fieldOptions = computed(() => {
  const merged: ApprovalFieldDefinition[] = []
  for (const c of usingCategories.value) {
    for (const f of c.field_schema) if (!merged.some(m => m.key === f.key)) merged.push(f)
  }
  return conditionFieldOptions(merged)
})

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    const [f, s, c] = await Promise.all([
      flowApi.getFlowById(fid.value, cid),
      flowApi.getSteps(fid.value),
      getCategoriesByCompany(cid),
      people.loadBase(cid)
    ])
    if (!f) { errorMessage.value = 'Flujo no encontrado.'; return }
    flow.value = f
    name.value = f.name
    description.value = f.description ?? ''
    restart.value = f.restart_from_first === null ? 'company' : f.restart_from_first ? 'first' : 'returned'
    steps.value = s.map(step => ({
      id: step.id,
      sequence: step.sequence,
      name: step.name,
      mode: step.mode,
      quorum: step.quorum,
      informative: step.informative,
      condition: step.condition,
      sla_days: step.sla_days,
      approvers: step.approvers.map(a => ({ kind: a.kind, approval_manager_id: a.approval_manager_id }))
    }))
    categories.value = c
    snapshot.value = JSON.stringify({ n: name.value, d: description.value, r: restart.value, s: steps.value })
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, fid], load, { immediate: true })

const addStep = (): void => {
  const next = Math.max(0, ...steps.value.map(s => s.sequence)) + 1
  steps.value = [...steps.value, {
    sequence: next, name: '', mode: 'any', quorum: null, informative: false, condition: null, sla_days: null,
    approvers: [{ kind: 'owners', approval_manager_id: null }]
  }]
}

const move = (index: number, direction: -1 | 1): void => {
  const list = [...steps.value]
  const target = index + direction
  if (target < 0 || target >= list.length) return
  const a = list[index]!
  const b = list[target]!
  ;[a.sequence, b.sequence] = [b.sequence, a.sequence]
  list[index] = b
  list[target] = a
  steps.value = list
}

const removeStep = (index: number): void => {
  steps.value = steps.value.filter((_, i) => i !== index)
}

const save = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid || !flow.value) return
  if (!name.value.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  isLoading.value = true
  errorMessage.value = null
  try {
    const updated = await flowApi.updateFlow(flow.value.id, {
      name: name.value.trim(),
      description: description.value.trim() || null,
      restart_from_first: restart.value === 'company' ? null : restart.value === 'first'
    })
    if (!updated) { errorMessage.value = flowApi.lastError.value; return }
    const sorted = [...steps.value].sort((a, b) => a.sequence - b.sequence)
    const ok = await flowApi.saveSteps(cid, flow.value.id, sorted.map(s => ({ ...s, condition: normalizeCondition(s.condition) })))
    if (!ok) { errorMessage.value = flowApi.lastError.value; return }
    message.value = 'Flujo guardado. Las solicitudes en curso conservan la versión con la que se enviaron.'
    await load()
  } finally {
    isLoading.value = false
  }
}

const assign = async (categoryId: string | number | boolean | null, flowId: string | null): Promise<void> => {
  if (!categoryId) return
  const updated = await updateCategory(String(categoryId), { flow_id: flowId })
  if (!updated) { errorMessage.value = 'No se pudo actualizar la categoría.'; return }
  categories.value = categories.value.map(c => (c.id === updated.id ? updated : c))
  assignPick.value = ''
}

const archive = async (): Promise<void> => {
  if (!flow.value) return
  if (usingCategories.value.length) { errorMessage.value = 'Quita el flujo de sus categorías antes de archivarlo.'; return }
  if (await flowApi.archiveFlow(flow.value.id)) await router.push('/admin/approval-flows')
}

const menuOptions = computed<MenuOption[]>(() => [
  { id: 'archive', label: 'Archivar flujo', action: () => void archive(), variant: 'danger' }
])

const restartOptions = [
  { value: 'company', label: 'Según el ajuste de la empresa' },
  { value: 'first', label: 'Desde el nivel 1' },
  { value: 'returned', label: 'Desde el nivel que la devolvió' }
]
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <CardSheet
      v-if="flow"
      :title="name || 'Flujo'"
      :subtitle="`Versión ${flow.version} · actualizado ${formatDateTimeMx(flow.updated_at)}`"
      :show-back-button="true"
      :show-edit-button="false"
      :show-options-button="true"
      :is-editing="true"
      :is-loading="isLoading"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      @back="router.push('/admin/approval-flows')"
      @save="save"
      @cancel="load"
    >
      <p v-if="message" class="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{{ message }}</p>
      <p v-if="errorMessage" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{{ errorMessage }}</p>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
        <div class="space-y-5">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput v-model="name" label="Nombre" required />
            <FormSelect v-model="restart" label="Al reenviar una devuelta, empezar" :options="restartOptions" />
            <div class="md:col-span-2">
              <FormTextArea v-model="description" label="Descripción" :rows="2" />
            </div>
          </div>

          <div v-if="issues.length" class="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p v-for="issue in issues" :key="issue" class="text-sm text-amber-900">⚠️ {{ issue }}</p>
          </div>

          <ApprovalFlowStepEditor
            v-for="(step, index) in steps"
            :key="index"
            v-model="steps[index]!"
            :index="index"
            :total="steps.length"
            :manager-options="people.allManagerOptions.value"
            :condition-field-options="fieldOptions"
            @move="move(index, $event)"
            @remove="removeStep(index)"
          />
          <BtnApp variant="secondary" label="Agregar nivel" @click="addStep" />
          <p class="text-xs text-slate-500">
            Niveles con la misma secuencia corren en paralelo. Si un nivel no resuelve a nadie (por ejemplo, el solicitante no tiene jefe),
            pasa a los owners. Si no aplica ninguna condición, deciden los owners.
          </p>
        </div>

        <aside class="space-y-6">
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40">
            <h3 class="mb-3 text-sm font-bold text-slate-800">Categorías que usan este flujo</h3>
            <ul class="mb-3 space-y-2">
              <li v-for="c in usingCategories" :key="c.id" class="flex items-center justify-between gap-2 text-sm">
                <span>{{ c.name }}</span>
                <button type="button" class="text-xs font-semibold text-red-600 hover:text-red-800" @click="assign(c.id, null)">Quitar</button>
              </li>
              <li v-if="!usingCategories.length" class="text-sm text-slate-500">Ninguna todavía.</li>
            </ul>
            <FormSelect
              v-model="assignPick"
              :options="assignableCategories"
              placeholder="Usar en una categoría…"
              searchable
              size="sm"
              @update:model-value="assign($event, fid)"
            />
          </div>
          <ApprovalFlowSimulator
            v-if="selectedCompanyId"
            :company-id="selectedCompanyId"
            :categories="usingCategories.length ? usingCategories : categories"
            :requester-options="people.memberOptions.value"
            :lookups="people.lookups.value"
            :dirty="dirty"
          />
        </aside>
      </div>
    </CardSheet>
    <div v-else-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-800">{{ errorMessage }}</div>
  </div>
</template>
