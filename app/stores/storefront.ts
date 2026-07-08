import { defineStore } from 'pinia'
import { storefrontTracker } from '~/utils/analyticsTracker'
import { analyticsItemFromProduct, analyticsItemFromCartItem } from '~/utils/analytics'
import type {
  StorefrontInfo,
  StorefrontCategory,
  StorefrontProductCard,
  StorefrontProductDetail,
  StorefrontCouponValidation
} from '~/composables/useStorefront'

export interface StorefrontCartItem {
  productId: string
  slug: string
  name: string
  imageUrl: string | null
  /** Precio base (sin impuestos), usado para validar cupones en servidor */
  price: number
  /** Precio final al consumidor (con impuestos) */
  priceFinal: number
  currency: string
  quantity: number
  /** null cuando el producto no es stockeable (servicios) */
  stockAvailable: number | null
}

const CART_STORAGE_PREFIX = 'flowbit:storefront-cart:'

const readPersistedCart = (slug: string): StorefrontCartItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_PREFIX + slug)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writePersistedCart = (slug: string, items: StorefrontCartItem[]): void => {
  if (typeof window === 'undefined') return
  try {
    if (items.length) {
      window.localStorage.setItem(CART_STORAGE_PREFIX + slug, JSON.stringify(items))
    } else {
      window.localStorage.removeItem(CART_STORAGE_PREFIX + slug)
    }
  } catch {
    // ignorar errores de quota / modo privado
  }
}

/**
 * Estado compartido del storefront público: datos de la tienda actual
 * (branding, categorías) y carrito de compra persistido por tienda.
 */
export const useStorefrontStore = defineStore('storefront', () => {
  const { getStorefront } = useStorefront()

  const slug = ref<string | null>(null)
  const store = ref<StorefrontInfo | null>(null)
  const categories = ref<StorefrontCategory[]>([])
  const featuredProducts = ref<StorefrontProductCard[]>([])
  const isLoading = ref(false)
  const notFound = ref(false)

  const items = ref<StorefrontCartItem[]>([])
  const coupon = ref<StorefrontCouponValidation | null>(null)
  /** Token de idempotencia del checkout en curso */
  const checkoutToken = ref<string | null>(null)
  /** Referencia de la última orden confirmada (para la página de confirmación) */
  const lastOrder = ref<{ orderRef: string; email: string } | null>(null)

  /** Toast global de la tienda (feedback de carrito, cupones, etc.) */
  const toastMessage = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  const notify = (message: string) => {
    toastMessage.value = message
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastMessage.value = null
    }, 2800)
  }

  const itemCount = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  /** Subtotal en precio base (sin impuestos) — el que valida cupones en servidor */
  const subtotalBase = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  /** Subtotal en precio final al consumidor (con impuestos) */
  const subtotalFinal = computed(() =>
    items.value.reduce((sum, item) => sum + item.priceFinal * item.quantity, 0)
  )

  const couponDiscountFinal = computed(() => {
    const c = coupon.value
    if (!c || c.status !== 'valid') return 0
    if (c.discount_type === 'percent') {
      const percent = Math.min(c.discount_value ?? 0, 100)
      return Math.round(subtotalFinal.value * percent) / 100
    }
    return Math.min(c.discount_amount ?? 0, subtotalFinal.value)
  })

  const currency = computed(() => store.value?.currency ?? 'MXN')

  const primaryColor = computed(() => store.value?.primary_color ?? '#6366f1')

  const initialize = async (newSlug: string): Promise<boolean> => {
    if (slug.value === newSlug && store.value) return true

    isLoading.value = true
    notFound.value = false
    try {
      const result = await getStorefront(newSlug)
      if (!result) {
        notFound.value = true
        store.value = null
        categories.value = []
        featuredProducts.value = []
        slug.value = newSlug
        items.value = []
        return false
      }
      slug.value = newSlug
      store.value = result.store
      categories.value = result.categories
      featuredProducts.value = result.featuredProducts
      items.value = readPersistedCart(newSlug)
      coupon.value = null
      return true
    } finally {
      isLoading.value = false
    }
  }

  const persist = () => {
    if (slug.value) writePersistedCart(slug.value, items.value)
  }

  const addItem = (product: StorefrontProductCard | StorefrontProductDetail, quantity = 1) => {
    if (!product.in_stock) return
    const existing = items.value.find((item) => item.productId === product.id)
    const max = product.stock_available ?? Number.POSITIVE_INFINITY

    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, max)
      existing.price = product.price
      existing.priceFinal = product.price_final
      existing.stockAvailable = product.stock_available
    } else {
      items.value.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: product.image_url,
        price: product.price,
        priceFinal: product.price_final,
        currency: product.currency,
        quantity: Math.min(quantity, max),
        stockAvailable: product.stock_available
      })
    }
    persist()

    const item = analyticsItemFromProduct(product, quantity)
    storefrontTracker.trackEcommerce('add_to_cart', {
      value: (product.price_final ?? 0) * quantity,
      currency: product.currency,
      items: [item]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    const item = items.value.find((entry) => entry.productId === productId)
    if (!item) return
    const max = item.stockAvailable ?? Number.POSITIVE_INFINITY
    item.quantity = Math.max(1, Math.min(quantity, max))
    persist()
  }

  const removeItem = (productId: string) => {
    const removed = items.value.find((item) => item.productId === productId)
    items.value = items.value.filter((item) => item.productId !== productId)
    if (!items.value.length) coupon.value = null
    persist()

    if (removed) {
      storefrontTracker.trackEcommerce('remove_from_cart', {
        value: removed.priceFinal * removed.quantity,
        currency: removed.currency,
        items: [analyticsItemFromCartItem(removed)]
      })
    }
  }

  const clearCart = () => {
    items.value = []
    coupon.value = null
    checkoutToken.value = null
    persist()
  }

  const setCoupon = (validation: StorefrontCouponValidation | null) => {
    coupon.value = validation && validation.status === 'valid' ? validation : null
  }

  /** Genera (o reutiliza) el token de idempotencia del checkout en curso */
  const ensureCheckoutToken = (): string => {
    if (!checkoutToken.value) {
      checkoutToken.value =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    return checkoutToken.value
  }

  const setLastOrder = (orderRef: string, email: string) => {
    lastOrder.value = { orderRef, email }
  }

  return {
    slug,
    store,
    categories,
    featuredProducts,
    isLoading,
    notFound,
    items,
    coupon,
    checkoutToken,
    lastOrder,
    itemCount,
    subtotalBase,
    subtotalFinal,
    couponDiscountFinal,
    currency,
    primaryColor,
    toastMessage,
    notify,
    initialize,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    setCoupon,
    ensureCheckoutToken,
    setLastOrder
  }
})
