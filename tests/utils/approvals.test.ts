import { describe, expect, it } from 'vitest'
import {
  approvalErrorMessage,
  approvalStatusLabel,
  buildCsv,
  describeCondition,
  fieldSchemaIssues,
  flowIssues,
  formatFieldValue,
  formatHours,
  isApprovalResolved,
  missingRequiredFields,
  normalizeCondition,
  toFieldKey
} from '../../app/utils/approvals'
import type { ApprovalFieldDefinition } from '../../types/approval.types'

describe('estados', () => {
  it('muestra published como «En revisión» y cubre los estados nuevos', () => {
    expect(approvalStatusLabel('published')).toBe('En revisión')
    expect(approvalStatusLabel('returned')).toBe('Devuelta')
    expect(approvalStatusLabel('expired')).toBe('Expirada')
    expect(approvalStatusLabel(null)).toBe('Sin estado')
  })

  it('distingue estados resueltos', () => {
    expect(isApprovalResolved('approved')).toBe(true)
    expect(isApprovalResolved('expired')).toBe(true)
    expect(isApprovalResolved('returned')).toBe(false)
    expect(isApprovalResolved('published')).toBe(false)
  })
})

describe('formulario dinámico', () => {
  const schema: ApprovalFieldDefinition[] = [
    { key: 'destino', label: 'Destino', type: 'text', required: true },
    { key: 'fechas', label: 'Fechas', type: 'daterange', required: true },
    { key: 'notas', label: 'Notas', type: 'textarea' }
  ]

  it('genera claves estables a partir de la etiqueta', () => {
    expect(toFieldKey('Centro de costos')).toBe('centro_costos')
    expect(toFieldKey('Razón social')).toBe('razon_social')
    expect(toFieldKey('  RFC del proveedor ')).toBe('rfc_proveedor')
  })

  it('detecta obligatorios vacíos, incluidos rangos sin fechas', () => {
    expect(missingRequiredFields(schema, {})).toEqual(['Destino', 'Fechas'])
    expect(missingRequiredFields(schema, { destino: '  ', fechas: {} })).toEqual(['Destino', 'Fechas'])
    expect(missingRequiredFields(schema, { destino: 'CDMX', fechas: { from: '2026-12-01' } })).toEqual([])
  })

  it('valida el diseño del formulario', () => {
    const issues = fieldSchemaIssues([
      { key: 'a', label: 'A', type: 'text' },
      { key: 'a', label: 'B', type: 'text' },
      { key: 'Mala Clave', label: 'C', type: 'text' },
      { key: 'giro', label: 'Giro', type: 'select', options: [' '] }
    ])
    expect(issues).toContain('La clave «a» está repetida')
    expect(issues.some(i => i.includes('minúsculas'))).toBe(true)
    expect(issues).toContain('«Giro» necesita al menos una opción')
  })

  it('formatea valores según el tipo', () => {
    expect(formatFieldValue({ key: 'm', label: 'M', type: 'money' }, 1500)).toContain('1,500.00')
    expect(formatFieldValue({ key: 'x', label: 'X', type: 'text' }, '')).toBe('—')
    expect(formatFieldValue({ key: 'p', label: 'P', type: 'partner' }, 'id-1', () => 'Proveedor SA')).toBe('Proveedor SA')
  })
})

describe('condiciones', () => {
  it('describe reglas en español', () => {
    expect(describeCondition(null)).toBe('Siempre')
    expect(describeCondition({ match: 'all', rules: [{ field: 'amount', op: 'gte', value: 50000 }] }))
      .toBe('Monto es mayor o igual que 50,000')
    expect(describeCondition({
      match: 'any',
      rules: [{ field: 'amount', op: 'between', value: [10000, 50000] }, { field: 'field.rfc', op: 'empty' }]
    })).toBe('Monto está entre 10,000 y 50,000 o rfc está vacío')
  })

  it('normaliza: quita reglas incompletas y separa listas', () => {
    expect(normalizeCondition({ match: 'all', rules: [{ field: 'amount', op: 'gt', value: '' }] })).toBeNull()
    expect(normalizeCondition({ match: 'all', rules: [{ field: 'priority', op: 'in', value: 'high, urgent' }] }))
      .toEqual({ match: 'all', rules: [{ field: 'priority', op: 'in', value: ['high', 'urgent'] }] })
    expect(normalizeCondition({ match: 'all', rules: [{ field: 'field.rfc', op: 'empty', value: 'x' }] }))
      .toEqual({ match: 'all', rules: [{ field: 'field.rfc', op: 'empty' }] })
  })
})

describe('validación de flujos', () => {
  it('avisa niveles sin aprobadores, quórum imposible y flujos solo informativos', () => {
    const issues = flowIssues([
      { name: 'Jefe', sequence: 1, mode: 'any', quorum: null, informative: false, approvers: [] },
      { name: 'Comité', sequence: 2, mode: 'quorum', quorum: 3, informative: false,
        approvers: [{ kind: 'manager', approval_manager_id: 'a' }, { kind: 'manager', approval_manager_id: 'b' }] }
    ])
    expect(issues).toContain('«Jefe» no tiene aprobadores: pasará a los owners')
    expect(issues).toContain('«Comité» pide 3 aprobaciones pero solo tiene 2 aprobadores')
    expect(flowIssues([{ name: 'Info', sequence: 1, mode: 'any', quorum: null, informative: true,
      approvers: [{ kind: 'owners', approval_manager_id: null }] }]))
      .toContain('Todos los niveles son informativos: las solicitudes se aprobarán sin que nadie decida')
  })

  it('un flujo correcto no tiene avisos', () => {
    expect(flowIssues([{ name: 'Jefe', sequence: 1, mode: 'any', quorum: null, informative: false,
      approvers: [{ kind: 'direct_manager', approval_manager_id: null }] }])).toEqual([])
  })
})

describe('exportación y formato', () => {
  it('escapa comillas, comas y saltos de línea, con BOM para Excel', () => {
    const csv = buildCsv([{ a: 'Hola, "mundo"', b: 3 }, { a: 'línea\nnueva', b: null }], [
      { label: 'Texto', value: r => r.a },
      { label: 'Número', value: r => r.b }
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"Hola, ""mundo"""')
    expect(csv).toContain('"línea\nnueva",')
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('formatea horas', () => {
    expect(formatHours(0.5)).toBe('30 min')
    expect(formatHours(5)).toBe('5.0 h')
    expect(formatHours(72)).toBe('3.0 días')
    expect(formatHours(null)).toBe('—')
  })

  it('traduce errores genéricos y respeta los del motor', () => {
    expect(approvalErrorMessage({ message: 'new row violates row-level security policy' })).toBe('No tienes permiso para hacer este cambio.')
    expect(approvalErrorMessage({ message: 'Indica el motivo del rechazo' })).toBe('Indica el motivo del rechazo')
  })
})
