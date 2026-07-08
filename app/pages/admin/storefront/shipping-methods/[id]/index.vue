<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyStorefrontShippingMethodForm,
  type StorefrontShippingMethodFormData
} from '~/components/StorefrontShippingMethod/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, archive } = useStorefrontShippingMethod()

const methodId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<StorefrontShippingMethodFormData>(createEmptyStorefrontShippingMethodForm())
let snapshot: StorefrontShippingMethodFormData = createEmptyStorefrontShippingMethodForm()

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
  const id = methodId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const row = await getById(id, cid)
    if (!row) { errorMessage.value = 'Método de envío no encontrado.'; return }
    const mapped: StorefrontShippingMethodFormData = {
      name: row.name,
      description: row.description ?? '',
      price: row.price,
      delivery_estimate: row.delivery_estimate ?? '',
      display_order: row.display_order ?? 0,
      active: row.active ?? true
    }
    formData.value = mapped
    snapshot = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch([methodId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleBack = () => router.push('/admin/storefront/shipping-methods')

const handleEdit = () => { errorMessage.value = null; isEditing.value = true }

const handleCancel = () => { formData.value = { ...snapshot }; isEditing.value = false }

const handleSave = async () => {
  const id = methodId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }

  errorMessage.value = null
  isLoading.value = true
  try {
    const result = await update(id, cid, {
      name: formData.value.name.trim(),
      description: formData.value.description.trim() || null,
      price: formData.value.price || 0,
      delivery_estimate: formData.value.delivery_estimate.trim() || null,
      display_order: formData.value.display_order || 0,
      active: formData.value.active
    })
    if (!result) { errorMessage.value = 'No se pudo actualizar el método de envío.'; return }
    snapshot = { ...formData.value }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = methodId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  try {
    const ok = await archive(id, cid)
    if (!ok) { errorMessage.value = 'No se pudo archivar.'; return }
    router.push('/admin/storefront/shipping-methods')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <CardSheet
    :title="formData.name || 'Método de Envío'"
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

    <StorefrontShippingMethodForm v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
