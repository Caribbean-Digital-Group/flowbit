import Stripe from 'stripe'
import { isRateLimited } from '../../../utils/analyticsIngest'
import {
  callStorefrontServiceRpc,
  isValidStorefrontSlug,
  fromStripeAmount,
  type StripeOrderContext
} from '../../../utils/storefrontStripe'

/**
 * Verifica en Stripe el estado de pago de una orden del storefront y, si la
 * Checkout Session ya fue cobrada, marca la orden como pagada.
 *
 * Es el respaldo del webhook: la página de confirmación lo invoca al regresar
 * de Stripe (?stripe=success), de modo que el pago se refleja aunque el
 * webhook no esté configurado o aún no haya llegado. La verdad siempre se
 * consulta directamente a la API de Stripe con la secret key de la tienda;
 * el cliente no puede forzar un estado.
 */

interface StatusBody {
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

  if (isRateLimited(`stripe-status:${ip}`)) {
    setResponseStatus(event, 429)
    return { status: 'rate_limited' }
  }

  const body = await readBody<StatusBody>(event).catch(() => null)
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
  if (order.payment_status === 'paid') {
    return { status: 'ok', payment_status: 'paid' }
  }
  if (!storeConfig.secret_key || !order.stripe_session_id) {
    return { status: 'ok', payment_status: order.payment_status }
  }

  try {
    const stripe = new Stripe(storeConfig.secret_key)
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id)

    if (session.payment_status !== 'paid') {
      return { status: 'ok', payment_status: order.payment_status }
    }

    const result = await callStorefrontServiceRpc<{ status: string; payment_status?: string }>(
      event,
      'mark_storefront_order_paid',
      {
        p_order_id: order.id,
        p_session_id: session.id,
        p_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        p_amount: fromStripeAmount(session.amount_total ?? 0, session.currency ?? order.currency),
        p_currency: (session.currency ?? order.currency).toUpperCase()
      }
    )

    return {
      status: 'ok',
      payment_status: result?.status === 'ok' ? result.payment_status ?? 'paid' : order.payment_status
    }
  } catch (error) {
    console.error('Error verifying Stripe session status:', error)
    setResponseStatus(event, 502)
    return { status: 'error' }
  }
})
