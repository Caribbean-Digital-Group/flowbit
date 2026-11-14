<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyExpenseCategoryForm,
  mapFormToExpenseCategory,
  type ExpenseCategoryFormData
} from '~/components/ExpenseCategory/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create } = useExpenseCategory()

const formData = ref<ExpenseCategoryFormData>(createEmptyExpenseCategoryForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => router.push('/admin/expense-categories')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }

  errorMessage.value = null
  isSaving.value = true
  try {
    const result = await create(cid, mapFormToExpenseCategory(formData.value))
    if (!result) { errorMessage.value = 'No se pudo crear la categoría. Revisa que el nombre no esté repetido.'; return }
    router.push(`/admin/expense-categories/${result.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/expense-categories')
</script>

<template>
  <CardSheet
    title="Nueva categoría de gasto"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <ExpenseCategoryForm v-model="formData" />
  </CardSheet>
</template>
