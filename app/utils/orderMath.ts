/**
 * Cálculo de importes de una línea de orden.
 *
 * Réplica exacta de `public.calculate_order_line_totals()` (migración
 * 20261103120000_fix_sales_flow_data_integrity). El servidor es la fuente de
 * verdad; esta función existe para que el POS y el formulario de órdenes
 * muestren —y cobren— lo mismo que la base de datos va a registrar.
 *
 * Si `priceIncludesTax` es verdadero, `unitPrice` ya trae el impuesto: se
 * desglosa y el total no cambia. Si es falso, el impuesto se suma encima.
 */
export interface OrderLineMathInput {
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
  unitCost?: number
  priceIncludesTax?: boolean
}

export interface OrderLineAmounts {
  discount: number
  subtotal: number
  tax: number
  total: number
  margin: number
  marginPercent: number
}

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

export const computeOrderLineAmounts = (line: OrderLineMathInput): OrderLineAmounts => {
  const quantity = Number(line.quantity) || 0
  const unitPrice = Number(line.unitPrice) || 0
  const rate = Number(line.taxRate) || 0
  const gross = quantity * unitPrice

  const discount = roundMoney(gross * (Number(line.discountPercent) || 0) / 100)
  const net = roundMoney(gross - discount)

  let subtotal: number
  let tax: number
  if (line.priceIncludesTax && rate !== 0) {
    subtotal = roundMoney(net / (1 + rate / 100))
    tax = roundMoney(net - subtotal)
  } else {
    subtotal = net
    tax = roundMoney(net * rate / 100)
  }

  const total = roundMoney(subtotal + tax)
  const margin = roundMoney(subtotal - quantity * (Number(line.unitCost) || 0))
  const marginPercent = subtotal > 0 ? roundMoney(margin / subtotal * 100) : 0

  return { discount, subtotal, tax, total, margin, marginPercent }
}
