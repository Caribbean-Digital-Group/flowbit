<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyWebsiteCategoryForm, type WebsiteCategoryFormData } from '~/components/WebsiteCategory/Form.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getById, update, archive, getAllByCompany, lastError } = useWebsiteCategory()

const categoryId = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id ?? ''))
const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const formData = ref<WebsiteCategoryFormData>(createEmptyWebsiteCategoryForm())
const parentOptions = ref<{ value: string; label: string }[]>([])
let snapshot = createEmptyWebsiteCategoryForm()

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !categoryId.value) return
  isLoading.value = true
  try {
    const [row, all] = await Promise.all([getById(categoryId.value, cid), getAllByCompany(cid)])
    parentOptions.value = all.filter(c => !c.parent_id && c.id !== categoryId.value).map(c => ({ value: c.id, label: c.name }))
    if (!row) { errorMessage.value = 'Categoría no encontrada.'; return }
    const mapped: WebsiteCategoryFormData = {
      name: row.name, slug: row.slug ?? '', description: row.description ?? '', parent_id: row.parent_id,
      color: row.color ?? '#6366f1', image_url: row.image_url ?? '', display_order: row.display_order, is_featured: row.is_featured, active: row.active ?? true
    }
    formData.value = mapped
    snapshot = { ...mapped }
  } finally {
    isLoading.value = false
  }
}

watch([categoryId, selectedCompanyId], () => { isEditing.value = false; void load() }, { immediate: true })

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  if (!formData.value.name.trim()) { errorMessage.value = 'El nombre es obligatorio.'; return }
  errorMessage.value = null
  isLoading.value = true
  try {
    const f = formData.value
    const result = await update(categoryId.value, cid, {
      name: f.name.trim(), slug: f.slug.trim() || null, description: f.description.trim() || null, parent_id: f.parent_id,
      color: f.color || null, image_url: f.image_url.trim() || null, display_order: f.display_order, is_featured: f.is_featured, active: f.active
    })
    if (!result) { errorMessage.value = lastError.value ?? 'No se pudo guardar.'; return }
    snapshot = { ...formData.value }
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const menuOptions = computed<MenuOption[]>(() => [
  { id: 'archive', label: 'Archivar', variant: 'danger', action: async () => { if (selectedCompanyId.value && await archive(categoryId.value, selectedCompanyId.value)) router.push('/admin/website/blog/categories') } }
])
</script>

<template>
  <CardSheet :title="formData.name || 'Categoría'" :subtitle="formData.slug ? `/blog/categoria/${formData.slug}` : ''" :is-editing="isEditing" :is-loading="isLoading" :menu-options="menuOptions" @back="router.push('/admin/website/blog/categories')" @edit="isEditing = true" @save="handleSave" @cancel="formData = { ...snapshot }; isEditing = false">
    <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <WebsiteCategoryForm v-if="selectedCompanyId" v-model="formData" :company-id="selectedCompanyId" :parent-options="parentOptions" :readonly="!isEditing" />
  </CardSheet>
</template>
