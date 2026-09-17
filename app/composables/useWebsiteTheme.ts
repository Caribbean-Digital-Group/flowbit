import { storeToRefs } from 'pinia'
import { resolveStorefrontTheme, type RadiusStyle, type ResolvedTheme } from '~/utils/storefrontTheme'

/**
 * Tema resuelto del sitio web actual.
 *
 * Reutiliza el motor de temas del storefront (`storefrontTheme.ts`) y sus
 * tokens `--sf-*`, de modo que el sitio y la tienda comparten plantillas,
 * paletas, tipografías y la garantía de contraste AA sin duplicar código.
 */
export const useWebsiteTheme = () => {
  const websiteStore = useWebsiteStore()
  const { site } = storeToRefs(websiteStore)

  const resolved = computed<ResolvedTheme>(() =>
    resolveStorefrontTheme({
      themeId: site.value?.theme,
      paletteId: site.value?.palette,
      fontId: site.value?.font_pairing,
      primaryColor: site.value?.color_primary ?? site.value?.primary_color,
      secondaryColor: site.value?.color_secondary,
      accentColor: site.value?.color_accent,
      radius: (site.value?.radius_style as RadiusStyle | null) ?? null
    })
  )

  const themeStyle = computed(() => resolved.value.tokens)
  const isDark = computed(() => resolved.value.surface === 'dark')

  const useThemeFonts = () => {
    useHead(() => {
      const href = resolved.value.fontsHref
      if (!href) return {}
      return {
        link: [
          { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
          { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
          { rel: 'stylesheet', href }
        ]
      }
    })
  }

  return { resolved, themeStyle, isDark, useThemeFonts }
}
