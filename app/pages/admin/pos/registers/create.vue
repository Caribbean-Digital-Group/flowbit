<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyPosRegisterForm,
  type PosRegisterFormData
} from '~/components/Pos/RegisterForm.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create } = usePosRegister()
const { getWarehousesByCompany } = useWarehouse()
const { getPartnersByCompany } = usePartner()

const formData = ref<PosRegisterFormData>(createEmptyPosRegisterForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const warehouseOptions = ref<{ value: string; label: string }[]>([])
const partnerOptions = ref<{ value: string; label: string }[]>([])

const loadOptions = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return

  const [warehouses, partners] = await Promise.all([
    getWarehousesByCompany(cid),
    getPartnersByCompany(cid, { relationshipType: 'partner' })
  ])

  warehouseOptions.value = warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.code})` }))
  partnerOptions.value = partners.map(p => ({ value: p.id, label: p.display_name || p.name }))
}

watch(selectedCompanyId, loadOptions, { immediate: true })

const handleBack = () => router.push('/admin/pos/registers')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  if (!formData.value.code.trim()) { errorMessage.value = 'El código es obligatorio.'; return }

  errorMessage.value = null
  isSaving.value = true
  try {
    const result = await create(cid, {
      name: formData.value.name.trim(),
      code: formData.value.code.trim(),
      description: formData.value.description.trim() || null,
      warehouse_id: formData.value.warehouse_id,
      default_partner_id: formData.value.default_partner_id,
      max_discount_percent: formData.value.max_discount_percent,
      blind_close: formData.value.blind_close,
      difference_tolerance: formData.value.difference_tolerance,
      active: formData.value.active
    })
    if (!result) { errorMessage.value = 'No se pudo crear la caja (requiere rol de administrador).'; return }
    router.push(`/admin/pos/registers/${result.id}`)
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => router.push('/admin/pos/registers')
</script>

<template>
  <CardSheet
    title="Nueva Caja"
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

    <PosRegisterForm
      v-model="formData"
      :warehouse-options="warehouseOptions"
      :partner-options="partnerOptions"
    />
  </CardSheet>
</template>
