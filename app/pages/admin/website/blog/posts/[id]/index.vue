<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { JSONContent } from '@tiptap/core'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyWebsitePostForm, toDateTimeLocal, type WebsitePostFormData } from '~/components/WebsitePost/Form.vue'
import type { WebsitePostRow, WebsitePostStatus, WebsitePostRevisionRow } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getById, update, archive, setTags, getTagIds, getAllByCompany, getRevisions, lastError } = useWebsitePost()
const { getAllByCompany: getAuthors } = useWebsiteAuthor()
const { getAllByCompany: getCategories } = useWebsiteCategory()
const { getAllByCompany: getTags } = useWebsiteTag()
const { renderDocument } = useWebsiteContent()

const postId = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id ?? ''))

const post = ref<WebsitePostRow | null>(null)
const formData = ref<WebsitePostFormData>(createEmptyWebsitePostForm())
const body = ref<JSONContent | null>(null)
const title = ref('')
const subtitle = ref('')
const stats = ref({ words: 0, characters: 0 })
const revisions = ref<WebsitePostRevisionRow[]>([])

const authors = ref<{ value: string; label: string }[]>([])
const categories = ref<{ value: string; label: string }[]>([])
const tagSuggestions = ref<string[]>([])
const tagNamesById = ref<Record<string, string>>({})
const postOptions = ref<{ value: string; label: string }[]>([])

const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const dirty = ref(false)
const showRevisions = ref(false)

const companySlug = computed(() => selectedCompany.value?.slug ?? '')
const previewPath = computed(() => (companySlug.value && post.value?.slug ? `${websitePath(companySlug.value, `/blog/${post.value.slug}`)}?preview=1` : null))

const STATUS_VARIANT: Record<WebsitePostStatus, 'secondary' | 'warning' | 'success' | 'danger'> = { draft: 'secondary', scheduled: 'warning', published: 'success', archived: 'danger' }

const applyRow = async (row: WebsitePostRow) => {
  post.value = row
  title.value = row.title
  subtitle.value = row.subtitle ?? ''
  body.value = (row.body && typeof row.body === 'object') ? (row.body as JSONContent) : { type: 'doc', content: [{ type: 'paragraph' }] }
  const tagIds = selectedCompanyId.value ? await getTagIds(row.id, selectedCompanyId.value) : []
  formData.value = {
    title: row.title,
    subtitle: row.subtitle ?? '',
    slug: row.slug ?? '',
    status: row.status,
    published_at: toDateTimeLocal(row.published_at),
    author_id: row.author_id,
    category_id: row.category_id,
    tags: tagIds.map(id => tagNamesById.value[id]).filter((n): n is string => !!n),
    cover_url: row.cover_url ?? '',
    cover_alt: row.cover_alt ?? '',
    excerpt: row.excerpt ?? '',
    is_featured: row.is_featured,
    is_pinned: row.is_pinned,
    allow_comments: row.allow_comments,
    related_post_ids: row.related_post_ids ?? [],
    seo_title: row.seo_title ?? '',
    seo_description: row.seo_description ?? '',
    og_image_url: row.og_image_url ?? '',
    canonical_url: row.canonical_url ?? '',
    noindex: row.noindex
  }
  stats.value = { words: row.word_count, characters: row.body_text.length }
  await nextTick()
  dirty.value = false
}

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !postId.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const [row, a, c, t, all] = await Promise.all([getById(postId.value, cid), getAuthors(cid), getCategories(cid), getTags(cid), getAllByCompany(cid)])
    if (!row) { errorMessage.value = 'Publicación no encontrada.'; return }
    authors.value = a.map(x => ({ value: x.id, label: x.display_name }))
    categories.value = c.map(x => ({ value: x.id, label: x.parent_id ? `— ${x.name}` : x.name }))
    tagSuggestions.value = t.map(x => x.name)
    tagNamesById.value = Object.fromEntries(t.map(x => [x.id, x.name]))
    postOptions.value = all.filter(x => x.id !== row.id && x.status !== 'archived').map(x => ({ value: x.id, label: x.title }))
    await applyRow(row)
    revisions.value = await getRevisions(row.id, cid)
  } finally {
    isLoading.value = false
  }
}

watch([postId, selectedCompanyId], load, { immediate: true })
watch([body, formData, title, subtitle], () => { dirty.value = true }, { deep: true })

const persist = async (status?: WebsitePostStatus) => {
  const cid = selectedCompanyId.value
  if (!cid || !post.value) return
  if (!title.value.trim()) { errorMessage.value = 'El título es obligatorio.'; return }
  errorMessage.value = null
  successMessage.value = null
  isSaving.value = true
  try {
    const rendered = await renderDocument(body.value ?? { type: 'doc', content: [] })
    if (!rendered) { errorMessage.value = 'No se pudo procesar el contenido. Revisa tu conexión.'; return }
    const f = formData.value
    const publishedAt = f.published_at ? new Date(f.published_at).toISOString() : null
    const row = await update(post.value.id, cid, {
      title: title.value.trim(),
      subtitle: subtitle.value.trim() || null,
      slug: f.slug.trim() || null,
      status: status ?? f.status,
      published_at: publishedAt,
      author_id: f.author_id,
      category_id: f.category_id,
      cover_url: f.cover_url.trim() || null,
      cover_alt: f.cover_alt.trim() || null,
      excerpt: f.excerpt.trim() || rendered.excerpt || null,
      body: body.value ?? { type: 'doc', content: [] },
      body_html: rendered.html,
      body_text: rendered.text,
      word_count: rendered.word_count,
      reading_minutes: rendered.reading_minutes,
      is_featured: f.is_featured,
      is_pinned: f.is_pinned,
      allow_comments: f.allow_comments,
      related_post_ids: f.related_post_ids,
      seo_title: f.seo_title.trim() || null,
      seo_description: f.seo_description.trim() || null,
      og_image_url: f.og_image_url.trim() || null,
      canonical_url: f.canonical_url.trim() || null,
      noindex: f.noindex
    })
    if (!row) { errorMessage.value = lastError.value ?? 'No se pudo guardar la publicación.'; return }
    const tagsOk = await setTags(row.id, f.tags)
    if (!tagsOk) errorMessage.value = lastError.value ?? 'Se guardó el post pero no las etiquetas.'
    tagSuggestions.value = Array.from(new Set([...tagSuggestions.value, ...f.tags]))
    const t = await getTags(cid)
    tagNamesById.value = Object.fromEntries(t.map(x => [x.id, x.name]))
    await applyRow(row)
    revisions.value = await getRevisions(row.id, cid)
    successMessage.value = row.status === 'published' ? 'Publicación publicada.' : row.status === 'scheduled' ? `Programada para ${formatWebsiteDateTime(row.published_at)}.` : 'Borrador guardado.'
  } finally {
    isSaving.value = false
  }
}

