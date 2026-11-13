/**
 * Ruta de destino segura tras iniciar sesión.
 * Solo se aceptan rutas internas del panel (`/admin...`) para evitar
 * redirecciones abiertas (`//evil.com`, `https://...`, `/\evil`).
 */
export const DEFAULT_AUTH_REDIRECT = '/admin'

export const sanitizeRedirect = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_AUTH_REDIRECT
  if (!value.startsWith('/admin')) return DEFAULT_AUTH_REDIRECT
  if (value.startsWith('//') || value.includes('\\')) return DEFAULT_AUTH_REDIRECT
  const rest = value.slice('/admin'.length)
  if (rest !== '' && !/^[/?#]/.test(rest)) return DEFAULT_AUTH_REDIRECT
  return value
}
