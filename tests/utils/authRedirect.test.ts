import { describe, expect, it } from 'vitest'
import { sanitizeRedirect } from '../../app/utils/authRedirect'

describe('sanitizeRedirect', () => {
  it('conserva rutas internas del panel', () => {
    expect(sanitizeRedirect('/admin')).toBe('/admin')
    expect(sanitizeRedirect('/admin/orders?delivery=pending')).toBe('/admin/orders?delivery=pending')
  })
  it('rechaza destinos externos o ajenos al panel', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/admin')
    expect(sanitizeRedirect('https://evil.com')).toBe('/admin')
    expect(sanitizeRedirect('/admin\\evil')).toBe('/admin')
    expect(sanitizeRedirect('/adminx')).toBe('/admin')
    expect(sanitizeRedirect('/manual')).toBe('/admin')
    expect(sanitizeRedirect(undefined)).toBe('/admin')
    expect(sanitizeRedirect(['/admin'])).toBe('/admin')
  })
})
