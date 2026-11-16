import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  DASHBOARD_PRESETS,
  buildBuckets,
  bucketKeyFor,
  diffDays,
  formatRangeLabel,
  granularityFor,
  isDashboardPreset,
  isInRange,
  isIsoDate,
  parseIsoDate,
  presetRange,
  previousRange,
  rangeLength,
  toIsoDate,
  toLocalDateKey,
  type DashboardPreset,
  type DateRange
} from '../../app/utils/dashboard'

// Las utilidades trabajan en hora local: se fija una zona sin horario de verano
// (México centro desde 2022, UTC−6) para que los timestamps sean deterministas.
const originalTz = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/Mexico_City'
})
afterAll(() => {
  process.env.TZ = originalTz
})

const range = (from: string, to: string): DateRange => ({ from, to })

/** Fija «hoy» a mediodía local de la fecha dada. */
const setToday = (iso: string) => {
  vi.useFakeTimers()
  const d = parseIsoDate(iso)
  d.setHours(12, 0, 0, 0)
  vi.setSystemTime(d)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('DASHBOARD_PRESETS / isDashboardPreset', () => {
  it('expone los siete presets en orden con etiqueta en español', () => {
    expect(DASHBOARD_PRESETS.map((p) => p.value)).toEqual([
      'this_month',
      'last_month',
      'last_30',
      'last_90',
      'this_year',
      'last_12m',
      'custom'
    ])
    expect(DASHBOARD_PRESETS.find((p) => p.value === 'custom')?.label).toBe('Personalizado')
  })

  it('reconoce cada preset válido', () => {
    for (const { value } of DASHBOARD_PRESETS) expect(isDashboardPreset(value)).toBe(true)
  })

  it('rechaza valores desconocidos o de otro tipo', () => {
    expect(isDashboardPreset('this_week')).toBe(false)
    expect(isDashboardPreset('THIS_MONTH')).toBe(false)
    expect(isDashboardPreset('')).toBe(false)
    expect(isDashboardPreset(undefined)).toBe(false)
    expect(isDashboardPreset(null)).toBe(false)
    expect(isDashboardPreset(['this_month'])).toBe(false)
  })
})

describe('isIsoDate', () => {
  it('acepta fechas YYYY-MM-DD reales', () => {
    expect(isIsoDate('2026-11-15')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-12-31')).toBe(true)
  })

  it('rechaza días que no existen en el calendario', () => {
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-04-31')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-00-10')).toBe(false)
    expect(isIsoDate('2026-01-00')).toBe(false)
  })

  it('rechaza formatos distintos y valores que no son texto', () => {
    expect(isIsoDate('2026-1-5')).toBe(false)
    expect(isIsoDate('15/11/2026')).toBe(false)
    expect(isIsoDate('2026-11-15T00:00:00Z')).toBe(false)
    expect(isIsoDate(' 2026-11-15')).toBe(false)
    expect(isIsoDate('')).toBe(false)
    expect(isIsoDate(null)).toBe(false)
    expect(isIsoDate(20261115)).toBe(false)
    expect(isIsoDate(new Date(2026, 10, 15))).toBe(false)
  })
})

