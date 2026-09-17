<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsitePostStatus } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getAllByCompany, archive } = useWebsitePost()
const { getAllByCompany: getCategories } = useWebsiteCategory()
const { getAllByCompany: getAuthors } = useWebsiteAuthor()

type PostRow = { id: string; title: string; status: string; category: string; author: string; published: string; views: number; claps: number; slug: string }

const items = ref<PostRow[]>([])
const isLoading = ref(false)
const statusFilter = ref<WebsitePostStatus | 'all'>('all')
const categoryNames = ref<Record<string, string>>({})
const authorNames = ref<Record<string, string>>({})

const columns = [
  { key: 'title', label: 'Título' },
  { key: 'status', label: 'Estado', type: 'badge' as const, badgeConfig: { colors: Object.fromEntries(Object.entries(POST_STATUS_LABELS).map(([k, v]) => [v, POST_STATUS_COLORS[k] ?? ''])) } },
  { key: 'category', label: 'Categoría' },
  { key: 'author', label: 'Autor' },
  { key: 'published', label: 'Publicación' },
  { key: 'views', label: 'Lecturas', align: 'right' as const },
  { key: 'claps', label: 'Aplausos', align: 'right' as const }
]

const statusTabs: { id: WebsitePostStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'published', label: 'Publicados' },
  { id: 'scheduled', label: 'Programados' },
  { id: 'draft', label: 'Borradores' },
  { id: 'archived', label: 'Archivados' }
]

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) { items.value = []; return }
  isLoading.value = true
  try {
    if (!Object.keys(categoryNames.value).length) {
      const [cats, authors] = await Promise.all([getCategories(cid), getAuthors(cid)])
      categoryNames.value = Object.fromEntries(cats.map(c => [c.id, c.name]))
      authorNames.value = Object.fromEntries(authors.map(a => [a.id, a.display_name]))
    }
    items.value = (await getAllByCompany(cid, { status: statusFilter.value })).map(p => ({
      id: p.id,
      slug: p.slug ?? '',
      title: `${p.is_pinned ? '📌 ' : ''}${p.is_featured ? '★ ' : ''}${p.title}`,
      status: POST_STATUS_LABELS[p.status] ?? p.status,
      category: p.category_id ? categoryNames.value[p.category_id] ?? '—' : '—',
      author: p.author_id ? authorNames.value[p.author_id] ?? '—' : '—',
      published: formatWebsiteDateTime(p.published_at) || '—',
      views: p.view_count,
      claps: p.clap_count
    }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, () => { categoryNames.value = {}; void load() }, { immediate: true })
watch(statusFilter, load)

const handleCreate = () => router.push('/admin/website/blog/posts/create')
const handleEdit = (row: Record<string, unknown>) => router.push(`/admin/website/blog/posts/${String(row.id)}`)
const previewPath = (row: Record<string, unknown>) => (selectedCompany.value?.slug && row.slug ? `${websitePath(selectedCompany.value.slug, `/blog/${String(row.slug)}`)}?preview=1` : null)

const handleArchive = async (row: Record<string, unknown>) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  await archive(String(row.id), cid)
  await load()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-1 overflow-x-auto rounded-2xl bg-white shadow-lg shadow-slate-200/50 p-1.5 w-fit">
      <button v-for="t in statusTabs" :key="t.id" type="button" :class="['px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors', statusFilter === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800']" @click="statusFilter = t.id">{{ t.label }}</button>
    </div>
    <Datatable
      title="Publicaciones del blog"
      description="Escribe, programa y publica artículos. 📌 fijado · ★ destacado."
      :data="items"
      :columns="columns"
      :is-loading="isLoading"
      :creatable="!!selectedCompanyId"
      create-label="Nueva publicación"
      @create="handleCreate"
      @row-click="handleEdit"
    >
      <template #actions="{ row }">
        <button class="text-xs text-indigo-600 hover:text-indigo-800 font-medium" @click.stop="handleEdit(row)">Editar</button>
        <NuxtLink v-if="previewPath(row)" :to="previewPath(row)!" target="_blank" class="text-xs text-slate-500 hover:text-slate-800 font-medium ml-3" @click.stop>Ver</NuxtLink>
        <button v-if="row.status !== 'Archivado'" class="text-xs text-red-500 hover:text-red-700 font-medium ml-3" @click.stop="handleArchive(row)">Archivar</button>
      </template>
    </Datatable>
  </div>
</template>
