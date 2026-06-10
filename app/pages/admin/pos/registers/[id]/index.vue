<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyPosRegisterForm,
  type PosRegisterFormData
} from '~/components/Pos/RegisterForm.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, archive } = usePosRegister()
const { getWarehousesByCompany } = useWarehouse()
const { getPartnersByCompany } = usePartner()

const registerId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<PosRegisterFormData>(createEmptyPosRegisterForm())
let snapshot: PosRegisterFormData = createEmptyPosRegisterForm()

const warehouseOptions = ref<{ value: string; label: string }[]>([])
const partnerOptions = ref<{ value: string; label: string }[]>([])

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'open-pos',
    label: 'Abrir terminal POS',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    action: () => router.push('/pos')
  },
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'danger',
    divider: true
  }
])

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

const load = async () => {
  const id = registerId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const row = await getById(id, cid)
    if (!row) { errorMessage.value = 'Caja no encontrada.'; return }

    const mapped: PosRegisterFormData = {
      name: row.name,
      code: row.code,
      description: row.description ?? '',
      warehouse_id: row.warehouse_id,
      default_partner_id: row.default_partner_id,
      max_discount_percent: Number(row.max_discount_percent ?? 100),
      blind_close: row.blind_close ?? false,
      difference_tolerance: Number(row.difference_tolerance ?? 0),
      active: row.active ?? true
    }
    formData.value = mapped
    snapshot = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch([registerId, selectedCompanyId], () => {
  isEditing.value = false
  void loadOptions()
  void load()
}, { immediate: true })

const handleBack = () => router.push('/admin/pos/registers')
const handleEdit = () => { errorMessage.value = null; isEditing.value = true }
const handleCancel = () => { formData.value = { ...snapshot }; isEditing.value = false }

const handleSave = async () => {
  const id = registerId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  if (!formData.value.code.trim()) { errorMessage.value = 'El código es obligatorio.'; return }

  errorMessage.value = null
  isLoading.value = true
  try {
    const result = await update(id, cid, {
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
    if (!result) { errorMessage.value = 'No se pudo actualizar la caja.'; return }
    snapshot = { ...formData.value }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = registerId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  try {
    const ok = await archive(id, cid)
    if (!ok) { errorMessage.value = 'No se pudo archivar.'; return }
    router.push('/admin/pos/registers')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <CardSheet
    :title="formData.name || 'Caja'"
    :subtitle="formData.code"
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

    <PosRegisterForm
      v-model="formData"
      :readonly="!isEditing"
      :warehouse-options="warehouseOptions"
      :partner-options="partnerOptions"
    />
  </CardSheet>
</template>
