<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  FONT_PAIRINGS,
  STOREFRONT_PALETTES,
  STOREFRONT_THEMES,
  getTheme,
  resolveStorefrontTheme,
  type ProductCardStyle,
  type RadiusStyle,
  type HeroLayout
} from '~/utils/storefrontTheme'
import { DEFAULT_BENEFITS } from '~/composables/useStorefrontTheme'

definePageMeta({ layout: 'admin' })

const config = useRuntimeConfig()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getByCompany, upsertForCompany, lastError: settingsError } = useStorefrontSettings()
const { getCompanyById, updateCompany } = useCompany()

const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Ajustes de la tienda (storefront_settings)
const settings = ref({
  is_active: false,
  hero_title: '',
  hero_subtitle: '',
  announcement: '',
  about_text: '',
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  whatsapp_phone: '',
  policy_shipping: '',
  policy_returns: '',
  policy_privacy: '',
  policy_terms: '',
  show_out_of_stock: true,
  // Diseño de la tienda
  theme: 'aurora',
  palette: 'indigo',
  font_pairing: 'system',
  color_primary: '' as string,
  color_secondary: '' as string,
  color_accent: '' as string,
  radius_style: '' as string,
  card_style: '' as string,
  hero_layout: '' as string,
  show_categories: true,
  show_featured: true,
  show_benefits: true,
  show_story: false,
  featured_limit: 8,
  hero_cta_label: '',
  announcement_link: '',
  stripe_enabled: false,
  stripe_publishable_key: '',
  stripe_secret_key: '',
  stripe_webhook_secret: ''
})

/** Beneficios de la portada; se guardan como JSON en storefront_settings. */
const benefits = ref<{ icon: string; title: string; text: string }[]>([...DEFAULT_BENEFITS])

const BENEFIT_ICON_OPTIONS = [
  { value: 'truck', label: 'Camión (envíos)' },
  { value: 'shield', label: 'Escudo (seguridad)' },
  { value: 'chat', label: 'Chat (atención)' },
  { value: 'tag', label: 'Etiqueta (precios)' },
  { value: 'gift', label: 'Regalo (promociones)' },
  { value: 'clock', label: 'Reloj (rapidez)' },
  { value: 'star', label: 'Estrella (calidad)' },
  { value: 'credit', label: 'Tarjeta (pagos)' }
]

const addBenefit = () => {
  if (benefits.value.length >= 6) return
  benefits.value.push({ icon: 'star', title: '', text: '' })
}

const removeBenefit = (index: number) => {
  benefits.value.splice(index, 1)
}

// Branding e identidad pública (tabla company)
const branding = ref({
  slug: '',
  logo_url: '',
  banner_url: '',
  primary_color: '#6366f1'
})

/** Ajustes que alimentan la vista previa: reflejan el formulario al instante. */
const previewOverrides = computed(() => ({
  themeId: settings.value.theme,
  paletteId: settings.value.palette,
  fontId: settings.value.font_pairing,
  primaryColor: settings.value.color_primary || branding.value.primary_color,
  secondaryColor: settings.value.color_secondary || null,
  accentColor: settings.value.color_accent || null,
  radius: (settings.value.radius_style || null) as RadiusStyle | null,
  cardStyle: (settings.value.card_style || null) as ProductCardStyle | null,
  heroLayout: (settings.value.hero_layout || null) as HeroLayout | null
}))

const previewTheme = computed(() => resolveStorefrontTheme(previewOverrides.value))

/** El tema resuelto ya corrigió el color para que el texto encima se lea. */
const contrastNotice = computed(() => {
  if (!previewTheme.value.primaryWasAdjusted) return null
  return `Tu color ${previewTheme.value.primary} no tiene contraste suficiente para llevar texto encima. Los botones usarán ${previewTheme.value.primaryStrong}, un tono ajustado de tu propio color, para que la etiqueta se lea.`
})

const previewDevice = ref<'desktop' | 'mobile'>('desktop')

/** Beneficios listos para guardar: se descartan los que quedaron vacíos. */
const cleanBenefits = computed(() =>
  benefits.value
    .map(b => ({ icon: b.icon, title: b.title.trim(), text: b.text.trim() }))
    .filter(b => b.title && b.text)
)

