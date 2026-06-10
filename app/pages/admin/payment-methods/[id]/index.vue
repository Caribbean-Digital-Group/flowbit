<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyPaymentMethodForm,
  type PaymentMethodFormData
} from '~/components/PaymentMethod/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, archive } = usePaymentMethod()

const pmId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<PaymentMethodFormData>(createEmptyPaymentMethodForm())
let snapshot: PaymentMethodFormData = createEmptyPaymentMethodForm()

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'danger'
  }
])

const load = async () => {
  const id = pmId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const row = await getById(id, cid)
    if (!row) { errorMessage.value = 'Método de pago no encontrado.'; return }
    const mapped: PaymentMethodFormData = {
      name: row.name,
      code: row.code ?? '',
      description: row.description ?? '',
      is_cash: row.is_cash ?? false,
      active: row.active ?? true
    }
    formData.value = mapped
    snapshot = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch([pmId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleBack = () => router.push('/admin/payment-methods')

const handleEdit = () => { errorMessage.value = null; isEditing.value = true }

const handleCancel = () => { formData.value = { ...snapshot }; isEditing.value = false }

const handleSave = async () => {
  const id = pmId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }

  errorMessage.value = null
  isLoading.value = true
  try {
    const result = await update(id, cid, {
      name: formData.value.name.trim(),
      code: formData.value.code.trim() || null,
      description: formData.value.description.trim() || null,
      is_cash: formData.value.is_cash,
      active: formData.value.active
    })
    if (!result) { errorMessage.value = 'No se pudo actualizar el método de pago.'; return }
    snapshot = { ...formData.value }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = pmId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  try {
    const ok = await archive(id, cid)
    if (!ok) { errorMessage.value = 'No se pudo archivar.'; return }
    router.push('/admin/payment-methods')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <CardSheet
    :title="formData.name || 'Método de Pago'"
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

    <PaymentMethodForm v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
