import { describe, expect, it } from 'vitest'
import { escapeIlikeTerm, filterByQuery, normalizeSearch, scoreMatch } from '../../app/utils/search'

describe('normalizeSearch', () => {
  it('quita acentos, mayúsculas y espacios extra', () => {
    expect(normalizeSearch('  Configuración   Fiscal ')).toBe('configuracion fiscal')
    expect(normalizeSearch('NÓMINA')).toBe('nomina')
  })
})

describe('escapeIlikeTerm', () => {
  it('escapa comodines y quita caracteres de sintaxis de PostgREST', () => {
    expect(escapeIlikeTerm('50%_off')).toBe('50\\%\\_off')
    expect(escapeIlikeTerm('a,b(c)"d')).toBe('a b c  d')
    expect(escapeIlikeTerm('c:\\temp')).toBe('c:\\\\temp')
  })

  it('limita la longitud', () => {
    expect(escapeIlikeTerm('x'.repeat(500))).toHaveLength(160)
  })
})

describe('scoreMatch', () => {
  it('coincide sin acentos', () => {
    expect(scoreMatch('configuracion', 'Configuración')).toBeGreaterThan(0)
  })

  it('exige todas las palabras', () => {
    expect(scoreMatch('reporte ventas', 'Reporte de ventas')).toBeGreaterThan(0)
    expect(scoreMatch('reporte compras', 'Reporte de ventas')).toBe(0)
  })

  it('prefiere prefijo sobre subcadena', () => {
    expect(scoreMatch('ord', 'Órdenes')).toBeGreaterThan(scoreMatch('ord', 'Líneas de orden'))
    expect(scoreMatch('lin', 'Líneas de orden')).toBeGreaterThan(scoreMatch('lin', 'Analítica'))
  })
})

describe('filterByQuery', () => {
  const items = [
    { title: 'Dashboard' },
    { title: 'Órdenes', keywords: 'Ventas' },
    { title: 'Líneas de orden', keywords: 'Ventas' },
    { title: 'Reporte de ventas', keywords: 'Ventas' },
    { title: 'Salarios', keywords: 'Nómina' },
  ]

  it('devuelve todo en orden original si no hay búsqueda', () => {
    expect(filterByQuery(items, '  ', 2).map(i => i.title)).toEqual(['Dashboard', 'Órdenes'])
  })

  it('ordena por relevancia, con el título por delante de las palabras clave', () => {
    const titles = filterByQuery(items, 'ventas').map(i => i.title)
    expect(titles[0]).toBe('Reporte de ventas')
    expect(titles).toContain('Órdenes')
  })

  it('busca por palabras clave', () => {
    expect(filterByQuery(items, 'nomina').map(i => i.title)).toEqual(['Salarios'])
  })
})
