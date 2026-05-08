<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyProjectForm,
  type ProjectFormData
} from '~/components/Project/Form.vue'
import {
  createEmptyProjectTaskForm,
  type ProjectTaskFormData
} from '~/components/ProjectTask/Form.vue'
import type { StatItem } from '~/components/StatGrid.vue'
import type { Database, TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type ProjectStatus = Database['public']['Enums']['project_status']
type ProjectTaskStatus = Database['public']['Enums']['project_task_status']
type ProjectRow = Database['public']['Views']['v_projects']['Row']
type TaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type OrderViewRow = Database['public']['Views']['v_orders']['Row']

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const {
  getProjectViewById,
  updateProject,
  archiveProject,
  setProjectStatus
} = useProject()

const {
  getTasksByProject,
  createTask,
  updateTask,
  archiveTask,
  deleteTask,
  setTaskStatus,
  computeAggregatedMetrics
} = useProjectTask()

const { getProjectTypesByCompany } = useProjectType()
const { getPartnersByCompany } = usePartner()
const { getOrdersByProject } = useOrder()

const projectId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const partnerOptions = ref<{ value: string; label: string }[]>([])
const typeOptions = ref<{ value: string; label: string }[]>([])

const projectViewData = ref<ProjectRow | null>(null)

const formData = ref<ProjectFormData>(createEmptyProjectForm())
const initialForm = ref<ProjectFormData>(createEmptyProjectForm())

const auditFooter = reactive({
  createdBy: '—',
  createdAt: '',
  updatedBy: '—',
  updatedAt: ''
})

const tasks = ref<TaskViewRow[]>([])
const purchaseOrders = ref<OrderViewRow[]>([])
const saleOrders = ref<OrderViewRow[]>([])

const kanbanStatuses: ProjectTaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']
const kanbanLabels: Record<ProjectTaskStatus, string> = {
  pending: 'Inicio',
  in_progress: 'En proceso',
  completed: 'Terminado',
  cancelled: 'Cancelado'
}

const projectStatusLabels: Record<string, string> = {
  pending: 'Por iniciar',
  in_progress: 'En proceso',
  paused: 'En pausa',
  completed: 'Finalizado',
  cancelled: 'Cancelado'
}

const projectStatusVariants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> =
  {
    pending: 'secondary',
    in_progress: 'primary',
    paused: 'warning',
    completed: 'success',
    cancelled: 'danger'
  }

// Slide-over para tareas
const showTaskPanel = ref(false)
const editingTaskView = ref<TaskViewRow | null>(null)
const taskFormData = ref<ProjectTaskFormData>(createEmptyProjectTaskForm())
const taskPanelError = ref<string | null>(null)
const panelKey = ref(0)

const mapViewToProjectForm = (v: ProjectRow): ProjectFormData => ({
  code: v.code ?? '',
  name: v.name ?? '',
  description: v.description ?? '',
  project_type_id: v.project_type_id ?? null,
  responsible_partner_id: v.responsible_partner_id ?? null,
  responsible_name:
    v.responsible_display_name?.trim() || v.responsible_name?.trim() || '',
  status: v.status ?? 'pending',
  priority: v.priority ?? 'medium',
  start_date: v.start_date ?? '',
  end_date_estimated: v.end_date_estimated ?? '',
  end_date_actual: v.end_date_actual ?? '',
  budget_estimated: v.budget_estimated ?? 0,
  budget_actual: v.budget_actual ?? 0,
  requisition_amount: v.requisition_amount ?? 0,
  income_amount: v.income_amount ?? 0,
  progress: v.progress ?? 0,
  color: v.color ?? '#6366F1',
  notes: v.notes ?? ''
})

const mapFormToProjectUpdate = (
  value: ProjectFormData
): TablesUpdate<'project'> => {
  const budget = Number(value.budget_estimated)
  return {
    name: value.name.trim(),
    description: value.description.trim() || null,
    project_type_id: value.project_type_id ?? null,
    responsible_partner_id: value.responsible_partner_id ?? undefined,
    status: value.status,
    priority: value.priority,
    start_date: value.start_date || null,
    end_date_estimated: value.end_date_estimated || null,
    budget_estimated: Number.isFinite(budget) ? budget : 0,
    color: value.color.trim() || '#6366F1',
    notes: value.notes.trim() || null
  }
}

const formatDateShort = (s: string | null): string => {
  if (!s) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(s))
}

