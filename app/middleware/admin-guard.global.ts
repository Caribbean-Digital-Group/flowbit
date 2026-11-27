import { sanitizeRedirect } from '~/utils/authRedirect'

/**
 * Guard central del panel: toda ruta bajo `/admin` y la vista de juego `/valle-bit` exigen sesión.
 * Sin sesión redirige a `/` conservando el destino en `?redirect=`.
 * La sesión de Supabase vive en el navegador, por eso solo corre en cliente.
 * El layout `admin` mantiene su validación como respaldo.
 */
const PRIVATE_ROOTS = ['/admin', '/valle-bit']

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const isPrivate = PRIVATE_ROOTS.some(root => to.path === root || to.path.startsWith(`${root}/`))
  if (!isPrivate) return

  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) {
    await authStore.loadSession()
  }
  if (authStore.isAuthenticated) return

  return navigateTo({ path: '/', query: { redirect: sanitizeRedirect(to.fullPath) } })
})