const handleArchive = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !post.value) return
  if (await archive(post.value.id, cid)) router.push('/admin/website/blog/posts')
  else errorMessage.value = lastError.value ?? 'No se pudo archivar.'
}

const restoreRevision = (revision: WebsitePostRevisionRow) => {
  body.value = revision.body as JSONContent
  title.value = revision.title
  showRevisions.value = false
  successMessage.value = `Versión ${revision.revision_no} cargada. Guarda para aplicarla.`
}

const menuOptions = computed<MenuOption[]>(() => [
  { id: 'unpublish', label: 'Pasar a borrador', disabled: post.value?.status === 'draft', action: () => void persist('draft') },
  { id: 'revisions', label: `Historial (${revisions.value.length})`, action: () => { showRevisions.value = !showRevisions.value } },
  { id: 'archive', label: 'Archivar', divider: true, variant: 'danger', action: () => void handleArchive() }
])

onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return false
  return true
})
</script>

<template>
  <div class="space-y-4">
    <CardSheet
      :title="title || 'Publicación'"
      :subtitle="post ? `${readingLabel(post.reading_minutes)} · ${stats.words} palabras` : ''"
      :is-editing="false"
      :is-loading="isLoading"
      :show-edit-button="false"
      :show-footer="false"
      :menu-options="menuOptions"
      padding="sm"
      @back="router.push('/admin/website/blog/posts')"
    >
      <template #status>
        <BadgeApp v-if="post" :label="POST_STATUS_LABELS[post.status] ?? post.status" :variant="STATUS_VARIANT[post.status]" />
      </template>

      <div v-if="errorMessage" class="mb-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
      <div v-if="successMessage" class="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-700">{{ successMessage }}</div>

      <div class="flex flex-wrap items-center gap-2">
        <BtnApp label="Guardar borrador" size="md" variant="secondary" :loading="isSaving" @click="persist(post?.status === 'published' || post?.status === 'scheduled' ? undefined : 'draft')" />
        <BtnApp v-if="post?.status === 'published'" label="Actualizar publicación" size="md" :loading="isSaving" @click="persist('published')" />
        <BtnApp v-else :label="formData.published_at && new Date(formData.published_at) > new Date() ? 'Programar' : 'Publicar'" size="md" :loading="isSaving" @click="persist('published')" />
        <NuxtLink v-if="previewPath" :to="previewPath" target="_blank" class="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-base font-semibold">Vista previa</NuxtLink>
      </div>

      <div v-if="showRevisions" class="mt-6 pt-6 border-t border-slate-100">
        <p class="text-sm font-semibold text-slate-700 mb-3">Historial de versiones (últimas 20)</p>
        <ul v-if="revisions.length" class="divide-y divide-slate-100 rounded-xl border border-slate-200">
          <li v-for="rev in revisions" :key="rev.id" class="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span class="text-slate-700">v{{ rev.revision_no }} · {{ rev.title }} <span class="text-slate-400">· {{ formatWebsiteDateTime(rev.created_at) }}</span></span>
            <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="restoreRevision(rev)">Cargar</button>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-400">Aún no hay versiones anteriores.</p>
      </div>
    </CardSheet>

    <div v-if="post && selectedCompanyId" class="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div class="xl:col-span-8 space-y-4">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-3">
          <input v-model="title" type="text" class="w-full text-3xl font-bold text-slate-800 placeholder-slate-300 border-0 focus:ring-0 p-0 bg-transparent" placeholder="Título de la publicación" maxlength="200" />
          <input v-model="subtitle" type="text" class="w-full text-lg text-slate-500 placeholder-slate-300 border-0 focus:ring-0 p-0 bg-transparent" placeholder="Subtítulo (opcional)" maxlength="300" />
        </div>
        <ClientOnly>
          <WebsiteRichTextEditor v-model="body" mode="json" :company-id="selectedCompanyId" placeholder="Cuenta tu historia…" @stats="stats = $event" />
          <template #fallback>
            <div class="h-96 rounded-2xl border border-slate-200 bg-white animate-pulse" />
          </template>
        </ClientOnly>
        <p class="text-xs text-slate-400 text-right">{{ stats.words }} palabras · {{ stats.characters }} caracteres · {{ readingLabel(Math.ceil(stats.words / 200)) }}</p>
      </div>
      <aside class="xl:col-span-4">
        <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] overflow-y-auto">
          <WebsitePostForm
            v-model="formData"
            :company-id="selectedCompanyId"
            :authors="authors"
            :categories="categories"
            :tag-suggestions="tagSuggestions"
            :post-options="postOptions"
          />
        </div>
      </aside>
    </div>
  </div>
</template>