const formatDateIso = (s: string | null): string => {
  if (!s) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(s))
}

const loadPartnersAndTypes = async () => {
  const companyId = selectedCompanyId.value
  partnerOptions.value = []
  typeOptions.value = []
  if (!companyId) return

  const [partners, types] = await Promise.all([
    getPartnersByCompany(companyId),
    getProjectTypesByCompany(companyId)
  ])

  partnerOptions.value = partners.map((p) => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))

  typeOptions.value = types.map((t) => ({
    value: t.id,
    label: t.name
  }))
}

const reloadTasksOnly = async () => {
  const id = projectId.value
  if (!id) return
  tasks.value = await getTasksByProject(id)
}

const reloadOrdersOnly = async () => {
  const id = projectId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) {
    purchaseOrders.value = []
    saleOrders.value = []
    return
  }
  const orders = await getOrdersByProject(id, companyId)
  purchaseOrders.value = orders.filter((o) => o.order_type === 'purchase')
  saleOrders.value = orders.filter((o) => o.order_type === 'sale')
}

const loadProject = async () => {
  const id = projectId.value
  const companyId = selectedCompanyId.value
  errorMessage.value = null

  if (!id || !companyId) {
    if (!companyId) {
      errorMessage.value = 'Selecciona una empresa para ver este proyecto.'
    }
    return
  }

  isLoading.value = true
  try {
    await loadPartnersAndTypes()

    const view = await getProjectViewById(id, companyId)
    if (!view) {
      errorMessage.value = 'No se encontró el proyecto o no tienes acceso.'
      projectViewData.value = null
      return
    }

    projectViewData.value = view
    const mapped = mapViewToProjectForm(view)
    formData.value = mapped
    initialForm.value = { ...mapped }

    auditFooter.createdBy = view.created_by ?? '—'
    auditFooter.createdAt = view.created_at ?? ''
    auditFooter.updatedBy = view.updated_by ?? '—'
    auditFooter.updatedAt = view.updated_at ?? ''

    await Promise.all([reloadTasksOnly(), reloadOrdersOnly()])
  } finally {
    isLoading.value = false
  }
}

watch([projectId, selectedCompanyId], () => {
  isEditing.value = false
  showTaskPanel.value = false
  void loadProject()
}, { immediate: true })

const budgetVariance = computed(() => {
  const est = Number(formData.value.budget_estimated ?? 0)
  const act = Number(formData.value.budget_actual ?? 0)
  return act - est
})

const metrics = computed(() => computeAggregatedMetrics(tasks.value))

const metricStats = computed<StatItem[]>(() => {
  const m = metrics.value
  return [
    {
      label: 'Tareas',
      value: String(m.total),
      change: `${m.completed}/${m.total} terminadas`,
      trend: 'neutral'
    },
    {
      label: '% Completadas',
      value: `${m.completionRate}%`,
      change: `${m.inProgress} en curso`,
      trend: m.completionRate >= 50 ? 'up' : 'neutral'
    },
    {
      label: 'Vencidas',
      value: String(m.overdue),
      change: m.overdue === 0 ? 'Al día' : 'Revisa fechas',
      trend: m.overdue === 0 ? 'up' : 'down'
    },
    {
      label: 'Horas estim. / real',
      value: `${m.totalEstimatedHours}h`,
      change: `${m.totalActualHours}h reales`,
      trend:
        m.totalActualHours <= m.totalEstimatedHours ? 'up' : 'down'
    },
    {
      label: 'OC confirmadas',
      value: formatMoney(projectViewData.value?.requisition_amount ?? 0),
      change: `${purchaseOrders.value.filter(o => o.order_state === 'posted').length} confirmadas`,
      trend: 'neutral'
    },
    {
      label: 'OV confirmadas',
      value: formatMoney(projectViewData.value?.income_amount ?? 0),
      change: `${saleOrders.value.filter(o => o.order_state === 'posted').length} confirmadas`,
      trend: 'up'
    }
  ]
})

