# Flowbit — CLAUDE.md

Flowbit es un SaaS multi-tenant de gestión empresarial (ERP ligero) de código abierto.
Desarrollado por **Caribbean Digital Group**.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Nuxt 4 (`compatibilityVersion: 4`) | ^4.3.0 |
| UI | Vue 3.5+, Composition API | ^3.5.27 |
| Lenguaje | TypeScript estricto | — |
| Estilos | Tailwind CSS v4 (plugin Vite, sin `@apply`) | ^4.1.18 |
| Base de datos | Supabase Cloud — PostgreSQL + Auth + RLS | ^2.91.1 |
| Estado global | Pinia | ^3.0.4 |
| Router | Vue Router | ^4.6.4 |
| QR codes | qrcode | ^1.5.4 |
| Tipos DB | `types/database.types.ts` — generados, nunca editar manualmente | — |

> **Supabase corre en la nube** (`--linked`). No existe instancia local activa. Todos los comandos `db:*` apuntan al proyecto vinculado en Supabase Cloud.

---

## Estructura de directorios

```
flowbit/
├── app/
│   ├── app.vue                        # Root component
│   ├── error.vue                      # Error boundary global
│   ├── assets/css/main.css            # Tailwind entry point
│   ├── components/
│   │   ├── Form/                      # Input.vue, Select.vue, TextArea.vue, Login.vue
│   │   ├── {Module}/Form.vue          # Formulario de cada módulo
│   │   ├── Chart/MonthlyBars.vue      # Gráfico de barras mensual
│   │   ├── Landing/Assistant.vue      # Asistente de la landing pública
│   │   ├── Manual/FloatingAssistant.vue # Asistente flotante en el panel
│   │   ├── Team/InviteModal.vue       # Modal de invitación de equipo
│   │   ├── Datatable.vue              # Tabla reutilizable para listados
│   │   ├── CardSheet.vue              # Shell de detalle/edición
│   │   ├── BtnApp.vue                 # Botón principal
│   │   ├── BtnDelete.vue              # Botón destructivo
│   │   ├── BadgeApp.vue               # Badge de estado
│   │   ├── Avatar.vue                 # Avatar con dropdown (perfil/logout)
│   │   └── StatGrid.vue               # Grilla de estadísticas
│   ├── composables/                   # use{Entity}.ts — acceso a Supabase
│   ├── layouts/
│   │   ├── admin.vue                  # Layout del panel (sidebar + header + notificaciones)
│   │   ├── default.vue
│   │   └── public.vue
│   ├── middleware/                    # Guards de navegación (a implementar)
│   ├── pages/
│   │   ├── index.vue                  # Landing / login
│   │   ├── reset-password.vue
│   │   ├── public/projects/[id].vue   # Vista pública de proyecto compartido
│   │   └── admin/                     # Panel administrativo
│   ├── plugins/                       # Plugins de Nuxt (a implementar)
│   ├── stores/auth.ts                 # Pinia store — sesión, partner, company
│   └── utils/                         # Funciones utilitarias puras
├── supabase/
│   ├── config.toml
│   └── migrations/                    # SQL cronológico — nunca editar el pasado
├── types/
│   └── database.types.ts              # Auto-generado por Supabase CLI (`npm run db:types`)
├── nuxt.config.ts
├── package.json
└── tsconfig.json
```

---

## Módulos activos

### General

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Dashboard | `/admin` | — |
| Agenda | `/admin/agenda` | — |
| Contactos (Partners) | `/admin/partners` | `usePartner` |
| Perfil | `/admin/profile` | — |
| Configuración | `/admin/settings` | — |
| Invitaciones | `/admin/invitations` | `useMembership` |
| Manual | `/admin/manual` | `useManual` |

### CRM

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Leads | `/admin/crm/leads` | `useCrmLead`, `useCrmActivity` |
| Pipeline (Stages) | `/admin/crm/stages` | `useCrmStage` |

### Ventas / Compras

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Órdenes | `/admin/orders` | `useOrder`, `useOrderLine` |
| Líneas de orden | `/admin/order-lines` | `useOrderLine` |
| Métodos de pago | `/admin/payment-methods` | `usePaymentMethod` |

### Tienda en línea (Storefront)

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Ajustes de tienda | `/admin/storefront` | `useStorefrontSettings`, `useCompany` |
| Cupones | `/admin/storefront/coupons` | `useStorefrontCoupon` |
| Métodos de envío | `/admin/storefront/shipping-methods` | `useStorefrontShippingMethod` |
| Tienda pública | `/stores/[company_slug]/**` | `useStorefront` (RPCs anon) + store Pinia `storefront` |

> Documentación completa del módulo en `docs/storefront.md`.

