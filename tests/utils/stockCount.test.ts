import { describe, expect, it } from 'vitest'
import {
  computeAdjustment,
  evaluateCountLine,
  findLineByCode,
  matchesCountSearch,
  summarizeCount,
  type CountLineInput
} from '../../app/utils/stockCount'

const line = (overrides: Partial<CountLineInput>): CountLineInput => ({
  expectedQuantity: 10,
  countedQuantity: null,
  unitCost: 5,
  ...overrides
})

describe('evaluateCountLine', () => {
  it('marca como pendiente una línea sin capturar', () => {
    expect(evaluateCountLine(line({}))).toEqual({ state: 'pending', difference: null, differenceValue: null })
  })

  it('cuadra cuando lo contado es igual a lo esperado', () => {
    expect(evaluateCountLine(line({ countedQuantity: 10 }))).toEqual({ state: 'match', difference: 0, differenceValue: 0 })
  })

  it('detecta sobrante y lo valora al costo congelado', () => {
    expect(evaluateCountLine(line({ countedQuantity: 12 }))).toEqual({ state: 'surplus', difference: 2, differenceValue: 10 })
  })

  it('detecta faltante con diferencia negativa', () => {
    expect(evaluateCountLine(line({ countedQuantity: 7 }))).toEqual({ state: 'shortage', difference: -3, differenceValue: -15 })
  })

  it('contar 0 es un faltante, no una línea pendiente', () => {
    expect(evaluateCountLine(line({ countedQuantity: 0 })).state).toBe('shortage')
  })

  it('evita errores de punto flotante con decimales', () => {
    const result = evaluateCountLine(line({ expectedQuantity: 0.3, countedQuantity: 0.1 + 0.2 }))
    expect(result.state).toBe('match')
  })

  it('un producto sin costo tiene diferencia en unidades pero valor 0', () => {
    expect(evaluateCountLine(line({ countedQuantity: 11, unitCost: 0 }))).toEqual({ state: 'surplus', difference: 1, differenceValue: 0 })
  })
})

describe('computeAdjustment', () => {
  it('aplica el sobrante completo', () => {
    expect(computeAdjustment(2, 50)).toEqual({ adjustment: 2, clamped: false })
  })

  it('aplica el faltante cuando hay existencia suficiente', () => {
    // Esperado 100, contado 97; durante el conteo se vendieron 5 (hoy hay 95) → queda en 92
    expect(computeAdjustment(-3, 95)).toEqual({ adjustment: -3, clamped: false })
  })

  it('recorta el faltante hasta dejar el almacén en cero', () => {
    // Esperado 3, contado 0; se vendieron 2 durante el conteo (hoy hay 1)
    expect(computeAdjustment(-3, 1)).toEqual({ adjustment: -1, clamped: true })
  })

  it('no ajusta nada si el almacén ya está en cero o negativo', () => {
    expect(computeAdjustment(-4, 0)).toEqual({ adjustment: 0, clamped: true })
    expect(computeAdjustment(-4, -2)).toEqual({ adjustment: 0, clamped: true })
  })
})

describe('summarizeCount', () => {
  const lines: CountLineInput[] = [
    line({ expectedQuantity: 100, countedQuantity: 97, unitCost: 10 }),
    line({ expectedQuantity: 50, countedQuantity: 52, unitCost: 5 }),
    line({ expectedQuantity: 3, countedQuantity: 3, unitCost: 2 }),
    line({ expectedQuantity: 4, countedQuantity: null, unitCost: 1 })
  ]

  it('cuenta líneas por estado y el avance', () => {
    const summary = summarizeCount(lines)
    expect(summary.totalLines).toBe(4)
    expect(summary.countedLines).toBe(3)
    expect(summary.pendingLines).toBe(1)
    expect(summary.matchLines).toBe(1)
    expect(summary.surplusLines).toBe(1)
    expect(summary.shortageLines).toBe(1)
    expect(summary.progress).toBe(75)
  })

  it('suma unidades y valor de sobrantes y faltantes', () => {
    const summary = summarizeCount(lines)
    expect(summary.surplusUnits).toBe(2)
    expect(summary.shortageUnits).toBe(3)
    expect(summary.surplusValue).toBe(10)
    expect(summary.shortageValue).toBe(30)
    expect(summary.netValue).toBe(-20)
  })

  it('con «sin contar = 0» trata las pendientes como faltante', () => {
    const summary = summarizeCount(lines, true)
    expect(summary.pendingLines).toBe(1)
    expect(summary.shortageLines).toBe(2)
    expect(summary.shortageUnits).toBe(7)
    expect(summary.netValue).toBe(-24)
  })

  it('un conteo vacío tiene avance 0', () => {
    expect(summarizeCount([]).progress).toBe(0)
  })
})

describe('búsqueda de líneas', () => {
  const items = [
    { id: '1', name: 'Tornillo 1/4', sku: 'TOR-14', barcode: '7501234567890' },
    { id: '2', name: 'Tuerca', sku: 'TUE-01', barcode: null }
  ]

  it('encuentra por código de barras exacto', () => {
    expect(findLineByCode(items, ' 7501234567890 ')?.id).toBe('1')
  })

  it('encuentra por SKU sin distinguir mayúsculas', () => {
    expect(findLineByCode(items, 'tue-01')?.id).toBe('2')
  })

  it('no confunde un código parcial', () => {
    expect(findLineByCode(items, '750123')).toBeNull()
    expect(findLineByCode(items, '')).toBeNull()
  })

  it('filtra por nombre, SKU o código', () => {
    expect(items.filter((i) => matchesCountSearch(i, 'torn')).map((i) => i.id)).toEqual(['1'])
    expect(items.filter((i) => matchesCountSearch(i, '')).length).toBe(2)
  })
})