const orderStateLabel: Record<string, string> = {
  draft: 'Borrador',
  posted: 'Confirmada',
  cancel: 'Cancelada'
}

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0)

const postedPurchaseAmount = computed(() =>
  purchaseOrders.value
    .filter(o => o.order_state === 'posted')
    .reduce((sum, o) => sum + Number(o.amount_total ?? 0), 0)
)

const postedSaleAmount = computed(() =>
  saleOrders.value
    .filter(o => o.order_state === 'posted')
    .reduce((sum, o) => sum + Number(o.amount_total ?? 0), 0)
)

const openOrder = (orderId: string | null) => {
  if (!orderId) return
  router.push(`/admin/orders/${orderId}`)
}

function tasksForStatus(status: ProjectTaskStatus): TaskViewRow[] {
  return tasks.value.filter(
    (t) => (t.status ?? 'pending') === status && (t.active !== false)
  )
}

async function refreshAfterTaskMutation() {
  await reloadTasksOnly()
  const id = projectId.value
  const companyId = selectedCompanyId.value
  if (id && companyId) {
    const refreshed = await getProjectViewById(id, companyId)
    if (refreshed) {
      projectViewData.value = refreshed
      formData.value.budget_actual = refreshed.budget_actual ?? 0
      formData.value.requisition_amount = refreshed.requisition_amount ?? 0
      formData.value.income_amount = refreshed.income_amount ?? 0
      formData.value.progress = refreshed.progress ?? 0
      initialForm.value.budget_actual = refreshed.budget_actual ?? 0
      initialForm.value.requisition_amount = refreshed.requisition_amount ?? 0
      initialForm.value.income_amount = refreshed.income_amount ?? 0
      initialForm.value.progress = refreshed.progress ?? 0
      initialForm.value.end_date_actual = refreshed.end_date_actual ?? ''
      formData.value.end_date_actual = refreshed.end_date_actual ?? ''
    }
    await reloadOrdersOnly()
  }
}

async function handleKanbanDragStart(event: DragEvent, taskId: string) {
  event.dataTransfer?.setData('text/task-id', taskId)
}

async function handleKanbanDrop(event: DragEvent, newStatus: ProjectTaskStatus) {
  event.preventDefault()
  const taskId = event.dataTransfer?.getData('text/task-id')
  if (!taskId) return

  const ok = await setTaskStatus(taskId, newStatus)
  if (!ok) {
    errorMessage.value = 'No se pudo actualizar la etapa de la tarea.'
    return
  }
  await refreshAfterTaskMutation()
}

function openCreateTaskPanel() {
  panelKey.value += 1
  editingTaskView.value = null
  taskPanelError.value = null
  const defaultRespId = formData.value.responsible_partner_id
  const defaultName = formData.value.responsible_name
  taskFormData.value = createEmptyProjectTaskForm(defaultRespId, defaultName)
  showTaskPanel.value = true
}

function mapTaskViewToForm(row: TaskViewRow): ProjectTaskFormData {
  return {
  code: row.code ?? '',
  name: row.name ?? '',
  description: row.description ?? '',
  status: row.status ?? 'pending',
  priority: row.priority ?? 'medium',
  responsible_partner_id: row.responsible_partner_id ?? null,
  responsible_name:
    row.responsible_display_name?.trim() || row.responsible_name?.trim() || '',
  start_date: row.start_date ?? '',
  due_date: row.due_date ?? '',
  estimated_hours: row.estimated_hours ?? 0,
  actual_hours: row.actual_hours ?? 0,
  estimated_cost: row.estimated_cost ?? 0,
  actual_cost: row.actual_cost ?? 0,
  progress: row.progress ?? 0,
  order_index: row.order_index ?? 10,
  notes: row.notes ?? ''
}
}

function openEditTaskPanel(row: TaskViewRow) {
  panelKey.value += 1
  editingTaskView.value = row
  taskPanelError.value = null
  taskFormData.value = mapTaskViewToForm(row)
  showTaskPanel.value = true
}

function goTaskDetail(task: TaskViewRow) {
  if (!task.id) return
  router.push(`/admin/tasks/${task.id}`)
}

