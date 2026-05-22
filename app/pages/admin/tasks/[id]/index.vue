<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyProjectTaskForm,
  type ProjectTaskFormData
} from '~/components/ProjectTask/Form.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type TaskViewRow = Database['public']['Views']['v_project_tasks']['Row']
type ProjectTaskStatus = Database['public']['Enums']['project_task_status']

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getTaskViewById, updateTask, archiveTask } = useProjectTask()
const { getPartnersByCompany } = usePartner()

const taskId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const taskView = ref<TaskViewRow | null>(null)
const taskForm = ref<ProjectTaskFormData>(createEmptyProjectTaskForm())
const initialForm = ref<ProjectTaskFormData>(createEmptyProjectTaskForm())

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const partnerOptions = ref<{ value: string; label: string }[]>([])

const taskStatusLabels: Record<ProjectTaskStatus, string> = {
  pending: 'Inicio',
  in_progress: 'En proceso',
  completed: 'Terminado',
  cancelled: 'Cancelado'
}

const taskStatusVariants: Record<
  ProjectTaskStatus,
  'secondary' | 'primary' | 'success' | 'danger'
> = {
  pending: 'secondary',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'danger'
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

const formatDateIso = (s: string | null | undefined): string => {
  if (!s) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(s))
}

const metadata = computed(() => {
  const v = taskView.value
  return {
    createdBy: v?.created_by ?? '—',
    createdAt: v?.created_at ?? '',
    updatedBy: v?.updated_by ?? '—',
    updatedAt: v?.updated_at ?? ''
  }
})

const pageSubtitle = computed(() => {
  const code = taskForm.value.code?.trim()
  const pn = taskView.value?.project_name?.trim()
  const pc = taskView.value?.project_code?.trim()
  const projectPart = [pc, pn].filter(Boolean).join(' · ')
  if (code && projectPart) return `${code} · ${projectPart}`
  if (code) return code
  return projectPart || undefined
})

const menuOptions = computed<MenuOption[]>(() => {
  const pid = taskView.value?.project_id
  const items: MenuOption[] = []
  if (pid) {
    items.push({
      id: 'open-project',
      label: 'Ir al proyecto',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
      action: () => router.push(`/admin/projects/${pid}`),
      variant: 'default'
    })
  }
  items.push({
    id: 'archive',
    label: 'Archivar tarea',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8',
    divider: true,
    action: () => void handleArchive(),
    variant: 'warning'
  })
  return items
})

async function loadPartnerOptions() {
  const companyId = selectedCompanyId.value
  partnerOptions.value = []
  if (!companyId) return

  const partners = await getPartnersByCompany(companyId)
  partnerOptions.value = partners.map((p) => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))
}

