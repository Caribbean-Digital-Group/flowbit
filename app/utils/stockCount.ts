/**
 * Conteo físico de inventario (TRY-42): cálculo puro de diferencias.
 *
 * La regla vive también en `apply_stock_count` (migración
 * `20261118120000_create_stock_count`). Aquí se replica para mostrar al usuario,
 * antes de aplicar, exactamente lo que hará la base:
 *
 *   diferencia = contado − esperado (congelado al iniciar el conteo)
 *   ajuste     = diferencia, salvo que la existencia actual del almacén no
 *                alcance para la salida: entonces se ajusta hasta cero.
 *
 * Documentado en `docs/inventory.md` («Conteo físico»).
 */

export type StockCountStatus = 'in_progress' | 'applied' | 'cancelled'

export const STOCK_COUNT_STATUS_LABELS: Record<StockCountStatus, string> = {
  in_progress: 'En curso',
  applied: 'Aplicado',
  cancelled: 'Cancelado'
}

export type CountLineState = 'pending' | 'match' | 'surplus' | 'shortage'

export const COUNT_LINE_STATE_LABELS: Record<CountLineState, string> = {
  pending: 'Sin contar',
  match: 'Cuadra',
  surplus: 'Sobrante',
  shortage: 'Faltante'
}

export interface CountLineInput {
  expectedQuantity: number
  countedQuantity: number | null
  unitCost: number
}

export interface CountLineResult {
  state: CountLineState
  /** contado − esperado; null si no se ha contado. */
  difference: number | null
  /** diferencia × costo congelado. */
  differenceValue: number | null
}

/** Redondeo a 3 decimales, igual que DECIMAL(15, 3) en la base. */
const round3 = (value: number): number => Math.round(value * 1000) / 1000

const round2 = (value: number): number => Math.round(value * 100) / 100

const EPSILON = 0.0005

/** Estado y diferencia de una línea, contra la existencia congelada al iniciar. */
export const evaluateCountLine = (line: CountLineInput): CountLineResult => {
  if (line.countedQuantity === null || line.countedQuantity === undefined) {
    return { state: 'pending', difference: null, differenceValue: null }
  }

  const difference = round3(line.countedQuantity - line.expectedQuantity)
  const state: CountLineState = Math.abs(difference) < EPSILON
    ? 'match'
    : difference > 0 ? 'surplus' : 'shortage'

  return {
    state,
    difference: state === 'match' ? 0 : difference,
    differenceValue: state === 'match' ? 0 : round2(difference * (line.unitCost || 0))
  }
}

/**
 * Ajuste que escribirá la base. Si el faltante es mayor que lo que hay hoy en
 * el almacén (por ejemplo, se vendió durante el conteo), se ajusta solo hasta
 * dejar el almacén en cero: nunca en negativo.
 */
export const computeAdjustment = (difference: number, currentQuantity: number): { adjustment: number; clamped: boolean } => {
  if (difference >= 0) return { adjustment: round3(difference), clamped: false }

  const current = Math.max(currentQuantity, 0)
  if (current + difference < 0) {
    return { adjustment: current === 0 ? 0 : -round3(current), clamped: true }
  }
  return { adjustment: round3(difference), clamped: false }
}

export interface CountSummary {
  totalLines: number
  countedLines: number
  pendingLines: number
  matchLines: number
  surplusLines: number
  shortageLines: number
  /** Unidades sobrantes (positivo). */
  surplusUnits: number
  /** Unidades faltantes (positivo). */
  shortageUnits: number
  surplusValue: number
  shortageValue: number
  /** Efecto neto en el valor del inventario (sobrante − faltante). */
  netValue: number
  /** 0–100, porcentaje de líneas capturadas. */
  progress: number
}

/**
 * Resumen del conteo. Con `uncountedAsZero`, las líneas sin capturar se tratan
 * como contadas en 0 (así lo hará la base si el usuario lo elige al aplicar).
 */
export const summarizeCount = (lines: CountLineInput[], uncountedAsZero = false): CountSummary => {
  const summary: CountSummary = {
    totalLines: lines.length,
    countedLines: 0,
    pendingLines: 0,
    matchLines: 0,
    surplusLines: 0,
    shortageLines: 0,
    surplusUnits: 0,
    shortageUnits: 0,
    surplusValue: 0,
    shortageValue: 0,
    netValue: 0,
    progress: 0
  }

  for (const line of lines) {
    const isPending = line.countedQuantity === null || line.countedQuantity === undefined
    if (isPending) summary.pendingLines += 1
    else summary.countedLines += 1

    const effective = isPending && uncountedAsZero ? { ...line, countedQuantity: 0 } : line
    const result = evaluateCountLine(effective)

    if (result.state === 'match') summary.matchLines += 1
    if (result.state === 'surplus') {
      summary.surplusLines += 1
      summary.surplusUnits += result.difference ?? 0
      summary.surplusValue += result.differenceValue ?? 0
    }
    if (result.state === 'shortage') {
      summary.shortageLines += 1
      summary.shortageUnits += Math.abs(result.difference ?? 0)
      summary.shortageValue += Math.abs(result.differenceValue ?? 0)
    }
  }

  summary.surplusUnits = round3(summary.surplusUnits)
  summary.shortageUnits = round3(summary.shortageUnits)
  summary.surplusValue = round2(summary.surplusValue)
  summary.shortageValue = round2(summary.shortageValue)
  summary.netValue = round2(summary.surplusValue - summary.shortageValue)
  summary.progress = lines.length === 0 ? 0 : Math.round((summary.countedLines / lines.length) * 100)

  return summary
}

export interface SearchableCountLine {
  name: string
  sku: string | null
  barcode: string | null
}

/**
 * Busca una línea por código exacto (código de barras o SKU, sin distinguir
 * mayúsculas). Sirve para lectores que «teclean» el código y Enter.
 */
export const findLineByCode = <T extends SearchableCountLine>(lines: T[], code: string): T | null => {
  const needle = code.trim().toLowerCase()
  if (!needle) return null
  return lines.find((line) => line.barcode?.trim().toLowerCase() === needle)
    ?? lines.find((line) => line.sku?.trim().toLowerCase() === needle)
    ?? null
}

/** Filtro de texto libre por nombre, SKU o código de barras. */
export const matchesCountSearch = (line: SearchableCountLine, term: string): boolean => {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return [line.name, line.sku, line.barcode]
    .some((value) => value?.toLowerCase().includes(needle))
}
