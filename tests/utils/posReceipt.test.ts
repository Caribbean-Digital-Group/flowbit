import { describe, expect, it } from 'vitest'
import { buildReceiptHtml, type ReceiptParams } from '../../app/utils/posReceipt'

const XSS = '<img src=x onerror=alert(1)>'

const baseParams = (overrides: Partial<ReceiptParams> = {}): ReceiptParams => ({
  orderName: 'SO-0001',
  lines: [
    { description: 'Café americano', quantity: 2, unit_price: 50, discount_percent: 0, tax_rate: 16, price_include_tax: true }
  ],
  payments: [
    { method_name: 'Efectivo', is_cash: true, amount: 100, tendered: 200 }
  ],
  totals: { subtotal: 86.21, discount: 0, tax: 13.79, total: 100 },
  customer: 'Público general',
  cashier: 'Ana López',
  change: 100,
  company: { name: 'Cafetería Sol', description: 'Gracias por visitarnos', logo_url: null },
  date: new Date(2026, 10, 22, 10, 30),
  ...overrides
})

describe('buildReceiptHtml', () => {
  it('incluye folio, empresa, cliente, cajero, líneas, pagos y cambio', () => {
    const html = buildReceiptHtml(baseParams())
    expect(html).toContain('Ticket SO-0001')
    expect(html).toContain('<h1>Cafetería Sol</h1>')
    expect(html).toContain('Cliente: Público general')
    expect(html).toContain('Atendió: Ana López')
    expect(html).toContain('2 × Café americano')
    expect(html).toContain('Recibido')
    expect(html).toContain('CAMBIO')
    expect(html).toContain('Gracias por visitarnos')
  })

  it('usa la inicial de la empresa cuando no hay logo', () => {
    const html = buildReceiptHtml(baseParams())
    expect(html).not.toContain('<img')
    expect(html).toMatch(/>C<\/div>/)
  })

  it('muestra el descuento por línea y en totales', () => {
    const html = buildReceiptHtml(baseParams({
      lines: [{ description: 'Pan', quantity: 1, unit_price: 100, discount_percent: 10, tax_rate: 0 }],
      totals: { subtotal: 90, discount: 10, tax: 0, total: 90 },
      payments: [{ method_name: 'Tarjeta', is_cash: false, amount: 90, tendered: null }],
      change: 0
    }))
    expect(html).toContain('1 × Pan (-10%)')
    expect(html).toContain('Descuento')
    expect(html).not.toContain('CAMBIO')
    expect(html).not.toContain('Recibido')
  })

  it('escapa todo texto capturado por usuarios (XSS almacenado)', () => {
    const html = buildReceiptHtml(baseParams({
      orderName: XSS,
      customer: XSS,
      cashier: XSS,
      lines: [{ description: XSS, quantity: 1, unit_price: 10, discount_percent: 0, tax_rate: 0 }],
      payments: [{ method_name: XSS, is_cash: false, amount: 10, tendered: null }],
      company: { name: XSS, description: XSS, logo_url: null }
    }))
    expect(html).not.toContain('<img')
    expect(html).not.toContain('onerror=alert(1)>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('ignora logos con esquemas peligrosos y escapa los válidos', () => {
    const bad = buildReceiptHtml(baseParams({ company: { name: 'Sol', logo_url: 'javascript:alert(1)' } }))
    expect(bad).not.toContain('javascript:')
    expect(bad).not.toContain('<img')

    const quoted = buildReceiptHtml(baseParams({ company: { name: 'Sol', logo_url: 'https://x.com/l.png" onload="alert(1)' } }))
    expect(quoted).toContain('src="https://x.com/l.png&quot; onload=&quot;alert(1)"')
  })

  it('usa «Flowbit» si no hay empresa seleccionada', () => {
    const html = buildReceiptHtml(baseParams({ company: null }))
    expect(html).toContain('<h1>Flowbit</h1>')
  })
})
