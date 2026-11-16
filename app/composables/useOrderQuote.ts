import type {
  QuoteDecision,
  QuoteEffectiveStatus,
  QuoteEventType,
  QuoteStoredStatus
} from '~/utils/quote'
import { isQuoteStoredStatus, isQuoteToken } from '~/utils/quote'

/**
 * Cotizaciones compartibles (TRY-29).
 *
 * Los tipos generados (`types/database.types.ts`) todavía no conocen las
 * columnas `quote_*`, la tabla `order_quote_event` ni sus RPC (migración
 * `20261115120000_order_quote_share.sql`). Hasta correr `npm run db:types`
 * las llamadas se castean a `never` y la respuesta se valida en runtime,
 * igual que `usePublicProject`.
 */

export interface OrderQuoteState {
  token: string | null
  status: QuoteStoredStatus | null
  validUntil: string | null
  sharedAt: string | null
  viewedAt: string | null
  respondedAt: string | null
  responseName: string | null
  responseNote: string | null
  responseSeenAt: string | null
}

export interface OrderQuoteEvent {
  id: string
  event_type: QuoteEventType
  actor_name: string | null
  note: string | null
  valid_until: string | null
  created_at: string
}

/** Respuesta de cliente pendiente de ver (campana del panel). */
export interface QuoteResponseNotice {
  id: string
  name: string | null
  quote_status: 'accepted' | 'rejected'
  quote_response_name: string | null
  quote_responded_at: string
}

export interface PublicQuoteLine {
  description: string | null
  quantity: number
  unit_price: number
  discount_percent: number
  tax_rate: number
  subtotal: number | null
  total: number | null
}

export interface PublicQuoteInfo {
  name: string | null
  order_date: string
  valid_until: string | null
  currency: string
  payment_term: string | null
  notes: string | null
  customer_name: string | null
  amount_untaxed: number
  amount_discount: number
  amount_tax: number
  amount_total: number
  responded_at: string | null
  response_name: string | null
}

export interface PublicQuoteCompany {
  name: string | null
  legal_name: string | null
  vat: string | null
  email: string | null
  phone: string | null
  website: string | null
  logo_url: string | null
  primary_color: string | null
  city: string | null
  state: string | null
}

export type PublicQuoteResult =
  | {
      status: QuoteEffectiveStatus
      quote: PublicQuoteInfo
      company: PublicQuoteCompany
      lines: PublicQuoteLine[]
    }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

const QUOTE_COLUMNS = [
  'quote_token',
  'quote_status',
  'quote_valid_until',
  'quote_shared_at',
  'quote_viewed_at',
  'quote_responded_at',
  'quote_response_name',
  'quote_response_note',
  'quote_response_seen_at'
].join(', ')

type QuoteRow = {
  quote_token: string | null
  quote_status: string | null
  quote_valid_until: string | null
  quote_shared_at: string | null
  quote_viewed_at: string | null
  quote_responded_at: string | null
  quote_response_name: string | null
  quote_response_note: string | null
  quote_response_seen_at: string | null
}

type DbError = { message: string }
type QueryResult<T> = { data: T | null; error: DbError | null }

/** Traduce los errores del RPC a un mensaje para la UI. */
const quoteErrorMessage = (error: DbError): string => {
  const message = error.message?.trim() ?? ''
  if (!message) return 'No se pudo completar la acción.'
  // Los RPC ya lanzan mensajes en español pensados para el usuario
  return message.replace(/^.*?ERROR:\s*/, '')
}

