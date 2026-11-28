import Stripe from 'stripe'
import {
  callStorefrontServiceRpc,
  classifyMarkPaidResult,
  isValidStorefrontSlug,
  fromStripeAmount,
  type MarkStorefrontOrderPaidResult,
  type StripeStoreConfig
} from '../../../utils/storefrontStripe'

/**
 * Webhook de Stripe para el storefront (multi-tenant).
 *
 * Cada tienda configura su propio endpoint de webhook en Stripe apuntando a
 * esta URL, con su propio signing secret (storefront_settings.stripe_webhook_secret).
 *
 * Resolución multi-tenant: el slug de la tienda viaja en la metadata del
 * objeto del evento. Ese slug SIN VERIFICAR solo se usa para elegir con qué
 * webhook secret validar la firma; si la firma no corresponde a esa tienda,
 * el evento se rechaza.
 *
 * La firma NO prueba que la orden sea de esa tienda: cualquier empresa
 * controla su propio webhook secret y podría firmar un evento con el
 * flowbit_order_id de una orden ajena. Por eso el pago se registra con la
 * empresa de la tienda verificada y `mark_storefront_order_paid` solo acepta
 * órdenes de esa empresa (TRY-70, regla en la base desde TRY-71).
 *
 * Eventos manejados: checkout.session.completed y
 * checkout.session.async_payment_succeeded (pagos diferidos tipo OXXO/SPEI).
 */

interface StripeEventShape {
  type?: string
  data?: {
    object?: {
      id?: string
      object?: string
      payment_status?: string
      payment_intent?: string | { id?: string }
      amount_total?: number
      currency?: string
      metadata?: Record<string, string>
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const signature = getHeader(event, 'stripe-signature')
  const rawBody = await readRawBody(event, 'utf-8')

  if (!signature || !rawBody || rawBody.length > 500_000) {
    setResponseStatus(event, 400)
    return { status: 'invalid_payload' }
  }

  // Extraer el slug (aún sin verificar) solo para elegir el secret correcto
  let unverified: StripeEventShape
  try {
    unverified = JSON.parse(rawBody)
  } catch {
    setResponseStatus(event, 400)
    return { status: 'invalid_payload' }
  }

  const slug = unverified.data?.object?.metadata?.storefront_slug?.trim().toLowerCase() ?? ''
  if (!isValidStorefrontSlug(slug)) {
    // Evento sin metadata del storefront: no es nuestro, responder 200 para
    // que Stripe no lo reintente indefinidamente
    return { received: true, ignored: 'no_storefront_metadata' }
  }

  const storeConfig = await callStorefrontServiceRpc<StripeStoreConfig>(
    event,
    'get_storefront_stripe_config',
    { p_slug: slug }
  )

  if (!storeConfig) {
    setResponseStatus(event, 503)
    return { status: 'unavailable' }
  }
  if (storeConfig.status !== 'ok' || !storeConfig.secret_key || !storeConfig.webhook_secret) {
    setResponseStatus(event, 400)
    return { status: 'webhook_not_configured' }
  }

  // Verificar la firma: a partir de aquí el payload es auténtico para esta tienda
  let stripeEvent: Stripe.Event
  try {
    const stripe = new Stripe(storeConfig.secret_key)
    stripeEvent = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      storeConfig.webhook_secret
    )
  } catch (error) {
    console.error('Invalid Stripe webhook signature:', error)
    setResponseStatus(event, 400)
    return { status: 'invalid_signature' }
  }

  if (
    stripeEvent.type !== 'checkout.session.completed' &&
    stripeEvent.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return { received: true, ignored: stripeEvent.type }
  }

  const session = stripeEvent.data.object as Stripe.Checkout.Session
  const orderId = session.metadata?.flowbit_order_id ?? ''

  if (session.payment_status !== 'paid' || !UUID_REGEX.test(orderId)) {
    return { received: true, ignored: 'not_paid_or_missing_order' }
  }

  if (!storeConfig.company_id) {
    setResponseStatus(event, 400)
    return { status: 'webhook_not_configured' }
  }

  // Multi-tenant: el RPC solo registra el pago si la orden es de la empresa
  // cuyo secret validó la firma
  const result = await callStorefrontServiceRpc<MarkStorefrontOrderPaidResult>(
    event,
    'mark_storefront_order_paid',
    {
      p_company_id: storeConfig.company_id,
      p_order_id: orderId,
      p_session_id: session.id,
      p_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      p_amount: fromStripeAmount(session.amount_total ?? 0, session.currency ?? ''),
      p_currency: (session.currency ?? '').toUpperCase()
    }
  )

  const outcome = classifyMarkPaidResult(result)
  if (outcome === 'ignore') {
    // Evento firmado por una tienda sobre una orden que no es suya (o que no
    // existe): no se registra el pago. 200 para que Stripe no lo reintente.
    console.error('Stripe webhook order does not belong to the signing store:', {
      slug,
      orderId,
      sessionId: session.id
    })
    return { received: true, ignored: 'order_not_in_store' }
  }
  if (outcome === 'retry' || !result) {
    // 500 para que Stripe reintente el evento más tarde
    console.error('Could not mark storefront order as paid:', orderId, result)
    setResponseStatus(event, 500)
    return { status: 'error' }
  }

  return { received: true, payment_status: result.payment_status }
})
