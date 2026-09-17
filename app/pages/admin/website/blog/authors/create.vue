<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyWebsiteAuthorForm, type WebsiteAuthorFormData } from '~/components/WebsiteAuthor/Form.vue'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create, lastError } = useWebsiteAuthor()
const { getCompanyMembers } = useMembership()

const formData = ref<WebsiteAuthorFormData>(createEmptyWebsiteAuthorForm())
const partnerOptions = ref<{ value: string; label: string }[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

watch(selectedCompanyId, async (cid) => {
  partnerOptions.value = cid ? (await getCompanyMembers(cid)).map(m => ({ value: m.partner_id, label: m.partner_display_name || m.partner_name })) : []
}, { immediate: true })

const handleBack = () => router.push('/admin/website/blog/authors')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.display_name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  errorMessage.value = null
  isSaving.value = true
  try {
    const f = formData.value
    const result = await create({
      company_id: cid, display_name: f.display_name.trim(), slug: f.slug.trim() || null, role_title: f.role_title.trim() || null,
      bio: f.bio.trim() || null, avatar_url: f.avatar_url.trim() || null, partner_id: f.partner_id, social_links: f.social_links.filter(l => l.url.trim()), is_public: f.is_public
    })
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo crear el autor.'; return }
    router.push(`/admin/website/blog/authors/${result.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet title="Nuevo autor" :is-editing="true" :is-loading="isSaving" :show-edit-button="false" :show-options-button="false" :show-footer="false" @back="handleBack" @save="handleSave" @cancel="handleBack">
    <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <WebsiteAuthorForm v-if="selectedCompanyId" v-model="formData" :company-id="selectedCompanyId" :partner-options="partnerOptions" />
  </CardSheet>
</template>
