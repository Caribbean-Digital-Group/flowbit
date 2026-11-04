/**
 * Utilidades puras del tablero principal: periodos predefinidos, periodo de
 * comparación y agrupación de la serie (día / semana / mes) según la
 * longitud del rango. Todas las fechas viajan como `YYYY-MM-DD` en hora local.
 */

export type DashboardPreset =
  | 'this_month'
  | 'last_month'
  | 'last_30'
  | 'last_90'
  | 'this_year'
  | 'last_12m'
  | 'custom'

export interface DateRange {
  from: string
  to: string
}

export type DashboardGranularity = 'day' | 'week' | 'month'

export interface DashboardBucket {
  key: string
  /** Etiqueta corta del eje X. */
  label: string
  /** Etiqueta completa para el tooltip. */
  fullLabel: string
}

export const DASHBOARD_PRESETS: { value: DashboardPreset; label: string }[] = [
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'last_30', label: '30 días' },
  { value: 'last_90', label: '90 días' },
  { value: 'this_year', label: 'Este año' },
  { value: 'last_12m', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' }
]

export const isDashboardPreset = (value: unknown): value is DashboardPreset =>
  typeof value === 'string' && DASHBOARD_PRESETS.some((p) => p.value === value)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(parseIsoDate(value).getTime())

export const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** `YYYY-MM-DD` → Date a medianoche local (evita el corrimiento de UTC). */
export const parseIsoDate = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/**
 * Normaliza una fecha o timestamp a `YYYY-MM-DD` local. Las fechas puras se
 * respetan tal cual; los timestamps se convierten a la zona del navegador.
 */
export const toLocalDateKey = (value: string | null | undefined): string | null => {
  if (!value) return null
  if (ISO_DATE.test(value)) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : toIsoDate(d)
}

const addDays = (d: Date, days: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate()

/** Días entre dos fechas ISO (b − a), ignorando horario de verano. */
export const diffDays = (a: string, b: string): number => {
  const da = parseIsoDate(a)
  const db = parseIsoDate(b)
  return Math.round(
    (Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
      Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86_400_000
  )
}

/** Número de días del rango, ambos extremos incluidos. */
export const rangeLength = (range: DateRange): number => diffDays(range.from, range.to) + 1

export const isInRange = (dateKey: string | null, range: DateRange): boolean =>
  dateKey !== null && dateKey >= range.from && dateKey <= range.to

export const presetRange = (preset: DashboardPreset, now = new Date()): DateRange => {
  const today = toIsoDate(now)
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case 'last_month':
      return { from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) }
    case 'last_30':
      return { from: toIsoDate(addDays(now, -29)), to: today }
    case 'last_90':
      return { from: toIsoDate(addDays(now, -89)), to: today }
    case 'this_year':
      return { from: toIsoDate(new Date(y, 0, 1)), to: today }
    case 'last_12m':
      return { from: toIsoDate(new Date(y, m - 11, 1)), to: today }
    case 'this_month':
    case 'custom':
    default:
      return { from: toIsoDate(new Date(y, m, 1)), to: today }
  }
}

/**
 * Periodo contra el que se compara. Los periodos de calendario se comparan
 * con el mismo tramo del periodo anterior (1–4 nov ↔ 1–4 oct; año en curso ↔
 * mismo tramo del año pasado); el resto, con un rango de igual longitud
 * inmediatamente anterior.
 */
export const previousRange = (preset: DashboardPreset, range: DateRange): DateRange => {
  const from = parseIsoDate(range.from)
  const to = parseIsoDate(range.to)

  if (preset === 'this_month' || preset === 'last_month') {
    const py = from.getMonth() === 0 ? from.getFullYear() - 1 : from.getFullYear()
    const pm = (from.getMonth() + 11) % 12
    const lastDay = daysInMonth(py, pm)
    const endDay = preset === 'last_month' ? lastDay : Math.min(to.getDate(), lastDay)
    return { from: toIsoDate(new Date(py, pm, 1)), to: toIsoDate(new Date(py, pm, endDay)) }
  }

  if (preset === 'this_year') {
    const py = from.getFullYear() - 1
    const endDay = Math.min(to.getDate(), daysInMonth(py, to.getMonth()))
    return { from: toIsoDate(new Date(py, 0, 1)), to: toIsoDate(new Date(py, to.getMonth(), endDay)) }
  }

  if (preset === 'last_12m') {
    return {
      from: toIsoDate(new Date(from.getFullYear() - 1, from.getMonth(), 1)),
      to: toIsoDate(addDays(from, -1))
    }
  }

  const length = rangeLength(range)
  return { from: toIsoDate(addDays(from, -length)), to: toIsoDate(addDays(from, -1)) }
}

/** Día hasta 31 días, semana hasta ~3 meses, mes a partir de ahí. */
export const granularityFor = (range: DateRange): DashboardGranularity => {
  const length = rangeLength(range)
  if (length <= 31) return 'day'
  if (length <= 92) return 'week'
  return 'month'
}

const shortDate = (d: Date): string =>
  d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace(/\./g, '')

const monthLabel = (d: Date): string =>
  `${d.toLocaleDateString('es-MX', { month: 'short' }).replace(/\./g, '').slice(0, 3).toUpperCase()} ${String(d.getFullYear()).slice(2)}`

/** Clave del bucket al que pertenece una fecha (o null si queda fuera del rango). */
export const bucketKeyFor = (
  dateKey: string | null,
  range: DateRange,
  granularity: DashboardGranularity
): string | null => {
  if (!isInRange(dateKey, range) || dateKey === null) return null
  if (granularity === 'day') return dateKey
  if (granularity === 'month') return dateKey.slice(0, 7)
  return `w${Math.floor(diffDays(range.from, dateKey) / 7)}`
}

export const buildBuckets = (range: DateRange, granularity: DashboardGranularity): DashboardBucket[] => {
  const buckets: DashboardBucket[] = []
  const start = parseIsoDate(range.from)
  const end = parseIsoDate(range.to)
  const longDate = (d: Date) =>
    d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

  if (granularity === 'day') {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      buckets.push({ key: toIsoDate(d), label: shortDate(d), fullLabel: longDate(d) })
    }
    return buckets
  }

  if (granularity === 'week') {
    let index = 0
    for (let d = start; d <= end; d = addDays(d, 7), index++) {
      const weekEnd = addDays(d, 6) > end ? end : addDays(d, 6)
      buckets.push({
        key: `w${index}`,
        label: shortDate(d),
        fullLabel: `Semana del ${shortDate(d)} al ${shortDate(weekEnd)}`
      })
    }
    return buckets
  }

  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    buckets.push({
      key: toIsoDate(d).slice(0, 7),
      label: monthLabel(d),
      fullLabel: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    })
  }
  return buckets
}

/** «1 – 4 nov 2026», «1 oct 2025 – 4 nov 2026». */
export const formatRangeLabel = (range: DateRange): string => {
  const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  return fmt.formatRange(parseIsoDate(range.from), parseIsoDate(range.to)).replace(/\./g, '')
}
