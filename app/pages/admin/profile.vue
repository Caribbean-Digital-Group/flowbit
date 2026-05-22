
<script setup lang="ts">
import { createEmptyPartnerForm, type PartnerFormData } from '~/components/Partner/Form.vue'
import type { Tables } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type Partner = Tables<'partner'>

const authStore = useAuthStore()
const { updateCurrentPartner } = usePartner()

const isEditing = ref(false)
const isLoading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const profileForm = ref<PartnerFormData>(createEmptyPartnerForm())
let formBackup: PartnerFormData | null = null

function partnerToForm(partner: Partner): PartnerFormData {
  return {
    name: partner.name ?? '',
    display_name: partner.display_name ?? '',
    email: partner.email ?? '',
    phone: partner.phone ?? '',
    mobile: partner.mobile ?? '',
    website: partner.website ?? '',
    street: partner.street ?? '',
    street2: partner.street2 ?? '',
    city: partner.city ?? '',
    state: partner.state ?? '',
    zip: partner.zip ?? '',
    country_code: partner.country_code ?? '',
    vat: partner.vat ?? '',
    function: partner.function ?? '',
    credit_limit: partner.credit_limit ?? 0,
    comment: partner.comment ?? ''
  }
}

function loadPartnerData(): void {
  const partner = authStore.partner
  if (partner) {
    profileForm.value = partnerToForm(partner)
  }
}

loadPartnerData()

watch(() => authStore.partner, (newPartner) => {
  if (newPartner && !isEditing.value) {
    profileForm.value = partnerToForm(newPartner)
  }
})

const handleEdit = (): void => {
  formBackup = { ...profileForm.value }
  isEditing.value = true
  successMessage.value = ''
  errorMessage.value = ''
}

const handleSave = async (): Promise<void> => {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await updateCurrentPartner(profileForm.value)

    if (result) {
      await authStore.fetchPartner()
      isEditing.value = false
      formBackup = null
      successMessage.value = 'Perfil actualizado correctamente'
      setTimeout(() => { successMessage.value = '' }, 3000)
    } else {
      errorMessage.value = 'Error al actualizar el perfil. Intenta de nuevo.'
    }
  } catch {
    errorMessage.value = 'Error inesperado al guardar los cambios.'
  } finally {
    isLoading.value = false
  }
}

const handleCancel = (): void => {
  if (formBackup) {
    profileForm.value = { ...formBackup }
    formBackup = null
  }
  isEditing.value = false
  errorMessage.value = ''
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="space-y-4">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="successMessage"
        class="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span class="text-sm font-medium">{{ successMessage }}</span>
      </div>
    </Transition>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="errorMessage"
        class="flex items-center gap-3 px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span class="text-sm font-medium">{{ errorMessage }}</span>
      </div>
    </Transition>

    <CardSheet
      title="Mi Perfil"
      :subtitle="authStore.partnerEmail"
      :show-back-button="false"
      :show-options-button="false"
      :show-edit-button="true"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-at="formatDate(authStore.partner?.created_at ?? null)"
      :updated-at="formatDate(authStore.partner?.updated_at ?? null)"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancel"
    >
      <PartnerForm v-model="profileForm" :readonly="!isEditing" />
    </CardSheet>
  </div>
</template>
