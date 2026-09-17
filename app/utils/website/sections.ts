/**
 * Catálogo de secciones del constructor de páginas (equivalente a los
 * "snippets" de Odoo Website).
 *
 * Es la fuente única para:
 *  · el editor de páginas (qué campos muestra cada sección),
 *  · el renderizador público (Website/SectionRenderer.vue) y
 *  · la normalización del JSON guardado en website_page.content.
 *
 * Datos puros, sin Vue.
 */

import type { Json } from '~/types/database.types'

export type WebsiteSectionType =
  | 'hero'
  | 'text'
  | 'image_text'
  | 'features'
  | 'stats'
  | 'gallery'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'team'
  | 'cta'
  | 'logos'
  | 'video'
  | 'map'
  | 'contact_form'
  | 'blog_latest'
  | 'storefront_products'
  | 'html'
  | 'divider'

export type SectionBackground = 'surface' | 'muted' | 'primary' | 'dark'
export type SectionPadding = 'sm' | 'md' | 'lg'
export type SectionAlign = 'left' | 'center'

export interface WebsiteSectionStyle {
  background: SectionBackground
  padding: SectionPadding
  align: SectionAlign
}

export type SectionProps = Record<string, unknown>

export interface WebsiteSection {
  id: string
  type: WebsiteSectionType
  props: SectionProps
  style: WebsiteSectionStyle
  hidden?: boolean
}

export type SectionFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'url'
  | 'href'
  | 'number'
  | 'boolean'
  | 'select'
  | 'icon'
  | 'list'

export type SectionFieldOption = {
  value: string | number
  label: string
}

export interface SectionField {
  key: string
  label: string
  type: SectionFieldType
  hint?: string
  placeholder?: string
  options?: SectionFieldOption[]
  min?: number
  max?: number
  /** Campos de cada elemento cuando type = 'list'. */
  itemFields?: SectionField[]
  maxItems?: number
  /** Etiqueta del botón «agregar» en listas. */
  addLabel?: string
}

export type SectionCategory = 'contenido' | 'medios' | 'conversion' | 'dinamico' | 'estructura'

export interface SectionDefinition {
  type: WebsiteSectionType
  label: string
  description: string
  category: SectionCategory
  /** Path SVG (24x24, stroke) para el catálogo del editor. */
  icon: string
  defaultProps: SectionProps
  defaultStyle: WebsiteSectionStyle
  fields: SectionField[]
}

export const SECTION_CATEGORY_LABELS: Record<SectionCategory, string> = {
  contenido: 'Contenido',
  medios: 'Medios',
  conversion: 'Conversión',
  dinamico: 'Dinámico',
  estructura: 'Estructura'
}

export const SECTION_ICON_OPTIONS: SectionFieldOption[] = [
  { value: 'star', label: 'Estrella' },
  { value: 'shield', label: 'Escudo' },
  { value: 'chat', label: 'Chat' },
  { value: 'truck', label: 'Camión' },
  { value: 'tag', label: 'Etiqueta' },
  { value: 'gift', label: 'Regalo' },
  { value: 'clock', label: 'Reloj' },
  { value: 'credit', label: 'Tarjeta' },
  { value: 'bolt', label: 'Rayo' },
  { value: 'heart', label: 'Corazón' },
  { value: 'globe', label: 'Globo' },
  { value: 'check', label: 'Check' },
  { value: 'users', label: 'Personas' },
  { value: 'chart', label: 'Gráfica' },
  { value: 'sparkles', label: 'Destellos' },
  { value: 'phone', label: 'Teléfono' }
]

