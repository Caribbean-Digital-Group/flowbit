# Dashboard (`/admin`)

Cómo obtiene sus datos el tablero principal desde TRY-33. Para el uso desde el
panel, ver el manual (`/manual`).

## Peticiones al cargar

| Petición | Qué trae | Depende del periodo |
|---|---|---|
| `get_dashboard_snapshot` | Conteos, borradores, «Requiere atención», CRM, actividad reciente y proyectos públicos | Sí (CRM y órdenes confirmadas por día) |
| `get_sales_kpis` × 2 | Finanzas en base de caja del periodo y del periodo de comparación, cartera, entregas pendientes y productos más vendidos | Sí |
| `v_low_stock_products` (vía `useRestock`) | Aviso «por reabastecer» | No |

Son 4 peticiones sin importar cuántas órdenes, contactos o leads tenga la
empresa. En periodos de día o semana se suma la lectura del libro de ingresos
(`v_revenue_ledger`) para la serie de la gráfica, igual que antes.

Antes de TRY-33 el tablero descargaba los listados completos de ocho entidades.
Con 20 000 órdenes eso eran más de 20 peticiones en bloques de 1000 filas en
cada visita.

## `get_dashboard_snapshot`

Migración: `supabase/migrations/20261120120000_dashboard_snapshot.sql`.

```sql
get_dashboard_snapshot(
  p_company_id   UUID,
  p_from         DATE,           -- periodo elegido (incluido)
  p_to           DATE,
  p_compare_from DATE = NULL,    -- periodo de comparación
  p_compare_to   DATE = NULL,
  p_today        DATE = CURRENT_DATE,  -- «hoy» del navegador
  p_tz           TEXT = 'UTC'          -- zona IANA del navegador
) RETURNS JSONB
```

| Clave | Contenido |
|---|---|
| `company_currency` | Moneda de la empresa en mayúsculas (MXN si falta) |
| `currencies` | Monedas usadas en órdenes, para el selector de moneda |
| `counts` | Contactos activos, productos `active`, proyectos en curso y su avance promedio |
| `drafts[]` | Ventas y compras en borrador por moneda |
| `posted_daily[]` | Órdenes confirmadas por día y moneda dentro del periodo y de la comparación. Alimenta el modo sin base de caja (otra moneda) |
| `attention` | Tareas vencidas (y la más antigua), aprobaciones en revisión, actividades de CRM vencidas, leads estancados y movimientos abiertos |
| `crm` | Leads creados, ganados y perdidos en el periodo; embudo abierto y ponderado por moneda |
| `recent` | Últimas filas de órdenes (6), movimientos, aprobaciones, proyectos, tareas y leads (4) y contactos (3), con las mismas columnas que sus vistas |
| `public_projects[]` | Hasta 4 proyectos compartidos públicamente |

### Decisiones

- **SECURITY INVOKER.** Consulta las mismas tablas y vistas (`security_invoker = true`)
  que antes leía el navegador, con el mismo rol y las mismas políticas RLS. Los
  números coinciden por construcción y un `member` no ve nada nuevo. Además valida la
  membresía con `user_belongs_to_company`.
- **Fechas en hora local.** El navegador manda su zona (`p_tz`) y su «hoy»
  (`p_today`). Una zona desconocida cae a UTC en lugar de romper el tablero.
- **Solo lectura, sin tablas nuevas.**
- **Actividad reciente por fecha de creación.** Antes, los contactos de
  «Actividad reciente» salían en orden alfabético y las órdenes por fecha de
  la orden. Ahora todo se ordena por `created_at`, con desempate por `id`.

## Respaldo sin migración

Si la base aún no tiene el RPC (`42883` o `PGRST202`), `useDashboard` lo
indica y la página arma el **mismo snapshot** en el navegador con
`buildDashboardSnapshot` (`app/utils/dashboardSnapshot.ts`) a partir de los
listados completos, como antes. Los listados se descargan una sola vez por
empresa y visita; cambiar de periodo solo recalcula.

Las dos rutas comparten el tipo `DashboardSnapshot`, así que la página no sabe
de dónde vino la foto. Las reglas están probadas en
`tests/utils/dashboardSnapshot.test.ts`. Al desarrollar se verificó contra
PostgreSQL 16 que el RPC y `buildDashboardSnapshot` dan el mismo resultado con
los mismos datos.

## Archivos

| Archivo | Rol |
|---|---|
| `supabase/migrations/20261120120000_dashboard_snapshot.sql` | RPC |
| `app/composables/useDashboard.ts` | Llamada al RPC y detección de migración pendiente |
| `app/utils/dashboardSnapshot.ts` | Contrato, normalización y respaldo puro |
| `app/utils/dashboard.ts` | Periodos, comparación y agrupación de la gráfica |
| `app/pages/admin/index.vue` | Página; solo lee el snapshot y los KPIs |
