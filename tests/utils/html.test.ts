import { describe, expect, it } from 'vitest'
import { escapeHtml, safeImageUrl } from '../../app/utils/html'

describe('escapeHtml', () => {
  it('escapa los cinco caracteres especiales', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`))
      .toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  })

  it('neutraliza una etiqueta con manejador de eventos', () => {
    const out = escapeHtml('<img src=x onerror=alert(1)>')
    expect(out).not.toContain('<img')
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('acepta números, null y undefined', () => {
    expect(escapeHtml(12.5)).toBe('12.5')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('deja intacto el texto normal con acentos', () => {
    expect(escapeHtml('Café de Olla — 1 kg')).toBe('Café de Olla — 1 kg')
  })
})

describe('safeImageUrl', () => {
  it('acepta http(s) y escapa comillas', () => {
    expect(safeImageUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png')
    expect(safeImageUrl('https://x.com/a.png" onerror="alert(1)'))
      .toBe('https://x.com/a.png&quot; onerror=&quot;alert(1)')
  })

  it('acepta data:image', () => {
    expect(safeImageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })

  it('rechaza esquemas peligrosos o vacíos', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBe('')
    expect(safeImageUrl(' JAVASCRIPT:alert(1)')).toBe('')
    expect(safeImageUrl('data:text/html,<script>')).toBe('')
    expect(safeImageUrl(null)).toBe('')
    expect(safeImageUrl('')).toBe('')
  })
})
