<script setup lang="ts">
import { storeToRefs } from 'pinia'
import '~/assets/css/storefront.css'
import '~/assets/css/website.css'
import type { WebsiteMenuLink } from '~/composables/useWebsite'

const NuxtLink = resolveComponent('NuxtLink')
const route = useRoute()
const router = useRouter()
const websiteStore = useWebsiteStore()
const { site, menus, isLoading, notFound, preview, toastMessage } = storeToRefs(websiteStore)
const nav = useWebsiteNav()
const { themeStyle, useThemeFonts } = useWebsiteTheme()
useThemeFonts()

const companySlug = computed(() => {
  const raw = route.params.company_slug
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
})

const wantPreview = computed(() => route.query.preview === '1' || route.query.preview === 'true')

watch(
  [companySlug, wantPreview],
  ([slug, p]) => {
    if (slug) void websiteStore.initialize(slug, p)
  },
  { immediate: true }
)

const isMenuOpen = ref(false)
const openSubmenu = ref<string | null>(null)
const searchTerm = ref('')
const isSearchOpen = ref(false)

watch(() => route.fullPath, () => {
  isMenuOpen.value = false
  openSubmenu.value = null
  isSearchOpen.value = false
})

const mainLinks = computed<WebsiteMenuLink[]>(() => menus.value.main)
const footerLinks = computed<WebsiteMenuLink[]>(() => menus.value.footer)

const storefrontLink = computed(() =>
  site.value?.storefront_url && !mainLinks.value.some(l => l.href === site.value?.storefront_url)
    ? { label: site.value.storefront_link_label, href: site.value.storefront_url }
    : null
)

const headerLayout = computed(() => site.value?.header_layout ?? 'classic')

/** La cabecera mínima usa el menú desplegable también en escritorio. */
const isMinimalHeader = computed(() => headerLayout.value === 'minimal')

// Si el menú móvil queda abierto y la ventana pasa a escritorio, se cierra
// para no mostrar dos navegaciones a la vez.
let desktopQuery: MediaQueryList | null = null
const closeOnDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
  if (event.matches && !isMinimalHeader.value) {
    isMenuOpen.value = false
    openSubmenu.value = null
  }
}

onMounted(() => {
  desktopQuery = window.matchMedia('(min-width: 1024px)')
  desktopQuery.addEventListener('change', closeOnDesktop)
})

onUnmounted(() => {
  desktopQuery?.removeEventListener('change', closeOnDesktop)
})
const footerLayout = computed(() => site.value?.footer_layout ?? 'columns')

const whatsappLink = computed(() =>
  buildWhatsappLink(site.value?.whatsapp_phone, `¡Hola! Estoy visitando el sitio de ${site.value?.name ?? 'su empresa'} y me gustaría más información.`)
)

const handleSearch = () => {
  const term = searchTerm.value.trim()
  isSearchOpen.value = false
  if (!term) return
  router.push({ path: websitePath(companySlug.value, '/buscar'), query: { q: term, ...(preview.value ? { preview: '1' } : {}) } })
  searchTerm.value = ''
}

const isActive = (link: WebsiteMenuLink): boolean => {
  if (link.external) return false
  const target = websitePath(companySlug.value, link.href)
  return link.href === '' ? route.path === target : route.path === target || route.path.startsWith(`${target}/`)
}

const SOCIAL_ICONS: Record<string, string> = {
  facebook: 'M14 8h3V4h-3c-2.8 0-4 1.7-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z',
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5-1h.01',
  x: 'M4 4l16 16M20 4L4 20',
  linkedin: 'M6 9v10M6 5v.01M11 19v-6a3 3 0 016 0v6M11 9v10',
  youtube: 'M4 7a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7zm6 2v6l5-3-5-3z',
  tiktok: 'M14 4v10a3 3 0 11-3-3M14 4a4 4 0 004 4',
  whatsapp: 'M8 10h.01M12 10h.01M16 10h.01M21 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1121 12z',
  website: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-18c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3 12h18'
}

