import { sanitizeRedirect } from '~/utils/authRedirect'

/**
 * Guard central del panel: toda ruta bajo `/admin` exige sesión.
 * Sin sesión redirige a `/` conservando el destino en `?redirect=`.
 * La sesión de Supabase vive en el navegador, por eso solo corre en cliente.
 * El layout `admin` mantiene su validación como respaldo.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  if (to.path !== '/admin' && !to.path.startsWith('/admin/')) return

  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) {
    await authStore.loadSession()
  }
  if (authStore.isAuthenticated) return

  return navigateTo({ path: '/', query: { redirect: sanitizeRedirect(to.fullPath) } })
})
