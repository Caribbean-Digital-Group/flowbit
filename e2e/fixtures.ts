import { test as base, expect } from '@playwright/test'

/**
 * Fixture compartida: registra los errores no capturados de la página
 * (`pageerror`) para que cada prueba pueda exigir que no haya ninguno.
 * Las peticiones fallidas a Supabase (URL ficticia) no cuentan: no son
 * excepciones de JavaScript.
 */
export const test = base.extend<{ pageErrors: Error[] }>({
  pageErrors: async ({ page }, use) => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    await use(errors)
  },
})

export { expect }
