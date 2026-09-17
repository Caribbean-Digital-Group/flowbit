import { defineStore } from 'pinia'
import type { WebsiteInfo, WebsiteSiteInfo, WebsiteMenuLink } from '~/composables/useWebsite'

/**
 * Estado compartido del sitio web público: sitio actual (settings + menús)
 * cargado una vez por slug, modo vista previa y toast.
 */
export const useWebsiteStore = defineStore('website', () => {
  const { getWebsite } = useWebsite()

  const slug = ref<string | null>(null)
  const site = ref<WebsiteSiteInfo | null>(null)
  const menus = ref<{ main: WebsiteMenuLink[]; footer: WebsiteMenuLink[] }>({ main: [], footer: [] })
  const pages = ref<WebsiteInfo['pages']>([])
  const hasPosts = ref(false)
  const hasGalleries = ref(false)
  const isLoading = ref(false)
  const notFound = ref(false)
  /** Vista previa activa: se envía p_preview a los RPCs y se muestra la barra. */
  const preview = ref(false)

  const toastMessage = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  const notify = (message: string) => {
    toastMessage.value = message
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastMessage.value = null
    }, 3200)
  }

  const basePath = computed(() => (slug.value ? websitePath(slug.value) : '/'))

  const initialize = async (newSlug: string, wantPreview = false): Promise<boolean> => {
    if (slug.value === newSlug && site.value && preview.value === wantPreview) return true

    isLoading.value = true
    notFound.value = false
    try {
      const result = await getWebsite(newSlug, wantPreview)
      slug.value = newSlug
      preview.value = wantPreview
      if (!result) {
        notFound.value = true
        site.value = null
        menus.value = { main: [], footer: [] }
        pages.value = []
        hasPosts.value = false
        hasGalleries.value = false
        return false
      }
      site.value = result.site
      menus.value = result.menus
      pages.value = result.pages
      hasPosts.value = result.has_posts
      hasGalleries.value = result.has_galleries
      preview.value = result.preview
      return true
    } finally {
      isLoading.value = false
    }
  }

  const refresh = async () => {
    if (!slug.value) return
    const current = slug.value
    slug.value = null
    await initialize(current, preview.value)
  }

  return {
    slug,
    site,
    menus,
    pages,
    hasPosts,
    hasGalleries,
    isLoading,
    notFound,
    preview,
    toastMessage,
    basePath,
    notify,
    initialize,
    refresh
  }
})