### Inventario

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Productos | `/admin/products` | `useProduct` |
| Almacenes | `/admin/warehouses` | `useWarehouse` |
| Movimientos (Pickings) | `/admin/pickings` | `usePicking`, `usePickingLine` |
| Líneas de picking | `/admin/picking-lines` | `usePickingLine` |

### Proyectos

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Proyectos | `/admin/projects` | `useProject`, `useProjectTask`, `useProjectType` |
| Tareas | `/admin/tasks` | `useProjectTask` |

### Aprobaciones

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Solicitudes | `/admin/approval-requests` | `useApprovalRequest` |
| Categorías | `/admin/approval-categories` | `useApprovalCategory` |
| Aprobadores | `/admin/approval-managers` | `useApprovalManager` |

### Sistema

| Módulo | Ruta admin | Composable(s) |
|---|---|---|
| Equipo | `/admin/team` | `useMembership` |
| Empresa | — | `useCompany` |
| Proyecto público | `/public/projects/[id]` | `usePublicProject` |

---

## Patrón de rutas por módulo

Todo módulo con CRUD completo sigue este patrón:

```
pages/admin/{module}/
├── index.vue         # Listado (Datatable)
├── create.vue        # Creación (CardSheet + Form)
└── [id]/
    ├── index.vue     # Detalle / edición (CardSheet + Form)
    └── scan.vue      # Vista especial (ej: QR scan en Pickings)
```

---

## Convenciones de código

### Idioma

| Contexto | Idioma |
|---|---|
| Código fuente (variables, funciones, tipos, archivos) | Inglés |
| UI/UX (labels, placeholders, mensajes, tooltips) | Español |
| Locale para fechas y moneda | `es-MX` |
| Documentación y comentarios de contexto | Español |
| Commits y nombres de branch | Inglés |

### TypeScript

- Siempre estricto; nunca usar `any`
- Usar tipos generados de `~/types/database.types` — `Tables<'entity'>`, `TablesInsert<'entity'>`, `TablesUpdate<'entity'>`
- Props siempre con `interface Props` + `withDefaults(defineProps<Props>(), {...})`
- Emits siempre tipados: `defineEmits<{ 'event-name': [payload: Type] }>()`
- `const` sobre `let`, nunca `var`
- Sin `console.log` en código productivo; solo `console.error` en manejo de errores

### Componentes Vue

- Siempre `<script setup lang="ts">` — nunca Options API
- Orden del bloque en un componente:
  1. `<script lang="ts">` — interfaces exportables (si aplica)
  2. `<script setup lang="ts">` — imports, `definePageMeta`, props, emits, estado, composables, métodos, watchers
  3. `<template>`
  4. `<style scoped>` — solo cuando Tailwind no es suficiente
- Todas las páginas del panel deben declarar: `definePageMeta({ layout: 'admin' })`

### Formularios de módulo (`{Module}/Form.vue`)

- Exportar `{Module}FormData` en bloque `<script lang="ts">` separado
- Exportar `createEmpty{Module}Form()` como factory de inicialización
- Usar `defineModel<FormData>()` para v-model bidireccional
- Prop `readonly: boolean` para alternar vista / edición

---

## Componentes base de UI

### Listados → `Datatable`

```vue
<Datatable
  title="Título"
  description="Descripción"
  :data="items"
  :columns="columns"
  :selectable="true"
  :creatable="true"
  create-label="Nuevo Item"
  @create="handleCreate"
>
  <template #actions="{ row }">...</template>
  <template #bulkActions="{ selected }">...</template>
</Datatable>
```

### Detalle / Edición → `CardSheet`

```vue
<CardSheet
  :title="item.name"
  :subtitle="item.email"
  :is-editing="isEditing"
  :is-loading="isLoading"
  :menu-options="menuOptions"
  @back="handleBack"
  @edit="handleEdit"
  @save="handleSave"
  @cancel="handleCancel"
>
  <ModuleForm v-model="formData" :readonly="!isEditing" />
</CardSheet>
```

### Componentes de formulario base

| Componente | Uso |
|---|---|
| `FormInput` | Campos de texto, número, fecha |
| `FormSelect` | Listas desplegables |
| `FormTextArea` | Áreas de texto multilinea |

### Otros componentes disponibles

| Componente | Variantes / Descripción |
|---|---|
| `BtnApp` | `primary`, `secondary`, `ghost`, `danger` |
| `BadgeApp` | `primary`, `success`, `warning`, `danger` |
| `BtnDelete` | Acciones destructivas con confirmación |
| `Avatar` | Avatar con dropdown de perfil y logout |
| `StatGrid` | Grilla de tarjetas de estadísticas |
| `Chart/MonthlyBars` | Gráfico de barras por mes |
| `Picking/QrCode` | Generación de código QR para pickings |
| `Project/Gantt` | Vista Gantt de tareas de proyecto |
| `Partner/MetricsPanel` | Panel de métricas de un contacto |
| `Team/InviteModal` | Modal para invitar miembros al equipo |
| `Manual/FloatingAssistant` | Asistente flotante en el panel admin |