function closeTaskPanel() {
  taskPanelError.value = null
  showTaskPanel.value = false
}

const saveTaskPanel = async () => {
  taskPanelError.value = null
  const companyId = selectedCompanyId.value
  const pid = projectId.value
  if (!companyId || !pid) {
    taskPanelError.value = 'Falta la empresa o el proyecto.'
    return
  }
  const name = taskFormData.value.name.trim()
  if (!name) {
    taskPanelError.value = 'El nombre de la tarea es obligatorio.'
    return
  }

  isLoading.value = true
  try {
    const eh = Number(taskFormData.value.estimated_hours)
    const ah = Number(taskFormData.value.actual_hours)
    const ec = Number(taskFormData.value.estimated_cost)
    const ac = Number(taskFormData.value.actual_cost)
    const prog = Number(taskFormData.value.progress)
    const ord = Number(taskFormData.value.order_index)

    if (editingTaskView.value?.id) {
      const tid = editingTaskView.value.id
      const updated = await updateTask(tid, companyId, {
        name,
        description: taskFormData.value.description.trim() || null,
        status: taskFormData.value.status,
        priority: taskFormData.value.priority,
        responsible_partner_id: taskFormData.value.responsible_partner_id,
        start_date: taskFormData.value.start_date || null,
        due_date: taskFormData.value.due_date || null,
        estimated_hours: Number.isFinite(eh) ? eh : 0,
        actual_hours: Number.isFinite(ah) ? ah : 0,
        estimated_cost: Number.isFinite(ec) ? ec : 0,
        actual_cost: Number.isFinite(ac) ? ac : 0,
        progress: Number.isFinite(prog) ? Math.min(100, Math.max(0, Math.round(prog))) : 0,
        order_index: Number.isFinite(ord) ? Math.round(ord) : 10,
        notes: taskFormData.value.notes.trim() || null
      })
      if (!updated) {
        taskPanelError.value = 'No se pudo guardar la tarea.'
        return
      }
    } else {
      const created = await createTask(companyId, {
        project_id: pid,
        name,
        description: taskFormData.value.description.trim() || null,
        status: taskFormData.value.status,
        priority: taskFormData.value.priority,
        responsible_partner_id: taskFormData.value.responsible_partner_id ?? null,
        start_date: taskFormData.value.start_date || null,
        due_date: taskFormData.value.due_date || null,
        estimated_hours: Number.isFinite(eh) ? eh : 0,
        actual_hours: Number.isFinite(ah) ? ah : 0,
        estimated_cost: Number.isFinite(ec) ? ec : 0,
        actual_cost: Number.isFinite(ac) ? ac : 0,
        progress: Number.isFinite(prog) ? Math.min(100, Math.max(0, Math.round(prog))) : 0,
        order_index: Number.isFinite(ord) ? Math.round(ord) : 10,
        notes: taskFormData.value.notes.trim() || null
      })
      if (!created) {
        taskPanelError.value = 'No se pudo crear la tarea.'
        return
      }
    }

    await refreshAfterTaskMutation()
    showTaskPanel.value = false
  } finally {
    isLoading.value = false
  }
}

const archiveTaskFn = async (row: TaskViewRow) => {
  if (!row.id) return
  const ok = await archiveTask(row.id)
  if (ok) await refreshAfterTaskMutation()
}

const deleteTaskFn = async (row: TaskViewRow) => {
  if (!row.id) return
  const ok = await deleteTask(row.id)
  if (ok) await refreshAfterTaskMutation()
}

const handleBack = () => {
  router.push('/admin/projects')
}

const handleEdit = () => {
  errorMessage.value = null
  isEditing.value = true
}

const handleCancelEdit = () => {
  formData.value = { ...initialForm.value }
  isEditing.value = false
  errorMessage.value = null
}

