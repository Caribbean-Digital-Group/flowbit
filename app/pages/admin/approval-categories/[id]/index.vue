<script setup lang="ts">
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyApprovalCategoryForm,
  type ApprovalCategoryFormData
} from '~/components/ApprovalCategory/Form.vue'
import type { Tables, TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type Category = Tables<'approval_category'>

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const { selectedCompanyId, companies } = storeToRefs(authStore)

const {
  getCategoryById,
  updateCategory,
  archiveCategory,
  restoreCategory
} = useApprovalCategory()

const isWorkspaceAdmin = computed(() => {
  const id = selectedCompanyId.value
  const r = companies.value.find(c => c.company.id === id)?.role
  return r === 'owner' || r === 'admin'
})

const id = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const entity = ref<Category | null>(null)
const form = ref<ApprovalCategoryFormData>(createEmptyApprovalCategoryForm())
const initial = ref<ApprovalCategoryFormData>(createEmptyApprovalCategoryForm())

const mapToForm = (c: Category): ApprovalCategoryFormData => ({
  name: c.name ?? '',
  internal_code: c.internal_code ?? '',
  description: c.description ?? '',
  active: c.active ?? true
})

const menuOptions = computed<MenuOption[]>(() => {
  if (!isWorkspaceAdmin.value || !entity.value) return []
  const isArchived = !!entity.value.archived
  return [
    {
      id: 'toggle-archive',
      label: isArchived ? 'Restaurar categoría' : 'Archivar categoría',
      icon: isArchived
        ? 'M12 6v6m0 0v6m0-6h6m-6 0H6'
        : 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5',
      action: () => void handleArchiveToggle(),
      variant: isArchived ? 'success' : 'warning'
    }
  ]
})

const load = async () => {
  const cid = selectedCompanyId.value
  const tid = id.value
  if (!cid || !tid) {
    errorMessage.value = 'Faltan datos de navegación.'
    return
  }
  isLoading.value = true
  errorMessage.value = null
  try {
    const data = await getCategoryById(tid, cid)
    if (!data) {
      errorMessage.value = 'No se encontró la categoría.'
      return
    }
    entity.value = data
    const m = mapToForm(data)
    form.value = m
    initial.value = { ...m }
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, id], load, { immediate: true })

const handleBack = () => router.push('/admin/approval-categories')

const handleEdit = () => {
  errorMessage.value = null
  if (!entity.value?.archived) isEditing.value = true
}

const handleCancel = () => {
  form.value = { ...initial.value }
  isEditing.value = false
  errorMessage.value = null
}

const mapUpdate = (v: ApprovalCategoryFormData): TablesUpdate<'approval_category'> => ({
  name: v.name.trim(),
  description: v.description.trim() || null,
  active: v.active
})

const handleSave = async () => {
  const tid = id.value
  if (!tid || !entity.value) return

  if (!form.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }

  isLoading.value = true
  errorMessage.value = null
  try {
    const saved = await updateCategory(tid, mapUpdate(form.value))
    if (!saved) {
      errorMessage.value = 'No se pudo guardar.'
      return
    }
    entity.value = saved
    const m = mapToForm(saved)
    form.value = m
    initial.value = { ...m }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchiveToggle = async () => {
  const tid = id.value
  if (!tid || !entity.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const next = entity.value.archived
      ? await restoreCategory(tid)
      : await archiveCategory(tid)
    if (!next) {
      errorMessage.value = 'No se pudo actualizar el archivado.'
      return
    }
    entity.value = next
    const m = mapToForm(next)
    form.value = m
    initial.value = { ...m }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Selecciona una empresa.
    </div>

    <div
      v-else-if="!isWorkspaceAdmin"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-4"
    >
      No tienes permisos para esta sección.
    </div>

    <CardSheet
      v-else
      :title="entity?.name || 'Categoría'"
      :subtitle="entity ? `Código: ${entity.internal_code}` : 'Cargando…'"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :show-options-button="menuOptions.length > 0"
      :menu-options="menuOptions"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
      <p v-if="errorMessage" class="mb-4 text-sm font-medium text-red-600">
        {{ errorMessage }}
      </p>

      <div
        v-if="entity?.archived"
        class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm"
      >
        Esta categoría está archivada: no aparece al crear nuevas solicitudes hasta que la restablezcas.
      </div>

      <ApprovalCategoryForm v-model="form" :readonly="!isEditing || !!entity?.archived" code-readonly />
    </CardSheet>
  </div>
</template>
