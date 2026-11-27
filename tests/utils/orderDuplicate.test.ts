import { describe, expect, it } from 'vitest'
import {
  currentCatalogPrices,
  duplicateOrderHeader,
  duplicateOrderLines,
  isProductAvailable,
  type DuplicateCatalogProduct,
  type DuplicateSourceLine,
  type DuplicateSourceOrder
} from '../../app/utils/orderDuplicate'

const product = (overrides: Partial<DuplicateCatalogProduct> = {}): DuplicateCatalogProduct => ({
  id: 'p1',
  name: 'Tornillo',
  status: 'active',
  sale_price: 12,
  cost_price: 7,
  tax_rate: 16,
  ...overrides
})

const line = (overrides: Partial<DuplicateSourceLine> = {}): DuplicateSourceLine => ({
  product_id: 'p1',
  product_name: 'Tornillo',
  description: 'Tornillo 1/4',
  quantity: 3,
  unit_price: 10,
  unit_cost: 6,
  discount_percent: 5,
  tax_rate: 16,
  sequence: 10,
  ...overrides
})

describe('isProductAvailable', () => {
  it('acepta productos activos o sin estado', () => {
    expect(isProductAvailable(product())).toBe(true)
    expect(isProductAvailable(product({ status: null }))).toBe(true)
  })

  it('rechaza inactivos, descontinuados y productos inexistentes', () => {
    expect(isProductAvailable(product({ status: 'inactive' }))).toBe(false)
    expect(isProductAvailable(product({ status: 'discontinued' }))).toBe(false)
    expect(isProductAvailable(undefined)).toBe(false)
  })
})

describe('currentCatalogPrices', () => {
  it('en venta usa el precio de venta y el costo', () => {
    expect(currentCatalogPrices(product(), 'sale')).toEqual({ unitPrice: 12, unitCost: 7 })
  })

  it('en compra usa el costo como precio', () => {
    expect(currentCatalogPrices(product(), 'purchase')).toEqual({ unitPrice: 7, unitCost: 7 })
  })

  it('sin costo registrado cae al precio de venta', () => {
    expect(currentCatalogPrices(product({ cost_price: null }), 'sale')).toEqual({ unitPrice: 12, unitCost: 12 })
    expect(currentCatalogPrices(product({ cost_price: null }), 'purchase')).toEqual({ unitPrice: 12, unitCost: 0 })
  })
})

describe('duplicateOrderLines', () => {
  it('con precios originales copia precio, costo, descuento e IVA', () => {
    const { lines, skipped } = duplicateOrderLines('sale', [line()], [product()], 'original')
    expect(skipped).toEqual([])
    expect(lines).toEqual([{
      product_id: 'p1',
      product_name: 'Tornillo',
      description: 'Tornillo 1/4',
      quantity: 3,
      unit_price: 10,
      unit_cost: 6,
      discount_percent: 5,
      tax_rate: 16,
      sequence: 10
    }])
  })

  it('con precios actuales toma precio, costo e IVA del catálogo y conserva cantidad y descuento', () => {
    const { lines } = duplicateOrderLines('sale', [line()], [product({ tax_rate: 8 })], 'current')
    expect(lines[0]).toMatchObject({ quantity: 3, discount_percent: 5, unit_price: 12, unit_cost: 7, tax_rate: 8 })
  })

  it('omite líneas de productos archivados o borrados y las reporta', () => {
    const { lines, skipped } = duplicateOrderLines(
      'sale',
      [
        line({ product_id: 'p1', sequence: 10 }),
        line({ product_id: 'p2', product_name: 'Clavo', sequence: 20 }),
        line({ product_id: 'p3', product_name: 'Taquete', sequence: 30 })
      ],
      [product(), product({ id: 'p2', name: 'Clavo', status: 'discontinued' })],
      'original'
    )
    expect(lines.map(l => l.product_id)).toEqual(['p1'])
    expect(skipped).toEqual(['Clavo', 'Taquete'])
  })

  it('copia líneas de texto libre aunque no tengan producto', () => {
    const { lines } = duplicateOrderLines(
      'sale',
      [line({ product_id: null, product_name: null, description: 'Instalación', unit_price: 500 })],
      [],
      'current'
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ product_id: '', description: 'Instalación', unit_price: 500 })
  })

  it('respeta el orden original y renumera la secuencia', () => {
    const { lines } = duplicateOrderLines(
      'sale',
      [
        line({ product_id: null, description: 'B', sequence: 40 }),
        line({ product_id: null, description: 'A', sequence: 15 })
      ],
      [],
      'original'
    )
    expect(lines.map(l => [l.description, l.sequence])).toEqual([['A', 10], ['B', 20]])
  })

  it('normaliza cantidades vacías o no positivas a 1 y usa el IVA de respaldo', () => {
    const { lines } = duplicateOrderLines(
      'purchase',
      [line({ product_id: null, quantity: 0, tax_rate: null })],
      [],
      'original',
      8
    )
    expect(lines[0]).toMatchObject({ quantity: 1, tax_rate: 8 })
  })
})

describe('duplicateOrderHeader', () => {
  const source: DuplicateSourceOrder = {
    order_type: 'purchase',
    partner_id: 'partner-1',
    project_id: 'project-1',
    currency: 'USD',
    exchange_rate: 17.5,
    tax_rate: 16,
    tax_included: true,
    payment_method_id: 'pm-1',
    warehouse_id: 'wh-1',
    payment_term: '30 días',
    shipping_street: 'Calle 1',
    shipping_street2: null,
    shipping_city: 'Mérida',
    shipping_state: 'Yucatán',
    shipping_zip: '97000',
    shipping_country_code: null,
    notes: 'Entregar por la tarde',
    terms: null
  }

  it('conserva contacto, tipo, almacén y condiciones', () => {
    const header = duplicateOrderHeader(source, '2026-11-24')
    expect(header).toMatchObject({
      order_type: 'purchase',
      partner_id: 'partner-1',
      project_id: 'project-1',
      currency: 'USD',
      exchange_rate: 17.5,
      tax_included: true,
      payment_method_id: 'pm-1',
      warehouse_id: 'wh-1',
      payment_term: '30 días',
      shipping_city: 'Mérida',
      shipping_country_code: 'MX',
      notes: 'Entregar por la tarde',
      terms: ''
    })
  })

  it('reinicia fecha, entrega, vencimiento y referencia', () => {
    const header = duplicateOrderHeader(source, '2026-11-24')
    expect(header.order_date).toBe('2026-11-24')
    expect(header.delivery_date).toBe('')
    expect(header.payment_due_date).toBe('')
    expect(header.reference).toBe('')
  })
})
