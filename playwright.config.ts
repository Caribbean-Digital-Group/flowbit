import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas E2E de humo (smoke) sobre el build de producción.
 *
 * No necesitan base de datos: el servidor arranca con credenciales ficticias de
 * Supabase y las pruebas solo recorren rutas públicas y redirecciones.
 * Requiere `npm run build` antes de `npm run test:e2e` (ver CONTRIBUTING.md).
 *
 * `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite usar un Chromium ya instalado en local
 * cuando su versión no coincide con la de @playwright/test. En CI no se define y
 * se usa el navegador que instala `npx playwright install`.
 */
const isCI = !!process.env.CI
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
const port = 3000
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'es-MX',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
  ],
  webServer: {
    command: 'node .output/server/index.mjs',
    // Ruta que se renderiza sin Supabase (robots.txt y /health sí lo consultan).
    url: `${baseURL}/funcionalidades`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
    env: {
      PORT: String(port),
      // Valores ficticios: las pruebas de humo no tocan Supabase.
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'ci-placeholder',
      NUXT_PUBLIC_SITE_URL: baseURL,
    },
  },
})