const handleSave = async () => {
  const id = projectId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId || !projectViewData.value) return

  if (!formData.value.name.trim()) {
    errorMessage.value = 'El nombre del proyecto es obligatorio.'
    return
  }
  if (!formData.value.responsible_partner_id) {
    errorMessage.value = 'Selecciona un responsable.'
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const updated = await updateProject(id, companyId, mapFormToProjectUpdate(formData.value))
    if (!updated) {
      errorMessage.value = 'No se pudo guardar el proyecto.'
      return
    }

    const refView = await getProjectViewById(id, companyId)
    if (refView) {
      projectViewData.value = refView
      const mapped = mapViewToProjectForm(refView)
      formData.value = mapped
      initialForm.value = { ...mapped }
    }
    isEditing.value = false
    await reloadTasksOnly()
  } finally {
    isLoading.value = false
  }
}

const quickSetProjectStatus = async (status: ProjectStatus) => {
  const id = projectId.value
  if (!id) return

  const ok = await setProjectStatus(id, status)
  if (!ok) {
    errorMessage.value = `No se pudo cambiar el estatus del proyecto «${projectStatusLabels[status] ?? status}».`
    return
  }
  await loadProject()
}

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'start',
    label: 'Marcar en proceso',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    action: () => void quickSetProjectStatus('in_progress'),
    variant: 'default'
  },
  {
    id: 'pause',
    label: 'Pausar proyecto',
    icon: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
    action: () => void quickSetProjectStatus('paused'),
    variant: 'warning'
  },
  {
    id: 'finish',
    label: 'Marcar finalizado',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    action: () => void quickSetProjectStatus('completed'),
    variant: 'success'
  },
  {
    id: 'restart',
    label: 'Marcar por iniciar',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    action: () => void quickSetProjectStatus('pending'),
    variant: 'default'
  },
  {
    id: 'archive',
    label: 'Archivar proyecto',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8',
    divider: true,
    action: () => void handleArchiveProject(),
    variant: 'danger'
  }
])

