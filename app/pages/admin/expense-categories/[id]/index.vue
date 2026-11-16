<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyExpenseCategoryForm,
  mapExpenseCategoryToForm,
  mapFormToExpenseCategory,
  type ExpenseCategoryFormData
} from '~/components/ExpenseCategory/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, archive } = useExpenseCategory()

const categoryId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<ExpenseCategoryFormData>(createEmptyExpenseCategoryForm())
let snapshot: ExpenseCategoryFormData = createEmptyExpenseCategoryForm()

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'expenses',
    label: 'Ver gastos de esta categoría',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2',
    action: () => void router.push({ path: '/admin/expenses', query: { category: categoryId.value } })
  },
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'danger'
  }
])

const load = async () => {
  const id = categoryId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const row = await getById(id, cid)
    if (!row) { errorMessage.value = 'Categoría no encontrada.'; return }
    const mapped = mapExpenseCategoryToForm(row)
    formData.value = mapped
    snapshot = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch([categoryId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleBack = () => router.push('/admin/expense-categories')

const handleEdit = () => { errorMessage.value = null; isEditing.value = true }

const handleCancel = () => { formData.value = { ...snapshot }; isEditing.value = false }

const handleSave = async () => {
  const id = categoryId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }

  errorMessage.value = null
  isLoading.value = true
  try {
    const result = await update(id, cid, mapFormToExpenseCategory(formData.value))
    if (!result) { errorMessage.value = 'No se pudo actualizar la categoría. Revisa que el nombre no esté repetido.'; return }
    snapshot = { ...formData.value }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = categoryId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  try {
    const ok = await archive(id, cid)
    if (!ok) { errorMessage.value = 'No se pudo archivar.'; return }
    router.push('/admin/expense-categories')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <CardSheet
    :title="formData.name || 'Categoría de gasto'"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :menu-options="menuOptions"
    @back="handleBack"
    @edit="handleEdit"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <ExpenseCategoryForm v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
