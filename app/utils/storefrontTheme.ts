/**
 * Motor de temas del storefront.
 *
 * Datos puros, sin dependencias de Vue: una plantilla (`StorefrontTheme`) más
 * una paleta (`StorefrontPalette`) más los ajustes del vendedor se resuelven en
 * un conjunto de variables CSS (`--sf-*`) que consumen el layout, la portada y
 * todos los componentes de la tienda.
 *
 * Regla del módulo: ningún componente vuelve a escribir un color a mano ni a
 * inventar un tinte con alfa hexadecimal. Todo sale de estos tokens.
 */

// ── Utilidades de color ──────────────────────────────────────────────────────

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Acepta #rgb y #rrggbb; devuelve null si el valor no es un color válido. */
export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '')
  const full = value.length === 3
    ? value.split('').map(c => c + c).join('')
    : value

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** Normaliza cualquier entrada a un hex de 6 dígitos, con respaldo si es inválida. */
export function normalizeHex(hex: string | null | undefined, fallback = '#6366f1'): string {
  const rgb = hexToRgb(hex ?? '')
  return rgb ? rgbToHex(rgb) : fallback
}

/** Luminancia relativa según WCAG 2.1. */
export function relativeLuminance(color: string): number {
  const rgb = hexToRgb(color)
  if (!rgb) return 0

  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** Razón de contraste WCAG entre dos colores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Color de texto legible sobre un fondo dado.
 * Evita el defecto clásico de escribir en blanco sobre un color claro
 * (amarillo, lima, cian) elegido por el vendedor.
 */
export function readableTextOn(background: string, light = '#ffffff', dark = '#0f172a'): string {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark
}

/** ¿El texto blanco cumple el mínimo WCAG AA (4.5:1) sobre este fondo? */
export function passesAaOnWhiteText(background: string): boolean {
  return contrastRatio(background, '#ffffff') >= 4.5
}

/** Mezcla dos colores. `weight` 0 = solo `a`, 1 = solo `b`. */
export function mix(a: string, b: string, weight: number): string {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return a
  const w = Math.min(1, Math.max(0, weight))
  return rgbToHex({
    r: rgbA.r + (rgbB.r - rgbA.r) * w,
    g: rgbA.g + (rgbB.g - rgbA.g) * w,
    b: rgbA.b + (rgbB.b - rgbA.b) * w
  })
}

/** Aclara un color mezclándolo con blanco. */
export const tint = (color: string, amount: number): string => mix(color, '#ffffff', amount)

/** Oscurece un color mezclándolo con negro. */
export const shade = (color: string, amount: number): string => mix(color, '#000000', amount)

/** Versión rgba() del color, para halos y superficies translúcidas. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color)
  if (!rgb) return color
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, Math.max(0, alpha))})`
}

/**
 * Ajusta un color hasta que contraste lo suficiente con un fondo.
 * Se usa para que el color de marca siga siendo legible como texto sobre
 * superficies claras, sin obligar al vendedor a elegir otro color.
 */
export function ensureContrast(color: string, background: string, minRatio = 4.5): string {
  if (contrastRatio(color, background) >= minRatio) return color

  const backgroundIsLight = relativeLuminance(background) > 0.5
  let adjusted = color

  for (let step = 1; step <= 20; step++) {
    adjusted = backgroundIsLight ? shade(color, step * 0.05) : tint(color, step * 0.05)
    if (contrastRatio(adjusted, background) >= minRatio) return adjusted
  }

  return backgroundIsLight ? '#0f172a' : '#ffffff'
}

// ── Paletas ──────────────────────────────────────────────────────────────────

export interface StorefrontPalette {
  id: string
  label: string
  /** Color de marca: botones, enlaces y acentos. */
  primary: string
  /** Color de apoyo: degradados y superficies destacadas. */
  secondary: string
  /** Color de énfasis: ofertas, badges y detalles. */
  accent: string
  /** Tono base de los grises de la tienda. */
  neutral: string
}

export const STOREFRONT_PALETTES: StorefrontPalette[] = [
  { id: 'indigo', label: 'Índigo', primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899', neutral: '#0f172a' },
  { id: 'ocean', label: 'Océano', primary: '#0284c7', secondary: '#0891b2', accent: '#f59e0b', neutral: '#0c1b2a' },
  { id: 'forest', label: 'Bosque', primary: '#047857', secondary: '#65a30d', accent: '#f59e0b', neutral: '#0f1f1a' },
  { id: 'coral', label: 'Coral', primary: '#e11d48', secondary: '#f97316', accent: '#fbbf24', neutral: '#1f1215' },
  { id: 'grape', label: 'Uva', primary: '#7e22ce', secondary: '#c026d3', accent: '#22d3ee', neutral: '#190f24' },
  { id: 'amber', label: 'Ámbar', primary: '#b45309', secondary: '#ea580c', accent: '#0d9488', neutral: '#231506' },
  { id: 'midnight', label: 'Medianoche', primary: '#1e293b', secondary: '#475569', accent: '#38bdf8', neutral: '#020617' },
  { id: 'rose', label: 'Rosa', primary: '#be185d', secondary: '#db2777', accent: '#8b5cf6', neutral: '#1f0f17' },
  { id: 'teal', label: 'Turquesa', primary: '#0f766e', secondary: '#14b8a6', accent: '#f43f5e', neutral: '#05201d' },
  { id: 'graphite', label: 'Grafito', primary: '#334155', secondary: '#64748b', accent: '#f59e0b', neutral: '#0b1220' }
]

export const DEFAULT_PALETTE_ID = 'indigo'

export function getPalette(id: string | null | undefined): StorefrontPalette {
  return STOREFRONT_PALETTES.find(p => p.id === id) ?? STOREFRONT_PALETTES[0]!
}

// ── Tipografías ──────────────────────────────────────────────────────────────

export interface FontPairing {
  id: string
  label: string
  description: string
  headingStack: string
  bodyStack: string
  /** Familias de Google Fonts a cargar; vacío = solo tipografías del sistema. */
  googleFamilies: string[]
}

const SYSTEM_SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
const SYSTEM_SERIF = `Georgia, Cambria, 'Times New Roman', Times, serif`

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'system',
    label: 'Sistema',
    description: 'La tipografía nativa de cada dispositivo. La más rápida y sin peticiones externas.',
    headingStack: SYSTEM_SANS,
    bodyStack: SYSTEM_SANS,
    googleFamilies: []
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Títulos con serif clásica y texto sans. Transmite oficio y confianza.',
    headingStack: `'Playfair Display', ${SYSTEM_SERIF}`,
    bodyStack: `'Inter', ${SYSTEM_SANS}`,
    googleFamilies: ['Playfair+Display:wght@500;600;700', 'Inter:wght@400;500;600']
  },
  {
    id: 'modern',
    label: 'Moderna',
    description: 'Geométrica y limpia, con títulos de peso alto. Va bien con catálogos grandes.',
    headingStack: `'Poppins', ${SYSTEM_SANS}`,
    bodyStack: `'Inter', ${SYSTEM_SANS}`,
    googleFamilies: ['Poppins:wght@500;600;700', 'Inter:wght@400;500;600']
  },
  {
    id: 'friendly',
    label: 'Cercana',
    description: 'Formas redondeadas y amables. Ideal para alimentos, cafés y productos artesanales.',
    headingStack: `'Nunito', ${SYSTEM_SANS}`,
    bodyStack: `'Nunito Sans', ${SYSTEM_SANS}`,
    googleFamilies: ['Nunito:wght@600;700;800', 'Nunito+Sans:wght@400;500;600']
  },
  {
    id: 'refined',
    label: 'Refinada',
    description: 'Serif de alto contraste para marcas de moda, joyería y belleza.',
    headingStack: `'Cormorant Garamond', ${SYSTEM_SERIF}`,
    bodyStack: `'Jost', ${SYSTEM_SANS}`,
    googleFamilies: ['Cormorant+Garamond:wght@500;600;700', 'Jost:wght@400;500;600']
  }
]

