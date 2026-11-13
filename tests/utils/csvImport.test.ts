import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, parseNumber, validateProductRows } from '../../app/utils/csvImport'

describe('parseCsv', () => {
  it('maneja comillas, comillas escapadas y saltos dentro de campos', () => {
    const rows = parseCsv('a,b\n"x, y","di ""hola""\nlinea2"\n')
    expect(rows).toEqual([['a', 'b'], ['x, y', 'di "hola"\nlinea2']])
  })

  it('quita BOM, soporta CRLF y omite filas vacías', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('detecta punto y coma de Excel en español', () => {
    expect(detectDelimiter('nombre;precio')).toBe(';')
    expect(parseCsv('nombre;precio\nA;1,5')).toEqual([['nombre', 'precio'], ['A', '1,5']])
  })
})

describe('parseNumber', () => {
  it('interpreta formatos comunes y rechaza texto', () => {
    expect(parseNumber('1,234.50')).toBe(1234.5)
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber('$ 99')).toBe(99)
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})

describe('validateProductRows', () => {
  it('acepta cabeceras en español y aplica valores por defecto', () => {
    const r = validateProductRows(parseCsv('Nombre,Tipo,Precio\nCafé,Servicio,50'))
    expect(r.errors).toEqual([])
    expect(r.valid[0]?.data).toMatchObject({
      name: 'Café', product_type: 'service', sale_price: 50, currency: 'MXN', sku: null
    })
  })

  it('reporta errores por fila con el número de línea de la hoja', () => {
    const r = validateProductRows(parseCsv('nombre,tipo,precio\nOk,producto,10\n,producto,5\nMal,raro,x'))
    expect(r.valid).toHaveLength(1)
    expect(r.errors.map(e => e.line)).toEqual([3, 4])
    expect(r.errors[1]?.message).toContain('Tipo')
    expect(r.errors[1]?.message).toContain('Precio')
  })

  it('detecta SKU duplicados dentro del archivo y contra los existentes', () => {
    const r = validateProductRows(parseCsv('nombre,sku\nA,X1\nB,x1\nC,Y2'), ['y2'])
    expect(r.valid.map(v => v.data.name)).toEqual(['A'])
    expect(r.errors.map(e => e.line)).toEqual([3, 4])
  })

  it('avisa cuando falta la columna de nombre', () => {
    expect(validateProductRows(parseCsv('sku\nA')).missingColumns).toEqual(['nombre'])
  })
})
