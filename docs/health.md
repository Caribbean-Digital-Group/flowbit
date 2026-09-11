# Salud de la plataforma y anti-suspensión de Supabase

Dos piezas relacionadas:

1. **`/health`** — estado público de la plataforma, para monitores de
   disponibilidad y para revisar de un vistazo si la base responde.
2. **Latido anti-suspensión** — un cron que escribe periódicamente en la base
   para que Supabase Cloud no pause el proyecto por inactividad.

> **Por qué hace falta el latido:** los proyectos del plan gratuito de Supabase
> se pausan tras varios días sin actividad. Un proyecto pausado deja a Flowbit
> sin base de datos y solo se reactiva a mano desde el panel de Supabase. El
> latido mantiene el proyecto activo sin intervención.

---

## `/health`

```
GET /health
```

Público, sin autenticación, sin caché (`cache-control: no-store`). No expone
secretos ni datos de ningún tenant.

| Código | Significado |
|---|---|
| `200` | La plataforma opera (`status`: `ok` o `degraded`) |
| `503` | La base de datos no responde (`status`: `down`) |

Un monitor puede alertar solo con el código HTTP, sin leer el cuerpo.

```json
{
  "status": "ok",
  "service": "flowbit",
  "timestamp": "2026-09-11T18:20:31.004Z",
  "instance_uptime_s": 42,
  "deployment": {
    "environment": "production",
    "commit": "fd47da6",
    "branch": "main",
    "region": "us-east-1"
  },
  "checks": {
    "app": { "status": "ok", "latency_ms": 0 },
    "database": { "status": "ok", "latency_ms": 118, "mode": "read" }
  },
  "keepalive": {
    "status": "ok",
    "last_ping_at": "2026-09-11T12:00:02.881Z",
    "ping_count": 184,
    "age_hours": 6.3
  }
}
```

| Campo | Detalle |
|---|---|
| `status` | Peor estado de los chequeos: `ok` → `degraded` (base lenta > 2 s, o migración sin aplicar) → `down` |
| `checks.database.mode` | `read` — RPC `platform_health_check` con la clave publicable |
| `keepalive.status` | `ok`, `stale` (último latido hace más de 48 h) o `unknown` (sin `SUPABASE_SECRET_KEY`) |
| `deployment.*` | Datos que Netlify expone por entorno (`CONTEXT`, `COMMIT_REF`, `BRANCH`) |

Cada consulta hace una lectura real contra Supabase, así que **un monitor
apuntando a `/health` ya cuenta como actividad** del proyecto. La garantía
fuerte sigue siendo el latido escrito.

El chequeo de base llama al RPC `platform_health_check`, que no lee ninguna
tabla: solo confirma que la consulta llegó a Postgres y volvió. Si ese RPC no
existe (migración sin aplicar) se cae a la prueba de vida de Auth y el estado
se reporta como `degraded` con el motivo explícito, en vez de fingir que todo
está bien.

> El resultado del chequeo se cachea 10 segundos y el latido 60, para que una
> ráfaga de peticiones al endpoint público no se traduzca en una ráfaga de
> consultas a la base.

`/health` está excluido de `robots.txt`.

---

## `/api/health/keepalive`

```
POST /api/health/keepalive?source=<origen>
GET  /api/health/keepalive?source=<origen>     # para servicios de cron que solo hacen GET
```

Ejecuta el RPC `platform_health_ping`, que **escribe** en
`public.platform_heartbeat`. Esa escritura es la que mantiene activo el
proyecto de Supabase.

**Autenticación** — si `HEALTH_PING_TOKEN` está configurado, es obligatorio y
se acepta de tres formas (en este orden):

```
Authorization: Bearer <token>
x-health-token: <token>
?token=<token>            # último recurso: queda en los logs del CDN
```

Sin la variable configurada el endpoint queda abierto, pero estrangulado.

**Protecciones**

| Mecanismo | Efecto |
|---|---|
| Estrangulamiento | Máximo un latido por minuto y por instancia; el resto responde `{"status":"skipped","reason":"throttled"}` sin tocar la base |
| Rate limit por IP | Compartido con el del resto de endpoints públicos → `429` |
| Token | `401` si `HEALTH_PING_TOKEN` está configurado y no coincide (comparación en tiempo constante) |

**Respuestas**

| Código | Cuerpo |
|---|---|
| `200` | `{ "status": "ok", "mode": "write", "latency_ms": 96, "heartbeat": { … } }` |
| `200` | `{ "status": "skipped", "reason": "throttled", "next_ping_in_s": 34 }` |
| `401` / `429` | `{ "status": "unauthorized" }` / `{ "status": "rate_limited" }` |
| `503` | La base no respondió; el estrangulamiento se libera para reintentar de inmediato |

Sin `SUPABASE_SECRET_KEY` el endpoint degrada a `mode: "read"`: hace la lectura
ligera (que también cuenta como actividad) pero no deja rastro en
`platform_heartbeat`.

---

## Los relojes que disparan el latido