describe('parseIsoDate / toIsoDate', () => {
  it('interpreta la fecha a medianoche local, sin corrimiento UTC', () => {
    const d = parseIsoDate('2026-01-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(0)
  })

  it('formatea con ceros a la izquierda', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('ida y vuelta conserva la fecha', () => {
    for (const iso of ['2026-03-31', '2028-02-29', '2025-12-31', '2026-01-01']) {
      expect(toIsoDate(parseIsoDate(iso))).toBe(iso)
    }
  })
})

describe('toLocalDateKey', () => {
  it('devuelve null para vacío o nulo', () => {
    expect(toLocalDateKey(null)).toBeNull()
    expect(toLocalDateKey(undefined)).toBeNull()
    expect(toLocalDateKey('')).toBeNull()
  })

  it('respeta las fechas puras tal cual', () => {
    expect(toLocalDateKey('2026-11-15')).toBe('2026-11-15')
  })

  it('convierte timestamps a la fecha local', () => {
    // 03:00 UTC del 1 de nov = 21:00 del 31 de oct en UTC−6.
    expect(toLocalDateKey('2026-11-01T03:00:00Z')).toBe('2026-10-31')
    expect(toLocalDateKey('2026-11-01T03:00:00+00:00')).toBe('2026-10-31')
    expect(toLocalDateKey('2026-11-01T12:00:00Z')).toBe('2026-11-01')
  })

  it('aplica el desfase explícito del timestamp', () => {
    // 23:30 en UTC−8 = 07:30 UTC del día siguiente = 01:30 local (UTC−6).
    expect(toLocalDateKey('2026-12-31T23:30:00-08:00')).toBe('2027-01-01')
    // 00:30 en UTC+9 = 15:30 UTC del día anterior = 09:30 local.
    expect(toLocalDateKey('2027-01-01T00:30:00+09:00')).toBe('2026-12-31')
  })

  it('devuelve null para textos que no son fecha', () => {
    expect(toLocalDateKey('no es fecha')).toBeNull()
    expect(toLocalDateKey('2026-13-45T00:00:00Z')).toBeNull()
  })
})

describe('diffDays / rangeLength / isInRange', () => {
  it('cuenta días b − a', () => {
    expect(diffDays('2026-11-01', '2026-11-15')).toBe(14)
    expect(diffDays('2026-11-15', '2026-11-15')).toBe(0)
    expect(diffDays('2026-11-15', '2026-11-01')).toBe(-14)
  })

  it('cruza fin de año y febrero bisiesto', () => {
    expect(diffDays('2025-12-31', '2026-01-01')).toBe(1)
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2)
    expect(diffDays('2026-02-28', '2026-03-01')).toBe(1)
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365)
    expect(diffDays('2028-01-01', '2029-01-01')).toBe(366)
  })

  it('no se ve afectado por el horario de verano', () => {
    const prev = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      // Cambios de horario en EE. UU.: 8 mar y 1 nov 2026.
      expect(diffDays('2026-03-07', '2026-03-09')).toBe(2)
      expect(diffDays('2026-10-31', '2026-11-02')).toBe(2)
    } finally {
      process.env.TZ = prev
    }
  })

  it('rangeLength incluye ambos extremos', () => {
    expect(rangeLength(range('2026-11-01', '2026-11-01'))).toBe(1)
    expect(rangeLength(range('2026-11-01', '2026-11-30'))).toBe(30)
    expect(rangeLength(range('2028-01-01', '2028-12-31'))).toBe(366)
  })

  it('rangeLength de un rango invertido es cero o negativo', () => {
    expect(rangeLength(range('2026-11-02', '2026-11-01'))).toBe(0)
    expect(rangeLength(range('2026-11-10', '2026-11-01'))).toBe(-8)
  })

  it('isInRange incluye extremos y rechaza null', () => {
    const r = range('2026-11-01', '2026-11-30')
    expect(isInRange('2026-11-01', r)).toBe(true)
    expect(isInRange('2026-11-30', r)).toBe(true)
    expect(isInRange('2026-11-15', r)).toBe(true)
    expect(isInRange('2026-10-31', r)).toBe(false)
    expect(isInRange('2026-12-01', r)).toBe(false)
    expect(isInRange(null, r)).toBe(false)
  })

  it('isInRange con rango invertido nunca coincide', () => {
    const r = range('2026-11-30', '2026-11-01')
    expect(isInRange('2026-11-15', r)).toBe(false)
    expect(isInRange('2026-11-30', r)).toBe(false)
  })
})

