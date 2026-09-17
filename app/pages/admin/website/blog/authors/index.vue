<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, archive } = useWebsiteAuthor()

type Row = { id: string; display_name: string; role_title: string; slug: string; is_public: string; avatar_url: string | null }
const items = ref<Row[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'display_name', label: 'Autor', type: 'avatar' as const, avatarKey: 'avatar_url', subtitleKey: 'role_title' },
  { key: 'slug', label: 'Slug' },
  { key: 'is_public', label: 'Perfil público', type: 'badge' as const, badgeConfig: { colors: { Sí: 'bg-emerald-100 text-emerald-700', No: 'bg-slate-100 text-slate-600' } } }
]

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    items.value = (await getAllByCompany(cid)).map(a => ({ id: a.id, display_name: a.display_name, role_title: a.role_title ?? '', slug: a.slug ?? '', is_public: a.is_public ? 'Sí' : 'No', avatar_url: a.avatar_url }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleCreate = () => router.push('/admin/website/blog/authors/create')
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/website/blog/authors/${String(row.id)}`)
const handleArchive = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <Datatable title="Autores" description="Perfiles públicos que firman las publicaciones del blog." :data="items" :columns="columns" :is-loading="isLoading" :creatable="!!selectedCompanyId" create-label="Nuevo autor" @create="handleCreate" @row-click="handleEdit">
    <template #actions="{ row }">
      <button class="text-xs text-indigo-600 hover:text-indigo-800 font-medium" @click.stop="handleEdit(row)">Editar</button>
      <button class="text-xs text-red-500 hover:text-red-700 font-medium ml-3" @click.stop="handleArchive(row)">Archivar</button>
    </template>
  </Datatable>
</template>