### 1. Netlify — función programada (principal)

`netlify/functions/keepalive.mts`, cada 6 horas (UTC), declarado en el propio
archivo:

```ts
export const config = { schedule: '0 */6 * * *' }
```

Netlify la recoge gracias a `netlify.toml` (`[functions] directory`). El
archivo **no** declara `[build]` a propósito: la construcción sigue con la
detección automática de Nuxt.

La función intenta primero `/api/health/keepalive` del propio sitio y, si eso
falla, llama al RPC de Supabase directamente — así un despliegue roto no acaba
además con la base suspendida.

Registro de ejecuciones: **Netlify → Logs → Functions → keepalive**.

### 2. GitHub Actions — respaldo

`.github/workflows/keepalive.yml`, dos veces al día. Cubre despliegues fuera de
Netlify y la caída del cron de Netlify. Configuración en
**Settings → Secrets and variables → Actions**:

| Tipo | Nombre | Valor |
|---|---|---|
| Variable | `FLOWBIT_SITE_URL` | `https://tu-dominio` |
| Secret | `HEALTH_PING_TOKEN` | El mismo valor del despliegue |

> GitHub desactiva los workflows programados tras 60 días sin actividad en el
> repositorio; se reactivan con un clic desde la pestaña *Actions*. Por eso el
> cron de Netlify es el principal.

### 3. Monitor externo (opcional, recomendado)

Cualquier servicio de uptime (UptimeRobot, Better Stack, Hetrix…) apuntando a
`https://tu-dominio/health` cada 5 minutos: avisa de caídas y, de paso, genera
actividad constante en la base.

---

## Base de datos

Migración: `supabase/migrations/20260911180000_create_platform_health_module.sql`

```sql
public.platform_heartbeat           -- una fila por origen (source, last_ping_at, ping_count)
public.platform_health_ping(TEXT)   -- registra el latido      → service_role
public.platform_health_status()     -- lee el último latido    → service_role
public.platform_health_check()      -- prueba de vida pública  → anon, authenticated, service_role
```

`platform_health_check` es la única ejecutable por `anon`: devuelve
`{status, server_time}` y no accede a ninguna tabla, porque `/health` es
público y debe funcionar con la clave publicable.

`platform_heartbeat` es una tabla de **infraestructura**, no de negocio: por eso
no lleva `company_id`, ni soft-delete, ni `created_by` / `updated_by`. El latido
pertenece al despliegue completo, no a un tenant.

Tiene RLS activo **sin políticas**: es inaccesible vía PostgREST para `anon` y
`authenticated`. El único acceso son las dos funciones `SECURITY DEFINER`, con
`EXECUTE` revocado a `PUBLIC`, `anon` y `authenticated`, y concedido solo a
`service_role`. Nunca crece: hay una fila por origen y se actualiza.

Aplicar:

```bash
npm run db:push
```

No hace falta regenerar `types/database.types.ts`: el servidor llama estos RPCs
por REST, no a través del cliente tipado.

---

## Variables de entorno

| Variable | Requerida | Uso |
|---|---|---|
| `SUPABASE_URL` | Sí | Destino de los chequeos |
| `SUPABASE_PUBLISHABLE_KEY` | Sí | Chequeo de lectura de `/health` |
| `SUPABASE_SECRET_KEY` | Para el latido escrito | Ejecuta `platform_health_ping`; sin ella se degrada a lectura |
| `HEALTH_PING_TOKEN` | Recomendada | Protege `/api/health/keepalive`; el mismo valor en Netlify y en GitHub Actions |

Generar un token:

```bash
openssl rand -hex 32
```

> **Ojo con el momento de lectura:** igual que `SUPABASE_SECRET_KEY`, Nuxt
> resuelve estas variables **en tiempo de build**, así que cambiar el valor en
> Netlify exige volver a desplegar. El endpoint de latido además lee
> `process.env.HEALTH_PING_TOKEN` en ejecución, de modo que en un despliegue
> propio (Docker, VPS) el token se puede rotar reiniciando el proceso, sin
> reconstruir.

---

## Comprobación manual

```bash
# Estado general
curl -s https://tu-dominio/health | jq

# Latido (con token)
curl -s -X POST -H "Authorization: Bearer $HEALTH_PING_TOKEN" \
  "https://tu-dominio/api/health/keepalive?source=manual" | jq

# En local
npm run dev
curl -s http://localhost:3000/health | jq
```

Lecturas habituales:

| Síntoma | Causa probable |
|---|---|
| `"status": "down"` | Proyecto de Supabase pausado (panel → *Restore project*) o credenciales inválidas |
| `degraded` + `RPC platform_health_check no disponible` | Falta aplicar la migración (`npm run db:push`) |
| Latido `503` con `404 Not Found` | Igual que el anterior: el RPC del latido aún no existe |
| `keepalive.status: "unknown"` | No hay `SUPABASE_SECRET_KEY` en el entorno del servidor |
| `keepalive.status: "stale"` | El cron dejó de correr: revisar Netlify → Logs → Functions |
