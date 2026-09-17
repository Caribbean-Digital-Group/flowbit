import { storeToRefs } from 'pinia'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Navegación del sitio público: convierte rutas relativas al sitio en
 * destinos de NuxtLink y conserva el modo vista previa (?preview=1) entre páginas.
 */
export const useWebsiteNav = () => {
  const websiteStore = useWebsiteStore()
  const { slug, preview, basePath } = storeToRefs(websiteStore)

  const to = (path: string, external = false): RouteLocationRaw => {
    if (external || isExternalHref(path)) return path
    const target = path.startsWith('/stores/') ? path : websitePath(slug.value ?? '', path)
    return preview.value ? { path: target, query: { preview: '1' } } : target
  }

  const isExternal = (path: string, external = false): boolean => external || isExternalHref(path)

  return { slug, preview, basePath, to, isExternal }
}
