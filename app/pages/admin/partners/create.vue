<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyPartnerForm, type PartnerFormData } from '~/components/Partner/Form.vue'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const { createPartner } = usePartner()

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const formData = ref<PartnerFormData>(createEmptyPartnerForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => {
  router.push('/admin/partners')
}

const handleSave = async () => {
  errorMessage.value = null

  if (!formData.value.name.trim()) return

  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa antes de crear un cliente.'
    return
  }

  isSaving.value = true
  try {
    const partner = await createPartner(companyId, formData.value)
    if (partner) {
      router.push(`/admin/partners/${partner.id}`)
    } else {
      errorMessage.value = 'No se pudo crear el cliente. Verifica tus permisos en la empresa seleccionada.'
    }
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  router.push('/admin/partners')
}
</script>

<template>
  <CardSheet
    title="Nuevo Cliente"
    :is-editing="true"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleCancel"
  >
    <div
      v-if="!selectedCompanyId"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para poder registrar nuevos clientes.
      </p>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <PartnerForm v-model="formData" />
  </CardSheet>
</template>
