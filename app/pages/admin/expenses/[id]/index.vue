<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import type { ExpenseStatus } from '~/types/expense.types'
import {
  createEmptyExpenseForm,
  mapExpenseToForm,
  mapFormToExpense,
  validateExpenseForm,
  type ExpenseFormData
} from '~/components/Expense/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, setStatus, archive, lastError } = useExpense()
const lookups = useExpenseLookups()
const { partnerOptions, projectOptions, paymentMethodOptions } = lookups

const expenseId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<ExpenseFormData>(createEmptyExpenseForm())
let snapshot: ExpenseFormData = createEmptyExpenseForm()

// Incluye la categoría archivada del gasto para que su nombre siga visible.
const categoryOptions = computed(() => {
  const current = formData.value.category_id
  const options = [...lookups.categoryOptions.value]
  if (current && !options.some(o => o.value === current)) {
    const archived = lookups.categories.value.find(c => c.id === current)
    if (archived) options.push({ value: archived.id, label: `${archived.name} (archivada)` })
  }
  return options
})

const statusLabel = computed(() => EXPENSE_STATUS_LABELS[formData.value.status] ?? '')

const ICON_CHECK = 'M5 13l4 4L19 7'
const ICON_CASH = 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'
const ICON_X = 'M6 18L18 6M6 6l12 12'
const ICON_ARCHIVE = 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'

const menuOptions = computed<MenuOption[]>(() => {
  const status = formData.value.status
  const options: MenuOption[] = []
  if (status === 'draft') {
    options.push({ id: 'approve', label: 'Aprobar', icon: ICON_CHECK, action: () => void changeStatus('approved') })
  }
  if (status === 'draft' || status === 'approved') {
    options.push({ id: 'pay', label: 'Marcar como pagado', icon: ICON_CASH, action: () => void changeStatus('paid') })
    options.push({ id: 'cancel', label: 'Cancelar gasto', icon: ICON_X, action: () => void changeStatus('cancelled') })
  }
  if (status === 'paid' || status === 'cancelled') {
    options.push({ id: 'reopen', label: 'Regresar a borrador', icon: ICON_X, action: () => void changeStatus('draft') })
  }
  options.push({ id: 'archive', label: 'Archivar', icon: ICON_ARCHIVE, action: () => void handleArchive(), variant: 'danger' })
  return options
})

const load = async () => {
  const id = expenseId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const row = await getById(id, cid)
    if (!row) { errorMessage.value = lastError.value ?? 'Gasto no encontrado.'; return }
    const mapped = mapExpenseToForm(row)
    formData.value = mapped
    snapshot = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, (cid) => { void lookups.load(cid) }, { immediate: true })
watch([expenseId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleBack = () => router.push('/admin/expenses')

const handleEdit = () => { errorMessage.value = null; isEditing.value = true }

const handleCancel = () => { formData.value = { ...snapshot }; isEditing.value = false }

const handleSave = async () => {
  const id = expenseId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  const invalid = validateExpenseForm(formData.value)
  if (invalid) { errorMessage.value = invalid; return }

  errorMessage.value = null
  isLoading.value = true
  try {
    const result = await update(id, cid, mapFormToExpense(formData.value))
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo actualizar el gasto.'; return }
    const mapped = mapExpenseToForm(result)
    formData.value = mapped
    snapshot = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const changeStatus = async (status: ExpenseStatus) => {
  const id = expenseId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const result = await setStatus(id, cid, status)
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo cambiar el estado.'; return }
    const mapped = mapExpenseToForm(result)
    formData.value = mapped
    snapshot = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = expenseId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  try {
    const ok = await archive(id, cid)
    if (!ok) { errorMessage.value = lastError.value ?? 'No se pudo archivar.'; return }
    router.push('/admin/expenses')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <CardSheet
    :title="formData.description || 'Gasto'"
    :subtitle="statusLabel"
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

    <ExpenseForm
      v-model="formData"
      :readonly="!isEditing"
      :category-options="categoryOptions"
      :partner-options="partnerOptions"
      :project-options="projectOptions"
      :payment-method-options="paymentMethodOptions"
    />
  </CardSheet>
</template>
