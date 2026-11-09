/**
 * Importación masiva CSV: parseo y validación puros (sin Supabase).
 * Documentado en docs/csv-import.md.
 */

export type ProductImportType = 'product' | 'service' | 'others'

export interface ProductImportRow {
  name: string
  sku: string | null
  product_type: ProductImportType
  sale_price: number
  cost_price: number
  currency: string
  stock_quantity: number
  description: string | null
}

export interface RowError {
  /** Número de fila tal como la ve el usuario en su hoja (la cabecera es la 1). */
  line: number
  message: string
}

export interface ImportValidation<T> {
  valid: { line: number; data: T }[]
  errors: RowError[]
}

/** Parsea CSV (RFC 4180): comillas, comillas escapadas, saltos de línea dentro de campos y BOM. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const sep = delimiter ?? detectDelimiter(src)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += ch
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }

  return rows.filter(r => r.some(c => c.trim() !== ''))
}

/** Excel en español exporta con `;`; se detecta por la primera línea. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [',', ';', '\t'].map(d => ({ d, n: first.split(d).length - 1 }))
  counts.sort((a, b) => b.n - a.n)
  return counts[0]!.n > 0 ? counts[0]!.d : ','
}

function normalizeHeader(h: string): string {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

const PRODUCT_HEADERS: Record<string, keyof ProductImportRow> = {
  name: 'name', nombre: 'name', producto: 'name',
  sku: 'sku', codigo: 'sku',
  product_type: 'product_type', tipo: 'product_type',
  sale_price: 'sale_price', precio: 'sale_price', precio_venta: 'sale_price',
  cost_price: 'cost_price', costo: 'cost_price',
  currency: 'currency', moneda: 'currency',
  stock_quantity: 'stock_quantity', stock: 'stock_quantity', existencia: 'stock_quantity',
  description: 'description', descripcion: 'description'
}

const TYPE_ALIASES: Record<string, ProductImportType> = {
  product: 'product', producto: 'product',
  service: 'service', servicio: 'service',
  others: 'others', other: 'others', otro: 'others', otros: 'others'
}

/** Acepta "1,234.50", "1234,5" y "$ 99". Devuelve null si no es un número. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/[$\s]/g, '')
  if (s === '') return null
  const normalized = s.includes(',') && !s.includes('.')
    ? s.replace(',', '.')
    : s.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

export const PRODUCT_CSV_TEMPLATE
  = 'nombre,sku,tipo,precio,costo,moneda,stock,descripcion\nCamiseta azul,CAM-001,producto,199.90,90,MXN,25,Camiseta de algodón\n'

/** Valida filas de producto. `existingSkus` evita duplicar SKU ya registrados. */
export function validateProductRows(
  rows: string[][],
  existingSkus: Iterable<string> = []
): ImportValidation<ProductImportRow> & { missingColumns: string[] } {
  const result: ImportValidation<ProductImportRow> & { missingColumns: string[] } = {
    valid: [], errors: [], missingColumns: []
  }
  const [header, ...body] = rows
  if (!header) return { ...result, missingColumns: ['name'] }

  const index = new Map<keyof ProductImportRow, number>()
  header.forEach((h, i) => {
    const key = PRODUCT_HEADERS[normalizeHeader(h)]
    if (key && !index.has(key)) index.set(key, i)
  })
  if (!index.has('name')) return { ...result, missingColumns: ['nombre'] }

  const seen = new Set([...existingSkus].map(s => s.trim().toLowerCase()))
  const cell = (r: string[], k: keyof ProductImportRow) => (r[index.get(k) ?? -1] ?? '').trim()

  body.forEach((r, i) => {
    const line = i + 2
    const problems: string[] = []

    const name = cell(r, 'name')
    if (!name) problems.push('El nombre es obligatorio')

    const sku = cell(r, 'sku')
    if (sku) {
      if (seen.has(sku.toLowerCase())) problems.push(`El SKU «${sku}» está repetido o ya existe`)
    }

    const typeRaw = cell(r, 'product_type')
    const type = typeRaw ? TYPE_ALIASES[normalizeHeader(typeRaw)] : 'product'
    if (!type) problems.push(`Tipo «${typeRaw}» no válido (usa producto, servicio u otro)`)

    const num = (k: 'sale_price' | 'cost_price' | 'stock_quantity', label: string): number => {
      const raw = cell(r, k)
      if (raw === '') return 0
      const n = parseNumber(raw)
      if (n === null || n < 0) { problems.push(`${label} «${raw}» no es un número válido`); return 0 }
      return n
    }
    const sale_price = num('sale_price', 'Precio')
    const cost_price = num('cost_price', 'Costo')
    const stock_quantity = num('stock_quantity', 'Stock')

    const currency = (cell(r, 'currency') || 'MXN').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) problems.push(`Moneda «${currency}» no válida (3 letras, ej. MXN)`)

    if (problems.length) {
      result.errors.push({ line, message: problems.join('; ') })
      return
    }
    if (sku) seen.add(sku.toLowerCase())
    result.valid.push({
      line,
      data: {
        name, sku: sku || null, product_type: type!, sale_price, cost_price, currency,
        stock_quantity, description: cell(r, 'description') || null
      }
    })
  })

  return result
}
