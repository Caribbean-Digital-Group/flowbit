<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'admin' })

const config = useRuntimeConfig()
const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getByCompany, upsertForCompany } = useStorefrontSettings()
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
  policy_shipping: '',
  policy_returns: '',
  policy_privacy: '',
  policy_terms: '',
  show_out_of_stock: true
})

// Branding e identidad pública (tabla company)
const branding = ref({
  slug: '',
  logo_url: '',
  banner_url: '',
  primary_color: '#6366f1'
})

const storeUrl = computed(() => {
  if (!branding.value.slug) return null
  const base = (config.public.siteUrl as string).replace(/\/$/, '')
  return `${base}/stores/${branding.value.slug}`
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
      policy_shipping: row?.policy_shipping ?? '',
      policy_returns: row?.policy_returns ?? '',
      policy_privacy: row?.policy_privacy ?? '',
      policy_terms: row?.policy_terms ?? '',
      show_out_of_stock: row?.show_out_of_stock ?? true
    }

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
      policy_shipping: settings.value.policy_shipping.trim() || null,
      policy_returns: settings.value.policy_returns.trim() || null,
      policy_privacy: settings.value.policy_privacy.trim() || null,
      policy_terms: settings.value.policy_terms.trim() || null,
      show_out_of_stock: settings.value.show_out_of_stock
    })

    if (!companyResult || !settingsResult) {
      errorMessage.value = 'No se pudieron guardar todos los cambios. Verifica que el slug no esté en uso por otra empresa.'
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
            <FormInput v-model="settings.contact_address" label="Dirección" size="md" />
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
          <li>Configura al menos un <NuxtLink to="/admin/payment-methods" class="text-indigo-600 font-medium hover:underline">método de pago</NuxtLink>.</li>
          <li>Opcional: crea <NuxtLink to="/admin/storefront/coupons" class="text-indigo-600 font-medium hover:underline">cupones de descuento</NuxtLink>.</li>
          <li>Las ventas llegan a <NuxtLink to="/admin/orders" class="text-indigo-600 font-medium hover:underline">Órdenes</NuxtLink> con origen «Tienda en línea».</li>
        </ul>
      </section>
    </template>
  </div>
</template>
