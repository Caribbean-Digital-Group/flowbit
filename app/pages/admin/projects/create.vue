<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyProjectForm,
  type ProjectFormData
} from '~/components/Project/Form.vue'
import type { TablesInsert } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { createProject } = useProject()
const { getProjectTypesByCompany } = useProjectType()
const { getPartnersByCompany } = usePartner()

const formData = ref<ProjectFormData>(createEmptyProjectForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const partnerOptions = ref<{ value: string; label: string }[]>([])
const typeOptions = ref<{ value: string; label: string }[]>([])

const loadOptions = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return

  const [partners, types] = await Promise.all([
    getPartnersByCompany(companyId),
    getProjectTypesByCompany(companyId)
  ])

  partnerOptions.value = partners.map(p => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))

  typeOptions.value = types.map(t => ({
    value: t.id,
    label: t.name
  }))
}

watch(selectedCompanyId, () => {
  void loadOptions()
}, { immediate: true })

const mapFormToInsert = (
  value: ProjectFormData
): Omit<TablesInsert<'project'>, 'company_id'> => {
  const budget = Number(value.budget_estimated)
  return {
    name: value.name.trim(),
    description: value.description.trim() || null,
    project_type_id: value.project_type_id,
    responsible_partner_id: value.responsible_partner_id ?? '',
    status: value.status,
    priority: value.priority,
    start_date: value.start_date || null,
    end_date_estimated: value.end_date_estimated || null,
    budget_estimated: Number.isFinite(budget) ? budget : 0,
    color: value.color.trim() || '#6366F1',
    notes: value.notes.trim() || null
  }
}

const handleBack = () => {
  router.push('/admin/projects')
}

const handleSave = async () => {
  errorMessage.value = null

  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa para crear un proyecto.'
    return
  }
  if (!formData.value.name.trim()) {
    errorMessage.value = 'El nombre del proyecto es obligatorio.'
    return
  }
  if (!formData.value.responsible_partner_id) {
    errorMessage.value = 'Asigna un responsable al proyecto.'
    return
  }

  isSaving.value = true
  try {
    const project = await createProject(companyId, mapFormToInsert(formData.value))
    if (!project) {
      errorMessage.value = 'No se pudo crear el proyecto. Verifica tus permisos.'
      return
    }
    router.push(`/admin/projects/${project.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  router.push('/admin/projects')
}
</script>

<template>
  <CardSheet
    title="Nuevo Proyecto"
    subtitle="Registra la información general y asigna un responsable"
    :is-editing="true"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    :is-loading="isSaving"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="!selectedCompanyId"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para registrar nuevos proyectos.
      </p>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <ProjectForm
      v-model="formData"
      :partner-options="partnerOptions"
      :type-options="typeOptions"
    />
  </CardSheet>
</template>
