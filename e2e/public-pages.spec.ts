import { test, expect } from './fixtures'
import { BRAND_NAME, BRAND_POSITIONING, FEATURE_MODULES } from '../app/utils/features'
import { ARTICLES } from '../app/utils/manual/articles'

// Datos reales tomados de las fuentes únicas del contenido público.
const feature = FEATURE_MODULES[0]!
const article = ARTICLES[0]!

test.describe('Páginas públicas', () => {
  test('la landing se renderiza sin errores', async ({ page, pageErrors }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)

    await expect(page).toHaveTitle(new RegExp(BRAND_NAME))
    await expect(page.locator('h1')).toContainText(BRAND_POSITIONING)
    await page.waitForLoadState('networkidle')
    expect(pageErrors).toEqual([])
  })

  test('el hub de funcionalidades lista los módulos', async ({ page, pageErrors }) => {
    const response = await page.goto('/funcionalidades')
    expect(response?.status()).toBe(200)

    await expect(page.locator('h1')).toContainText('Todo lo que tu empresa necesita')
    await expect(page.locator(`a[href="/funcionalidades/${feature.slug}"]`).first()).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test(`la página de funcionalidad /funcionalidades/${feature.slug} se renderiza`, async ({ page, pageErrors }) => {
    const response = await page.goto(`/funcionalidades/${feature.slug}`)
    expect(response?.status()).toBe(200)

    await expect(page).toHaveTitle(feature.seoTitle)
    await expect(page.locator('h1')).toHaveText(feature.headline)
    expect(pageErrors).toEqual([])
  })

  test('el índice del manual se lee sin sesión', async ({ page, pageErrors }) => {
    const response = await page.goto('/manual')
    expect(response?.status()).toBe(200)

    await expect(page.locator('h1')).toHaveText('Manual de Flowbit')
    await expect(page.locator(`a[href="/manual/${article.id}"]`).first()).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test(`la guía /manual/${article.id} se lee sin sesión`, async ({ page, pageErrors }) => {
    const response = await page.goto(`/manual/${article.id}`)
    expect(response?.status()).toBe(200)

    await expect(page).toHaveTitle(`${article.title} — Manual de Flowbit ERP`)
    await expect(page.locator('h1')).toHaveText(article.title)
    expect(pageErrors).toEqual([])
  })

  test('una ruta inexistente muestra la página de error 404', async ({ page }) => {
    const response = await page.goto('/esta-ruta-no-existe-e2e')
    expect(response?.status()).toBe(404)

    await expect(page.getByText('Página no encontrada')).toBeVisible()
  })
})
