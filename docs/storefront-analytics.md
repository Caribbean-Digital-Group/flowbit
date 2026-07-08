# Storefront Analytics — analítica first-party de la tienda

Módulo de analítica **propio y alojado en el proyecto** (sin Google Analytics,
Mixpanel ni SDKs de terceros). Captura pageviews, clics, búsquedas y eventos de
e-commerce del storefront público, los procesa en Supabase y los muestra en el
dashboard en `/admin/storefront/analytics`, aislado por empresa.

---

## Pipeline

```
Tracker cliente (batching + cola offline + consentimiento)
      │  POST /api/storefront/analytics (lotes ≤ 20, sendBeacon al cerrar)
      ▼
Ruta Nitro server/api/storefront/analytics.post.ts
      │  valida shape, rate limit por IP, enriquece (UA → dispositivo/navegador/SO,
      │  headers CDN → país; la IP nunca se almacena), filtra bots
      ▼
RPC ingest_storefront_events (SECURITY DEFINER, rol anon)
      │  valida catálogo, dedup por event id, rate limit por visitante en BD
      ▼
storefront_event (crudos, append-only)
      │  jobs cada 15 min (pg_cron) o bajo demanda desde el panel (throttle 5 min)
      ▼
storefront_session + storefront_analytics_daily + storefront_analytics_daily_dim
      ▼
Panel /admin/storefront/analytics (lee SOLO agregados, protegidos por RLS)
```

`purchase` y `refund` **no** vienen del cliente: los emiten triggers sobre
`order` (`origin = 'storefront'`) con id determinístico (`md5('storefront_purchase:'||order_id)`),
por lo que son idempotentes y funcionan aunque el comprador tenga bloqueador o
cierre la pestaña. La atribución a la sesión se hace por `checkout_token`
(el mismo token de idempotencia de la orden, que el cliente envía en
`begin_checkout`); el monto se refresca siempre desde la orden (fuente de verdad).

## Catálogo de eventos (data layer)

Tipos y builders en `app/utils/analytics.ts`. Todo se emite por la fachada
`useStorefrontTracker()` — nunca payloads a mano ni fetch directo.

| Evento | Dónde se dispara |
|---|---|
| `page_view` | `layouts/storefront.vue` en cada cambio de ruta |
| `search` | `products/index.vue` al cargar resultados con término nuevo (properties: `term`, `results`) |
| `click` / `select_content` | disponibles en la fachada para banners/CTAs |
| `view_item_list` | portada (destacados, `list: 'featured'`) y catálogo (`list: 'catalog' | 'search_results'`) |
| `view_item` | detalle de producto (properties: `product_id`, `product_name` — las usa el rollup) |
| `select_item` | clic en `Storefront/ProductCard.vue` |
| `add_to_cart` / `remove_from_cart` | acciones del store Pinia `storefront` (addItem/removeItem) |
| `view_cart` | `cart.vue` al montar con items |
| `begin_checkout` | `checkout/index.vue` al montar (incluye `checkout_token`) |
| `add_shipping_info` / `add_payment_info` | al avanzar los pasos 2 y 3 del checkout |
| `purchase` | **servidor**: trigger AFTER INSERT en `order` |
| `refund` | **servidor**: trigger al pasar la orden a `cancel` |

Propiedades comunes que agrega el tracker automáticamente: `anonymous_id`,
`session_id` (rota tras 30 min de inactividad), `user_id` (tras `identify`),
ruta, título, referrer, UTM (`utm_source/medium/campaign`), idioma y viewport.
El servidor agrega dispositivo/navegador/SO, país y `server_ts`.

## Tracker cliente

`app/utils/analyticsTracker.ts` (singleton) + fachada `useStorefrontTracker()`:

- **Consentimiento primero**: sin consentimiento no se captura nada, ni en
  memoria. Banner en `Storefront/CookieConsent.vue`; al rechazar se borran
  identidad y cola. Estado por tienda en `flowbit:sf-consent:{slug}`.
- **Batching**: lotes de 20 o cada 5 s; cola persistida en localStorage
  (límite 200) para modo offline; reintentos al volver la conexión;
  `sendBeacon` en `pagehide`/`visibilitychange`.
- **Nunca lanza**: cualquier fallo de analítica se ignora; el storefront y el
  checkout no dependen de ella.

## Modelo de datos (migración `20260707140000_create_storefront_analytics_module`)

