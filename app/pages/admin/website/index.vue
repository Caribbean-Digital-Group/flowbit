<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  FONT_PAIRINGS,
  STOREFRONT_PALETTES,
  STOREFRONT_THEMES,
  getTheme,
  resolveStorefrontTheme,
  type RadiusStyle
} from '~/utils/storefrontTheme'
import type { WebsiteSettingsRow, WebsiteSocialLink } from '~/types/website.types'
import type { WebsiteAdminStats } from '~/composables/useWebsiteSettings'

definePageMeta({ layout: 'admin' })

const config = useRuntimeConfig()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getByCompany, initialize, update, getStats, lastError } = useWebsiteSettings()
const { getCompanyById, updateCompany } = useCompany()
const { getByCompany: getStorefrontSettings } = useStorefrontSettings()

const isLoading = ref(false)
const isSaving = ref(false)
const isInitializing = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const hasSettings = ref(false)
const stats = ref<WebsiteAdminStats | null>(null)
const companySlug = ref('')
const storefrontActive = ref(false)

type Tab = 'general' | 'identity' | 'design' | 'blog' | 'seo'
const tab = ref<Tab>('general')
const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'identity', label: 'Identidad y contacto' },
  { id: 'design', label: 'Diseño' },
  { id: 'blog', label: 'Blog y comunidad' },
  { id: 'seo', label: 'SEO y avanzado' }
]

const settings = ref({
  is_active: false,
  site_name: '',
  tagline: '',
  logo_url: '',
  favicon_url: '',
  og_image_url: '',
  contact_email: '',
  contact_phone: '',
  whatsapp_phone: '',
  contact_address: '',
  contact_hours: '',
  map_embed_url: '',
  social_links: [] as WebsiteSocialLink[],
  theme: 'aurora',
  palette: 'indigo',
  font_pairing: 'system',
  color_primary: '',
  color_secondary: '',
  color_accent: '',
  radius_style: '',
  header_layout: 'classic' as WebsiteSettingsRow['header_layout'],
  footer_layout: 'columns' as WebsiteSettingsRow['footer_layout'],
  footer_text: '',
  show_powered_by: true,
  announcement: '',
  announcement_link: '',
  seo_title: '',
  seo_description: '',
  noindex: false,
  not_found_title: '',
  not_found_text: '',
  show_storefront_link: true,
  storefront_link_label: '',
  blog_enabled: true,
  blog_title: '',
  blog_description: '',
  posts_per_page: 9,
  comments_enabled: false,
  comments_auto_approve: false,
  reactions_enabled: true,
  gallery_enabled: true,
  members_can_publish: false
})

const siteUrl = computed(() => {
  if (!companySlug.value) return null
  return `${String(config.public.siteUrl).replace(/\/$/, '')}${websitePath(companySlug.value)}`
})

const previewUrl = computed(() => (companySlug.value ? `${websitePath(companySlug.value)}?preview=1` : null))

const previewOverrides = computed(() => ({
  themeId: settings.value.theme,
  paletteId: settings.value.palette,
  fontId: settings.value.font_pairing,
  primaryColor: settings.value.color_primary || null,
  secondaryColor: settings.value.color_secondary || null,
  accentColor: settings.value.color_accent || null,
  radius: (settings.value.radius_style || null) as RadiusStyle | null
}))

const previewTheme = computed(() => resolveStorefrontTheme(previewOverrides.value))
const contrastNotice = computed(() =>
  previewTheme.value.primaryWasAdjusted
    ? `Tu color ${previewTheme.value.primary} no tiene contraste suficiente para llevar texto encima. Los botones usarán ${previewTheme.value.primaryStrong}.`
    : null
)
const previewDevice = ref<'desktop' | 'mobile'>('desktop')

const applyTheme = (themeId: string) => {
  const theme = getTheme(themeId)
  settings.value.theme = theme.id
  settings.value.palette = theme.paletteId
  settings.value.font_pairing = theme.fontId
  settings.value.radius_style = ''
  settings.value.color_primary = ''
  settings.value.color_secondary = ''
  settings.value.color_accent = ''
}

const applyPalette = (paletteId: string) => {
  settings.value.palette = paletteId
  settings.value.color_primary = ''
  settings.value.color_secondary = ''
  settings.value.color_accent = ''
}

