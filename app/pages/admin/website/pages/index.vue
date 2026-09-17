<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getAllByCompany, archive } = useWebsitePage()

type PageRow = { id: string; title: string; path: string; status: string; layout: string; updated: string; is_home: boolean }

const items = ref<PageRow[]>([])
const isLoading = ref(false)

const columns = [
  { key: 'title', label: 'Título' },
  { key: 'path', label: 'Ruta' },
  { key: 'layout', label: 'Distribución' },
  { key: 'status', label: 'Estado', type: 'badge' as const, badgeConfig: { colors: { Borrador: 'bg-slate-100 text-slate-700', Publicada: 'bg-emerald-100 text-emerald-700', Archivada: 'bg-red-100 text-red-700' } } },
  { key: 'updated', label: 'Actualizada' }
]

const STATUS: Record<string, string> = { draft: 'Borrador', published: 'Publicada', archived: 'Archivada' }
const LAYOUT: Record<string, string> = { default: 'Estándar', landing: 'Landing', full_width: 'Ancho completo' }

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    items.value = (await getAllByCompany(cid)).map(p => ({
      id: p.id,
      title: p.is_home ? `🏠 ${p.title}` : p.title,
      path: p.is_home ? '/' : `/${p.slug ?? ''}`,
      status: STATUS[p.status] ?? p.status,
      layout: LAYOUT[p.layout] ?? p.layout,
      updated: formatWebsiteDateTime(p.updated_at),
      is_home: p.is_home
    }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleCreate = () => router.push('/admin/website/pages/create')
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/website/pages/${String(row.id)}`)
const previewPath = (row: Record<string, unknown>) => (selectedCompany.value?.slug ? `${websitePath(selectedCompany.value.slug, String(row.path) === '/' ? '' : String(row.path))}?preview=1` : null)

const handleArchive = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  if (row.is_home) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <Datatable
    title="Páginas"
    description="Páginas del sitio construidas con secciones. La página de inicio se marca con 🏠."
    :data="items"
    :columns="columns"
    :is-loading="isLoading"
    :creatable="!!selectedCompanyId"
    create-label="Nueva página"
    @create="handleCreate"
    @row-click="handleEdit"
  >
    <template #actions="{ row }">
      <button class="text-xs text-indigo-600 hover:text-indigo-800 font-medium" @click.stop="handleEdit(row)">Editar</button>
      <NuxtLink v-if="previewPath(row)" :to="previewPath(row)!" target="_blank" class="text-xs text-slate-500 hover:text-slate-800 font-medium ml-3" @click.stop>Ver</NuxtLink>
      <button v-if="!row.is_home" class="text-xs text-red-500 hover:text-red-700 font-medium ml-3" @click.stop="handleArchive(row)">Archivar</button>
    </template>
  </Datatable>
</template>
