import { describe, expect, it } from 'vitest'
import { computeOrderLineAmounts, roundMoney } from '../../app/utils/orderMath'

describe('roundMoney', () => {
  it('redondea a 2 decimales', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(2.344)).toBe(2.34)
  })
})

describe('computeOrderLineAmounts', () => {
  it('suma el impuesto encima cuando el precio no lo incluye', () => {
    const r = computeOrderLineAmounts({ quantity: 2, unitPrice: 100, discountPercent: 0, taxRate: 16 })
    expect(r).toMatchObject({ discount: 0, subtotal: 200, tax: 32, total: 232 })
  })

  it('desglosa el impuesto cuando el precio ya lo incluye', () => {
    const r = computeOrderLineAmounts({ quantity: 1, unitPrice: 116, discountPercent: 0, taxRate: 16, priceIncludesTax: true })
    expect(r).toMatchObject({ subtotal: 100, tax: 16, total: 116 })
  })

  it('aplica el descuento antes del impuesto', () => {
    const r = computeOrderLineAmounts({ quantity: 1, unitPrice: 200, discountPercent: 10, taxRate: 16 })
    expect(r).toMatchObject({ discount: 20, subtotal: 180, tax: 28.8, total: 208.8 })
  })

  it('calcula margen y porcentaje de margen', () => {
    const r = computeOrderLineAmounts({ quantity: 2, unitPrice: 100, discountPercent: 0, taxRate: 0, unitCost: 60 })
    expect(r.margin).toBe(80)
    expect(r.marginPercent).toBe(40)
  })

  it('tolera entradas inválidas sin producir NaN', () => {
    const r = computeOrderLineAmounts({ quantity: NaN, unitPrice: 10, discountPercent: 0, taxRate: 16 })
    expect(r.total).toBe(0)
    expect(r.marginPercent).toBe(0)
  })
})
