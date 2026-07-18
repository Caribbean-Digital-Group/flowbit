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
    return await $fetch<T>(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
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
