import { storeToRefs } from 'pinia'
import {
  resolveStorefrontTheme,
  type HeroLayout,
  type ProductCardStyle,
  type RadiusStyle,
  type ResolvedTheme
} from '~/utils/storefrontTheme'

/** Beneficios de ejemplo cuando el vendedor no ha personalizado los suyos. */
const DEFAULT_BENEFITS = [
  { icon: 'truck', title: 'Envíos a tu puerta', text: 'Elige el método de envío que más te convenga al pagar.' },
  { icon: 'shield', title: 'Compra segura', text: 'Tus datos se procesan de forma segura en todo momento.' },
  { icon: 'chat', title: 'Atención directa', text: '¿Dudas con tu pedido? Escríbenos y te ayudamos.' }
]

export interface StorefrontSections {
  categories: boolean
  featured: boolean
  benefits: boolean
  story: boolean
}

/**
 * Tema resuelto de la tienda actual.
 *
 * Combina la plantilla, la paleta y los ajustes del vendedor en variables CSS
 * y en las banderas de composición que usan el layout y la portada. Si la
 * tienda todavía no tiene configuración de diseño (base sin migrar), devuelve
 * la plantilla por defecto sin romper nada.
 */
export const useStorefrontTheme = () => {
  const storefrontStore = useStorefrontStore()
  const { store } = storeToRefs(storefrontStore)

  const resolved = computed<ResolvedTheme>(() =>
    resolveStorefrontTheme({
      themeId: store.value?.theme,
      paletteId: store.value?.palette,
      fontId: store.value?.font_pairing,
      // El color heredado de la empresa sigue mandando si no hay uno específico
      // de la tienda: así las tiendas existentes conservan su identidad.
      primaryColor: store.value?.color_primary ?? store.value?.primary_color,
      secondaryColor: store.value?.color_secondary,
      accentColor: store.value?.color_accent,
      radius: (store.value?.radius_style as RadiusStyle | null) ?? null,
      cardStyle: (store.value?.card_style as ProductCardStyle | null) ?? null,
      heroLayout: (store.value?.hero_layout as HeroLayout | null) ?? null
    })
  )

  /** Estilo para el nodo raíz de la tienda: todas las variables CSS. */
  const themeStyle = computed(() => resolved.value.tokens)

  const isDark = computed(() => resolved.value.surface === 'dark')

  const sections = computed<StorefrontSections>(() => ({
    categories: store.value?.show_categories ?? true,
    featured: store.value?.show_featured ?? true,
    benefits: store.value?.show_benefits ?? true,
    story: store.value?.show_story ?? false
  }))

  const benefits = computed(() => {
    const custom = store.value?.benefits
    if (Array.isArray(custom) && custom.length) return custom
    return DEFAULT_BENEFITS
  })

  const heroCtaLabel = computed(() => store.value?.hero_cta_label?.trim() || 'Explorar productos')

  /** Carga la tipografía elegida solo cuando no es la del sistema. */
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

  return {
    resolved,
    themeStyle,
    isDark,
    sections,
    benefits,
    heroCtaLabel,
    useThemeFonts,
    heroLayout: computed(() => resolved.value.heroLayout),
    cardStyle: computed(() => resolved.value.cardStyle),
    decorated: computed(() => resolved.value.theme.decorated),
    uppercaseHeadings: computed(() => resolved.value.theme.uppercaseHeadings)
  }
}

export { DEFAULT_BENEFITS }
