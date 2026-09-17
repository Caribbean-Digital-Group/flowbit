<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyWebsiteAuthorForm, type WebsiteAuthorFormData } from '~/components/WebsiteAuthor/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, archive, lastError } = useWebsiteAuthor()
const { getCompanyMembers } = useMembership()

const authorId = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id ?? ''))
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<WebsiteAuthorFormData>(createEmptyWebsiteAuthorForm())
const partnerOptions = ref<{ value: string; label: string }[]>([])
let snapshot = createEmptyWebsiteAuthorForm()

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !authorId.value) return
  isLoading.value = true
  try {
    const [row, members] = await Promise.all([getById(authorId.value, cid), getCompanyMembers(cid)])
    partnerOptions.value = members.map(m => ({ value: m.partner_id, label: m.partner_display_name || m.partner_name }))
    if (!row) { errorMessage.value = 'Autor no encontrado.'; return }
    const mapped: WebsiteAuthorFormData = {
      display_name: row.display_name, slug: row.slug ?? '', role_title: row.role_title ?? '', bio: row.bio ?? '', avatar_url: row.avatar_url ?? '',
      partner_id: row.partner_id, social_links: Array.isArray(row.social_links) ? [...row.social_links] : [], is_public: row.is_public
    }
    formData.value = mapped
    snapshot = JSON.parse(JSON.stringify(mapped)) as WebsiteAuthorFormData
  } finally {
    isLoading.value = false
  }
}

watch([authorId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  if (!formData.value.display_name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  errorMessage.value = null
  isLoading.value = true
  try {
    const f = formData.value
    const result = await update(authorId.value, cid, {
      display_name: f.display_name.trim(), slug: f.slug.trim() || null, role_title: f.role_title.trim() || null, bio: f.bio.trim() || null,
      avatar_url: f.avatar_url.trim() || null, partner_id: f.partner_id, social_links: f.social_links.filter(l => l.url.trim()), is_public: f.is_public
    })
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo guardar.'; return }
    snapshot = JSON.parse(JSON.stringify(formData.value)) as WebsiteAuthorFormData
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const menuOptions = computed<MenuOption[]>(() => [
  { id: 'archive', label: 'Archivar', variant: 'danger', action: async () => { if (selectedCompanyId.value && await archive(authorId.value, selectedCompanyId.value)) router.push('/admin/website/blog/authors') } }
])
</script>

<template>
  <CardSheet :title="formData.display_name || 'Autor'" :subtitle="formData.role_title" :is-editing="isEditing" :is-loading="isLoading" :menu-options="menuOptions" @back="router.push('/admin/website/blog/authors')" @edit="isEditing = true" @save="handleSave" @cancel="formData = JSON.parse(JSON.stringify(snapshot)); isEditing = false">
    <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <WebsiteAuthorForm v-if="selectedCompanyId" v-model="formData" :company-id="selectedCompanyId" :partner-options="partnerOptions" :readonly="!isEditing" />
  </CardSheet>
</template>