describe('presetRange', () => {
  it('this_month: del día 1 a hoy', () => {
    setToday('2026-11-15')
    expect(presetRange('this_month')).toEqual(range('2026-11-01', '2026-11-15'))
  })

  it('custom cae al mes en curso', () => {
    setToday('2026-11-15')
    expect(presetRange('custom')).toEqual(range('2026-11-01', '2026-11-15'))
  })

  it('un preset desconocido cae al mes en curso', () => {
    setToday('2026-11-15')
    expect(presetRange('bogus' as DashboardPreset)).toEqual(range('2026-11-01', '2026-11-15'))
  })

  it('last_month: mes calendario completo anterior', () => {
    setToday('2026-11-15')
    expect(presetRange('last_month')).toEqual(range('2026-10-01', '2026-10-31'))
  })

  it('last_month desde el 31 de marzo es febrero completo (no desborda)', () => {
    setToday('2026-03-31')
    expect(presetRange('last_month')).toEqual(range('2026-02-01', '2026-02-28'))
  })

  it('last_month en año bisiesto incluye el 29 de febrero', () => {
    setToday('2028-03-31')
    expect(presetRange('last_month')).toEqual(range('2028-02-01', '2028-02-29'))
  })

  it('last_month en enero es diciembre del año anterior', () => {
    setToday('2027-01-10')
    expect(presetRange('last_month')).toEqual(range('2026-12-01', '2026-12-31'))
  })

  it('last_30 y last_90 terminan hoy e incluyen 30 / 90 días', () => {
    setToday('2026-11-15')
    const r30 = presetRange('last_30')
    const r90 = presetRange('last_90')
    expect(r30).toEqual(range('2026-10-17', '2026-11-15'))
    expect(r90).toEqual(range('2026-08-18', '2026-11-15'))
    expect(rangeLength(r30)).toBe(30)
    expect(rangeLength(r90)).toBe(90)
  })

  it('last_30 cruza el fin de año y febrero bisiesto', () => {
    setToday('2027-01-10')
    expect(presetRange('last_30')).toEqual(range('2026-12-12', '2027-01-10'))
    setToday('2028-03-10')
    expect(presetRange('last_30')).toEqual(range('2028-02-10', '2028-03-10'))
  })

  it('this_year: del 1 de enero a hoy', () => {
    setToday('2026-11-15')
    expect(presetRange('this_year')).toEqual(range('2026-01-01', '2026-11-15'))
    setToday('2027-01-01')
    expect(presetRange('this_year')).toEqual(range('2027-01-01', '2027-01-01'))
  })

  it('last_12m: desde el día 1 de hace 11 meses hasta hoy', () => {
    setToday('2026-11-15')
    expect(presetRange('last_12m')).toEqual(range('2025-12-01', '2026-11-15'))
    setToday('2026-03-31')
    expect(presetRange('last_12m')).toEqual(range('2025-04-01', '2026-03-31'))
  })

  it('acepta un `now` explícito sin depender del reloj', () => {
    expect(presetRange('this_month', new Date(2026, 1, 3, 23, 59))).toEqual(range('2026-02-01', '2026-02-03'))
    expect(presetRange('last_month', new Date(2026, 0, 1, 0, 0))).toEqual(range('2025-12-01', '2025-12-31'))
  })
})

describe('previousRange', () => {
  it('this_month se compara con el mismo tramo del mes anterior', () => {
    expect(previousRange('this_month', range('2026-11-01', '2026-11-04'))).toEqual(
      range('2026-10-01', '2026-10-04')
    )
  })

  it('this_month el 31 de marzo se recorta al último día de febrero', () => {
    expect(previousRange('this_month', range('2026-03-01', '2026-03-31'))).toEqual(
      range('2026-02-01', '2026-02-28')
    )
    expect(previousRange('this_month', range('2028-03-01', '2028-03-30'))).toEqual(
      range('2028-02-01', '2028-02-29')
    )
  })

  it('this_month en enero se compara con diciembre del año anterior', () => {
    expect(previousRange('this_month', range('2027-01-01', '2027-01-10'))).toEqual(
      range('2026-12-01', '2026-12-10')
    )
  })

  it('last_month se compara con el mes completo anterior', () => {
    expect(previousRange('last_month', range('2026-03-01', '2026-03-31'))).toEqual(
      range('2026-02-01', '2026-02-28')
    )
    expect(previousRange('last_month', range('2028-02-01', '2028-02-29'))).toEqual(
      range('2028-01-01', '2028-01-31')
    )
    // Febrero es más corto, pero el mes anterior (enero) se toma completo.
    expect(previousRange('last_month', range('2026-02-01', '2026-02-28'))).toEqual(
      range('2026-01-01', '2026-01-31')
    )
    expect(previousRange('last_month', range('2026-01-01', '2026-01-31'))).toEqual(
      range('2025-12-01', '2025-12-31')
    )
  })

  it('this_year se compara con el mismo tramo del año pasado', () => {
    expect(previousRange('this_year', range('2026-01-01', '2026-11-04'))).toEqual(
      range('2025-01-01', '2025-11-04')
    )
  })

  it('this_year el 29 de febrero bisiesto se recorta al 28', () => {
    expect(previousRange('this_year', range('2028-01-01', '2028-02-29'))).toEqual(
      range('2027-01-01', '2027-02-28')
    )
  })

  it('last_12m se compara con los 12 meses que terminan el día anterior', () => {
    expect(previousRange('last_12m', range('2025-12-01', '2026-11-15'))).toEqual(
      range('2024-12-01', '2025-11-30')
    )
  })

  it('last_30 / last_90 / custom usan un rango de igual longitud inmediatamente anterior', () => {
    const r30 = range('2026-10-17', '2026-11-15')
    expect(previousRange('last_30', r30)).toEqual(range('2026-09-17', '2026-10-16'))

    const r90 = range('2026-08-18', '2026-11-15')
    const p90 = previousRange('last_90', r90)
    expect(p90).toEqual(range('2026-05-20', '2026-08-17'))
    expect(rangeLength(p90)).toBe(90)

    expect(previousRange('custom', range('2026-11-10', '2026-11-12'))).toEqual(
      range('2026-11-07', '2026-11-09')
    )
  })

  it('custom de un solo día se compara con el día anterior, cruzando el año', () => {
    expect(previousRange('custom', range('2027-01-01', '2027-01-01'))).toEqual(
      range('2026-12-31', '2026-12-31')
    )
  })

  it('custom cruzando febrero bisiesto conserva la longitud', () => {
    const r = range('2028-03-01', '2028-03-10')
    const p = previousRange('custom', r)
    expect(p).toEqual(range('2028-02-20', '2028-02-29'))
    expect(rangeLength(p)).toBe(rangeLength(r))
  })

  it('el periodo anterior siempre termina el día previo al inicio', () => {
    const cases: [DashboardPreset, DateRange][] = [
      ['last_30', range('2026-10-17', '2026-11-15')],
      ['last_90', range('2026-08-18', '2026-11-15')],
      ['last_12m', range('2025-12-01', '2026-11-15')],
      ['custom', range('2026-01-15', '2026-02-20')]
    ]
    for (const [preset, r] of cases) {
      expect(diffDays(previousRange(preset, r).to, r.from)).toBe(1)
    }
  })
})

