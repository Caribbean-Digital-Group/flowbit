/**
 * Utilidades puras del storefront público.
 */

/** Formatea un monto con la moneda de la tienda en locale es-MX. */
export const formatStorefrontCurrency = (amount: number | null | undefined, currency = 'MXN'): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(amount ?? 0)
}

/** Ruta base de la tienda de una empresa. */
export const storefrontPath = (slug: string, path = ''): string => {
  return `/stores/${slug}${path}`
}

/**
 * Normaliza un número de WhatsApp a solo dígitos (formato internacional),
 * removiendo espacios, guiones, paréntesis y el prefijo «+».
 * Retorna null si no queda un número utilizable.
 */
export const sanitizeWhatsappPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

/**
 * Construye un enlace de WhatsApp para contactar a la tienda, con mensaje
 * opcional prellenado. Retorna null si el número no es válido.
 */
export const buildWhatsappLink = (
  phone: string | null | undefined,
  message?: string
): string | null => {
  const digits = sanitizeWhatsappPhone(phone)
  if (!digits) return null
  const base = `https://api.whatsapp.com/send?phone=${digits}`
  return message ? `${base}&text=${encodeURIComponent(message)}` : base
}
