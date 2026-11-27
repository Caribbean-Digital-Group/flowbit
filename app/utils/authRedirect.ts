/**
 * Ruta de destino segura tras iniciar sesión.
 * Solo se aceptan rutas internas con sesión (`/admin...`, `/valle-bit...`) para evitar
 * redirecciones abiertas (`//evil.com`, `https://...`, `/\evil`).
 */
export const DEFAULT_AUTH_REDIRECT = '/admin'

const ALLOWED_ROOTS = ['/admin', '/valle-bit']

export const sanitizeRedirect = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_AUTH_REDIRECT
  const root = ALLOWED_ROOTS.find(allowed => value.startsWith(allowed))
  if (!root) return DEFAULT_AUTH_REDIRECT
  if (value.startsWith('//') || value.includes('\\')) return DEFAULT_AUTH_REDIRECT
  const rest = value.slice(root.length)
  if (rest !== '' && !/^[/?#]/.test(rest)) return DEFAULT_AUTH_REDIRECT
  return value
}