async function loadTask() {
  const id = taskId.value
  const companyId = selectedCompanyId.value
  errorMessage.value = null
  taskView.value = null

  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa para ver esta tarea.'
    return
  }
  if (!id) {
    errorMessage.value = 'Identificador de tarea no válido.'
    return
  }

  isLoading.value = true
  try {
    const row = await getTaskViewById(id, companyId)
    if (!row) {
      errorMessage.value = 'No se encontró la tarea o no tienes acceso.'
      return
    }
    taskView.value = row
    const mapped = mapTaskViewToForm(row)
    taskForm.value = mapped
    initialForm.value = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

const handleBack = () => {
  router.push('/admin/tasks')
}

const handleEdit = () => {
  errorMessage.value = null
  isEditing.value = true
}

const handleCancel = () => {
  taskForm.value = { ...initialForm.value }
  isEditing.value = false
  errorMessage.value = null
}

const handleSave = async () => {
  const id = taskId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId || !taskView.value) return

  const name = taskForm.value.name.trim()
  if (!name) {
    errorMessage.value = 'El nombre de la tarea es obligatorio.'
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const eh = Number(taskForm.value.estimated_hours)
    const ah = Number(taskForm.value.actual_hours)
    const ec = Number(taskForm.value.estimated_cost)
    const ac = Number(taskForm.value.actual_cost)
    const prog = Number(taskForm.value.progress)
    const ord = Number(taskForm.value.order_index)

    const updated = await updateTask(id, companyId, {
      name,
      description: taskForm.value.description.trim() || null,
      status: taskForm.value.status,
      priority: taskForm.value.priority,
      responsible_partner_id: taskForm.value.responsible_partner_id,
      start_date: taskForm.value.start_date || null,
      due_date: taskForm.value.due_date || null,
      estimated_hours: Number.isFinite(eh) ? eh : 0,
      actual_hours: Number.isFinite(ah) ? ah : 0,
      estimated_cost: Number.isFinite(ec) ? ec : 0,
      actual_cost: Number.isFinite(ac) ? ac : 0,
      progress: Number.isFinite(prog) ? Math.min(100, Math.max(0, Math.round(prog))) : 0,
      order_index: Number.isFinite(ord) ? Math.round(ord) : 10,
      notes: taskForm.value.notes.trim() || null
    })

    if (!updated) {
      errorMessage.value = 'No se pudo guardar la tarea.'
      return
    }

    const refreshed = await getTaskViewById(id, companyId)
    if (refreshed) {
      taskView.value = refreshed
      const mapped = mapTaskViewToForm(refreshed)
      taskForm.value = mapped
      initialForm.value = { ...mapped }
    }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = taskId.value
  if (!id) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const ok = await archiveTask(id)
    if (!ok) {
      errorMessage.value = 'No se pudo archivar la tarea.'
      return
    }
    router.push('/admin/tasks')
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => {
  void loadPartnerOptions()
}, { immediate: true })

watch([taskId, selectedCompanyId], () => {
  isEditing.value = false
  void loadTask()
}, { immediate: true })
</script>

<template>
  <div>
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900 shadow-sm"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa arriba para ver el detalle de la tarea.
      </p>
      <button
        type="button"
        class="mt-4 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100/50"
        @click="handleBack"
      >
        Volver al tablero de tareas
      </button>
    </div>

    <template v-else>
      <div
        v-if="errorMessage && !taskView"
        class="mb-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
      >
        <p>{{ errorMessage }}</p>
        <button
          type="button"
          class="mt-4 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100/50"
          @click="handleBack"
        >
          Volver al tablero de tareas
        </button>
      </div>

      <CardSheet
        v-if="taskView"
        :title="taskForm.name || 'Tarea'"
        :subtitle="pageSubtitle"
        :show-back-button="true"
        :show-options-button="menuOptions.length > 0 && !isEditing"
        :show-edit-button="!isEditing"
        :show-footer="true"
        :is-editing="isEditing"
        :is-loading="isLoading"
        :created-by="metadata.createdBy"
        :created-at="formatDateIso(metadata.createdAt)"
        :updated-by="metadata.updatedBy"
        :updated-at="formatDateIso(metadata.updatedAt)"
        :menu-options="menuOptions"
        variant="elevated"
        padding="lg"
        @back="handleBack"
        @edit="handleEdit"
        @save="handleSave"
        @cancel="handleCancel"
      >
        <template #status>
          <div class="flex flex-wrap items-center gap-2">
            <BadgeApp
              :label="taskStatusLabels[taskForm.status]"
              :variant="taskStatusVariants[taskForm.status]"
            />
            <BadgeApp
              v-if="taskView?.is_overdue === true && taskForm.status !== 'completed' && taskForm.status !== 'cancelled'"
              label="Atrasada"
              variant="danger"
            />
          </div>
        </template>

        <div
          v-if="errorMessage && taskView"
          class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
        >
          {{ errorMessage }}
        </div>

        <NuxtLink
          v-if="taskView.project_id"
          :to="`/admin/projects/${taskView.project_id}`"
          class="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-white to-indigo-50/40 px-4 py-3 text-sm font-medium text-indigo-800 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
        >
          <svg class="h-5 w-5 shrink-0 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span class="truncate">Abrir proyecto: {{ taskView.project_name ?? taskView.project_code ?? 'Sin nombre' }}</span>
        </NuxtLink>

        <ProjectTaskForm
          v-model="taskForm"
          :readonly="!isEditing"
          :partner-options="partnerOptions"
        />
      </CardSheet>
    </template>
  </div>
</template>
