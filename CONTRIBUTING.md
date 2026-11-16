# Guía de contribución

¡Gracias por ayudar a mejorar Flowbit!

## Flujo de ramas

1. Crea tu rama desde `develop`: `feat/{nombre}`, `fix/{nombre}` o `refactor/{nombre}`.
2. Abre el Pull Request hacia `develop`. `main` es producción y solo se actualiza desde `develop`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) en inglés: `feat(crm): add lead timeline`.
Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `test`, `perf`.

## Convenciones

- Código en inglés; textos de interfaz en español (`es-MX`).
- TypeScript estricto, sin `any`; `<script setup lang="ts">`.
- Toda tabla de negocio: `company_id`, RLS, auditoría, `active` (soft delete). Nunca edites migraciones pasadas.
- No edites `types/database.types.ts` a mano (`npm run db:types`).
- Detalle completo en [CLAUDE.md](CLAUDE.md).

## Pruebas

- **Unitarias** (`npm test`, Vitest): funciones puras en `tests/`.
- **E2E de humo** (`npm run test:e2e`, Playwright): recorren el build de producción en
  Chromium sin base de datos. Cubren la landing, `/funcionalidades`, el manual, `/health`,
  las redirecciones del panel sin sesión (`/admin` → `/?redirect=…`) y la página 404.
  Viven en `e2e/` y la configuración en `playwright.config.ts`.

Para correr las E2E en local:

```bash
npx playwright install chromium   # solo la primera vez
SUPABASE_URL=https://example.supabase.co \
SUPABASE_PUBLISHABLE_KEY=ci-placeholder \
NUXT_PUBLIC_SITE_URL=http://localhost:3000 \
npm run build
npm run test:e2e
```

- Playwright levanta `node .output/server/index.mjs` en el puerto 3000 con credenciales
  ficticias; si ya tienes un servidor en ese puerto, lo reutiliza.
- Las pruebas no deben depender de datos: con la URL ficticia las llamadas a Supabase
  fallan (y `/health` responde 503), y eso es lo esperado.
- Si ya tienes un Chromium instalado cuya versión no coincide con `@playwright/test`,
  apúntalo con `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chrome`.
- Para depurar un fallo: `npx playwright test --trace on` y `npx playwright show-report`.
- En la CI corren en el job `e2e` de `.github/workflows/ci.yml`; si fallan, el reporte
  queda como artefacto `playwright-report`.

## Checklist de PR

- [ ] Descripción clara y enlace a la tarea relacionada.
- [ ] Compila (`npm run build`).
- [ ] Sin errores de tipos (`npm run typecheck`); no se usa `any` ni `@ts-ignore` para silenciarlos.
- [ ] Migraciones nuevas (si aplica) con RLS y tipos regenerados.
- [ ] Documentación actualizada en `docs/` y, si aplica, artículo en `app/utils/manual/`.
- [ ] Sin secretos ni `.env` en el commit.
