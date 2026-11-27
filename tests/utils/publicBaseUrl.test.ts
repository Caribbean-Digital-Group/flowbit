import { describe, expect, it } from 'vitest'
import { normalizeSiteUrl, resolvePublicBaseUrl, sanitizeRequestHost } from '../../server/utils/publicBaseUrl'

describe('normalizeSiteUrl', () => {
  it('quita la diagonal final y conserva protocolo, host y puerto', () => {
    expect(normalizeSiteUrl('https://tryflowbit.netlify.app/')).toBe('https://tryflowbit.netlify.app')
    expect(normalizeSiteUrl(' http://localhost:3000 ')).toBe('http://localhost:3000')
    expect(normalizeSiteUrl('https://example.com/app//')).toBe('https://example.com/app')
  })

  it('rechaza valores vacíos, protocolos no web y credenciales', () => {
    expect(normalizeSiteUrl(undefined)).toBeNull()
    expect(normalizeSiteUrl('')).toBeNull()
    expect(normalizeSiteUrl('tryflowbit.netlify.app')).toBeNull()
    expect(normalizeSiteUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeSiteUrl('ftp://example.com')).toBeNull()
    expect(normalizeSiteUrl('https://user:pass@example.com')).toBeNull()
  })
})

describe('sanitizeRequestHost', () => {
  it('acepta hosts válidos, con puerto, y toma el primero de una lista', () => {
    expect(sanitizeRequestHost('Example.COM')).toBe('example.com')
    expect(sanitizeRequestHost('localhost:3000')).toBe('localhost:3000')
    expect(sanitizeRequestHost('a.example.com, proxy.internal')).toBe('a.example.com')
  })

  it('rechaza hosts con caracteres que podrían inyectar URLs o XML', () => {
    for (const bad of ['evil.com/path', 'evil.com"><x', 'user@evil.com', 'evil com', '', '-evil.com', 'evil.com:port']) {
      expect(sanitizeRequestHost(bad)).toBeNull()
    }
    expect(sanitizeRequestHost(undefined)).toBeNull()
  })
})

describe('resolvePublicBaseUrl', () => {
  it('prefiere siempre la URL configurada sobre los encabezados de la petición', () => {
    expect(resolvePublicBaseUrl({
      siteUrl: 'https://tryflowbit.netlify.app/',
      forwardedHost: 'attacker.example',
      host: 'main--tryflowbit.netlify.app',
      forwardedProto: 'http'
    })).toBe('https://tryflowbit.netlify.app')
  })

  it('usa el host de la petición solo si no hay URL configurada válida', () => {
    expect(resolvePublicBaseUrl({ siteUrl: '', host: 'localhost:3000', forwardedProto: 'http' }))
      .toBe('http://localhost:3000')
    expect(resolvePublicBaseUrl({ siteUrl: undefined, forwardedHost: 'app.example.com', host: 'internal:8888' }))
      .toBe('https://app.example.com')
  })

  it('ignora encabezados inválidos y protocolos desconocidos', () => {
    expect(resolvePublicBaseUrl({ siteUrl: null, forwardedHost: 'evil.com/x', host: 'ok.example.com', forwardedProto: 'javascript' }))
      .toBe('https://ok.example.com')
    expect(resolvePublicBaseUrl({ siteUrl: 'nope', forwardedHost: 'bad host', host: null })).toBe('')
  })
})
