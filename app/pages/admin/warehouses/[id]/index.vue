<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyWarehouseForm, type WarehouseFormData } from '~/components/Warehouse/Form.vue'
import type { Tables, TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type Warehouse = Tables<'warehouse'>

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getWarehouseById, updateWarehouse, archiveWarehouse } = useWarehouse()

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const row = ref<Warehouse | null>(null)
const formData = ref<WarehouseFormData>(createEmptyWarehouseForm())
const initialForm = ref<WarehouseFormData>(createEmptyWarehouseForm())

const rowId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const menuOptions: MenuOption[] = [
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'warning'
  }
]

const mapRowToForm = (value: Warehouse): WarehouseFormData => ({
  name: value.name,
  code: value.code,
  description: value.description ?? '',
  is_default: value.is_default === true,
  active: value.active !== false
})

const mapFormToUpdate = (value: WarehouseFormData): TablesUpdate<'warehouse'> => ({
  name: value.name.trim(),
  code: value.code.trim().toUpperCase(),
  description: value.description.trim() || null,
  is_default: value.is_default,
  active: value.active
})

const loadRow = async () => {
  const id = rowId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const found = await getWarehouseById(id, companyId)
    if (!found) {
      errorMessage.value = 'No se encontró el almacén.'
      return
    }
    row.value = found
    const mapped = mapRowToForm(found)
    formData.value = mapped
    initialForm.value = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch([rowId, selectedCompanyId], () => {
  isEditing.value = false
  loadRow()
}, { immediate: true })

const handleSave = async () => {
  const id = rowId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const updated = await updateWarehouse(id, companyId, mapFormToUpdate(formData.value))
    if (!updated) {
      errorMessage.value = 'No se pudo actualizar el almacén.'
      return
    }
    row.value = updated
    const mapped = mapRowToForm(updated)
    formData.value = mapped
    initialForm.value = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = rowId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId) return

  isLoading.value = true
  try {
    const ok = await archiveWarehouse(id, companyId)
    if (!ok) {
      errorMessage.value = 'No se pudo archivar el almacén.'
      return
    }
    router.push('/admin/warehouses')
  } finally {
    isLoading.value = false
  }
}

const handleCancelEdit = () => {
  isEditing.value = false
  formData.value = { ...initialForm.value }
}
</script>

<template>
  <CardSheet
    :title="formData.name || 'Almacén'"
    :subtitle="formData.code || 'Sin código'"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :menu-options="menuOptions"
    @back="router.push('/admin/warehouses')"
    @edit="isEditing = true"
    @save="handleSave"
    @cancel="handleCancelEdit"
  >
    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <WarehouseForm v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
