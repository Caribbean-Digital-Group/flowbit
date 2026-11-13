/**
 * Serialización CSV segura para exportaciones del panel.
 *
 * - Escapa según RFC 4180: toda celda con coma, comillas o salto de línea va
 *   entre comillas y las comillas internas se duplican.
 * - Neutraliza la inyección de fórmulas (OWASP «CSV Injection»): un texto que
 *   empieza con `=`, `+`, `-`, `@`, tabulador o retorno de carro se antepone con
 *   un apóstrofo para que Excel / Google Sheets lo traten como texto.
 *   Los números (y los textos que son un número válido, como `-12.5`) no se alteran.
 * - Booleanos como «Sí» / «No», fechas en ISO y objetos como JSON.
 */

export type CsvCell = string | number | boolean | Date | null | undefined | object

/** BOM UTF-8: hace que Excel abra correctamente los acentos. */
export const CSV_BOM = '﻿'

const FORMULA_PREFIX = /^[=+\-@\t\r]/
const NUMERIC = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)([eE][+-]?\d+)?$/
const NEEDS_QUOTES = /[",\r\n]/

/** Convierte cualquier valor en el texto que irá en la celda (sin escapar). */
export const stringifyCsvValue = (value: CsvCell): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (Array.isArray(value)) return value.map(v => stringifyCsvValue(v as CsvCell)).join(', ')
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

/** Escapa una celda: neutraliza fórmulas y aplica comillas RFC 4180. */
export const escapeCsvCell = (value: CsvCell): string => {
  let text = stringifyCsvValue(value)

  if (typeof value !== 'number' && FORMULA_PREFIX.test(text) && !NUMERIC.test(text.trim())) {
    text = `'${text}`
  }

  if (NEEDS_QUOTES.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`
  }

  return text
}

/** Arma el contenido CSV completo (sin BOM). Las filas se separan con CRLF. */
export const buildCsv = (headers: string[], rows: CsvCell[][]): string => {
  return [headers, ...rows]
    .map(row => row.map(escapeCsvCell).join(','))
    .join('\r\n')
}

/**
 * Descarga un CSV en el navegador (con BOM UTF-8). Solo cliente.
 * `filename` sin extensión o con `.csv`.
 */
export const downloadCsv = (filename: string, headers: string[], rows: CsvCell[][]): void => {
  const content = CSV_BOM + buildCsv(headers, rows)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