| Tabla | Contenido |
|---|---|
| `storefront_event` | Eventos crudos append-only, dedup por `id`. Índices por `(company_id, server_ts)`, `(company_id, event_name, server_ts)`, sesión, visitante y `checkout_token`. |
| `storefront_session` | Sesiones derivadas: duración, páginas, entrada/salida, origen/UTM, dispositivo, `is_new_visitor`, `is_bounce`, `converted`, `revenue`. |
| `storefront_analytics_daily` | KPIs por día (UTC): visitas, sesiones, visitantes, nuevos, rebote, órdenes/ingresos/reembolsos (desde `order`) y embudo (`funnel_*` = sesiones distintas por paso). |
| `storefront_analytics_daily_dim` | Top-N por dimensión: `page`, `product_view`, `product_purchased`, `source`, `device`, `browser`, `country`, `search`, `event`. |
| `storefront_analytics_job_run` | Bitácora de jobs (observabilidad + throttle). |

RLS: `SELECT` solo para miembros de la empresa (`user_belongs_to_company`);
la escritura pasa únicamente por funciones `SECURITY DEFINER`.

## Jobs

- `storefront_analytics_sessionize(lookback)` — enriquece purchase/refund desde
  la orden, atribuye sesión por `checkout_token` y upserta sesiones (idempotente,
  recomputa la ventana completa).
- `storefront_analytics_rollup(days)` — upserta los KPIs diarios y recomputa
  las dimensiones (delete+insert) de los últimos N días. Idempotente.
- `run_storefront_analytics_jobs()` — orquestador con throttle de 5 min;
  ejecutable por `authenticated` (el panel lo dispara al abrir/actualizar) y
  programado con **pg_cron cada 15 min** si la extensión está disponible.
- `storefront_analytics_cleanup(keep_days = 400)` — retención: purga eventos
  crudos y sesiones con más de ~13 meses (los rollups se conservan); diario a
  las 03:30 con pg_cron.
- `storefront_analytics_forget_visitor(company_id, anonymous_id)` — borrado a
  solicitud (derecho al olvido), solo admins de la empresa.

## Privacidad

- No se rastrea nada antes de aceptar el banner; «Rechazar» desactiva todo y
  borra identidad local.
- Sin PII en eventos: `anonymous_id` es un UUID aleatorio local (por tienda),
  no hay nombres/emails; `user_id` es solo el UUID de auth tras `identify`.
- La IP no se persiste: solo se deriva el país desde headers del CDN.
- Timestamps del cliente se descartan si difieren > 24 h del servidor.
- Bots (por user-agent) se descartan en la ruta de ingesta.

## Panel (`/admin/storefront/analytics`)

KPIs con comparación vs periodo anterior, visitantes activos (últimos 5 min),
tendencia diaria por métrica (`Chart/DailyTrend.vue`), embudo de checkout con
tasas de paso y abandono de carrito, tops (páginas, productos vistos/comprados,
fuentes, búsquedas, dispositivos, países), filtros por rango de fechas
(7/30/90/personalizado) y segmento por dispositivo, exportación CSV y estado
del último procesamiento. Lee exclusivamente tablas agregadas
(`useStorefrontAnalyticsReport`).

## Cómo agregar un evento nuevo

1. Agregar el nombre al tipo correspondiente en `app/utils/analytics.ts`.
2. Permitirlo en el catálogo del RPC `ingest_storefront_events` (nueva migración
   con `CREATE OR REPLACE FUNCTION`).
3. Dispararlo donde ocurra vía `useStorefrontTracker().trackEvent/trackEcommerce`.
4. (Opcional) Sumarlo a un rollup en `storefront_analytics_rollup` y mostrarlo
   en el panel. La dimensión `event` ya cuenta todos los eventos por nombre sin
   cambios adicionales.

## Pasos manuales pendientes

```bash
npm run db:push    # aplica 20260707150000_fix_storefront_analytics_rollup_and_grants.sql
npm run db:types   # regenera types y permite retirar types/analytics.types.ts
```

> La migración base (`20260707140000`) ya está aplicada; la `20260707150000`
> corrige un `GROUP BY` del rollup y revoca EXECUTE a `anon` en las funciones
> internas (los *default privileges* de Supabase otorgan EXECUTE a
> anon/authenticated en cada función nueva, por lo que `REVOKE FROM PUBLIC`
> no basta — tenerlo en cuenta en futuras funciones internas).

Si `pg_cron` no está habilitado en el proyecto de Supabase (Dashboard →
Database → Extensions), la migración lo deja en un `NOTICE` y el panel sigue
funcionando: dispara los jobs bajo demanda al abrirse (throttle de 5 min).