const handleArchiveProject = async () => {
  const id = projectId.value
  if (!id) return

  isLoading.value = true
  try {
    const ok = await archiveProject(id)
    if (ok) router.push('/admin/projects')
    else errorMessage.value = 'No se pudo archivar el proyecto.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <div
      v-if="errorMessage && !projectViewData"
      class="mb-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <CardSheet
      :title="formData.name || 'Proyecto'"
      :subtitle="`${formData.code || 'Sin código'} — ${formData.responsible_name || 'Sin responsable'}`"
      :show-back-button="true"
      :show-options-button="menuOptions.length > 0 && !isEditing"
      :show-edit-button="!isEditing"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="auditFooter.createdBy"
      :created-at="formatDateIso(auditFooter.createdAt)"
      :updated-by="auditFooter.updatedBy"
      :updated-at="formatDateIso(auditFooter.updatedAt)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      :full-height="false"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancelEdit"
    >
      <template #status>
        <div class="flex flex-wrap items-center gap-2">
          <BadgeApp
            :label="projectStatusLabels[formData.status] || formData.status"
            :variant="projectStatusVariants[formData.status] || 'secondary'"
          />
          <BadgeApp
            v-if="projectViewData?.is_overdue"
            label="Fuera de plazo"
            variant="danger"
          />
          <BadgeApp
            v-if="budgetVariance !== 0 && formData.budget_estimated > 0"
            :label="budgetVariance > 0 ? `Sobre presupuesto: +${budgetVariance.toFixed(0)}` : 'Bajo presupuesto'"
            :variant="budgetVariance > 0 ? 'danger' : 'success'"
          />
        </div>
      </template>

      <div v-if="errorMessage && projectViewData" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">
        {{ errorMessage }}
      </div>

      <ProjectForm
        v-if="selectedCompanyId && projectViewData"
        v-model="formData"
        :readonly="!isEditing"
        :partner-options="partnerOptions"
        :type-options="typeOptions"
      />

      <!-- Métricas de tareas y Tablero -->
      <div
        v-if="selectedCompanyId && projectViewData && !isEditing"
        class="border-t border-slate-200 pt-8 mt-8 space-y-8"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">
              Tareas del proyecto
            </h2>
            <p class="text-sm text-slate-500">
              Arrastra las tarjetas entre columnas para cambiar la etapa. Haz clic en el lápiz para editar.
            </p>
          </div>
          <BtnApp
            label="Nueva tarea"
            variant="primary"
            size="sm"
            @click="openCreateTaskPanel"
          />
        </div>

        <StatGrid :stats="metricStats" :columns="4" />

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div
            v-for="col in kanbanStatuses"
            :key="col"
            class="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 min-h-[280px]"
            @dragover.prevent
            @drop="handleKanbanDrop($event, col)"
          >
            <div class="flex items-center justify-between px-1 pb-2">
              <h3 class="text-sm font-semibold text-slate-700">
                {{ kanbanLabels[col] }}
              </h3>
              <span class="text-xs font-medium text-slate-500 tabular-nums">
                {{ tasksForStatus(col).length }}
              </span>
            </div>
            <div class="space-y-2">
              <div
                v-for="task in tasksForStatus(col)"
                :key="task.id ?? ''"
                draggable="true"
                class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/40 cursor-grab active:cursor-grabbing hover:border-indigo-200 transition-colors"
                @dragstart="handleKanbanDragStart($event, task.id!)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-slate-800 truncate">
                      {{ task.name }}
                    </p>
                    <p class="text-xs text-slate-500 mt-0.5">
                      {{ task.code }} · {{ task.progress ?? 0 }}%
                    </p>
                    <p
                      v-if="task.is_overdue"
                      class="text-xs text-red-600 font-medium mt-1"
                    >
                      Vencida
                    </p>
                  </div>
                  <div class="flex shrink-0 gap-1">
                    <button
                      type="button"
                      draggable="false"
                      class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"
                      title="Abrir detalle"
                      aria-label="Abrir vista detalle de la tarea"
                      @mousedown.stop
                      @click.stop="goTaskDetail(task)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"
                      title="Editar"
                      @click="openEditTaskPanel(task)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      title="Eliminar"
                      @click="deleteTaskFn(task)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap gap-1">
                  <BadgeApp
                    :label="task.priority === 'low' ? 'Baja' : task.priority === 'medium' ? 'Media' : task.priority === 'high' ? 'Alta' : 'Urgente'"
                    :variant="task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'secondary'"
                  />
                  <span v-if="task.due_date" class="text-[10px] text-slate-500 self-center">
                    Vence: {{ formatDateShort(task.due_date) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabla alternativa (todas las tareas) -->
        <div class="rounded-2xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">
              Listado de tareas
            </h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Código
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Tarea
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Etapa
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Responsable
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                    Avance
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                    Vence
                  </th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase w-32">
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-slate-200">
                <tr v-for="task in tasks" :key="task.id ?? ''" class="hover:bg-slate-50">
                  <td class="px-4 py-2 text-sm text-slate-600 font-mono">
                    {{ task.code }}
                  </td>
                  <td class="px-4 py-2 text-sm text-slate-800">
                    {{ task.name }}
                  </td>
                  <td class="px-4 py-2 text-sm">
                    {{ kanbanLabels[(task.status ?? 'pending') as ProjectTaskStatus] }}
                  </td>
                  <td class="px-4 py-2 text-sm text-slate-600">
                    {{ task.responsible_display_name || task.responsible_name || '—' }}
                  </td>
                  <td class="px-4 py-2 text-sm text-right font-medium">
                    {{ task.progress ?? 0 }}%
                  </td>
                  <td class="px-4 py-2 text-sm text-right text-slate-600">
                    {{ formatDateShort(task.due_date) }}
                  </td>
                  <td class="px-4 py-2 text-center">
                    <div class="flex justify-center gap-1">
                      <button
                        type="button"
                        draggable="false"
                        class="p-1 text-slate-400 hover:text-indigo-600"
                        title="Abrir detalle"
                        aria-label="Abrir vista detalle de la tarea"
                        @mousedown.stop
                        @click.stop="goTaskDetail(task)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="p-1 text-slate-400 hover:text-indigo-600"
                        @click="openEditTaskPanel(task)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="p-1 text-slate-400 hover:text-amber-600"
                        title="Archivar"
                        @click="archiveTaskFn(task)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="tasks.length === 0">
                  <td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">
                    No hay tareas aún. Crea la primera con «Nueva tarea».
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div class="rounded-2xl border border-slate-200 overflow-hidden">
            <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 class="text-sm font-semibold text-slate-700">
                Órdenes de compra
              </h3>
              <span class="text-xs font-medium text-slate-500">
                Confirmadas: {{ formatMoney(postedPurchaseAmount) }}
              </span>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Orden</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Socio</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200">
                  <tr
                    v-for="order in purchaseOrders"
                    :key="order.id ?? ''"
                    class="hover:bg-slate-50 cursor-pointer"
                    @click="openOrder(order.id)"
                  >
                    <td class="px-4 py-2 text-sm font-medium text-indigo-700">{{ order.name ?? '—' }}</td>
                    <td class="px-4 py-2 text-sm text-slate-600">{{ orderStateLabel[order.order_state ?? 'draft'] ?? order.order_state }}</td>
                    <td class="px-4 py-2 text-sm text-slate-600">{{ order.partner_name ?? '—' }}</td>
                    <td class="px-4 py-2 text-sm text-right font-medium">{{ formatMoney(Number(order.amount_total ?? 0)) }}</td>
                  </tr>
                  <tr v-if="purchaseOrders.length === 0">
                    <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">
                      No hay órdenes de compra vinculadas al proyecto.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 overflow-hidden">
            <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 class="text-sm font-semibold text-slate-700">
                Órdenes de venta
              </h3>
              <span class="text-xs font-medium text-slate-500">
                Confirmadas: {{ formatMoney(postedSaleAmount) }}
              </span>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Orden</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Socio</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200">
                  <tr
                    v-for="order in saleOrders"
                    :key="order.id ?? ''"
                    class="hover:bg-slate-50 cursor-pointer"
                    @click="openOrder(order.id)"
                  >
                    <td class="px-4 py-2 text-sm font-medium text-indigo-700">{{ order.name ?? '—' }}</td>
                    <td class="px-4 py-2 text-sm text-slate-600">{{ orderStateLabel[order.order_state ?? 'draft'] ?? order.order_state }}</td>
                    <td class="px-4 py-2 text-sm text-slate-600">{{ order.partner_name ?? '—' }}</td>
                    <td class="px-4 py-2 text-sm text-right font-medium">{{ formatMoney(Number(order.amount_total ?? 0)) }}</td>
                  </tr>
                  <tr v-if="saleOrders.length === 0">
                    <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">
                      No hay órdenes de venta vinculadas al proyecto.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </CardSheet>

    <!-- Panel lateral tarea -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showTaskPanel" class="fixed inset-0 z-50 overflow-hidden">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeTaskPanel" />

          <Transition
            enter-active-class="transition duration-300 ease-out transform"
            enter-from-class="translate-x-full"
            enter-to-class="translate-x-0"
            leave-active-class="transition duration-200 ease-in transform"
            leave-from-class="translate-x-0"
            leave-to-class="translate-x-full"
          >
            <div
              v-if="showTaskPanel"
              class="absolute right-0 inset-y-0 w-full max-w-lg flex flex-col bg-white shadow-2xl"
            >
              <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50">
                <div>
                  <h3 class="text-lg font-semibold text-slate-800">
                    {{ editingTaskView ? 'Editar tarea' : 'Nueva tarea' }}
                  </h3>
                  <p class="text-sm text-slate-500">
                    {{ editingTaskView ? 'Actualiza el seguimiento de la tarea' : 'La tarea hereda al responsable del proyecto si no eliges otro' }}
                  </p>
                </div>
                <button
                  type="button"
                  class="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                  @click="closeTaskPanel"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="flex-1 overflow-y-auto px-6 py-6">
                <p v-if="taskPanelError" class="mb-4 text-sm text-red-600">
                  {{ taskPanelError }}
                </p>
                <ProjectTaskForm
                  :key="panelKey"
                  v-model="taskFormData"
                  :partner-options="partnerOptions"
                />
              </div>

              <div class="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-slate-50">
                <BtnApp label="Cancelar" variant="secondary" size="sm" @click="closeTaskPanel" />
                <BtnApp
                  :label="editingTaskView ? 'Guardar' : 'Crear'"
                  variant="primary"
                  size="sm"
                  @click="saveTaskPanel"
                />
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