- SVG inline para iconos (sin librería de iconos externa)

### Paleta de diseño

| Elemento | Clase |
|---|---|
| Gradiente principal | `from-indigo-500 via-violet-600 to-fuchsia-600` |
| Cards | `rounded-2xl shadow-lg shadow-slate-200/50` |
| Botones | `rounded-xl` |
| Texto principal | `text-slate-800` |
| Texto secundario | `text-slate-500` |

---

## Composables — patrón estándar

Archivo: `app/composables/use{Entity}.ts`

```ts
import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

export const useEntity = () => {
  const supabase = useSupabase()

  const getAll = async (): Promise<Tables<'entity'>[]> => {
    const { data, error } = await supabase.from('entity').select('*').order('name')
    if (error) { console.error('Error fetching entities:', error); return [] }
    return data ?? []
  }

  const getById = async (id: string): Promise<Tables<'entity'> | null> => {
    const { data, error } = await supabase.from('entity').select('*').eq('id', id).single()
    if (error) { console.error('Error fetching entity:', error); return null }
    return data
  }

  const create = async (entity: TablesInsert<'entity'>): Promise<Tables<'entity'> | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('entity')
      .insert({ ...entity, created_by: user?.id, updated_by: user?.id })
      .select().single()
    if (error) { console.error('Error creating entity:', error); return null }
    return data
  }

  const update = async (id: string, updates: TablesUpdate<'entity'>): Promise<Tables<'entity'> | null> => {
    const user = await useSupabaseUser()
    const { data, error } = await supabase
      .from('entity')
      .update({ ...updates, updated_by: user?.id })
      .eq('id', id)
      .select().single()
    if (error) { console.error('Error updating entity:', error); return null }
    return data
  }

  const archive = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('entity').update({ active: false }).eq('id', id)
    if (error) { console.error('Error archiving entity:', error); return false }
    return true
  }

  return { getAll, getById, create, update, archive }
}
```

### Reglas clave

- Obtener cliente via `useSupabase()` (singleton en `app/composables/useSupabase.ts`)
- Obtener usuario via `useSupabaseUser()` para auditoría (`created_by`, `updated_by`)
- Manejar errores con `console.error` y retornar `null` / `[]` — no lanzar excepciones
- Soft-delete: `.update({ active: false })` — nunca `.delete()`
- Filtrar siempre por `company_id` (multi-tenant)
- Para búsqueda de texto usar `.ilike('field', '%term%')` o full-text search con config `spanish`

### Helpers de autenticación (`useSupabase.ts`)

El composable `useSupabase.ts` también exporta:

```ts
useSupabaseUser()      // Retorna el usuario autenticado actual
useSupabaseSession()   // Retorna la sesión actual
useSupabaseAuth()      // Retorna { signIn, signUp, signInOrSignUp, signInOrCreate, signOut, requestPasswordReset, updatePassword }
```

---

## Base de datos — Supabase Cloud

> **Importante:** Supabase corre en la nube. No hay instancia local activa. Usar `db:push` para aplicar migraciones y `db:types` con `--linked` (ya configurado en el script).

### Crear una migración

```bash
npm run db:migration:new nombre_descriptivo
```

Formato del nombre: `snake_case` describiendo el cambio (ej: `create_invoice_table`, `add_tax_field_to_product`).

### Estructura estándar de tabla

```sql
CREATE TABLE IF NOT EXISTS public.entity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

  -- campos de negocio aquí

  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.entity ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_entity_updated_at
  BEFORE UPDATE ON public.entity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_entity_company ON public.entity(company_id);
CREATE INDEX idx_entity_active  ON public.entity(active);
```

### Reglas obligatorias

- `company_id` — FK a `company` en toda tabla de negocio (multi-tenant)
- RLS habilitado en **todas** las tablas
- Campos de auditoría: `created_at`, `updated_at`, `created_by`, `updated_by`
- Soft delete: `active BOOLEAN DEFAULT true`
- PKs: UUID con `gen_random_uuid()`
- Trigger `update_updated_at_column()` siempre presente
- Full-text search con config `spanish`
- Nunca editar migraciones pasadas — siempre crear una nueva

### Después de migrar

```bash
npm run db:push    # Aplicar migraciones en Supabase Cloud
npm run db:types   # Regenerar types/database.types.ts (usa --linked)
```

---

