<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyStorefrontCouponForm,
  type StorefrontCouponFormData
} from '~/components/StorefrontCoupon/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, archive } = useStorefrontCoupon()

const couponId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const usageCount = ref(0)
const formData = ref<StorefrontCouponFormData>(createEmptyStorefrontCouponForm())
let snapshot: StorefrontCouponFormData = createEmptyStorefrontCouponForm()

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
  const id = couponId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const row = await getById(id, cid)
    if (!row) { errorMessage.value = 'Cupón no encontrado.'; return }
    const mapped: StorefrontCouponFormData = {
      code: row.code,
      description: row.description ?? '',
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      min_purchase: row.min_purchase ?? 0,
      usage_limit: row.usage_limit ?? undefined,
      starts_at: row.starts_at ?? '',
      expires_at: row.expires_at ?? '',
      active: row.active ?? true
    }
    usageCount.value = row.usage_count
    formData.value = mapped
    snapshot = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch([couponId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleBack = () => router.push('/admin/storefront/coupons')

const handleEdit = () => { errorMessage.value = null; isEditing.value = true }

const handleCancel = () => { formData.value = { ...snapshot }; isEditing.value = false }

const handleSave = async () => {
  const id = couponId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  if (!formData.value.code.trim()) { errorMessage.value = 'El código es obligatorio.'; return }
  if (!formData.value.discount_value || formData.value.discount_value <= 0) {
    errorMessage.value = 'El descuento debe ser mayor a cero.'
    return
  }

  errorMessage.value = null
  isLoading.value = true
  try {
    const result = await update(id, cid, {
      code: formData.value.code.trim(),
      description: formData.value.description.trim() || null,
      discount_type: formData.value.discount_type,
      discount_value: formData.value.discount_value,
      min_purchase: formData.value.min_purchase || 0,
      usage_limit: formData.value.usage_limit || null,
      starts_at: formData.value.starts_at || null,
      expires_at: formData.value.expires_at || null,
      active: formData.value.active
    })
    if (!result) { errorMessage.value = 'No se pudo actualizar el cupón.'; return }
    snapshot = { ...formData.value }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = couponId.value
  const cid = selectedCompanyId.value
  if (!id || !cid) return
  isLoading.value = true
  try {
    const ok = await archive(id, cid)
    if (!ok) { errorMessage.value = 'No se pudo archivar.'; return }
    router.push('/admin/storefront/coupons')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <CardSheet
    :title="formData.code || 'Cupón'"
    :subtitle="`Usado ${usageCount} ${usageCount === 1 ? 'vez' : 'veces'}`"
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

    <StorefrontCouponForm v-model="formData" :readonly="!isEditing" />
  </CardSheet>
</template>
