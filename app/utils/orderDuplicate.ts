/**
 * Duplicar una orden (recompra, cotización parecida a otra).
 *
 * Funciones puras: reciben la orden original, sus líneas y el catálogo,
 * y devuelven lo que se precarga en `/admin/orders/create?from=<id>`.
 * La copia se guarda con el flujo normal de creación, así que nace en borrador,
 * con folio nuevo y sin pagos, entregas ni token de cotización.
 */

export type DuplicatePriceMode = 'original' | 'current'

/** Campos de la orden original que sí se copian. */
export interface DuplicateSourceOrder {
  order_type: 'sale' | 'purchase'
  partner_id: string | null
  project_id: string | null
  currency: string | null
  exchange_rate: number | null
  tax_rate: number | null
  tax_included: boolean | null
  payment_method_id: string | null
  warehouse_id: string | null
  payment_term: string | null
  shipping_street: string | null
  shipping_street2: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_country_code: string | null
  notes: string | null
  terms: string | null
}

export interface DuplicateSourceLine {
  product_id: string | null
  product_name: string | null
  description: string | null
  quantity: number | null
  unit_price: number | null
  unit_cost: number | null
  discount_percent: number | null
  tax_rate: number | null
  sequence: number | null
}

/** Datos del catálogo necesarios para validar y, si se pide, actualizar precios. */
export interface DuplicateCatalogProduct {
  id: string
  name: string
  status: string | null
  sale_price: number | null
  cost_price: number | null
  tax_rate: number | null
}

export interface DuplicatedLine {
  product_id: string
  product_name: string
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_percent: number
  tax_rate: number
  sequence: number
}

export interface DuplicateResult {
  lines: DuplicatedLine[]
  /** Nombres de las líneas omitidas porque su producto ya no está activo o no existe. */
  skipped: string[]
}

const num = (value: number | null | undefined, fallback = 0): number => {
  if (value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const text = (value: string | null | undefined): string => (value ?? '').trim()

/** Un producto archivado (inactivo o descontinuado) ya no se vuelve a vender ni comprar. */
export const isProductAvailable = (product: DuplicateCatalogProduct | undefined): boolean =>
  !!product && (product.status ?? 'active') === 'active'

/**
 * Precio vigente de un producto con la misma regla que el selector de líneas
 * (`OrderLine/Form.vue`): venta → precio de venta; compra → costo.
 */
export const currentCatalogPrices = (
  product: DuplicateCatalogProduct,
  orderType: 'sale' | 'purchase'
): { unitPrice: number; unitCost: number } => {
  const salePrice = num(product.sale_price)
  const costPrice = product.cost_price != null ? num(product.cost_price) : null
  if (orderType === 'sale') {
    return { unitPrice: salePrice, unitCost: costPrice ?? salePrice }
  }
  return { unitPrice: costPrice ?? salePrice, unitCost: costPrice ?? 0 }
}

/**
 * Copia las líneas de la orden original.
 * - Las líneas de texto libre (sin producto) se copian tal cual.
 * - Las de productos archivados o borrados se omiten y se reportan en `skipped`.
 * - Con `priceMode = 'current'` se toman precio, costo e IVA vigentes del catálogo;
 *   el descuento y la cantidad se conservan.
 */
export const duplicateOrderLines = (
  orderType: 'sale' | 'purchase',
  sourceLines: DuplicateSourceLine[],
  catalog: DuplicateCatalogProduct[],
  priceMode: DuplicatePriceMode,
  fallbackTaxRate = 16
): DuplicateResult => {
  const byId = new Map(catalog.map(p => [p.id, p]))
  const lines: DuplicatedLine[] = []
  const skipped: string[] = []

  const ordered = [...sourceLines].sort((a, b) => num(a.sequence) - num(b.sequence))

  for (const src of ordered) {
    const productId = text(src.product_id)
    const label = text(src.product_name) || text(src.description) || 'Línea'
    const product = productId ? byId.get(productId) : undefined

    if (productId && !isProductAvailable(product)) {
      skipped.push(label)
      continue
    }

    let unitPrice = num(src.unit_price)
    let unitCost = num(src.unit_cost)
    let taxRate = num(src.tax_rate, fallbackTaxRate)

    if (priceMode === 'current' && product) {
      const prices = currentCatalogPrices(product, orderType)
      unitPrice = prices.unitPrice
      unitCost = prices.unitCost
      if (product.tax_rate != null) taxRate = num(product.tax_rate, taxRate)
    }

    lines.push({
      product_id: productId,
      product_name: product ? text(product.name) || label : text(src.product_name),
      description: text(src.description) || label,
      quantity: num(src.quantity, 1) > 0 ? num(src.quantity, 1) : 1,
      unit_price: unitPrice,
      unit_cost: unitCost,
      discount_percent: num(src.discount_percent),
      tax_rate: taxRate,
      sequence: (lines.length + 1) * 10
    })
  }

  return { lines, skipped }
}

/**
 * Encabezado de la copia: conserva contacto, tipo, almacén, condiciones y envío;
 * reinicia folio, fechas, referencia, estados y montos (los recalcula la base).
 */
export const duplicateOrderHeader = (source: DuplicateSourceOrder, today: string) => ({
  order_type: source.order_type,
  partner_id: source.partner_id,
  project_id: source.project_id,
  currency: text(source.currency) || 'MXN',
  exchange_rate: num(source.exchange_rate, 1) || 1,
  tax_rate: num(source.tax_rate, 16),
  tax_included: source.tax_included ?? false,
  payment_method_id: source.payment_method_id,
  warehouse_id: source.warehouse_id,
  payment_term: text(source.payment_term),
  shipping_street: text(source.shipping_street),
  shipping_street2: text(source.shipping_street2),
  shipping_city: text(source.shipping_city),
  shipping_state: text(source.shipping_state),
  shipping_zip: text(source.shipping_zip),
  shipping_country_code: text(source.shipping_country_code) || 'MX',
  notes: text(source.notes),
  terms: text(source.terms),
  order_date: today,
  delivery_date: '',
  payment_due_date: '',
  reference: ''
})
