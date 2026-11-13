import { describe, expect, it } from 'vitest'
import {
  NO_SUPPLIER_LABEL,
  availableQuantity,
  buildRestockSuggestions,
  groupBySupplier,
  restockSeverity,
  suggestedQuantity,
  sumReservedByProduct,
  targetLevel,
  type RestockInput
} from '../../app/utils/restock'

const product = (overrides: Partial<RestockInput>): RestockInput => ({
  productId: 'p1',
  name: 'Producto',
  sku: null,
  onHand: 0,
  reserved: 0,
  stockMin: 10,
  stockMax: null,
  unitCost: 5,
  supplierId: 's1',
  supplierName: 'Proveedor Uno',
  ...overrides
})

describe('availableQuantity', () => {
  it('resta lo reservado de la existencia', () => {
    expect(availableQuantity(20, 8)).toBe(12)
  })

  it('ignora reservas negativas o nulas', () => {
    expect(availableQuantity(5, -3)).toBe(5)
  })
})

describe('targetLevel', () => {
  it('usa el máximo cuando es mayor que el mínimo', () => {
    expect(targetLevel(10, 50)).toBe(50)
  })

  it('usa el doble del mínimo sin máximo o con máximo inválido', () => {
    expect(targetLevel(10, null)).toBe(20)
    expect(targetLevel(10, 5)).toBe(20)
  })
})

describe('suggestedQuantity', () => {
  it('no sugiere nada sin mínimo', () => {
    expect(suggestedQuantity(0, null, 100)).toBe(0)
    expect(suggestedQuantity(0, 0, 100)).toBe(0)
  })

  it('no sugiere nada si el disponible alcanza el mínimo', () => {
    expect(suggestedQuantity(10, 10, 30)).toBe(0)
  })

  it('repone hasta el máximo', () => {
    expect(suggestedQuantity(4, 10, 30)).toBe(26)
  })

  it('cubre también el faltante cuando el disponible es negativo', () => {
    expect(suggestedQuantity(-5, 10, null)).toBe(25)
  })
})

describe('restockSeverity', () => {
  it('clasifica negativo, agotado y bajo mínimo', () => {
    expect(restockSeverity(-1)).toBe('negative')
    expect(restockSeverity(0)).toBe('out')
    expect(restockSeverity(3)).toBe('low')
  })
})

describe('buildRestockSuggestions', () => {
  it('considera las reservas al decidir si falta producto', () => {
    const [item] = buildRestockSuggestions([product({ onHand: 12, reserved: 5, stockMin: 10 })])
    expect(item).toMatchObject({ available: 7, suggestedQuantity: 13, estimatedCost: 65 })
  })

  it('descarta productos que no requieren compra y ordena por urgencia', () => {
    const result = buildRestockSuggestions([
      product({ productId: 'ok', name: 'Bien surtido', onHand: 50 }),
      product({ productId: 'low', name: 'Bajo', onHand: 3 }),
      product({ productId: 'neg', name: 'Negativo', onHand: -2 }),
      product({ productId: 'out', name: 'Agotado', onHand: 0 })
    ])
    expect(result.map((r) => r.productId)).toEqual(['neg', 'out', 'low'])
  })

  it('valora en cero los productos sin costo', () => {
    const [item] = buildRestockSuggestions([product({ unitCost: null })])
    expect(item?.estimatedCost).toBe(0)
  })
})

describe('groupBySupplier', () => {
  it('agrupa por proveedor y deja al final los productos sin proveedor', () => {
    const suggestions = buildRestockSuggestions([
      product({ productId: 'a', name: 'A', supplierId: 's2', supplierName: 'Zeta' }),
      product({ productId: 'b', name: 'B', supplierId: null, supplierName: null }),
      product({ productId: 'c', name: 'C', supplierId: 's1', supplierName: 'Alfa' }),
      product({ productId: 'd', name: 'D', supplierId: 's1', supplierName: 'Alfa' })
    ])
    const groups = groupBySupplier(suggestions)

    expect(groups.map((g) => g.supplierName)).toEqual(['Alfa', 'Zeta', NO_SUPPLIER_LABEL])
    expect(groups[0]?.items).toHaveLength(2)
    expect(groups[0]?.estimatedTotal).toBe(200)
  })
})

describe('sumReservedByProduct', () => {
  it('suma las reservas de todos los almacenes', () => {
    const totals = sumReservedByProduct([
      { product_id: 'p1', reserved: 2 },
      { product_id: 'p1', reserved: 3.5 },
      { product_id: 'p2', reserved: null },
      { product_id: null, reserved: 9 }
    ])
    expect(totals.get('p1')).toBe(5.5)
    expect(totals.get('p2')).toBe(0)
    expect(totals.size).toBe(2)
  })
})