describe('granularityFor', () => {
  it('día hasta 31 días', () => {
    expect(granularityFor(range('2026-11-01', '2026-11-01'))).toBe('day')
    expect(granularityFor(range('2026-10-01', '2026-10-31'))).toBe('day')
  })

  it('semana de 32 a 92 días', () => {
    expect(granularityFor(range('2026-10-01', '2026-11-01'))).toBe('week')
    expect(granularityFor(range('2026-08-18', '2026-11-15'))).toBe('week') // 90 días
    expect(granularityFor(range('2026-08-01', '2026-10-31'))).toBe('week') // 92 días
  })

  it('mes a partir de 93 días', () => {
    expect(granularityFor(range('2026-08-01', '2026-11-01'))).toBe('month') // 93 días
    expect(granularityFor(range('2026-01-01', '2026-11-15'))).toBe('month')
  })

  it('un rango invertido cae en día', () => {
    expect(granularityFor(range('2026-11-30', '2026-11-01'))).toBe('day')
  })
})

describe('bucketKeyFor', () => {
  const r = range('2026-11-01', '2026-11-30')

  it('devuelve null fuera del rango o sin fecha', () => {
    expect(bucketKeyFor(null, r, 'day')).toBeNull()
    expect(bucketKeyFor('2026-10-31', r, 'day')).toBeNull()
    expect(bucketKeyFor('2026-12-01', r, 'week')).toBeNull()
    expect(bucketKeyFor('2026-12-01', r, 'month')).toBeNull()
  })

  it('día: la propia fecha', () => {
    expect(bucketKeyFor('2026-11-15', r, 'day')).toBe('2026-11-15')
  })

  it('mes: YYYY-MM', () => {
    const year = range('2026-01-01', '2026-11-15')
    expect(bucketKeyFor('2026-02-28', year, 'month')).toBe('2026-02')
    expect(bucketKeyFor('2026-11-15', year, 'month')).toBe('2026-11')
  })

  it('semana: bloques de 7 días contados desde el inicio del rango', () => {
    expect(bucketKeyFor('2026-11-01', r, 'week')).toBe('w0')
    expect(bucketKeyFor('2026-11-07', r, 'week')).toBe('w0')
    expect(bucketKeyFor('2026-11-08', r, 'week')).toBe('w1')
    expect(bucketKeyFor('2026-11-29', r, 'week')).toBe('w4')
    expect(bucketKeyFor('2026-11-30', r, 'week')).toBe('w4')
  })

  it('las claves coinciden con las de buildBuckets', () => {
    const cases: [DateRange, 'day' | 'week' | 'month'][] = [
      [range('2026-11-01', '2026-11-15'), 'day'],
      [range('2026-08-18', '2026-11-15'), 'week'],
      [range('2025-12-01', '2026-11-15'), 'month']
    ]
    for (const [cr, g] of cases) {
      const keys = new Set(buildBuckets(cr, g).map((b) => b.key))
      for (let d = parseIsoDate(cr.from); toIsoDate(d) <= cr.to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        const key = bucketKeyFor(toIsoDate(d), cr, g)
        expect(key).not.toBeNull()
        expect(keys.has(key as string)).toBe(true)
      }
    }
  })
})

