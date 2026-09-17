<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, archive } = useWebsiteGallery()

type Row = { id: string; name: string; slug: string; layout: string; status: string; order: number }
const items = ref<Row[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'slug', label: 'Slug' },
  { key: 'layout', label: 'Presentación' },
  { key: 'status', label: 'Estado', type: 'badge' as const, badgeConfig: { colors: { Borrador: 'bg-slate-100 text-slate-700', Publicada: 'bg-emerald-100 text-emerald-700', Archivada: 'bg-red-100 text-red-700' } } },
  { key: 'order', label: 'Orden', align: 'right' as const }
]
const STATUS: Record<string, string> = { draft: 'Borrador', published: 'Publicada', archived: 'Archivada' }
const LAYOUT: Record<string, string> = { grid: 'Cuadrícula', masonry: 'Mosaico', carousel: 'Carrusel' }

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    items.value = (await getAllByCompany(cid)).map(g => ({ id: g.id, name: g.name, slug: g.slug ?? '', layout: LAYOUT[g.layout] ?? g.layout, status: STATUS[g.status] ?? g.status, order: g.display_order }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleCreate = () => router.push('/admin/website/galleries/create')
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/website/galleries/${String(row.id)}`)
const handleArchive = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <Datatable title="Galerías de fotos" description="Colecciones de imágenes publicadas en /galeria y reutilizables en las páginas." :data="items" :columns="columns" :is-loading="isLoading" :creatable="!!selectedCompanyId" create-label="Nueva galería" @create="handleCreate" @row-click="handleEdit">
    <template #actions="{ row }">
      <button class="text-xs text-indigo-600 hover:text-indigo-800 font-medium" @click.stop="handleEdit(row)">Editar</button>
      <button class="text-xs text-red-500 hover:text-red-700 font-medium ml-3" @click.stop="handleArchive(row)">Archivar</button>
    </template>
  </Datatable>
</template>
