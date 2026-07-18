import Stripe from 'stripe'
import { isRateLimited } from '../../../utils/analyticsIngest'
import {
  callStorefrontServiceRpc,
  isValidStorefrontSlug,
  toStripeAmount,
  fromStripeAmount,
  type StripeOrderContext
} from '../../../utils/storefrontStripe'

/**
 * Crea (o reutiliza) una Stripe Checkout Session para una orden del
 * storefront y devuelve la URL de pago hospedada por Stripe.
 *
 * La orden ya existe (place_storefront_order con payment_provider=stripe) y
 * está unpaid; el monto SIEMPRE sale de la orden en la base de datos, nunca
 * del cliente. Requiere el email de la compra para evitar que un tercero
 * genere sesiones de pago de órdenes ajenas por enumeración de referencias.
 */

interface SessionBody {
  slug?: unknown
  order_ref?: unknown
  email?: unknown
}

export default defineEventHandler(async (event) => {
  const headers = getHeaders(event)
  const ip =
    headers['x-nf-client-connection-ip'] ||
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'

  if (isRateLimited(`stripe-session:${ip}`)) {
    setResponseStatus(event, 429)
    return { status: 'rate_limited' }
  }

  const body = await readBody<SessionBody>(event).catch(() => null)
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const orderRef = typeof body?.order_ref === 'string' ? body.order_ref.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!isValidStorefrontSlug(slug) || !orderRef || orderRef.length > 60 || !email || email.length > 255) {
    setResponseStatus(event, 400)
    return { status: 'invalid_payload' }
  }

  const context = await callStorefrontServiceRpc<StripeOrderContext>(
    event,
    'get_storefront_stripe_order',
    { p_slug: slug, p_order_ref: orderRef, p_email: email }
  )

  if (!context) {
    setResponseStatus(event, 503)
    return { status: 'unavailable' }
  }
  if (context.status !== 'ok' || !context.order || !context.config) {
    setResponseStatus(event, 404)
    return { status: 'not_found' }
  }

  const { config: storeConfig, order } = context
  if (!storeConfig.enabled || !storeConfig.secret_key) {
    setResponseStatus(event, 400)
    return { status: 'stripe_unavailable' }
  }
  if (order.payment_status === 'paid') {
    return { status: 'already_paid' }
  }
  if (!order.amount_total || order.amount_total <= 0) {
    setResponseStatus(event, 400)
    return { status: 'invalid_order' }
  }

  const stripe = new Stripe(storeConfig.secret_key)
  const runtime = useRuntimeConfig(event)
  const siteUrl = (runtime.public.siteUrl as string).replace(/\/$/, '')
  const confirmationUrl =
    `${siteUrl}/stores/${slug}/checkout/confirmation/${encodeURIComponent(order.order_ref)}`

  try {
    // Reutilizar la sesión previa si sigue abierta (evita sesiones huérfanas
    // cuando el cliente regresa del pago sin completarlo y reintenta)
    if (order.stripe_session_id) {
      const existing = await stripe.checkout.sessions
        .retrieve(order.stripe_session_id)
        .catch(() => null)

      if (existing?.payment_status === 'paid') {
        await callStorefrontServiceRpc(event, 'mark_storefront_order_paid', {
          p_order_id: order.id,
          p_session_id: existing.id,
          p_payment_intent: typeof existing.payment_intent === 'string' ? existing.payment_intent : null,
          p_amount: fromStripeAmount(existing.amount_total ?? 0, existing.currency ?? order.currency),
          p_currency: (existing.currency ?? order.currency).toUpperCase()
        })
        return { status: 'already_paid' }
      }
      if (existing?.status === 'open' && existing.url) {
        return { status: 'ok', url: existing.url }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: order.id,
      customer_email: order.customer_email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: toStripeAmount(order.amount_total, order.currency),
            product_data: {
              name: `Pedido ${order.order_ref}${storeConfig.store_name ? ` — ${storeConfig.store_name}` : ''}`
            }
          }
        }
      ],
      metadata: {
        flowbit_order_id: order.id,
        flowbit_order_ref: order.order_ref,
        storefront_slug: slug
      },
      payment_intent_data: {
        metadata: {
          flowbit_order_id: order.id,
          flowbit_order_ref: order.order_ref,
          storefront_slug: slug
        }
      },
      success_url: `${confirmationUrl}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${confirmationUrl}?stripe=cancelled`
    })

    await callStorefrontServiceRpc(event, 'record_storefront_stripe_session', {
      p_order_id: order.id,
      p_session_id: session.id
    })

    return { status: 'ok', url: session.url }
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error)
    setResponseStatus(event, 502)
    return { status: 'error' }
  }
})
