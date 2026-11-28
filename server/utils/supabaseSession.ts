import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Validación de la sesión de Supabase en rutas Nitro (TRY-74).
 *
 * Las rutas del servidor que «exigen sesión» no pueden conformarse con que el
 * encabezado `Authorization` tenga forma de `Bearer …`: cualquier texto pasa.
 * Este helper confirma el access token contra Supabase Auth
 * (`GET /auth/v1/user`, con la clave pública, igual que el cliente) y guarda
 * en memoria los tokens válidos por unos minutos, para no llamar a Auth en
 * cada guardado del editor.
 *
 * La caché nunca guarda el token en claro (solo su SHA-256) y ninguna entrada
 * vive más allá del `exp` del JWT. Un token sin forma de JWT o ya vencido se
 * rechaza sin salir a la red.
 */

export type SessionCheck = 'valid' | 'invalid' | 'unavailable'

const JWT_SEGMENT = /^[A-Za-z0-9_-]+$/
const MAX_TOKEN_LENGTH = 8192

/** Extrae el token de un encabezado `Authorization: Bearer <token>`. */
export const extractBearerToken = (header: string | null | undefined): string | null => {
  if (!header) return null
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header)
  const token = match?.[1] ?? null
  if (!token || token.length > MAX_TOKEN_LENGTH) return null
  return token
}

/**
 * Lee `exp` (segundos UNIX) del payload de un JWT sin verificar la firma.
 * Devuelve `null` si el token no tiene forma de JWT o no trae `exp`.
 * La firma la verifica Supabase Auth; esto solo sirve para descartar pronto
 * tokens inventados o vencidos y para acotar la caché.
 */
export const readJwtExpiry = (token: string): number | null => {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts.every((part) => part.length > 0 && JWT_SEGMENT.test(part))) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8')) as unknown
    if (!payload || typeof payload !== 'object') return null
    const exp = (payload as { exp?: unknown }).exp
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

export interface TokenCacheOptions {
  ttlMs: number
  maxEntries: number
  now?: () => number
}

/** Caché acotada de tokens ya validados (clave = SHA-256 del token). */
export const createTokenCache = ({ ttlMs, maxEntries, now = Date.now }: TokenCacheOptions) => {
  const entries = new Map<string, number>()

  const keyOf = (token: string): string => createHash('sha256').update(token).digest('hex')

  const has = (token: string): boolean => {
    const key = keyOf(token)
    const expiresAt = entries.get(key)
    if (expiresAt === undefined) return false
    if (expiresAt <= now()) {
      entries.delete(key)
      return false
    }
    return true
  }

  /** Guarda el token hasta `ttlMs` o hasta su `exp`, lo que ocurra antes. */
  const remember = (token: string, jwtExpSeconds: number | null): void => {
    const current = now()
    const limit = jwtExpSeconds === null ? current + ttlMs : Math.min(current + ttlMs, jwtExpSeconds * 1000)
    if (limit <= current) return

    if (entries.size >= maxEntries) {
      // Purga vencidos; si sigue llena, descarta la entrada más antigua.
      for (const [key, expiresAt] of entries) {
        if (expiresAt <= current) entries.delete(key)
      }
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value
        if (oldest !== undefined) entries.delete(oldest)
      }
    }
    entries.set(keyOf(token), limit)
  }

  return { has, remember, size: () => entries.size }
}

export type AuthUserFetcher = (token: string) => Promise<number>

export interface VerifyOptions {
  cache: ReturnType<typeof createTokenCache>
  fetchAuthUser: AuthUserFetcher
  now?: () => number
}

/**
 * Valida un access token. `fetchAuthUser` devuelve el código HTTP de
 * `GET /auth/v1/user` (o lanza si Auth no responde).
 */
export const verifyAccessToken = async (
  token: string | null,
  { cache, fetchAuthUser, now = Date.now }: VerifyOptions
): Promise<SessionCheck> => {
  if (!token) return 'invalid'

  const exp = readJwtExpiry(token)
  if (exp === null || exp * 1000 <= now()) return 'invalid'

  if (cache.has(token)) return 'valid'

  let status: number
  try {
    status = await fetchAuthUser(token)
  } catch {
    return 'unavailable'
  }

  if (status >= 200 && status < 300) {
    cache.remember(token, exp)
    return 'valid'
  }
  if (status === 401 || status === 403) return 'invalid'
  return 'unavailable'
}

const sessionCache = createTokenCache({ ttlMs: 5 * 60_000, maxEntries: 2000 })

/** Valida la sesión de la petición contra el proyecto de Supabase configurado. */
export const checkRequestSession = async (event: H3Event): Promise<SessionCheck> => {
  const config = useRuntimeConfig(event)
  const supabaseUrl = String(config.public.supabaseUrl ?? '').replace(/\/$/, '')
  const publishableKey = String(config.public.supabasePublishableKey ?? '')

  const token = extractBearerToken(getHeader(event, 'authorization'))
  if (!token) return 'invalid'

  if (!supabaseUrl || !publishableKey) {
    console.error('Cannot validate session: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not configured')
    return 'unavailable'
  }

  return verifyAccessToken(token, {
    cache: sessionCache,
    fetchAuthUser: async (accessToken) => {
      const response = await $fetch.raw(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
        ignoreResponseError: true
      })
      return response.status
    }
  })
}
