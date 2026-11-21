import { test, expect } from './fixtures'

/**
 * Encabezados de seguridad declarados en `routeRules` de nuxt.config.ts
 * (docs/security-headers.md). Se revisan en una página pública, en una ruta
 * Nitro (/health) y en el kiosco, que además conserva sus reglas propias.
 */
const expectSecurityHeaders = (headers: Record<string, string>) => {
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('SAMEORIGIN')
  expect(headers['content-security-policy']).toContain("frame-ancestors 'self'")
  expect(headers['permissions-policy']).toContain('camera=()')
  expect(headers['strict-transport-security']).toContain('max-age=')
}

test('las páginas públicas envían los encabezados de seguridad', async ({ request }) => {
  const response = await request.get('/manual')
  expect(response.status()).toBe(200)
  expectSecurityHeaders(response.headers())
})

test('/health también envía los encabezados de seguridad', async ({ request }) => {
  const response = await request.get('/health')
  expectSecurityHeaders(response.headers())
})

test('el kiosco conserva no-referrer y noindex', async ({ request }) => {
  const response = await request.get('/kiosk/token-de-prueba')
  const headers = response.headers()
  expectSecurityHeaders(headers)
  expect(headers['referrer-policy']).toBe('no-referrer')
  expect(headers['x-robots-tag']).toContain('noindex')
})
