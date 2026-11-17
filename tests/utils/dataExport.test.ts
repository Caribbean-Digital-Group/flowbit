import { describe, expect, it } from 'vitest'
import {
  DATA_EXPORT_ENTITIES,
  buildExportFilename,
  buildExportReadme,
  collectColumns,
  rowsToCsv,
  selectExportEntities
} from '../../app/utils/dataExport'

describe('DATA_EXPORT_ENTITIES', () => {
  it('no repite archivos ni tablas', () => {
    const files = DATA_EXPORT_ENTITIES.map(e => e.file)
    const sources = DATA_EXPORT_ENTITIES.map(e => e.source)
    expect(new Set(files).size).toBe(files.length)
    expect(new Set(sources).size).toBe(sources.length)
  })

  it('marca como sensibles los datos privados y la nómina', () => {
    const sensitive = DATA_EXPORT_ENTITIES.filter(e => e.sensitive).map(e => e.source)
    expect(sensitive).toEqual(expect.arrayContaining(['employee_private', 'hr_salary', 'payroll_slip']))
  })
})

describe('selectExportEntities', () => {
  it('excluye los datos sensibles sin confirmación', () => {
    expect(selectExportEntities(false).some(e => e.sensitive)).toBe(false)
    expect(selectExportEntities(true)).toHaveLength(DATA_EXPORT_ENTITIES.length)
  })
})

describe('collectColumns / rowsToCsv', () => {
  it('une las columnas en orden de aparición', () => {
    expect(collectColumns([{ id: 1, name: 'a' }, { id: 2, email: 'x' }])).toEqual(['id', 'name', 'email'])
  })

  it('genera CSV con BOM, escape seguro y celdas vacías para columnas faltantes', () => {
    const csv = rowsToCsv([
      { id: '1', name: '=HYPERLINK("x")', active: true },
      { id: '2', notes: 'a,b' }
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('id,name,active,notes')
    expect(lines[1]).toBe('1,"\'=HYPERLINK(""x"")",Sí,')
    expect(lines[2]).toBe('2,,,"a,b"')
  })

  it('sin filas genera un CSV vacío (solo BOM)', () => {
    expect(rowsToCsv([])).toBe('﻿')
  })
})

describe('buildExportFilename', () => {
  it('normaliza el nombre de la empresa', () => {
    expect(buildExportFilename('Panadería Ñandú, S.A.', new Date(2026, 0, 5))).toBe('flowbit-panaderia-nandu-s-a-2026-01-05.zip')
    expect(buildExportFilename('***', new Date(2026, 0, 5))).toBe('flowbit-empresa-2026-01-05.zip')
  })
})

describe('buildExportReadme', () => {
  it('lista filas, errores y truncados por archivo', () => {
    const [a, b, c] = DATA_EXPORT_ENTITIES
    const text = buildExportReadme({
      companyName: 'Acme',
      generatedAt: new Date('2026-11-17T10:00:00Z'),
      includeSensitive: false,
      results: [
        { entity: a!, rows: 1, truncated: false, error: null },
        { entity: b!, rows: 50000, truncated: true, error: null },
        { entity: c!, rows: 0, truncated: false, error: 'migración pendiente' }
      ]
    })
    expect(text).toContain('Empresa: Acme')
    expect(text).toContain('no incluidos')
    expect(text).toContain('1 fila ')
    expect(text).toContain('INCOMPLETO')
    expect(text).toContain('NO EXPORTADO: migración pendiente')
  })
})