/** Aplica la plantilla elegida limpiando las personalizaciones anteriores. */
const applyTheme = (themeId: string) => {
  const theme = getTheme(themeId)
  settings.value.theme = theme.id
  settings.value.palette = theme.paletteId
  settings.value.font_pairing = theme.fontId
  settings.value.radius_style = ''
  settings.value.card_style = ''
  settings.value.hero_layout = ''
  settings.value.color_primary = ''
  settings.value.color_secondary = ''
  settings.value.color_accent = ''
}

/** Toma los colores de una paleta como personalización editable. */
const applyPalette = (paletteId: string) => {
  settings.value.palette = paletteId
  settings.value.color_primary = ''
  settings.value.color_secondary = ''
  settings.value.color_accent = ''
}

const storeUrl = computed(() => {
  if (!branding.value.slug) return null
  const base = (config.public.siteUrl as string).replace(/\/$/, '')
  return `${base}/stores/${branding.value.slug}`
})

const whatsappPreviewLink = computed(() => buildWhatsappLink(settings.value.whatsapp_phone))

/** URL del webhook de Stripe que el vendedor debe registrar en su dashboard. */
const stripeWebhookUrl = computed(() => {
  const base = (config.public.siteUrl as string).replace(/\/$/, '')
  return `${base}/api/storefront/stripe/webhook`
})

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const [row, company] = await Promise.all([getByCompany(cid), getCompanyById(cid)])

    settings.value = {
      is_active: row?.is_active ?? false,
      hero_title: row?.hero_title ?? '',
      hero_subtitle: row?.hero_subtitle ?? '',
      announcement: row?.announcement ?? '',
      about_text: row?.about_text ?? '',
      contact_email: row?.contact_email ?? '',
      contact_phone: row?.contact_phone ?? '',
      contact_address: row?.contact_address ?? '',
      whatsapp_phone: row?.whatsapp_phone ?? '',
      policy_shipping: row?.policy_shipping ?? '',
      policy_returns: row?.policy_returns ?? '',
      policy_privacy: row?.policy_privacy ?? '',
      policy_terms: row?.policy_terms ?? '',
      show_out_of_stock: row?.show_out_of_stock ?? true,
      theme: row?.theme ?? 'aurora',
      palette: row?.palette ?? 'indigo',
      font_pairing: row?.font_pairing ?? 'system',
      color_primary: row?.color_primary ?? '',
      color_secondary: row?.color_secondary ?? '',
      color_accent: row?.color_accent ?? '',
      radius_style: row?.radius_style ?? '',
      card_style: row?.card_style ?? '',
      hero_layout: row?.hero_layout ?? '',
      show_categories: row?.show_categories ?? true,
      show_featured: row?.show_featured ?? true,
      show_benefits: row?.show_benefits ?? true,
      show_story: row?.show_story ?? false,
      featured_limit: row?.featured_limit ?? 8,
      hero_cta_label: row?.hero_cta_label ?? '',
      announcement_link: row?.announcement_link ?? '',
      stripe_enabled: row?.stripe_enabled ?? false,
      stripe_publishable_key: row?.stripe_publishable_key ?? '',
      stripe_secret_key: row?.stripe_secret_key ?? '',
      stripe_webhook_secret: row?.stripe_webhook_secret ?? ''
    }

    benefits.value = Array.isArray(row?.benefits) && row.benefits.length
      ? row.benefits.map(b => ({ icon: b.icon, title: b.title, text: b.text }))
      : [...DEFAULT_BENEFITS]

    branding.value = {
      slug: company?.slug ?? '',
      logo_url: company?.logo_url ?? '',
      banner_url: company?.banner_url ?? '',
      primary_color: company?.primary_color ?? '#6366f1'
    }
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const handleSave = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return

  const slug = branding.value.slug.trim().toLowerCase()
  if (settings.value.is_active && !slug) {
    errorMessage.value = 'Configura una URL (slug) antes de activar la tienda.'
    return
  }
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errorMessage.value = 'El slug solo puede contener letras minúsculas, números y guiones.'
    return
  }

  const stripePk = settings.value.stripe_publishable_key.trim()
  const stripeSk = settings.value.stripe_secret_key.trim()
  const stripeWh = settings.value.stripe_webhook_secret.trim()
  if (settings.value.stripe_enabled) {
    if (!stripePk.startsWith('pk_')) {
      errorMessage.value = 'La publishable key de Stripe debe comenzar con «pk_».'
      return
    }
    if (!stripeSk.startsWith('sk_') && !stripeSk.startsWith('rk_')) {
      errorMessage.value = 'La secret key de Stripe debe comenzar con «sk_» (o «rk_» para claves restringidas).'
      return
    }
  }
  if (stripeWh && !stripeWh.startsWith('whsec_')) {
    errorMessage.value = 'El signing secret del webhook de Stripe debe comenzar con «whsec_».'
    return
  }

  errorMessage.value = null
  successMessage.value = null
  isSaving.value = true
  try {
    const companyResult = await updateCompany(cid, {
      slug: slug || null,
      logo_url: branding.value.logo_url.trim() || null,
      banner_url: branding.value.banner_url.trim() || null,
      primary_color: branding.value.primary_color
    })

    const settingsResult = await upsertForCompany(cid, {
      is_active: settings.value.is_active,
      hero_title: settings.value.hero_title.trim() || null,
      hero_subtitle: settings.value.hero_subtitle.trim() || null,
      announcement: settings.value.announcement.trim() || null,
      about_text: settings.value.about_text.trim() || null,
      contact_email: settings.value.contact_email.trim() || null,
      contact_phone: settings.value.contact_phone.trim() || null,
      contact_address: settings.value.contact_address.trim() || null,
      whatsapp_phone: settings.value.whatsapp_phone.trim() || null,
      policy_shipping: settings.value.policy_shipping.trim() || null,
      policy_returns: settings.value.policy_returns.trim() || null,
      policy_privacy: settings.value.policy_privacy.trim() || null,
      policy_terms: settings.value.policy_terms.trim() || null,
      show_out_of_stock: settings.value.show_out_of_stock,
      theme: settings.value.theme,
      palette: settings.value.palette,
      font_pairing: settings.value.font_pairing,
      color_primary: settings.value.color_primary || null,
      color_secondary: settings.value.color_secondary || null,
      color_accent: settings.value.color_accent || null,
      radius_style: settings.value.radius_style || null,
      card_style: settings.value.card_style || null,
      hero_layout: settings.value.hero_layout || null,
      show_categories: settings.value.show_categories,
      show_featured: settings.value.show_featured,
      show_benefits: settings.value.show_benefits,
      show_story: settings.value.show_story,
      featured_limit: settings.value.featured_limit,
      hero_cta_label: settings.value.hero_cta_label.trim() || null,
      announcement_link: settings.value.announcement_link.trim() || null,
      // Solo se guardan los beneficios con contenido real
      benefits: cleanBenefits.value.length ? cleanBenefits.value : null,
      stripe_enabled: settings.value.stripe_enabled,
      stripe_publishable_key: stripePk || null,
      stripe_secret_key: stripeSk || null,
      stripe_webhook_secret: stripeWh || null
    })

    if (!companyResult || !settingsResult) {
      errorMessage.value = settingsError.value
        ?? 'No se pudieron guardar todos los cambios. Verifica que el slug no esté en uso por otra empresa.'
      return
    }

    branding.value.slug = companyResult.slug ?? slug
    successMessage.value = 'Ajustes de la tienda guardados correctamente.'
  } finally {
    isSaving.value = false
  }
}

