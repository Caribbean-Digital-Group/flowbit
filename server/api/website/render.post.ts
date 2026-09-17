import { isRateLimited } from '../../utils/analyticsIngest'
import {
  renderWebsiteDocument,
  renderWebsiteHtml,
  sanitizeWebsiteSections
} from '../../utils/websiteContent'

/**
 * Renderiza y sanea contenido del sitio web antes de guardarlo.
 *
 *  · { doc }      → documento Tiptap (posts) → html + texto + estadísticas
 *  · { html }     → HTML libre (sección «HTML personalizado»)
 *  · { sections } → arreglo de secciones: sanea sus props html
 *
 * Es una transformación pura (no toca la base). Exige sesión para no ser un
 * sanitizador público abierto y limita por IP.
 */

const MAX_BODY_BYTES = 1_500_000

interface RenderBody {
  doc?: unknown
  html?: unknown
  sections?: unknown
}

export default defineEventHandler(async (event) => {
  const headers = getHeaders(event)
  const ip =
    headers['x-nf-client-connection-ip'] ||
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'

  if (isRateLimited(`website-render:${ip}`)) {
    setResponseStatus(event, 429)
    return { status: 'rate_limited' }
  }

  const auth = headers.authorization ?? ''
  if (!/^Bearer\s+\S+/.test(auth)) {
    setResponseStatus(event, 401)
    return { status: 'unauthorized' }
  }

  let body: RenderBody
  try {
    const raw = await readRawBody(event, 'utf-8')
    if (!raw || raw.length > MAX_BODY_BYTES) throw new Error('invalid body')
    body = JSON.parse(raw) as RenderBody
  } catch {
    setResponseStatus(event, 400)
    return { status: 'invalid_payload' }
  }

  if (body.doc !== undefined) {
    const rendered = renderWebsiteDocument(body.doc)
    if (!rendered) {
      setResponseStatus(event, 400)
      return { status: 'invalid_document' }
    }
    return { status: 'ok', ...rendered }
  }

  if (body.html !== undefined) {
    const rendered = renderWebsiteHtml(body.html)
    if (!rendered) {
      setResponseStatus(event, 400)
      return { status: 'invalid_html' }
    }
    return { status: 'ok', ...rendered }
  }

  if (body.sections !== undefined) {
    return { status: 'ok', sections: sanitizeWebsiteSections(body.sections) }
  }

  setResponseStatus(event, 400)
  return { status: 'invalid_payload' }
})
