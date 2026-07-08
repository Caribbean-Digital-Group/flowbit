/**
 * Acceso público (rol anon) a la tienda en línea de una empresa mediante los
 * RPCs SECURITY DEFINER creados en la migración `create_storefront_module`.
 * Los RPCs solo devuelven datos cuando la tienda está activa
 * (storefront_settings.is_active) y nunca exponen costos, márgenes ni datos
 * de otras empresas.
 *
 * Los tipos generados de Supabase aún no conocen estos RPCs, por lo que se
 * castea a `never` (mismo patrón que usePublicProject) y se valida el shape
 * en runtime.
 */

export interface StorefrontInfo {
  company_id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  primary_color: string
  currency: string
  website: string | null
  hero_title: string | null
  hero_subtitle: string | null
  announcement: string | null
  about_text: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  whatsapp_phone: string | null
  policy_shipping: string | null
  policy_returns: string | null
  policy_privacy: string | null
  policy_terms: string | null
  show_out_of_stock: boolean
}

export interface StorefrontCategory {
  id: string
  name: string
  slug: string | null
  image_url: string | null
  color: string | null
  product_count: number
}

export interface StorefrontProductCard {
  id: string
  slug: string
  name: string
  short_description: string | null
  price: number
  price_final: number
  list_price_final: number | null
  currency: string
  image_url: string | null
  featured: boolean
  category_id: string | null
  is_stockable: boolean
  stock_available: number | null
  in_stock: boolean
}

export interface StorefrontProductDetail extends StorefrontProductCard {
  description: string | null
  sku: string | null
  images: string[]
  attributes: Record<string, string>
  tags: string[]
  tax_rate: number
  tax_included: boolean
  meta_title: string | null
  meta_description: string | null
  category_name: string | null
  category_slug: string | null
}

export interface StorefrontShippingOption {
  id: string
  name: string
  description: string | null
  price: number
  delivery_estimate: string | null
}

export interface StorefrontPaymentOption {
  id: string
  name: string
  description: string | null
}

export interface StorefrontCouponValidation {
  status: 'valid' | 'invalid'
  reason?: string
  code?: string
  description?: string | null
  discount_type?: 'percent' | 'fixed'
  discount_value?: number
  discount_amount?: number
}

export interface StorefrontCheckoutCustomer {
  name: string
  email: string
  phone?: string
  street?: string
  street2?: string
  city?: string
  state?: string
  zip?: string
  country_code?: string
}

export interface StorefrontOrderResult {
  status: 'ok' | 'error'
  code?: string
  message?: string
  duplicate?: boolean
  order_id?: string
  order_ref?: string
  amount_untaxed?: number
  amount_tax?: number
  amount_total?: number
  currency?: string
  available?: number
  product_id?: string
}

export interface StorefrontOrderLine {
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  subtotal: number
  total: number
  image_url: string | null
  product_slug: string | null
}

export interface StorefrontOrderSummary {
  order_ref: string
  order_date: string
  order_state: string
  payment_status: string
  is_delivered: boolean
  customer_name: string | null
  customer_email: string | null
  shipping_method_name: string | null
  shipping_cost: number | null
  coupon_code: string | null
  coupon_discount: number | null
  shipping_street: string | null
  shipping_street2: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  amount_untaxed: number
  amount_tax: number
  amount_discount: number
  amount_total: number
  currency: string
}

export interface StorefrontMyOrder {
  order_ref: string
  order_date: string
  order_state: string
  payment_status: string
  is_delivered: boolean
  amount_total: number
  currency: string
  line_count: number
}

export interface StorefrontProductFilters {
  search?: string
  categoryId?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  onlyInStock?: boolean
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'best_sellers'
  page?: number
  pageSize?: number
}

