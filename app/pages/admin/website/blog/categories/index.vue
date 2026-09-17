<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, archive } = useWebsiteCategory()

type Row = { id: string; name: string; slug: string; parent: string; order: number; featured: string }
const items = ref<Row[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'slug', label: 'Slug' },
  { key: 'parent', label: 'Padre' },
  { key: 'order', label: 'Orden', align: 'right' as const },
  { key: 'featured', label: 'Destacada', type: 'badge' as const, badgeConfig: { colors: { Sí: 'bg-indigo-100 text-indigo-700', No: 'bg-slate-100 text-slate-600' } } }
]

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    const rows = await getAllByCompany(cid)
    const names = Object.fromEntries(rows.map(r => [r.id, r.name]))
    items.value = rows.map(r => ({ id: r.id, name: r.name, slug: r.slug ?? '', parent: r.parent_id ? names[r.parent_id] ?? '—' : '—', order: r.display_order, featured: r.is_featured ? 'Sí' : 'No' }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleCreate = () => router.push('/admin/website/blog/categories/create')
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/website/blog/categories/${String(row.id)}`)
const handleArchive = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <Datatable
    title="Categorías del blog"
    description="Organiza las publicaciones por tema. Las destacadas funcionan como temas principales."
    :data="items"
    :columns="columns"
    :is-loading="isLoading"
    :creatable="!!selectedCompanyId"
    create-label="Nueva categoría"
    @create="handleCreate"
    @row-click="handleEdit"
  >
    <template #actions="{ row }">
      <button class="text-xs text-indigo-600 hover:text-indigo-800 font-medium" @click.stop="handleEdit(row)">Editar</button>
      <button class="text-xs text-red-500 hover:text-red-700 font-medium ml-3" @click.stop="handleArchive(row)">Archivar</button>
    </template>
  </Datatable>
</template>
