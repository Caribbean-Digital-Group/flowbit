/**
 * Cotizaciones compartibles (TRY-29): tipos, etiquetas y reglas puras.
 *
 * El estado guardado (`order.quote_status`) es `shared | accepted | rejected |
 * revoked`. Lo que ve el cliente es el «estado efectivo»: una cotización
 * compartida cuya vigencia ya pasó está `expired`, y una que el equipo
 * confirmó o canceló por su cuenta queda `closed` / `cancelled`.
 * `effectiveQuoteStatus` replica `public._quote_effective_status` de la
 * migración `20261115120000_order_quote_share.sql`: si cambias una, cambia la otra.
 */

export type QuoteStoredStatus = 'shared' | 'accepted' | 'rejected' | 'revoked'
export type QuoteEffectiveStatus = QuoteStoredStatus | 'expired' | 'closed' | 'cancelled'
export type QuoteEventType = 'shared' | 'viewed' | 'accepted' | 'rejected' | 'revoked'
export type QuoteDecision = 'accept' | 'reject'
type OrderStateValue = 'draft' | 'posted' | 'cancel'

/** Longitud fija del token (2 × UUID sin guiones). */
export const QUOTE_TOKEN_LENGTH = 64
export const QUOTE_NAME_MAX = 120
export const QUOTE_NOTE_MAX = 1000
/** Vigencia sugerida al compartir. */
export const QUOTE_DEFAULT_VALIDITY_DAYS = 15

export const QUOTE_STATUS_LABELS: Record<QuoteEffectiveStatus, string> = {
  shared: 'Esperando respuesta',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  revoked: 'Enlace revocado',
  expired: 'Vencida',
  closed: 'Cerrada',
  cancelled: 'Cancelada'
}

export const QUOTE_STATUS_VARIANTS: Record<QuoteEffectiveStatus, 'primary' | 'success' | 'warning' | 'danger' | 'secondary'> = {
  shared: 'primary',
  accepted: 'success',
  rejected: 'danger',
  revoked: 'secondary',
  expired: 'warning',
  closed: 'secondary',
  cancelled: 'danger'
}

export const QUOTE_EVENT_LABELS: Record<QuoteEventType, string> = {
  shared: 'Cotización compartida',
  viewed: 'El cliente abrió la cotización',
  accepted: 'El cliente aceptó',
  rejected: 'El cliente rechazó',
  revoked: 'Enlace revocado'
}

export const isQuoteStoredStatus = (value: unknown): value is QuoteStoredStatus =>
  value === 'shared' || value === 'accepted' || value === 'rejected' || value === 'revoked'

/** Fecha de hoy `YYYY-MM-DD` en hora local. */
const todayIso = (now: Date): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

/** La vigencia es inclusiva: el último día todavía se puede aceptar. */
export const isQuoteExpired = (validUntil: string | null | undefined, now: Date = new Date()): boolean => {
  if (!validUntil) return false
  return validUntil.slice(0, 10) < todayIso(now)
}

export const effectiveQuoteStatus = (
  status: QuoteStoredStatus | null | undefined,
  orderState: OrderStateValue,
  validUntil: string | null | undefined,
  now: Date = new Date()
): QuoteEffectiveStatus | null => {
  if (!status) return null
  if (status !== 'shared') return status
  if (orderState === 'cancel') return 'cancelled'
  if (orderState !== 'draft') return 'closed'
  if (isQuoteExpired(validUntil, now)) return 'expired'
  return 'shared'
}

/** Solo una cotización compartida, vigente y en borrador admite respuesta. */
export const canRespondToQuote = (status: QuoteEffectiveStatus | null): boolean => status === 'shared'

/** Validación de la respuesta del cliente (mismas reglas que `respond_public_quote`). */
export const validateQuoteResponse = (
  decision: QuoteDecision,
  name: string,
  note: string
): string | null => {
  const cleanName = name.trim()
  const cleanNote = note.trim()
  if (!cleanName) return 'Escribe tu nombre.'
  if (cleanName.length > QUOTE_NAME_MAX) return `El nombre admite hasta ${QUOTE_NAME_MAX} caracteres.`
  if (cleanNote.length > QUOTE_NOTE_MAX) return `El comentario admite hasta ${QUOTE_NOTE_MAX} caracteres.`
  if (decision === 'reject' && !cleanNote) return 'Cuéntanos el motivo del rechazo.'
  return null
}

export const isQuoteToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)

/** URL pública de la cotización. `origin` sin barra final. */
export const buildQuoteUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/+$/, '')}/q/${token}`

/** Enlace de WhatsApp con el mensaje listo para enviar. */
export const buildQuoteWhatsappUrl = (url: string, quoteName: string | null, companyName: string | null): string => {
  const who = companyName ? ` de ${companyName}` : ''
  const what = quoteName ? ` ${quoteName}` : ''
  const text = `Hola, te comparto la cotización${what}${who}. Puedes revisarla y aceptarla aquí: ${url}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Vigencia sugerida (hoy + N días) en `YYYY-MM-DD`. */
export const defaultQuoteValidUntil = (now: Date = new Date(), days = QUOTE_DEFAULT_VALIDITY_DAYS): string =>
  todayIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days))

/** Importe con la moneda de la cotización (`es-MX`). */
export const formatQuoteMoney = (value: number | null | undefined, currency: string | null | undefined): string => {
  const amount = Number(value ?? 0)
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ''}`.trim()
  }
}

/** Fecha `YYYY-MM-DD` o timestamp → «15 de noviembre de 2026». */
export const formatQuoteDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
