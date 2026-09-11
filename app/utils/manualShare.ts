import type { DocArticle, ShareableSection } from './manual/types'

/** Redes soportadas por los botones de compartir. */
export type ShareTarget = 'whatsapp' | 'x' | 'linkedin' | 'facebook' | 'telegram' | 'email'

export interface ShareTargetMeta {
  id: ShareTarget
  label: string
  /** Color de marca para el icono. */
  color: string
}

export const SHARE_TARGETS: ShareTargetMeta[] = [
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { id: 'x', label: 'X', color: '#0f172a' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
  { id: 'telegram', label: 'Telegram', color: '#229ED9' },
  { id: 'email', label: 'Correo', color: '#64748b' }
]

/**
 * URL pública y compartible de un artículo (opcionalmente anclada a una sección).
 * El manual es una sección abierta: el mismo enlace sirve para el equipo y para
 * cualquier persona sin cuenta.
 */
export function buildArticleUrl(baseUrl: string, articleId: string, sectionId?: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  const anchor = sectionId ? `#${sectionId}` : ''
  return `${root}/manual/${articleId}${anchor}`
}

/** Construye la URL de la red social con el texto y el enlace ya codificados. */
export function buildShareTargetUrl(target: ShareTarget, text: string, url: string): string {
  const encodedText = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(url)

  switch (target) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    case 'telegram':
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
    case 'email':
      return `mailto:?subject=${encodedText}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
  }
}

/** Frase corta que representa al artículo en redes sociales. */
export function articleTagline(article: DocArticle): string {
  return article.summary ?? article.description
}

/** Hashtags sugeridos a partir de las etiquetas del artículo. */
export function articleHashtags(article: DocArticle, max = 3): string {
  const tags = (article.tags ?? [])
    .filter(t => !t.includes(' '))
    .slice(0, max)
    .map(t => `#${t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`)
  return ['#Flowbit', ...tags].join(' ')
}

/** Texto listo para publicar: título, resumen y hashtags. */
export function articleToSocialText(article: DocArticle): string {
  return `${article.moduleEmoji} ${article.title}\n\n${articleTagline(article)}\n\n${articleHashtags(article)}`
}

/** Versión completa en Markdown, pensada para pegar en un chat o documento interno. */
export function articleToMarkdown(article: DocArticle): string {
  const parts: string[] = []

  parts.push(`# ${article.moduleEmoji} ${article.title}`)
  parts.push('')
  parts.push(article.description)

  if (article.importance) {
    parts.push('')
    parts.push(`## ¿Por qué es importante?`)
    parts.push(article.importance)
  }

  if (article.wizard) {
    parts.push('')
    parts.push(`## ${article.wizard.title}`)
    parts.push(article.wizard.description)
    parts.push('')
    article.wizard.steps.forEach((step, i) => {
      parts.push(`${i + 1}. **${step.title}** — ${step.description}`)
      step.checklist?.forEach(item => parts.push(`   - [ ] ${item}`))
      if (step.tip) parts.push(`   > Consejo: ${step.tip}`)
      if (step.warning) parts.push(`   > Atención: ${step.warning}`)
    })
  }

  if (article.process?.length) {
    parts.push('')
    parts.push('## Proceso')
    parts.push(article.process.map(s => `${s.step}. ${s.title}: ${s.description}`).join('\n'))
  }

  if (article.tips.length) {
    parts.push('')
    parts.push('## Consejos')
    article.tips.forEach(tip => parts.push(`- ${tip}`))
  }

  if (article.fields?.length) {
    parts.push('')
    parts.push('## Campos')
    article.fields.forEach(f => {
      parts.push(`- **${f.label}** (${f.required ? 'requerido' : 'opcional'}): ${f.description}`)
    })
  }

  if (article.shortcuts?.length) {
    parts.push('')
    parts.push('## Atajos de teclado')
    article.shortcuts.forEach(s => parts.push(`- \`${s.keys}\` — ${s.action}`))
  }

  if (article.faqs?.length) {
    parts.push('')
    parts.push('## Preguntas frecuentes')
    article.faqs.forEach(f => {
      parts.push(`**${f.question}**`)
      parts.push(f.answer)
      parts.push('')
    })
  }

  return parts.join('\n').trim()
}

/** Secciones compartibles por separado dentro de un artículo. */
export function articleSections(article: DocArticle): ShareableSection[] {
  const sections: ShareableSection[] = [
    {
      id: 'resumen',
      label: 'Resumen',
      text: `${article.title}\n\n${article.description}`
    }
  ]

  if (article.wizard) {
    sections.push({
      id: 'guia',
      label: 'Guía paso a paso',
      text: `${article.wizard.title}\n\n${article.wizard.steps
        .map((s, i) => `${i + 1}. ${s.title}: ${s.description}`)
        .join('\n')}`
    })
  }

  if (article.process?.length) {
    sections.push({
      id: 'proceso',
      label: 'Proceso',
      text: `${article.title} — proceso\n\n${article.process.map(s => `${s.step}. ${s.title}: ${s.description}`).join('\n')}`
    })
  }

  if (article.tips.length) {
    sections.push({
      id: 'consejos',
      label: 'Consejos',
      text: `${article.title} — consejos\n\n${article.tips.map(t => `• ${t}`).join('\n')}`
    })
  }

  if (article.fields?.length) {
    sections.push({
      id: 'campos',
      label: 'Campos',
      text: `${article.title} — campos\n\n${article.fields
        .map(f => `• ${f.label} (${f.required ? 'requerido' : 'opcional'}): ${f.description}`)
        .join('\n')}`
    })
  }

  if (article.shortcuts?.length) {
    sections.push({
      id: 'atajos',
      label: 'Atajos',
      text: `${article.title} — atajos\n\n${article.shortcuts.map(s => `${s.keys} → ${s.action}`).join('\n')}`
    })
  }

  if (article.faqs?.length) {
    sections.push({
      id: 'faq',
      label: 'Preguntas frecuentes',
      text: `${article.title} — preguntas frecuentes\n\n${article.faqs
        .map(f => `${f.question}\n${f.answer}`)
        .join('\n\n')}`
    })
  }

  return sections
}

/** Copia texto al portapapeles con respaldo para navegadores sin permiso de escritura. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch (error) {
    console.error('Error copiando al portapapeles:', error)
    return false
  }
}

// ── Tarjeta de imagen para redes sociales ────────────────────────────────────

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
      if (lines.length === maxLines) break
    } else {
      current = candidate
    }
  }

  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    const last = lines[maxLines - 1]
    if (last) lines[maxLines - 1] = `${last.replace(/[.,;:\s]+$/, '')}…`
  }
  return lines
}

/**
 * Genera una tarjeta 1200×630 con la identidad de Flowbit lista para publicar.
 * Devuelve el blob de la imagen o null si el navegador no puede generarla.
 */
export async function renderShareCard(article: DocArticle, siteLabel: string): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Fondo degradado de marca
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630)
    gradient.addColorStop(0, '#6366f1')
    gradient.addColorStop(0.55, '#7c3aed')
    gradient.addColorStop(1, '#c026d3')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1200, 630)

    // Círculos decorativos
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.arc(1050, 120, 210, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(120, 560, 160, 0, Math.PI * 2)
    ctx.fill()

    const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

    // Módulo
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.font = `600 26px ${sans}`
    ctx.fillText(`${article.moduleEmoji}  ${article.moduleLabel.toUpperCase()}`, 80, 118)

    // Título
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 66px ${sans}`
    const titleLines = wrapLines(ctx, article.title, 1000, 3)
    titleLines.forEach((line, i) => ctx.fillText(line, 80, 210 + i * 78))

    // Resumen
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `400 30px ${sans}`
    const summaryTop = 210 + titleLines.length * 78 + 26
    const summaryLines = wrapLines(ctx, articleTagline(article), 1010, 3)
    summaryLines.forEach((line, i) => ctx.fillText(line, 80, summaryTop + i * 44))

    // Pie: marca y enlace
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.fillRect(80, 520, 1040, 2)

    ctx.fillStyle = '#ffffff'
    ctx.font = `700 30px ${sans}`
    ctx.fillText('Flowbit', 80, 576)

    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `400 24px ${sans}`
    ctx.fillText(siteLabel, 190, 576)

    ctx.font = `600 24px ${sans}`
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText('Manual de usuario', 1120, 576)
    ctx.textAlign = 'left'

    return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  } catch (error) {
    console.error('Error generando la tarjeta para compartir:', error)
    return null
  }
}

/** Descarga un blob con el nombre indicado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
