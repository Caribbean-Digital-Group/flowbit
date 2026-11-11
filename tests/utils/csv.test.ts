import { describe, expect, it } from 'vitest'
import { buildCsv, escapeCsvCell, stringifyCsvValue } from '../../app/utils/csv'

describe('escapeCsvCell', () => {
  it('deja intactos los textos simples', () => {
    expect(escapeCsvCell('Taller Norte')).toBe('Taller Norte')
  })

  it('envuelve y duplica comillas aunque no haya coma', () => {
    expect(escapeCsvCell('Taller "El Rayo"')).toBe('"Taller ""El Rayo"""')
  })

  it('envuelve comas y saltos de línea (LF y CR)', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"')
    expect(escapeCsvCell('x\ry')).toBe('"x\ry"')
  })

  it('neutraliza fórmulas', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1")
    expect(escapeCsvCell('+52 55 1234')).toBe("'+52 55 1234")
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(escapeCsvCell('-cmd')).toBe("'-cmd")
    expect(escapeCsvCell('\tTAB')).toBe("'\tTAB")
    expect(escapeCsvCell('=HYPERLINK("http://x","clic")')).toBe('"\'=HYPERLINK(""http://x"",""clic"")"')
  })

  it('no altera números reales, aunque sean negativos', () => {
    expect(escapeCsvCell(-12.5)).toBe('-12.5')
    expect(escapeCsvCell('-12.5')).toBe('-12.5')
    expect(escapeCsvCell('+3')).toBe('+3')
    expect(escapeCsvCell(0)).toBe('0')
  })
})

describe('stringifyCsvValue', () => {
  it('convierte tipos no textuales', () => {
    expect(stringifyCsvValue(null)).toBe('')
    expect(stringifyCsvValue(undefined)).toBe('')
    expect(stringifyCsvValue(true)).toBe('Sí')
    expect(stringifyCsvValue(false)).toBe('No')
    expect(stringifyCsvValue(Number.NaN)).toBe('')
    expect(stringifyCsvValue(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z')
    expect(stringifyCsvValue(['a', 'b'])).toBe('a, b')
    expect(stringifyCsvValue({ a: 1 })).toBe('{"a":1}')
  })
})

describe('buildCsv', () => {
  it('escapa encabezados y separa filas con CRLF', () => {
    const csv = buildCsv(['Nombre', 'Notas, extra'], [['Ana', '=2*3'], ['Luis', null]])
    expect(csv).toBe('Nombre,"Notas, extra"\r\nAna,\'=2*3\r\nLuis,')
  })
})
