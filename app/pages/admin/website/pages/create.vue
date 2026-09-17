<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyWebsitePageForm, type WebsitePageFormData } from '~/components/WebsitePage/Form.vue'
import { createSection, sectionsToJson } from '~/utils/website/sections'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { create, lastError } = useWebsitePage()

const formData = ref<WebsitePageFormData>(createEmptyWebsitePageForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const startWith = ref<'blank' | 'basic' | 'landing'>('basic')

const templates = [
  { id: 'blank', label: 'En blanco', description: 'Empieza sin secciones.' },
  { id: 'basic', label: 'Página informativa', description: 'Texto + imagen y texto + llamado a la acción.' },
  { id: 'landing', label: 'Landing', description: 'Portada, características, testimonios, precios y CTA.' }
] as const

const buildContent = () => {
  switch (startWith.value) {
    case 'basic':
      return [createSection('text'), createSection('image_text'), createSection('cta')]
    case 'landing':
      return [createSection('hero'), createSection('features'), createSection('testimonials'), createSection('pricing'), createSection('faq'), createSection('cta')]
    default:
      return []
  }
}

const handleBack = () => router.push('/admin/website/pages')

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { errorMessage.value = 'Selecciona una empresa.'; return }
  if (!formData.value.title.trim()) { errorMessage.value = 'El título es obligatorio.'; return }
  errorMessage.value = null
  isSaving.value = true
  try {
    const result = await create({
      company_id: cid,
      title: formData.value.title.trim(),
      slug: formData.value.slug.trim() || null,
      status: 'draft',
      is_home: formData.value.is_home,
      layout: startWith.value === 'landing' ? 'landing' : formData.value.layout,
      show_title: startWith.value !== 'landing' && formData.value.show_title,
      excerpt: formData.value.excerpt.trim() || null,
      seo_title: formData.value.seo_title.trim() || null,
      seo_description: formData.value.seo_description.trim() || null,
      og_image_url: formData.value.og_image_url.trim() || null,
      canonical_url: formData.value.canonical_url.trim() || null,
      noindex: formData.value.noindex,
      show_in_search: formData.value.show_in_search,
      display_order: formData.value.display_order,
      content: sectionsToJson(buildContent())
    })
    if (!result) {
      errorMessage.value = lastError.value ?? 'No se pudo crear la página.'
      return
    }
    router.push(`/admin/website/pages/${result.id}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nueva página"
    subtitle="Se crea como borrador; después edita sus secciones."
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

    <div class="mb-8">
      <p class="block text-sm font-medium text-slate-700 mb-2">Empezar con</p>
      <div class="grid sm:grid-cols-3 gap-3">
        <button v-for="t in templates" :key="t.id" type="button" :class="['text-left rounded-xl border p-4 transition-colors', startWith === t.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50']" @click="startWith = t.id">
          <p class="font-semibold text-sm text-slate-800">{{ t.label }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ t.description }}</p>
        </button>
      </div>
    </div>

    <WebsitePageForm v-if="selectedCompanyId" v-model="formData" :company-id="selectedCompanyId" :site-url="selectedCompany?.slug ? websitePath(selectedCompany.slug) : ''" />
  </CardSheet>
</template>