/** Paths SVG de los iconos disponibles en secciones (stroke, 24x24). */
export const SECTION_ICON_PATHS: Record<string, string> = {
  star: 'M11.05 3.27a1 1 0 011.9 0l1.7 4.1 4.43.35a1 1 0 01.57 1.76l-3.37 2.88 1.03 4.32a1 1 0 01-1.5 1.09L12 15.45l-3.81 2.32a1 1 0 01-1.5-1.09l1.03-4.32-3.37-2.88a1 1 0 01.57-1.76l4.43-.35 1.7-4.1z',
  shield: 'M12 3l7 3v5c0 5-3.4 8.6-7 10-3.6-1.4-7-5-7-10V6l7-3z',
  chat: 'M8 10h.01M12 10h.01M16 10h.01M21 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1121 12z',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM6 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm11 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  tag: 'M7 7h.01M3 5a2 2 0 012-2h5.6a2 2 0 011.4.6l8.4 8.4a2 2 0 010 2.8l-5.6 5.6a2 2 0 01-2.8 0L3.6 12A2 2 0 013 10.6V5z',
  gift: 'M20 12v9H4v-9m16-5H4v5h16V7zM12 7v14M12 7c-1.5 0-4-1-4-3a2 2 0 014 0m0 3c1.5 0 4-1 4-3a2 2 0 00-4 0',
  clock: 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  credit: 'M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z',
  bolt: 'M13 3L4 14h7l-1 7 9-11h-7l1-7z',
  heart: 'M4.3 12.6l7.7 7.7 7.7-7.7a4.6 4.6 0 00-6.5-6.5L12 7.3l-1.2-1.2a4.6 4.6 0 00-6.5 6.5z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-18c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3 12h18',
  check: 'M5 13l4 4L19 7',
  users: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z',
  chart: 'M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3',
  sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.3 6.7L22 12l-6.7 2.3L13 21l-2.3-6.7L4 12l6.7-2.3L13 3z',
  phone: 'M3 5a2 2 0 012-2h3.3a1 1 0 01.9.7l1.5 4.5a1 1 0 01-.5 1.2l-2.3 1.1a11 11 0 005.6 5.6l1.1-2.3a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.9V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z'
}

const DEFAULT_STYLE: WebsiteSectionStyle = { background: 'surface', padding: 'lg', align: 'left' }

