import { describe, expect, it, vi } from 'vitest'
import {
  createTokenCache,
  extractBearerToken,
  readJwtExpiry,
  verifyAccessToken
} from '../../server/utils/supabaseSession'

const NOW = 1_800_000_000_000 // ms

const b64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

const jwt = (payload: Record<string, unknown>): string =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma`

const validToken = jwt({ sub: 'user-1', exp: NOW / 1000 + 3600 })

const setup = (status: number | Error = 200) => {
  const cache = createTokenCache({ ttlMs: 5 * 60_000, maxEntries: 10, now: () => NOW })
  const fetchAuthUser = vi.fn(async () => {
    if (status instanceof Error) throw status
    return status
  })
  return { cache, fetchAuthUser, now: () => NOW }
}

describe('extractBearerToken', () => {
  it('extrae el token del encabezado', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(extractBearerToken('bearer abc')).toBe('abc')
  })

  it('rechaza encabezados vacíos o mal formados', () => {
    expect(extractBearerToken(undefined)).toBeNull()
    expect(extractBearerToken('')).toBeNull()
    expect(extractBearerToken('Bearer')).toBeNull()
    expect(extractBearerToken('Basic abc')).toBeNull()
    expect(extractBearerToken('Bearer a b')).toBeNull()
    expect(extractBearerToken(`Bearer ${'x'.repeat(9000)}`)).toBeNull()
  })
})

describe('readJwtExpiry', () => {
  it('lee exp de un JWT', () => {
    expect(readJwtExpiry(jwt({ exp: 123 }))).toBe(123)
  })

  it('devuelve null si no es JWT o no trae exp', () => {
    expect(readJwtExpiry('cualquier-cosa')).toBeNull()
    expect(readJwtExpiry('a.b')).toBeNull()
    expect(readJwtExpiry('a..c')).toBeNull()
    expect(readJwtExpiry(`${b64url({})}.no-es-json.x`)).toBeNull()
    expect(readJwtExpiry(jwt({ sub: 'x' }))).toBeNull()
    expect(readJwtExpiry(jwt({ exp: '123' }))).toBeNull()
  })
})

describe('verifyAccessToken', () => {
  it('rechaza un token inventado sin llamar a Supabase Auth', async () => {
    const opts = setup()
    expect(await verifyAccessToken('x', opts)).toBe('invalid')
    expect(await verifyAccessToken(null, opts)).toBe('invalid')
    expect(opts.fetchAuthUser).not.toHaveBeenCalled()
  })

  it('rechaza un JWT vencido sin llamar a Supabase Auth', async () => {
    const opts = setup()
    const expired = jwt({ sub: 'user-1', exp: NOW / 1000 - 1 })
    expect(await verifyAccessToken(expired, opts)).toBe('invalid')
    expect(opts.fetchAuthUser).not.toHaveBeenCalled()
  })

  it('rechaza un JWT con forma válida que Supabase Auth no reconoce (401)', async () => {
    const opts = setup(401)
    expect(await verifyAccessToken(validToken, opts)).toBe('invalid')
    expect(opts.fetchAuthUser).toHaveBeenCalledOnce()
  })

  it('acepta un token válido y lo guarda en caché', async () => {
    const opts = setup(200)
    expect(await verifyAccessToken(validToken, opts)).toBe('valid')
    expect(await verifyAccessToken(validToken, opts)).toBe('valid')
    expect(opts.fetchAuthUser).toHaveBeenCalledOnce()
  })

  it('no guarda en caché los tokens rechazados', async () => {
    const opts = setup(401)
    await verifyAccessToken(validToken, opts)
    await verifyAccessToken(validToken, opts)
    expect(opts.fetchAuthUser).toHaveBeenCalledTimes(2)
  })

  it('reporta «unavailable» si Auth falla o responde 5xx', async () => {
    expect(await verifyAccessToken(validToken, setup(new Error('timeout')))).toBe('unavailable')
    expect(await verifyAccessToken(validToken, setup(502))).toBe('unavailable')
  })
})

describe('createTokenCache', () => {
  it('no conserva un token más allá de su exp', () => {
    let now = NOW
    const cache = createTokenCache({ ttlMs: 60 * 60_000, maxEntries: 10, now: () => now })
    cache.remember('t', NOW / 1000 + 30)
    expect(cache.has('t')).toBe(true)
    now += 31_000
    expect(cache.has('t')).toBe(false)
  })

  it('expira por TTL aunque el JWT siga vigente', () => {
    let now = NOW
    const cache = createTokenCache({ ttlMs: 60_000, maxEntries: 10, now: () => now })
    cache.remember('t', NOW / 1000 + 3600)
    now += 61_000
    expect(cache.has('t')).toBe(false)
  })

  it('respeta el tamaño máximo', () => {
    const cache = createTokenCache({ ttlMs: 60_000, maxEntries: 2, now: () => NOW })
    cache.remember('a', null)
    cache.remember('b', null)
    cache.remember('c', null)
    expect(cache.size()).toBe(2)
    expect(cache.has('a')).toBe(false)
    expect(cache.has('c')).toBe(true)
  })
})
