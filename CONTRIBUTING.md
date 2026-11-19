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

### Migraciones SQL

El job `migrations` de la CI aplica **toda** la cadena `supabase/migrations/*.sql`, en orden,
sobre un PostgreSQL 16 limpio. Si una migración falla, el PR queda en rojo con el archivo,
la línea y el error. Antes de aplicar las migraciones, el job también revisa que el PR:

- no modifique, borre ni renombre migraciones que ya están en la rama base, y
- use un timestamp posterior a la última migración de la base. `supabase db push` rechaza
  las migraciones con fecha anterior. Si otro PR con migración se fusiona antes que el tuyo,
  renombra tu archivo con una fecha más reciente.

Para correrlo en local necesitas una base **vacía** de PostgreSQL 15 o superior:

```bash
createdb flowbit_check
DATABASE_URL=postgres://postgres:postgres@localhost:5432/flowbit_check npm run db:check
# Con Docker:
#   docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:check
```

Una base limpia no trae lo que Supabase Cloud ya incluye. `scripts/ci/supabase-stubs.sql`
crea lo mínimo: los roles `anon`, `authenticated` y `service_role`, `auth.users`, `auth.uid()`,
`auth.role()`, `auth.jwt()`, `storage.buckets`, `storage.objects` y `storage.foldername()`.
Si tu migración usa otra pieza de Supabase, agrégala ahí con su firma real.
`pg_cron` no existe en la imagen y las migraciones que lo usan ya lo detectan y lo omiten.
La validación detecta errores de SQL, referencias rotas y dependencias en mal orden.
No prueba los permisos de RLS con usuarios reales: eso sigue requiriendo un proyecto de Supabase.

## Checklist de PR

- [ ] Descripción clara y enlace a la tarea relacionada.
- [ ] Compila (`npm run build`).
- [ ] Sin errores de tipos (`npm run typecheck`); no se usa `any` ni `@ts-ignore` para silenciarlos.
- [ ] Migraciones nuevas (si aplica) con RLS y tipos regenerados; el job `migrations` en verde.
- [ ] Documentación actualizada en `docs/` y, si aplica, artículo en `app/utils/manual/`.
- [ ] Sin secretos ni `.env` en el commit.