const EYEBROW: SectionField = { key: 'eyebrow', label: 'Etiqueta superior', type: 'text', placeholder: 'Ej: Lo que hacemos' }
const TITLE: SectionField = { key: 'title', label: 'Título', type: 'text' }

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    type: 'hero',
    label: 'Portada (hero)',
    description: 'Titular grande con subtítulo, botones e imagen. Ideal para abrir la página.',
    category: 'contenido',
    icon: 'M4 5h16v6H4zM4 14h9v5H4zM16 14h4v5h-4z',
    defaultStyle: { background: 'primary', padding: 'lg', align: 'center' },
    defaultProps: {
      eyebrow: '',
      title: 'Un título que enamora',
      subtitle: 'Explica en una frase qué ofreces y para quién.',
      primary_label: 'Contáctanos',
      primary_href: '/contacto',
      secondary_label: '',
      secondary_href: '',
      image_url: '',
      layout: 'split'
    },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'subtitle', label: 'Subtítulo', type: 'textarea' },
      { key: 'layout', label: 'Distribución', type: 'select', options: [
        { value: 'split', label: 'Texto e imagen lado a lado' },
        { value: 'centered', label: 'Centrado' },
        { value: 'banner', label: 'Imagen de fondo' }
      ] },
      { key: 'image_url', label: 'Imagen', type: 'image' },
      { key: 'primary_label', label: 'Botón principal — texto', type: 'text' },
      { key: 'primary_href', label: 'Botón principal — enlace', type: 'href', hint: 'Ruta del sitio (/contacto) o URL completa.' },
      { key: 'secondary_label', label: 'Botón secundario — texto', type: 'text' },
      { key: 'secondary_href', label: 'Botón secundario — enlace', type: 'href' }
    ]
  },
  {
    type: 'text',
    label: 'Texto',
    description: 'Bloque de texto enriquecido: párrafos, títulos, listas, citas y enlaces.',
    category: 'contenido',
    icon: 'M4 6h16M4 10h16M4 14h10M4 18h7',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: { html: '<p>Escribe aquí tu contenido.</p>', max_width: 'normal' },
    fields: [
      { key: 'html', label: 'Contenido', type: 'richtext' },
      { key: 'max_width', label: 'Ancho del texto', type: 'select', options: [
        { value: 'narrow', label: 'Angosto (lectura)' },
        { value: 'normal', label: 'Normal' },
        { value: 'wide', label: 'Ancho' }
      ] }
    ]
  },
  {
    type: 'image_text',
    label: 'Imagen y texto',
    description: 'Imagen a un lado y texto al otro, con botón opcional.',
    category: 'contenido',
    icon: 'M4 5h7v14H4zM13 7h7M13 11h7M13 15h5',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: {
      eyebrow: '',
      title: 'Cuenta tu historia',
      html: '<p>Describe tu propuesta con detalle.</p>',
      image_url: '',
      image_alt: '',
      image_position: 'right',
      button_label: '',
      button_href: ''
    },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'html', label: 'Texto', type: 'richtext' },
      { key: 'image_url', label: 'Imagen', type: 'image' },
      { key: 'image_alt', label: 'Texto alternativo de la imagen', type: 'text' },
      { key: 'image_position', label: 'Posición de la imagen', type: 'select', options: [
        { value: 'left', label: 'Izquierda' }, { value: 'right', label: 'Derecha' }
      ] },
      { key: 'button_label', label: 'Botón — texto', type: 'text' },
      { key: 'button_href', label: 'Botón — enlace', type: 'href' }
    ]
  },
  {
    type: 'features',
    label: 'Características',
    description: 'Cuadrícula de beneficios o servicios con icono, título y texto.',
    category: 'contenido',
    icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    defaultStyle: { ...DEFAULT_STYLE, align: 'center' },
    defaultProps: {
      eyebrow: '',
      title: 'Por qué elegirnos',
      text: '',
      columns: 3,
      items: [
        { icon: 'star', title: 'Calidad', text: 'Describe un beneficio.' },
        { icon: 'shield', title: 'Confianza', text: 'Describe otro beneficio.' },
        { icon: 'chat', title: 'Atención', text: 'Y uno más.' }
      ]
    },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'text', label: 'Texto introductorio', type: 'textarea' },
      { key: 'columns', label: 'Columnas', type: 'select', options: [
        { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }
      ] },
      { key: 'items', label: 'Elementos', type: 'list', maxItems: 8, addLabel: 'Agregar característica', itemFields: [
        { key: 'icon', label: 'Icono', type: 'icon' },
        { key: 'title', label: 'Título', type: 'text' },
        { key: 'text', label: 'Texto', type: 'textarea' }
      ] }
    ]
  },
  {
    type: 'stats',
    label: 'Cifras',
    description: 'Números destacados: clientes, años, proyectos.',
    category: 'contenido',
    icon: 'M5 20V10m7 10V4m7 16v-7',
    defaultStyle: { background: 'muted', padding: 'md', align: 'center' },
    defaultProps: {
      title: '',
      items: [
        { value: '+500', label: 'Clientes' },
        { value: '10', label: 'Años de experiencia' },
        { value: '98%', label: 'Satisfacción' }
      ]
    },
    fields: [
      TITLE,
      { key: 'items', label: 'Cifras', type: 'list', maxItems: 6, addLabel: 'Agregar cifra', itemFields: [
        { key: 'value', label: 'Valor', type: 'text', placeholder: '+500' },
        { key: 'label', label: 'Etiqueta', type: 'text', placeholder: 'Clientes' }
      ] }
    ]
  },
  {
    type: 'gallery',
    label: 'Galería de imágenes',
    description: 'Mosaico de fotos con pie opcional y enlace a una galería completa.',
    category: 'medios',
    icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: { eyebrow: '', title: 'Galería', columns: 3, items: [], gallery_slug: '' },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'columns', label: 'Columnas', type: 'select', options: [
        { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }
      ] },
      { key: 'items', label: 'Imágenes', type: 'list', maxItems: 12, addLabel: 'Agregar imagen', itemFields: [
        { key: 'image_url', label: 'Imagen', type: 'image' },
        { key: 'alt_text', label: 'Texto alternativo', type: 'text' },
        { key: 'caption', label: 'Pie de foto', type: 'text' }
      ] },
      { key: 'gallery_slug', label: 'Enlazar a galería (slug)', type: 'text', hint: 'Muestra un botón «Ver galería completa».' }
    ]
  },
  {
    type: 'testimonials',
    label: 'Testimonios',
    description: 'Opiniones de clientes con nombre, cargo y foto.',
    category: 'conversion',
    icon: 'M7 8h10M7 12h6m-9 8l4-4h11a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14z',
    defaultStyle: { background: 'muted', padding: 'lg', align: 'center' },
    defaultProps: {
      eyebrow: '',
      title: 'Lo que dicen nuestros clientes',
      items: [
        { quote: 'Un servicio excelente, lo recomiendo.', name: 'Nombre del cliente', role: 'Cargo, Empresa', avatar_url: '' }
      ]
    },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'items', label: 'Testimonios', type: 'list', maxItems: 6, addLabel: 'Agregar testimonio', itemFields: [
        { key: 'quote', label: 'Testimonio', type: 'textarea' },
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'role', label: 'Cargo / empresa', type: 'text' },
        { key: 'avatar_url', label: 'Foto', type: 'image' }
      ] }
    ]
  },
  {
    type: 'pricing',
    label: 'Precios',
    description: 'Planes o paquetes con lista de características y botón.',
    category: 'conversion',
    icon: 'M12 3v18M8 7h6a3 3 0 010 6H9a3 3 0 000 6h7',
    defaultStyle: { ...DEFAULT_STYLE, align: 'center' },
    defaultProps: {
      eyebrow: '',
      title: 'Planes',
      items: [
        { name: 'Básico', price: '$499', period: '/ mes', features: 'Característica 1\nCaracterística 2', button_label: 'Elegir', button_href: '/contacto', highlighted: false },
        { name: 'Pro', price: '$999', period: '/ mes', features: 'Todo lo del básico\nSoporte prioritario', button_label: 'Elegir', button_href: '/contacto', highlighted: true }
      ]
    },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'items', label: 'Planes', type: 'list', maxItems: 4, addLabel: 'Agregar plan', itemFields: [
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'price', label: 'Precio', type: 'text', placeholder: '$499' },
        { key: 'period', label: 'Periodo', type: 'text', placeholder: '/ mes' },
        { key: 'features', label: 'Características (una por línea)', type: 'textarea' },
        { key: 'button_label', label: 'Botón — texto', type: 'text' },
        { key: 'button_href', label: 'Botón — enlace', type: 'href' },
        { key: 'highlighted', label: 'Destacar este plan', type: 'boolean' }
      ] }
    ]
  },
  {
    type: 'faq',
    label: 'Preguntas frecuentes',
    description: 'Acordeón de preguntas y respuestas.',
    category: 'contenido',
    icon: 'M8.2 9a3.8 3.8 0 017.4 1c0 2.5-3.6 3-3.6 5M12 18h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: {
      eyebrow: '',
      title: 'Preguntas frecuentes',
      items: [{ question: '¿Cómo puedo contactarlos?', answer: 'Escríbenos desde la página de contacto.' }]
    },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'items', label: 'Preguntas', type: 'list', maxItems: 12, addLabel: 'Agregar pregunta', itemFields: [
        { key: 'question', label: 'Pregunta', type: 'text' },
        { key: 'answer', label: 'Respuesta', type: 'textarea' }
      ] }
    ]
  },
  {
    type: 'team',
    label: 'Equipo',
    description: 'Personas con foto, nombre, cargo y descripción.',
    category: 'contenido',
    icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z',
    defaultStyle: { ...DEFAULT_STYLE, align: 'center' },
    defaultProps: {
      eyebrow: '',
      title: 'Nuestro equipo',
      items: [{ name: 'Nombre', role: 'Cargo', photo_url: '', text: '' }]
    },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'items', label: 'Personas', type: 'list', maxItems: 12, addLabel: 'Agregar persona', itemFields: [
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'role', label: 'Cargo', type: 'text' },
        { key: 'photo_url', label: 'Foto', type: 'image' },
        { key: 'text', label: 'Descripción', type: 'textarea' }
      ] }
    ]
  },
  {
    type: 'cta',
    label: 'Llamado a la acción',
    description: 'Banda destacada con título, texto y botón.',
    category: 'conversion',
    icon: 'M13 5l7 7-7 7M5 12h15',
    defaultStyle: { background: 'primary', padding: 'md', align: 'center' },
    defaultProps: {
      title: '¿Listo para empezar?',
      text: 'Hablemos de tu proyecto.',
      button_label: 'Contáctanos',
      button_href: '/contacto',
      secondary_label: '',
      secondary_href: ''
    },
    fields: [
      TITLE,
      { key: 'text', label: 'Texto', type: 'textarea' },
      { key: 'button_label', label: 'Botón — texto', type: 'text' },
      { key: 'button_href', label: 'Botón — enlace', type: 'href' },
      { key: 'secondary_label', label: 'Botón secundario — texto', type: 'text' },
      { key: 'secondary_href', label: 'Botón secundario — enlace', type: 'href' }
    ]
  },
  {
    type: 'logos',
    label: 'Logotipos',
    description: 'Fila de logos de clientes, aliados o certificaciones.',
    category: 'conversion',
    icon: 'M4 8h4v8H4zM10 8h4v8h-4zM16 8h4v8h-4z',
    defaultStyle: { background: 'muted', padding: 'sm', align: 'center' },
    defaultProps: { title: 'Confían en nosotros', items: [] },
    fields: [
      TITLE,
      { key: 'items', label: 'Logos', type: 'list', maxItems: 12, addLabel: 'Agregar logo', itemFields: [
        { key: 'image_url', label: 'Imagen', type: 'image' },
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'url', label: 'Enlace (opcional)', type: 'url' }
      ] }
    ]
  },
  {
    type: 'video',
    label: 'Video',
    description: 'Video de YouTube o Vimeo incrustado.',
    category: 'medios',
    icon: 'M4 6h16v12H4zM10 9l5 3-5 3V9z',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: { title: '', url: '', caption: '' },
    fields: [
      TITLE,
      { key: 'url', label: 'URL del video', type: 'url', hint: 'Enlace de YouTube o Vimeo.' },
      { key: 'caption', label: 'Pie de video', type: 'text' }
    ]
  },
  {
    type: 'map',
    label: 'Mapa',
    description: 'Mapa de Google Maps incrustado con dirección.',
    category: 'medios',
    icon: 'M9 20l-5-2V4l5 2m0 14l6-2m-6 2V6m6 12l5 2V6l-5-2m0 14V4M9 6l6-2',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: { title: 'Dónde estamos', embed_url: '', address: '' },
    fields: [
      TITLE,
      { key: 'embed_url', label: 'URL de inserción de Google Maps', type: 'url', hint: 'En Google Maps: Compartir → Insertar un mapa → copia el src del iframe.' },
      { key: 'address', label: 'Dirección', type: 'textarea' }
    ]
  },
  {
    type: 'contact_form',
    label: 'Formulario de contacto',
    description: 'Formulario que guarda mensajes en el panel (y puede convertirse en lead del CRM).',
    category: 'conversion',
    icon: 'M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: {
      title: 'Escríbenos',
      text: 'Responderemos tu mensaje lo antes posible.',
      show_contact_info: true,
      show_map: false,
      subject_options: '',
      success_message: '¡Gracias! Recibimos tu mensaje y te contactaremos pronto.'
    },
    fields: [
      TITLE,
      { key: 'text', label: 'Texto', type: 'textarea' },
      { key: 'subject_options', label: 'Opciones de asunto (una por línea)', type: 'textarea', hint: 'Vacío = campo de texto libre.' },
      { key: 'show_contact_info', label: 'Mostrar datos de contacto del sitio', type: 'boolean' },
      { key: 'show_map', label: 'Mostrar mapa del sitio (si está configurado)', type: 'boolean' },
      { key: 'success_message', label: 'Mensaje de éxito', type: 'text' }
    ]
  },
  {
    type: 'blog_latest',
    label: 'Últimas publicaciones',
    description: 'Muestra automáticamente los posts más recientes del blog.',
    category: 'dinamico',
    icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
    defaultStyle: { background: 'muted', padding: 'lg', align: 'left' },
    defaultProps: { eyebrow: 'Novedades', title: 'Últimas publicaciones', limit: 3, category_slug: '', show_more: true },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'limit', label: 'Cantidad', type: 'number', min: 1, max: 9 },
      { key: 'category_slug', label: 'Solo de la categoría (slug)', type: 'text' },
      { key: 'show_more', label: 'Mostrar botón «Ver el blog»', type: 'boolean' }
    ]
  },
  {
    type: 'storefront_products',
    label: 'Productos de la tienda',
    description: 'Productos destacados de tu tienda en línea (requiere tienda activa).',
    category: 'dinamico',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6a1 1 0 00.9 1.4H19M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: { eyebrow: 'Tienda', title: 'Productos destacados', limit: 4, show_button: true },
    fields: [
      EYEBROW,
      TITLE,
      { key: 'limit', label: 'Cantidad', type: 'number', min: 2, max: 12 },
      { key: 'show_button', label: 'Mostrar botón «Ir a la tienda»', type: 'boolean' }
    ]
  },
  {
    type: 'html',
    label: 'HTML personalizado',
    description: 'Bloque HTML para casos avanzados. Se limpia en servidor (sin scripts).',
    category: 'estructura',
    icon: 'M8 8l-4 4 4 4m8-8l4 4-4 4m-6 4l4-16',
    defaultStyle: DEFAULT_STYLE,
    defaultProps: { html: '' },
    fields: [
      { key: 'html', label: 'HTML', type: 'textarea', hint: 'Etiquetas permitidas: texto, listas, imágenes, enlaces, tablas e iframes de YouTube/Vimeo/Google Maps.' }
    ]
  },
  {
    type: 'divider',
    label: 'Separador',
    description: 'Línea o espacio entre secciones.',
    category: 'estructura',
    icon: 'M4 12h16',
    defaultStyle: { background: 'surface', padding: 'sm', align: 'center' },
    defaultProps: { variant: 'line' },
    fields: [
      { key: 'variant', label: 'Tipo', type: 'select', options: [
        { value: 'line', label: 'Línea' }, { value: 'space', label: 'Espacio' }
      ] }
    ]
  }
]

