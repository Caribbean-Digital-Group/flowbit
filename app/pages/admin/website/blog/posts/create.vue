<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { create, lastError } = useWebsitePost()
const { ensureCurrentUserAuthor } = useWebsiteAuthor()

const title = ref('')
const subtitle = ref('')
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const handleBack = () => router.push('/admin/website/blog/posts')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!title.value.trim()) { errorMessage.value = 'El título es obligatorio.'; return }
  errorMessage.value = null
  isSaving.value = true
  try {
    const author = await ensureCurrentUserAuthor(cid)
    const result = await create({
      company_id: cid,
      title: title.value.trim(),
      subtitle: subtitle.value.trim() || null,
      status: 'draft',
      author_id: author?.id ?? null
    })
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo crear la publicación.'; return }
    router.push(`/admin/website/blog/posts/${result.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nueva publicación"
    subtitle="Se crea como borrador y pasas directo al editor."
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleBack"
  >
    <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <div class="space-y-6 max-w-3xl">
      <FormInput v-model="title" label="Título" placeholder="Un título claro y atractivo" required size="lg" @keydown.enter.prevent="handleSave" />
      <FormInput v-model="subtitle" label="Subtítulo (opcional)" placeholder="Una línea que complemente el título" size="md" />
    </div>
  </CardSheet>
</template>
