<script setup lang="ts">
import { createEmptyPartnerForm, type PartnerFormData } from '~/components/Partner/Form.vue'

definePageMeta({
  layout: 'admin'
})

const router = useRouter()
const { createPartner } = usePartner()

const formData = ref<PartnerFormData>(createEmptyPartnerForm())
const isSaving = ref(false)

const handleBack = () => {
  router.push('/admin/partners')
}

const handleSave = async () => {
  if (!formData.value.name.trim()) return

  isSaving.value = true
  try {
    const partner = await createPartner(formData.value)
    if (partner) {
      router.push(`/admin/partners/${partner.id}`)
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
    <PartnerForm v-model="formData" />
  </CardSheet>
</template>

