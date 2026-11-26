import type { H3Event } from 'h3'

/**
 * Utilidades del backend para la integración de Stripe en el storefront.
 *
 * Las credenciales de Stripe viven por empresa en storefront_settings y solo
 * se leen mediante RPCs SECURITY DEFINER otorgados exclusivamente a
 * service_role, por lo que estos helpers requieren SUPABASE_SECRET_KEY en el
 * entorno del servidor. Nada de esto se ejecuta ni se expone en el cliente.
 */

export interface StripeOrderContext {
  status: string
  config?: {
    enabled: boolean
    secret_key: string | null
    store_name: string | null
  }
  order?: {
    id: string
    order_ref: string
    amount_total: number
    currency: string
    payment_status: string
    payment_provider: string | null
    stripe_session_id: string | null
    customer_email: string | null
    customer_name: string | null
  }
}

export interface StripeStoreConfig {
  status: string
  company_id?: string
  enabled?: boolean
  secret_key?: string | null
  webhook_secret?: string | null
}

/** Llama un RPC de Supabase con la clave service_role (solo servidor). */
export const callStorefrontServiceRpc = async <T>(
  event: H3Event,
  fn: string,
  args: Record<string, unknown>
): Promise<T | null> => {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabaseUrl
  const serviceKey = config.supabaseSecretKey

  if (!supabaseUrl || !serviceKey) {
    console.error(`Cannot call ${fn}: SUPABASE_SECRET_KEY is not configured`)
    return null
  }

  try {
    return await $fetch<T, string>(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: args,
      timeout: 8000
    })
  } catch (error) {
    console.error(`Error calling ${fn}:`, error)
    return null
  }
}

export interface StorefrontOrderOwner {
  id: string
  company_id: string
}

/**
 * Lee la empresa dueña de una orden del storefront con la clave service_role.
 * Devuelve `undefined` si no se pudo consultar (error transitorio) y `null`
 * si la orden no existe o no es del storefront.
 */
export const fetchStorefrontOrderOwner = async (
  event: H3Event,
  orderId: string
): Promise<StorefrontOrderOwner | null | undefined> => {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabaseUrl
  const serviceKey = config.supabaseSecretKey

  if (!supabaseUrl || !serviceKey) {
    console.error('Cannot read storefront order: SUPABASE_SECRET_KEY is not configured')
    return undefined
  }

  try {
    const rows = await $fetch<StorefrontOrderOwner[]>(`${supabaseUrl}/rest/v1/order`, {
      method: 'GET',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      },
      query: {
        id: `eq.${orderId}`,
        origin: 'eq.storefront',
        select: 'id,company_id',
        limit: 1
      },
      timeout: 8000
    })
    return rows?.[0] ?? null
  } catch (error) {
    console.error('Error reading storefront order owner:', error)
    return undefined
  }
}

/**
 * Regla multi-tenant del webhook: una tienda solo puede marcar como pagadas
 * sus propias órdenes. La firma prueba que el evento lo emitió quien conoce
 * el webhook secret de esa tienda, no que la orden sea suya: cualquier
 * empresa controla su propio secret y podría firmar un evento con el id de
 * una orden ajena.
 */
export const isOrderOwnedByStore = (
  order: Pick<StorefrontOrderOwner, 'company_id'> | null | undefined,
  storeCompanyId: string | null | undefined
): boolean =>
  !!order?.company_id && !!storeCompanyId && order.company_id === storeCompanyId

/** Valida el shape del slug público de la tienda. */
export const isValidStorefrontSlug = (slug: unknown): slug is string =>
  typeof slug === 'string' && /^[a-z0-9-]{1,80}$/.test(slug)

/** Monedas sin unidades decimales en Stripe (el resto usa centavos). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
])

/** Convierte un monto decimal a la unidad mínima que espera Stripe. */
export const toStripeAmount = (amount: number, currency: string): number => {
  const code = currency.toLowerCase()
  return ZERO_DECIMAL_CURRENCIES.has(code)
    ? Math.round(amount)
    : Math.round(amount * 100)
}

/** Convierte un monto de Stripe (unidad mínima) a decimal. */
export const fromStripeAmount = (amount: number, currency: string): number => {
  const code = currency.toLowerCase()
  return ZERO_DECIMAL_CURRENCIES.has(code) ? amount : amount / 100
}
