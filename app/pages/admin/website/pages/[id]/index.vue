<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import { createEmptyWebsitePageForm, type WebsitePageFormData } from '~/components/WebsitePage/Form.vue'
import { normalizeSections, type WebsiteSection } from '~/utils/website/sections'
import type { RadiusStyle } from '~/utils/storefrontTheme'
import type { WebsitePageRevisionRow, WebsitePageRow, WebsitePageStatus } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getById, update, archive, getRevisions, getAllByCompany, lastError } = useWebsitePage()
const { getByCompany: getSettings } = useWebsiteSettings()
const { sanitizeSections } = useWebsiteContent()

const pageId = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id ?? ''))

const page = ref<WebsitePageRow | null>(null)
const formData = ref<WebsitePageFormData>(createEmptyWebsitePageForm())
const sections = ref<WebsiteSection[]>([])
const revisions = ref<WebsitePageRevisionRow[]>([])
const linkOptions = ref<{ value: string; label: string }[]>([])
const themeOverrides = ref<{ themeId?: string | null; paletteId?: string | null; fontId?: string | null; primaryColor?: string | null; secondaryColor?: string | null; accentColor?: string | null; radius?: RadiusStyle | null }>({})

const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const showMeta = ref(false)
const showRevisions = ref(false)
const dirty = ref(false)

const companySlug = computed(() => selectedCompany.value?.slug ?? '')
const previewPath = computed(() => {
  if (!companySlug.value || !page.value) return null
  return `${websitePath(companySlug.value, page.value.is_home ? '' : `/${page.value.slug ?? ''}`)}?preview=1`
})

const STATUS_LABEL: Record<WebsitePageStatus, string> = { draft: 'Borrador', published: 'Publicada', archived: 'Archivada' }
const STATUS_VARIANT: Record<WebsitePageStatus, 'secondary' | 'success' | 'danger'> = { draft: 'secondary', published: 'success', archived: 'danger' }

const applyRow = (row: WebsitePageRow) => {
  page.value = row
  formData.value = {
    title: row.title,
    slug: row.slug ?? '',
    status: row.status,
    is_home: row.is_home,
    layout: row.layout,
    show_title: row.show_title,
    excerpt: row.excerpt ?? '',
    seo_title: row.seo_title ?? '',
    seo_description: row.seo_description ?? '',
    og_image_url: row.og_image_url ?? '',
    canonical_url: row.canonical_url ?? '',
    noindex: row.noindex,
    show_in_search: row.show_in_search,
    display_order: row.display_order
  }
  sections.value = normalizeSections(row.content)
  dirty.value = false
}

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !pageId.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const [row, settings, pages] = await Promise.all([getById(pageId.value, cid), getSettings(cid), getAllByCompany(cid)])
    if (!row) { errorMessage.value = 'Página no encontrada.'; return }
    applyRow(row)
    if (settings) {
      themeOverrides.value = {
        themeId: settings.theme,
        paletteId: settings.palette,
        fontId: settings.font_pairing,
        primaryColor: settings.color_primary,
        secondaryColor: settings.color_secondary,
        accentColor: settings.color_accent,
        radius: (settings.radius_style as RadiusStyle | null) ?? null
      }
    }
    linkOptions.value = [
      ...pages.map(p => ({ value: p.is_home ? '/' : `/${p.slug}`, label: p.title })),
      { value: '/blog', label: 'Blog' },
      { value: '/galeria', label: 'Galerías' },
      ...(companySlug.value ? [{ value: `/stores/${companySlug.value}`, label: 'Tienda en línea' }] : [])
    ]
    revisions.value = await getRevisions(pageId.value, cid)
  } finally {
    isLoading.value = false
  }
}

watch([pageId, selectedCompanyId], load, { immediate: true })
watch([sections, formData], () => { dirty.value = true }, { deep: true })

const persist = async (status?: WebsitePageStatus) => {
  const cid = selectedCompanyId.value
  if (!cid || !page.value) return
  if (!formData.value.title.trim()) { errorMessage.value = 'El título es obligatorio.'; return }
  errorMessage.value = null
  successMessage.value = null
  isSaving.value = true
  try {
    const clean = await sanitizeSections(sections.value)
    if (!clean) { errorMessage.value = 'No se pudo procesar el contenido. Revisa tu conexión.'; return }
    const f = formData.value
    const row = await update(page.value.id, cid, {
      title: f.title.trim(),
      slug: f.slug.trim() || null,
      status: status ?? f.status,
      is_home: f.is_home,
      layout: f.layout,
      show_title: f.show_title,
      excerpt: f.excerpt.trim() || null,
      seo_title: f.seo_title.trim() || null,
      seo_description: f.seo_description.trim() || null,
      og_image_url: f.og_image_url.trim() || null,
      canonical_url: f.canonical_url.trim() || null,
      noindex: f.noindex,
      show_in_search: f.show_in_search,
      display_order: f.display_order,
      content: clean
    })
    if (!row) { errorMessage.value = lastError.value ?? 'No se pudo guardar la página.'; return }
    applyRow(row)
    revisions.value = await getRevisions(row.id, cid)
    successMessage.value = status === 'published' ? 'Página publicada.' : 'Cambios guardados.'
  } finally {
    isSaving.value = false
  }
}

