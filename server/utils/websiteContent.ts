import { generateHTML } from '@tiptap/html/server'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import sanitizeHtml from 'sanitize-html'
import type { JSONContent } from '@tiptap/core'

/**
 * Renderizado y sanitización del contenido del sitio web (solo servidor).
 *
 * El editor Tiptap del panel produce un documento JSON. Aquí se convierte a
 * HTML con las mismas extensiones que usa el editor y se pasa por una lista
 * blanca estricta (sanitize-html) antes de devolverlo al cliente, que es quien
 * lo guarda en website_post.body_html o en la prop `html` de una sección.
 * El público nunca recibe HTML que no haya pasado por aquí.
 */

const WORDS_PER_MINUTE = 200

export const websiteEditorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: {
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https', 'mailto', 'tel'],
      HTMLAttributes: { rel: 'noopener noreferrer' }
    }
  }),
  Image.configure({ inline: false, allowBase64: false }),
  Youtube.configure({ nocookie: true, controls: true, modestBranding: true })
]

const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'www.google.com',
  'maps.google.com',
  'www.openstreetmap.org'
]

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'small', 'sup', 'sub',
    'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'img', 'figure', 'figcaption', 'iframe', 'div', 'span',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow', 'title', 'loading', 'referrerpolicy'],
    div: ['data-youtube-video', 'class'],
    code: ['class'],
    pre: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
  allowedIframeHostnames: ALLOWED_IFRAME_HOSTS,
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const attrs = { ...attribs }
      if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer'
      return { tagName, attribs: attrs }
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: attribs.loading ?? 'lazy' } }),
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } })
  }
}

export const sanitizeWebsiteHtml = (html: string): string => {
  if (!html) return ''
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim()
}

export const websiteHtmlToText = (html: string): string =>
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

export interface RenderedContent {
  html: string
  text: string
  word_count: number
  reading_minutes: number
  excerpt: string
}

const buildStats = (html: string): RenderedContent => {
  const text = websiteHtmlToText(html)
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0
  return {
    html,
    text,
    word_count: wordCount,
    reading_minutes: Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)),
    excerpt: text.length > 300 ? `${text.slice(0, 297).trimEnd()}…` : text
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Documento Tiptap (JSON) → HTML saneado + estadísticas. */
export const renderWebsiteDocument = (doc: unknown): RenderedContent | null => {
  if (!isRecord(doc) || doc.type !== 'doc') return null
  let raw: string
  try {
    raw = generateHTML(doc as JSONContent, websiteEditorExtensions)
  } catch (error) {
    console.error('Error rendering website document:', error)
    return null
  }
  return buildStats(sanitizeWebsiteHtml(raw))
}

/** HTML libre (sección html) → HTML saneado + estadísticas. */
export const renderWebsiteHtml = (html: unknown): RenderedContent | null => {
  if (typeof html !== 'string') return null
  return buildStats(sanitizeWebsiteHtml(html))
}

/**
 * Sanea las props HTML de un arreglo de secciones sin validar su esquema
 * (eso lo hace normalizeSections en el cliente). Devuelve una copia.
 */
export const sanitizeWebsiteSections = (sections: unknown): unknown[] => {
  if (!Array.isArray(sections)) return []
  return sections.map((section) => {
    if (!isRecord(section) || !isRecord(section.props)) return section
    const props: Record<string, unknown> = { ...section.props }
    if (typeof props.html === 'string') props.html = sanitizeWebsiteHtml(props.html)
    return { ...section, props }
  })
}
