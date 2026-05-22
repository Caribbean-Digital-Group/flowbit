<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyWarehouseForm, type WarehouseFormData } from '~/components/Warehouse/Form.vue'
import type { TablesInsert } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { createWarehouse } = useWarehouse()

const formData = ref<WarehouseFormData>(createEmptyWarehouseForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const mapFormToInsert = (value: WarehouseFormData): Omit<TablesInsert<'warehouse'>, 'company_id'> => ({
  name: value.name.trim(),
  code: value.code.trim().toUpperCase(),
  description: value.description.trim() || null,
  is_default: value.is_default,
  active: value.active
})

const handleSave = async () => {
  errorMessage.value = null
  if (!formData.value.name.trim() || !formData.value.code.trim()) {
    errorMessage.value = 'Nombre y código son obligatorios.'
    return
  }
  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa antes de crear el almacén.'
    return
  }

  isSaving.value = true
  try {
    const created = await createWarehouse(companyId, mapFormToInsert(formData.value))
    if (!created) {
      errorMessage.value = 'No se pudo crear el almacén.'
      return
    }
    router.push(`/admin/warehouses/${created.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nuevo Almacén"
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="router.push('/admin/warehouses')"
    @save="handleSave"
    @cancel="router.push('/admin/warehouses')"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <WarehouseForm v-model="formData" />
  </CardSheet>
</template>