const handleArchive = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !page.value || page.value.is_home) return
  if (await archive(page.value.id, cid)) router.push('/admin/website/pages')
  else errorMessage.value = lastError.value ?? 'No se pudo archivar.'
}

const restoreRevision = (revision: WebsitePageRevisionRow) => {
  sections.value = normalizeSections(revision.content)
  formData.value.title = revision.title
  showRevisions.value = false
  successMessage.value = `Versión ${revision.revision_no} cargada. Guarda para aplicarla.`
}

const menuOptions = computed<MenuOption[]>(() => [
  { id: 'unpublish', label: 'Pasar a borrador', disabled: page.value?.status !== 'published', action: () => void persist('draft') },
  { id: 'revisions', label: `Historial (${revisions.value.length})`, action: () => { showRevisions.value = !showRevisions.value } },
  { id: 'archive', label: 'Archivar', divider: true, variant: 'danger', disabled: page.value?.is_home, action: () => void handleArchive() }
])

onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return false
  return true
})
</script>

<template>
  <div class="space-y-4">
    <CardSheet
      :title="formData.title || 'Página'"
      :subtitle="page ? (page.is_home ? 'Página de inicio' : `/${page.slug ?? ''}`) : ''"
      :is-editing="false"
      :is-loading="isLoading"
      :show-edit-button="false"
      :show-footer="false"
      :menu-options="menuOptions"
      padding="sm"
      @back="router.push('/admin/website/pages')"
    >
      <template #status>
        <BadgeApp v-if="page" :label="STATUS_LABEL[page.status]" :variant="STATUS_VARIANT[page.status]" />
      </template>

      <div v-if="errorMessage" class="mb-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
      <div v-if="successMessage" class="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-700">{{ successMessage }}</div>

      <div class="flex flex-wrap items-center gap-2">
        <BtnApp label="Guardar" size="md" variant="secondary" :loading="isSaving" @click="persist()" />
        <BtnApp v-if="page?.status !== 'published'" label="Publicar" size="md" :loading="isSaving" @click="persist('published')" />
        <BtnApp v-else label="Actualizar publicación" size="md" :loading="isSaving" @click="persist('published')" />
        <NuxtLink v-if="previewPath" :to="previewPath" target="_blank" class="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-base font-semibold">Vista previa</NuxtLink>
        <button type="button" class="ml-auto text-sm font-semibold text-indigo-600 hover:text-indigo-800" @click="showMeta = !showMeta">
          {{ showMeta ? 'Ocultar ajustes de la página' : 'Ajustes de la página y SEO' }}
        </button>
      </div>

      <div v-if="showMeta && selectedCompanyId" class="mt-6 pt-6 border-t border-slate-100">
        <WebsitePageForm v-model="formData" :company-id="selectedCompanyId" :site-url="companySlug ? websitePath(companySlug) : ''" />
      </div>

      <div v-if="showRevisions" class="mt-6 pt-6 border-t border-slate-100">
        <p class="text-sm font-semibold text-slate-700 mb-3">Historial de versiones (se guardan las últimas 20)</p>
        <ul v-if="revisions.length" class="divide-y divide-slate-100 rounded-xl border border-slate-200">
          <li v-for="rev in revisions" :key="rev.id" class="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span class="text-slate-700">v{{ rev.revision_no }} · {{ rev.title }} <span class="text-slate-400">· {{ formatWebsiteDateTime(rev.created_at) }}</span></span>
            <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="restoreRevision(rev)">Cargar</button>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-400">Aún no hay versiones anteriores.</p>
      </div>
    </CardSheet>

    <WebsitePageEditor
      v-if="page && selectedCompanyId"
      v-model="sections"
      :company-id="selectedCompanyId"
      :company-slug="companySlug"
      :theme-overrides="themeOverrides"
      :link-options="linkOptions"
    />
  </div>
</template>