const copyStorefrontDesign = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const store = await getStorefrontSettings(cid)
  if (!store) {
    errorMessage.value = 'La empresa no tiene una tienda configurada de la que copiar el diseño.'
    return
  }
  settings.value.theme = store.theme
  settings.value.palette = store.palette
  settings.value.font_pairing = store.font_pairing
  settings.value.color_primary = store.color_primary ?? ''
  settings.value.color_secondary = store.color_secondary ?? ''
  settings.value.color_accent = store.color_accent ?? ''
  settings.value.radius_style = store.radius_style ?? ''
  successMessage.value = 'Diseño de la tienda copiado. Guarda para aplicarlo.'
}

const applyRow = (row: WebsiteSettingsRow) => {
  settings.value = {
    is_active: row.is_active,
    site_name: row.site_name ?? '',
    tagline: row.tagline ?? '',
    logo_url: row.logo_url ?? '',
    favicon_url: row.favicon_url ?? '',
    og_image_url: row.og_image_url ?? '',
    contact_email: row.contact_email ?? '',
    contact_phone: row.contact_phone ?? '',
    whatsapp_phone: row.whatsapp_phone ?? '',
    contact_address: row.contact_address ?? '',
    contact_hours: row.contact_hours ?? '',
    map_embed_url: row.map_embed_url ?? '',
    social_links: Array.isArray(row.social_links) ? row.social_links : [],
    theme: row.theme ?? 'aurora',
    palette: row.palette ?? 'indigo',
    font_pairing: row.font_pairing ?? 'system',
    color_primary: row.color_primary ?? '',
    color_secondary: row.color_secondary ?? '',
    color_accent: row.color_accent ?? '',
    radius_style: row.radius_style ?? '',
    header_layout: row.header_layout ?? 'classic',
    footer_layout: row.footer_layout ?? 'columns',
    footer_text: row.footer_text ?? '',
    show_powered_by: row.show_powered_by ?? true,
    announcement: row.announcement ?? '',
    announcement_link: row.announcement_link ?? '',
    seo_title: row.seo_title ?? '',
    seo_description: row.seo_description ?? '',
    noindex: row.noindex ?? false,
    not_found_title: row.not_found_title ?? '',
    not_found_text: row.not_found_text ?? '',
    show_storefront_link: row.show_storefront_link ?? true,
    storefront_link_label: row.storefront_link_label ?? '',
    blog_enabled: row.blog_enabled ?? true,
    blog_title: row.blog_title ?? '',
    blog_description: row.blog_description ?? '',
    posts_per_page: row.posts_per_page ?? 9,
    comments_enabled: row.comments_enabled ?? false,
    comments_auto_approve: row.comments_auto_approve ?? false,
    reactions_enabled: row.reactions_enabled ?? true,
    gallery_enabled: row.gallery_enabled ?? true,
    members_can_publish: row.members_can_publish ?? false
  }
}

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const [row, company, store] = await Promise.all([getByCompany(cid), getCompanyById(cid), getStorefrontSettings(cid)])
    companySlug.value = company?.slug ?? ''
    storefrontActive.value = !!store?.is_active
    hasSettings.value = !!row
    if (row) {
      applyRow(row)
      stats.value = await getStats(cid)
    } else if (lastError.value) {
      errorMessage.value = lastError.value
    }
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleInitialize = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isInitializing.value = true
  errorMessage.value = null
  try {
    const result = await initialize(cid)
    if (!result) {
      errorMessage.value = lastError.value ?? 'No se pudo crear el sitio.'
      return
    }
    if (result.status === 'forbidden') {
      errorMessage.value = 'Solo los administradores de la empresa pueden crear el sitio web.'
      return
    }
    await load()
    successMessage.value = 'Sitio creado con páginas de ejemplo. Personalízalo y actívalo cuando esté listo.'
  } finally {
    isInitializing.value = false
  }
}

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  errorMessage.value = null
  successMessage.value = null

  const slug = companySlug.value.trim().toLowerCase()
  if (settings.value.is_active && !slug) {
    errorMessage.value = 'Define la URL (slug) de la empresa antes de activar el sitio.'
    return
  }
  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    errorMessage.value = 'El slug solo puede tener minúsculas, números y guiones.'
    return
  }

  isSaving.value = true
  try {
    if (slug !== (selectedCompany.value?.slug ?? '')) {
      const company = await updateCompany(cid, { slug: slug || null })
      if (!company) {
        errorMessage.value = 'No se pudo guardar el slug. Puede que ya esté en uso por otra empresa.'
        return
      }
      await authStore.fetchCompanies()
    }

    const s = settings.value
    const row = await update(cid, {
      is_active: s.is_active,
      site_name: s.site_name.trim() || null,
      tagline: s.tagline.trim() || null,
      logo_url: s.logo_url.trim() || null,
      favicon_url: s.favicon_url.trim() || null,
      og_image_url: s.og_image_url.trim() || null,
      contact_email: s.contact_email.trim() || null,
      contact_phone: s.contact_phone.trim() || null,
      whatsapp_phone: s.whatsapp_phone.trim() || null,
      contact_address: s.contact_address.trim() || null,
      contact_hours: s.contact_hours.trim() || null,
      map_embed_url: isAllowedMapEmbed(s.map_embed_url) ? s.map_embed_url.trim() : null,
      social_links: s.social_links.filter(l => l.url.trim()).map(l => ({ network: l.network, url: l.url.trim() })),
      theme: s.theme,
      palette: s.palette,
      font_pairing: s.font_pairing,
      color_primary: s.color_primary || null,
      color_secondary: s.color_secondary || null,
      color_accent: s.color_accent || null,
      radius_style: s.radius_style || null,
      header_layout: s.header_layout,
      footer_layout: s.footer_layout,
      footer_text: s.footer_text.trim() || null,
      show_powered_by: s.show_powered_by,
      announcement: s.announcement.trim() || null,
      announcement_link: s.announcement_link.trim() || null,
      seo_title: s.seo_title.trim() || null,
      seo_description: s.seo_description.trim() || null,
      noindex: s.noindex,
      not_found_title: s.not_found_title.trim() || null,
      not_found_text: s.not_found_text.trim() || null,
      show_storefront_link: s.show_storefront_link,
      storefront_link_label: s.storefront_link_label.trim() || null,
      blog_enabled: s.blog_enabled,
      blog_title: s.blog_title.trim() || null,
      blog_description: s.blog_description.trim() || null,
      posts_per_page: Math.min(Math.max(Number(s.posts_per_page) || 9, 3), 30),
      comments_enabled: s.comments_enabled,
      comments_auto_approve: s.comments_auto_approve,
      reactions_enabled: s.reactions_enabled,
      gallery_enabled: s.gallery_enabled,
      members_can_publish: s.members_can_publish
    })
    if (!row) {
      errorMessage.value = lastError.value ?? 'No se pudo guardar. Solo los administradores pueden editar los ajustes.'
      return
    }
    applyRow(row)
    successMessage.value = 'Ajustes guardados.'
  } finally {
    isSaving.value = false
  }
}

