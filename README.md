# Flowbit

ERP ligero, multi-tenant y de código abierto, desarrollado por **Caribbean Digital Group**.
Demo: https://tryflowbit.netlify.app

## Stack

Nuxt 4 · Vue 3 (Composition API) · TypeScript estricto · Tailwind CSS v4 · Supabase (PostgreSQL + Auth + RLS) · Pinia.

## Módulos

General (dashboard, agenda, contactos) · CRM · Ventas/Compras · Tienda en línea · Sitio web (CMS + blog) · Inventario · Proyectos · Aprobaciones · Equipo · Manual público con asistente Bit.

Documentación por módulo en [`docs/`](docs): [CRM](docs/crm.md), [ventas](docs/sales-flow-analysis.md), [storefront](docs/storefront.md), [sitio web](docs/website.md), [inventario](docs/inventory.md), [POS](docs/pos.md), [salud](docs/health.md), [manual y Bit](docs/manual-bit.md).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completa las variables
npm run dev                  # http://localhost:3000
```

Flowbit usa Supabase Cloud (no hay instancia local). Para aplicar migraciones y regenerar tipos:

```bash
npm run db:push
npm run db:types
```

## Variables de entorno

Ver [`.env.example`](.env.example). `SUPABASE_SECRET_KEY` es solo de servidor.

## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md) y [CLAUDE.md](CLAUDE.md) (convenciones del código).

## Licencia

MIT — ver [LICENSE](LICENSE).