describe('buildBuckets', () => {
  it('día: un bucket por día, extremos incluidos', () => {
    const buckets = buildBuckets(range('2026-10-30', '2026-11-02'), 'day')
    expect(buckets.map((b) => b.key)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(buckets[0]?.label).toBe('30 oct')
    expect(buckets[0]?.label).not.toContain('.')
    expect(buckets[3]?.fullLabel).toContain('noviembre')
    expect(buckets[3]?.fullLabel).toContain('2026')
  })

  it('día: incluye el 29 de febrero en año bisiesto', () => {
    const keys = buildBuckets(range('2028-02-27', '2028-03-01'), 'day').map((b) => b.key)
    expect(keys).toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'])
  })

  it('día: cruza el fin de año', () => {
    const keys = buildBuckets(range('2026-12-30', '2027-01-02'), 'day').map((b) => b.key)
    expect(keys).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('semana: bloques de 7 días; la última se recorta al final del rango', () => {
    const buckets = buildBuckets(range('2026-11-01', '2026-11-30'), 'week')
    expect(buckets.map((b) => b.key)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4'])
    expect(buckets[0]?.label).toBe('1 nov')
    expect(buckets[0]?.fullLabel).toBe('Semana del 1 nov al 7 nov')
    expect(buckets[4]?.fullLabel).toBe('Semana del 29 nov al 30 nov')
  })

  it('semana: 90 días producen 13 buckets', () => {
    expect(buildBuckets(range('2026-08-18', '2026-11-15'), 'week')).toHaveLength(13)
  })

  it('mes: un bucket por mes tocado, aunque el rango empiece a mitad de mes', () => {
    const buckets = buildBuckets(range('2025-12-15', '2026-03-02'), 'month')
    expect(buckets.map((b) => b.key)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03'])
    expect(buckets[0]?.label).toBe('DIC 25')
    expect(buckets[3]?.label).toBe('MAR 26')
    expect(buckets[1]?.fullLabel).toContain('enero')
    expect(buckets[1]?.fullLabel).toContain('2026')
  })

  it('mes: etiqueta corta de tres letras en mayúsculas sin punto', () => {
    const labels = buildBuckets(range('2026-01-01', '2026-12-31'), 'month').map((b) => b.label)
    expect(labels).toHaveLength(12)
    for (const label of labels) expect(label).toMatch(/^[A-ZÁÉÍÓÚ]{3} 26$/)
    expect(labels[8]).toBe('SEP 26')
  })

  it('mes: last_12m produce 12 buckets', () => {
    expect(buildBuckets(range('2025-12-01', '2026-11-15'), 'month')).toHaveLength(12)
  })

  it('un rango invertido no produce buckets', () => {
    const r = range('2026-11-30', '2026-11-01')
    expect(buildBuckets(r, 'day')).toEqual([])
    expect(buildBuckets(r, 'week')).toEqual([])
    expect(buildBuckets(range('2026-12-01', '2026-10-31'), 'month')).toEqual([])
  })
})

describe('formatRangeLabel', () => {
  it('incluye ambos extremos y el año, sin puntos de abreviatura', () => {
    const label = formatRangeLabel(range('2026-11-01', '2026-11-04'))
    expect(label).toMatch(/^1\s*[–-]\s*4/)
    expect(label).toContain('nov')
    expect(label).toContain('2026')
    expect(label).not.toContain('.')
  })

  it('muestra ambos años cuando el rango cruza de año', () => {
    const label = formatRangeLabel(range('2025-10-01', '2026-11-04'))
    expect(label).toContain('2025')
    expect(label).toContain('2026')
    expect(label).toContain('oct')
    expect(label).toContain('nov')
  })

  it('un solo día se muestra como una fecha', () => {
    const label = formatRangeLabel(range('2026-11-04', '2026-11-04'))
    expect(label).toContain('4')
    expect(label).toContain('2026')
    expect(label).not.toMatch(/[–]/)
  })
})