useHead(() => ({
  htmlAttrs: { lang: site.value?.lang ?? 'es' },
  titleTemplate: (title?: string) => {
    const name = site.value?.name
    if (!name) return title ?? 'Sitio web'
    return title && title !== name ? `${title} — ${name}` : name
  },
  link: site.value?.favicon_url ? [{ rel: 'icon', href: site.value.favicon_url }] : [],
  meta: [
    ...(site.value?.noindex || preview.value ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
    ...(site.value ? [{ property: 'og:site_name', content: site.value.name }] : [])
  ]
}))
</script>

<template>
  <div class="ws-root" :style="themeStyle">
    <!-- Barra de vista previa -->
    <div
      v-if="preview && site"
      class="bg-amber-500 text-amber-950 text-xs font-semibold text-center px-4 py-2 flex items-center justify-center gap-3"
    >
      <span>Vista previa: estás viendo contenido no publicado. Solo los miembros de la empresa ven esta versión.</span>
      <NuxtLink to="/admin/website" class="underline hover:no-underline">Volver al panel</NuxtLink>
    </div>

    <!-- Sitio no disponible -->
    <div v-if="notFound && !isLoading" class="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
      <div class="sf-surface-muted w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
        <svg class="w-8 h-8 sf-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-18c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3 12h18" />
        </svg>
      </div>
      <h1 class="sf-heading text-2xl font-bold mb-2">Sitio no disponible</h1>
      <p class="sf-muted max-w-md">Este sitio no existe o aún no ha sido publicado por su empresa.</p>
      <NuxtLink to="/" class="sf-link mt-6 text-sm">Ir a Flowbit</NuxtLink>
    </div>

    <!-- Cargando -->
    <div v-else-if="isLoading && !site" class="flex-1 flex items-center justify-center py-24">
      <div
        class="w-10 h-10 rounded-full border-4 animate-spin"
        :style="{ borderColor: 'var(--sf-border)', borderTopColor: 'var(--sf-primary)' }"
        aria-label="Cargando"
      />
    </div>

    <template v-else-if="site">
      <!-- Anuncio -->
      <div
        v-if="site.announcement"
        class="text-center text-xs sm:text-sm font-semibold px-4 py-2"
        :style="{ backgroundColor: 'var(--sf-accent-strong)', color: 'var(--sf-accent-contrast)' }"
      >
        <a v-if="site.announcement_link" :href="site.announcement_link" class="underline-offset-2 hover:underline">{{ site.announcement }}</a>
        <span v-else>{{ site.announcement }}</span>
      </div>

      <!-- Header -->
      <header class="sf-border-b sticky top-0 z-40 backdrop-blur-md" :style="{ backgroundColor: 'color-mix(in srgb, var(--sf-bg) 88%, transparent)' }">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            :class="[
              'flex items-center gap-4',
              headerLayout === 'centered' ? 'flex-col py-4' : 'justify-between h-16 sm:h-18'
            ]"
          >
            <!-- Marca -->
            <NuxtLink :to="nav.to('')" class="flex items-center gap-3 min-w-0 shrink-0">
              <img v-if="site.logo_url" :src="site.logo_url" :alt="site.name" class="h-9 w-auto max-w-[160px] object-contain" />
              <span
                v-else
                class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                :style="{ backgroundColor: 'var(--sf-primary-strong)', color: 'var(--sf-primary-contrast)', borderRadius: 'var(--sf-radius-md)' }"
              >
                {{ site.name.slice(0, 2).toUpperCase() }}
              </span>
              <span class="sf-heading text-lg font-semibold truncate">{{ site.name }}</span>
            </NuxtLink>

            <!-- Navegación desktop -->
            <nav v-if="!isMinimalHeader" class="hidden lg:flex items-center gap-1" aria-label="Principal">
              <div v-for="link in mainLinks" :key="link.id" class="relative group">
                <component
                  :is="nav.isExternal(link.href, link.external) ? 'a' : NuxtLink"
                  v-bind="nav.isExternal(link.href, link.external) ? { href: link.href, target: link.new_tab ? '_blank' : undefined, rel: link.new_tab ? 'noopener' : undefined } : { to: nav.to(link.href, link.external), target: link.new_tab ? '_blank' : undefined }"
                  :class="['inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors sf-hover-muted', isActive(link) ? 'sf-text-strong' : 'sf-muted']"
                >
                  {{ link.label }}
                  <svg v-if="link.children?.length" class="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </component>
                <div
                  v-if="link.children?.length"
                  class="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
                >
                  <div class="ws-card min-w-[200px] py-2">
                    <component
                      v-for="child in link.children"
                      :key="child.id"
                      :is="nav.isExternal(child.href, child.external) ? 'a' : NuxtLink"
                      v-bind="nav.isExternal(child.href, child.external) ? { href: child.href, target: child.new_tab ? '_blank' : undefined, rel: 'noopener' } : { to: nav.to(child.href, child.external) }"
                      class="block px-4 py-2 text-sm sf-muted sf-hover-muted sf-hover-text"
                    >
                      {{ child.label }}
                    </component>
                  </div>
                </div>
              </div>
              <a
                v-if="storefrontLink"
                :href="storefrontLink.href"
                class="ml-2 sf-btn sf-btn--primary sf-btn--sm"
              >
                {{ storefrontLink.label }}
              </a>
            </nav>

            <div class="flex items-center gap-1">
              <button type="button" class="sf-icon-btn" aria-label="Buscar" @click="isSearchOpen = !isSearchOpen">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.3-4.3M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
              </button>
              <!--
                La visibilidad responsiva va en el contenedor: .sf-icon-btn fija
                display fuera de las capas de Tailwind y anularía lg:hidden.
              -->
              <div :class="isMinimalHeader ? 'flex' : 'flex lg:hidden'">
                <button
                  type="button"
                  class="sf-icon-btn"
                  :aria-label="isMenuOpen ? 'Cerrar menú' : 'Abrir menú'"
                  :aria-expanded="isMenuOpen"
                  aria-controls="website-mobile-nav"
                  @click="isMenuOpen = !isMenuOpen"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path v-if="!isMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Búsqueda -->
          <form v-if="isSearchOpen" class="pb-3 flex gap-2" @submit.prevent="handleSearch">
            <input v-model="searchTerm" type="search" class="sf-input flex-1" placeholder="Buscar en el sitio…" autofocus />
            <button type="submit" class="sf-btn sf-btn--primary sf-btn--sm">Buscar</button>
          </form>
        </div>

        <!-- Menú móvil -->
        <nav
          v-if="isMenuOpen"
          id="website-mobile-nav"
          :class="['sf-border-t px-4 py-3 space-y-1', isMinimalHeader ? '' : 'lg:hidden']"
          :style="{ backgroundColor: 'var(--sf-bg)' }"
          aria-label="Menú móvil"
        >
          <div v-for="link in mainLinks" :key="link.id">
            <div class="flex items-center">
              <component
                :is="nav.isExternal(link.href, link.external) ? 'a' : NuxtLink"
                v-bind="nav.isExternal(link.href, link.external) ? { href: link.href, target: link.new_tab ? '_blank' : undefined, rel: 'noopener' } : { to: nav.to(link.href, link.external) }"
                class="flex-1 block px-3 py-2.5 rounded-md text-sm font-medium sf-muted sf-hover-muted"
              >
                {{ link.label }}
              </component>
              <button
                v-if="link.children?.length"
                type="button"
                class="sf-icon-btn"
                :aria-expanded="openSubmenu === link.id"
                @click="openSubmenu = openSubmenu === link.id ? null : link.id"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
            <div v-if="link.children?.length && openSubmenu === link.id" class="pl-4 space-y-0.5">
              <component
                v-for="child in link.children"
                :key="child.id"
                :is="nav.isExternal(child.href, child.external) ? 'a' : NuxtLink"
                v-bind="nav.isExternal(child.href, child.external) ? { href: child.href, rel: 'noopener' } : { to: nav.to(child.href, child.external) }"
                class="block px-3 py-2 rounded-md text-sm sf-muted sf-hover-muted"
              >
                {{ child.label }}
              </component>
            </div>
          </div>
          <a v-if="storefrontLink" :href="storefrontLink.href" class="sf-btn sf-btn--primary sf-btn--sm w-full mt-2">{{ storefrontLink.label }}</a>
        </nav>
      </header>

      <main class="flex-1">
        <slot />
      </main>

      <!-- Footer -->
      <footer :class="['sf-footer mt-auto', whatsappLink ? 'sf-footer--fab' : '']">
        <div :class="['max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', footerLayout === 'minimal' ? 'py-6' : 'pt-12 pb-8']">
          <!-- Columnas -->
          <div v-if="footerLayout === 'columns'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            <div class="sm:col-span-2">
              <NuxtLink :to="nav.to('')" class="inline-flex items-center gap-3">
                <img v-if="site.logo_url" :src="site.logo_url" :alt="site.name" class="h-9 w-auto max-w-[160px] object-contain" />
                <span
                  v-else
                  class="w-9 h-9 flex items-center justify-center font-bold text-sm"
                  :style="{ backgroundColor: 'var(--sf-primary-strong)', color: 'var(--sf-primary-contrast)', borderRadius: 'var(--sf-radius-md)' }"
                >
                  {{ site.name.slice(0, 2).toUpperCase() }}
                </span>
                <span class="sf-heading text-base font-semibold">{{ site.name }}</span>
              </NuxtLink>
              <p v-if="site.tagline || site.description" class="sf-muted text-sm leading-relaxed mt-4 max-w-md">{{ site.tagline || site.description }}</p>
              <div v-if="site.social_links?.length" class="flex flex-wrap items-center gap-1 mt-5 -ml-2">
                <a
                  v-for="social in site.social_links"
                  :key="social.network + social.url"
                  :href="social.url"
                  target="_blank"
                  rel="noopener"
                  class="sf-icon-btn"
                  :aria-label="social.network"
                >
                  <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="SOCIAL_ICONS[social.network] ?? SOCIAL_ICONS.website" /></svg>
                </a>
              </div>
            </div>

            <nav v-if="footerLinks.length" aria-label="Enlaces del pie de página">
              <p class="sf-footer-title">Enlaces</p>
              <ul class="space-y-2.5">
                <li v-for="link in footerLinks" :key="link.id">
                  <component
                    :is="nav.isExternal(link.href, link.external) ? 'a' : NuxtLink"
                    v-bind="nav.isExternal(link.href, link.external) ? { href: link.href, rel: 'noopener', target: link.new_tab ? '_blank' : undefined } : { to: nav.to(link.href, link.external) }"
                    class="sf-footer-link"
                  >
                    {{ link.label }}
                  </component>
                </li>
              </ul>
            </nav>

            <div v-if="site.contact_email || site.contact_phone || site.contact_address || site.contact_hours">
              <p class="sf-footer-title">Contacto</p>
              <ul class="space-y-2.5">
                <li v-if="site.contact_email"><a :href="`mailto:${site.contact_email}`" class="sf-footer-link break-all">{{ site.contact_email }}</a></li>
                <li v-if="site.contact_phone"><a :href="`tel:${site.contact_phone}`" class="sf-footer-link">{{ site.contact_phone }}</a></li>
                <li v-if="site.contact_address" class="sf-muted text-sm leading-relaxed">{{ site.contact_address }}</li>
                <li v-if="site.contact_hours" class="sf-subtle text-sm leading-relaxed">{{ site.contact_hours }}</li>
              </ul>
            </div>
          </div>

          <!-- Una fila -->
          <div v-else-if="footerLayout === 'simple'" class="flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-center md:text-left">
            <NuxtLink :to="nav.to('')" class="inline-flex items-center justify-center md:justify-start gap-3">
              <img v-if="site.logo_url" :src="site.logo_url" :alt="site.name" class="h-8 w-auto object-contain" />
              <span class="sf-heading text-base font-semibold">{{ site.name }}</span>
            </NuxtLink>
            <ul v-if="footerLinks.length" class="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <li v-for="link in footerLinks" :key="link.id">
                <component
                  :is="nav.isExternal(link.href, link.external) ? 'a' : NuxtLink"
                  v-bind="nav.isExternal(link.href, link.external) ? { href: link.href, rel: 'noopener' } : { to: nav.to(link.href, link.external) }"
                  class="sf-footer-link"
                >
                  {{ link.label }}
                </component>
              </li>
            </ul>
            <div v-if="site.social_links?.length" class="flex items-center justify-center gap-1">
              <a v-for="social in site.social_links" :key="social.network + social.url" :href="social.url" target="_blank" rel="noopener" class="sf-icon-btn" :aria-label="social.network">
                <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="SOCIAL_ICONS[social.network] ?? SOCIAL_ICONS.website" /></svg>
              </a>
            </div>
          </div>

          <!-- Derechos -->
          <div
            :class="[
              'flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left',
              footerLayout === 'minimal' ? 'sf-footer-bar sf-footer-bar--flat' : 'sf-footer-bar'
            ]"
          >
            <p class="sf-subtle text-xs">
              {{ site.footer_text || `© ${new Date().getFullYear()} ${site.company_name}. Todos los derechos reservados.` }}
            </p>
            <p v-if="site.show_powered_by" class="sf-subtle text-xs">
              Sitio creado con <a href="/" class="sf-muted font-semibold hover:underline">Flowbit</a>
            </p>
          </div>
        </div>
      </footer>

      <!-- WhatsApp -->
      <a
        v-if="whatsappLink"
        :href="whatsappLink"
        target="_blank"
        rel="noopener"
        class="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/40 transition-transform hover:scale-105"
        aria-label="Escribir por WhatsApp"
      >
        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1a8.1 8.1 0 01-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4a3.4 3.4 0 00-1 2.5c0 1.5 1.1 2.9 1.2 3.1.2.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.5.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4l-.5-.5zM12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2z" />
        </svg>
      </a>

      <!-- Toast -->
      <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 translate-y-2" leave-active-class="transition duration-150" leave-to-class="opacity-0">
        <div
          v-if="toastMessage"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
          :style="{ backgroundColor: 'var(--sf-text)', color: 'var(--sf-bg)' }"
          role="status"
        >
          {{ toastMessage }}
        </div>
      </Transition>
    </template>
  </div>
</template>