export const useStorefront = () => {
  const supabase = useSupabase()

  const callRpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T | null> => {
    const { data, error } = await supabase.rpc(fn as never, args as never)
    if (error) {
      console.error(`Error calling ${fn}:`, error)
      return null
    }
    return data as T
  }

  const getStorefront = async (slug: string): Promise<{
    store: StorefrontInfo
    categories: StorefrontCategory[]
    featuredProducts: StorefrontProductCard[]
  } | null> => {
    if (!slug) return null
    const data = await callRpc<{
      status: string
      store: StorefrontInfo
      categories: StorefrontCategory[]
      featured_products: StorefrontProductCard[]
    }>('get_storefront', { p_slug: slug })
    if (!data || data.status !== 'ok') return null
    return {
      store: data.store,
      categories: data.categories ?? [],
      featuredProducts: data.featured_products ?? []
    }
  }

  const getProducts = async (
    slug: string,
    filters: StorefrontProductFilters = {}
  ): Promise<{ total: number; page: number; pageSize: number; products: StorefrontProductCard[] } | null> => {
    if (!slug) return null
    const data = await callRpc<{
      status: string
      total: number
      page: number
      page_size: number
      products: StorefrontProductCard[]
    }>('get_storefront_products', {
      p_slug: slug,
      p_search: filters.search?.trim() || null,
      p_category_id: filters.categoryId || null,
      p_min_price: filters.minPrice ?? null,
      p_max_price: filters.maxPrice ?? null,
      p_only_in_stock: filters.onlyInStock ?? false,
      p_sort: filters.sort ?? 'relevance',
      p_page: filters.page ?? 1,
      p_page_size: filters.pageSize ?? 12
    })
    if (!data || data.status !== 'ok') return null
    return {
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
      products: data.products ?? []
    }
  }

  const getProduct = async (
    slug: string,
    productSlug: string
  ): Promise<{ product: StorefrontProductDetail; relatedProducts: StorefrontProductCard[] } | null> => {
    if (!slug || !productSlug) return null
    const data = await callRpc<{
      status: string
      product: StorefrontProductDetail
      related_products: StorefrontProductCard[]
    }>('get_storefront_product', { p_slug: slug, p_product_slug: productSlug })
    if (!data || data.status !== 'ok') return null
    return { product: data.product, relatedProducts: data.related_products ?? [] }
  }

  const getCheckoutInfo = async (slug: string): Promise<{
    shippingMethods: StorefrontShippingOption[]
    paymentMethods: StorefrontPaymentOption[]
  } | null> => {
    if (!slug) return null
    const data = await callRpc<{
      status: string
      shipping_methods: StorefrontShippingOption[]
      payment_methods: StorefrontPaymentOption[]
    }>('get_storefront_checkout_info', { p_slug: slug })
    if (!data || data.status !== 'ok') return null
    return {
      shippingMethods: data.shipping_methods ?? [],
      paymentMethods: data.payment_methods ?? []
    }
  }

  const validateCoupon = async (
    slug: string,
    code: string,
    subtotal: number
  ): Promise<StorefrontCouponValidation> => {
    const data = await callRpc<StorefrontCouponValidation>('validate_storefront_coupon', {
      p_slug: slug,
      p_code: code,
      p_subtotal: subtotal
    })
    if (!data) return { status: 'invalid', reason: 'No se pudo validar el cupón. Intenta de nuevo.' }
    if (data.status !== 'valid') {
      return { status: 'invalid', reason: data.reason ?? 'El cupón no es válido.' }
    }
    return data
  }

  const placeOrder = async (params: {
    slug: string
    checkoutToken: string
    customer: StorefrontCheckoutCustomer
    items: { product_id: string; quantity: number }[]
    shippingMethodId: string
    paymentMethodId: string
    couponCode?: string | null
    notes?: string | null
  }): Promise<StorefrontOrderResult> => {
    const data = await callRpc<StorefrontOrderResult>('place_storefront_order', {
      p_slug: params.slug,
      p_checkout_token: params.checkoutToken,
      p_customer: params.customer,
      p_items: params.items,
      p_shipping_method_id: params.shippingMethodId,
      p_payment_method_id: params.paymentMethodId,
      p_coupon_code: params.couponCode ?? null,
      p_notes: params.notes ?? null
    })
    if (!data) {
      return {
        status: 'error',
        code: 'network',
        message: 'No se pudo procesar la compra. Verifica tu conexión e intenta de nuevo.'
      }
    }
    return data
  }

  const getOrder = async (
    slug: string,
    orderRef: string,
    email: string
  ): Promise<{ order: StorefrontOrderSummary; lines: StorefrontOrderLine[] } | null> => {
    if (!slug || !orderRef || !email) return null
    const data = await callRpc<{
      status: string
      order: StorefrontOrderSummary
      lines: StorefrontOrderLine[]
    }>('get_storefront_order', { p_slug: slug, p_order_ref: orderRef, p_email: email })
    if (!data || data.status !== 'ok') return null
    return { order: data.order, lines: data.lines ?? [] }
  }

  const getMyOrders = async (
    slug: string
  ): Promise<{ status: 'ok' | 'unauthenticated' | 'not_found'; email?: string; orders: StorefrontMyOrder[] }> => {
    const data = await callRpc<{
      status: 'ok' | 'unauthenticated' | 'not_found'
      email?: string
      orders?: StorefrontMyOrder[]
    }>('get_storefront_my_orders', { p_slug: slug })
    if (!data) return { status: 'not_found', orders: [] }
    return { status: data.status, email: data.email, orders: data.orders ?? [] }
  }

  return {
    getStorefront,
    getProducts,
    getProduct,
    getCheckoutInfo,
    validateCoupon,
    placeOrder,
    getOrder,
    getMyOrders
  }
}
