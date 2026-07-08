/**
 * Data layer de analítica del storefront: catálogo de eventos, tipos del
 * payload y builders. Toda la app emite eventos con estas estructuras a
 * través de la fachada (useStorefrontTracker) — nunca arma payloads a mano.
 *
 * Catálogo documentado en docs/storefront-analytics.md. `purchase` y
 * `refund` no se emiten desde el cliente: los generan triggers del
 * servidor al confirmarse/cancelarse la orden.
 */

export type AnalyticsConsent = 'unknown' | 'granted' | 'denied'

export type AnalyticsNavigationEventName = 'page_view'

export type AnalyticsInteractionEventName = 'click' | 'select_content' | 'search'

export type AnalyticsEcommerceEventName =
  | 'view_item_list'
  | 'view_item'
  | 'select_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'add_to_wishlist'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'

export type AnalyticsEventName =
  | AnalyticsNavigationEventName
  | AnalyticsInteractionEventName
  | AnalyticsEcommerceEventName

/** Item de e-commerce (producto en listas, carrito y checkout). */
export interface AnalyticsItem {
  id: string
  name: string
  category?: string | null
  variant?: string | null
  price?: number
  quantity?: number
}

/** Propiedades escalares adicionales de un evento. */
export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>

/** Payload de un evento de e-commerce hacia la fachada. */
export interface AnalyticsEcommercePayload {
  value?: number
  currency?: string
  items?: AnalyticsItem[]
  /** Token de idempotencia del checkout (enlaza purchase server-side con la sesión) */
  checkoutToken?: string | null
  properties?: AnalyticsProperties
}

/**
 * Evento serializado tal como viaja al endpoint de ingesta
 * (/api/storefront/analytics → RPC ingest_storefront_events).
 */
export interface AnalyticsWireEvent {
  id: string
  name: AnalyticsEventName
  ts: string
  anonymous_id: string
  session_id: string
  user_id?: string | null
  path: string
  title?: string | null
  referrer?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  language?: string | null
  viewport?: string | null
  value?: number | null
  currency?: string | null
  items?: AnalyticsItem[] | null
  checkout_token?: string | null
  properties?: AnalyticsProperties
}

/** Lote enviado al endpoint de ingesta. */
export interface AnalyticsIngestPayload {
  slug: string
  events: AnalyticsWireEvent[]
}

interface ProductLikeForAnalytics {
  id: string
  name: string
  price_final?: number
  category_id?: string | null
}

interface CartItemLikeForAnalytics {
  productId: string
  name: string
  priceFinal: number
  quantity: number
}

/** Construye el item del data layer desde una tarjeta/detalle de producto. */
export const analyticsItemFromProduct = (
  product: ProductLikeForAnalytics,
  quantity = 1
): AnalyticsItem => ({
  id: product.id,
  name: product.name,
  category: product.category_id ?? null,
  price: product.price_final,
  quantity
})

/** Construye el item del data layer desde una línea del carrito. */
export const analyticsItemFromCartItem = (item: CartItemLikeForAnalytics): AnalyticsItem => ({
  id: item.productId,
  name: item.name,
  price: item.priceFinal,
  quantity: item.quantity
})

/** Total de una lista de items (para value de add_to_cart, view_cart, etc.). */
export const analyticsItemsValue = (items: AnalyticsItem[]): number =>
  Math.round(
    items.reduce((sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 1), 0) * 100
  ) / 100
