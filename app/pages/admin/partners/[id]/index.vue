<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyPartnerForm, type PartnerFormData } from '~/components/Partner/Form.vue'
import type { Database, Tables, TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type Partner = Tables<'partner'>
type OrderView = Database['public']['Views']['v_orders']['Row']
type LeadView = Database['public']['Views']['v_crm_leads']['Row']

const route = useRoute()
const router = useRouter()
const { getPartnerById, updatePartner, archivePartner } = usePartner()
const { getOrdersByPartner } = useOrder()
const { getLeadsByPartner } = useCrmLead()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const isLoading = ref(false)
const isLoadingMetrics = ref(false)
const errorMessage = ref<string | null>(null)
const partner = ref<Partner | null>(null)
const partnerForm = ref<PartnerFormData>(createEmptyPartnerForm())
const initialForm = ref<PartnerFormData>(createEmptyPartnerForm())
const partnerOrders = ref<OrderView[]>([])
const partnerLeads = ref<LeadView[]>([])
const isEditing = ref(false)

const partnerId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const menuOptions = computed<MenuOption[]>(() => [
  {
    id: 'archive',
    label: 'Archivar',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    action: () => void handleArchive(),
    variant: 'warning'
  }
])

const metadata = computed(() => {
  const current = partner.value
  return {
    createdBy: current?.created_by ?? '—',
    createdAt: current?.created_at ?? '',
    updatedBy: current?.updated_by ?? '—',
    updatedAt: current?.updated_at ?? ''
  }
})

const partnerTypeLabel = computed(() =>
  partner.value?.company_type === 'company' ? 'Empresa' : 'Persona'
)

const mapPartnerToForm = (value: Partner): PartnerFormData => ({
  name: value.name ?? '',
  display_name: value.display_name ?? '',
  email: value.email ?? '',
  phone: value.phone ?? '',
  mobile: value.mobile ?? '',
  website: value.website ?? '',
  street: value.street ?? '',
  street2: value.street2 ?? '',
  city: value.city ?? '',
  state: value.state ?? '',
  zip: value.zip ?? '',
  country_code: value.country_code ?? '',
  vat: value.vat ?? '',
  function: value.function ?? '',
  credit_limit: value.credit_limit ?? 0,
  comment: value.comment ?? ''
})

const mapFormToPartnerUpdate = (value: PartnerFormData): TablesUpdate<'partner'> => ({
  name: value.name.trim(),
  display_name: value.display_name.trim() || null,
  email: value.email.trim() || null,
  phone: value.phone.trim() || null,
  mobile: value.mobile.trim() || null,
  website: value.website.trim() || null,
  street: value.street.trim() || null,
  street2: value.street2.trim() || null,
  city: value.city.trim() || null,
  state: value.state.trim() || null,
  zip: value.zip.trim() || null,
  country_code: value.country_code.trim() || null,
  vat: value.vat.trim() || null,
  function: value.function.trim() || null,
  credit_limit: Number.isFinite(value.credit_limit) ? value.credit_limit : 0,
  comment: value.comment.trim() || null
})

const loadPartner = async (): Promise<void> => {
  const id = partnerId.value
  const companyId = selectedCompanyId.value

  if (!id) {
    errorMessage.value = 'No se recibió un identificador de cliente válido.'
    return
  }

  isLoading.value = true
  isLoadingMetrics.value = true
  errorMessage.value = null

  try {
    const [partnerData, orderList, leadList] = await Promise.all([
      getPartnerById(id),
      companyId ? getOrdersByPartner(id, companyId) : Promise.resolve([]),
      companyId ? getLeadsByPartner(id, companyId) : Promise.resolve([])
    ])

    if (!partnerData) {
      errorMessage.value = 'No se encontró el cliente solicitado o no tienes acceso.'
      return
    }

    partner.value = partnerData
    const mapped = mapPartnerToForm(partnerData)
    partnerForm.value = mapped
    initialForm.value = { ...mapped }

    partnerOrders.value = orderList
    partnerLeads.value = leadList
  } finally {
    isLoading.value = false
    isLoadingMetrics.value = false
  }
}

const handleBack = () => {
  router.push('/admin/partners')
}

const handleEdit = () => {
  errorMessage.value = null
  isEditing.value = true
}

const handleCancel = () => {
  partnerForm.value = { ...initialForm.value }
  isEditing.value = false
  errorMessage.value = null
}

const handleSave = async () => {
  const id = partnerId.value
  if (!id || !partner.value) return

  if (!partnerForm.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const saved = await updatePartner(id, mapFormToPartnerUpdate(partnerForm.value))
    if (!saved) {
      errorMessage.value = 'No se pudo guardar el cliente. Verifica tus permisos de edición.'
      return
    }

    partner.value = saved
    const mapped = mapPartnerToForm(saved)
    partnerForm.value = mapped
    initialForm.value = { ...mapped }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleArchive = async () => {
  const id = partnerId.value
  if (!id) return

  isLoading.value = true
  errorMessage.value = null

  try {
    const ok = await archivePartner(id)
    if (!ok) {
      errorMessage.value = 'No se pudo archivar el cliente.'
      return
    }

    router.push('/admin/partners')
  } finally {
    isLoading.value = false
  }
}

watch([partnerId, selectedCompanyId], () => {
  isEditing.value = false
  void loadPartner()
}, { immediate: true })
</script>

<template>
  <CardSheet
    :title="partnerForm.name || 'Cliente sin nombre'"
    :subtitle="partnerForm.email"
    :is-editing="isEditing"
    :is-loading="isLoading"
    :created-by="metadata.createdBy"
    :created-at="metadata.createdAt"
    :updated-by="metadata.updatedBy"
    :updated-at="metadata.updatedAt"
    :menu-options="menuOptions"
    @back="handleBack"
    @edit="handleEdit"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <template #status>
      <BadgeApp :label="partnerTypeLabel" variant="primary" />
    </template>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <PartnerForm v-model="partnerForm" :readonly="!isEditing" />

    <PartnerMetricsPanel
      :orders="partnerOrders"
      :leads="partnerLeads"
      :loading="isLoadingMetrics"
    />
  </CardSheet>
</template>
