import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDateKey, localMonthStartKey } from '../../app/utils/dates'

describe('localDateKey', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formatea la fecha local con ceros a la izquierda', () => {
    expect(localDateKey(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05')
  })

  it('no salta al día siguiente por la tarde (caso UTC−6 a las 19:00)', () => {
    // 19:00 locales del 30 de noviembre: en UTC−6 ya es 1 de diciembre.
    const evening = new Date(2026, 10, 30, 19, 0)
    expect(localDateKey(evening)).toBe('2026-11-30')
  })

  it('respeta los extremos del día', () => {
    expect(localDateKey(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31')
    expect(localDateKey(new Date(2027, 0, 1, 0, 0, 0))).toBe('2027-01-01')
  })

  it('usa hoy cuando no recibe fecha', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 28, 20, 15))
    expect(localDateKey()).toBe('2026-02-28')
  })
})

describe('localMonthStartKey', () => {
  it('devuelve el primer día del mes actual', () => {
    expect(localMonthStartKey(0, new Date(2026, 10, 25, 22, 0))).toBe('2026-11-01')
  })

  it('retrocede meses cruzando el año', () => {
    expect(localMonthStartKey(-2, new Date(2026, 0, 15))).toBe('2025-11-01')
  })

  it('no depende del día del mes (31 → meses cortos)', () => {
    expect(localMonthStartKey(1, new Date(2026, 0, 31))).toBe('2026-02-01')
  })
})
