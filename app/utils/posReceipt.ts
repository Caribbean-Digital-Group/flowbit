/**
 * Ticket de venta del POS en HTML imprimible (80 mm).
 *
 * Función pura: recibe los datos ya capturados y devuelve el documento. Todo
 * texto que viene de usuarios pasa por `escapeHtml` porque el ticket se abre en
 * una ventana del mismo origen que el panel (ver `app/utils/html.ts`).
 */
import { escapeHtml, safeImageUrl } from './html'
import { computeOrderLineAmounts } from './orderMath'

export interface ReceiptLine {
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  tax_rate: number
  price_include_tax?: boolean
}

export interface ReceiptPayment {
  method_name: string
  is_cash: boolean
  amount: number
  tendered: number | null
}

export interface ReceiptTotals {
  subtotal: number
  discount: number
  tax: number
  total: number
}

export interface ReceiptCompany {
  name?: string | null
  description?: string | null
  logo_url?: string | null
}

export interface ReceiptParams {
  orderName: string
  lines: ReceiptLine[]
  payments: ReceiptPayment[]
  totals: ReceiptTotals
  customer: string
  cashier: string
  change: number
  company: ReceiptCompany | null | undefined
  /** Fecha impresa; por defecto, ahora. */
  date?: Date
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0)

const row = (label: string, value: string, className = ''): string =>
  `<tr${className ? ` class="${className}"` : ''}><td>${label}</td><td style="text-align:right">${value}</td></tr>`

export const buildReceiptHtml = (params: ReceiptParams): string => {
  const company = params.company?.name || 'Flowbit'
  const companyDesc = params.company?.description || ''
  const logoUrl = safeImageUrl(params.company?.logo_url)
  const logoInitial = (company[0] || 'F').toUpperCase()

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${escapeHtml(company)}" style="display:block;width:80px;height:80px;object-fit:contain;border-radius:6px;margin:0 auto 6px" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:#2563eb;color:#fff;font-size:24px;font-weight:800;line-height:64px;text-align:center;margin:0 auto 6px;font-family:sans-serif">${escapeHtml(logoInitial)}</div>`

  const rows = params.lines.map((l) => {
    const { total } = computeOrderLineAmounts({
      quantity: l.quantity,
      unitPrice: l.unit_price,
      discountPercent: l.discount_percent,
      taxRate: l.tax_rate,
      priceIncludesTax: l.price_include_tax === true
    })
    const discount = l.discount_percent > 0 ? ` (-${escapeHtml(l.discount_percent)}%)` : ''
    return row(`${escapeHtml(l.quantity)} × ${escapeHtml(l.description)}${discount}`, formatCurrency(total))
  }).join('')

  const pays = params.payments.map((p) => {
    const base = row(escapeHtml(p.method_name), formatCurrency(p.amount))
    const received = p.is_cash && p.tendered ? row('Recibido', formatCurrency(p.tendered)) : ''
    return base + received
  }).join('')

  const date = (params.date ?? new Date()).toLocaleString('es-MX')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(params.orderName)}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 12px; color: #111; }
      h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
      p { margin: 2px 0; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      td { padding: 2px 0; vertical-align: top; }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
      .total { font-size: 16px; font-weight: bold; }
    </style></head><body>
    <div style="text-align:center;margin-bottom:8px">${logoHtml}</div>
    <h1>${escapeHtml(company)}</h1>
    <p>Ticket ${escapeHtml(params.orderName)}</p>
    <p>${escapeHtml(date)}</p>
    <p>Cliente: ${escapeHtml(params.customer)}</p>
    <p>Atendió: ${escapeHtml(params.cashier)}</p>
    <div class="sep"></div>
    <table>${rows}</table>
    <div class="sep"></div>
    <table>
      ${row('Subtotal', formatCurrency(params.totals.subtotal))}
      ${params.totals.discount > 0 ? row('Descuento', `-${formatCurrency(params.totals.discount)}`) : ''}
      ${row('Impuestos', formatCurrency(params.totals.tax))}
      ${row('TOTAL', formatCurrency(params.totals.total), 'total')}
    </table>
    <div class="sep"></div>
    <table>${pays}
      ${params.change > 0 ? row('CAMBIO', formatCurrency(params.change), 'total') : ''}
    </table>
    <div class="sep"></div>
    ${companyDesc ? `<p style="font-size:10px;color:#333;white-space:pre-line;margin:4px 0 8px;text-align:center">${escapeHtml(companyDesc)}</p>` : ''}
    <p>¡Gracias por su compra!</p>
    </body></html>`
}
