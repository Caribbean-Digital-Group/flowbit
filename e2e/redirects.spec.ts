import { test, expect } from './fixtures'

/**
 * El guard `admin-guard.global.ts` corre solo en cliente: sin sesión manda a `/`
 * conservando el destino en `?redirect=` (saneado por `sanitizeRedirect`).
 */
const expectLoginRedirect = async (page: import('@playwright/test').Page, target: string) => {
  await page.goto(target)
  await page.waitForURL(url => url.pathname === '/' && url.searchParams.has('redirect'))
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(target)
}

test.describe('Redirecciones', () => {
  test('/admin sin sesión redirige al login con ?redirect=', async ({ page }) => {
    await expectLoginRedirect(page, '/admin')
  })

  test('/admin/orders sin sesión redirige al login con ?redirect=', async ({ page }) => {
    await expectLoginRedirect(page, '/admin/orders')
  })

  test('/admin/manual redirige (301) al manual público', async ({ page, request }) => {
    const response = await request.get('/admin/manual', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(new URL(response.headers().location ?? '', 'http://localhost').pathname).toBe('/manual')

    await page.goto('/admin/manual')
    await expect(page).toHaveURL(/\/manual$/)
    await expect(page.locator('h1')).toHaveText('Manual de Flowbit')
  })
})
