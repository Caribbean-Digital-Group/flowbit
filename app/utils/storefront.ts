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