export const useOrderQuote = () => {
  const supabase = useSupabase()
  const lastError = ref<string | null>(null)

  const rpc = async <T>(fn: string, args: Record<string, unknown>, context: string): Promise<T | null> => {
    lastError.value = null
    const { data, error } = await supabase.rpc(fn as never, args as never) as unknown as QueryResult<T>
    if (error) {
      console.error(`Error ${context}:`, error)
      lastError.value = quoteErrorMessage(error)
      return null
    }
    return data
  }

  // ─── Equipo (panel) ───────────────────────────────────────────────────────

  const getQuoteState = async (orderId: string, companyId: string): Promise<OrderQuoteState | null> => {
    const { data, error } = await supabase
      .from('order')
      .select(QUOTE_COLUMNS as '*')
      .eq('id', orderId)
      .eq('company_id', companyId)
      .single() as unknown as QueryResult<QuoteRow>

    if (error) {
      console.error('Error fetching quote state:', error)
      return null
    }
    if (!data) return null

    return {
      token: data.quote_token,
      status: isQuoteStoredStatus(data.quote_status) ? data.quote_status : null,
      validUntil: data.quote_valid_until,
      sharedAt: data.quote_shared_at,
      viewedAt: data.quote_viewed_at,
      respondedAt: data.quote_responded_at,
      responseName: data.quote_response_name,
      responseNote: data.quote_response_note,
      responseSeenAt: data.quote_response_seen_at
    }
  }

  const getQuoteEvents = async (orderId: string, companyId: string): Promise<OrderQuoteEvent[]> => {
    const { data, error } = await supabase
      .from('order_quote_event' as never)
      .select('id, event_type, actor_name, note, valid_until, created_at')
      .eq('order_id' as never, orderId as never)
      .eq('company_id' as never, companyId as never)
      .order('created_at' as never, { ascending: false }) as unknown as QueryResult<OrderQuoteEvent[]>

    if (error) {
      console.error('Error fetching quote events:', error)
      return []
    }
    return data ?? []
  }

  /** Crea o renueva el enlace. Devuelve el token. */
  const shareQuote = async (orderId: string, validUntil: string | null): Promise<string | null> => {
    const token = await rpc<string>(
      'order_quote_share',
      { p_order_id: orderId, p_valid_until: validUntil || null },
      'sharing quote'
    )
    return isQuoteToken(token) ? token : null
  }

  const revokeQuote = async (orderId: string): Promise<boolean> => {
    const result = await rpc<boolean>('order_quote_revoke', { p_order_id: orderId }, 'revoking quote')
    return result !== null
  }

  const markQuoteResponseSeen = async (orderId: string): Promise<void> => {
    await rpc<boolean>('order_quote_mark_seen', { p_order_id: orderId }, 'marking quote response as seen')
  }

  /** Respuestas de clientes que nadie del equipo ha abierto (campana). */
  const getUnseenQuoteResponses = async (companyId: string, limit = 20): Promise<QuoteResponseNotice[]> => {
    const { data, error } = await supabase
      .from('order')
      .select('id, name, quote_status, quote_response_name, quote_responded_at' as '*')
      .eq('company_id', companyId)
      .not('quote_responded_at' as never, 'is', null)
      .is('quote_response_seen_at' as never, null)
      .order('quote_responded_at' as never, { ascending: false })
      .limit(limit) as unknown as QueryResult<QuoteResponseNotice[]>

    if (error) {
      // Antes de aplicar la migración las columnas no existen: la campana sigue funcionando
      console.error('Error fetching quote responses:', error)
      return []
    }
    return (data ?? []).filter((row) => row.quote_status === 'accepted' || row.quote_status === 'rejected')
  }

  // ─── Cliente (página pública /q/[token]) ─────────────────────────────────

  const getPublicQuote = async (token: string): Promise<PublicQuoteResult> => {
    if (!isQuoteToken(token)) return { status: 'not_found' }

    const data = await rpc<{ status?: string } & Record<string, unknown>>(
      'get_public_quote',
      { p_token: token },
      'fetching public quote'
    )

    if (!data) {
      return lastError.value ? { status: 'error', message: lastError.value } : { status: 'not_found' }
    }
    if (data.status === 'not_found' || typeof data.status !== 'string') return { status: 'not_found' }

    const full = data as unknown as {
      status: QuoteEffectiveStatus
      quote: PublicQuoteInfo
      company: PublicQuoteCompany
      lines: PublicQuoteLine[] | null
    }
    return {
      status: full.status,
      quote: full.quote,
      company: full.company,
      lines: Array.isArray(full.lines) ? full.lines : []
    }
  }

  const respondToQuote = async (
    token: string,
    decision: QuoteDecision,
    name: string,
    note: string
  ): Promise<'accepted' | 'rejected' | null> => {
    const data = await rpc<{ status?: string }>(
      'respond_public_quote',
      { p_token: token, p_decision: decision, p_name: name.trim(), p_note: note.trim() || null },
      'responding to quote'
    )
    if (data?.status === 'accepted' || data?.status === 'rejected') return data.status
    return null
  }

  return {
    lastError,
    getQuoteState,
    getQuoteEvents,
    shareQuote,
    revokeQuote,
    markQuoteResponseSeen,
    getUnseenQuoteResponses,
    getPublicQuote,
    respondToQuote
  }
}
