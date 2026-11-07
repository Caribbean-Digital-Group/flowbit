<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyEmployeeForm,
  mapEmployeeToForm,
  mapFormToEmployeeUpdate,
  type EmployeeFormData
} from '~/components/Employee/Form.vue'
import {
  createEmptyEmployeePrivateForm,
  mapEmployeePrivateToForm,
  mapFormToEmployeePrivateUpdate,
  type EmployeePrivateFormData,
  type EmployeeSensitiveSection
} from '~/components/Employee/SensitiveForm.vue'
import type { EmployeeViewRow } from '~/types/employee.types'

definePageMeta({ layout: 'admin' })

type TabId = 'work' | EmployeeSensitiveSection

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getAll, getById, getPrivate, update, updatePrivate, archive, lastError } = useEmployee()
const { getAll: getDepartments } = useEmployeeDepartment()

const employee = ref<EmployeeViewRow | null>(null)
const workForm = ref<EmployeeFormData>(createEmptyEmployeeForm())
const privateForm = ref<EmployeePrivateFormData>(createEmptyEmployeePrivateForm())
const initialWork = ref<EmployeeFormData>(createEmptyEmployeeForm())
const initialPrivate = ref<EmployeePrivateFormData>(createEmptyEmployeePrivateForm())
const hasPrivateData = ref(false)
const departmentOptions = ref<EmployeeOption[]>([])
const managerOptions = ref<EmployeeOption[]>([])
const activeTab = ref<TabId>('work')
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const employeeId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const tabs = computed<{ id: TabId; label: string }[]>(() => [
  { id: 'work', label: 'Información del trabajo' },
  ...(hasPrivateData.value
    ? [
        { id: 'private' as const, label: 'Información privada' },
        { id: 'hr' as const, label: 'Ajustes de RR. HH.' },
        { id: 'cfdi' as const, label: 'CFDI' }
      ]
    : [])
])

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'archive',
    label: 'Quitar de empleados',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'warning'
  }
])

const load = async () => {
  const id = employeeId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const [row, sensitive, departments, employees] = await Promise.all([
      getById(id, companyId),
      getPrivate(id, companyId),
      getDepartments(companyId),
      getAll(companyId)
    ])

    if (!row) {
      errorMessage.value = 'No se encontró el empleado solicitado o no tienes acceso.'
      return
    }

    employee.value = row
    workForm.value = mapEmployeeToForm(row)
    initialWork.value = { ...workForm.value }

    hasPrivateData.value = sensitive !== null
    if (sensitive) {
      privateForm.value = mapEmployeePrivateToForm(sensitive)
      initialPrivate.value = { ...privateForm.value }
    }

    departmentOptions.value = departments.map(d => ({ value: d.id, label: d.name }))
    managerOptions.value = employees
      .filter(e => e.id !== id)
      .map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
  } finally {
    isLoading.value = false
  }
}

const handleBack = () => {
  router.push('/admin/employees')
}

const handleEdit = () => {
  errorMessage.value = null
  isEditing.value = true
}

const handleCancel = () => {
  workForm.value = { ...initialWork.value }
  privateForm.value = { ...initialPrivate.value }
  isEditing.value = false
  errorMessage.value = null
}

const handleSave = async () => {
  const id = employeeId.value
  if (!id) return

  errorMessage.value = validateEmployeeWork(workForm.value)
    ?? (hasPrivateData.value ? validateEmployeePrivate(privateForm.value) : null)
  if (errorMessage.value) return

  isLoading.value = true
  try {
    const workSaved = await update(id, mapFormToEmployeeUpdate(workForm.value))
    if (!workSaved) {
      errorMessage.value = lastError.value
      return
    }

    if (hasPrivateData.value) {
      const privateSaved = await updatePrivate(id, mapFormToEmployeePrivateUpdate(privateForm.value))
      if (!privateSaved) {
        errorMessage.value = lastError.value
        return
      }
    }

    isEditing.value = false
    await load()
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = employeeId.value
  if (!id) return

  isLoading.value = true
  errorMessage.value = null
  try {
    if (await archive(id)) {
      router.push('/admin/employees')
    } else {
      errorMessage.value = lastError.value
    }
  } finally {
    isLoading.value = false
  }
}

watch([employeeId, selectedCompanyId], () => {
  isEditing.value = false
  activeTab.value = 'work'
  void load()
}, { immediate: true })
</script>

<template>
  <CardSheet
    :title="employee?.partner_name || 'Empleado'"
    :subtitle="employee?.job_title ?? ''"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :show-edit-button="isSelectedCompanyAdmin"
    :show-options-button="isSelectedCompanyAdmin"
    :created-by="employee?.created_by ?? '—'"
    :created-at="employee?.created_at ?? ''"
    :updated-by="employee?.updated_by ?? '—'"
    :updated-at="employee?.updated_at ?? ''"
    :menu-options="menuOptions"
    @back="handleBack"
    @edit="handleEdit"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <template v-if="employee" #status>
      <BadgeApp
        :label="employee.status === 'active' ? 'Activo' : 'Baja'"
        :variant="employee.status === 'active' ? 'success' : 'danger'"
      />
    </template>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <template v-if="employee">
      <section class="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm text-slate-500">
            Datos del contacto
          </p>
          <p class="truncate text-slate-800">
            {{ [employee.partner_email, employee.partner_phone || employee.partner_mobile].filter(Boolean).join(' · ') || 'Sin correo ni teléfono' }}
          </p>
        </div>
        <BtnApp
          variant="secondary"
          size="sm"
          @click="navigateTo(`/admin/partners/${employee?.partner_id}`)"
        >
          Abrir contacto
        </BtnApp>
      </section>

      <div class="mb-6 flex items-center gap-2 overflow-x-auto border-b border-slate-200">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="[
            'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === tab.id ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-700'
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span
            v-if="activeTab === tab.id"
            class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600"
          />
        </button>
      </div>

      <EmployeeForm
        v-if="activeTab === 'work'"
        v-model="workForm"
        :readonly="!isEditing"
        :show-status="true"
        :department-options="departmentOptions"
        :manager-options="managerOptions"
      />
      <EmployeeSensitiveForm
        v-else
        v-model="privateForm"
        :section="activeTab"
        :readonly="!isEditing"
        :show-termination-reason="workForm.status === 'terminated'"
      />
    </template>
  </CardSheet>
</template>