const copyStoreUrl = async () => {
  if (!storeUrl.value) return
  try {
    await navigator.clipboard.writeText(storeUrl.value)
    successMessage.value = 'Enlace copiado al portapapeles.'
  } catch {
    errorMessage.value = 'No se pudo copiar el enlace.'
  }
}

const copyWebhookUrl = async () => {
  try {
    await navigator.clipboard.writeText(stripeWebhookUrl.value)
    successMessage.value = 'URL del webhook copiada al portapapeles.'
  } catch {
    errorMessage.value = 'No se pudo copiar la URL del webhook.'
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Tienda en línea</h1>
        <p class="text-sm text-slate-500 mt-1">
          Configura la tienda pública de {{ selectedCompany?.name ?? 'tu empresa' }}.
        </p>
      </div>
      <BtnApp :disabled="isSaving || isLoading" @click="handleSave">
        {{ isSaving ? 'Guardando…' : 'Guardar cambios' }}
      </BtnApp>
    </div>

    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-sm text-red-700" role="alert">
      {{ errorMessage }}
    </div>
    <div v-if="successMessage" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-sm text-emerald-700" role="status">
      {{ successMessage }}
    </div>

    <div v-if="isLoading" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 py-16 text-center text-sm text-slate-400">
      Cargando ajustes…
    </div>

    <template v-else>
      <!-- Estado y URL -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-bold text-slate-800">Estado de la tienda</h2>
            <p class="text-sm text-slate-500 mt-1">
              Al activarla, cualquier persona podrá visitarla y comprar los productos publicados.
            </p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input v-model="settings.is_active" type="checkbox" class="sr-only peer" />
            <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
            <span class="ml-3 text-sm font-medium text-slate-700">
              {{ settings.is_active ? 'Activa' : 'Inactiva' }}
            </span>
          </label>
        </div>

        <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            v-model="branding.slug"
            label="URL de la tienda (slug)"
            placeholder="mi-empresa"
            hint="Solo minúsculas, números y guiones. Debe ser único."
            size="md"
          />
          <div v-if="storeUrl" class="flex items-end gap-2">
            <div class="flex-1 min-w-0">
              <p class="block text-sm font-medium text-slate-700 mb-1.5">Enlace público</p>
              <a
                :href="storeUrl"
                target="_blank"
                rel="noopener"
                class="block truncate text-sm text-indigo-600 hover:text-indigo-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
              >
                {{ storeUrl }}
              </a>
            </div>
            <button
              type="button"
              class="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              aria-label="Copiar enlace de la tienda"
              @click="copyStoreUrl"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        <label class="mt-5 flex items-center gap-3 cursor-pointer select-none">
          <input
            v-model="settings.show_out_of_stock"
            type="checkbox"
            class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />
          <span class="text-sm text-slate-700">Mostrar productos agotados en el catálogo</span>
        </label>
      </section>

      <!-- Branding -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <h2 class="text-base font-bold text-slate-800 mb-1">Branding</h2>
        <p class="text-sm text-slate-500 mb-6">Logo, banner y color con los que se mostrará tu tienda.</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            v-model="branding.logo_url"
            label="URL del logo"
            type="url"
            placeholder="https://..."
            size="md"
          />
          <FormInput
            v-model="branding.banner_url"
            label="URL del banner (hero)"
            type="url"
            placeholder="https://..."
            size="md"
          />
          <div>
            <label for="sf-color" class="block text-sm font-medium text-slate-700 mb-1.5">Color principal</label>
            <div class="flex items-center gap-3">
              <input
                id="sf-color"
                v-model="branding.primary_color"
                type="color"
                class="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-white"
              />
              <span class="text-sm text-slate-500 font-mono">{{ branding.primary_color }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Textos de la landing -->
      <!-- ══ Diseño de la tienda ═════════════════════════════════════════ -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <div class="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 class="text-base font-bold text-slate-800">Diseño de la tienda</h2>
            <p class="text-sm text-slate-500 mt-1">
              Elige una plantilla y personalízala. La vista previa se actualiza mientras editas.
            </p>
          </div>
        </div>

        <!-- Vista previa en vivo -->
        <div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Vista previa</p>
            <div class="flex items-center gap-1 rounded-lg bg-white border border-slate-200 p-0.5">
              <button
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                  previewDevice === 'desktop' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                ]"
                @click="previewDevice = 'desktop'"
              >
                Escritorio
              </button>
              <button
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                  previewDevice === 'mobile' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                ]"
                @click="previewDevice = 'mobile'"
              >
                Celular
              </button>
            </div>
          </div>

          <StorefrontThemePreview
            :overrides="previewOverrides"
            :store-name="selectedCompany?.name || 'Mi tienda'"
            :hero-title="settings.hero_title"
            :hero-subtitle="settings.hero_subtitle"
            :cta-label="settings.hero_cta_label || 'Explorar productos'"
            :device="previewDevice"
          />
        </div>

        <!-- Plantillas -->
        <div class="mt-6">
          <p class="block text-sm font-medium text-slate-700 mb-2">Plantilla</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              v-for="theme in STOREFRONT_THEMES"
              :key="theme.id"
              type="button"
              :class="[
                'text-left rounded-xl border p-3.5 transition-all',
                settings.theme === theme.id
                  ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-100'
                  : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
              ]"
              @click="applyTheme(theme.id)"
            >
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-sm font-bold text-slate-800">{{ theme.label }}</span>
                <span v-if="settings.theme === theme.id" class="text-indigo-600">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <!-- Muestra de color de la plantilla -->
              <div class="flex gap-1 mb-2">
                <span
                  v-for="(color, i) in [
                    resolveStorefrontTheme({ themeId: theme.id }).primary,
                    resolveStorefrontTheme({ themeId: theme.id }).secondary,
                    resolveStorefrontTheme({ themeId: theme.id }).accent
                  ]"
                  :key="i"
                  class="h-5 flex-1 rounded"
                  :style="{ backgroundColor: color }"
                />
              </div>
              <p class="text-xs text-slate-500 leading-relaxed">{{ theme.description }}</p>
              <p class="text-[11px] text-slate-400 mt-1.5">{{ theme.bestFor }}</p>
            </button>
          </div>
        </div>

        <!-- Paletas -->
        <div class="mt-6">
          <p class="block text-sm font-medium text-slate-700 mb-2">Paleta de colores</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="palette in STOREFRONT_PALETTES"
              :key="palette.id"
              type="button"
              :class="[
                'flex items-center gap-2 rounded-xl border px-3 py-2 transition-all',
                settings.palette === palette.id && !settings.color_primary
                  ? 'border-indigo-400 bg-indigo-50/60'
                  : 'border-slate-200 hover:border-indigo-200'
              ]"
              :title="palette.label"
              @click="applyPalette(palette.id)"
            >
              <span class="flex -space-x-1">
                <span class="w-4 h-4 rounded-full ring-2 ring-white" :style="{ backgroundColor: palette.primary }" />
                <span class="w-4 h-4 rounded-full ring-2 ring-white" :style="{ backgroundColor: palette.secondary }" />
                <span class="w-4 h-4 rounded-full ring-2 ring-white" :style="{ backgroundColor: palette.accent }" />
              </span>
              <span class="text-xs font-semibold text-slate-700">{{ palette.label }}</span>
            </button>
          </div>
        </div>

        <!-- Colores personalizados -->
        <div class="mt-6">
          <p class="block text-sm font-medium text-slate-700 mb-2">Colores personalizados</p>
          <p class="text-xs text-slate-500 mb-3">
            Déjalos vacíos para usar los de la paleta. Un color propio sobrescribe solo ese tono.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div v-for="field in [
              { key: 'color_primary', label: 'Principal', fallback: previewTheme.palette.primary },
              { key: 'color_secondary', label: 'Secundario', fallback: previewTheme.palette.secondary },
              { key: 'color_accent', label: 'Acento', fallback: previewTheme.palette.accent }
            ]" :key="field.key">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">{{ field.label }}</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  :value="(settings as Record<string, unknown>)[field.key] || field.fallback"
                  class="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  :aria-label="`Color ${field.label}`"
                  @input="(settings as Record<string, unknown>)[field.key] = ($event.target as HTMLInputElement).value"
                />
                <input
                  :value="(settings as Record<string, unknown>)[field.key]"
                  type="text"
                  placeholder="Paleta"
                  class="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  @input="(settings as Record<string, unknown>)[field.key] = ($event.target as HTMLInputElement).value"
                />
                <button
                  v-if="(settings as Record<string, unknown>)[field.key]"
                  type="button"
                  class="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Volver al color de la paleta"
                  @click="(settings as Record<string, unknown>)[field.key] = ''"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Aviso de contraste -->
          <div
            v-if="contrastNotice"
            class="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
          >
            <svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <p class="text-xs text-amber-800 leading-relaxed">{{ contrastNotice }}</p>
          </div>
        </div>

        <!-- Tipografía -->
        <div class="mt-6">
          <p class="block text-sm font-medium text-slate-700 mb-2">Tipografía</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              v-for="font in FONT_PAIRINGS"
              :key="font.id"
              type="button"
              :class="[
                'text-left rounded-xl border p-3 transition-all',
                settings.font_pairing === font.id
                  ? 'border-indigo-400 bg-indigo-50/60'
                  : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
              ]"
              @click="settings.font_pairing = font.id"
            >
              <p class="text-base font-bold text-slate-800" :style="{ fontFamily: font.headingStack }">
                {{ font.label }}
              </p>
              <p class="text-xs text-slate-500 mt-1 leading-relaxed" :style="{ fontFamily: font.bodyStack }">
                {{ font.description }}
              </p>
            </button>
          </div>
          <p class="text-[11px] text-slate-400 mt-2">
            Las tipografías distintas de «Sistema» se cargan desde Google Fonts en la tienda pública.
          </p>
        </div>

        <!-- Ajustes finos -->
        <div class="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormSelect
            v-model="settings.hero_layout"
            label="Composición del hero"
            :options="[
              { value: '', label: `Según plantilla (${getTheme(settings.theme).heroLayout})` },
              { value: 'split', label: 'Dividida (texto + productos)' },
              { value: 'centered', label: 'Centrada' },
              { value: 'banner', label: 'Banner a sangre' },
              { value: 'editorial', label: 'Editorial' },
              { value: 'compact', label: 'Compacta' }
            ]"
            size="md"
          />
          <FormSelect
            v-model="settings.card_style"
            label="Tarjeta de producto"
            :options="[
              { value: '', label: `Según plantilla (${getTheme(settings.theme).cardStyle})` },
              { value: 'elevated', label: 'Elevada' },
              { value: 'bordered', label: 'Con borde' },
              { value: 'minimal', label: 'Minimalista' },
              { value: 'overlay', label: 'Con acción sobre la imagen' }
            ]"
            size="md"
          />
          <FormSelect
            v-model="settings.radius_style"
            label="Esquinas"
            :options="[
              { value: '', label: `Según plantilla (${getTheme(settings.theme).radius})` },
              { value: 'sharp', label: 'Rectas' },
              { value: 'soft', label: 'Suaves' },
              { value: 'rounded', label: 'Redondeadas' },
              { value: 'pill', label: 'Muy redondeadas' }
            ]"
            size="md"
          />
        </div>
      </section>

      <!-- ══ Secciones de la portada ═════════════════════════════════════ -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <h2 class="text-base font-bold text-slate-800 mb-1">Secciones de la portada</h2>
        <p class="text-sm text-slate-500 mb-5">Decide qué ve tu cliente al entrar y en qué orden aparece.</p>

        <div class="space-y-3">
          <label
            v-for="section in [
              { key: 'show_categories', title: 'Categorías', desc: 'Tira con las categorías que tienen productos publicados.' },
              { key: 'show_featured', title: 'Productos destacados', desc: 'Rejilla con tus productos marcados como destacados.' },
              { key: 'show_story', title: 'Quiénes somos', desc: 'Bloque con tu historia. Requiere llenar «Quiénes somos».' },
              { key: 'show_benefits', title: 'Beneficios', desc: 'Tres motivos para comprarte, editables abajo.' }
            ]"
            :key="section.key"
            class="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 cursor-pointer hover:border-indigo-200 transition-colors"
          >
            <input
              type="checkbox"
              :checked="Boolean((settings as Record<string, unknown>)[section.key])"
              class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              @change="(settings as Record<string, unknown>)[section.key] = ($event.target as HTMLInputElement).checked"
            />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800">{{ section.title }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ section.desc }}</p>
            </div>
          </label>
        </div>

        <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            v-model.number="settings.featured_limit"
            label="Productos destacados en la portada"
            type="number"
            :min="4"
            :max="12"
            size="md"
            hint="Entre 4 y 12."
          />
          <FormInput
            v-model="settings.hero_cta_label"
            label="Texto del botón principal"
            placeholder="Explorar productos"
            size="md"
            hint="El botón del hero. Déjalo vacío para el texto por defecto."
          />
        </div>

        <!-- Beneficios editables -->
        <div v-if="settings.show_benefits" class="mt-6">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <p class="text-sm font-medium text-slate-700">Beneficios</p>
              <p class="text-xs text-slate-500">Habla de tu tienda real: envíos, garantías, horarios o atención.</p>
            </div>
            <button
              v-if="benefits.length < 6"
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              @click="addBenefit"
            >
              Agregar
            </button>
          </div>

          <div class="space-y-3">
            <div
              v-for="(benefit, index) in benefits"
              :key="index"
              class="rounded-xl border border-slate-200 p-3.5"
            >
              <div class="flex items-start gap-3">
                <div class="flex-1 grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
                  <FormSelect
                    v-model="benefit.icon"
                    label="Icono"
                    :options="BENEFIT_ICON_OPTIONS"
                    size="sm"
                  />
                  <div class="space-y-2">
                    <FormInput v-model="benefit.title" label="Título" placeholder="Envíos a todo el país" size="sm" />
                    <FormInput v-model="benefit.text" label="Descripción" placeholder="Entregamos en 2 a 4 días hábiles." size="sm" />
                  </div>
                </div>
                <button
                  type="button"
                  class="mt-6 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Quitar beneficio"
                  @click="removeBenefit(index)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.9 12.1a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <h2 class="text-base font-bold text-slate-800 mb-1">Textos de la portada</h2>
        <p class="text-sm text-slate-500 mb-6">Personaliza el mensaje principal que ven tus clientes.</p>

        <div class="space-y-4">
          <FormInput
            v-model="settings.announcement"
            label="Barra de anuncio (opcional)"
            placeholder="Ej: Envío gratis en compras mayores a $999"
            :maxlength="200"
            size="md"
          />
          <FormInput
            v-model="settings.hero_title"
            label="Título del hero"
            placeholder="Ej: Todo para tu hogar en un solo lugar"
            :maxlength="180"
            size="md"
          />
          <FormTextArea
            v-model="settings.hero_subtitle"
            label="Subtítulo del hero"
            placeholder="Una frase corta que invite a comprar..."
            :rows="2"
            :maxlength="500"
          />
          <FormTextArea
            v-model="settings.about_text"
            label="Quiénes somos"
            placeholder="Historia y propuesta de valor de tu empresa..."
            :rows="4"
          />
        </div>
      </section>

      <!-- Contacto -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <h2 class="text-base font-bold text-slate-800 mb-6">Contacto público</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput v-model="settings.contact_email" label="Email de contacto" type="email" size="md" />
          <FormInput v-model="settings.contact_phone" label="Teléfono" type="tel" size="md" />
          <div class="sm:col-span-2">
            <FormInput
              v-model="settings.whatsapp_phone"
              label="WhatsApp"
              type="tel"
              placeholder="Ej: 529982XXXXXX"
              hint="Formato internacional con lada de país, solo dígitos. Al configurarlo aparece un botón de chat flotante en la tienda."
              size="md"
            />
            <a
              v-if="whatsappPreviewLink"
              :href="whatsappPreviewLink"
              target="_blank"
              rel="noopener"
              class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Probar enlace de WhatsApp
            </a>
          </div>
          <div class="sm:col-span-2">
            <FormInput v-model="settings.contact_address" label="Dirección" size="md" />
          </div>
        </div>
      </section>

      <!-- Pasarela de pago (Stripe) -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-bold text-slate-800">Pasarela de pago — Stripe</h2>
            <p class="text-sm text-slate-500 mt-1">
              Permite que tus clientes paguen con tarjeta directamente en el checkout de la tienda.
              El cobro lo procesa Stripe; nunca capturamos ni almacenamos datos de tarjetas.
            </p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input v-model="settings.stripe_enabled" type="checkbox" class="sr-only peer" />
            <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
            <span class="ml-3 text-sm font-medium text-slate-700">
              {{ settings.stripe_enabled ? 'Habilitado' : 'Deshabilitado' }}
            </span>
          </label>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-4">
          <FormInput
            v-model="settings.stripe_publishable_key"
            label="Publishable key"
            placeholder="pk_live_..."
            hint="La encuentras en Stripe → Developers → API keys. Es pública y se usa para identificar tu cuenta."
            size="md"
          />
          <FormInput
            v-model="settings.stripe_secret_key"
            label="Secret key"
            type="password"
            placeholder="sk_live_..."
            hint="Clave privada de tu cuenta de Stripe. Solo la usa el servidor para crear los cobros; jamás se muestra en la tienda."
            size="md"
          />
          <FormInput
            v-model="settings.stripe_webhook_secret"
            label="Webhook signing secret (recomendado)"
            type="password"
            placeholder="whsec_..."
            hint="Permite confirmar pagos automáticamente aunque el cliente cierre la ventana. Créalo en Stripe → Developers → Webhooks."
            size="md"
          />

          <div class="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p class="text-sm font-medium text-slate-700 mb-1.5">URL del webhook</p>
            <div class="flex items-center gap-2">
              <code class="flex-1 min-w-0 truncate text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">{{ stripeWebhookUrl }}</code>
              <button
                type="button"
                class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white transition-colors flex-shrink-0"
                aria-label="Copiar URL del webhook"
                @click="copyWebhookUrl"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-2">
              En el dashboard de Stripe crea un endpoint de webhook con esta URL y suscríbelo a los eventos
              <code class="text-[0.7rem] bg-white border border-slate-200 rounded px-1">checkout.session.completed</code> y
              <code class="text-[0.7rem] bg-white border border-slate-200 rounded px-1">checkout.session.async_payment_succeeded</code>.
              Luego pega aquí el signing secret. Sin webhook, el pago se confirma cuando el cliente regresa a la tienda.
            </p>
          </div>
        </div>
      </section>

      <!-- Políticas -->
      <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
        <h2 class="text-base font-bold text-slate-800 mb-1">Políticas</h2>
        <p class="text-sm text-slate-500 mb-6">Se muestran en la página «Nosotros» de la tienda.</p>

        <div class="space-y-4">
          <FormTextArea v-model="settings.policy_shipping" label="Política de envíos" :rows="3" />
          <FormTextArea v-model="settings.policy_returns" label="Política de devoluciones" :rows="3" />
          <FormTextArea v-model="settings.policy_privacy" label="Aviso de privacidad" :rows="3" />
          <FormTextArea v-model="settings.policy_terms" label="Términos y condiciones" :rows="3" />
        </div>
      </section>

      <!-- Ayuda -->
      <section class="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-6">
        <h2 class="text-sm font-bold text-slate-800 mb-2">Checklist para vender en línea</h2>
        <ul class="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
          <li>Publica productos desde <NuxtLink to="/admin/products" class="text-indigo-600 font-medium hover:underline">Productos</NuxtLink> (opción «Publicado en tienda»).</li>
          <li>Configura al menos un <NuxtLink to="/admin/storefront/shipping-methods" class="text-indigo-600 font-medium hover:underline">método de envío</NuxtLink>.</li>
          <li>Configura al menos un <NuxtLink to="/admin/payment-methods" class="text-indigo-600 font-medium hover:underline">método de pago</NuxtLink> o habilita el pago con tarjeta vía Stripe.</li>
          <li>Opcional: crea <NuxtLink to="/admin/storefront/coupons" class="text-indigo-600 font-medium hover:underline">cupones de descuento</NuxtLink>.</li>
          <li>Las ventas llegan a <NuxtLink to="/admin/orders" class="text-indigo-600 font-medium hover:underline">Órdenes</NuxtLink> con origen «Tienda en línea».</li>
        </ul>
      </section>
    </template>
  </div>
</template>