export const SECTION_TYPES = SECTION_DEFINITIONS.map(d => d.type)

export const getSectionDefinition = (type: string): SectionDefinition | undefined =>
  SECTION_DEFINITIONS.find(d => d.type === type)

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const cloneProps = (props: SectionProps): SectionProps => JSON.parse(JSON.stringify(props)) as SectionProps

export const createSection = (type: WebsiteSectionType): WebsiteSection => {
  const def = getSectionDefinition(type)
  if (!def) throw new Error(`Sección desconocida: ${type}`)
  return {
    id: newId(),
    type,
    props: cloneProps(def.defaultProps),
    style: { ...def.defaultStyle },
    hidden: false
  }
}

export const duplicateSection = (section: WebsiteSection): WebsiteSection => ({
  ...section,
  id: newId(),
  props: cloneProps(section.props),
  style: { ...section.style }
})

const BACKGROUNDS: SectionBackground[] = ['surface', 'muted', 'primary', 'dark']
const PADDINGS: SectionPadding[] = ['sm', 'md', 'lg']
const ALIGNS: SectionAlign[] = ['left', 'center']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Valida y completa el JSON guardado: descarta secciones desconocidas,
 * rellena props faltantes con los valores por defecto y normaliza el estilo.
 */
export const normalizeSections = (raw: unknown): WebsiteSection[] => {
  if (!Array.isArray(raw)) return []
  const result: WebsiteSection[] = []
  for (const item of raw) {
    if (!isRecord(item) || typeof item.type !== 'string') continue
    const def = getSectionDefinition(item.type)
    if (!def) continue
    const props = isRecord(item.props) ? item.props : {}
    const style = isRecord(item.style) ? item.style : {}
    const background = BACKGROUNDS.includes(style.background as SectionBackground)
      ? (style.background as SectionBackground)
      : def.defaultStyle.background
    const padding = PADDINGS.includes(style.padding as SectionPadding)
      ? (style.padding as SectionPadding)
      : def.defaultStyle.padding
    const align = ALIGNS.includes(style.align as SectionAlign)
      ? (style.align as SectionAlign)
      : def.defaultStyle.align
    result.push({
      id: typeof item.id === 'string' && item.id ? item.id : newId(),
      type: def.type,
      props: { ...cloneProps(def.defaultProps), ...props },
      style: { background, padding, align },
      hidden: item.hidden === true
    })
  }
  return result
}

/** Claves de props que contienen HTML y deben sanearse en servidor. */
export const HTML_PROP_KEYS = ['html'] as const

export const sectionHasHtml = (section: WebsiteSection): boolean =>
  HTML_PROP_KEYS.some(key => typeof section.props[key] === 'string' && (section.props[key] as string).length > 0)

/** Texto plano aproximado de una sección (búsqueda y extractos). */
export const sectionPlainText = (section: WebsiteSection): string => {
  const parts: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      parts.push(value.replace(/<[^>]+>/g, ' '))
    } else if (Array.isArray(value)) {
      value.forEach(walk)
    } else if (isRecord(value)) {
      Object.values(value).forEach(walk)
    }
  }
  walk(section.props)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** Copia serializable de las secciones para guardarla en website_page.content. */
export const sectionsToJson = (sections: WebsiteSection[]): Json =>
  JSON.parse(JSON.stringify(sections)) as Json