const copySiteUrl = async () => {
  if (!siteUrl.value) return
  try {
    await navigator.clipboard.writeText(siteUrl.value)
    successMessage.value = 'Enlace copiado.'
  } catch {
    errorMessage.value = 'No se pudo copiar el enlace.'
  }
}

const quickLinks = [
  { label: 'Páginas', to: '/admin/website/pages', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z' },
  { label: 'Menús', to: '/admin/website/menus', icon: 'M4 6h16M4 12h16M4 18h16' },
  { label: 'Blog', to: '/admin/website/blog/posts', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2' },
  { label: 'Medios', to: '/admin/website/media', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5' },
  { label: 'Galerías', to: '/admin/website/galleries', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  { label: 'Mensajes', to: '/admin/website/submissions', icon: 'M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { label: 'Comentarios', to: '/admin/website/blog/comments', icon: 'M8 10h.01M12 10h.01M16 10h.01M21 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1121 12z' },
  { label: 'Redirecciones', to: '/admin/website/redirects', icon: 'M13 5l7 7-7 7M5 12h15' }
]

const headerOptions = [
  { value: 'classic', label: 'Clásico (logo izquierda, menú derecha)' },
  { value: 'centered', label: 'Centrado (logo arriba, menú debajo)' },
  { value: 'minimal', label: 'Mínimo (solo logo y menú hamburguesa)' }
]
const footerOptions = [
  { value: 'columns', label: 'Columnas (marca, enlaces, contacto)' },
  { value: 'simple', label: 'Una fila' },
  { value: 'minimal', label: 'Solo derechos' }
]
const radiusOptions = [
  { value: '', label: 'Según plantilla' },
  { value: 'sharp', label: 'Rectas' },
  { value: 'soft', label: 'Suaves' },
  { value: 'rounded', label: 'Redondeadas' },
  { value: 'pill', label: 'Píldora' }
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Sitio web</h1>
        <p class="text-slate-500 mt-1">Publica el sitio de tu empresa: páginas, blog, galerías y contacto.</p>
      </div>
      <div v-if="hasSettings" class="flex flex-wrap items-center gap-2">
        <NuxtLink v-if="previewUrl" :to="previewUrl" target="_blank" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.5 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.5 7c-1.2 4.1-5 7-9.5 7s-8.3-2.9-9.5-7z" /></svg>
          Vista previa
        </NuxtLink>
        <BtnApp label="Guardar cambios" size="md" :loading="isSaving" @click="handleSave" />
      </div>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <div v-if="successMessage" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-700">{{ successMessage }}</div>

    <div v-if="isLoading" class="py-20 text-center text-slate-400">Cargando…</div>

    <!-- Sin sitio: crear -->
    <div v-else-if="!hasSettings" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-10 text-center max-w-2xl mx-auto">
      <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-18c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3 12h18" /></svg>
      </div>
      <h2 class="text-xl font-bold text-slate-800 mt-6">Crea el sitio web de {{ selectedCompany?.name ?? 'tu empresa' }}</h2>
      <p class="text-slate-500 mt-2 leading-relaxed">
        Generaremos una página de inicio, «Nosotros» y «Contacto» con secciones de ejemplo, los menús y tu perfil de autor.
        El sitio queda inactivo hasta que lo publiques.
      </p>
      <BtnApp label="Crear mi sitio web" class="mt-8" :loading="isInitializing" @click="handleInitialize" />
      <p class="text-xs text-slate-400 mt-4">Requiere ser administrador de la empresa. El sitio se publicará en <span class="font-mono">/sites/{{ companySlug || 'tu-slug' }}</span>.</p>
    </div>

    <template v-else>
      <!-- Estadísticas -->
      <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <div v-for="card in [
          { label: 'Páginas publicadas', value: stats.pages_published, hint: `${stats.pages_draft} en borrador` },
          { label: 'Posts publicados', value: stats.posts_published, hint: `${stats.posts_draft} borradores · ${stats.posts_scheduled} programados` },
          { label: 'Lecturas (30 días)', value: stats.views_30d, hint: `${stats.claps_total} aplausos en total` },
          { label: 'Comentarios pendientes', value: stats.comments_pending, hint: 'por moderar' },
          { label: 'Mensajes nuevos', value: stats.submissions_new, hint: 'formulario de contacto' },
          { label: 'Archivos', value: stats.media_count, hint: formatBytes(stats.media_bytes) }
        ]" :key="card.label" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">{{ card.label }}</p>
          <p class="text-2xl font-bold text-slate-800 mt-1">{{ card.value }}</p>
          <p class="text-xs text-slate-500 mt-0.5">{{ card.hint }}</p>
        </div>
      </div>

      <!-- Accesos rápidos -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <NuxtLink v-for="link in quickLinks" :key="link.to" :to="link.to" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-4 flex flex-col items-center gap-2 text-center hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <span class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="link.icon" /></svg>
          </span>
          <span class="text-xs font-semibold text-slate-700">{{ link.label }}</span>
        </NuxtLink>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 overflow-x-auto rounded-2xl bg-white shadow-lg shadow-slate-200/50 p-1.5">
        <button v-for="t in tabs" :key="t.id" type="button" :class="['px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors', tab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50']" @click="tab = t.id">{{ t.label }}</button>
      </div>

      <!-- General -->
      <div v-show="tab === 'general'" class="space-y-6">
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
          <div class="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h2 class="text-base font-bold text-slate-800">Estado del sitio</h2>
              <p class="text-sm text-slate-500 mt-1">Mientras esté inactivo, solo los miembros pueden verlo con «Vista previa».</p>
            </div>
            <label class="inline-flex items-center cursor-pointer">
              <input v-model="settings.is_active" type="checkbox" class="sr-only peer" />
              <span class="relative w-12 h-7 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-6 after:h-6 after:bg-white after:rounded-full after:shadow after:transition-transform peer-checked:after:translate-x-5" />
              <span class="ml-3 text-sm font-medium text-slate-700">{{ settings.is_active ? 'Publicado' : 'Inactivo' }}</span>
            </label>
          </div>
          <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput v-model="companySlug" label="URL del sitio (slug de la empresa)" placeholder="mi-empresa" hint="Compartido con la tienda en línea. Solo minúsculas, números y guiones." size="md" />
            <div v-if="siteUrl" class="flex items-end gap-2">
              <div class="flex-1 min-w-0">
                <p class="block text-sm font-medium text-slate-700 mb-1.5">Enlace público</p>
                <a :href="siteUrl" target="_blank" rel="noopener" class="block truncate text-sm text-indigo-600 hover:text-indigo-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">{{ siteUrl }}</a>
              </div>
              <button type="button" class="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50" aria-label="Copiar enlace" @click="copySiteUrl">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </div>
          </div>
        </section>

        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <div>
            <h2 class="text-base font-bold text-slate-800">Barra de anuncio</h2>
            <p class="text-sm text-slate-500 mt-1">Mensaje destacado arriba del sitio (promociones, avisos).</p>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormInput v-model="settings.announcement" label="Texto" :maxlength="200" placeholder="Ej: Nuevo horario de atención" size="md" />
            <FormInput v-model="settings.announcement_link" label="Enlace (opcional)" type="url" placeholder="https://…" size="md" />
          </div>
        </section>

        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <div>
            <h2 class="text-base font-bold text-slate-800">Tienda en línea</h2>
            <p class="text-sm text-slate-500 mt-1">
              <template v-if="storefrontActive">Tu tienda está activa: el sitio puede enlazarla en el menú y mostrar productos destacados.</template>
              <template v-else>La tienda no está activa. Actívala en <NuxtLink to="/admin/storefront" class="text-indigo-600 font-semibold">Tienda en línea</NuxtLink> para enlazarla desde el sitio.</template>
            </p>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
              <input v-model="settings.show_storefront_link" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
              <span class="text-sm text-slate-700">Mostrar botón hacia la tienda en la cabecera</span>
            </label>
            <FormInput v-model="settings.storefront_link_label" label="Texto del botón" placeholder="Tienda" :maxlength="40" size="md" />
          </div>
        </section>

        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-4">
          <h2 class="text-base font-bold text-slate-800">Flujo editorial</h2>
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
            <input v-model="settings.members_can_publish" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <span class="text-sm text-slate-700">Los miembros del equipo pueden publicar (si está apagado, solo administradores; los miembros guardan borradores)</span>
          </label>
        </section>
      </div>

      <!-- Identidad y contacto -->
      <div v-show="tab === 'identity'" class="space-y-6">
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <h2 class="text-base font-bold text-slate-800">Identidad</h2>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormInput v-model="settings.site_name" label="Nombre del sitio" :placeholder="selectedCompany?.name ?? ''" hint="Vacío = nombre de la empresa." size="md" />
            <FormInput v-model="settings.tagline" label="Eslogan" :maxlength="240" placeholder="Una frase que describa lo que haces" size="md" />
          </div>
          <div v-if="selectedCompanyId" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <WebsiteImageField v-model="settings.logo_url" label="Logo" hint="Vacío = logo de la empresa." :company-id="selectedCompanyId" aspect="square" />
            <WebsiteImageField v-model="settings.favicon_url" label="Favicon" hint="PNG o SVG cuadrado." :company-id="selectedCompanyId" aspect="square" />
            <WebsiteImageField v-model="settings.og_image_url" label="Imagen para redes" hint="1200×630 px. Se usa al compartir enlaces." :company-id="selectedCompanyId" />
          </div>
        </section>
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <h2 class="text-base font-bold text-slate-800">Contacto público</h2>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FormInput v-model="settings.contact_email" label="Correo" type="email" size="md" />
            <FormInput v-model="settings.contact_phone" label="Teléfono" type="tel" size="md" />
            <FormInput v-model="settings.whatsapp_phone" label="WhatsApp" type="tel" placeholder="+52 55 1234 5678" hint="Muestra el botón flotante." size="md" />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormTextArea v-model="settings.contact_address" label="Dirección" :rows="2" />
            <FormTextArea v-model="settings.contact_hours" label="Horario de atención" :rows="2" placeholder="Lun–Vie 9:00 a 18:00" />
          </div>
          <FormInput v-model="settings.map_embed_url" label="Mapa (URL de inserción de Google Maps)" type="url" hint="Google Maps → Compartir → Insertar un mapa → copia el src del iframe." size="md" />
          <WebsiteSocialLinksField v-model="settings.social_links" />
        </section>
      </div>

      <!-- Diseño -->
      <div v-show="tab === 'design'" class="space-y-6">
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 class="text-base font-bold text-slate-800">Diseño del sitio</h2>
              <p class="text-sm text-slate-500 mt-1">Plantilla, paleta y tipografía. Se comparte el motor de temas de la tienda.</p>
            </div>
            <button v-if="storefrontActive" type="button" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800" @click="copyStorefrontDesign">Copiar el diseño de mi tienda</button>
          </div>

          <div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Vista previa</p>
              <div class="flex items-center gap-1 rounded-lg bg-white border border-slate-200 p-0.5">
                <button type="button" :class="['px-2.5 py-1 rounded-md text-xs font-semibold', previewDevice === 'desktop' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500']" @click="previewDevice = 'desktop'">Escritorio</button>
                <button type="button" :class="['px-2.5 py-1 rounded-md text-xs font-semibold', previewDevice === 'mobile' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500']" @click="previewDevice = 'mobile'">Celular</button>
              </div>
            </div>
            <StorefrontThemePreview :overrides="previewOverrides" :store-name="settings.site_name || selectedCompany?.name || 'Mi sitio'" :hero-title="settings.tagline" cta-label="Contáctanos" :device="previewDevice" />
            <p v-if="contrastNotice" class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{{ contrastNotice }}</p>
          </div>

          <div class="mt-6">
            <p class="block text-sm font-medium text-slate-700 mb-2">Plantilla</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button v-for="theme in STOREFRONT_THEMES" :key="theme.id" type="button" :class="['text-left rounded-xl border p-4 transition-colors', settings.theme === theme.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50']" @click="applyTheme(theme.id)">
                <p class="font-semibold text-sm text-slate-800">{{ theme.label }}</p>
                <p class="text-xs text-slate-500 mt-1">{{ theme.description }}</p>
              </button>
            </div>
          </div>

          <div class="mt-6">
            <p class="block text-sm font-medium text-slate-700 mb-2">Paleta</p>
            <div class="flex flex-wrap gap-2">
              <button v-for="palette in STOREFRONT_PALETTES" :key="palette.id" type="button" :class="['flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1.5 text-xs font-semibold', settings.palette === palette.id && !settings.color_primary ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50']" @click="applyPalette(palette.id)">
                <span class="flex -space-x-1">
                  <span class="w-4 h-4 rounded-full border border-white" :style="{ backgroundColor: palette.primary }" />
                  <span class="w-4 h-4 rounded-full border border-white" :style="{ backgroundColor: palette.secondary }" />
                  <span class="w-4 h-4 rounded-full border border-white" :style="{ backgroundColor: palette.accent }" />
                </span>
                {{ palette.label }}
              </button>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div v-for="field in [{ key: 'color_primary', label: 'Color principal' }, { key: 'color_secondary', label: 'Color secundario' }, { key: 'color_accent', label: 'Color de acento' }] as const" :key="field.key">
              <p class="block text-sm font-medium text-slate-700 mb-1.5">{{ field.label }}</p>
              <div class="flex items-center gap-3">
                <input type="color" :value="settings[field.key] || previewTheme[field.key === 'color_primary' ? 'primary' : field.key === 'color_secondary' ? 'secondary' : 'accent']" class="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-white" @input="settings[field.key] = ($event.target as HTMLInputElement).value" />
                <span class="text-sm text-slate-500 font-mono">{{ settings[field.key] || 'paleta' }}</span>
                <button v-if="settings[field.key]" type="button" class="text-xs text-slate-500 hover:text-slate-800" @click="settings[field.key] = ''">Restablecer</button>
              </div>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormSelect v-model="settings.font_pairing" label="Tipografía" :options="FONT_PAIRINGS.map(f => ({ value: f.id, label: f.label }))" :searchable="false" size="md" />
            <FormSelect v-model="settings.radius_style" label="Esquinas" :options="radiusOptions" :searchable="false" size="md" />
          </div>
        </section>

        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <h2 class="text-base font-bold text-slate-800">Cabecera y pie de página</h2>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormSelect v-model="settings.header_layout" label="Cabecera" :options="headerOptions" :searchable="false" size="md" />
            <FormSelect v-model="settings.footer_layout" label="Pie de página" :options="footerOptions" :searchable="false" size="md" />
          </div>
          <FormInput v-model="settings.footer_text" label="Texto de derechos" :placeholder="`© ${new Date().getFullYear()} ${selectedCompany?.name ?? ''}`" size="md" />
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
            <input v-model="settings.show_powered_by" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <span class="text-sm text-slate-700">Mostrar «Sitio creado con Flowbit»</span>
          </label>
        </section>
      </div>

      <!-- Blog y comunidad -->
      <div v-show="tab === 'blog'" class="space-y-6">
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-base font-bold text-slate-800">Blog</h2>
              <p class="text-sm text-slate-500 mt-1">Portada en <span class="font-mono">/blog</span>, categorías, etiquetas, autores y RSS.</p>
            </div>
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <input v-model="settings.blog_enabled" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
              <span class="text-sm text-slate-700">Habilitado</span>
            </label>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FormInput v-model="settings.blog_title" label="Título del blog" placeholder="Blog" size="md" />
            <FormInput v-model="settings.blog_description" label="Descripción" :maxlength="320" size="md" />
            <FormInput v-model.number="settings.posts_per_page" label="Posts por página" type="number" :min="3" :max="30" size="md" />
          </div>
        </section>
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-4">
          <h2 class="text-base font-bold text-slate-800">Comunidad</h2>
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
            <input v-model="settings.reactions_enabled" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <span class="text-sm text-slate-700">Aplausos en las publicaciones (hasta 50 por lector)</span>
          </label>
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
            <input v-model="settings.comments_enabled" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <span class="text-sm text-slate-700">Comentarios de lectores (con moderación en <NuxtLink to="/admin/website/blog/comments" class="text-indigo-600 font-semibold">Comentarios</NuxtLink>)</span>
          </label>
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none" :class="settings.comments_enabled ? '' : 'opacity-50'">
            <input v-model="settings.comments_auto_approve" type="checkbox" :disabled="!settings.comments_enabled" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <span class="text-sm text-slate-700">Aprobar comentarios automáticamente (no recomendado)</span>
          </label>
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
            <input v-model="settings.gallery_enabled" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <span class="text-sm text-slate-700">Sección de galerías en <span class="font-mono">/galeria</span></span>
          </label>
        </section>
      </div>

      <!-- SEO y avanzado -->
      <div v-show="tab === 'seo'" class="space-y-6">
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <h2 class="text-base font-bold text-slate-800">SEO global</h2>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormInput v-model="settings.seo_title" label="Título por defecto" :maxlength="120" hint="Se usa en la página de inicio." size="md" />
            <FormTextArea v-model="settings.seo_description" label="Descripción por defecto" :rows="2" :maxlength="320" show-count />
          </div>
          <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
            <input v-model="settings.noindex" type="checkbox" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
            <span class="text-sm text-slate-700">Pedir a los buscadores que no indexen el sitio (tampoco aparecerá en el sitemap)</span>
          </label>
          <p v-if="siteUrl" class="text-xs text-slate-500">Sitemap: <a :href="`${siteUrl}/sitemap.xml`" target="_blank" rel="noopener" class="text-indigo-600 font-mono">{{ siteUrl }}/sitemap.xml</a> · RSS: <a :href="`${siteUrl}/blog/rss.xml`" target="_blank" rel="noopener" class="text-indigo-600 font-mono">{{ siteUrl }}/blog/rss.xml</a></p>
        </section>
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 space-y-5">
          <h2 class="text-base font-bold text-slate-800">Página 404</h2>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormInput v-model="settings.not_found_title" label="Título" placeholder="Página no encontrada" size="md" />
            <FormTextArea v-model="settings.not_found_text" label="Texto" :rows="2" placeholder="La página que buscas no existe o fue movida." />
          </div>
        </section>
        <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
          <h2 class="text-base font-bold text-slate-800">Dominio personalizado</h2>
          <p class="text-sm text-slate-500 mt-1">Próximamente. Por ahora el sitio vive en <span class="font-mono">{{ siteUrl ?? '/sites/…' }}</span>. Puedes redirigir tu dominio a esa dirección desde tu proveedor de DNS.</p>
        </section>
      </div>

      <div class="flex justify-end">
        <BtnApp label="Guardar cambios" size="md" :loading="isSaving" @click="handleSave" />
      </div>
    </template>
  </div>
</template>
