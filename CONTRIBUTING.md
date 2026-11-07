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

## Checklist de PR

- [ ] Descripción clara y enlace a la tarea relacionada.
- [ ] Compila (`npm run build`).
- [ ] Migraciones nuevas (si aplica) con RLS y tipos regenerados.
- [ ] Documentación actualizada en `docs/` y, si aplica, artículo en `app/utils/manual/`.
- [ ] Sin secretos ni `.env` en el commit.
