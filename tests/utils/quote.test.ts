import { describe, expect, it } from 'vitest'
import {
  QUOTE_NAME_MAX,
  QUOTE_NOTE_MAX,
  buildQuoteUrl,
  buildQuoteWhatsappUrl,
  canRespondToQuote,
  defaultQuoteValidUntil,
  effectiveQuoteStatus,
  formatQuoteMoney,
  isQuoteExpired,
  isQuoteStoredStatus,
  isQuoteToken,
  validateQuoteResponse
} from '../../app/utils/quote'

// 15 de noviembre de 2026, mediodía local
const NOW = new Date(2026, 10, 15, 12, 0, 0)

describe('isQuoteExpired', () => {
  it('sin vigencia nunca vence', () => {
    expect(isQuoteExpired(null, NOW)).toBe(false)
    expect(isQuoteExpired(undefined, NOW)).toBe(false)
    expect(isQuoteExpired('', NOW)).toBe(false)
  })

  it('la vigencia es inclusiva: el último día todavía se puede aceptar', () => {
    expect(isQuoteExpired('2026-11-15', NOW)).toBe(false)
    expect(isQuoteExpired('2026-11-16', NOW)).toBe(false)
  })

  it('vence al día siguiente de la fecha límite', () => {
    expect(isQuoteExpired('2026-11-14', NOW)).toBe(true)
    expect(isQuoteExpired('2025-12-31', NOW)).toBe(true)
  })

  it('acepta timestamps y compara solo la fecha', () => {
    expect(isQuoteExpired('2026-11-15T00:00:00Z', NOW)).toBe(false)
    expect(isQuoteExpired('2026-11-14T23:59:59Z', NOW)).toBe(true)
  })
})

describe('effectiveQuoteStatus', () => {
  it('sin estado guardado no hay cotización', () => {
    expect(effectiveQuoteStatus(null, 'draft', null, NOW)).toBeNull()
  })

  it('compartida, en borrador y vigente → esperando respuesta', () => {
    expect(effectiveQuoteStatus('shared', 'draft', '2026-11-20', NOW)).toBe('shared')
    expect(effectiveQuoteStatus('shared', 'draft', null, NOW)).toBe('shared')
  })

  it('compartida con vigencia pasada → vencida', () => {
    expect(effectiveQuoteStatus('shared', 'draft', '2026-11-01', NOW)).toBe('expired')
  })

  it('compartida pero confirmada o cancelada por el equipo → cerrada / cancelada', () => {
    expect(effectiveQuoteStatus('shared', 'posted', null, NOW)).toBe('closed')
    expect(effectiveQuoteStatus('shared', 'cancel', null, NOW)).toBe('cancelled')
    // La cancelación gana aunque además esté vencida
    expect(effectiveQuoteStatus('shared', 'cancel', '2026-01-01', NOW)).toBe('cancelled')
  })

  it('los estados finales no cambian con la vigencia ni con la orden', () => {
    expect(effectiveQuoteStatus('accepted', 'posted', '2026-01-01', NOW)).toBe('accepted')
    expect(effectiveQuoteStatus('rejected', 'draft', '2026-01-01', NOW)).toBe('rejected')
    expect(effectiveQuoteStatus('revoked', 'draft', null, NOW)).toBe('revoked')
  })
})

describe('canRespondToQuote', () => {
  it('solo una cotización compartida y vigente admite respuesta', () => {
    expect(canRespondToQuote('shared')).toBe(true)
    for (const status of ['accepted', 'rejected', 'revoked', 'expired', 'closed', 'cancelled'] as const) {
      expect(canRespondToQuote(status)).toBe(false)
    }
    expect(canRespondToQuote(null)).toBe(false)
  })
})

describe('validateQuoteResponse', () => {
  it('exige nombre', () => {
    expect(validateQuoteResponse('accept', '   ', '')).toBe('Escribe tu nombre.')
  })

  it('aceptar no exige comentario', () => {
    expect(validateQuoteResponse('accept', 'Ana López', '')).toBeNull()
  })

  it('rechazar exige motivo', () => {
    expect(validateQuoteResponse('reject', 'Ana López', '  ')).toBe('Cuéntanos el motivo del rechazo.')
    expect(validateQuoteResponse('reject', 'Ana López', 'Precio alto')).toBeNull()
  })

  it('respeta los límites de longitud del RPC', () => {
    expect(validateQuoteResponse('accept', 'a'.repeat(QUOTE_NAME_MAX), '')).toBeNull()
    expect(validateQuoteResponse('accept', 'a'.repeat(QUOTE_NAME_MAX + 1), '')).toMatch(/nombre/)
    expect(validateQuoteResponse('accept', 'Ana', 'x'.repeat(QUOTE_NOTE_MAX + 1))).toMatch(/comentario/)
  })
})

describe('tokens y enlaces', () => {
  const token = 'a'.repeat(32) + '0123456789abcdef0123456789abcdef'

  it('isQuoteToken acepta solo 64 caracteres hexadecimales en minúscula', () => {
    expect(isQuoteToken(token)).toBe(true)
    expect(isQuoteToken(token.slice(1))).toBe(false)
    expect(isQuoteToken(token.toUpperCase())).toBe(false)
    expect(isQuoteToken(`${token.slice(1)}-`)).toBe(false)
    expect(isQuoteToken(null)).toBe(false)
  })

  it('isQuoteStoredStatus reconoce solo los estados guardados', () => {
    expect(isQuoteStoredStatus('shared')).toBe(true)
    expect(isQuoteStoredStatus('expired')).toBe(false)
    expect(isQuoteStoredStatus(undefined)).toBe(false)
  })

  it('buildQuoteUrl quita la barra final del origen', () => {
    expect(buildQuoteUrl('https://tryflowbit.netlify.app/', token)).toBe(`https://tryflowbit.netlify.app/q/${token}`)
    expect(buildQuoteUrl('http://localhost:3000', token)).toBe(`http://localhost:3000/q/${token}`)
  })

  it('buildQuoteWhatsappUrl codifica el mensaje con folio y empresa', () => {
    const url = buildQuoteWhatsappUrl('https://x.test/q/abc', 'S00012', 'Taller Pérez')
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    const text = decodeURIComponent(url.split('text=')[1] ?? '')
    expect(text).toContain('S00012')
    expect(text).toContain('Taller Pérez')
    expect(text).toContain('https://x.test/q/abc')
  })
})

describe('defaultQuoteValidUntil', () => {
  it('suma 15 días por omisión y cruza de mes y de año', () => {
    expect(defaultQuoteValidUntil(NOW)).toBe('2026-11-30')
    expect(defaultQuoteValidUntil(new Date(2026, 11, 25))).toBe('2027-01-09')
    expect(defaultQuoteValidUntil(new Date(2028, 1, 20), 9)).toBe('2028-02-29')
  })
})

describe('formatQuoteMoney', () => {
  it('formatea en es-MX y tolera monedas inválidas', () => {
    expect(formatQuoteMoney(1234.5, 'MXN')).toContain('1,234.50')
    expect(formatQuoteMoney(null, null)).toContain('0.00')
    expect(formatQuoteMoney(10, 'XX')).toContain('10.00')
  })
})
