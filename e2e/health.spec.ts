import { test, expect } from './fixtures'

/**
 * `/health` consulta Supabase de verdad. Con la URL ficticia de las pruebas la
 * base no contesta y responde 503 con `status: 'down'`; contra un proyecto
 * real responde 200. Ambos casos son válidos aquí: lo que se prueba es que la
 * ruta responde JSON con la forma documentada en docs/health.md.
 */
test('/health responde JSON con el estado de la plataforma', async ({ request }) => {
  const response = await request.get('/health')
  expect([200, 503]).toContain(response.status())
  expect(response.headers()['content-type']).toContain('application/json')

  const body = await response.json() as { status: string; service: string; checks: Record<string, unknown> }
  expect(['ok', 'degraded', 'down']).toContain(body.status)
  expect(body.service).toBe('flowbit')
  expect(body.checks).toHaveProperty('app')
  expect(body.checks).toHaveProperty('database')
})