export const DEFAULT_FONT_ID = 'system'

export function getFontPairing(id: string | null | undefined): FontPairing {
  return FONT_PAIRINGS.find(f => f.id === id) ?? FONT_PAIRINGS[0]!
}

/** URL de Google Fonts para el par tipográfico, o null si usa tipografías del sistema. */
export function googleFontsHref(pairing: FontPairing): string | null {
  if (!pairing.googleFamilies.length) return null
  const families = pairing.googleFamilies.map(f => `family=${f}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

// ── Plantillas ───────────────────────────────────────────────────────────────

export type HeroLayout = 'split' | 'centered' | 'banner' | 'editorial' | 'compact'
export type ProductCardStyle = 'elevated' | 'bordered' | 'minimal' | 'overlay'
export type RadiusStyle = 'sharp' | 'soft' | 'rounded' | 'pill'
export type SurfaceMode = 'light' | 'dark'

export interface StorefrontTheme {
  id: string
  label: string
  description: string
  /** Para qué tipo de tienda funciona mejor. */
  bestFor: string
  heroLayout: HeroLayout
  cardStyle: ProductCardStyle
  radius: RadiusStyle
  surface: SurfaceMode
  fontId: string
  paletteId: string
  /** Espaciado vertical entre secciones, en rem. */
  sectionSpacing: number
  /** Títulos en mayúsculas con tracking amplio. */
  uppercaseHeadings: boolean
  /** Muestra decoraciones (halos, retículas) detrás del hero. */
  decorated: boolean
}

export const STOREFRONT_THEMES: StorefrontTheme[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Luminosa y espaciosa, con degradados suaves y tarjetas elevadas.',
    bestFor: 'Catálogos generales y tiendas que empiezan',
    heroLayout: 'split',
    cardStyle: 'elevated',
    radius: 'rounded',
    surface: 'light',
    fontId: 'system',
    paletteId: 'indigo',
    sectionSpacing: 4.5,
    uppercaseHeadings: false,
    decorated: true
  },
  {
    id: 'boutique',
    label: 'Boutique',
    description: 'Editorial y sobria: mucho aire, serif elegante y fotografía protagonista.',
    bestFor: 'Moda, joyería, belleza y productos artesanales',
    heroLayout: 'editorial',
    cardStyle: 'minimal',
    radius: 'sharp',
    surface: 'light',
    fontId: 'refined',
    paletteId: 'graphite',
    sectionSpacing: 6,
    uppercaseHeadings: true,
    decorated: false
  },
  {
    id: 'impulse',
    label: 'Impulso',
    description: 'Alto contraste y tipografía grande para destacar precios y promociones.',
    bestFor: 'Electrónica, ofertas y catálogos con mucha rotación',
    heroLayout: 'banner',
    cardStyle: 'bordered',
    radius: 'soft',
    surface: 'light',
    fontId: 'modern',
    paletteId: 'ocean',
    sectionSpacing: 3.5,
    uppercaseHeadings: true,
    decorated: false
  },
  {
    id: 'mercado',
    label: 'Mercado',
    description: 'Cercana y colorida, con formas redondeadas y navegación muy directa.',
    bestFor: 'Alimentos, cafeterías, abarrotes y venta local',
    heroLayout: 'centered',
    cardStyle: 'elevated',
    radius: 'pill',
    surface: 'light',
    fontId: 'friendly',
    paletteId: 'forest',
    sectionSpacing: 4,
    uppercaseHeadings: false,
    decorated: true
  },
  {
    id: 'noir',
    label: 'Noir',
    description: 'Fondo oscuro con acentos luminosos. El producto resalta sobre el negro.',
    bestFor: 'Marcas premium, tecnología y productos de diseño',
    heroLayout: 'banner',
    cardStyle: 'overlay',
    radius: 'soft',
    surface: 'dark',
    fontId: 'modern',
    paletteId: 'midnight',
    sectionSpacing: 4.5,
    uppercaseHeadings: true,
    decorated: true
  },
  {
    id: 'esencial',
    label: 'Esencial',
    description: 'Mínima y directa: sin adornos, carga rápida y foco total en el catálogo.',
    bestFor: 'Mayoristas, catálogos extensos y conexiones lentas',
    heroLayout: 'compact',
    cardStyle: 'bordered',
    radius: 'soft',
    surface: 'light',
    fontId: 'system',
    paletteId: 'graphite',
    sectionSpacing: 3,
    uppercaseHeadings: false,
    decorated: false
  }
]

export const DEFAULT_THEME_ID = 'aurora'

export function getTheme(id: string | null | undefined): StorefrontTheme {
  return STOREFRONT_THEMES.find(t => t.id === id) ?? STOREFRONT_THEMES[0]!
}

// ── Resolución de tokens ─────────────────────────────────────────────────────

const RADIUS_SCALE: Record<RadiusStyle, { sm: string; md: string; lg: string; xl: string; pill: string }> = {
  sharp: { sm: '0px', md: '0px', lg: '2px', xl: '2px', pill: '2px' },
  soft: { sm: '4px', md: '8px', lg: '12px', xl: '16px', pill: '9999px' },
  rounded: { sm: '8px', md: '12px', lg: '18px', xl: '26px', pill: '9999px' },
  pill: { sm: '12px', md: '18px', lg: '28px', xl: '36px', pill: '9999px' }
}

/** Ajustes del vendedor que sobrescriben la plantilla elegida. */
export interface ThemeOverrides {
  themeId?: string | null
  paletteId?: string | null
  fontId?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  radius?: RadiusStyle | null
  cardStyle?: ProductCardStyle | null
  heroLayout?: HeroLayout | null
}

export interface ResolvedTheme {
  theme: StorefrontTheme
  palette: StorefrontPalette
  font: FontPairing
  heroLayout: HeroLayout
  cardStyle: ProductCardStyle
  radius: RadiusStyle
  surface: SurfaceMode
  primary: string
  secondary: string
  accent: string
  /** Color de marca corregido para que el texto encima cumpla AA. */
  primaryStrong: string
  /** Variables CSS listas para aplicarse en el nodo raíz de la tienda. */
  tokens: Record<string, string>
  /** URL de Google Fonts, si la tipografía elegida la necesita. */
  fontsHref: string | null
  /** El color de marca no alcanza contraste AA con texto blanco. */
  lowContrastPrimary: boolean
  /** Se corrigió el color en botones para garantizar legibilidad. */
  primaryWasAdjusted: boolean
}

/**
 * Combina plantilla, paleta y ajustes del vendedor en el conjunto final de
 * tokens. Todos los derivados (hover, tintes, halos, texto legible) se calculan
 * aquí una sola vez.
 */
export function resolveStorefrontTheme(overrides: ThemeOverrides = {}): ResolvedTheme {
  const theme = getTheme(overrides.themeId)
  const palette = getPalette(overrides.paletteId ?? theme.paletteId)
  const font = getFontPairing(overrides.fontId ?? theme.fontId)

  const primary = normalizeHex(overrides.primaryColor, palette.primary)
  const secondary = normalizeHex(overrides.secondaryColor, palette.secondary)
  const accent = normalizeHex(overrides.accentColor, palette.accent)

  const radius = overrides.radius ?? theme.radius
  const cardStyle = overrides.cardStyle ?? theme.cardStyle
  const heroLayout = overrides.heroLayout ?? theme.heroLayout
  const surface = theme.surface
  const isDark = surface === 'dark'

  const radii = RADIUS_SCALE[radius]

  // Superficies base según el modo de la plantilla
  const bg = isDark ? shade(palette.neutral, 0.35) : '#f8fafc'
  const surfaceColor = isDark ? mix(palette.neutral, '#ffffff', 0.08) : '#ffffff'
  const surfaceMuted = isDark ? mix(palette.neutral, '#ffffff', 0.13) : '#f1f5f9'
  const border = isDark ? withAlpha('#ffffff', 0.12) : '#e2e8f0'
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = isDark ? withAlpha('#e2e8f0', 0.68) : '#64748b'
  const textSubtle = isDark ? withAlpha('#e2e8f0', 0.48) : '#94a3b8'

  // Texto legible sobre cada color de marca: evita blanco sobre amarillo
  const onPrimary = readableTextOn(primary)
  const onSecondary = readableTextOn(secondary)
  const onAccent = readableTextOn(accent)

  // Versión del color de marca utilizable como texto sobre el fondo del tema
  const primaryReadable = ensureContrast(primary, isDark ? bg : '#ffffff', 4.5)

  /**
   * Los tonos medios (índigo, océano…) no alcanzan 4.5:1 ni con texto blanco ni
   * con texto oscuro. Como el texto ya está en su extremo, lo que se ajusta es
   * el fondo: `*-strong` es el color de marca corregido lo mínimo necesario
   * para que una etiqueta encima sea legible. `--sf-primary` conserva el color
   * exacto del vendedor y se reserva para superficies decorativas sin texto.
   */
  const primaryStrong = ensureContrast(primary, onPrimary, 4.5)
  const secondaryStrong = ensureContrast(secondary, onSecondary, 4.5)
  const accentStrong = ensureContrast(accent, onAccent, 4.5)

  const tokens: Record<string, string> = {
    '--sf-primary': primary,
    '--sf-primary-strong': primaryStrong,
    '--sf-primary-hover': isDark ? tint(primaryStrong, 0.12) : shade(primaryStrong, 0.12),
    '--sf-primary-contrast': onPrimary,
    '--sf-primary-readable': primaryReadable,
    '--sf-primary-soft': isDark ? withAlpha(primary, 0.18) : tint(primary, 0.9),
    '--sf-primary-softer': isDark ? withAlpha(primary, 0.1) : tint(primary, 0.95),
    '--sf-primary-ring': withAlpha(primary, 0.45),
    '--sf-primary-glow': withAlpha(primary, isDark ? 0.35 : 0.28),

    '--sf-secondary': secondary,
    '--sf-secondary-strong': secondaryStrong,
    '--sf-secondary-contrast': onSecondary,
    '--sf-secondary-soft': isDark ? withAlpha(secondary, 0.18) : tint(secondary, 0.9),

    '--sf-accent': accent,
    '--sf-accent-strong': accentStrong,
    '--sf-accent-contrast': onAccent,
    '--sf-accent-soft': isDark ? withAlpha(accent, 0.18) : tint(accent, 0.9),

    '--sf-bg': bg,
    '--sf-surface': surfaceColor,
    '--sf-surface-muted': surfaceMuted,
    '--sf-border': border,
    '--sf-text': text,
    '--sf-text-muted': textMuted,
    '--sf-text-subtle': textSubtle,

    '--sf-radius-sm': radii.sm,
    '--sf-radius-md': radii.md,
    '--sf-radius-lg': radii.lg,
    '--sf-radius-xl': radii.xl,
    '--sf-radius-pill': radii.pill,

    '--sf-font-heading': font.headingStack,
    '--sf-font-body': font.bodyStack,
    '--sf-heading-transform': theme.uppercaseHeadings ? 'uppercase' : 'none',
    '--sf-heading-tracking': theme.uppercaseHeadings ? '0.06em' : '-0.02em',

    '--sf-section-gap': `${theme.sectionSpacing}rem`,
    '--sf-shadow-sm': isDark
      ? '0 1px 2px rgba(0,0,0,0.5)'
      : '0 1px 2px rgba(15,23,42,0.06)',
    '--sf-shadow-md': isDark
      ? '0 14px 30px -18px rgba(0,0,0,0.8)'
      : '0 14px 30px -18px rgba(15,23,42,0.35)',
    '--sf-shadow-lg': isDark
      ? '0 30px 60px -30px rgba(0,0,0,0.9)'
      : '0 30px 60px -30px rgba(15,23,42,0.45)'
  }

  return {
    theme,
    palette,
    font,
    heroLayout,
    cardStyle,
    radius,
    surface,
    primary,
    secondary,
    accent,
    primaryStrong,
    tokens,
    fontsHref: googleFontsHref(font),
    lowContrastPrimary: !passesAaOnWhiteText(primary),
    primaryWasAdjusted: primaryStrong.toLowerCase() !== primary.toLowerCase()
  }
}

/** Convierte los tokens en el valor del atributo `style` del nodo raíz. */
export function tokensToStyle(tokens: Record<string, string>): Record<string, string> {
  return tokens
}