## Autenticación y multi-tenancy

- Auth gestionado por Supabase Auth (email + password)
- `useAuthStore` (Pinia) mantiene: `user`, `session`, `partner`, `companies[]`, `selectedCompanyId`, `pendingInvitationCount`
- `partner` — registro de persona vinculado al `user.id` de Supabase
- `selectedCompanyId` persiste en `localStorage` con la clave `flowbit:selected-company-id`
- Empresas accesibles obtenidas via RPC `get_partner_companies`
- Todos los datos de negocio están scoped por `company_id`
- Membresías de equipo: tabla `partner_company_relationship` (roles: `owner`, `admin`, `member`)
- Invitaciones: flujo asincrónico via `useMembership`

### Computed del auth store

| Propiedad | Descripción |
|---|---|
| `isAuthenticated` | `true` si hay sesión activa |
| `selectedCompany` | Objeto de la empresa actualmente seleccionada |
| `partnerDisplayName` | Nombre para mostrar del partner |
| `partnerEmail` | Email del partner |

---

## Layout del panel admin (`app/layouts/admin.vue`)

El layout incluye:

- **Sidebar colapsable** — 20 rem expandido / 5 rem colapsado en desktop, full-width en mobile
- **Grupos de navegación colapsables** organizados por dominio:
  1. General (Dashboard, Agenda, Contactos)
  2. CRM (Leads, Pipeline)
  3. Ventas/Compras (Órdenes, Líneas de orden, Métodos de pago)
  4. Inventario (Productos, Almacenes, Movimientos, Líneas de picking)
  5. Proyectos (Proyectos, Tareas)
  6. Aprobaciones (Solicitudes, Categorías, Aprobadores)
  7. Sistema (Equipo, Manual, Configuración)
- **Header sticky** con:
  - Botón hamburguesa (mobile)
  - Acceso al Manual de usuario
  - Notificaciones (Tareas + Aprobaciones + CRM) con badge y dropdown
  - Invitaciones recibidas con badge y dropdown
  - Selector de empresa multi-empresa
  - Avatar dropdown (perfil, logout)
- Badges numéricas con límite "99+"
- Transiciones y animaciones suaves

---

## Scripts de desarrollo

```bash
# Aplicación
npm run dev                    # Servidor de desarrollo (http://localhost:3000)
npm run build                  # Build de producción
npm run preview                # Preview del build

# Base de datos (Supabase Cloud — --linked)
npm run db:status              # Estado de la conexión
npm run db:migration:new       # Nueva migración
npm run db:migration:up        # Aplicar migraciones localmente (si aplica)
npm run db:migration:list      # Listar migraciones
npm run db:push                # Push de migraciones a Supabase Cloud
npm run db:pull                # Pull de schema desde Supabase Cloud
npm run db:diff                # Ver diferencias de schema
npm run db:types               # Regenerar types/database.types.ts
```

Variables de entorno requeridas (`.env.local`):

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
NUXT_PUBLIC_SITE_URL=
```

---

## Checklist para nuevo módulo

1. Crear migración SQL: `npm run db:migration:new create_{module}_table`
2. Definir la tabla con la estructura estándar (ver sección de BD)
3. Aplicar: `npm run db:push && npm run db:types`
4. Crear composable: `app/composables/use{Module}.ts`
5. Crear formulario: `app/components/{Module}/Form.vue` (exportar `{Module}FormData` y `createEmpty{Module}Form()`)
6. Crear páginas:
   - `app/pages/admin/{module}/index.vue` (listado con `Datatable`)
   - `app/pages/admin/{module}/create.vue` (creación con `CardSheet`)
   - `app/pages/admin/{module}/[id]/index.vue` (detalle/edición con `CardSheet`)
7. Agregar entrada en el sidebar de `app/layouts/admin.vue` en el grupo correspondiente

---

## Convenciones de commits y branches

### Commits — Conventional Commits (inglés)

```
feat(crm): add lead activity timeline
fix(orders): correct total calculation on discount
refactor(composables): extract pagination logic
docs(readme): update installation instructions
style(datatable): adjust mobile responsive layout
chore(deps): update supabase-js to v2.92
perf(pickings): optimize scan query with index
test(partners): add unit tests for usePartner
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `test`, `perf`

### Branches

| Branch | Uso |
|---|---|
| `main` | Producción estable |
| `develop` | Integración de features |
| `feat/{nombre}` | Nuevas funcionalidades |
| `fix/{nombre}` | Correcciones de bugs |
| `refactor/{nombre}` | Refactorizaciones |

---

## Archivos sensibles — NO commitear

- `.env`, `.env.local`, `.env.production`
- `supabase/.env`
- Cualquier archivo con claves API o secretos
