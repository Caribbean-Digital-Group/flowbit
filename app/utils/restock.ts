/**
 * Reabastecimiento: cálculo puro de qué productos pedir, cuánto y a quién.
 *
 * Se mantiene sin dependencias de Supabase para poder probarlo (ver
 * `tests/utils/restock.test.ts`). El composable `useRestock` arma los insumos
 * desde la base y crea las órdenes de compra en borrador.
 */

export interface RestockInput {
  productId: string
  name: string
  sku: string | null
  /** Existencia total de la empresa (`product.stock_quantity`). */
  onHand: number
  /** Unidades reservadas por entregas preparadas y pedidos de la tienda. */
  reserved: number
  stockMin: number | null
  stockMax: number | null
  /** Costo de reposición (`product.cost_price`); se usa como precio de la OC. */
  unitCost: number | null
  supplierId: string | null
  supplierName: string | null
}

export interface RestockSuggestion extends RestockInput {
  available: number
  suggestedQuantity: number
  estimatedCost: number
  severity: RestockSeverity
}

export type RestockSeverity = 'negative' | 'out' | 'low'

export interface SupplierGroup {
  /** `null` agrupa los productos sin proveedor habitual. */
  supplierId: string | null
  supplierName: string
  items: RestockSuggestion[]
  estimatedTotal: number
}

export const NO_SUPPLIER_LABEL = 'Sin proveedor habitual'

const round3 = (value: number): number => Math.round(value * 1000) / 1000
const round2 = (value: number): number => Math.round(value * 100) / 100

const toNumber = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/** Disponible = existencia − reservado. */
export const availableQuantity = (onHand: number, reserved: number): number =>
  round3(toNumber(onHand) - Math.max(0, toNumber(reserved)))

/**
 * Nivel objetivo al que se repone: el máximo si está capturado y es mayor que
 * el mínimo; si no, el doble del mínimo.
 */
export const targetLevel = (stockMin: number | null, stockMax: number | null): number => {
  const min = Math.max(0, toNumber(stockMin))
  const max = toNumber(stockMax)
  return max > min ? max : min * 2
}

/**
 * Cantidad sugerida a comprar. Es 0 cuando el producto no tiene mínimo o el
 * disponible ya está en el mínimo o por encima.
 */
export const suggestedQuantity = (
  available: number,
  stockMin: number | null,
  stockMax: number | null
): number => {
  const min = toNumber(stockMin)
  if (min <= 0 || available >= min) return 0
  return Math.max(0, round3(targetLevel(stockMin, stockMax) - available))
}

export const restockSeverity = (available: number): RestockSeverity => {
  if (available < 0) return 'negative'
  if (available === 0) return 'out'
  return 'low'
}

const SEVERITY_ORDER: Record<RestockSeverity, number> = { negative: 0, out: 1, low: 2 }

/** Convierte el catálogo en la lista de trabajo, de lo más urgente a lo menos. */
export const buildRestockSuggestions = (inputs: RestockInput[]): RestockSuggestion[] =>
  inputs
    .map((input) => {
      const available = availableQuantity(input.onHand, input.reserved)
      const quantity = suggestedQuantity(available, input.stockMin, input.stockMax)
      return {
        ...input,
        available,
        suggestedQuantity: quantity,
        estimatedCost: round2(quantity * Math.max(0, toNumber(input.unitCost))),
        severity: restockSeverity(available)
      }
    })
    .filter((suggestion) => suggestion.suggestedQuantity > 0)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.name.localeCompare(b.name, 'es-MX')
    )

/**
 * Agrupa por proveedor habitual: cada grupo con proveedor se convierte en una
 * orden de compra. El grupo sin proveedor se devuelve al final para que la
 * persona lo asigne a mano.
 */
export const groupBySupplier = (suggestions: RestockSuggestion[]): SupplierGroup[] => {
  const groups = new Map<string, SupplierGroup>()

  for (const item of suggestions) {
    const key = item.supplierId ?? ''
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
      existing.estimatedTotal = round2(existing.estimatedTotal + item.estimatedCost)
      continue
    }
    groups.set(key, {
      supplierId: item.supplierId,
      supplierName: item.supplierId ? (item.supplierName ?? 'Proveedor') : NO_SUPPLIER_LABEL,
      items: [item],
      estimatedTotal: item.estimatedCost
    })
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.supplierId) return 1
    if (!b.supplierId) return -1
    return a.supplierName.localeCompare(b.supplierName, 'es-MX')
  })
}

/** Suma las reservas por producto a partir de las filas por almacén. */
export const sumReservedByProduct = (
  rows: { product_id: string | null; reserved: number | null }[]
): Map<string, number> => {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (!row.product_id) continue
    totals.set(row.product_id, round3((totals.get(row.product_id) ?? 0) + toNumber(row.reserved)))
  }
  return totals
}
