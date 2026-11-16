<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyExpenseForm,
  mapFormToExpense,
  validateExpenseForm,
  type ExpenseFormData
} from '~/components/Expense/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { create, lastError } = useExpense()
const { categoryOptions, partnerOptions, projectOptions, paymentMethodOptions, load: loadLookups } = useExpenseLookups()

const queryString = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : ''
}

const buildInitialForm = (): ExpenseFormData => ({
  ...createEmptyExpenseForm(selectedCompany.value?.currency || 'MXN'),
  // Permite abrir el formulario prellenado desde otros módulos (?project=…&partner=…).
  project_id: queryString(route.query.project),
  partner_id: queryString(route.query.partner),
  category_id: queryString(route.query.category)
})

const formData = ref<ExpenseFormData>(buildInitialForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

watch(selectedCompanyId, (cid) => { void loadLookups(cid) }, { immediate: true })

const handleBack = () => router.push('/admin/expenses')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  const invalid = validateExpenseForm(formData.value)
  if (invalid) { errorMessage.value = invalid; return }

  errorMessage.value = null
  isSaving.value = true
  try {
    const result = await create(cid, mapFormToExpense(formData.value))
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo registrar el gasto.'; return }
    router.push(`/admin/expenses/${result.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/expenses')
</script>

<template>
  <CardSheet
    title="Nuevo gasto"
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

    <ExpenseForm
      v-model="formData"
      :category-options="categoryOptions"
      :partner-options="partnerOptions"
      :project-options="projectOptions"
      :payment-method-options="paymentMethodOptions"
    />
  </CardSheet>
</template>
