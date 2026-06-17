Realiza una auditoría de seguridad exhaustiva del proyecto Flowbit.

Contexto adicional (si se proporciona): $ARGUMENTS

Flowbit es un SaaS multi-tenant con Nuxt 4, Supabase (PostgreSQL + RLS) y autenticación por email/password. El modelo de seguridad central es el aislamiento por `company_id` en todas las tablas de negocio.

Revisa cada categoría en orden. Para cada hallazgo indica: **severidad** (crítica / alta / media / baja), **ubicación exacta** (archivo:línea) y **recomendación concreta**.

---

## 1. Multi-tenancy — Aislamiento por company_id

Busca en todos los composables (`app/composables/use*.ts`) y páginas:

- Consultas Supabase que NO filtren por `company_id` en tablas de negocio
- Acceso directo por `id` sin validar que el registro pertenezca a la empresa activa
- Uso de `useAuthStore().selectedCompanyId` — verificar que nunca sea `null` o `undefined` al momento de la consulta
- Endpoints o RPCs que puedan exponer datos de otra empresa

Patrón inseguro a detectar:
```ts
// MAL: no filtra por company_id
supabase.from('orders').select('*').eq('id', id)

// BIEN
supabase.from('orders').select('*').eq('id', id).eq('company_id', companyId)
```

---

## 2. Row Level Security (RLS)

Revisa los archivos en `supabase/migrations/`:

- Tablas que tengan `ENABLE ROW LEVEL SECURITY` sin políticas definidas (bloquea todo acceso)
- Tablas de negocio SIN `ENABLE ROW LEVEL SECURITY`
- Políticas RLS que no validen `company_id`
- Políticas que usen `auth.uid()` directamente sin pasar por la relación de membresía
- Tablas con soft-delete (`active`) cuyas políticas no filtren `active = true`
- Ausencia de políticas para operaciones `INSERT`, `UPDATE`, `DELETE` (solo tienen `SELECT`)

---

## 3. Autenticación y sesión

Revisa `app/stores/auth.ts`, `app/composables/useSupabase.ts` y layouts:

- Rutas del panel (`/admin/**`) sin guard de autenticación
- `definePageMeta` sin verificación de sesión activa
- `selectedCompanyId` leído desde `localStorage` sin validar que el usuario tenga membresía en esa empresa
- Logout que no limpie `localStorage` (especialmente `flowbit:selected-company-id`)
- Tokens o sesiones expuestos en `console.log`

---

## 4. Exposición de datos sensibles

Busca en todo el codebase:

- `console.log` con objetos de usuario, sesión o tokens (solo `console.error` está permitido)
- Variables de entorno hardcodeadas (claves, URLs de Supabase) fuera de `.env.local`
- Archivos `.env*` que pudieran haberse commiteado: revisar `.gitignore`
- Datos de sesión o tokens en `localStorage` más allá de lo necesario
- Respuestas de API que incluyan campos sensibles no requeridos por el frontend

---

## 5. Validación de entradas

Revisa formularios y composables:

- Inputs sin sanitizar que se pasen directamente a consultas Supabase (aunque el cliente JS previene SQL injection, verificar campos usados en `.ilike()` o RPC)
- Ausencia de validación de tipo/longitud en campos críticos (emails, UUIDs, montos)
- IDs de URL (`route.params.id`) usados en consultas sin validar formato UUID
- Campos numéricos que acepten valores negativos donde no debería (precios, cantidades)

---

## 6. Seguridad del frontend (XSS / CSRF)

Revisa componentes Vue y páginas:

- Uso de `v-html` con contenido no sanitizado
- Interpolación de datos externos sin escape en templates
- URLs dinámicas construidas con input del usuario (`href`, `src`)
- Iframes o scripts cargados desde fuentes externas no controladas

---

## 7. Gestión de roles y permisos

Revisa el flujo de membresías (`partner_company_relationship`, roles: `owner`, `admin`, `member`):

- Acciones destructivas (archivar, eliminar) sin verificar rol del usuario
- UI que oculta opciones por rol pero sin validación en el composable/backend
- Invitaciones que puedan ser aceptadas por un usuario diferente al invitado
- Cambio de rol o remoción de miembros sin restricción de rol mínimo requerido

---

## 8. Archivos y configuración

- `nuxt.config.ts`: headers de seguridad (CSP, X-Frame-Options, HSTS)
- `.gitignore`: presencia de reglas para `.env*`, `supabase/.env`, archivos de claves
- `supabase/config.toml`: configuración de auth (duración de sesión, OAuth providers habilitados)
- Dependencias con vulnerabilidades conocidas: revisar `npm audit`

---

## Reporte final

Genera un reporte estructurado con:

### Hallazgos críticos
(requieren corrección inmediata antes de cualquier release)

### Hallazgos altos
(deben resolverse en el próximo sprint)

### Hallazgos medios y bajos
(mejoras recomendadas)

### Fortalezas de seguridad detectadas
(patrones correctos que vale la pena destacar)

### Acciones inmediatas recomendadas
Lista priorizada de los 3-5 cambios más impactantes.
