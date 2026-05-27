<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyApprovalManagerForm,
  type ApprovalManagerFormData
} from '~/components/ApprovalManager/Form.vue'

definePageMeta({
  layout: 'admin'
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, companies } = storeToRefs(authStore)

const { getManagerById, updateManager } = useApprovalManager()
const { getSelectableCategoriesForRequests } = useApprovalCategory()

const isWorkspaceAdmin = computed(() => {
  const id = selectedCompanyId.value
  const r = companies.value.find(c => c.company.id === id)?.role
  return r === 'owner' || r === 'admin'
})

const mid = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const partnerOptionsForDisplay = ref<{ value: string; label: string; hasUser: boolean }[]>([])
const categoryOptions = ref<{ id: string; label: string }[]>([])

const form = ref<ApprovalManagerFormData>(createEmptyApprovalManagerForm())
const initial = ref<ApprovalManagerFormData>(createEmptyApprovalManagerForm())

const mapRowToForm = async (companyId: string, managerId: string) => {
  const entity = await getManagerById(managerId, companyId)
  if (!entity) return null
  const categoryIds =
    entity.approval_manager_category?.map((c) => c.approval_category_id) ?? []

  partnerOptionsForDisplay.value = [
    {
      value: entity.partner_id,
      label: (
        (entity.partner?.display_name ?? '').trim() ||
        (entity.partner?.name ?? '').trim() ||
        entity.partner?.email ||
        entity.partner_id
      ),
      hasUser: Boolean(entity.partner?.user_id)
    }
  ]

  const fm: ApprovalManagerFormData = {
    partner_id: entity.partner_id,
    notes: entity.notes ?? '',
    active: entity.active,
    category_ids: categoryIds
  }
  form.value = fm
  initial.value = { ...fm, category_ids: [...categoryIds] }
  return entity
}

const load = async () => {
  const companyId = selectedCompanyId.value
  const id = mid.value
  if (!companyId || !id) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const cats = await getSelectableCategoriesForRequests(companyId)
    categoryOptions.value = cats.map((c) => ({
      id: c.id,
      label: c.name
    }))
    const ok = await mapRowToForm(companyId, id)
    if (!ok) {
      errorMessage.value = 'Registro no encontrado.'
    }
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, mid], load, { immediate: true })

const handleBack = () => router.push('/admin/approval-managers')

const handleEdit = () => {
  errorMessage.value = null
  isEditing.value = true
}

const handleCancel = () => {
  form.value = {
    ...initial.value,
    category_ids: [...initial.value.category_ids]
  }
  isEditing.value = false
}

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  const id = mid.value
  if (!companyId || !id) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const saved = await updateManager(id, companyId, {
      notes: form.value.notes.trim() || null,
      active: form.value.active
    }, [...form.value.category_ids])

    if (!saved) {
      errorMessage.value = 'No se pudo guardar.'
      return
    }

    await mapRowToForm(companyId, id)
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const title = computed(() => partnerOptionsForDisplay.value[0]?.label || 'Gerente / aprobador')
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId || !isWorkspaceAdmin"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-4"
    >
      No disponible para tu perfil.
    </div>

    <CardSheet
      v-else
      :title="title"
      subtitle="Gerente dentro del módulo de aprobaciones"
      :is-editing="isEditing"
      :is-loading="isLoading"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
      <p v-if="errorMessage" class="mb-4 text-sm font-medium text-red-600">
        {{ errorMessage }}
      </p>

      <ApprovalManagerForm
        v-model="form"
        partner-locked
        :readonly="!isEditing"
        :partner-options="partnerOptionsForDisplay"
        :category-options="categoryOptions"
      />

      <p class="mt-6 text-xs text-slate-500">
        Para cambiar el partner vinculado, crea un nuevo registro y desactiva el anterior si ya no debe operar como aprobador.
      </p>
    </CardSheet>
  </div>
</template>
